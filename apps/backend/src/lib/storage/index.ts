import { localAdapter } from './local.adapter';
import { gcsAdapter } from './gcs.adapter';
import { r2Adapter } from './r2.adapter';

export interface StorageAdapter {
  save(filePath: string, buffer: Buffer, mimeType: string): Promise<string>;
}

const adapters: Record<string, StorageAdapter> = {
  gcs: gcsAdapter,
  r2: r2Adapter,
};

export const storage: StorageAdapter = adapters[process.env.STORAGE ?? ''] ?? localAdapter;
