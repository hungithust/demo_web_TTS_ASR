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

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

/** Turn a backend-relative path (e.g. /static/audio/x.wav) into an absolute URL. */
export function resolveAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiBaseUrl}${path}`;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      // Skip the ngrok-free browser interstitial so we get JSON, not HTML.
      "ngrok-skip-browser-warning": "true",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function getHealth(): Promise<HealthResponse> {
  if (apiBaseUrl === "") {
    await simulateLatency();
    return { status: "ok" };
  }
  return requestWithRetry(
    async () => fetchJson<HealthResponse>("/health"),
    { retries: 0 },
  );
}
