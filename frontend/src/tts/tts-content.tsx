import { useEffect } from "react";
import type { ReactNode } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { AudioPlayer } from "@/components/shared/audio-player";
import { DebugInfoPanel } from "@/components/shared/debug-info-panel";
import { ErrorState } from "@/components/shared/error-state";
import { ExamplesTable } from "@/components/shared/examples-table";
import type { ExampleCell } from "@/components/shared/examples-table";
import { OptionToggle } from "@/components/shared/option-toggle";
import { SwitchRow } from "@/components/shared/switch-row";
import { ttsExampleRows } from "@/data/ttsExamples";
import { useTtsStore } from "@/store/tts-store";

const TTS_COLUMNS = [
  { label: "Text", width: "40%" },
  { label: "omnivoice", width: "30%", mono: true },
  { label: "voxcpm2", width: "30%", mono: true },
];

const TTS_ROWS: ExampleCell[][] = ttsExampleRows.map((row) => [
  { kind: "text", text: row.text },
  ...row.outputs.map((output) => ({
    kind: "audio" as const,
    src: output.src,
    label: output.title,
    durationLabel: output.durationLabel,
  })),
]);

const VOICE_LABELS: Record<string, string> = {
  "male-north": "Giọng nam · miền Bắc",
  "male-south": "Giọng nam · miền Nam",
  "female-north": "Giọng nữ · miền Bắc",
  "female-south": "Giọng nữ · miền Nam",
};

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-display text-xs font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

const EXAMPLE_TEXT =
  ttsExampleRows[1]?.text ??
  "Đường Trần Hưng Đạo đang ùn tắc, tôi sẽ định tuyến lại để bạn về nhà nhanh hơn mười phút.";

export function TtsContent() {
  const text = useTtsStore((state) => state.text);
  const selectedModel = useTtsStore((state) => state.selectedModel);
  const models = useTtsStore((state) => state.models);
  const isLoadingModels = useTtsStore((state) => state.isLoadingModels);
  const isConverting = useTtsStore((state) => state.isConverting);
  const error = useTtsStore((state) => state.error);
  const audio = useTtsStore((state) => state.audio);
  const gender = useTtsStore((state) => state.gender);
  const region = useTtsStore((state) => state.region);
  const enableNorm = useTtsStore((state) => state.enableNorm);
  const debug = useTtsStore((state) => state.debug);
  const debugInfo = useTtsStore((state) => state.debugInfo);
  const setText = useTtsStore((state) => state.setText);
  const setSelectedModel = useTtsStore((state) => state.setSelectedModel);
  const loadModels = useTtsStore((state) => state.loadModels);
  const convert = useTtsStore((state) => state.convert);
  const clearText = useTtsStore((state) => state.clearText);
  const resetAudio = useTtsStore((state) => state.resetAudio);
  const useExampleText = useTtsStore((state) => state.useExampleText);
  const setGender = useTtsStore((state) => state.setGender);
  const setRegion = useTtsStore((state) => state.setRegion);
  const setEnableNorm = useTtsStore((state) => state.setEnableNorm);
  const setDebug = useTtsStore((state) => state.setDebug);

  useEffect(() => {
    void loadModels();
    return () => resetAudio();
  }, [loadModels, resetAudio]);

  const resolvedVoice = `${gender}-${region}`;
  const canConvert = Boolean(text.trim()) && Boolean(selectedModel) && !isLoadingModels && !isConverting;

  return (
    <div className="fadein flex flex-col gap-5">
      {error ? <ErrorState title="TTS request failed" description={error} /> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="vsf-card">
          <div className="vsf-card__body flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <Eyebrow>Input text</Eyebrow>
              <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                {text.length} chars
              </span>
            </div>
            <textarea
              className="vsf-input"
              placeholder="Type Vietnamese text to synthesize..."
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" className="vsf-btn vsf-btn--ghost vsf-btn--sm" onClick={clearText}>
                Clear
              </button>
              <button
                type="button"
                className="vsf-btn vsf-btn--secondary vsf-btn--sm"
                onClick={() => useExampleText(EXAMPLE_TEXT)}
              >
                Use example
              </button>
            </div>
          </div>
        </div>

        <div className="vsf-card vsf-card--accent">
          <div className="vsf-card__body flex flex-col gap-[18px]">
            <div className="vsf-field">
              <label className="vsf-field__label" htmlFor="tts-model">
                Model
              </label>
              <select
                id="tts-model"
                className="vsf-input"
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                disabled={isLoadingModels || models.length === 0}
              >
                {models.length === 0 ? (
                  <option value="">{isLoadingModels ? "Loading..." : "No models"}</option>
                ) : (
                  models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-col gap-[9px]">
              <div className="flex items-center justify-between">
                <label className="vsf-field__label">Voice</label>
                <span className="vsf-tag vsf-tag--brand">{resolvedVoice}</span>
              </div>
              <OptionToggle
                label="Gender"
                value={gender}
                onChange={setGender}
                disabled={isConverting}
                options={[
                  { label: "Male", value: "male" },
                  { label: "Female", value: "female" },
                ]}
              />
              <OptionToggle
                label="Region"
                value={region}
                onChange={setRegion}
                disabled={isConverting}
                options={[
                  { label: "North", value: "north" },
                  { label: "South", value: "south" },
                ]}
              />
            </div>

            <SwitchRow
              divider
              label="Text norm"
              description="Normalize Vietnamese text"
              checked={enableNorm}
              onChange={setEnableNorm}
              disabled={isConverting}
            />
            <SwitchRow
              label="Debug"
              description="Return debug in header"
              checked={debug}
              onChange={setDebug}
              disabled={isConverting}
            />

            <div
              className="flex items-center gap-3 rounded-md px-3.5 py-3"
              style={{ background: "var(--vsf-red-50)", border: "1px solid var(--vsf-red-100)" }}
            >
              <BadgeCheck className="size-5 flex-none" style={{ color: "var(--vsf-red-600)" }} />
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                  Voice to generate
                </div>
                <div className="font-mono text-sm font-bold" style={{ color: "var(--vsf-red-700)" }}>
                  {resolvedVoice}
                  <span className="font-sans font-medium" style={{ color: "var(--text-secondary)" }}>
                    {" · "}
                    {VOICE_LABELS[resolvedVoice] ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="vsf-btn vsf-btn--primary vsf-btn--block vsf-btn--lg"
              disabled={!canConvert}
              onClick={() => void convert()}
            >
              {isConverting ? (
                <>
                  <Loader2 className="vsf-spin size-[18px]" />
                  Generating...
                </>
              ) : (
                `Convert · ${resolvedVoice}`
              )}
            </button>
          </div>
        </div>
      </div>

      {audio.src ? (
        <div className="vsf-card fadein">
          <div className="vsf-card__body flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Eyebrow>Result · audio</Eyebrow>
              <span className="vsf-tag">
                {resolvedVoice} · {selectedModel}
              </span>
            </div>
            <AudioPlayer
              label={audio.fileName ?? "Generated voice"}
              src={audio.src}
              downloadName={`${selectedModel || "tts"}_${resolvedVoice}.wav`}
            />
            {debug && debugInfo ? <DebugInfoPanel info={debugInfo} /> : null}
          </div>
        </div>
      ) : null}

      <ExamplesTable columns={TTS_COLUMNS} rows={TTS_ROWS} />
    </div>
  );
}
