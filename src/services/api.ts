import type { HealthResponse, RetryOptions } from "@/types/api.types";
import { getApiErrorMessage, isRetryableApiError } from "@/services/error-parser";

const minLatencyMs = 500;
const maxLatencyMs = 1000;

function getRandomLatencyMs() {
  return minLatencyMs + Math.round(Math.random() * (maxLatencyMs - minLatencyMs));
}

export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateLatency() {
  await delay(getRandomLatencyMs());
}

export async function requestWithRetry<T>(
  request: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 0;
  const retryDelayMs = options.retryDelayMs ?? 400;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      const retryable = isRetryableApiError(error);
      if (attempt >= retries || !retryable) {
        throw error;
      }
      attempt += 1;
      await delay(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

export function getApiMessage(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback);
}

export async function getHealth(): Promise<HealthResponse> {
  return requestWithRetry(
    async () => {
      await simulateLatency();
      return { status: "ok" };
    },
    { retries: 0 },
  );
}
