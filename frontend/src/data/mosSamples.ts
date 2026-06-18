import type { MosSample } from "@/types/eval.types";

// Mock samples used when no backend is configured (VITE_API_BASE_URL empty),
// so the Evaluation UI can be exercised / screenshotted without a server.
export const mosSamples: MosSample[] = [
  { sample_id: "s1", trial_id: "mock-mos-s1", audio_url: "/mock-tts-audio.wav" },
  { sample_id: "s2", trial_id: "mock-mos-s2", audio_url: "/mock-tts-audio.wav" },
  { sample_id: "s3", trial_id: "mock-mos-s3", audio_url: "/mock-tts-audio.wav" },
];
