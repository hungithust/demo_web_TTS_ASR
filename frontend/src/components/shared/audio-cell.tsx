import { AudioPlayer } from "@/components/shared/audio-player";

export interface AudioCellProps {
  label: string;
  durationLabel: string;
  src?: string | null;
}

export function AudioCell({ label, durationLabel, src }: AudioCellProps) {
  return (
    <AudioPlayer
      label={label}
      durationLabel={durationLabel}
      src={src}
    />
  );
}
