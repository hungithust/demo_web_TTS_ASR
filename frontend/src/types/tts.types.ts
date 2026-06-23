import type { DebugInfo } from "@/types/debug.types";

export type TtsModelsResponse = string[];

export type Gender = "male" | "female";
export type Region = "north" | "south";

export type TtsConvertRequest = {
  text: string;
  model_name: string;
  voice?: string;
  debug?: boolean;
  enable_norm?: boolean;
};

export type TtsConvertResponse = {
  voice: string;
  debug?: DebugInfo;
};
