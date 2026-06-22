import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AudioPlayer } from "@/components/shared/audio-player";
import { SectionContainer } from "@/components/shared/section-container";
import { PrimaryButton } from "@/components/shared/primary-button";
import { ErrorState } from "@/components/shared/error-state";
import { datasetService } from "@/services/dataset.service";
import { getApiMessage } from "@/services/api";
import type { CategoryCount, DatasetSample } from "@/types/dataset.types";

export function DatasetContent() {
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [samples, setSamples] = useState<DatasetSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    datasetService
      .getCategories()
      .then(setCategories)
      .catch((e) => setError(getApiMessage(e, "Failed to load categories")));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    datasetService
      .getSamples(activeCategory ?? undefined)
      .then(setSamples)
      .catch((e) => setError(getApiMessage(e, "Failed to load samples")))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  async function refreshCategories() {
    try {
      setCategories(await datasetService.getCategories());
    } catch {
      // non-fatal: keep current chips
    }
  }

  async function handleAdd() {
    const text = newText.trim();
    const category = newCategory.trim();
    if (!text || !category) return;
    setAdding(true);
    setError(null);
    try {
      const created = await datasetService.addSample({ text, category });
      setNewText("");
      await refreshCategories();
      if (!activeCategory || activeCategory === category) {
        setSamples((prev) => [...prev, created]);
      }
    } catch (e) {
      setError(getApiMessage(e, "Failed to add test case"));
    } finally {
      setAdding(false);
    }
  }

  return (
    <SectionContainer title="TTS Dataset">
      {error ? <ErrorState title="Dataset error" description={error} /> : null}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={[
            "rounded-full border px-3 py-1 text-xs font-medium transition",
            activeCategory === null ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.category}
            onClick={() => setActiveCategory(c.category)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              activeCategory === c.category ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {c.category} ({c.count})
          </button>
        ))}
      </div>

      {/* Add test case */}
      <div className="rounded-3xl border border-border bg-background/30 p-4">
        <h3 className="text-sm font-semibold tracking-tight">Add test case</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Nhập câu test..."
            rows={2}
            className="rounded-2xl border border-border bg-card p-3 text-sm"
          />
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            list="dataset-categories"
            placeholder="Category"
            className="rounded-2xl border border-border bg-card p-3 text-sm"
          />
          <datalist id="dataset-categories">
            {categories.map((c) => (
              <option key={c.category} value={c.category} />
            ))}
          </datalist>
          <PrimaryButton
            type="button"
            size="lg"
            disabled={adding || !newText.trim() || !newCategory.trim()}
            onClick={() => void handleAdd()}
          >
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {adding ? "Generating" : "Add"}
          </PrimaryButton>
        </div>
      </div>

      {/* Text | audio-per-model list */}
      <div className="rounded-3xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading...
          </div>
        ) : samples.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No test cases yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {samples.map((s) => (
              <li key={s.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div>
                  <p className="text-sm leading-6 text-foreground">{s.text}</p>
                  {s.category ? (
                    <span className="mt-2 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {s.category}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  {s.audios.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No audio generated.</span>
                  ) : (
                    s.audios.map((a) => (
                      <AudioPlayer key={a.model_id} label={a.model_id} src={a.audio_url} />
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionContainer>
  );
}
