import { useCallback, useEffect, useRef } from "react";
import { audioBlobToWav } from "@/lib/audio";
import { useAsrStore } from "@/store/asr-store";

function buildAudioFile(blob: Blob) {
  return new File([blob], "recording.wav", {
    type: blob.type || "audio/wav",
  });
}

export function useMediaRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);

  const isRecording = useAsrStore((state) => state.isRecording);
  const setRecording = useAsrStore((state) => state.setRecording);
  const setRecordedAudio = useAsrStore((state) => state.setRecordedAudio);
  const setActiveSource = useAsrStore((state) => state.setActiveSource);
  const setError = useAsrStore((state) => state.setError);
  const clearTranscription = useAsrStore((state) => state.clearTranscription);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    cancelledRef.current = false;
    recorder.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      stopStream();
      return;
    }
    cancelledRef.current = true;
    recorder.stop();
  }, [setRecording, stopStream]);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstart = () => {
        setRecording(true);
        setError(null);
      };
      recorder.onstop = () => {
        if (cancelledRef.current) {
          cancelledRef.current = false;
          chunksRef.current = [];
          setRecording(false);
          stopStream();
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void audioBlobToWav(blob)
          .then((wavBlob) => {
            const file = buildAudioFile(wavBlob);
            const previewUrl = URL.createObjectURL(file);
            setRecordedAudio({
              file,
              previewUrl,
              fileName: file.name,
              mimeType: file.type,
            });
            setActiveSource("record");
            clearTranscription();
          })
          .catch(() => {
            setError("Could not process the recording. Please try again or upload a file.");
          })
          .finally(() => {
            setRecording(false);
            stopStream();
          });
      };
      recorder.onerror = () => {
        setError("Unable to record microphone audio.");
        setRecording(false);
        stopStream();
      };
      recorder.start();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to access the microphone.");
      setRecording(false);
      stopStream();
    }
  }, [clearTranscription, setActiveSource, setError, setRecordedAudio, setRecording, stopStream]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
