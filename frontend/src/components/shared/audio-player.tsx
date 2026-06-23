import { Download, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface AudioPlayerProps {
  label: string;
  durationLabel?: string;
  src?: string | null;
  hasPlayed?: boolean;
  onEnded?: () => void;
  downloadName?: string;
  className?: string;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer({
  label,
  durationLabel = "--:--",
  src,
  hasPlayed = false,
  onEnded,
  downloadName,
  className,
}: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [fallbackDuration, setFallbackDuration] = useState(durationLabel);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const bars = useMemo(
    () => Array.from({ length: 56 }, (_, i) => 14 + Math.round(56 * Math.abs(Math.sin(i * 0.9 + 1)))),
    [],
  );

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setTotal(0);
    setFallbackDuration(durationLabel);
  }, [durationLabel, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    const onEndedEvent = () => {
      setPlaying(false);
      setCurrent(0);
      onEnded?.();
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onLoadedMetadata = () => {
      setTotal(audio.duration);
      setFallbackDuration(formatDuration(audio.duration));
    };
    const onTimeUpdate = () => setCurrent(audio.currentTime);

    audio.addEventListener("ended", onEndedEvent);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      audio.removeEventListener("ended", onEndedEvent);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [onEnded, src]);

  async function togglePlayback() {
    if (!src) {
      setPlaying((value) => !value);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      return;
    }

    await audio.play();
  }

  function handleDownload() {
    if (!src) return;
    const anchor = document.createElement("a");
    anchor.href = src;
    anchor.download = downloadName ?? `${label}.wav`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  const progress = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const durationText = playing || current > 0 ? formatDuration(current) : fallbackDuration;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-4 rounded-md p-4 transition-colors",
        className,
      )}
      style={{ background: hasPlayed ? "var(--vsf-red-50)" : "var(--surface-sunken)" }}
    >
      <button
        type="button"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        aria-pressed={playing}
        onClick={() => void togglePlayback()}
        className="vsf-iconbtn vsf-iconbtn--lg vsf-iconbtn--solid"
      >
        {playing ? <Pause className="size-[22px] fill-current" /> : <Play className="size-[22px] fill-current" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
        <div className="flex h-[42px] items-center gap-[3px] overflow-hidden">
          {bars.map((height, index) => (
            <span
              key={`${label}-${index}`}
              className="block w-[3px] flex-none rounded-[2px]"
              style={{
                height: `${height}%`,
                transformOrigin: "center",
                background: playing ? "var(--vsf-red-500)" : "var(--vsf-neutral-300)",
                animation: playing ? `vsfwave .9s ${(index % 12) * 0.07}s ease-in-out infinite` : "none",
                opacity: playing ? 1 : 0.85,
              }}
            />
          ))}
        </div>
        <div className="h-1 overflow-hidden rounded-[2px]" style={{ background: "var(--border-subtle)" }}>
          <div
            className="h-full rounded-[2px]"
            style={{ width: `${progress}%`, background: "var(--vsf-red-500)", transition: "width .12s linear" }}
          />
        </div>
      </div>

      <span className="min-w-[46px] text-right font-mono text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {durationText}
      </span>

      <button
        type="button"
        onClick={handleDownload}
        title="Download .wav"
        aria-label="Download audio"
        className="vsf-iconbtn vsf-iconbtn--md"
      >
        <Download className="size-[18px]" />
      </button>

      {src ? <audio ref={audioRef} src={src} preload="metadata" className="hidden" /> : null}
    </div>
  );
}
