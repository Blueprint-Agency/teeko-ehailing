// modules/identity/avatar.ts
// Profile-picture handling shared by the rider and driver APIs.
//
// A profile picture is display-only: unlike a name or phone number it is not
// identity evidence for APAD/JPJ, so it is self-service on both sides and never
// goes through the driver profile-change review queue. The verification selfie
// (`documents.kind = 'driver_selfie'`) stays a separate, reviewed artefact.
import { eq } from 'drizzle-orm';

import { db } from '../../config/db';
import { users } from '../../db/schema/identity';
import { storage } from '../../lib/storage';
import { DomainError } from '../../shared/errors';

/** Formats a phone camera or gallery realistically produces. */
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

/** Well under the 10 MB multipart ceiling — an avatar never needs more. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type AvatarUpload = {
  buffer: Buffer;
  mimeType: string;
};

/**
 * Store the image and point the user row at it.
 *
 * The object key carries a timestamp rather than overwriting a fixed
 * `avatars/{userId}` key: CDNs and the RN image cache both key on URL, so a
 * stable key would leave the old face on screen after a change.
 */
export async function setAvatar(userId: string, file: AvatarUpload): Promise<string> {
  const ext = ALLOWED_MIME[file.mimeType.toLowerCase()];
  if (!ext) {
    throw new DomainError('AVATAR_UNSUPPORTED_TYPE', 'Upload a JPEG, PNG, WebP or HEIC image.', 415);
  }
  if (file.buffer.length === 0) {
    throw new DomainError('AVATAR_EMPTY', 'The uploaded file was empty.', 400);
  }
  if (file.buffer.length > MAX_AVATAR_BYTES) {
    throw new DomainError('AVATAR_TOO_LARGE', 'Profile pictures must be 5 MB or smaller.', 413);
  }

  const url = await storage.save(`avatars/${userId}/${Date.now()}${ext}`, file.buffer, file.mimeType);
  const updated = await db
    .update(users)
    .set({ avatarUrl: url })
    .where(eq(users.id, userId))
    .returning({ avatarUrl: users.avatarUrl });

  if (updated.length === 0) {
    throw new DomainError('USER_NOT_FOUND', 'Account not found.', 404);
  }
  return url;
}

/**
 * Clear the picture. The stored object is deliberately left in place — the
 * storage adapter only exposes `save`, and orphaned avatars are cheap next to
 * a delete path that could race a concurrent upload.
 */
export async function clearAvatar(userId: string): Promise<void> {
  const updated = await db
    .update(users)
    .set({ avatarUrl: null })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (updated.length === 0) {
    throw new DomainError('USER_NOT_FOUND', 'Account not found.', 404);
  }
}

/**
 * Pull the single file out of a multipart request and read it into memory,
 * bounded by MAX_AVATAR_BYTES. Fastify's own `limits.fileSize` truncates
 * silently, so `file.truncated` is what turns an oversized upload into a 413
 * instead of a corrupt half-image.
 */
export async function readAvatarFile(req: unknown): Promise<AvatarUpload> {
  const data = await (
    req as { file: (opts?: unknown) => Promise<AvatarPart | undefined> }
  ).file({ limits: { fileSize: MAX_AVATAR_BYTES } });
  if (!data) {
    throw new DomainError('AVATAR_MISSING_FILE', 'No image was uploaded.', 400);
  }
  const buffer = await data.toBuffer();
  if (data.file?.truncated) {
    throw new DomainError('AVATAR_TOO_LARGE', 'Profile pictures must be 5 MB or smaller.', 413);
  }
  return { buffer, mimeType: data.mimetype ?? '' };
}

type AvatarPart = {
  mimetype?: string;
  file?: { truncated?: boolean };
  toBuffer: () => Promise<Buffer>;
};
