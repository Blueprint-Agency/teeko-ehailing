// External provider client — Resend.
// Wraps the Resend SDK so application code doesn't depend on it directly.
import { Resend } from 'resend';

import { env } from '../config/env';
import { logger } from '../config/logger';

const resend = new Resend(env.RESEND_API_KEY);

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export class EmailDeliveryError extends Error {
  statusCode: number;
  providerName: string;
  constructor(message: string, statusCode = 0, providerName = 'unknown') {
    super(message);
    this.name = 'EmailDeliveryError';
    this.statusCode = statusCode;
    this.providerName = providerName;
  }
}

/**
 * Send a transactional email. Throws `EmailDeliveryError` on Resend failure
 * so callers can surface a real error to the user. Logs at error level so
 * delivery problems are loud in the backend log.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  let result;
  try {
    result = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  } catch (err) {
    logger.error(
      { to: input.to, from: env.RESEND_FROM_EMAIL, subject: input.subject, err },
      'resend SDK threw',
    );
    throw new EmailDeliveryError(
      err instanceof Error ? err.message : 'unknown SDK error',
      0,
      'sdk_throw',
    );
  }
  if (result.error) {
    logger.error(
      {
        to: input.to,
        from: env.RESEND_FROM_EMAIL,
        subject: input.subject,
        statusCode: (result.error as { statusCode?: number }).statusCode,
        providerName: (result.error as { name?: string }).name,
        message: result.error.message,
      },
      'resend rejected the send',
    );
    throw new EmailDeliveryError(
      result.error.message,
      (result.error as { statusCode?: number }).statusCode ?? 0,
      (result.error as { name?: string }).name ?? 'unknown',
    );
  }
  if (!result.data) {
    throw new EmailDeliveryError('resend returned neither error nor data', 0, 'empty_response');
  }
  return { id: result.data.id };
}
