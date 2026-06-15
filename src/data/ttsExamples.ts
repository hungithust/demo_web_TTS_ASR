export type TtsExampleRow = {
  id: string;
  text: string;
  outputs: Array<{
    model: "Model A" | "Model B" | "Model C";
    title: string;
    description: string;
    durationLabel: string;
  }>;
};

export const ttsExampleRows: TtsExampleRow[] = [
  {
    id: "tts-example-1",
    text: "Welcome to the AI demo playground. This sample checks clean narration, consistent pacing, and a friendly product-demo tone.",
    outputs: [
      { model: "Model A", title: "Model A", description: "Warm demo voice", durationLabel: "0:12" },
      { model: "Model B", title: "Model B", description: "Balanced delivery", durationLabel: "0:12" },
      { model: "Model C", title: "Model C", description: "Crisp articulation", durationLabel: "0:12" },
    ],
  },
  {
    id: "tts-example-2",
    text: "Today we are launching a compact speech experience designed for fast previews, polished output, and easy integration into product flows.",
    outputs: [
      { model: "Model A", title: "Model A", description: "Launch tone", durationLabel: "0:14" },
      { model: "Model B", title: "Model B", description: "Neutral tone", durationLabel: "0:14" },
      { model: "Model C", title: "Model C", description: "Bright tone", durationLabel: "0:14" },
    ],
  },
  {
    id: "tts-example-3",
    text: "Please review the generated audio and compare clarity, cadence, and stability across different prompts and speaking styles.",
    outputs: [
      { model: "Model A", title: "Model A", description: "Review mode", durationLabel: "0:11" },
      { model: "Model B", title: "Model B", description: "Stable mode", durationLabel: "0:11" },
      { model: "Model C", title: "Model C", description: "Sharp mode", durationLabel: "0:11" },
    ],
  },
  {
    id: "tts-example-4",
    text: "Multiline text is also supported here.\nUse this row to verify wrapping behavior, truncation, and the expand or collapse controls.",
    outputs: [
      { model: "Model A", title: "Model A", description: "Wrapped sample", durationLabel: "0:13" },
      { model: "Model B", title: "Model B", description: "Wrapped sample", durationLabel: "0:13" },
      { model: "Model C", title: "Model C", description: "Wrapped sample", durationLabel: "0:13" },
    ],
  },
  {
    id: "tts-example-5",
    text: "This is the final benchmark row. It is intentionally longer so the table can demonstrate compactness, density, and text overflow handling in a realistic UI.",
    outputs: [
      { model: "Model A", title: "Model A", description: "Final pass", durationLabel: "0:15" },
      { model: "Model B", title: "Model B", description: "Final pass", durationLabel: "0:15" },
      { model: "Model C", title: "Model C", description: "Final pass", durationLabel: "0:15" },
    ],
  },
];
