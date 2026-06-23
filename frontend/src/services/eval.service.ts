import { apiBaseUrl, fetchJson, resolveAssetUrl, simulateLatency } from "@/services/api";
import type {
  EvalSession,
  EvaluationMode,
  SessionAnswer,
  SessionItem,
} from "@/types/eval.types";

const useMock = apiBaseUrl === "";

const SESSION_KEY = "eval_session_id";

function getClientSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const MOCK_SIZE = 5;

function buildMockSession(kind: EvaluationMode): EvalSession {
  const items: SessionItem[] = Array.from({ length: MOCK_SIZE }).map((_, i) => ({
    trial_id: `t_mock_${kind}_${i}_${Date.now()}`,
    sample_id: `s_mock_${i}`,
    text: `Câu mẫu số ${i + 1} để đối chiếu giọng đọc.`,
    ...(kind === "mos"
      ? { audio_url: "/static/audio/mock_a.wav" }
      : { slot1_url: "/static/audio/mock_a.wav", slot2_url: "/static/audio/mock_b.wav" }),
  }));
  return { eval_session_id: `es_mock_${Date.now()}`, kind, size: MOCK_SIZE, items };
}

function resolveSession(session: EvalSession): EvalSession {
  return {
    ...session,
    items: session.items.map((it) => ({
      ...it,
      audio_url: it.audio_url ? resolveAssetUrl(it.audio_url) : it.audio_url,
      slot1_url: it.slot1_url ? resolveAssetUrl(it.slot1_url) : it.slot1_url,
      slot2_url: it.slot2_url ? resolveAssetUrl(it.slot2_url) : it.slot2_url,
    })),
  };
}

async function startSession(kind: EvaluationMode): Promise<EvalSession> {
  if (useMock) {
    await simulateLatency();
    return resolveSession(buildMockSession(kind));
  }
  const data = await fetchJson<EvalSession>("/api/eval/session/start", {
    method: "POST",
    body: JSON.stringify({ kind, client_session_id: getClientSessionId() }),
  });
  return resolveSession(data);
}

async function completeSession(
  evalSessionId: string,
  answers: SessionAnswer[],
): Promise<void> {
  if (useMock) {
    await simulateLatency();
    return;
  }
  await fetchJson<{ ok: boolean }>("/api/eval/session/complete", {
    method: "POST",
    body: JSON.stringify({
      eval_session_id: evalSessionId,
      client_session_id: getClientSessionId(),
      answers,
    }),
  });
}

export const evalService = { startSession, completeSession };
export { startSession, completeSession };
