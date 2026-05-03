import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

export const localAdapter = {
  async save(filePath: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const dest = join(UPLOAD_ROOT, filePath);
    await mkdir(join(dest, '..'), { recursive: true });
    await writeFile(dest, buffer);
    // Return a URL path the client can fetch (requires static file serving)
    return `/uploads/${filePath.replace(/\\/g, '/')}`;
  },
};
