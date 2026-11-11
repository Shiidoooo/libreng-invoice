/** Logos are stored inside the browser database, so keep them small. */
export const MAX_LOGO_FILE_BYTES = 300 * 1024;
/** Base64 grows data by 4/3, plus the "data:image/...;base64," header. */
export const MAX_LOGO_DATA_URL_LENGTH = Math.ceil((MAX_LOGO_FILE_BYTES * 4) / 3) + 64;

type LogoMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

const LOGO_DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export class LogoFileError extends Error {}

/** Identifies the image type from the file's first bytes, ignoring its name and claimed type. */
function detectImageType(bytes: Uint8Array): LogoMimeType | null {
  const startsWith = (signature: number[], offset = 0) => signature.every((byte, i) => bytes[offset + i] === byte);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  // "RIFF" .... "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Reads an uploaded logo into a data URL. Throws LogoFileError for unsupported or oversized files. */
export async function readLogoFile(file: File): Promise<string> {
  if (file.size > MAX_LOGO_FILE_BYTES) {
    throw new LogoFileError(`The logo is too large. Use an image under ${MAX_LOGO_FILE_BYTES / 1024} KB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectImageType(bytes);
  if (!mimeType) throw new LogoFileError('Use a PNG, JPEG or WebP image for the logo.');
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

export function isAllowedLogoDataUrl(value: string): boolean {
  return value.length <= MAX_LOGO_DATA_URL_LENGTH && LOGO_DATA_URL_PATTERN.test(value);
}
