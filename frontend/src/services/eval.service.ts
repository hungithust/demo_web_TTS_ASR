import { cmosSamples } from "@/data/cmosSamples";
import { mosSamples } from "@/data/mosSamples";
import { requestWithRetry, simulateLatency } from "@/services/api";
import type {
  CmosSample,
  ComparisonChoice,
  MosSample,
  SubmitCmosChoiceRequest,
  SubmitMosScoreRequest,
} from "@/types/eval.types";

const submittedMosScores: SubmitMosScoreRequest[] = [];
const submittedCmosChoices: SubmitCmosChoiceRequest[] = [];

let mosCursor = 0;
let cmosCursor = 0;

function pickNextIndex(currentIndex: number, total: number) {
  if (total <= 0) return 0;
  return (currentIndex + 1) % total;
}

function randomizeCmosSample(sample: CmosSample): CmosSample {
  const swapped = Math.random() < 0.5;

  return {
    sample_id: sample.sample_id,
    audio_a: swapped ? sample.audio_b : sample.audio_a,
    audio_b: swapped ? sample.audio_a : sample.audio_b,
  };
}

async function getNextMosSample(): Promise<MosSample> {
  return requestWithRetry(
    async () => {
      await simulateLatency();

      if (mosSamples.length === 0) {
        throw new Error("No MOS samples available.");
      }

      const sample = mosSamples[mosCursor % mosSamples.length];
      mosCursor = pickNextIndex(mosCursor, mosSamples.length);

      return sample;
    },
    { retries: 0 },
  );
}

async function submitMosScore(payload: SubmitMosScoreRequest): Promise<void> {
  return requestWithRetry(
    async () => {
      if (!payload.sample_id.trim()) {
        throw new Error("MOS sample id is required.");
      }

      if (!Number.isFinite(payload.score)) {
        throw new Error("MOS score is required.");
      }

      submittedMosScores.push(payload);
      await simulateLatency();
    },
    { retries: 0 },
  );
}

async function getNextCmosSample(): Promise<CmosSample> {
  return requestWithRetry(
    async () => {
      await simulateLatency();

      if (cmosSamples.length === 0) {
        throw new Error("No CMOS samples available.");
      }

      const sample = cmosSamples[cmosCursor % cmosSamples.length];
      cmosCursor = pickNextIndex(cmosCursor, cmosSamples.length);

      return randomizeCmosSample(sample);
    },
    { retries: 0 },
  );
}

async function submitCmosChoice(payload: SubmitCmosChoiceRequest): Promise<void> {
  return requestWithRetry(
    async () => {
      if (!payload.sample_id.trim()) {
        throw new Error("CMOS sample id is required.");
      }

      if (!["A", "same", "B"].includes(payload.choice)) {
        throw new Error("CMOS choice is required.");
      }

      submittedCmosChoices.push(payload);
      await simulateLatency();
    },
    { retries: 0 },
  );
}

export const evalService = {
  getNextMosSample,
  submitMosScore,
  getNextCmosSample,
  submitCmosChoice,
};

export {
  getNextMosSample,
  submitMosScore,
  getNextCmosSample,
  submitCmosChoice,
};
