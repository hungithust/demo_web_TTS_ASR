import type { AsrConvertRequest, AsrConvertResponse } from "@/types/asr.types";
import { fileToBase64 } from "@/lib/audio";
import { fetchJson } from "@/services/api";
import { parseAsrModelsResponse } from "@/services/response-parsers";

async function getModels(): Promise<string[]> {
  const data = await fetchJson<unknown>("/api/asr/models");
  return parseAsrModelsResponse(data);
}

async function convertAudio(payload: AsrConvertRequest): Promise<AsrConvertResponse> {
  return fetchJson<AsrConvertResponse>("/api/asr", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function encodeAudioToBase64(audio: Blob): Promise<string> {
  try {
    return await fileToBase64(audio);
  } catch {
    throw new Error("Failed to encode audio to base64.");
  }
}

export const asrService = {
  getModels,
  convertAudio,
};

export { getModels as getAsrModels, convertAudio as convertSpeechToText };
