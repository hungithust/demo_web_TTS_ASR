import { mockTtsAudioBase64 } from "@/data/mock-audio";
import type { TtsConvertRequest, TtsConvertResponse } from "@/types/tts.types";
import { requestWithRetry, simulateLatency } from "@/services/api";

const mockModels = ["model_a", "model_b", "model_c"] as const;

function validateTtsRequest(payload: TtsConvertRequest) {
  if (!payload.text?.trim()) {
    throw new Error("Text is required.");
  }

  if (!mockModels.includes(payload.model_name as (typeof mockModels)[number])) {
    throw new Error("Invalid TTS model.");
  }
}

async function getModels(): Promise<string[]> {
  return requestWithRetry(
    async () => {
      await simulateLatency();
      return [...mockModels];
    },
    { retries: 0 },
  );
}

async function convertText(payload: TtsConvertRequest): Promise<TtsConvertResponse> {
  return requestWithRetry(
    async () => {
      validateTtsRequest(payload);
      await simulateLatency();
      return { voice: mockTtsAudioBase64 };
    },
    { retries: 0 },
  );
}

export const ttsService = {
  getModels,
  convertText,
};

export { getModels as getTtsModels, convertText as convertTextToSpeech };
