import { logger } from '@jetstream/shared/client-logger';
import { ApplicationCookie } from '@jetstream/types';
import amplitude, { Config } from 'amplitude-js';
import isBoolean from 'lodash/isBoolean';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { environment } from '../../../environments/environment';
import * as fromAppState from '../../app-state';

let hasInit = false;
let hasProfileInit = false;

const REMOVE_PROTO_REGEX = new RegExp('^http(s?)://');

function init(appCookie: ApplicationCookie, version: string) {
  hasInit = true;
  if (!environment.amplitudeToken) {
    return;
  }
  const config: Config = !window.electron?.isElectron
    ? {
        apiEndpoint: `${appCookie.serverUrl.replace(REMOVE_PROTO_REGEX, '')}/analytics`,
        forceHttps: false,
      }
    : undefined;
  amplitude.getInstance().init(environment.amplitudeToken, undefined, config);
  amplitude.getInstance().setVersionName(version);
}

export function useAmplitude(optOut?: boolean) {
  const appCookie = useRecoilValue(fromAppState.applicationCookieState);
  const userProfile = useRecoilValue(fromAppState.userProfileState);
  const { version } = useRecoilValue(fromAppState.appVersionState);
  const userPreferences = useRecoilValue(fromAppState.selectUserPreferenceState);

  useEffect(() => {
    if (isBoolean(optOut)) {
      if (optOut) {
        amplitude.getInstance().setOptOut(true);
      } else {
        amplitude.getInstance().setOptOut(false);
      }
    }
  }, [optOut]);

  useEffect(() => {
    if (!hasInit && appCookie) {
      init(appCookie, version);
    }
  }, [appCookie, version]);

  useEffect(() => {
    if (!environment.amplitudeToken) {
      return;
    }
    if (!hasProfileInit && userProfile && appCookie) {
      hasProfileInit = true;
      const identify = new amplitude.Identify()
        .set('id', userProfile.sub)
        .set('email', userProfile.email)
        .set('email-verified', userProfile.email_verified)
        .set('feature-flags', userProfile[environment.authAudience]?.featureFlags)
        .set('environment', appCookie.environment)
        .set('denied-notifications', userPreferences.deniedNotifications)
        .add('app-init-count', 1)
        .add('application-type', window.electron?.platform || 'web');

      amplitude.getInstance().identify(identify);
      amplitude.getInstance().setUserId(userProfile.email);
    }
  }, [userProfile, appCookie, userPreferences]);

  return {
    trackEvent: track,
    project: amplitude.getInstance(),
  };
}

export function usePageViews() {
  const location = useLocation();
  React.useEffect(() => {
    if (!environment.amplitudeToken) {
      return;
    }
    amplitude.getInstance().logEvent('page-view', { url: location.pathname });
  }, [location]);
}

/**
 *
 * @param key
 * @param value Object of any kind (NOT A PRIMITIVE)
 */
export function track(key: string, value?: unknown) {
  try {
    if (!environment.amplitudeToken) {
      return;
    }
    amplitude.getInstance().logEvent(key, value);
  } catch (ex) {
    logger.warn('[TRACKING ERROR]', ex);
  }
}
