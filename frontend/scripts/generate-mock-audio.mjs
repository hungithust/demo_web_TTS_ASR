import fs from "node:fs";
import path from "node:path";

const sampleRate = 8000;
const durationSeconds = 1;
const channels = 1;
const bitsPerSample = 16;
const bytesPerSample = bitsPerSample / 8;
const numSamples = sampleRate * durationSeconds;
const blockAlign = channels * bytesPerSample;
const byteRate = sampleRate * blockAlign;
const dataSize = numSamples * blockAlign;

const buffer = Buffer.alloc(44 + dataSize);
let offset = 0;

function writeString(value) {
  buffer.write(value, offset, "ascii");
  offset += value.length;
}

writeString("RIFF");
buffer.writeUInt32LE(36 + dataSize, offset);
offset += 4;
writeString("WAVE");
writeString("fmt ");
buffer.writeUInt32LE(16, offset);
offset += 4;
buffer.writeUInt16LE(1, offset);
offset += 2;
buffer.writeUInt16LE(channels, offset);
offset += 2;
buffer.writeUInt32LE(sampleRate, offset);
offset += 4;
buffer.writeUInt32LE(byteRate, offset);
offset += 4;
buffer.writeUInt16LE(blockAlign, offset);
offset += 2;
buffer.writeUInt16LE(bitsPerSample, offset);
offset += 2;
writeString("data");
buffer.writeUInt32LE(dataSize, offset);

const projectRoot = path.resolve(process.cwd());
const publicDir = path.join(projectRoot, "public");
const dataDir = path.join(projectRoot, "src", "data");

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, "mock-tts-audio.wav"), buffer);
fs.writeFileSync(
  path.join(dataDir, "mock-audio.ts"),
  `export const mockTtsAudioBase64 = ${JSON.stringify(buffer.toString("base64"))};\nexport const mockTtsAudioMimeType = "audio/wav";\n`,
);
