export function verificationEmail(args: {
  name: string | null;
  code: string;
}): { subject: string; html: string } {
  const greeting = args.name ? `Hi ${escapeHtml(args.name)}` : 'Hi there';
  return {
    subject: `Your Teeko verification code: ${args.code}`,
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">${greeting}</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #333;">
          Your Teeko verification code is:
        </p>
        <p style="font-size: 36px; line-height: 1.2; color: #111; letter-spacing: 6px; text-align: center; margin: 24px 0; font-weight: bold;">
          ${args.code}
        </p>
        <p style="font-size: 14px; line-height: 1.5; color: #666;">
          This code expires in 10 minutes. If you didn't request it, ignore this email.
        </p>
        <p style="font-size: 14px; color: #888; margin-top: 32px;">— The Teeko team</p>
      </div>
    `.trim(),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
