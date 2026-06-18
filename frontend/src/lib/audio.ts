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
