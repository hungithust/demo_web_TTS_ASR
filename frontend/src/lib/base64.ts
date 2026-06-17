export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

export function base64ToUint8Array(base64: string) {
  const cleaned = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function stripDataUrlPrefix(base64: string) {
  return base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
}
