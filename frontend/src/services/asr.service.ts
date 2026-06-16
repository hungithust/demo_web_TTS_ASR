import type { AsrConvertRequest, AsrConvertResponse } from "@/types/asr.types";
import { fileToBase64 } from "@/lib/audio";
import { requestWithRetry, simulateLatency } from "@/services/api";

const mockModels = ["model_a", "model_b", "model_c"] as const;

function validateAsrRequest(payload: AsrConvertRequest) {
  if (!payload.voice?.trim()) {
    throw new Error("Audio is required.");
  }

  if (!mockModels.includes(payload.model_name as (typeof mockModels)[number])) {
    throw new Error("Invalid ASR model.");
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

async function convertAudio(payload: AsrConvertRequest): Promise<AsrConvertResponse> {
  return requestWithRetry(
    async () => {
      validateAsrRequest(payload);
      await simulateLatency();
      return { text: "This is a fake transcription result." };
    },
    { retries: 0 },
  );
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
