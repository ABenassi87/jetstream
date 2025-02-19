import { excelWorkbookToArrayBuffer, getMaxWidthFromColumnContent } from '@jetstream/shared/ui-utils';
import { ColumnWithFilter } from '@jetstream/ui';
import * as XLSX from 'xlsx';
import { PermissionTableFieldCell, PermissionTableObjectCell, PermissionTableSummaryRow } from './permission-manager-types';

type ObjectOrFieldColumn =
  | ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>
  | ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>;

export function generateExcelWorkbookFromTable(
  objectData: { columns: ObjectOrFieldColumn[]; rows: PermissionTableObjectCell[] },
  fieldData: { columns: ObjectOrFieldColumn[]; rows: PermissionTableFieldCell[] }
) {
  const workbook = XLSX.utils.book_new();
  const objectWorksheet = generateObjectWorksheet(objectData.columns, objectData.rows);
  const fieldWorksheet = generateFieldWorksheet(fieldData.columns, fieldData.rows);

  XLSX.utils.book_append_sheet(workbook, objectWorksheet, 'Object Permissions');
  XLSX.utils.book_append_sheet(workbook, fieldWorksheet, 'Field Permissions');

  return excelWorkbookToArrayBuffer(workbook);
}

function generateObjectWorksheet(columns: ObjectOrFieldColumn[], rows: PermissionTableObjectCell[]) {
  const merges: XLSX.Range[] = [];
  const header1: string[] = [''];
  const header2: string[] = ['Object'];
  const excelRows = [header1, header2];

  const permissionKeys = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      // header 1
      header1.push(col.name as string);
      header1.push('');
      header1.push('');
      header1.push('');
      header1.push('');
      header1.push('');
      // merge the added cells
      merges.push({
        s: { r: 0, c: header1.length - 6 },
        e: { r: 0, c: header1.length - 1 },
      });
      // header 2
      header2.push('Read');
      header2.push('Create');
      header2.push('Edit');
      header2.push('Delete');
      header2.push('View All');
      header2.push('Modify All');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.key.split('-')[0]);
    });

  rows.forEach((row, i) => {
    const currRow = [row.sobject];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.read ? 'TRUE' : 'FALSE');
      currRow.push(permission.create ? 'TRUE' : 'FALSE');
      currRow.push(permission.edit ? 'TRUE' : 'FALSE');
      currRow.push(permission.delete ? 'TRUE' : 'FALSE');
      currRow.push(permission.viewAll ? 'TRUE' : 'FALSE');
      currRow.push(permission.modifyAll ? 'TRUE' : 'FALSE');
    });
    excelRows.push(currRow);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
  worksheet['!cols'] = getMaxWidthFromColumnContent(excelRows, new Set([0]));
  worksheet['!merges'] = merges;
  return worksheet;
}

function generateFieldWorksheet(columns: ObjectOrFieldColumn[], rows: PermissionTableFieldCell[]) {
  const merges: XLSX.Range[] = [];
  const header1: string[] = ['', '', ''];
  const header2: string[] = ['Object', 'Field Api Name', 'Field Label'];
  const excelRows = [header1, header2];

  const permissionKeys = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      if (col.colSpan) {
        // header 1
        header1.push(col.name as string);
        header1.push('');
        // merge the added cells
        merges.push({
          s: { r: 0, c: header1.length - 2 },
          e: { r: 0, c: header1.length - 1 },
        });
        // header 2
        header2.push('Read');
        header2.push('Edit');
        // keep track of group order to ensure same across all rows
        // key: `${id}-${actionKey}`,
        permissionKeys.push(col.key.split('-')[0]);
      }
    });

  rows.forEach((row, i) => {
    const currRow = [row.sobject, row.apiName, row.label];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.read ? 'TRUE' : 'FALSE');
      currRow.push(permission.edit ? 'TRUE' : 'FALSE');
    });
    excelRows.push(currRow);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
  worksheet['!cols'] = getMaxWidthFromColumnContent(excelRows, new Set([0]));
  worksheet['!merges'] = merges;
  return worksheet;
}
