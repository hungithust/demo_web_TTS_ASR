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
    is_fixed: false,
    audios: [
      { model_id: "omnivoice", audio_url: "/static/audio/mock_a.wav" },
      { model_id: "voxcpm2", audio_url: "/static/audio/mock_b.wav" },
    ],
  },
  {
    id: "ds_mock_2",
    text: "Một trăm hai mươi ba.",
    category: "Số nguyên",
    is_fixed: false,
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

async function getSamples(category?: string, fixedOnly = false): Promise<DatasetSample[]> {
  if (useMock) {
    await simulateLatency();
    let rows = category ? mockSamples.filter((s) => s.category === category) : mockSamples;
    if (fixedOnly) rows = rows.filter((s) => s.is_fixed);
    return rows.map(resolveAudios);
  }
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (fixedOnly) params.set("fixed_only", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
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
      is_fixed: false,
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

async function setFixed(id: string, is_fixed: boolean): Promise<DatasetSample> {
  if (useMock) {
    await simulateLatency();
    const row = mockSamples.find((s) => s.id === id);
    if (row) row.is_fixed = is_fixed;
    return resolveAudios(row ?? { id, text: "", category: null, is_fixed, audios: [] });
  }
  const updated = await fetchJson<DatasetSample>(`/api/dataset/samples/${id}/fixed`, {
    method: "PATCH",
    body: JSON.stringify({ is_fixed }),
  });
  return resolveAudios(updated);
}

export const datasetService = { getCategories, getSamples, addSample, setFixed };
export { getCategories, getSamples, addSample, setFixed };
