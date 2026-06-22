export type DatasetAudio = {
  model_id: string;
  audio_url: string;
};

export type DatasetSample = {
  id: string;
  text: string;
  category: string | null;
  audios: DatasetAudio[];
};

export type CategoryCount = {
  category: string;
  count: number;
};

export type AddSampleRequest = {
  text: string;
  category: string;
};
