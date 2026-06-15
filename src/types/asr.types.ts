export type AsrModelsResponse = string[];

export type AsrConvertRequest = {
  voice: string;
  model_name: string;
};

export type AsrConvertResponse = {
  text: string;
};
