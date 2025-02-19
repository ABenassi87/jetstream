import { css } from '@emotion/react';
import { BulkJobBatchInfo, BulkJobWithBatches } from '@jetstream/types';
import { FunctionComponent, useEffect, useState } from 'react';
import { DownloadAction, DownloadType, PrepareDataResponseError } from './load-records-results-types';
import LoadRecordsBulkApiResultsTableRow from './LoadRecordsBulkApiResultsTableRow';
import LoadRecordsResultsTableProcessingErrRow from './LoadRecordsResultsTableProcessingErrRow';
export interface LoadRecordsBulkApiResultsTableProps {
  jobInfo: BulkJobWithBatches;
  processingErrors: PrepareDataResponseError[];
  processingStartTime: string;
  processingEndTime: string;
  onDownloadOrView: (action: DownloadAction, type: DownloadType, batch: BulkJobBatchInfo, batchIndex: number) => Promise<void>;
  onDownloadProcessingErrors: () => void;
}

export const LoadRecordsBulkApiResultsTable: FunctionComponent<LoadRecordsBulkApiResultsTableProps> = ({
  jobInfo,
  processingErrors,
  processingStartTime,
  processingEndTime,
  onDownloadOrView,
  onDownloadProcessingErrors,
}) => {
  const [hasErrors, setHasErrors] = useState<boolean>(false);

  useEffect(() => {
    if (!hasErrors) {
      if (jobInfo.batches.some((batch) => batch.numberRecordsFailed)) {
        setHasErrors(true);
      }
    }
  }, [jobInfo, hasErrors]);

  return (
    <table className="slds-table slds-table_cell-buffer slds-table_bordered">
      <thead>
        <tr className="slds-line-height_reset">
          <th
            scope="col"
            css={css`
              width: 30px;
            `}
          ></th>
          <th
            scope="col"
            css={css`
              width: 260px;
            `}
          >
            <div className="slds-truncate" title="State">
              Results
            </div>
          </th>
          <th scope="col">
            <div className="slds-truncate" title="Start Time">
              Start Time
            </div>
          </th>
          <th scope="col">
            <div className="slds-truncate" title="End Time">
              End Time
            </div>
          </th>
          <th scope="col">
            <div className="slds-truncate" title="Records Processed">
              Total Records
            </div>
          </th>
          <th scope="col">
            <div className="slds-truncate" title="Records Failed">
              Processing Results
            </div>
          </th>
          <th scope="col">
            <div className="slds-truncate" title="Status">
              Status
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        {!!processingErrors?.length && (
          <LoadRecordsResultsTableProcessingErrRow
            processingErrors={processingErrors}
            processingStartTime={processingStartTime}
            processingEndTime={processingEndTime}
            onDownload={onDownloadProcessingErrors}
          />
        )}
        {jobInfo.batches.map((batch, i) => (
          <LoadRecordsBulkApiResultsTableRow
            key={batch.id}
            batch={batch}
            hasErrors={hasErrors}
            onDownload={(type, batch) => onDownloadOrView('download', type, batch, i)}
            onView={(type, batch) => onDownloadOrView('view', type, batch, i)}
          />
        ))}
      </tbody>
    </table>
  );
};

export default LoadRecordsBulkApiResultsTable;
