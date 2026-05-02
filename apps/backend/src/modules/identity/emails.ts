// Email templates for the identity domain. Plain string templates — when
// volume justifies it we'll move to MJML / react-email.

export function welcomeEmail(args: { name: string | null; email: string }): {
  subject: string;
  html: string;
} {
  const greeting = args.name ? `Hi ${escapeHtml(args.name)}` : 'Hi there';
  return {
    subject: 'Welcome to Teeko',
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">${greeting} 👋</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #333;">
          Thanks for signing up to Teeko. Your account is ready.
        </p>
        <p style="font-size: 16px; line-height: 1.5; color: #333;">
          We'll be in touch as we light up booking and payments.
        </p>
        <p style="font-size: 14px; color: #888; margin-top: 32px;">
          — The Teeko team
        </p>
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
