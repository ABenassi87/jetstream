import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { FunctionComponent, useRef } from 'react';
import Popover, { PopoverRef } from '../popover/Popover';
import Icon from '../widgets/Icon';

export interface ItemSelectionSummaryProps {
  label?: string;
  items: { value: string; label: string }[];
  onClearItem: (item: string) => void;
  onClearAll: () => void;
}

export const ItemSelectionSummary: FunctionComponent<ItemSelectionSummaryProps> = ({
  label = 'item',
  items = [],
  onClearItem,
  onClearAll,
}) => {
  const popoverRef = useRef<PopoverRef>();

  function handleClearAll() {
    onClearAll();
    popoverRef.current.close();
  }

  function handleClearItem(item: string) {
    onClearItem(item);
    if (items.length === 1) {
      popoverRef.current.close();
    }
  }

  return (
    <div
      css={css`
        min-height: 20px;
      `}
    >
      <Popover
        ref={popoverRef}
        placement="bottom-end"
        header={
          <header className="slds-popover__header">
            <h2 className="slds-text-heading_small" title="Selected Items">
              Selected Items
            </h2>
          </header>
        }
        content={
          <div>
            <p className="slds-text-color_weak">Click on an item to de-select</p>
            <ul className="slds-has-dividers_top-space slds-dropdown_length-5">
              {items.map((item, i) => (
                <li key={`${item.value}-${i}`} className="slds-item slds-text-link" onClick={() => handleClearItem(item.value)}>
                  <div className="slds-truncate" title={item.label}>
                    {item.label}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        }
        footer={
          <footer className="slds-popover__footer">
            <button className="slds-button slds-button_neutral slds-button_stretch" onClick={handleClearAll}>
              Clear All
            </button>
          </footer>
        }
        buttonProps={{
          className: 'slds-button',
          disabled: !items.length,
        }}
      >
        {formatNumber(items.length)} {pluralizeIfMultiple(label, items)} selected
        {!!items.length && <Icon type="utility" icon="chevrondown" omitContainer className="slds-button__icon slds-button__icon_right" />}
      </Popover>
    </div>
  );
};

export default ItemSelectionSummary;
