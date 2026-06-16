export type AsrExampleRow = {
  id: string;
  audioTitle: string;
  audioDescription: string;
  durationLabel: string;
  transcripts: Array<{
    model: "Model A" | "Model B" | "Model C";
    text: string;
  }>;
};

export const asrExampleRows: AsrExampleRow[] = [
  {
    id: "asr-example-1",
    audioTitle: "Studio clean speech",
    audioDescription: "Quiet recording with minimal noise.",
    durationLabel: "0:12",
    transcripts: [
      { model: "Model A", text: "Welcome to the AI demo playground." },
      { model: "Model B", text: "Welcome to the AI demo playground." },
      { model: "Model C", text: "Welcome to the AI demo playground." },
    ],
  },
  {
    id: "asr-example-2",
    audioTitle: "Product intro",
    audioDescription: "Natural pacing and presentation cadence.",
    durationLabel: "0:14",
    transcripts: [
      { model: "Model A", text: "Today we are launching a compact speech experience." },
      { model: "Model B", text: "Today we are launching a compact speech experience." },
      { model: "Model C", text: "Today we are launching a compact speech experience." },
    ],
  },
  {
    id: "asr-example-3",
    audioTitle: "Customer support clip",
    audioDescription: "Conversational wording with pauses.",
    durationLabel: "0:11",
    transcripts: [
      { model: "Model A", text: "Please review the generated audio carefully." },
      { model: "Model B", text: "Please review the generated audio carefully." },
      { model: "Model C", text: "Please review the generated audio carefully." },
    ],
  },
  {
    id: "asr-example-4",
    audioTitle: "Multiline transcript",
    audioDescription: "Use this row to validate line breaks.",
    durationLabel: "0:13",
    transcripts: [
      { model: "Model A", text: "Line one of the transcript.\nLine two remains preserved." },
      { model: "Model B", text: "Line one of the transcript.\nLine two remains preserved." },
      { model: "Model C", text: "Line one of the transcript.\nLine two remains preserved." },
    ],
  },
  {
    id: "asr-example-5",
    audioTitle: "Noisy office sample",
    audioDescription: "Background chatter and compression.",
    durationLabel: "0:15",
    transcripts: [
      { model: "Model A", text: "This is the final benchmark row for transcription testing." },
      { model: "Model B", text: "This is the final benchmark row for transcription testing." },
      { model: "Model C", text: "This is the final benchmark row for transcription testing." },
    ],
  },
];
