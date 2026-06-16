export type TtsModelsResponse = string[];

export type TtsConvertRequest = {
  text: string;
  model_name: string;
};

export type TtsConvertResponse = {
  voice: string;
};
