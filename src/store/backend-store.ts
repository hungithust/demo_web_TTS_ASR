import { create } from "zustand";
import { getHealth } from "@/services/api";

export type BackendStatus = "online" | "offline";

export interface BackendState {
  status: BackendStatus;
  isChecking: boolean;
  checkHealth: () => Promise<void>;
  setStatus: (status: BackendStatus) => void;
}

export const useBackendStore = create<BackendState>((set) => ({
  status: "offline",
  isChecking: false,
  checkHealth: async () => {
    set({ isChecking: true });
    try {
      const response = await getHealth();
      const status = String(response?.status ?? "").toLowerCase();
      set({ status: status && status !== "error" && status !== "offline" ? "online" : "offline" });
    } catch {
      set({ status: "offline" });
    } finally {
      set({ isChecking: false });
    }
  },
  setStatus: (status) => set({ status }),
}));
