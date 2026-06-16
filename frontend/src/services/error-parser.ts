import axios, { type AxiosError } from "axios";
import type { ApiError } from "@/types/api.types";

function toMessage(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function isAxiosError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error);
}

function isApiErrorLike(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "retryable" in error
  );
}

export function parseApiError(error: unknown): ApiError {
  if (isApiErrorLike(error)) {
    return error;
  }

  if (isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data as
      | { message?: unknown; error?: unknown; detail?: unknown }
      | string
      | undefined;

    if (error.code === "ECONNABORTED" || String(error.message).toLowerCase().includes("timeout")) {
      return {
        code: "TIMEOUT",
        message: "Request timed out.",
        status,
        retryable: true,
        details: responseData,
      };
    }

    if (!error.response) {
      return {
        code: "NETWORK_ERROR",
        message: "Network error. Check the backend connection.",
        retryable: true,
      };
    }

    const message =
      typeof responseData === "string"
        ? responseData
        : toMessage(responseData?.message ?? responseData?.error ?? responseData?.detail, "Request failed.");

    return {
      code: "HTTP_ERROR",
      message,
      status,
      retryable: Boolean(status && [408, 429, 500, 502, 503, 504].includes(status)),
      details: responseData,
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message || "Unexpected error.",
      retryable: false,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Unexpected error.",
    retryable: false,
    details: error,
  };
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const parsed = parseApiError(error);
  return parsed.message || fallback;
}

export function isRetryableApiError(error: unknown) {
  return parseApiError(error).retryable;
}
