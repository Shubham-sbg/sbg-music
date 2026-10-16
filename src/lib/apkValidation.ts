/**
 * SBG MUSIC — Android APK Validation Utility
 *
 * Provides comprehensive client-side and structural validation for Android APK packages
 * before permitting upload to Firebase Storage and document persistence in Firestore.
 */

export interface ApkValidationOptions {
  minSizeBytes?: number;
  maxSizeBytes?: number;
  allowedExtensions?: string[];
  strictManifestCheck?: boolean;
}

export interface ApkValidationResult {
  isValid: boolean;
  error?: string;
  sizeBytes: number;
  sizeFormatted: string;
  sha256?: string;
  mimeType: string;
  fileName: string;
  suggestedVersion?: string;
  suggestedVersionCode?: number;
  hasValidZipHeader: boolean;
  hasAndroidArtifacts?: boolean;
}

const DEFAULT_MIN_SIZE = 500 * 1024; // 500 KB minimum
const DEFAULT_MAX_SIZE = 250 * 1024 * 1024; // 250 MB maximum

const VALID_APK_MIME_TYPES = new Set([
  'application/vnd.android.package-archive',
  'application/x-zip-compressed',
  'application/octet-stream',
  'application/zip',
  'application/x-zip',
  '', // Browsers frequently leave MIME type empty for .apk files
]);

const FORBIDDEN_MIME_PREFIXES = [
  'text/',
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/json',
  'application/javascript',
  'application/xml',
  'text/html',
];

/**
 * Format raw bytes into human readable format (B, KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, idx)).toFixed(dm)) + ' ' + sizes[idx];
}

/**
 * Calculate genuine SHA-256 cryptographic checksum using Web Crypto API.
 */
export async function calculateSha256(file: File | Blob | ArrayBuffer): Promise<string> {
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if the filename ends with a valid APK extension.
 */
export function isValidApkExtension(filename: string, allowed = ['.apk']): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase().trim();
  return allowed.some((ext) => lower.endsWith(ext));
}

/**
 * Validate MIME type against allowed Android package MIME types.
 */
export function isValidApkMimeType(mimeType: string): boolean {
  const normalized = (mimeType || '').toLowerCase().trim();
  if (FORBIDDEN_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  return VALID_APK_MIME_TYPES.has(normalized);
}

/**
 * Checks for standard ZIP / Android APK magic bytes (0x50, 0x4B, 0x03, 0x04).
 */
export function checkZipMagicBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer);
  // PK\x03\x04 (Local file header)
  const isStandardZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  // PK\x05\x06 (Empty zip / End of central directory)
  const isEocd = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x05 && bytes[3] === 0x06;
  return isStandardZip || isEocd;
}

/**
 * Inspects binary chunks to verify the presence of core Android package indicators:
 * AndroidManifest.xml, classes.dex, or resources.arsc.
 */
export async function inspectAndroidPackageArtifacts(file: File | Blob): Promise<boolean> {
  try {
    // Read the first 256 KB or the whole file if smaller
    const sliceSize = Math.min(file.size, 256 * 1024);
    const sliceBuffer = await file.slice(0, sliceSize).arrayBuffer();
    const sliceBytes = new Uint8Array(sliceBuffer);

    // Convert chunk to string for substring detection of Android filenames
    let binaryString = '';
    for (let i = 0; i < sliceBytes.length; i++) {
      binaryString += String.fromCharCode(sliceBytes[i]);
    }

    const hasManifest = binaryString.includes('AndroidManifest.xml');
    const hasDex = binaryString.includes('classes.dex') || binaryString.includes('classes2.dex');
    const hasResources = binaryString.includes('resources.arsc') || binaryString.includes('res/');

    return hasManifest || hasDex || hasResources;
  } catch (err) {
    console.warn('Could not inspect Android package internal artifacts:', err);
    return true; // Non-fatal if slice read is interrupted
  }
}

/**
 * Primary validator for Android APK packages.
 * Enforces extension check, MIME type check, size bounds, ZIP magic bytes, and SHA-256 calculation.
 */
export async function validateApkFile(
  file: File | Blob,
  options: ApkValidationOptions = {}
): Promise<ApkValidationResult> {
  const fileName = (file instanceof File ? file.name : 'package.apk').trim();
  const mimeType = (file.type || '').trim();
  const sizeBytes = file.size;
  const sizeFormatted = formatBytes(sizeBytes);
  const minSize = options.minSizeBytes ?? DEFAULT_MIN_SIZE;
  const maxSize = options.maxSizeBytes ?? DEFAULT_MAX_SIZE;
  const allowedExtensions = options.allowedExtensions ?? ['.apk'];

  // 1. File Extension Verification
  if (!isValidApkExtension(fileName, allowedExtensions)) {
    return {
      isValid: false,
      error: `Invalid file extension "${fileName}". Only genuine .apk files are supported.`,
      sizeBytes,
      sizeFormatted,
      mimeType,
      fileName,
      hasValidZipHeader: false,
    };
  }

  // 2. MIME Type Verification
  if (!isValidApkMimeType(mimeType)) {
    return {
      isValid: false,
      error: `Invalid MIME type (${mimeType || 'unknown'}). Please upload a genuine Android package archive.`,
      sizeBytes,
      sizeFormatted,
      mimeType,
      fileName,
      hasValidZipHeader: false,
    };
  }

  // 3. Size Bounds Check
  if (sizeBytes < minSize) {
    return {
      isValid: false,
      error: `File is too small (${sizeFormatted}). A complete SBG Music standalone Android package must be at least ${formatBytes(minSize)}.`,
      sizeBytes,
      sizeFormatted,
      mimeType,
      fileName,
      hasValidZipHeader: false,
    };
  }

  if (sizeBytes > maxSize) {
    return {
      isValid: false,
      error: `File exceeds maximum allowed size (${sizeFormatted} > ${formatBytes(maxSize)}).`,
      sizeBytes,
      sizeFormatted,
      mimeType,
      fileName,
      hasValidZipHeader: false,
    };
  }

  // 4. ZIP Magic Header Verification
  let hasValidZipHeader = false;
  try {
    const headerBuffer = await file.slice(0, 4).arrayBuffer();
    hasValidZipHeader = checkZipMagicBytes(headerBuffer);

    if (!hasValidZipHeader) {
      return {
        isValid: false,
        error: 'Corrupt or invalid Android APK package. Missing standard ZIP/APK binary header signatures.',
        sizeBytes,
        sizeFormatted,
        mimeType,
        fileName,
        hasValidZipHeader: false,
      };
    }
  } catch (err: any) {
    return {
      isValid: false,
      error: 'Failed to inspect binary header: ' + (err.message || String(err)),
      sizeBytes,
      sizeFormatted,
      mimeType,
      fileName,
      hasValidZipHeader: false,
    };
  }

  // 5. Inspect Android internal package artifacts
  const hasAndroidArtifacts = await inspectAndroidPackageArtifacts(file);
  if (options.strictManifestCheck && !hasAndroidArtifacts) {
    return {
      isValid: false,
      error: 'The uploaded archive does not appear to contain AndroidManifest.xml or classes.dex.',
      sizeBytes,
      sizeFormatted,
      mimeType,
      fileName,
      hasValidZipHeader: true,
      hasAndroidArtifacts: false,
    };
  }

  // 6. Calculate Cryptographic SHA-256 Checksum
  let sha256 = '';
  try {
    sha256 = await calculateSha256(file);
  } catch (err) {
    console.warn('Failed to calculate SHA-256 checksum:', err);
  }

  // 7. Extract Suggested Version and Code from Filename (e.g. SBG-Music-v2.5.0.apk -> 2.5.0)
  let suggestedVersion: string | undefined;
  let suggestedVersionCode: number | undefined;

  const versionMatch = fileName.toLowerCase().match(/v?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
  if (versionMatch && versionMatch[1]) {
    suggestedVersion = versionMatch[1];
    const codeNum = parseInt(versionMatch[1].replace(/\./g, ''), 10);
    if (!isNaN(codeNum)) {
      suggestedVersionCode = codeNum;
    }
  }

  return {
    isValid: true,
    sizeBytes,
    sizeFormatted,
    sha256,
    mimeType,
    fileName,
    suggestedVersion,
    suggestedVersionCode,
    hasValidZipHeader: true,
    hasAndroidArtifacts,
  };
}
