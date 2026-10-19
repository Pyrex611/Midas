export class BlobService {
  async uploadFile(filename: string, fileBuffer: Buffer): Promise<string> {
    const { put } = await import('@vercel/blob');
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      addRandomSuffix: true,
    });
    return blob.url;
  }
}

export const blobService = new BlobService();