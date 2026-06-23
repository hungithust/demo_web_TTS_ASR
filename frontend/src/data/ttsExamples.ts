export type TtsExampleRow = {
  id: string;
  text: string;
  outputs: Array<{
    model: "omnivoice" | "voxcpm2";
    title: string;
    description: string;
    durationLabel: string;
    src: string;
  }>;
};

export const ttsExampleRows: TtsExampleRow[] = [
  {
    id: "tts-example-1",
    text: "Xin chào, đây là bản thử giọng nói tiếng Việt.",
    outputs: [
      {
        model: "omnivoice",
        title: "omnivoice",
        description: "OmniVoice (Qwen3-0.6B)",
        durationLabel: "0:03",
        src: "/examples/tts/tts-example-1-omnivoice.wav",
      },
      {
        model: "voxcpm2",
        title: "voxcpm2",
        description: "VoxCPM2 (MiniCPM-4)",
        durationLabel: "0:03",
        src: "/examples/tts/tts-example-1-voxcpm2.wav",
      },
    ],
  },
  {
    id: "tts-example-2",
    text: "Hôm nay chúng tôi ra mắt trải nghiệm giọng nói nhỏ gọn cho tiếng Việt.",
    outputs: [
      {
        model: "omnivoice",
        title: "omnivoice",
        description: "OmniVoice (Qwen3-0.6B)",
        durationLabel: "0:05",
        src: "/examples/tts/tts-example-2-omnivoice.wav",
      },
      {
        model: "voxcpm2",
        title: "voxcpm2",
        description: "VoxCPM2 (MiniCPM-4)",
        durationLabel: "0:05",
        src: "/examples/tts/tts-example-2-voxcpm2.wav",
      },
    ],
  },
  {
    id: "tts-example-3",
    text: "Hãy nghe và so sánh độ rõ, nhịp điệu và sự ổn định giữa các mô hình.",
    outputs: [
      {
        model: "omnivoice",
        title: "omnivoice",
        description: "OmniVoice (Qwen3-0.6B)",
        durationLabel: "0:04",
        src: "/examples/tts/tts-example-3-omnivoice.wav",
      },
      {
        model: "voxcpm2",
        title: "voxcpm2",
        description: "VoxCPM2 (MiniCPM-4)",
        durationLabel: "0:04",
        src: "/examples/tts/tts-example-3-voxcpm2.wav",
      },
    ],
  },
];
