import type { ModelOption } from "@/types/demo";

export const fallbackTtsModelOptions: ModelOption[] = [
  { label: "model_a", value: "model_a" },
  { label: "model_b", value: "model_b" },
  { label: "model_c", value: "model_c" },
];

export const fallbackAsrModelOptions: ModelOption[] = [
  { label: "model_a", value: "model_a" },
  { label: "model_b", value: "model_b" },
  { label: "model_c", value: "model_c" },
];

export type TtsComparisonRow = {
  id: string;
  text: string;
  outputs: Array<{
    label: string;
    description: string;
    durationLabel: string;
  }>;
};

export type AsrComparisonRow = {
  id: string;
  audioTitle: string;
  audioDescription: string;
  durationLabel: string;
  transcripts: Array<{
    label: string;
    text: string;
  }>;
};

export const ttsComparisonRows: TtsComparisonRow[] = [
  {
    id: "tts-1",
    text: "Welcome to the AI demo playground. This sample checks clean narration, consistent pacing, and a friendly product-demo tone.",
    outputs: [
      { label: "Model A", description: "Warm demo voice", durationLabel: "0:12" },
      { label: "Model B", description: "Balanced delivery", durationLabel: "0:12" },
      { label: "Model C", description: "Crisp articulation", durationLabel: "0:12" },
    ],
  },
  {
    id: "tts-2",
    text: "Today we are launching a compact speech experience designed for fast previews, polished output, and easy integration into product flows.",
    outputs: [
      { label: "Model A", description: "Launch tone", durationLabel: "0:14" },
      { label: "Model B", description: "Neutral tone", durationLabel: "0:14" },
      { label: "Model C", description: "Bright tone", durationLabel: "0:14" },
    ],
  },
  {
    id: "tts-3",
    text: "Please review the generated audio and compare clarity, cadence, and stability across different prompts and speaking styles.",
    outputs: [
      { label: "Model A", description: "Review mode", durationLabel: "0:11" },
      { label: "Model B", description: "Stable mode", durationLabel: "0:11" },
      { label: "Model C", description: "Sharp mode", durationLabel: "0:11" },
    ],
  },
  {
    id: "tts-4",
    text: "Multiline text is also supported here.\nUse this row to verify wrapping behavior, truncation, and the expand or collapse controls.",
    outputs: [
      { label: "Model A", description: "Wrapped sample", durationLabel: "0:13" },
      { label: "Model B", description: "Wrapped sample", durationLabel: "0:13" },
      { label: "Model C", description: "Wrapped sample", durationLabel: "0:13" },
    ],
  },
  {
    id: "tts-5",
    text: "This is the final benchmark row. It is intentionally longer so the table can demonstrate compactness, density, and text overflow handling in a realistic UI.",
    outputs: [
      { label: "Model A", description: "Final pass", durationLabel: "0:15" },
      { label: "Model B", description: "Final pass", durationLabel: "0:15" },
      { label: "Model C", description: "Final pass", durationLabel: "0:15" },
    ],
  },
];

export const asrComparisonRows: AsrComparisonRow[] = [
  {
    id: "asr-1",
    audioTitle: "Studio clean speech",
    audioDescription: "Recorded in a quiet environment with minimal noise.",
    durationLabel: "0:12",
    transcripts: [
      { label: "Model A", text: "Welcome to the AI demo playground." },
      { label: "Model B", text: "Welcome to the AI demo playground." },
      { label: "Model C", text: "Welcome to the AI demo playground." },
    ],
  },
  {
    id: "asr-2",
    audioTitle: "Product intro",
    audioDescription: "Natural pacing with a light presentation cadence.",
    durationLabel: "0:14",
    transcripts: [
      { label: "Model A", text: "Today we are launching a compact speech experience." },
      { label: "Model B", text: "Today we are launching a compact speech experience." },
      { label: "Model C", text: "Today we are launching a compact speech experience." },
    ],
  },
  {
    id: "asr-3",
    audioTitle: "Customer support clip",
    audioDescription: "Conversational wording with pauses and emphasis.",
    durationLabel: "0:11",
    transcripts: [
      { label: "Model A", text: "Please review the generated audio carefully." },
      { label: "Model B", text: "Please review the generated audio carefully." },
      { label: "Model C", text: "Please review the generated audio carefully." },
    ],
  },
  {
    id: "asr-4",
    audioTitle: "Multiline transcript",
    audioDescription: "Use this row to validate formatting and paragraph spacing.",
    durationLabel: "0:13",
    transcripts: [
      { label: "Model A", text: "Line one of the transcript.\nLine two remains preserved." },
      { label: "Model B", text: "Line one of the transcript.\nLine two remains preserved." },
      { label: "Model C", text: "Line one of the transcript.\nLine two remains preserved." },
    ],
  },
  {
    id: "asr-5",
    audioTitle: "Noisy office sample",
    audioDescription: "Background chatter and a slightly compressed signal.",
    durationLabel: "0:15",
    transcripts: [
      { label: "Model A", text: "This is the final benchmark row for transcription testing." },
      { label: "Model B", text: "This is the final benchmark row for transcription testing." },
      { label: "Model C", text: "This is the final benchmark row for transcription testing." },
    ],
  },
];
