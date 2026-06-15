export interface HealthResponse {
  status: "ok" | "healthy" | string;
}

export type ApiErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "BAD_RESPONSE"
  | "HTTP_ERROR"
  | "UNKNOWN_ERROR";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  status?: number;
  retryable: boolean;
  details?: unknown;
}

export interface RetryOptions {
  retries?: number;
  retryDelayMs?: number;
}
