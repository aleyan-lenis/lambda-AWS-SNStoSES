import { SNSEvent, Context } from 'aws-lambda';
import fetch from 'node-fetch';
import { setTimeout } from 'timers/promises';
import { BuildConfig } from '../../config/buildConfig';

const buildConfig = new BuildConfig('CcalMspEstadosNotificacionesMailStack', 'dev');

const ENDPOINT = buildConfig.getConfig;
const TIMEOUT = parseFloat(process.env.HTTP_TIMEOUT ?? '3') * 1000; // ms
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000; // ms

function buildPayloadFromSns(snsRecord: any): Record<string, any> {
  return {
    Type: snsRecord.Type ?? 'Notification',
    MessageId: snsRecord.MessageId ?? '',
    TopicArn: snsRecord.TopicArn ?? '',
    Subject: snsRecord.Subject ?? 'Amazon SES Email Event Notification',
    Message: snsRecord.Message ?? '',
    Timestamp: snsRecord.Timestamp ?? '',
    SignatureVersion: snsRecord.SignatureVersion ?? '1',
    Signature: snsRecord.Signature ?? '',
    SigningCertURL: snsRecord.SigningCertUrl ?? snsRecord.SigningCertURL ?? '',
    UnsubscribeURL: snsRecord.UnsubscribeUrl ?? snsRecord.UnsubscribeURL ?? '',
    MessageAttributes: snsRecord.MessageAttributes ?? {},
    SubscriptionArn: snsRecord.SubscriptionArn ?? '',
  };
}

async function postWithRetry(payload: any, index: number): Promise<any> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const start = Date.now();
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        timeout: TIMEOUT,
      });

      const elapsed = (Date.now() - start) / 1000;
      const text = await response.text();
      const status = response.status;
      const ok = status >= 200 && status < 300;

      console.info(`POST record ${index} took ${elapsed.toFixed(2)}s`);

      if (!ok) {
        console.warn(`POST failed for record ${index}: status=${status}, body=${text.slice(0, 500)}`);
      } else {
        console.info(`POST succeeded for record ${index}: status=${status}`);
      }

      return {
        index,
        statusCode: status,
        responseBody: text.slice(0, 1000),
      };
    } catch (error: any) {
      console.error(`Error sending record ${index}: ${error.message}`);
      if (attempt < MAX_RETRIES) {
        await setTimeout(RETRY_DELAY);
      } else {
        return {
          index,
          statusCode: 599,
          error: error.message,
        };
      }
    }
  }
}

export const handler = async (event: SNSEvent, context: Context) => {
  const records = event.Records ?? [];
  if (records.length === 0) {
    console.warn('Evento sin Records');
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: 'No Records' }),
    };
  }

  const results = await Promise.all(
    records.map((record, i) => {
      const sns = record.Sns ?? {};
      const payload = buildPayloadFromSns(sns);
      return postWithRetry(payload, i);
    })
  );

  const failures = results.filter((r) => r.statusCode >= 300).length;
  const statusCode = failures === 0 ? 200 : 207;

  return {
    statusCode,
    body: JSON.stringify({
      ok: failures === 0,
      forwardEndpoint: ENDPOINT,
      processed: records.length,
      failures,
      results,
    }),
  };
};
