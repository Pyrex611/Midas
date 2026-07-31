import { put } from '@vercel/blob';

export class BlobService {
  async uploadFile(filename: string, fileBuffer: Buffer): Promise<string> {
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      addRandomSuffix: true, // prevents naming collisions
    });
    return blob.url;
  }
}

export const blobService = new BlobService();