// v1.0: install @google-cloud/storage and uncomment below
// import { Storage } from '@google-cloud/storage';
//
// const gcs = new Storage();
// const bucket = gcs.bucket(process.env.GCS_BUCKET!);

export const gcsAdapter = {
  async save(filePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    // const file = bucket.file(filePath);
    // await file.save(buffer, { contentType: mimeType, resumable: false });
    // return `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${filePath}`;
    throw new Error('GCS adapter not configured — set STORAGE=gcs only in v1.0');
  },
};
