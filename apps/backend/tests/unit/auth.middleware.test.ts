import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/external/clerk', () => ({
  verifyClerkToken: vi.fn(),
}));

vi.mock('../../src/modules/identity/repo', () => ({
  findUserByExternalId: vi.fn(),
}));

import { clerkAuthVerify } from '../../src/http/middleware/auth';
import { verifyClerkToken } from '../../src/external/clerk';
import { findUserByExternalId } from '../../src/modules/identity/repo';

function makeReq(headers: Record<string, string> = {}) {
  return {
    headers,
    log: { warn: vi.fn(), error: vi.fn() },
  } as never;
}
function makeReply() {
  const reply: { code: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } = {
    code: vi.fn().mockReturnThis() as never,
    send: vi.fn().mockReturnThis() as never,
  };
  return reply as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('clerkAuthVerify', () => {
  it('401s when Authorization header is missing', async () => {
    const req = makeReq({});
    const reply = makeReply();
    await clerkAuthVerify(req, reply);
    expect((reply as { code: ReturnType<typeof vi.fn> }).code).toHaveBeenCalledWith(401);
  });

  it('401s when token verification fails', async () => {
    (verifyClerkToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('bad token'));
    const req = makeReq({ authorization: 'Bearer abc' });
    const reply = makeReply();
    await clerkAuthVerify(req, reply);
    expect((reply as { code: ReturnType<typeof vi.fn> }).code).toHaveBeenCalledWith(401);
  });

  it('attaches clerkAuth and req.user when row exists', async () => {
    (verifyClerkToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: 'user_clerk_123',
      email: 'a@b.com',
    });
    (findUserByExternalId as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'uuid-1',
      role: 'rider',
    });
    const req = makeReq({ authorization: 'Bearer abc' }) as unknown as {
      headers: Record<string, string>;
      clerkAuth?: unknown;
      user?: unknown;
    };
    await clerkAuthVerify(req as never, makeReply());
    expect(req.clerkAuth).toEqual({ sub: 'user_clerk_123', email: 'a@b.com' });
    expect(req.user).toEqual({ id: 'uuid-1', role: 'rider', clerkUserId: 'user_clerk_123' });
  });

  it('attaches only clerkAuth when no row exists yet (first-signup)', async () => {
    (verifyClerkToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: 'user_clerk_456',
    });
    (findUserByExternalId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = makeReq({ authorization: 'Bearer abc' }) as unknown as {
      headers: Record<string, string>;
      clerkAuth?: unknown;
      user?: unknown;
    };
    await clerkAuthVerify(req as never, makeReply());
    expect(req.clerkAuth).toEqual({ sub: 'user_clerk_456' });
    expect(req.user).toBeUndefined();
  });
});
