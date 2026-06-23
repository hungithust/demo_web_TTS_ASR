import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayer } from "@/components/shared/audio-player";
import { ComparisonSelector, type ComparisonChoice } from "@/components/shared/comparison-selector";
import { PrimaryButton } from "@/components/shared/primary-button";
import { ScoreSelector } from "@/components/shared/score-selector";
import { SectionContainer } from "@/components/shared/section-container";
import { cn } from "@/lib/utils";
import { evalService } from "@/services/eval.service";
import { getApiMessage } from "@/services/api";
import type { EvalSession, EvaluationMode, SessionAnswer, SessionItem } from "@/types/eval.types";

type Phase = "notice" | "in_progress" | "submitting" | "done";

// A/B display mapping for CMOS (remove order bias), keyed by trial_id.
type AbMap = Record<string, { A: "slot1" | "slot2"; B: "slot1" | "slot2" }>;

export function EvaluationPage() {
  const [mode, setMode] = useState<EvaluationMode>("mos");
  const [phase, setPhase] = useState<Phase>("notice");
  const [session, setSession] = useState<EvalSession | null>(null);
  const [cursor, setCursor] = useState(0);
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // current-item answer + playback gates
  const [mosScore, setMosScore] = useState<number | null>(null);
  const [choice, setChoice] = useState<ComparisonChoice | null>(null);
  const [playedMos, setPlayedMos] = useState(false);
  const [playedA, setPlayedA] = useState(false);
  const [playedB, setPlayedB] = useState(false);

  const abMap = useRef<AbMap>({});

  const inProgress = phase === "in_progress" || phase === "submitting";

  // Warn on tab close / refresh while a session is unfinished.
  useEffect(() => {
    if (!inProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [inProgress]);

  function resetItemState() {
    setMosScore(null);
    setChoice(null);
    setPlayedMos(false);
    setPlayedA(false);
    setPlayedB(false);
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const s = await evalService.startSession(mode);
      if (mode === "cmos") {
        const map: AbMap = {};
        for (const it of s.items) {
          const swap = Math.random() < 0.5;
          map[it.trial_id] = swap ? { A: "slot2", B: "slot1" } : { A: "slot1", B: "slot2" };
        }
        abMap.current = map;
      }
      setSession(s);
      setCursor(0);
      setAnswers([]);
      resetItemState();
      setPhase("in_progress");
    } catch (e) {
      setError(getApiMessage(e, "Không thể bắt đầu phiên đánh giá"));
    } finally {
      setStarting(false);
    }
  }

  function switchMode(next: EvaluationMode) {
    if (next === mode) return;
    if (inProgress && !window.confirm("Bạn đang đánh giá dở. Chuyển chế độ sẽ huỷ phiên hiện tại và không lưu kết quả. Tiếp tục?")) {
      return;
    }
    setMode(next);
    setSession(null);
    setPhase("notice");
    resetItemState();
  }

  const item: SessionItem | null = session ? session.items[cursor] : null;

  const canSubmitItem = useMemo(() => {
    if (!item) return false;
    if (mode === "mos") return playedMos && mosScore !== null;
    return playedA && playedB && choice !== null;
  }, [item, mode, playedMos, mosScore, playedA, playedB, choice]);

  async function handleItemSubmit() {
    if (!item || !session || !canSubmitItem) return;

    const answer: SessionAnswer =
      mode === "mos"
        ? { trial_id: item.trial_id, score: mosScore as number }
        : {
            trial_id: item.trial_id,
            choice:
              choice === "same"
                ? "same"
                : abMap.current[item.trial_id][choice as "A" | "B"],
          };

    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);

    const isLast = cursor + 1 >= session.size;
    if (!isLast) {
      setCursor(cursor + 1);
      resetItemState();
      return;
    }

    setPhase("submitting");
    setError(null);
    try {
      await evalService.completeSession(session.eval_session_id, nextAnswers);
      setPhase("done");
    } catch (e) {
      setError(getApiMessage(e, "Không thể ghi nhận kết quả"));
      setPhase("in_progress"); // allow retry of the final submit
      setAnswers(answers);     // drop the last (failed) answer so it can be resubmitted
    }
  }

  const isMos = mode === "mos";

  return (
    <SectionContainer>
      <div className="space-y-4">
        {/* mode switch */}
        <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-sm">
          {(["mos", "cmos"] as EvaluationMode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                "h-11 rounded-xl px-4 text-sm font-medium transition",
                mode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="space-y-5 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 min-h-[260px]">
          {error ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {phase === "notice" ? (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-semibold">Phiên đánh giá {mode.toUpperCase()}</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Phiên gồm tối đa {/* size known after start */}một số câu cố định. Bạn phải hoàn thành
                <strong> toàn bộ </strong> các câu thì kết quả mới được ghi nhận. Nếu thoát giữa chừng,
                kết quả sẽ không được lưu.
              </p>
              <PrimaryButton type="button" size="md" disabled={starting} onClick={() => void handleStart()}>
                {starting ? "Đang chuẩn bị..." : "Bắt đầu"}
              </PrimaryButton>
            </div>
          ) : null}

          {phase === "done" ? (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-semibold">Đã ghi nhận kết quả ✅</h2>
              <p className="text-sm text-muted-foreground">Cảm ơn bạn đã hoàn thành phiên đánh giá.</p>
              <PrimaryButton type="button" size="md" onClick={() => setPhase("notice")}>
                Bắt đầu phiên mới
              </PrimaryButton>
            </div>
          ) : null}

          {inProgress && session && item ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Câu {cursor + 1} / {session.size}
                </span>
                <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${((cursor) / session.size) * 100}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Văn bản</p>
                <p className="mt-1 text-sm leading-6 text-foreground">{item.text}</p>
              </div>

              {isMos ? (
                <>
                  <AudioPlayer
                    label={item.sample_id}
                    src={item.audio_url ?? undefined}
                    hasPlayed={playedMos}
                    onEnded={() => setPlayedMos(true)}
                  />
                  <ScoreSelector value={mosScore} onChange={setMosScore} />
                </>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AudioPlayer label="A" src={item.slot1_url ?? undefined}
                      hasPlayed={playedA} onEnded={() => setPlayedA(true)} />
                    <AudioPlayer label="B" src={item.slot2_url ?? undefined}
                      hasPlayed={playedB} onEnded={() => setPlayedB(true)} />
                  </div>
                  <ComparisonSelector value={choice} onChange={setChoice} />
                </>
              )}

              <div className="flex flex-wrap gap-3">
                <PrimaryButton
                  type="button"
                  size="md"
                  className="min-w-28"
                  disabled={!canSubmitItem || phase === "submitting"}
                  onClick={() => void handleItemSubmit()}
                >
                  {cursor + 1 >= session.size ? "Hoàn thành" : "Câu tiếp theo"}
                </PrimaryButton>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </SectionContainer>
  );
}
