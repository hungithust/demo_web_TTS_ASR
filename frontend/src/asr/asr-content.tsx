import { useEffect, useMemo } from "react";
import { Loader2, Mic, Upload } from "lucide-react";
import { AudioPlayer } from "@/components/shared/audio-player";
import { AudioCell } from "@/components/shared/audio-cell";
import { DemoCard } from "@/components/shared/demo-card";
import {
  ComparisonColumnLabel,
  ComparisonTable,
  ComparisonTableBody,
  ComparisonTableCell,
  ComparisonTableHeaderCell,
  ComparisonTableRow,
} from "@/components/shared/comparison-table";
import { ErrorState } from "@/components/shared/error-state";
import { ModelDropdown } from "@/components/shared/model-dropdown";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SectionContainer } from "@/components/shared/section-container";
import { TableHeader } from "@/components/shared/table-header";
import { TranscriptCell } from "@/components/shared/transcript-cell";
import { asrExampleRows } from "@/data/asrExamples";
import { useAudioUpload } from "@/hooks/use-audio-upload";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { useAsrStore } from "@/store/asr-store";

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

  const {
    inputRef,
    isDragging,
    openPicker,
    onInputChange,
    onDrop,
    onDragOver,
    onDragLeave,
  } = useAudioUpload();
  const { isRecording: recording, startRecording, stopRecording } = useMediaRecorder();

  useEffect(() => {
    void loadModels();
    return () => resetAudio();
  }, [loadModels, resetAudio]);

  const activeAudio = useMemo(() => {
    return recordedAudio ?? uploadedAudio;
  }, [recordedAudio, uploadedAudio]);

  const canConvert = Boolean(activeAudio) && Boolean(selectedModel) && !isLoadingModels && !isConverting;

  const handleRecordClick = () => {
    if (recording || isRecording) {
      stopRecording();
      return;
    }

    void startRecording();
  };

  return (
    <>
      <SectionContainer title="Demo">
        <DemoCard
          title="Transcribe speech into text"
          icon={<Mic className="size-4" />}
        >
          {error ? <ErrorState title="ASR request failed" description={error} /> : null}

          <div
            onDrop={(event) => void onDrop(event)}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={[
              "rounded-3xl border border-dashed px-4 py-4 transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border bg-background/30",
            ].join(" ")}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg,audio/mp3"
              onChange={onInputChange}
              className="hidden"
            />

            <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <PrimaryButton
                type="button"
                variant="secondary"
                size="lg"
                className="w-full justify-start"
                onClick={openPicker}
              >
                <Upload className="size-4" />
                Upload audio
              </PrimaryButton>

              <PrimaryButton
                type="button"
                variant="secondary"
                size="lg"
                className="w-full justify-start"
                onClick={handleRecordClick}
              >
                <Mic className="size-4" />
                {recording || isRecording ? "Stop recording" : "Record"}
              </PrimaryButton>

              <ModelDropdown
                id="asr-model"
                label="Model"
                value={selectedModel}
                onValueChange={setSelectedModel}
                options={models.map((model) => ({ label: model, value: model }))}
                disabled={isLoadingModels || models.length === 0}
              />

              <PrimaryButton
                type="button"
                size="lg"
                className="w-full md:min-w-40"
                disabled={!canConvert}
                onClick={() => void convert()}
              >
                {isConverting ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
                {isConverting ? "Converting" : "Convert"}
              </PrimaryButton>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {uploadedAudio ? (
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
                  Uploaded: {uploadedAudio.fileName}
                </span>
              ) : null}
              {recordedAudio ? (
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
                  Recorded: {recordedAudio.fileName}
                </span>
              ) : null}
              {isRecording || recording ? (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                  Recording
                </span>
              ) : null}
            </div>
          </div>

          {activeAudio ? (
            <AudioPlayer
              label={activeAudio.fileName}
              src={activeAudio.previewUrl}
            />
          ) : null}

          <div className="rounded-3xl border border-border bg-background/30 p-4">
            <h3 className="text-sm font-semibold tracking-tight">Transcription Result</h3>

            {transcription ? (
              <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-foreground">
                {transcription}
              </div>
            ) : null}
          </div>
        </DemoCard>
      </SectionContainer>

      <SectionContainer title="Examples">
        <ComparisonTable caption="ASR example comparison">
          <TableHeader>
            <ComparisonTableRow>
              <ComparisonTableHeaderCell className="w-[28%]">
                <ComparisonColumnLabel label="Audio" />
              </ComparisonTableHeaderCell>
              <ComparisonTableHeaderCell className="w-[24%]">
                <ComparisonColumnLabel label="Model A" />
              </ComparisonTableHeaderCell>
              <ComparisonTableHeaderCell className="w-[24%]">
                <ComparisonColumnLabel label="Model B" />
              </ComparisonTableHeaderCell>
              <ComparisonTableHeaderCell className="w-[24%]">
                <ComparisonColumnLabel label="Model C" />
              </ComparisonTableHeaderCell>
            </ComparisonTableRow>
          </TableHeader>
          <ComparisonTableBody>
            {asrExampleRows.map((row) => (
              <ComparisonTableRow key={row.id}>
                <ComparisonTableCell className="w-[28%]">
                  <AudioCell
                    label={row.audioTitle}
                    durationLabel={row.durationLabel}
                  />
                </ComparisonTableCell>
                {row.transcripts.map((transcript) => (
                  <ComparisonTableCell key={`${row.id}-${transcript.model}`} className="w-[24%]">
                    <TranscriptCell text={transcript.text} />
                  </ComparisonTableCell>
                ))}
              </ComparisonTableRow>
            ))}
          </ComparisonTableBody>
        </ComparisonTable>
      </SectionContainer>
    </>
  );
}
