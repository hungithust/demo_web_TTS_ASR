import { create } from "zustand";
import { ttsService } from "@/services/tts.service";
import { base64AudioToObjectUrl } from "@/lib/audio";
import { getApiMessage } from "@/services/api";

export interface TtsAudioState {
  src: string | null;
  fileName: string | null;
}

export interface TtsState {
  text: string;
  selectedModel: string;
  models: string[];
  isLoadingModels: boolean;
  isConverting: boolean;
  error: string | null;
  audio: TtsAudioState;
  setText: (text: string) => void;
  setSelectedModel: (model: string) => void;
  setAudio: (audio: TtsAudioState) => void;
  clearText: () => void;
  useExampleText: (text?: string) => void;
  copyText: () => Promise<void>;
  loadModels: () => Promise<void>;
  convert: () => Promise<void>;
  resetAudio: () => void;
}

export const useTtsStore = create<TtsState>((set, get) => ({
  text: "",
  selectedModel: "",
  models: [],
  isLoadingModels: false,
  isConverting: false,
  error: null,
  audio: { src: null, fileName: null },
  setText: (text) => set({ text }),
  setSelectedModel: (model) =>
    set((state) => ({
      selectedModel: state.models.includes(model) ? model : state.models[0] || "",
    })),
  setAudio: (audio) => set({ audio }),
  clearText: () =>
    set((state) => {
      if (state.audio.src) {
        URL.revokeObjectURL(state.audio.src);
      }
      return { text: "", audio: { src: null, fileName: null }, error: null };
    }),
  useExampleText: (text) =>
    set((state) => {
      if (state.audio.src) {
        URL.revokeObjectURL(state.audio.src);
      }
      return {
        text: text ?? "",
        audio: { src: null, fileName: null },
        error: null,
      };
    }),
  copyText: async () => {
    const text = get().text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      set({ error: "Copy to clipboard failed." });
    }
  },
  loadModels: async () => {
    set({ isLoadingModels: true, error: null });
    try {
      const models = await ttsService.getModels();
      if (models.length === 0) {
        throw new Error("No TTS models returned by the backend.");
      }
      set((state) => ({
        models,
        selectedModel: state.selectedModel && models.includes(state.selectedModel) ? state.selectedModel : models[0] || "",
      }));
    } catch (error) {
      set({ error: getApiMessage(error, "Failed to load TTS models.") });
    } finally {
      set({ isLoadingModels: false });
    }
  },
  convert: async () => {
    const { text, selectedModel, audio } = get();

    if (!text.trim()) {
      set({ error: "Text is required." });
      return;
    }

    if (!selectedModel) {
      set({ error: "Select a model first." });
      return;
    }

    set({ isConverting: true, error: null });
    try {
      const response = await ttsService.convertText({
        text,
        model_name: selectedModel,
      });

      const nextSrc = base64AudioToObjectUrl(response.voice, "audio/wav");
      const previousSrc = audio.src;
      set({
        error: null,
        audio: {
          src: nextSrc,
          fileName: `${selectedModel || "tts-output"}.wav`,
        },
      });
      if (previousSrc) {
        URL.revokeObjectURL(previousSrc);
      }
    } catch (error) {
      set({ error: getApiMessage(error, "TTS conversion failed.") });
    } finally {
      set({ isConverting: false });
    }
  },
  resetAudio: () => {
    const current = get().audio;
    if (current.src) {
      URL.revokeObjectURL(current.src);
    }
    set({ audio: { src: null, fileName: null } });
  },
}));
