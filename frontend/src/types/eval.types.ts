export type EvaluationMode = "mos" | "cmos";

export type ComparisonChoice = "A" | "same" | "B";

export type SessionItem = {
  trial_id: string;
  sample_id: string;
  text: string;
  audio_url?: string | null;   // MOS
  slot1_url?: string | null;   // CMOS
  slot2_url?: string | null;   // CMOS
};

export type EvalSession = {
  eval_session_id: string;
  kind: EvaluationMode;
  size: number;
  items: SessionItem[];
};

export type CriteriaScores = {
  naturalness: number | null;
  audio_quality: number | null;
  intelligibility: number | null;
};

export type SlotChoice = "slot1" | "slot2" | "same";

export type CriteriaChoices = {
  naturalness: ComparisonChoice | null;
  audio_quality: ComparisonChoice | null;
  intelligibility: ComparisonChoice | null;
};

export type SessionAnswer = {
  trial_id: string;
  // MOS: one 0..5 score per criterion
  scores?: { naturalness: number; audio_quality: number; intelligibility: number };
  // CMOS: one preference per criterion
  choices?: { naturalness: SlotChoice; audio_quality: SlotChoice; intelligibility: SlotChoice };
};
