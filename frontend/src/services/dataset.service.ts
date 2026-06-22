import { apiBaseUrl, fetchJson, resolveAssetUrl, simulateLatency } from "@/services/api";
import type {
  AddSampleRequest,
  CategoryCount,
  DatasetSample,
} from "@/types/dataset.types";

const useMock = apiBaseUrl === "";

// Small local dataset so the tab renders without a backend configured.
const mockSamples: DatasetSample[] = [
  {
    id: "ds_mock_1",
    text: "Xin chào, hôm nay bạn khỏe không?",
    category: "Câu hội thoại cơ bản",
    audios: [
      { model_id: "omnivoice", audio_url: "/static/audio/mock_a.wav" },
      { model_id: "voxcpm2", audio_url: "/static/audio/mock_b.wav" },
    ],
  },
  {
    id: "ds_mock_2",
    text: "Một trăm hai mươi ba.",
    category: "Số nguyên",
    audios: [
      { model_id: "omnivoice", audio_url: "/static/audio/mock_a.wav" },
      { model_id: "voxcpm2", audio_url: "/static/audio/mock_b.wav" },
    ],
  },
];

function resolveAudios(sample: DatasetSample): DatasetSample {
  return {
    ...sample,
    audios: sample.audios.map((a) => ({ ...a, audio_url: resolveAssetUrl(a.audio_url) })),
  };
}

async function getCategories(): Promise<CategoryCount[]> {
  if (useMock) {
    await simulateLatency();
    const counts = new Map<string, number>();
    for (const s of mockSamples) {
      if (s.category) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    }
    return [...counts].map(([category, count]) => ({ category, count }));
  }
  return fetchJson<CategoryCount[]>("/api/dataset/categories");
}

async function getSamples(category?: string): Promise<DatasetSample[]> {
  if (useMock) {
    await simulateLatency();
    const rows = category ? mockSamples.filter((s) => s.category === category) : mockSamples;
    return rows.map(resolveAudios);
  }
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const rows = await fetchJson<DatasetSample[]>(`/api/dataset/samples${query}`);
  return rows.map(resolveAudios);
}

async function addSample(payload: AddSampleRequest): Promise<DatasetSample> {
  if (useMock) {
    await simulateLatency();
    const created: DatasetSample = {
      id: `ds_mock_${Date.now()}`,
      text: payload.text,
      category: payload.category,
      audios: [
        { model_id: "omnivoice", audio_url: "/static/audio/mock_a.wav" },
        { model_id: "voxcpm2", audio_url: "/static/audio/mock_b.wav" },
      ],
    };
    mockSamples.push(created);
    return resolveAudios(created);
  }
  const created = await fetchJson<DatasetSample>("/api/dataset/samples", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return resolveAudios(created);
}

export const datasetService = { getCategories, getSamples, addSample };
export { getCategories, getSamples, addSample };
