import * as Sentry from '@sentry/nestjs';
import { capitalize } from 'lodash';

export const setSentryUserContext = (params: {
  userId?: string;
  email?: string;
  orgId?: string;
  paymentId?: string | null;
}) => {
  try {
    Sentry.setUser(
      params.userId
        ? { id: params.userId, ...(params.email ? { email: params.email } : {}) }
        : null
    );
    if (params.orgId) {
      Sentry.setTag('organization.id', params.orgId);
    }
    if (params.paymentId?.startsWith('cus_')) {
      Sentry.setTag('stripe.customer_id', params.paymentId);
    }
  } catch (err) {
    /* never let telemetry break a request */
  }
};

export const initializeSentry = (appName: string, allowLogs = false) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return null;
  }

  try {
    // Loaded here and not at the top of the file: importing the profiler loads a native addon,
    // and that load hangs the process on some starts, even when Sentry is not configured.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { nodeProfilingIntegration } = require('@sentry/profiling-node');
    Sentry.init({
      initialScope: {
        tags: {
          service: appName,
          component: 'nestjs',
        },
        contexts: {
          app: {
            name: `Postiz ${capitalize(appName)}`,
          },
        },
      },
      environment: process.env.NODE_ENV || 'development',
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      spotlight: process.env.SENTRY_SPOTLIGHT === '1',
      integrations: [
        // Add our Profiling integration
        nodeProfilingIntegration(),
        Sentry.consoleLoggingIntegration({ levels: ['log', 'info', 'warn', 'error', 'debug', 'assert', 'trace'] }),
        Sentry.openAIIntegration({
          recordInputs: true,
          recordOutputs: true,
        }),
      ],
      tracesSampler: ({ name, attributes, normalizedRequest, inheritOrSampleWith }) => {
        const path = String(
          normalizedRequest?.url || attributes?.['http.target'] || attributes?.['url.path'] || name || ''
        );
        return inheritOrSampleWith(
          path.includes('/public/v1/analytics/') ? 0.01 : 0.2
        );
      },
      enableLogs: true,

      // Profiling
      profileSessionSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.2,
      profileLifecycle: 'trace',
    });
  } catch (err) {
    console.log(err);
  }
  return true;
};
