import { useEffect, useState } from "react";
import { AudioPlayer } from "@/components/shared/audio-player";
import { ComparisonSelector, type ComparisonChoice } from "@/components/shared/comparison-selector";
import { PrimaryButton } from "@/components/shared/primary-button";
import { ScoreSelector } from "@/components/shared/score-selector";
import { SectionContainer } from "@/components/shared/section-container";
import { cn } from "@/lib/utils";
import { evalService } from "@/services/eval.service";
import type { CmosSample, EvaluationMode, MosSample } from "@/types/eval.types";

function AudioPlaceholder() {
  return (
    <div className="flex h-[58px] items-center gap-3 rounded-2xl border border-border bg-background/60 px-3 py-2">
      <div className="size-9 shrink-0 rounded-full border border-border bg-muted animate-pulse" />
      <div className="flex min-w-0 flex-1 items-end gap-2">
        <div className="grid h-6 flex-1 grid-cols-12 items-end gap-1 overflow-hidden">
          {Array.from({ length: 12 }).map((_, index) => (
            <span
              key={index}
              className="w-full rounded-full bg-muted animate-pulse"
              style={{ height: `${32 + (index % 5) * 12}%`, opacity: 0.75 }}
            />
          ))}
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground">
          --:--
        </span>
      </div>
    </div>
  );
}

function CmosAudioRow({
  label,
  loading,
  hasPlayed,
  src,
  onEnded,
}: {
  label: "A" | "B";
  loading: boolean;
  hasPlayed: boolean;
  src?: string | null;
  onEnded: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border bg-background/40 p-3", hasPlayed ? "border-primary/40 bg-primary/5" : "border-border")}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-foreground">
        {label}
      </div>
      <div className="min-w-0 flex-1">
        {loading ? <AudioPlaceholder /> : src ? <AudioPlayer label={label} src={src} hasPlayed={hasPlayed} onEnded={onEnded} /> : null}
      </div>
    </div>
  );
}

export function EvaluationPage() {
  const [mode, setMode] = useState<EvaluationMode>("mos");

  const [mosSample, setMosSample] = useState<MosSample | null>(null);
  const [mosScore, setMosScore] = useState<number | null>(null);
  const [mosLoading, setMosLoading] = useState(true);
  const [mosHasPlayed, setMosHasPlayed] = useState(false);
  const [mosIsSubmitting, setMosIsSubmitting] = useState(false);

  const [cmosPair, setCmosPair] = useState<CmosSample | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<ComparisonChoice | null>(null);
  const [cmosLoading, setCmosLoading] = useState(true);
  const [cmosHasPlayedA, setCmosHasPlayedA] = useState(false);
  const [cmosHasPlayedB, setCmosHasPlayedB] = useState(false);
  const [cmosIsSubmitting, setCmosIsSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      setMosLoading(true);
      setCmosLoading(true);

      try {
        const [nextMosSample, nextCmosPair] = await Promise.all([
          evalService.getNextMosSample(),
          evalService.getNextCmosSample(),
        ]);
        setMosSample(nextMosSample);
        setCmosPair(nextCmosPair);
      } finally {
        setMosLoading(false);
        setCmosLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setMosHasPlayed(false);
    setMosIsSubmitting(false);
    setCmosHasPlayedA(false);
    setCmosHasPlayedB(false);
    setCmosIsSubmitting(false);
    setSelectedChoice(null);
  }, [mode]);

  const isMosMode = mode === "mos";
  const currentMosCanSubmit = Boolean(mosSample) && mosScore !== null && mosHasPlayed && !mosIsSubmitting && !mosLoading;
  const canSubmit = Boolean(cmosPair) && selectedChoice !== null && cmosHasPlayedA && cmosHasPlayedB && !cmosIsSubmitting && !cmosLoading;
  const activeLoading = isMosMode ? mosLoading || mosIsSubmitting : cmosLoading || cmosIsSubmitting;
  const showMosPlaceholder = isMosMode && mosLoading && !mosSample;
  const showCmosPlaceholder = !isMosMode && cmosLoading && !cmosPair;
  const modeSwitchDisabled = activeLoading && !showMosPlaceholder && !showCmosPlaceholder;

  async function handleMosSubmit() {
    if (!currentMosCanSubmit) return;

    if (!mosSample || mosScore === null) return;

    setMosIsSubmitting(true);
    try {
      await evalService.submitMosScore({
        sample_id: mosSample.sample_id,
        score: mosScore,
      });
      setMosScore(null);
      setMosHasPlayed(false);
      setMosSample(null);
      setMosLoading(true);
      setMosSample(await evalService.getNextMosSample());
      setMosLoading(false);
    } finally {
      setMosLoading(false);
      setMosIsSubmitting(false);
    }
  }

  async function handleCmosSubmit() {
    if (!canSubmit) return;

    if (!cmosPair || selectedChoice === null) return;

    setCmosIsSubmitting(true);
    try {
      await evalService.submitCmosChoice({
        sample_id: cmosPair.sample_id,
        choice: selectedChoice,
      });
      setSelectedChoice(null);
      setCmosHasPlayedA(false);
      setCmosHasPlayedB(false);
      setCmosPair(null);
      setCmosLoading(true);
      setCmosPair(await evalService.getNextCmosSample());
      setCmosLoading(false);
    } finally {
      setCmosLoading(false);
      setCmosIsSubmitting(false);
    }
  }

  return (
    <SectionContainer>
      <div className="space-y-4">
        <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            aria-pressed={isMosMode}
            disabled={modeSwitchDisabled}
            onClick={() => setMode("mos")}
            className={cn(
              "h-11 rounded-xl px-4 text-sm font-medium transition",
              modeSwitchDisabled ? "cursor-not-allowed opacity-70" : "",
              isMosMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            MOS
          </button>
          <button
            type="button"
            aria-pressed={!isMosMode}
            disabled={modeSwitchDisabled}
            onClick={() => setMode("cmos")}
            className={cn(
              "h-11 rounded-xl px-4 text-sm font-medium transition",
              modeSwitchDisabled ? "cursor-not-allowed opacity-70" : "",
              !isMosMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            CMOS
          </button>
        </div>

        <div
          key={mode}
          aria-busy={activeLoading}
          className="space-y-5 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 animate-fadeUp min-h-[260px]"
        >
          <div className={cn("h-1 w-full overflow-hidden rounded-full bg-muted/70", activeLoading ? "opacity-100" : "opacity-0")}>
            <div className={cn("h-full w-1/3 rounded-full bg-primary/70", activeLoading ? "animate-[pulse_1.1s_ease-in-out_infinite]" : "")} />
          </div>

          {isMosMode ? (
            <>
              {mosLoading ? <AudioPlaceholder /> : null}
              {!mosLoading && mosSample ? (
                <AudioPlayer
                  label={mosSample.sample_id}
                  src={mosSample.audio_url}
                  hasPlayed={mosHasPlayed}
                  onEnded={() => setMosHasPlayed(true)}
                />
              ) : null}

              <ScoreSelector
                value={mosScore}
                onChange={setMosScore}
                disabled={mosLoading}
              />

              <div className="flex flex-wrap gap-3">
                <PrimaryButton
                  type="button"
                  size="md"
                  className="min-w-28"
                  onClick={() => void handleMosSubmit()}
                  disabled={!currentMosCanSubmit}
                >
                  Submit
                </PrimaryButton>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
              <CmosAudioRow
                  label="A"
                  loading={cmosLoading}
                  hasPlayed={cmosHasPlayedA}
                  src={cmosPair?.audio_a}
                  onEnded={() => {
                    setCmosHasPlayedA(true);
                  }}
                />

                <CmosAudioRow
                  label="B"
                  loading={cmosLoading}
                  hasPlayed={cmosHasPlayedB}
                  src={cmosPair?.audio_b}
                  onEnded={() => {
                    setCmosHasPlayedB(true);
                  }}
                />
              </div>

              <ComparisonSelector
                value={selectedChoice}
                onChange={setSelectedChoice}
                disabled={cmosLoading}
              />

              <div className="flex flex-wrap gap-3">
                <PrimaryButton
                  type="button"
                  size="md"
                  className="min-w-28"
                  onClick={() => void handleCmosSubmit()}
                  disabled={!canSubmit}
                >
                  Submit
                </PrimaryButton>
              </div>
            </>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}
