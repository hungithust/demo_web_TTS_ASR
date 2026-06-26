import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayer } from "@/components/shared/audio-player";
import { ComparisonSelector, type ComparisonChoice } from "@/components/shared/comparison-selector";
import { PrimaryButton } from "@/components/shared/primary-button";
import { ScoreSelector } from "@/components/shared/score-selector";
import { SectionContainer } from "@/components/shared/section-container";
import { cn } from "@/lib/utils";
import { evalService } from "@/services/eval.service";
import { getApiMessage } from "@/services/api";
import type { CriteriaChoices, CriteriaScores, EvalSession, EvaluationMode, SessionAnswer, SessionItem, SlotChoice } from "@/types/eval.types";

type Phase = "notice" | "in_progress" | "submitting" | "done";

// A/B display mapping for CMOS (remove order bias), keyed by trial_id.
type AbMap = Record<string, { A: "slot1" | "slot2"; B: "slot1" | "slot2" }>;

const EMPTY_CRITERIA_SCORES: CriteriaScores = {
  naturalness: null,
  audio_quality: null,
  intelligibility: null,
};

const EMPTY_CRITERIA_CHOICES: CriteriaChoices = {
  naturalness: null,
  audio_quality: null,
  intelligibility: null,
};

const SCORING_CRITERIA: Array<{ key: keyof CriteriaScores; label: string }> = [
  { key: "naturalness", label: "Naturalness & Prosody" },
  { key: "audio_quality", label: "Audio Quality" },
  { key: "intelligibility", label: "Intelligibility & Pronunciation" },
];

function hasAllCriteriaScores(scores: CriteriaScores) {
  return Object.values(scores).every((score) => score !== null);
}

function hasAllCriteriaChoices(choices: CriteriaChoices) {
  return Object.values(choices).every((choice) => choice !== null);
}

export function EvaluationPage() {
  const [mode, setMode] = useState<EvaluationMode>("mos");
  const [phase, setPhase] = useState<Phase>("notice");
  const [session, setSession] = useState<EvalSession | null>(null);
  const [cursor, setCursor] = useState(0);
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // current-item answer + playback gates
  const [criteriaScores, setCriteriaScores] = useState<CriteriaScores>(EMPTY_CRITERIA_SCORES);
  const [criteriaChoices, setCriteriaChoices] = useState<CriteriaChoices>(EMPTY_CRITERIA_CHOICES);
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
    setCriteriaScores(EMPTY_CRITERIA_SCORES);
    setCriteriaChoices(EMPTY_CRITERIA_CHOICES);
    setPlayedMos(false);
    setPlayedA(false);
    setPlayedB(false);
  }

  function updateCriteriaScore(key: keyof CriteriaScores, value: number) {
    setCriteriaScores((current) => ({ ...current, [key]: value }));
  }

  function updateCriteriaChoice(key: keyof CriteriaChoices, value: ComparisonChoice) {
    setCriteriaChoices((current) => ({ ...current, [key]: value }));
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
      setError(getApiMessage(e, "Could not start the evaluation session"));
    } finally {
      setStarting(false);
    }
  }

  function switchMode(next: EvaluationMode) {
    if (next === mode) return;
    if (inProgress && !window.confirm("You have an evaluation in progress. Switching modes will cancel the current session and your results won't be saved. Continue?")) {
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
    if (mode === "mos") return playedMos && hasAllCriteriaScores(criteriaScores);
    return playedA && playedB && hasAllCriteriaChoices(criteriaChoices);
  }, [item, mode, playedMos, criteriaScores, playedA, playedB, criteriaChoices]);

  async function handleItemSubmit() {
    if (!item || !session || !canSubmitItem) return;

    let answer: SessionAnswer;
    if (mode === "mos") {
      answer = {
        trial_id: item.trial_id,
        scores: {
          naturalness: criteriaScores.naturalness as number,
          audio_quality: criteriaScores.audio_quality as number,
          intelligibility: criteriaScores.intelligibility as number,
        },
      };
    } else {
      const map = abMap.current[item.trial_id];
      const toSlot = (c: ComparisonChoice): SlotChoice =>
        c === "same" ? "same" : map[c as "A" | "B"];
      answer = {
        trial_id: item.trial_id,
        choices: {
          naturalness: toSlot(criteriaChoices.naturalness as ComparisonChoice),
          audio_quality: toSlot(criteriaChoices.audio_quality as ComparisonChoice),
          intelligibility: toSlot(criteriaChoices.intelligibility as ComparisonChoice),
        },
      };
    }

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
      setError(getApiMessage(e, "Could not submit your results"));
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
              <h2 className="text-lg font-semibold">{mode.toUpperCase()} evaluation session</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                A session includes a set of <strong> 15 samples </strong>. You must complete
                <strong> all </strong> items for your results to be recorded. If you leave
                midway, nothing will be saved.
              </p>
              <PrimaryButton type="button" size="md" disabled={starting} onClick={() => void handleStart()}>
                {starting ? "Preparing..." : "Start"}
              </PrimaryButton>
            </div>
          ) : null}

          {phase === "done" ? (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-semibold">Results saved ✅</h2>
              <p className="text-sm text-muted-foreground">Thank you for completing the evaluation session.</p>
              <PrimaryButton type="button" size="md" onClick={() => setPhase("notice")}>
                Start a new session
              </PrimaryButton>
            </div>
          ) : null}

          {inProgress && session && item ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Item {cursor + 1} / {session.size}
                </span>
                <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${((cursor) / session.size) * 100}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Text</p>
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
                  <div className="space-y-4">
                    {SCORING_CRITERIA.map((criterion) => (
                      <ScoreSelector
                        key={criterion.key}
                        value={criteriaScores[criterion.key]}
                        onChange={(value) => updateCriteriaScore(criterion.key, value)}
                        label={criterion.label}
                        ariaLabel={criterion.label}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AudioPlayer label="A" src={item.slot1_url ?? undefined}
                      hasPlayed={playedA} onEnded={() => setPlayedA(true)} />
                    <AudioPlayer label="B" src={item.slot2_url ?? undefined}
                      hasPlayed={playedB} onEnded={() => setPlayedB(true)} />
                  </div>
                  <div className="space-y-4">
                    {SCORING_CRITERIA.map((criterion) => (
                      <div key={criterion.key} className="space-y-2">
                        <p className="text-sm font-medium text-foreground">{criterion.label}</p>
                        <ComparisonSelector
                          value={criteriaChoices[criterion.key]}
                          onChange={(value) => updateCriteriaChoice(criterion.key, value)}
                        />
                      </div>
                    ))}
                  </div>
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
                  {cursor + 1 >= session.size ? "Finish" : "Next"}
                </PrimaryButton>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </SectionContainer>
  );
}
