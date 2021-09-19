import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { ImageWithUpload } from '@jetstream/types';
import { Card, Grid, ImageSelector, Input, RichText, ScopedNotification, Spinner } from '@jetstream/ui';
import type { DeltaOperation } from 'quill';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useTitle } from 'react-use';

function hasContent(content: DeltaOperation[]) {
  return content && content.some(({ insert }) => (insert || '').trim());
}

export interface FeedbackFormProps {
  loading: boolean;
  hasError?: boolean;
  onSubmit: (data: { title: string; content: DeltaOperation[]; images: ImageWithUpload[] }) => void;
}

export const FeedbackForm: FunctionComponent<FeedbackFormProps> = ({ loading, hasError, onSubmit }) => {
  useTitle(TITLES.FEEDBACK);
  const cardRef = useRef<HTMLElement>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<DeltaOperation[]>();
  const [imagesLoading, setImagesLoading] = useState(false);
  const [images, setImages] = useState<ImageWithUpload[]>([]);
  const [formValid, setIsFormValid] = useState(false);

  useEffect(() => {
    setImagesLoading(images.some(({ uploading }) => uploading));
  }, [images]);

  useEffect(() => {
    const isValid = title && !imagesLoading && hasContent(content);
    if (formValid !== isValid) {
      setIsFormValid(isValid);
    }
  }, [formValid, imagesLoading, title, content]);

  return (
    <Card
      ref={cardRef}
      className="slds-grow slds-is-relative"
      title="Support and Feedback"
      actions={
        <button className="slds-button slds-button_brand" onClick={() => onSubmit({ title, content, images })} disabled={!formValid}>
          Submit
        </button>
      }
      icon={{ type: 'standard', icon: 'feedback', description: 'submit feedback' }}
      css={css`
        max-width: 800px;
      `}
    >
      {loading && <Spinner />}
      <Grid vertical>
        <p>Ask your questions, report issues, request new features, or just tell us how much you love 😍 Jetstream.</p>
        <p className="slds-m-bottom_small">
          You can always email us at{' '}
          <a href="mailto:support@getjetstream.app" target="_blank" rel="noreferrer">
            support@getjetstream.app
          </a>
          .
        </p>
        {hasError && (
          <ScopedNotification theme="error" className="slds-m-vertical_medium">
            Uh Oh. There was a problem creating your ticket. Please send an email to{' '}
            <a href="mailto:support@getjetstream.app" target="_blank" rel="noreferrer">
              support@getjetstream.app
            </a>{' '}
            to submit your ticket.
          </ScopedNotification>
        )}
        <Input className="slds-m-bottom_small" label="Subject" isRequired>
          <input
            id="label"
            className="slds-input"
            placeholder="Ticket subject"
            value={title}
            disabled={loading}
            maxLength={256}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Input>
        <RichText
          label="Description"
          isRequired
          options={{ placeholder: `Tell us what's going on...` }}
          disabled={loading}
          onChange={setContent}
        />

        <ImageSelector draggableRef={cardRef.current} disabled={loading} onImages={setImages}></ImageSelector>
      </Grid>
    </Card>
  );
};

export default FeedbackForm;
