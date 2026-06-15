import { create } from "zustand";

export type ActiveTab = "tts" | "asr";

type UiState = {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
};

export const useUiStore = create<UiState>((set) => ({
  activeTab: "tts",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
