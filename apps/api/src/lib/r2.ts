import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../env.js';

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresInSeconds: number;
}

export async function createR2PresignedUpload(
  env: AppEnv,
  params: { kind: 'poster' | 'backdrop' | 'subtitle'; filename: string; contentType: string },
): Promise<PresignedUploadResult> {
  const safeName = params.filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .slice(0, 80);
  const key = `${params.kind}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  const expiresInSeconds = 600;
  const publicBase = env.R2_PUBLIC_BASE_URL.replace(/\/$/, '');

  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials are not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return {
    uploadUrl,
    publicUrl: `${publicBase}/${key}`,
    key,
    expiresInSeconds,
  };
}
