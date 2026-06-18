import { useEffect } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { AudioPlayer } from "@/components/shared/audio-player";
import { DemoCard } from "@/components/shared/demo-card";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingOverlay } from "@/components/shared/loading-overlay";
import { ModelDropdown } from "@/components/shared/model-dropdown";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SectionContainer } from "@/components/shared/section-container";
import { Textarea } from "@/components/ui/textarea";
import { useTtsStore } from "@/store/tts-store";

export function TtsContent() {
  const text = useTtsStore((state) => state.text);
  const selectedModel = useTtsStore((state) => state.selectedModel);
  const models = useTtsStore((state) => state.models);
  const isLoadingModels = useTtsStore((state) => state.isLoadingModels);
  const isConverting = useTtsStore((state) => state.isConverting);
  const error = useTtsStore((state) => state.error);
  const audio = useTtsStore((state) => state.audio);
  const setText = useTtsStore((state) => state.setText);
  const setSelectedModel = useTtsStore((state) => state.setSelectedModel);
  const loadModels = useTtsStore((state) => state.loadModels);
  const convert = useTtsStore((state) => state.convert);
  const clearText = useTtsStore((state) => state.clearText);
  const resetAudio = useTtsStore((state) => state.resetAudio);

  useEffect(() => {
    void loadModels();
    return () => resetAudio();
  }, [loadModels, resetAudio]);

  const canConvert = Boolean(text.trim()) && Boolean(selectedModel) && !isLoadingModels && !isConverting;

  return (
    <>
      <SectionContainer title="Demo">
        <DemoCard
          title="Generate speech from text"
          icon={<Sparkles className="size-4" />}
        >
          {error ? <ErrorState title="TTS request failed" description={error} /> : null}

          <div className="relative">
            <Textarea
              autoResize
              placeholder="Enter text to synthesize"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={1}
              className="max-h-[220px] overflow-y-auto pb-12 pr-20"
            />
            {text ? (
              <button
                type="button"
                onClick={clearText}
                className="absolute bottom-3 right-3 inline-flex h-8 items-center gap-1 rounded-full border border-border/80 bg-background/85 px-3 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition hover:border-border hover:bg-background hover:text-foreground"
              >
                <X className="size-3.5" />
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {text.length} chars
            </div>
          </div>

          <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <LoadingOverlay visible={isLoadingModels}>
              <ModelDropdown
                id="tts-model"
                label="Model"
                value={selectedModel}
                onValueChange={setSelectedModel}
                options={models.map((model) => ({ label: model, value: model }))}
                disabled={isLoadingModels || models.length === 0}
              />
            </LoadingOverlay>

            <PrimaryButton
              type="button"
              size="lg"
              className="w-full md:min-w-40"
              disabled={!canConvert}
              onClick={() => void convert()}
            >
              {isConverting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {isConverting ? "Converting" : "Convert"}
            </PrimaryButton>
          </div>

          {audio.src ? (
            <AudioPlayer
              label={audio.fileName ?? "Generated voice"}
              src={audio.src}
            />
          ) : null}
        </DemoCard>
      </SectionContainer>
    </>
  );
}
