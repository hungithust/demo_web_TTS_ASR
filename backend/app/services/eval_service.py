import math
import secrets
from collections import defaultdict

from sqlmodel import select

from app.errors import InvalidTrialError, NoTrialAvailableError
from app.models_eval import Audio, Model, Sample, Trial, MosScore, CmosScore


def _new_trial_id() -> str:
    return "t_" + secrets.token_urlsafe(16)


class EvalService:
    def __init__(self, session_factory, registry=None):
        self._session_factory = session_factory
        self._registry = registry

    # ---------- MOS ----------

    def next_mos(self, session_id: str) -> Trial:
        with self._session_factory() as s:
            audios = s.exec(select(Audio)).all()
            if not audios:
                raise NoTrialAvailableError("No pre-generated audio available")

            # exposure balancing: count existing MOS votes per (sample, model)
            counts = defaultdict(int)
            for sc in s.exec(select(MosScore)).all():
                counts[(sc.sample_id, sc.model_id)] += 1

            recent = self._recent_samples(s, session_id, kind="mos")
            chosen = self._pick_least_voted(
                [(a.sample_id, a.model_id) for a in audios], counts, recent
            )
            sample_id, model_id = chosen

            trial = Trial(
                id=_new_trial_id(),
                kind="mos",
                session_id=session_id,
                sample_id=sample_id,
                model_id=model_id,
            )
            s.add(trial)
            s.commit()
            s.refresh(trial)
            return trial

    def mos_audio_url(self, sample_id: str, model_id: str) -> str:
        with self._session_factory() as s:
            audio = s.exec(
                select(Audio).where(Audio.sample_id == sample_id, Audio.model_id == model_id)
            ).first()
            if audio is None:
                raise NoTrialAvailableError("Audio missing for trial")
            return audio.audio_url

    def submit_mos(self, trial_id: str, score: float, session_id: str) -> None:
        with self._session_factory() as s:
            trial = self._consume_trial(s, trial_id, session_id, kind="mos")
            s.add(
                MosScore(
                    trial_id=trial.id,
                    session_id=session_id,
                    sample_id=trial.sample_id,
                    model_id=trial.model_id,
                    score=score,
                )
            )
            s.commit()

    # ---------- CMOS ----------

    def next_cmos(self, session_id: str) -> tuple[Trial, str, str]:
        with self._session_factory() as s:
            audios = s.exec(select(Audio)).all()
            by_sample = defaultdict(list)
            for a in audios:
                by_sample[a.sample_id].append(a.model_id)

            # candidate fixed-order pairs per sample (slot1 < slot2)
            pairs = []
            for sample_id, models in by_sample.items():
                models = sorted(set(models))
                for i in range(len(models)):
                    for j in range(i + 1, len(models)):
                        pairs.append((sample_id, models[i], models[j]))
            if not pairs:
                raise NoTrialAvailableError("No model pair available for CMOS")

            counts = defaultdict(int)
            for sc in s.exec(select(CmosScore)).all():
                counts[(sc.sample_id, sc.model_slot1, sc.model_slot2)] += 1

            recent = self._recent_samples(s, session_id, kind="cmos")
            sample_id, m1, m2 = self._pick_least_voted(pairs, counts, recent)

            trial = Trial(
                id=_new_trial_id(),
                kind="cmos",
                session_id=session_id,
                sample_id=sample_id,
                model_slot1=m1,
                model_slot2=m2,
            )
            s.add(trial)
            s.commit()
            s.refresh(trial)

            url1 = self._audio_url(s, sample_id, m1)
            url2 = self._audio_url(s, sample_id, m2)
            return trial, url1, url2

    def submit_cmos(self, trial_id: str, choice: str, session_id: str) -> None:
        with self._session_factory() as s:
            trial = self._consume_trial(s, trial_id, session_id, kind="cmos")
            s.add(
                CmosScore(
                    trial_id=trial.id,
                    session_id=session_id,
                    sample_id=trial.sample_id,
                    model_slot1=trial.model_slot1,
                    model_slot2=trial.model_slot2,
                    choice=choice,
                )
            )
            s.commit()

    # ---------- Results ----------

    def mos_results(self, min_votes: int) -> list[dict]:
        with self._session_factory() as s:
            scores = defaultdict(list)
            for sc in s.exec(select(MosScore)).all():
                scores[sc.model_id].append(sc.score)
            names = {m.id: m.name for m in s.exec(select(Model)).all()}

            rows = []
            for model_id, vals in scores.items():
                n = len(vals)
                mean = sum(vals) / n
                std = _stdev(vals)
                ci95 = 1.96 * std / math.sqrt(n) if n > 1 else None
                rows.append(
                    {
                        "model_id": model_id,
                        "name": names.get(model_id),
                        "mos": round(mean, 4),
                        "n": n,
                        "std": round(std, 4),
                        "ci95": round(ci95, 4) if ci95 is not None else None,
                        "ranked": n >= min_votes,
                    }
                )
            rows.sort(key=lambda r: (r["ranked"], r["mos"]), reverse=True)
            return rows

    def cmos_results(self) -> dict:
        with self._session_factory() as s:
            agg = defaultdict(lambda: {"slot1": 0, "slot2": 0, "same": 0})
            for sc in s.exec(select(CmosScore)).all():
                agg[(sc.model_slot1, sc.model_slot2)][sc.choice] += 1

            pairs = []
            # per-model win-rate accumulation for ranking
            wins = defaultdict(float)
            totals = defaultdict(int)
            for (m1, m2), c in agg.items():
                n = c["slot1"] + c["slot2"] + c["same"]
                wr1 = (c["slot1"] + 0.5 * c["same"]) / n if n else None
                pairs.append(
                    {
                        "model_slot1": m1,
                        "model_slot2": m2,
                        "n": n,
                        "win_rate_slot1": round(wr1, 4) if wr1 is not None else None,
                    }
                )
                if n:
                    wins[m1] += c["slot1"] + 0.5 * c["same"]
                    wins[m2] += c["slot2"] + 0.5 * c["same"]
                    totals[m1] += n
                    totals[m2] += n

            ranking = [
                {
                    "model_id": m,
                    "avg_win_rate": round(wins[m] / totals[m], 4),
                    "n": totals[m],
                }
                for m in totals
            ]
            ranking.sort(key=lambda r: r["avg_win_rate"], reverse=True)
            return {"pairs": pairs, "ranking": ranking}

    # ---------- helpers ----------

    def _consume_trial(self, s, trial_id: str, session_id: str, kind: str) -> Trial:
        trial = s.get(Trial, trial_id)
        if trial is None or trial.kind != kind:
            raise InvalidTrialError("Unknown trial")
        if trial.session_id != session_id:
            raise InvalidTrialError("Trial does not belong to this session")
        if trial.consumed:
            raise InvalidTrialError("Trial already submitted")
        trial.consumed = True
        s.add(trial)
        return trial

    def _recent_samples(self, s, session_id: str, kind: str, limit: int = 1) -> set[str]:
        rows = s.exec(
            select(Trial)
            .where(Trial.session_id == session_id, Trial.kind == kind)
            .order_by(Trial.created_at.desc())
            .limit(limit)
        ).all()
        return {r.sample_id for r in rows}

    def _pick_least_voted(self, candidates, counts, avoid_samples):
        """Pick the least-voted candidate; avoid recently used samples when possible."""
        preferred = [c for c in candidates if c[0] not in avoid_samples] or candidates
        min_count = min(counts.get(c, 0) for c in preferred)
        pool = [c for c in preferred if counts.get(c, 0) == min_count]
        return secrets.choice(pool)

    def _audio_url(self, s, sample_id: str, model_id: str) -> str:
        audio = s.exec(
            select(Audio).where(Audio.sample_id == sample_id, Audio.model_id == model_id)
        ).first()
        if audio is None:
            raise NoTrialAvailableError("Audio missing for trial")
        return audio.audio_url


def _stdev(vals: list[float]) -> float:
    n = len(vals)
    if n < 2:
        return 0.0
    mean = sum(vals) / n
    var = sum((x - mean) ** 2 for x in vals) / (n - 1)
    return math.sqrt(var)
