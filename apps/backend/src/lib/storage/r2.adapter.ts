import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const r2Adapter = {
  async save(filePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: filePath,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return `${process.env.R2_PUBLIC_URL}/${filePath}`;
  },
};
