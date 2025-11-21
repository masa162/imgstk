/**
 * imgstk Error Handling System
 *
 * Standardized error codes and responses for the API.
 * Client-side error messages are in Japanese.
 */

/**
 * Machine-readable error codes
 */
export enum ErrorCode {
  // Request validation errors (400)
  INVALID_REQUEST = 'INVALID_REQUEST',
  TOO_MANY_FILES = 'TOO_MANY_FILES',
  FILE_TYPE_INVALID = 'FILE_TYPE_INVALID',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILENAME = 'INVALID_FILENAME',

  // Resource not found (404)
  BATCH_NOT_FOUND = 'BATCH_NOT_FOUND',
  IMAGE_NOT_FOUND = 'IMAGE_NOT_FOUND',

  // Server errors (500)
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Standardized error response interface
 */
export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  timestamp?: string;
}

/**
 * HTTP status codes for each error type
 */
const ErrorStatusMap: Record<ErrorCode, number> = {
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.TOO_MANY_FILES]: 400,
  [ErrorCode.FILE_TYPE_INVALID]: 400,
  [ErrorCode.FILE_TOO_LARGE]: 400,
  [ErrorCode.INVALID_FILENAME]: 400,
  [ErrorCode.BATCH_NOT_FOUND]: 404,
  [ErrorCode.IMAGE_NOT_FOUND]: 404,
  [ErrorCode.UPLOAD_FAILED]: 500,
  [ErrorCode.DELETE_FAILED]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.STORAGE_ERROR]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

/**
 * Create a standardized error response
 */
export function createError(
  code: ErrorCode,
  message: string,
  includeTimestamp = false
): ErrorResponse {
  const error: ErrorResponse = {
    error: message,
    code,
  };

  if (includeTimestamp) {
    error.timestamp = new Date().toISOString();
  }

  return error;
}

/**
 * Helper functions for common errors
 */
export const Errors = {
  invalidRequest: (message = 'Invalid request') =>
    createError(ErrorCode.INVALID_REQUEST, message),

  tooManyFiles: (max: number) =>
    createError(ErrorCode.TOO_MANY_FILES, `Maximum ${max} files allowed`),

  fileTypeInvalid: (allowedTypes: string) =>
    createError(ErrorCode.FILE_TYPE_INVALID, `Only ${allowedTypes} files are allowed`),

  fileTooLarge: (maxMB: number) =>
    createError(ErrorCode.FILE_TOO_LARGE, `File size must be less than ${maxMB}MB`),

  invalidFilename: (filename: string) =>
    createError(ErrorCode.INVALID_FILENAME, `Invalid filename: ${filename}`),

  batchNotFound: (batchId: number) =>
    createError(ErrorCode.BATCH_NOT_FOUND, `Batch ${batchId} not found`),

  imageNotFound: (filename: string) =>
    createError(ErrorCode.IMAGE_NOT_FOUND, `Image ${filename} not found`),

  uploadFailed: () =>
    createError(ErrorCode.UPLOAD_FAILED, 'Upload failed'),

  deleteFailed: () =>
    createError(ErrorCode.DELETE_FAILED, 'Failed to delete'),

  databaseError: () =>
    createError(ErrorCode.DATABASE_ERROR, 'Database operation failed'),

  storageError: () =>
    createError(ErrorCode.STORAGE_ERROR, 'Storage operation failed'),

  internalError: () =>
    createError(ErrorCode.INTERNAL_ERROR, 'Internal server error'),
};

/**
 * Get HTTP status code for an error code
 */
export function getErrorStatus(code: ErrorCode): number {
  return ErrorStatusMap[code] || 500;
}
