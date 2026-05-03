// External provider client — Gmail SMTP via nodemailer.
// Replaces Resend for now (no domain to verify); flip back to Resend later
// by swapping the `sendEmail` import in modules/auth_otp/service.ts.
//
// Setup: enable 2FA on the Gmail account, generate an App Password
// (https://myaccount.google.com/apppasswords), put it in GMAIL_APP_PASSWORD.
import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../config/env';
import { logger } from '../config/logger';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export class EmailDeliveryError extends Error {
  statusCode: number;
  providerName: string;
  constructor(message: string, statusCode = 0, providerName = 'gmail-smtp') {
    super(message);
    this.name = 'EmailDeliveryError';
    this.statusCode = statusCode;
    this.providerName = providerName;
  }
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  // `service: 'gmail'` is nodemailer's shorthand for Gmail's official SMTP
  // settings: host=smtp.gmail.com, port=465, secure=true.
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

/**
 * Send a transactional email via Gmail SMTP. Throws `EmailDeliveryError` on
 * failure so callers can surface a real error to the user.
 *
 * Limits: ~500/day on free Gmail, 2000/day on Google Workspace. From-address
 * is fixed to GMAIL_USER (Gmail blocks sending "from" arbitrary other addresses).
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  try {
    const info = await getTransporter().sendMail({
      from: `Teeko <${env.GMAIL_USER}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    logger.info(
      { to: input.to, subject: input.subject, messageId: info.messageId },
      'gmail-smtp send ok',
    );
    return { id: info.messageId ?? 'unknown' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown SMTP error';
    const code = (err as { code?: string }).code;
    const responseCode = (err as { responseCode?: number }).responseCode;
    logger.error(
      { to: input.to, subject: input.subject, code, responseCode, message },
      'gmail-smtp send failed',
    );
    throw new EmailDeliveryError(message, responseCode ?? 0, 'gmail-smtp');
  }
}
