import { env } from '../config/env';

function inferMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

export class BlobService {
  private bucketEnsured = false;

  private shouldUseSupabase(): boolean {
    if (env.STORAGE_PROVIDER === 'vercel_blob') return false;
    if (env.STORAGE_PROVIDER === 'supabase') {
      return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
    }
    // 'auto': prefer Supabase Storage if configured, otherwise fallback to Vercel Blob
    return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && !process.env.BLOB_READ_WRITE_TOKEN);
  }

  private async ensureSupabaseBucket(baseUrl: string, serviceKey: string, bucket: string): Promise<void> {
    if (this.bucketEnsured) return;
    await fetch(`${baseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: bucket, name: bucket, public: true }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => {});
    this.bucketEnsured = true;
  }

  private async uploadToSupabaseStorage(filename: string, fileBuffer: Buffer): Promise<string> {
    const baseUrl = env.SUPABASE_URL!.replace(/\/$/, '');
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY!;
    const bucket = env.SUPABASE_STORAGE_BUCKET || 'midas-uploads';
    const cleanPath = filename.replace(/^\/+/, '');
    const contentType = inferMimeType(cleanPath);

    const doUpload = () =>
      fetch(`${baseUrl}/storage/v1/object/${bucket}/${cleanPath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(fileBuffer),
        signal: AbortSignal.timeout(15_000),
      });

    let res = await doUpload();
    if (!res.ok && (res.status === 400 || res.status === 404)) {
      const errBody = await res.text();
      if (errBody.toLowerCase().includes('bucket') || errBody.toLowerCase().includes('not found')) {
        await this.ensureSupabaseBucket(baseUrl, serviceKey, bucket);
        res = await doUpload();
      } else {
        throw new Error(`Supabase Storage upload failed (${res.status}): ${errBody}`);
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase Storage upload failed (${res.status}): ${errText}`);
    }

    return `${baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }

  async uploadFile(filename: string, fileBuffer: Buffer): Promise<string> {
    if (this.shouldUseSupabase()) {
      return this.uploadToSupabaseStorage(filename, fileBuffer);
    }

    const { put } = await import('@vercel/blob');
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      addRandomSuffix: true,
    });
    return blob.url;
  }
}

export const blobService = new BlobService();