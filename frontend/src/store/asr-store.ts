import { create } from "zustand";
import { getApiMessage } from "@/services/api";
import { asrService, encodeAudioToBase64 } from "@/services/asr.service";

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
  uploadedAudio: AsrAudioSource | null;
  recordedAudio: AsrAudioSource | null;
  activeSource: AsrActiveSource;
  setSelectedModel: (model: string) => void;
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
  uploadedAudio: null,
  recordedAudio: null,
  activeSource: null,
  setSelectedModel: (model) => set({ selectedModel: model }),
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
  clearTranscription: () => set({ transcription: "", error: null }),
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
      // Backend contract: GET /api/asr/models returns the supported ASR model list.
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
      // Backend contract: POST /api/asr accepts base64 voice and model_name and returns transcription text.
      const voice = await encodeAudioToBase64(currentAudio.file);
      const response = await asrService.convertAudio({
        voice,
        model_name: state.selectedModel,
      });

      if (!response?.text || !response.text.trim()) {
        throw new Error("Empty response from ASR endpoint.");
      }

      set({
        transcription: response.text,
      });
    } catch (error) {
      set({ error: getApiMessage(error, "ASR conversion failed.") });
    } finally {
      set({ isConverting: false });
    }
  },
}));
