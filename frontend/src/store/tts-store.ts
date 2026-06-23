import { create } from "zustand";
import { ttsExampleRows } from "@/data/ttsExamples";
import { base64AudioToObjectUrl } from "@/lib/audio";
import { getApiMessage } from "@/services/api";
import { ttsService } from "@/services/tts.service";
import type { DebugInfo } from "@/types/debug.types";
import type { Gender, Region } from "@/types/tts.types";

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
  gender: Gender;
  region: Region;
  enableNorm: boolean;
  debug: boolean;
  debugInfo: DebugInfo | null;
  setText: (text: string) => void;
  setSelectedModel: (model: string) => void;
  setAudio: (audio: TtsAudioState) => void;
  setGender: (gender: Gender) => void;
  setRegion: (region: Region) => void;
  setEnableNorm: (value: boolean) => void;
  setDebug: (debug: boolean) => void;
  clearText: () => void;
  useExampleText: (text?: string) => void;
  copyText: () => Promise<void>;
  loadModels: () => Promise<void>;
  convert: () => Promise<void>;
  resetAudio: () => void;
}

const defaultText = ttsExampleRows[0]?.text ?? "";

export const useTtsStore = create<TtsState>((set, get) => ({
  text: defaultText,
  selectedModel: "",
  models: [],
  isLoadingModels: false,
  isConverting: false,
  error: null,
  audio: { src: null, fileName: null },
  gender: "female",
  region: "north",
  enableNorm: true,
  debug: false,
  debugInfo: null,
  setText: (text) => set({ text }),
  setSelectedModel: (model) =>
    set((state) => ({
      selectedModel: state.models.includes(model) ? model : state.models[0] || "",
    })),
  setAudio: (audio) => set({ audio }),
  setGender: (gender) => set({ gender }),
  setRegion: (region) => set({ region }),
  setEnableNorm: (enableNorm) => set({ enableNorm }),
  setDebug: (debug) => set({ debug, debugInfo: debug ? get().debugInfo : null }),
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
        text: text ?? defaultText,
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
        selectedModel: state.selectedModel || models[0] || "",
      }));
    } catch (error) {
      set({ error: getApiMessage(error, "Failed to load TTS models.") });
    } finally {
      set({ isLoadingModels: false });
    }
  },
  convert: async () => {
    const { text, selectedModel, audio, gender, region, enableNorm, debug } = get();

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
        voice: `${gender}-${region}`,
        enable_norm: enableNorm,
        debug,
      });

      const nextSrc = base64AudioToObjectUrl(response.voice, "audio/wav");
      const previousSrc = audio.src;
      set({
        error: null,
        audio: {
          src: nextSrc,
          fileName: `${selectedModel || "tts-output"}.wav`,
        },
        debugInfo: response.debug ?? null,
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
