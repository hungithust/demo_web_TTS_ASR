import { apiBaseUrl, fetchJson, resolveAssetUrl, simulateLatency } from "@/services/api";
import { cmosSamples } from "@/data/cmosSamples";
import { mosSamples } from "@/data/mosSamples";
import type {
  CmosSample,
  MosSample,
  SubmitCmosChoiceRequest,
  SubmitMosScoreRequest,
} from "@/types/eval.types";

// When no backend is configured, fall back to local mock data so the UI can be
// exercised / screenshotted standalone. Set VITE_API_BASE_URL to use the API.
const useMock = apiBaseUrl === "";

// ---- session ----------------------------------------------------------------

const SESSION_KEY = "eval_session_id";

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// ---- backend payload shapes -------------------------------------------------

type MosNextResponse = { trial_id: string; sample_id: string; audio_url: string };
type CmosNextResponse = {
  trial_id: string;
  sample_id: string;
  slot1_url: string;
  slot2_url: string;
};

type SlotChoice = "slot1" | "slot2" | "same";

// Order-bias removal happens on the FE: the backend always returns a fixed
// slot1/slot2 order; we randomly map them onto the displayed A/B positions and
// remember the mapping so we can translate the user's A/B/same choice back to a
// slot before submitting.
const trialDisplayMap = new Map<string, { A: SlotChoice; B: SlotChoice }>();

// ---- mock fallback ----------------------------------------------------------

let mockMosCursor = 0;
let mockCmosCursor = 0;

function randomizeCmos(sample: CmosSample): CmosSample {
  const swap = Math.random() < 0.5;
  return {
    sample_id: sample.sample_id,
    trial_id: sample.trial_id,
    audio_a: swap ? sample.audio_b : sample.audio_a,
    audio_b: swap ? sample.audio_a : sample.audio_b,
  };
}

// ---- MOS --------------------------------------------------------------------

async function getNextMosSample(): Promise<MosSample> {
  if (useMock) {
    await simulateLatency();
    const sample = mosSamples[mockMosCursor % mosSamples.length];
    mockMosCursor += 1;
    return sample;
  }

  const session_id = getSessionId();
  const data = await fetchJson<MosNextResponse>(
    `/api/eval/mos/next?session_id=${encodeURIComponent(session_id)}`,
  );
  return {
    sample_id: data.sample_id,
    trial_id: data.trial_id,
    audio_url: resolveAssetUrl(data.audio_url),
  };
}

async function submitMosScore(payload: SubmitMosScoreRequest): Promise<void> {
  if (useMock) {
    await simulateLatency();
    return;
  }

  await fetchJson<{ ok: boolean }>("/api/eval/mos/submit", {
    method: "POST",
    body: JSON.stringify({
      trial_id: payload.trial_id,
      score: payload.score,
      session_id: getSessionId(),
    }),
  });
}

// ---- CMOS -------------------------------------------------------------------

async function getNextCmosSample(): Promise<CmosSample> {
  if (useMock) {
    await simulateLatency();
    const sample = cmosSamples[mockCmosCursor % cmosSamples.length];
    mockCmosCursor += 1;
    return randomizeCmos(sample);
  }

  const session_id = getSessionId();
  const data = await fetchJson<CmosNextResponse>(
    `/api/eval/cmos/next?session_id=${encodeURIComponent(session_id)}`,
  );

  // randomly assign slot1/slot2 to A/B
  const swap = Math.random() < 0.5;
  const aSlot: SlotChoice = swap ? "slot2" : "slot1";
  const bSlot: SlotChoice = swap ? "slot1" : "slot2";
  trialDisplayMap.set(data.trial_id, { A: aSlot, B: bSlot });

  return {
    sample_id: data.sample_id,
    trial_id: data.trial_id,
    audio_a: resolveAssetUrl(swap ? data.slot2_url : data.slot1_url),
    audio_b: resolveAssetUrl(swap ? data.slot1_url : data.slot2_url),
  };
}

async function submitCmosChoice(payload: SubmitCmosChoiceRequest): Promise<void> {
  if (useMock) {
    await simulateLatency();
    return;
  }

  const mapping = trialDisplayMap.get(payload.trial_id);
  let choice: SlotChoice;
  if (payload.choice === "same") {
    choice = "same";
  } else if (mapping) {
    choice = mapping[payload.choice];
  } else {
    // fallback: no mapping recorded (e.g. page reload) — assume A=slot1
    choice = payload.choice === "A" ? "slot1" : "slot2";
  }

  await fetchJson<{ ok: boolean }>("/api/eval/cmos/submit", {
    method: "POST",
    body: JSON.stringify({
      trial_id: payload.trial_id,
      choice,
      session_id: getSessionId(),
    }),
  });

  trialDisplayMap.delete(payload.trial_id);
}

export const evalService = {
  getNextMosSample,
  submitMosScore,
  getNextCmosSample,
  submitCmosChoice,
};

export { getNextMosSample, submitMosScore, getNextCmosSample, submitCmosChoice };
