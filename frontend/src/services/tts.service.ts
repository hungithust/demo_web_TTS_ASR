import { fetchJson } from "@/services/api";
import { parseTtsModelsResponse } from "@/services/response-parsers";
import type { TtsConvertRequest, TtsConvertResponse } from "@/types/tts.types";

async function getModels(): Promise<string[]> {
  const data = await fetchJson<unknown>("/api/tts/models");
  return parseTtsModelsResponse(data);
}

async function convertText(payload: TtsConvertRequest): Promise<TtsConvertResponse> {
  return fetchJson<TtsConvertResponse>("/api/tts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const ttsService = {
  getModels,
  convertText,
};

export { getModels as getTtsModels, convertText as convertTextToSpeech };
