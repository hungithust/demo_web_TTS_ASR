import secrets
from collections import defaultdict

from sqlmodel import select

from app.models_eval import Sample, Model, Audio
from app.services.audio_store import store_wav


class DatasetService:
    def __init__(self, session_factory, registry, engine, audio_dir: str):
        self._session_factory = session_factory
        self._registry = registry
        self._engine = engine
        self._audio_dir = audio_dir

    def list_categories(self) -> list[dict]:
        with self._session_factory() as s:
            samples = s.exec(select(Sample)).all()
        counts: dict[str, int] = defaultdict(int)
        for row in samples:
            if row.category:
                counts[row.category] += 1
        return [{"category": c, "count": n} for c, n in counts.items()]

    def list_samples(self, category: str | None = None) -> list[dict]:
        with self._session_factory() as s:
            q = select(Sample)
            if category:
                q = q.where(Sample.category == category)
            samples = s.exec(q).all()
            audios = s.exec(select(Audio)).all()
        by_sample: dict[str, list[dict]] = defaultdict(list)
        for a in audios:
            by_sample[a.sample_id].append({"model_id": a.model_id, "audio_url": a.audio_url})
        return [
            {"id": row.id, "text": row.text, "category": row.category,
             "audios": by_sample.get(row.id, [])}
            for row in samples
        ]

    async def add_sample(self, text: str, category: str) -> dict:
        sample_id = "ds_user_" + secrets.token_hex(4)
        with self._session_factory() as s:
            s.add(Sample(id=sample_id, text=text, category=category))
            s.commit()

        audios = []
        for model_id in self._registry.tts_models():
            b64 = await self._engine.synthesize(text, model_id)
            url = store_wav(self._audio_dir, sample_id, model_id, b64)
            with self._session_factory() as s:
                if s.get(Model, model_id) is None:
                    s.add(Model(id=model_id, name=model_id))
                s.add(Audio(sample_id=sample_id, model_id=model_id, audio_url=url))
                s.commit()
            audios.append({"model_id": model_id, "audio_url": url})

        return {"id": sample_id, "text": text, "category": category, "audios": audios}
