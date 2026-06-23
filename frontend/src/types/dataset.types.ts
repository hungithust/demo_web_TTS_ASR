export type DatasetAudio = {
  model_id: string;
  audio_url: string;
};

export type DatasetSample = {
  id: string;
  text: string;
  category: string | null;
  is_fixed: boolean;
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
