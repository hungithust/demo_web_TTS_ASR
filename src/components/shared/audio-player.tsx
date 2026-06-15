import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface AudioPlayerProps {
  label: string;
  durationLabel?: string;
  src?: string | null;
  className?: string;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function AudioPlayer({
  label,
  durationLabel = "--:--",
  src,
  className,
}: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [metadataDuration, setMetadataDuration] = useState<string>(durationLabel);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bars = useMemo(() => [38, 58, 72, 46, 62, 54, 80, 50, 66, 42, 57, 48], []);

  useEffect(() => {
    setPlaying(false);
    setMetadataDuration(durationLabel);
  }, [durationLabel, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    const onEnded = () => setPlaying(false);
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onLoadedMetadata = () => setMetadataDuration(formatDuration(audio.duration));

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [src]);

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

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background/60 px-3 py-2",
        className,
      )}
    >
      <button
        type="button"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        aria-pressed={playing}
        onClick={() => void togglePlayback()}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          !src ? "opacity-90" : "",
        )}
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </button>

      <div className="flex min-w-0 flex-1 items-end gap-2">
        <div className="grid h-6 flex-1 grid-cols-12 items-end gap-1 overflow-hidden">
          {bars.map((height, index) => (
            <span
              key={`${label}-${index}`}
              className={cn(
                "w-full rounded-full transition-all duration-300",
                playing ? "bg-primary/90" : "bg-primary/35",
              )}
              style={{
                height: `${height}%`,
                opacity: playing ? 1 : 0.75,
              }}
            />
          ))}
        </div>

        <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground">
          {metadataDuration}
        </span>
      </div>

      {src ? (
        <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      ) : null}
    </div>
  );
}
