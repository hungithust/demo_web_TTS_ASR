import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useAsrStore } from "@/store/asr-store";

const ACCEPTED_MIME_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"]);
const ACCEPTED_EXTENSIONS = [".wav", ".mp3"];

function isValidAudioFile(file: File) {
  const name = file.name.toLowerCase();
  const hasValidExtension = ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
  const hasValidMimeType = ACCEPTED_MIME_TYPES.has(file.type);
  return hasValidExtension || hasValidMimeType;
}

export function useAudioUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setUploadedAudio = useAsrStore((state) => state.setUploadedAudio);
  const setActiveSource = useAsrStore((state) => state.setActiveSource);
  const setError = useAsrStore((state) => state.setError);
  const clearTranscription = useAsrStore((state) => state.clearTranscription);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return false;
      if (!isValidAudioFile(file)) {
        setError("Unsupported audio file. Use wav or mp3.");
        return false;
      }

      const previewUrl = URL.createObjectURL(file);
      setUploadedAudio({
        file,
        previewUrl,
        fileName: file.name,
        mimeType: file.type || "audio/mpeg",
      });
      setActiveSource("upload");
      clearTranscription();
      return true;
    },
    [clearTranscription, setActiveSource, setError, setUploadedAudio],
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      await handleFile(file);
      event.target.value = "";
    },
    [handleFile],
  );

  const onDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      await handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  return {
    inputRef,
    isDragging,
    openPicker,
    onInputChange,
    onDrop,
    onDragOver,
    onDragLeave,
    handleFile,
  };
}
