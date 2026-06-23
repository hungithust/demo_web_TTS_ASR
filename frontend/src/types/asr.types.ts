import type { DebugInfo } from "@/types/debug.types";

export type AsrModelsResponse = string[];

export type AsrConvertRequest = {
  voice: string;
  model_name: string;
  debug?: boolean;
};

export type AsrConvertResponse = {
  text: string;
  debug?: DebugInfo;
};
