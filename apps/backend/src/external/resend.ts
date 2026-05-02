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

/**
 * Send a transactional email. Failures are logged at warn level and swallowed —
 * email is best-effort, never blocks the calling user flow.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  try {
    const result = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (result.error) {
      logger.warn({ to: input.to, subject: input.subject, err: result.error }, 'resend reported error');
    }
  } catch (err) {
    logger.warn({ to: input.to, subject: input.subject, err }, 'resend send failed');
  }
}
