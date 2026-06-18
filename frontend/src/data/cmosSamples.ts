import type { CmosSample } from "@/types/eval.types";

// Mock pairs used when no backend is configured (VITE_API_BASE_URL empty),
// so the Evaluation UI can be exercised / screenshotted without a server.
export const cmosSamples: CmosSample[] = [
  {
    sample_id: "s1",
    trial_id: "mock-cmos-s1",
    audio_a: "/mock-tts-audio.wav?pair=s1&a",
    audio_b: "/mock-tts-audio.wav?pair=s1&b",
  },
  {
    sample_id: "s2",
    trial_id: "mock-cmos-s2",
    audio_a: "/mock-tts-audio.wav?pair=s2&a",
    audio_b: "/mock-tts-audio.wav?pair=s2&b",
  },
  {
    sample_id: "s3",
    trial_id: "mock-cmos-s3",
    audio_a: "/mock-tts-audio.wav?pair=s3&a",
    audio_b: "/mock-tts-audio.wav?pair=s3&b",
  },
];
