import { auth } from '../lib/firebase';

/**
 * Safely extracts a clean, human-readable error message string from any value.
 * Prevents stringifying JavaScript objects to "[object Object]".
 */
export function getReadableError(error: unknown, fallbackMessage = 'YouTube search is temporarily unavailable. Please try again.'): string {
  if (error === null || error === undefined) {
    return fallbackMessage;
  }

  // Handle strings directly
  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (trimmed && trimmed !== '[object Object]' && trimmed !== 'null' && trimmed !== 'undefined') {
      return trimmed;
    }
    return fallbackMessage;
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    const msg = error.message;
    if (msg && typeof msg === 'string' && msg.trim() !== '[object Object]') {
      return msg.trim();
    }
  }

  // Handle plain objects (e.g., API JSON error responses)
  if (typeof error === 'object') {
    const e = error as Record<string, any>;

    // Common string error fields
    if (typeof e.error === 'string' && e.error.trim() && e.error !== '[object Object]') {
      return e.error.trim();
    }
    if (typeof e.message === 'string' && e.message.trim() && e.message !== '[object Object]') {
      return e.message.trim();
    }
    if (typeof e.userFriendlyMessage === 'string' && e.userFriendlyMessage.trim()) {
      return e.userFriendlyMessage.trim();
    }

    // Nested Google API error shapes: { error: { message: "...", code: 403 } }
    if (e.error && typeof e.error === 'object') {
      if (typeof e.error.message === 'string' && e.error.message.trim()) {
        return e.error.message.trim();
      }
    }

    if (typeof e.details === 'string' && e.details.trim()) {
      return e.details.trim();
    }
    if (typeof e.code === 'string' && e.code.trim()) {
      return `Service notice (${e.code})`;
    }
  }

  return fallbackMessage;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth?.currentUser;
  
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
