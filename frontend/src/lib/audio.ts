import { arrayBufferToBase64, base64ToUint8Array, stripDataUrlPrefix } from "@/lib/base64";

export function base64AudioToObjectUrl(base64Audio: string, mimeType = "audio/wav") {
  const bytes = base64ToUint8Array(stripDataUrlPrefix(base64Audio));
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function fileToBase64(file: Blob) {
  const buffer = await file.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

function audioBufferToWavMono(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length;
  const channels = buffer.numberOfChannels;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) mono[i] += data[i] / channels;
  }

  const sampleRate = buffer.sampleRate;
  const dataSize = length * 2;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  let offset = 0;
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset++, s.charCodeAt(i));
  };

  writeStr("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeStr("WAVE");
  writeStr("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * 2, true);
  offset += 4;
  view.setUint16(offset, 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeStr("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let i = 0; i < length; i += 1) {
    const sample = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return out;
}

export async function audioBlobToWav(blob: Blob, targetSampleRate = 16000): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    void decodeCtx.close();
  }

  const frameCount = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
  const OfflineCtx =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const offline = new OfflineCtx(1, frameCount, targetSampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return new Blob([audioBufferToWavMono(rendered)], { type: "audio/wav" });
}
