import { create } from "zustand";
import { getApiMessage } from "@/services/api";
import { asrService, encodeAudioToBase64 } from "@/services/asr.service";
import type { DebugInfo } from "@/types/debug.types";

export type AsrAudioSource = {
  file: File;
  previewUrl: string;
  fileName: string;
  mimeType: string;
};

export type AsrActiveSource = "upload" | "record" | null;

export interface AsrState {
  selectedModel: string;
  models: string[];
  isLoadingModels: boolean;
  isConverting: boolean;
  isRecording: boolean;
  error: string | null;
  transcription: string;
  debug: boolean;
  debugInfo: DebugInfo | null;
  uploadedAudio: AsrAudioSource | null;
  recordedAudio: AsrAudioSource | null;
  activeSource: AsrActiveSource;
  setSelectedModel: (model: string) => void;
  setDebug: (debug: boolean) => void;
  setUploadedAudio: (audio: AsrAudioSource | null) => void;
  setRecordedAudio: (audio: AsrAudioSource | null) => void;
  setActiveSource: (source: AsrActiveSource) => void;
  setRecording: (value: boolean) => void;
  setError: (value: string | null) => void;
  clearError: () => void;
  clearTranscription: () => void;
  clearUploadedAudio: () => void;
  clearRecordedAudio: () => void;
  resetAudio: () => void;
  loadModels: () => Promise<void>;
  convert: () => Promise<void>;
}

function revokeAudio(audio: AsrAudioSource | null) {
  if (audio) {
    URL.revokeObjectURL(audio.previewUrl);
  }
}

function getActiveAudio(state: Pick<AsrState, "activeSource" | "uploadedAudio" | "recordedAudio">) {
  if (state.activeSource === "record") return state.recordedAudio;
  if (state.activeSource === "upload") return state.uploadedAudio;
  return state.recordedAudio ?? state.uploadedAudio;
}

export const useAsrStore = create<AsrState>((set, get) => ({
  selectedModel: "",
  models: [],
  isLoadingModels: false,
  isConverting: false,
  isRecording: false,
  error: null,
  transcription: "",
  debug: false,
  debugInfo: null,
  uploadedAudio: null,
  recordedAudio: null,
  activeSource: null,
  setSelectedModel: (model) =>
    set((state) => ({
      selectedModel: state.models.includes(model) ? model : state.models[0] || "",
    })),
  setDebug: (debug) => set({ debug, debugInfo: debug ? get().debugInfo : null }),
  setUploadedAudio: (audio) =>
    set((state) => {
      revokeAudio(state.uploadedAudio);
      return {
        uploadedAudio: audio,
        activeSource: audio ? "upload" : state.activeSource === "upload" ? null : state.activeSource,
        error: null,
      };
    }),
  setRecordedAudio: (audio) =>
    set((state) => {
      revokeAudio(state.recordedAudio);
      return {
        recordedAudio: audio,
        activeSource: audio ? "record" : state.activeSource === "record" ? null : state.activeSource,
        error: null,
      };
    }),
  setActiveSource: (source) => set({ activeSource: source }),
  setRecording: (value) => set({ isRecording: value }),
  setError: (value) => set({ error: value }),
  clearError: () => set({ error: null }),
  clearTranscription: () => set({ transcription: "", debugInfo: null, error: null }),
  clearUploadedAudio: () =>
    set((state) => {
      revokeAudio(state.uploadedAudio);
      return {
        uploadedAudio: null,
        activeSource: state.activeSource === "upload" ? null : state.activeSource,
      };
    }),
  clearRecordedAudio: () =>
    set((state) => {
      revokeAudio(state.recordedAudio);
      return {
        recordedAudio: null,
        activeSource: state.activeSource === "record" ? null : state.activeSource,
      };
    }),
  resetAudio: () =>
    set((state) => {
      revokeAudio(state.uploadedAudio);
      revokeAudio(state.recordedAudio);
      return {
        uploadedAudio: null,
        recordedAudio: null,
        activeSource: null,
      };
    }),
  loadModels: async () => {
    set({ isLoadingModels: true, error: null });
    try {
      const models = await asrService.getModels();
      if (models.length === 0) {
        throw new Error("No ASR models returned by the backend.");
      }
      set((state) => ({
        models,
        selectedModel: state.selectedModel || models[0] || "",
      }));
    } catch (error) {
      set({ error: getApiMessage(error, "Failed to load ASR models.") });
    } finally {
      set({ isLoadingModels: false });
    }
  },
  convert: async () => {
    const state = get();
    const currentAudio = getActiveAudio(state);

    if (!currentAudio) {
      set({ error: "Upload or record an audio file first." });
      return;
    }

    if (!state.selectedModel) {
      set({ error: "Select a model first." });
      return;
    }

    set({ isConverting: true, error: null });
    try {
      const voice = await encodeAudioToBase64(currentAudio.file);
      const response = await asrService.convertAudio({
        voice,
        model_name: state.selectedModel,
        debug: state.debug,
      });

      if (!response?.text || !response.text.trim()) {
        throw new Error("Empty response from ASR endpoint.");
      }

      set({
        transcription: response.text,
        debugInfo: response.debug ?? null,
      });
    } catch (error) {
      set({ error: getApiMessage(error, "ASR conversion failed.") });
    } finally {
      set({ isConverting: false });
    }
  },
}));
