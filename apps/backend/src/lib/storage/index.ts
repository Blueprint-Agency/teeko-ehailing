import { localAdapter } from './local.adapter';
import { gcsAdapter } from './gcs.adapter';

export interface StorageAdapter {
  save(filePath: string, buffer: Buffer, mimeType: string): Promise<string>;
}

export const storage: StorageAdapter =
  process.env.STORAGE === 'gcs' ? gcsAdapter : localAdapter;
