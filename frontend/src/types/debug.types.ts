export type DebugInfo = {
  model?: string;
  latency_ms?: number;
  duration_sec?: number | null;
  voice?: string;
  sample_rate?: number;
  normalized_text?: string;
  response_format?: string;
  speed?: number;
  enable_norm?: boolean;
  [key: string]: unknown;
};
