import { logger } from '@jetstream/shared/client-logger';
import { describeSObject } from '@jetstream/shared/data';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import type { Field } from 'jsforce';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ComboboxWithItems from '../form/combobox/ComboboxWithItems';

function fieldsToListItem(field: Field[]): ListItem[] {
  return field.map((field) => ({
    id: field.name,
    label: field.label,
    value: field.name,
    meta: field,
    secondaryLabel: field.name,
    secondaryLabelOnNewLine: true,
  }));
}

export interface SobjectFieldComboboxRef {
  reload: () => void;
}

export interface SobjectFieldComboboxProps {
  className?: string;
  label?: string;
  helpText?: string;
  labelHelp?: string;
  isRequired?: boolean;
  disabled?: boolean;
  selectedOrg: SalesforceOrgUi;
  selectedSObject: string;
  selectedField: Field;
  isTooling?: boolean;
  filterFn?: (sobject: Field) => boolean;
  onSelectField: (selectedSObject: Field) => void;
}

export const SobjectFieldCombobox = forwardRef<any, SobjectFieldComboboxProps>(
  (
    {
      className,
      label = 'Fields',
      helpText,
      labelHelp,
      isRequired,
      disabled,
      selectedOrg,
      selectedSObject,
      selectedField,
      isTooling,
      filterFn = (field) => true,
      onSelectField,
    },
    ref
  ) => {
    const isMounted = useRef(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>(null);
    const [fields, setFields] = useState<ListItem[]>(null);
    const [priorObject, setPriorObject] = useState(selectedSObject);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    useImperativeHandle<any, SobjectFieldComboboxRef>(ref, () => ({
      reload() {
        setLoading(true);
        setFields(null);
        loadObjects();
      },
    }));

    useEffect(() => {
      if (selectedSObject !== priorObject) {
        setPriorObject(selectedSObject);
        setFields(null);
        setErrorMessage(null);
      }
    }, [priorObject, selectedSObject]);

    const loadObjects = useCallback(async () => {
      const uniqueId = selectedOrg.uniqueId;
      const priorToolingValue = isTooling;
      try {
        setLoading(true);
        const resultsWithCache = await describeSObject(selectedOrg, selectedSObject, isTooling);
        const results = resultsWithCache.data;
        if (!isMounted.current || uniqueId !== selectedOrg.uniqueId || priorToolingValue !== isTooling) {
          return;
        }
        setFields(fieldsToListItem(orderObjectsBy(results.fields.filter(filterFn), 'label')));
      } catch (ex) {
        logger.error(ex);
        if (!isMounted.current || uniqueId !== selectedOrg.uniqueId || priorToolingValue !== isTooling) {
          return;
        }
        setErrorMessage(ex.message);
      }
      setLoading(false);
    }, [selectedOrg, isTooling, selectedSObject, filterFn]);

    useNonInitialEffect(() => {
      setFields(null);
      setErrorMessage(null);
    }, [selectedSObject]);

    useEffect(() => {
      if (selectedOrg && !loading && !errorMessage && !fields) {
        loadObjects();
      }
    }, [selectedOrg, loading, errorMessage, loadObjects, fields]);

    return (
      <ComboboxWithItems
        comboboxProps={{
          className,
          label,
          helpText,
          errorMessage: errorMessage,
          hasError: !!errorMessage,
          labelHelp,
          isRequired,
          disabled,
          itemLength: 10,
          loading,
          placeholder: 'Select a Field',
        }}
        items={fields || []}
        selectedItemId={selectedField?.name}
        onSelected={(item) => onSelectField(item.meta)}
      />
    );
  }
);

export default SobjectFieldCombobox;
