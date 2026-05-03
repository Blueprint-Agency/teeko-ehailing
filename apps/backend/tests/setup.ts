// tests/setup.ts
// Set required env vars before any module imports them (vitest setupFiles run first).

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3001';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder_for_vitest';
process.env.CLERK_WEBHOOK_SIGNING_SECRET ??= 'whsec_placeholder_for_vitest_32chars!!';
process.env.GMAIL_USER ??= 'test@example.com';
process.env.GMAIL_APP_PASSWORD ??= 'placeholder-gmail-app-password';
process.env.GOOGLE_MAPS_API_KEY ??= 'AIza_placeholder_google_key_for_vitest';
