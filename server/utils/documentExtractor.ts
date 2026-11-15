import zlib from 'zlib';

/**
 * Pure-Node multi-format document text extractor (.md, .txt, .csv, .json, .docx, .pdf).
 * Uses zero external native dependencies so serverless cold starts stay fast.
 */
export function extractTextFromDocument(buffer: Buffer, filename: string, mimeType?: string): string {
  const lower = filename.toLowerCase();

  // 1. Plain Text / Markdown / JSON / CSV
  if (
    lower.endsWith('.md') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.json') ||
    mimeType?.startsWith('text/')
  ) {
    return normalizeWhitespace(buffer.toString('utf8'));
  }

  // 2. DOCX (PKZIP archive -> word/document.xml)
  if (lower.endsWith('.docx') || mimeType?.includes('wordprocessingml')) {
    const extracted = extractDocxXmlText(buffer);
    if (extracted.length > 0) return extracted;
    throw new Error('Could not parse readable text from this DOCX file. Try saving as .md or .txt.');
  }

  // 3. PDF (FlateDecode stream + literal string text operator scanner)
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    const extracted = extractPdfText(buffer);
    if (extracted.length >= 20) return extracted;
    throw new Error(
      'Could not extract plain text from this PDF (it may be scanned/image-based or encrypted). ' +
      'Export the text as Markdown (.md) or paste it directly.'
    );
  }

  throw new Error('Unsupported Knowledge Base file format. Supported: .md, .txt, .docx, .pdf');
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 12000);
}

function extractDocxXmlText(buffer: Buffer): string {
  // Scan PKZIP Local File Headers (0x04034b50) for word/document.xml
  let offset = 0;
  while (offset + 30 < buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset++;
      continue;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLen + extraLen;
    const entryName = buffer.subarray(nameStart, nameStart + fileNameLen).toString('utf8');

    if (entryName === 'word/document.xml' && compressedSize > 0 && dataStart + compressedSize <= buffer.length) {
      const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
      let xmlStr = '';
      if (compressionMethod === 0) {
        xmlStr = compressedData.toString('utf8');
      } else if (compressionMethod === 8) {
        xmlStr = zlib.inflateRawSync(compressedData).toString('utf8');
      }

      if (xmlStr) {
        return normalizeWhitespace(
          xmlStr
            .replace(/<\/w:p>/g, '\n')
            .replace(/<w:tab\/>/g, ' ')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
        );
      }
    }

    offset = Math.max(offset + 1, dataStart + (compressedSize > 0 ? compressedSize : 0));
  }

  return '';
}

function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const chunks: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(raw)) !== null) {
    let streamText = match[1];
    try {
      const streamBuf = Buffer.from(streamText, 'latin1');
      const inflated = zlib.inflateSync(streamBuf);
      streamText = inflated.toString('latin1');
    } catch {
      // Uncompressed stream; inspect directly
    }

    const tjMatches = streamText.match(/\(([^()\\]{1,500}(?:\\.[^()\\]*)*)\)\s*Tj/g);
    if (tjMatches) {
      for (const m of tjMatches) {
        const inner = m.slice(1, m.lastIndexOf(')'));
        chunks.push(inner.replace(/\\([()\\])/g, '$1'));
      }
    }

    const tjArrayMatches = streamText.match(/\[(.*?)\]\s*TJ/g);
    if (tjArrayMatches) {
      for (const arr of tjArrayMatches) {
        const innerStrings = arr.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g);
        if (innerStrings) {
          chunks.push(
            innerStrings
              .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, '$1'))
              .join('')
          );
        }
      }
    }
  }

  return normalizeWhitespace(chunks.join(' ').replace(/[^\x20-\x7E\n]/g, ' '));
}