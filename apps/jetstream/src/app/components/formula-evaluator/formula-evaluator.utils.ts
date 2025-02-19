import { QueryResultsColumn, QueryResultsColumns } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { getMapOf } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import * as formulon from 'formulon';
import { DataType, FormulaDataValue } from 'formulon';
import type { Field } from 'jsforce';
import lodashGet from 'lodash/get';
import isNil from 'lodash/isNil';
import { composeQuery, getField } from 'soql-parser-js';
import { fetchMetadataFromSoql } from '../query/utils/query-soql-utils';
import { NullNumberBehavior } from './formula-evaluator.state';
import { FormulaFieldsByType } from './formula-evaluator.types';

const MATCH_FORMULA_SPECIAL_LABEL = /^\$[a-zA-Z]+\./;

export function getFormulonTypeFromColumnType(col: QueryResultsColumn): DataType {
  if (col.booleanType) {
    return 'checkbox';
  } else if (col.numberType) {
    return 'number';
  } else if (col.apexType === 'Date') {
    return 'date';
  } else if (col.apexType === 'Time') {
    return 'time';
  } else if (col.apexType === 'Datetime') {
    return 'datetime';
  } else if (col.apexType === 'Location') {
    return 'geolocation';
  }
  return 'text';
}

export function getFormulonTypeFromMetadata(col: Field): DataType {
  if (col.type === 'boolean') {
    return 'checkbox';
  } else if (col.type === 'double' || col.type === 'currency' || col.type === 'percent' || col.type === 'int') {
    return 'number';
  } else if (col.type === 'date') {
    return 'date';
  } else if (col.type === 'time') {
    return 'time';
  } else if (col.type === 'datetime') {
    return 'datetime';
  } else if (col.type === 'location') {
    return 'geolocation';
  } else if (col.type === 'picklist') {
    return 'picklist';
  } else if (col.type === 'multipicklist') {
    return 'multipicklist';
  }
  return 'text';
}

/**
 * Function that determines if the provided value is of type QueryResultsColumn or Field
 */
function isQueryResultsColumn(col: QueryResultsColumn | Field): col is QueryResultsColumn {
  return (col as QueryResultsColumn).booleanType !== undefined;
}

export function getFormulonData(col: QueryResultsColumn | Field, value: any, numberNullBehavior = 'ZERO'): FormulaDataValue {
  const dataType = isQueryResultsColumn(col) ? getFormulonTypeFromColumnType(col) : getFormulonTypeFromMetadata(col);
  if (dataType === 'text') {
    return {
      type: 'literal',
      dataType,
      value: value || '',
      options: {
        length: value?.length || 0,
      },
    };
  }
  if (dataType === 'number') {
    const { length, scale } = isQueryResultsColumn(col)
      ? {
          length: getPrecision(value) - 18,
          scale: getPrecision(value),
        }
      : {
          length: col.precision - col.scale,
          scale: col.scale,
        };
    return {
      type: 'literal',
      dataType,
      value: isNil(value) ? (numberNullBehavior === 'ZERO' ? 0 : '') : value,
      options: {
        length,
        scale,
      },
    };
  }
  if (dataType === 'date') {
    return {
      type: 'literal',
      dataType,
      value: isNil(value) ? null : startOfDay(parseISO(value)),
      options: {},
    };
  }
  if (dataType === 'datetime') {
    return {
      type: 'literal',
      dataType,
      value: isNil(value) ? null : parseISO(value),
      options: {
        length: value.length,
        scale: getPrecision(value),
      },
    };
  }
  if (dataType === 'picklist' || dataType === 'multipicklist') {
    return {
      type: 'literal',
      dataType,
      value: value || '',
      options: {
        values: (col as Field).picklistValues?.map(({ value }) => value) || [],
      },
    };
  }
  // FIXME: need to test a bunch of data types here
  // if (isNil(value)) {
  //   return {
  //     type: 'literal',
  //     dataType: 'null',
  //     value: null,
  //   };
  // }
  return {
    type: 'literal',
    dataType,
    value,
  };
}

function getPrecision(a) {
  if (!isFinite(a)) return 0;
  let e = 1;
  let p = 0;
  while (Math.round(a * e) / e !== a) {
    e *= 10;
    p++;
  }
  return p;
}

export async function getFormulaData({
  selectedOrg,
  fields,
  recordId,
  sobjectName,
  numberNullBehavior = 'ZERO',
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  recordId: string;
  sobjectName: string;
  numberNullBehavior: NullNumberBehavior;
}): Promise<
  | { type: 'error'; message: string }
  | { type: 'success'; formulaFields: formulon.FormulaData; warnings: { type: string; message: string }[] }
> {
  const formulaFields: formulon.FormulaData = {};
  const warnings = [];

  const {
    objectFields,
    apiFields,
    customMetadata,
    customLabels,
    organization,
    customPermissions,
    profile,
    customSettings,
    system,
    user,
    userRole,
  } = fields.reduce(
    (output: FormulaFieldsByType, field) => {
      if (!field.startsWith('$')) {
        output.objectFields.push(field);
      } else {
        const identifier = field.toLowerCase().split('.')[0];
        switch (identifier) {
          case '$api':
            output.apiFields.push(field);
            break;
          case '$custommetadata':
            output.customMetadata.push(field);
            break;
          case '$label':
            output.customLabels.push(field);
            break;
          case '$organization':
            output.organization.push(field);
            break;
          case '$permission':
            output.customPermissions.push(field);
            break;
          case '$profile':
            output.profile.push(field);
            break;
          case '$setup':
            output.customSettings.push(field);
            break;
          case '$system':
            output.system.push(field);
            break;
          case '$user':
            output.user.push(field);
            break;
          case '$userrole':
            output.userRole.push(field);
            break;
          default:
            break;
        }
      }
      return output;
    },
    {
      objectFields: [],
      apiFields: [],
      customMetadata: [],
      customLabels: [],
      organization: [],
      customPermissions: [],
      profile: [],
      customSettings: [],
      system: [],
      user: [],
      userRole: [],
    }
  );

  // TODO: this is a good candidate for unit tests
  // TODO: collect warnings
  // These should also be somewhat forgiving
  await collectBaseRecordFields({ selectedOrg, fields: objectFields, recordId, sobjectName, formulaFields, numberNullBehavior });
  collectApiFields({ selectedOrg, fields: apiFields, formulaFields, numberNullBehavior });
  await collectCustomMetadata({ selectedOrg, fields: customMetadata, formulaFields, numberNullBehavior });
  await collectCustomSettingFields({ selectedOrg, fields: customSettings, formulaFields, numberNullBehavior });
  await collectCustomPermissions({ selectedOrg, fields: customPermissions, formulaFields, numberNullBehavior });
  await collectLabels({ selectedOrg, fields: customLabels, formulaFields, numberNullBehavior });
  await collectOrganizationFields({ selectedOrg, fields: organization, formulaFields, numberNullBehavior });
  await collectUserProfileAndRoleFields({
    selectedOrg,
    userFields: user,
    profileFields: profile,
    roleFields: userRole,
    formulaFields,
    numberNullBehavior,
  });
  await collectSystemFields({ fields: system, formulaFields });

  logger.log({ formulaFields, warnings });

  return { type: 'success', formulaFields, warnings };
}

async function collectBaseRecordFields({
  selectedOrg,
  fields,
  recordId,
  sobjectName,
  formulaFields,
  numberNullBehavior,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  recordId: string;
  sobjectName: string;
  formulaFields: formulon.FormulaData;
  numberNullBehavior: NullNumberBehavior;
}) {
  if (!fields.length) {
    return;
  }
  const { queryResults, columns, parsedQuery } = await query(
    selectedOrg,
    composeQuery({
      fields: fields.map(getField),
      sObject: sobjectName,
      where: {
        left: {
          field: 'Id',
          operator: '=',
          value: recordId,
          literalType: 'STRING',
        },
      },
    })
  );

  if (!queryResults.totalSize) {
    throw new Error(`A record with Id ${recordId} was not found.`);
  }

  const fieldsByName = getFieldsByName(columns);
  const { lowercaseFieldMap } = await fetchMetadataFromSoql(selectedOrg, parsedQuery);

  fields.forEach((field) => {
    // Prefer to get field from actual metadata, otherwise picklist is not handled and can cause formula errors
    const column = lowercaseFieldMap[field.toLowerCase()] || fieldsByName[field.toLowerCase()];
    if (!column || !fieldsByName[field.toLowerCase()]) {
      throw new Error(`Field ${field} does not exist on ${sobjectName}.`);
    }
    formulaFields['Id'] = { type: 'literal', dataType: 'text', value: recordId, options: { length: 18 } };
    formulaFields[field] = getFormulonData(
      column,
      lodashGet(queryResults.records[0], fieldsByName[field.toLowerCase()].columnFullPath),
      numberNullBehavior
    );
  });
}

function collectApiFields({
  selectedOrg,
  fields,
  formulaFields,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  formulaFields: formulon.FormulaData;
  numberNullBehavior: NullNumberBehavior;
}) {
  if (!fields.length) {
    return;
  }

  fields.forEach((fieldWithIdentifier) => {
    const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_LABEL, '');
    let value: string;
    if (field.toLowerCase() === 'session_id') {
      value = '*****';
    } else {
      // Output: https://foo-dev-ed.my.salesforce.com/services/Soap/u/56.0/00D500000004712
      const apiVersion = field.split('_').reverse()[0];
      value = `${selectedOrg.instanceUrl}/services/Soap/u/${apiVersion.substring(
        0,
        apiVersion.length - 1
      )}.0/${selectedOrg.organizationId.substring(0, 15)}`;
    }

    formulaFields[fieldWithIdentifier] = { type: 'literal', dataType: 'text', value, options: { length: value.length } };
  });
}

async function collectCustomMetadata({
  selectedOrg,
  fields,
  formulaFields,
  numberNullBehavior,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  formulaFields: formulon.FormulaData;
  numberNullBehavior: NullNumberBehavior;
}) {
  if (!fields.length) {
    return;
  }

  const data = fields.reduce(
    (
      output: Record<
        string,
        { object: string; records: Record<string, { record: string; fields: { field: string; fullField: string }[] }> }
      >,
      fullField
    ) => {
      const [prefix, object, record, field] = fullField.split('.');
      output[object] = output[object] || { object, records: {} };
      output[object].records[record] = output[object].records[record] || { record, fields: [] };
      output[object].records[record].fields.push({ field, fullField });
      return output;
    },
    {}
  );

  // Query each metadata object, extract fields, and add to formulaFields
  for (const metadataObject of Object.keys(data)) {
    const { records } = data[metadataObject];
    const { queryResults, parsedQuery, columns } = await query(
      selectedOrg,
      composeQuery({
        // we could use actual fields instead of all if these has performance issues
        fields: [{ type: 'FieldFunctionExpression', functionName: 'FIELDS', parameters: ['ALL'], rawValue: 'FIELDS(ALL)' }],
        sObject: metadataObject,
        where: {
          left: {
            field: 'QualifiedApiName',
            operator: 'IN',
            value: Object.keys(records),
            literalType: 'STRING',
          },
        },
        limit: 200,
      })
    );

    // Group records by Api name, then get value of each used field in record
    const fieldsByName = getFieldsByName(columns);
    const { lowercaseFieldMap } = await fetchMetadataFromSoql(selectedOrg, parsedQuery);
    const recordsByApiName = getRecordsByLowercaseField(queryResults.records, 'QualifiedApiName');

    Object.values(records).forEach(({ fields, record }) => {
      const metadataRecord = recordsByApiName[record.toLowerCase()];
      fields.forEach(({ field, fullField }) => {
        // Prefer to get field from actual metadata, otherwise picklist is not handled and can cause formula errors
        const column = lowercaseFieldMap[field.toLowerCase()] || fieldsByName[field.toLowerCase()];
        if (!column || !fieldsByName[field.toLowerCase()]) {
          throw new Error(`Field ${field} does not exist on ${metadataObject}.`);
        }
        formulaFields[fullField] = getFormulonData(
          column,
          lodashGet(metadataRecord, fieldsByName[field.toLowerCase()].columnFullPath),
          numberNullBehavior
        );
      });
    });
  }
}

async function collectLabels({
  selectedOrg,
  fields,
  formulaFields,
  numberNullBehavior,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  formulaFields: formulon.FormulaData;
  numberNullBehavior: NullNumberBehavior;
}) {
  if (!fields.length) {
    return;
  }

  const { queryResults } = await query(
    selectedOrg,
    composeQuery({
      // we could use actual fields instead of all if these has performance issues
      fields: [getField('Name'), getField('Value')],
      sObject: 'ExternalString',
      where: {
        left: {
          field: 'Name',
          operator: 'IN',
          value: fields.map((field) => field.split('.')[1]),
          literalType: 'STRING',
        },
      },
      limit: 200,
    }),
    true
  );

  const recordsByApiName = getRecordsByLowercaseField(queryResults.records, 'Name');

  fields.forEach((fieldWithIdentifier) => {
    const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_LABEL, '');
    const recordName = field.toLowerCase();
    const record = recordsByApiName[recordName];
    formulaFields[fieldWithIdentifier] = {
      type: 'literal',
      dataType: 'text',
      value: record.Value,
      options: { length: record.Value.length },
    };
  });
}

async function collectOrganizationFields({
  selectedOrg,
  fields,
  formulaFields,
  numberNullBehavior,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  formulaFields: formulon.FormulaData;
  numberNullBehavior: NullNumberBehavior;
}) {
  if (!fields.length) {
    return;
  }
  const { queryResults, columns } = await query(
    selectedOrg,
    composeQuery({
      fields: [{ type: 'FieldFunctionExpression', functionName: 'FIELDS', parameters: ['ALL'], rawValue: 'FIELDS(ALL)' }],
      sObject: 'Organization',
      limit: 1,
    })
  );

  const fieldsByName = getFieldsByName(columns);

  fields.forEach((fieldWithIdentifier) => {
    const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_LABEL, '');
    const fieldName = field.toLowerCase();
    const column = fieldsByName[fieldName];
    formulaFields[fieldWithIdentifier] = getFormulonData(
      column,
      lodashGet(queryResults.records[0], column.columnFullPath),
      numberNullBehavior
    );
  });
}

async function collectUserProfileAndRoleFields({
  selectedOrg,
  userFields,
  profileFields,
  roleFields,
  formulaFields,
  numberNullBehavior,
}: {
  selectedOrg: SalesforceOrgUi;
  userFields: string[];
  profileFields: string[];
  roleFields: string[];
  formulaFields: formulon.FormulaData;
  numberNullBehavior: NullNumberBehavior;
}) {
  if (!userFields.length && !profileFields.length && !roleFields.length) {
    return;
  }
  const { queryResults, columns } = await query(
    selectedOrg,
    composeQuery({
      fields: Array.from(
        new Set([
          getField('Id'),
          ...userFields.map((field) => getField(field.split('.')[1])),
          getField('Profile.Id'),
          ...profileFields.map((field) => getField(`Profile.${field.split('.')[1]}`)),
          getField('UserRole.Id'),
          ...roleFields.map((field) => getField(`UserRole.${field.split('.')[1]}`)),
        ])
      ),
      sObject: 'User',
      where: {
        left: {
          field: 'Id',
          value: selectedOrg.userId,
          operator: '=',
          literalType: 'STRING',
        },
      },
      limit: 1,
    })
  );

  const { Profile, UserRole, ...User } = queryResults.records[0];

  const fieldsByName = getFieldsByName(columns);

  userFields.forEach((fieldWithIdentifier) => {
    const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_LABEL, '');
    const fieldName = field.toLowerCase();
    const column = fieldsByName[fieldName];
    formulaFields[fieldWithIdentifier] = getFormulonData(column, lodashGet(User, column.columnName), numberNullBehavior);
  });

  profileFields.forEach((fieldWithIdentifier) => {
    const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_LABEL, '');
    const fieldName = field.toLowerCase();
    const column = fieldsByName[`profile.${fieldName}`];
    formulaFields[fieldWithIdentifier] = getFormulonData(column, lodashGet(Profile, column.columnName), numberNullBehavior);
  });

  roleFields.forEach((fieldWithIdentifier) => {
    const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_LABEL, '');
    const fieldName = field.toLowerCase();
    const column = fieldsByName[`userrole.${fieldName}`];
    formulaFields[fieldWithIdentifier] = getFormulonData(column, lodashGet(UserRole, column.columnName), numberNullBehavior);
  });
}

async function collectCustomPermissions({
  selectedOrg,
  fields,
  formulaFields,
  numberNullBehavior,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  formulaFields: formulon.FormulaData;
  numberNullBehavior: NullNumberBehavior;
}) {
  if (!fields.length) {
    return;
  }

  // TODO: not sure how to tackle these yet
}

async function collectCustomSettingFields({
  selectedOrg,
  fields,
  formulaFields,
  numberNullBehavior,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  formulaFields: formulon.FormulaData;
  numberNullBehavior: NullNumberBehavior;
}) {
  if (!fields.length) {
    return;
  }
  // going to be similar to custom metadata BUT will need to apply hierarchy

  const { queryResults } = await query(
    selectedOrg,
    composeQuery({
      fields: Array.from(new Set([getField('Id'), getField('ProfileId')])),
      sObject: 'User',
      where: {
        left: {
          field: 'Id',
          value: selectedOrg.userId,
          operator: '=',
        },
      },
      limit: 1,
    })
  );

  const { Id, ProfileId } = queryResults.records[0];

  const data = fields.reduce((output: Record<string, { object: string; fields: { field: string; fullField: string }[] }>, fullField) => {
    const [prefix, object, field] = fullField.split('.');
    output[object] = output[object] || { object, fields: [] };
    output[object].fields.push({ field, fullField });
    return output;
  }, {});

  // Query each metadata object, extract fields, and add to formulaFields
  for (const customSettingObject of Object.keys(data)) {
    const { fields } = data[customSettingObject];
    const { queryResults, columns } = await query(
      selectedOrg,
      composeQuery({
        // we could use actual fields instead of all if these has performance issues
        fields: [{ type: 'FieldFunctionExpression', functionName: 'FIELDS', parameters: ['ALL'], rawValue: 'FIELDS(ALL)' }],
        sObject: customSettingObject,
        where: {
          left: {
            field: 'SetupOwnerId',
            operator: 'IN',
            value: [Id, ProfileId, selectedOrg.organizationId],
            literalType: 'STRING',
          },
        },
        limit: 200,
      })
    );

    const fieldsByName = getFieldsByName(columns);
    const recordsBySetupId = getMapOf(queryResults.records, 'SetupOwnerId');
    const record = recordsBySetupId[Id] || recordsBySetupId[ProfileId] || recordsBySetupId[selectedOrg.organizationId];

    fields.forEach(({ field, fullField }) => {
      const column = fieldsByName[field];
      formulaFields[fullField] = getFormulonData(column, lodashGet(record, field), numberNullBehavior);
    });
  }
}

async function collectSystemFields({ fields, formulaFields }: { fields: string[]; formulaFields: formulon.FormulaData }) {
  if (!fields.length) {
    return;
  }
  // hard-code date
  formulaFields['$System.OriginDateTime'] = {
    type: 'literal',
    dataType: 'datetime',
    value: new Date(1900, 1, 1),
  };
}

/** get columns by field name in lowercase */
function getFieldsByName(columns: QueryResultsColumns) {
  // get columns by field name in lowercase
  return columns.columns.reduce((output: Record<string, QueryResultsColumn>, item) => {
    output[item.columnFullPath.toLowerCase()] = item;
    return output;
  }, {});
}

function getRecordsByLowercaseField(records: Record<string, any>[], field: string): Record<string, Record<string, any>> {
  return records.reduce((output: Record<string, Record<string, any>>, record) => {
    output[record[field].toLowerCase()] = record;
    return output;
  }, {});
}

export const formulaFunctions = [
  'ABS',
  'ADD',
  'ADDMONTHS',
  'AND',
  'BEGINS',
  'BLANKVALUE',
  'BR',
  'CASE',
  'CASESAFEID',
  'CEILING',
  'CONTAINS',
  // 'CURRENCYRATE', // NOT IMPLEMENTED
  'DATE',
  'DATETIMEVALUE',
  'DATEVALUE',
  'DAY',
  'DISTANCE',
  'DIVIDE',
  'EQUAL',
  'EXP',
  'EXPONENTIATE',
  'FIND',
  'FLOOR',
  'GEOLOCATION',
  'GETSESSIONID',
  'GREATERTHAN',
  'GREATERTHANOREQUAL',
  'HOUR',
  'HYPERLINK',
  'IF',
  'IMAGE',
  'INCLUDES',
  'ISBLANK',
  // 'ISNULL', // NOT IMPLEMENTED
  // 'ISNUMBER', // NOT IMPLEMENTED
  'ISPICKVAL',
  'LEFT',
  'LEN',
  'LESSTHAN',
  'LESSTHANOREQUAL',
  'LN',
  'LOG',
  'LOWER',
  'LPAD',
  'MAX',
  'MCEILING',
  'MFLOOR',
  'MID',
  'MILLISECOND',
  'MIN',
  'MINUTE',
  'MOD',
  'MONTH',
  'MULTIPLY',
  'NOT',
  'NOW',
  // 'NULLVALUE', // NOT IMPLEMENTED
  'OR',
  'REGEX',
  'RIGHT',
  'ROUND',
  'RPAD',
  'SECOND',
  'SQRT',
  'SUBSTITUTE',
  'SUBTRACT',
  'TEXT',
  'TIMENOW',
  'TIMEVALUE',
  'TODAY',
  'TRIM',
  'UNEQUAL',
  'UPPER',
  'VALUE',
  'WEEKDAY',
  'YEAR',
] as const;
