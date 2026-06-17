export type EvaluationMode = "mos" | "cmos";

export type ComparisonChoice = "A" | "same" | "B";

export type MosSample = {
  sample_id: string;
  audio_url: string;
};

export type CmosSample = {
  sample_id: string;
  audio_a: string;
  audio_b: string;
};

export type SubmitMosScoreRequest = {
  sample_id: string;
  score: number;
};

export type SubmitCmosChoiceRequest = {
  sample_id: string;
  choice: ComparisonChoice;
};
