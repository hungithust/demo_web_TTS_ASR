export type AsrExampleRow = {
  id: string;
  audioTitle: string;
  audioDescription: string;
  durationLabel: string;
  audioSrc: string;
  transcripts: Array<{
    model: "qwen3-asr-1.7b" | "phowhisper-large" | "parakeet-ctc";
    text: string;
  }>;
};

export const asrExampleRows: AsrExampleRow[] = [
  {
    id: "vi-sample-1",
    audioTitle: "vi_sample_1.wav",
    audioDescription: "Natural Vietnamese narration.",
    durationLabel: "0:04",
    audioSrc: "/examples/asr/vi_sample_1.wav",
    transcripts: [
      { model: "qwen3-asr-1.7b", text: "và cũng hỗ trợ cho lâu lâu cũng cho gạo cho này kia." },
      { model: "phowhisper-large", text: "rồi cũng hỗ trợ cho lâu lâu cũng cho gạo cho này kia." },
      { model: "parakeet-ctc", text: "Rồi cũng hỗ trợ cho lâu lâu cũng cho gạo cho này kia." },
    ],
  },
  {
    id: "vi-sample-2",
    audioTitle: "vi_sample_2.wav",
    audioDescription: "Short sentence, medical topic.",
    durationLabel: "0:02",
    audioSrc: "/examples/asr/vi_sample_2.wav",
    transcripts: [
      { model: "qwen3-asr-1.7b", text: "những nơi đã không chế được căn bệnh." },
      { model: "phowhisper-large", text: "những nơi đã khống chế được căn bệnh." },
      { model: "parakeet-ctc", text: "Những nơi đã khống chế được căn bệnh." },
    ],
  },
  {
    id: "vi-sample-3",
    audioTitle: "vi_sample_3.wav",
    audioDescription: "Device control command.",
    durationLabel: "0:02",
    audioSrc: "/examples/asr/vi_sample_3.wav",
    transcripts: [
      { model: "qwen3-asr-1.7b", text: "âm lượng tivi giảm." },
      { model: "phowhisper-large", text: "âm lượng ti vi giảm." },
      { model: "parakeet-ctc", text: "Âm lượng ti vi giảm." },
    ],
  },
];
