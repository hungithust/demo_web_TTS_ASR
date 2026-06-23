import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface MiniAudioProps {
  src: string;
  label: string;
  durationLabel?: string;
  className?: string;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MiniAudio({ src, label, durationLabel = "0:00", className }: MiniAudioProps) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<string>(durationLabel);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bars = useMemo(() => Array.from({ length: 22 }, (_, i) => 22 + Math.round(50 * Math.abs(Math.sin(i * 0.9 + 1)))), []);

  useEffect(() => {
    setPlaying(false);
    setDuration(durationLabel);
  }, [durationLabel, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onMeta = () => setDuration(formatDuration(audio.duration));
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("loadedmetadata", onMeta);
    };
  }, [src]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    await audio.play();
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <button
        type="button"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        aria-pressed={playing}
        onClick={() => void toggle()}
        className="flex size-9 flex-none items-center justify-center rounded-full text-white transition-colors"
        style={{ background: playing ? "var(--vsf-red-600)" : "var(--vsf-red-500)" }}
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </button>
      <div className="flex h-6 min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
        {bars.map((height, index) => (
          <span
            key={index}
            className="block w-[2px] flex-none rounded-[1px]"
            style={{
              height: `${height}%`,
              transformOrigin: "center",
              background: playing ? "var(--vsf-red-500)" : "var(--vsf-neutral-300)",
              animation: playing ? `vsfwave .9s ${(index % 10) * 0.07}s ease-in-out infinite` : "none",
            }}
          />
        ))}
      </div>
      <span className="flex-none font-mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {duration}
      </span>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
}
