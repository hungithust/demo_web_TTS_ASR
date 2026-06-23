import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { FileAudio2, Loader2, Mic, Square, Trash2, Upload } from "lucide-react";
import { AudioPlayer } from "@/components/shared/audio-player";
import { DebugInfoPanel } from "@/components/shared/debug-info-panel";
import { ErrorState } from "@/components/shared/error-state";
import { ExamplesTable } from "@/components/shared/examples-table";
import type { ExampleCell } from "@/components/shared/examples-table";
import { SwitchRow } from "@/components/shared/switch-row";
import { asrExampleRows } from "@/data/asrExamples";
import { useAudioUpload } from "@/hooks/use-audio-upload";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { useAsrStore } from "@/store/asr-store";

const ASR_COLUMNS = [
  { label: "Audio", width: "28%" },
  { label: "qwen3-asr-1.7b", width: "24%", mono: true },
  { label: "phowhisper-large", width: "24%", mono: true },
  { label: "parakeet-ctc", width: "24%", mono: true },
];

const ASR_ROWS: ExampleCell[][] = asrExampleRows.map((row) => [
  { kind: "audio" as const, src: row.audioSrc, label: row.audioTitle, durationLabel: row.durationLabel },
  ...row.transcripts.map((transcript) => ({ kind: "text" as const, text: transcript.text })),
]);

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-display text-xs font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

function WaveBars({
  count,
  color,
  animate,
  minH = 14,
}: {
  count: number;
  color: string;
  animate: boolean;
  minH?: number;
}) {
  const bars = useMemo(
    () => Array.from({ length: count }, (_, i) => minH + Math.round(56 * Math.abs(Math.sin(i * 0.9 + 1)))),
    [count, minH],
  );
  return (
    <div className="flex h-full w-full items-center gap-[3px] overflow-hidden">
      {bars.map((height, index) => (
        <span
          key={index}
          className="block w-[3px] flex-none rounded-[2px]"
          style={{
            height: `${height}%`,
            transformOrigin: "center",
            background: color,
            animation: animate ? `vsfwave .9s ${(index % 12) * 0.07}s ease-in-out infinite` : "none",
          }}
        />
      ))}
    </div>
  );
}

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtSize(bytes: number) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function AsrContent() {
  const selectedModel = useAsrStore((state) => state.selectedModel);
  const models = useAsrStore((state) => state.models);
  const isLoadingModels = useAsrStore((state) => state.isLoadingModels);
  const isConverting = useAsrStore((state) => state.isConverting);
  const isRecording = useAsrStore((state) => state.isRecording);
  const error = useAsrStore((state) => state.error);
  const transcription = useAsrStore((state) => state.transcription);
  const uploadedAudio = useAsrStore((state) => state.uploadedAudio);
  const recordedAudio = useAsrStore((state) => state.recordedAudio);
  const setSelectedModel = useAsrStore((state) => state.setSelectedModel);
  const loadModels = useAsrStore((state) => state.loadModels);
  const convert = useAsrStore((state) => state.convert);
  const resetAudio = useAsrStore((state) => state.resetAudio);
  const clearTranscription = useAsrStore((state) => state.clearTranscription);
  const debug = useAsrStore((state) => state.debug);
  const debugInfo = useAsrStore((state) => state.debugInfo);
  const setDebug = useAsrStore((state) => state.setDebug);

  const { inputRef, isDragging, openPicker, onInputChange, onDrop, onDragOver, onDragLeave } = useAudioUpload();
  const { startRecording, stopRecording, cancelRecording } = useMediaRecorder();

  const [recordSeconds, setRecordSeconds] = useState(0);

  useEffect(() => {
    void loadModels();
    return () => resetAudio();
  }, [loadModels, resetAudio]);

  useEffect(() => {
    if (!isRecording) {
      setRecordSeconds(0);
      return;
    }
    setRecordSeconds(0);
    const id = window.setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [isRecording]);

  const activeAudio = uploadedAudio ?? recordedAudio;
  const showDrop = !activeAudio && !isRecording;
  const canConvert = Boolean(activeAudio) && Boolean(selectedModel) && !isLoadingModels && !isConverting && !isRecording;

  const deleteFile = () => {
    resetAudio();
    clearTranscription();
  };

  return (
    <div className="fadein flex flex-col gap-5">
      {error ? <ErrorState title="ASR request failed" description={error} /> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="vsf-card">
          <div className="vsf-card__body">
            <input
              ref={inputRef}
              type="file"
              accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg,audio/mp3"
              onChange={onInputChange}
              className="hidden"
            />

            {showDrop ? (
              <>
                <div
                  onClick={openPicker}
                  onDrop={(event) => void onDrop(event)}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  className="flex cursor-pointer flex-col items-center gap-3.5 rounded-[12px] border-2 border-dashed px-6 py-[34px] text-center transition-colors"
                  style={{
                    borderColor: isDragging ? "var(--vsf-red-400)" : "var(--border-default)",
                    background: isDragging ? "var(--vsf-red-50)" : "transparent",
                  }}
                >
                  <div className="flex size-[54px] items-center justify-center rounded-[14px]" style={{ background: "var(--vsf-red-50)", color: "var(--vsf-red-500)" }}>
                    <Upload className="size-[26px]" />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
                      Drag &amp; drop an audio file
                    </div>
                    <div className="mt-0.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      WAV · MP3 · M4A - up to 25&nbsp;MB
                    </div>
                  </div>
                </div>

                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    or
                  </span>
                  <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
                </div>

                <div className="flex gap-2.5">
                  <button type="button" className="vsf-btn vsf-btn--secondary vsf-btn--md flex-1" onClick={openPicker}>
                    <Upload className="size-[18px]" />
                    <span>Choose file</span>
                  </button>
                  <button type="button" className="vsf-btn vsf-btn--primary vsf-btn--md flex-1" onClick={() => void startRecording()}>
                    <Mic className="size-[18px]" />
                    <span>Record</span>
                  </button>
                </div>
              </>
            ) : null}

            {isRecording ? (
              <div className="fadein flex flex-col items-center gap-[18px] py-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: "var(--vsf-red-500)", animation: "vsfpulse 1.4s infinite" }}
                  />
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--vsf-red-600)" }}>
                    Recording
                  </span>
                </div>
                <div className="h-[62px] w-full px-2">
                  <WaveBars count={40} color="var(--vsf-red-500)" animate minH={12} />
                </div>
                <div className="font-mono text-[34px] font-bold tracking-[0.02em]" style={{ color: "var(--text-primary)" }}>
                  {fmtTime(recordSeconds)}
                </div>
                <div className="flex gap-2.5">
                  <button type="button" className="vsf-btn vsf-btn--ghost vsf-btn--md" onClick={cancelRecording}>
                    Cancel
                  </button>
                  <button type="button" className="vsf-btn vsf-btn--primary vsf-btn--md" onClick={stopRecording}>
                    <Square className="size-4 fill-current" />
                    <span>Stop &amp; save</span>
                  </button>
                </div>
              </div>
            ) : null}

            {activeAudio && !isRecording ? (
              <div className="fadein flex flex-col gap-3">
                <div className="flex items-center gap-3.5 rounded-md p-3.5" style={{ background: "var(--surface-sunken)" }}>
                  <div
                    className="flex size-[46px] flex-none items-center justify-center rounded-md bg-white"
                    style={{ border: "1px solid var(--border-subtle)", color: "var(--vsf-red-500)" }}
                  >
                    <FileAudio2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {activeAudio.fileName}
                    </div>
                    <div className="mt-0.5 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                      {fmtSize(activeAudio.file.size)} · {uploadedAudio ? "uploaded" : "recorded"}
                    </div>
                  </div>
                  <div className="h-7 w-[110px] flex-none">
                    <WaveBars count={30} color="var(--vsf-neutral-400)" animate={false} minH={24} />
                  </div>
                  <button
                    type="button"
                    className="vsf-iconbtn vsf-iconbtn--md"
                    title="Remove file"
                    aria-label="Remove file"
                    style={{ color: "var(--vsf-red-600)" }}
                    onClick={deleteFile}
                  >
                    <Trash2 className="size-[18px]" />
                  </button>
                </div>
                <AudioPlayer label={activeAudio.fileName} src={activeAudio.previewUrl} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="vsf-card vsf-card--accent">
          <div className="vsf-card__body flex flex-col gap-[18px]">
            <div className="vsf-field">
              <label className="vsf-field__label" htmlFor="asr-model">
                Model
              </label>
              <select
                id="asr-model"
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

            <SwitchRow
              divider
              label="Debug"
              description="Return debug in body"
              checked={debug}
              onChange={setDebug}
              disabled={isConverting}
            />

            <button
              type="button"
              className="vsf-btn vsf-btn--primary vsf-btn--block vsf-btn--lg"
              disabled={!canConvert}
              onClick={() => void convert()}
            >
              {isConverting ? (
                <>
                  <Loader2 className="vsf-spin size-[18px]" />
                  Transcribing...
                </>
              ) : (
                "Transcribe"
              )}
            </button>
          </div>
        </div>
      </div>

      {transcription ? (
        <div className="vsf-card fadein">
          <div className="vsf-card__body flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Eyebrow>Transcript</Eyebrow>
              <span className="vsf-tag">{selectedModel}</span>
            </div>
            <p className="m-0 whitespace-pre-wrap text-[19px] leading-[1.65]" style={{ color: "var(--text-primary)", textWrap: "pretty" } as CSSProperties}>
              {transcription}
            </p>
            {debug && debugInfo ? <DebugInfoPanel info={debugInfo} /> : null}
          </div>
        </div>
      ) : null}

      <ExamplesTable columns={ASR_COLUMNS} rows={ASR_ROWS} />
    </div>
  );
}
