import type { AsrModelsResponse } from "@/types/asr.types";
import type { TtsModelsResponse } from "@/types/tts.types";

function parseModelList(data: unknown, label: string): string[] {
  if (Array.isArray(data)) {
    return data.filter((value): value is string => typeof value === "string");
  }

  throw new Error(`Invalid ${label} models response.`);
}

export function parseTtsModelsResponse(data: unknown): string[] {
  return parseModelList(data as TtsModelsResponse | unknown, "TTS");
}

export function parseAsrModelsResponse(data: unknown): string[] {
  return parseModelList(data as AsrModelsResponse | unknown, "ASR");
}
