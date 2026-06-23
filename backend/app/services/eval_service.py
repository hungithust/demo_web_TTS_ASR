import math
import secrets
from collections import defaultdict

from sqlmodel import select

from app.errors import InvalidTrialError, NoTrialAvailableError
from app.models_eval import Audio, Model, Sample, Trial, MosScore, CmosScore, EvalSession


def _new_trial_id() -> str:
    return "t_" + secrets.token_urlsafe(16)


def _new_session_id() -> str:
    return "es_" + secrets.token_urlsafe(16)


class EvalService:
    def __init__(self, session_factory, registry=None):
        self._session_factory = session_factory
        self._registry = registry

    _VALID_SCORES = {i * 0.5 for i in range(0, 11)}
    _VALID_CHOICES = {"slot1", "slot2", "same"}

    # ---------- session start ----------

    def start_session(self, kind: str, client_session_id: str, size: int) -> dict:
        if kind not in ("mos", "cmos"):
            raise InvalidTrialError(f"Unknown kind: {kind}")
        with self._session_factory() as s:
            audios = s.exec(select(Audio)).all()
            samples = {row.id: row for row in s.exec(select(Sample)).all()}

            by_sample: dict[str, list[str]] = defaultdict(list)
            for a in audios:
                by_sample[a.sample_id].append(a.model_id)

            # pool: samples that have the required audio
            if kind == "mos":
                pool = [sid for sid, ms in by_sample.items() if len(ms) >= 1]
            else:
                pool = [sid for sid, ms in by_sample.items() if len(set(ms)) >= 2]
            if not pool:
                raise NoTrialAvailableError("No samples with audio available")

            chosen_samples = self._choose_session_samples(pool, samples, size)

            # build per-sample model / pair using exposure balancing
            if kind == "mos":
                counts = defaultdict(int)
                for sc in s.exec(select(MosScore)).all():
                    counts[(sc.sample_id, sc.model_id)] += 1
            else:
                counts = defaultdict(int)
                for sc in s.exec(select(CmosScore)).all():
                    counts[(sc.sample_id, sc.model_slot1, sc.model_slot2)] += 1

            es = EvalSession(
                id=_new_session_id(),
                client_session_id=client_session_id,
                kind=kind,
                size=len(chosen_samples),
            )
            s.add(es)

            items = []
            for sid in chosen_samples:
                models = sorted(set(by_sample[sid]))
                if kind == "mos":
                    candidates = [(sid, m) for m in models]
                    _, model_id = self._pick_least_voted(candidates, counts, set())
                    trial = Trial(id=_new_trial_id(), kind="mos", session_id=client_session_id,
                                  sample_id=sid, model_id=model_id, eval_session_id=es.id)
                    s.add(trial)
                    url = next(a.audio_url for a in audios
                               if a.sample_id == sid and a.model_id == model_id)
                    items.append({"trial_id": trial.id, "sample_id": sid,
                                  "text": samples[sid].text, "audio_url": url})
                else:
                    pairs = [(sid, models[i], models[j])
                             for i in range(len(models)) for j in range(i + 1, len(models))]
                    _, m1, m2 = self._pick_least_voted(pairs, counts, set())
                    trial = Trial(id=_new_trial_id(), kind="cmos", session_id=client_session_id,
                                  sample_id=sid, model_slot1=m1, model_slot2=m2,
                                  eval_session_id=es.id)
                    s.add(trial)
                    url1 = next(a.audio_url for a in audios
                                if a.sample_id == sid and a.model_id == m1)
                    url2 = next(a.audio_url for a in audios
                                if a.sample_id == sid and a.model_id == m2)
                    items.append({"trial_id": trial.id, "sample_id": sid,
                                  "text": samples[sid].text,
                                  "slot1_url": url1, "slot2_url": url2})

            s.commit()
            return {"eval_session_id": es.id, "kind": kind,
                    "size": len(items), "items": items}

    def _choose_session_samples(self, pool, samples, size) -> list[str]:
        fixed = [sid for sid in pool if samples[sid].is_fixed]
        rest = [sid for sid in pool if not samples[sid].is_fixed]
        if size >= len(pool):
            chosen = list(pool)
        elif len(fixed) >= size:
            chosen = list(_sample_without_replacement(fixed, size))
        else:
            chosen = list(fixed) + list(
                _sample_without_replacement(rest, size - len(fixed)))
        secrets.SystemRandom().shuffle(chosen)
        return chosen

    # ---------- session complete (atomic) ----------

    def complete_session(self, eval_session_id: str, client_session_id: str,
                         answers: list[dict]) -> None:
        with self._session_factory() as s:
            es = s.get(EvalSession, eval_session_id)
            if es is None:
                raise InvalidTrialError("Unknown session")
            if es.client_session_id != client_session_id:
                raise InvalidTrialError("Session does not belong to this client")
            if es.completed:
                raise InvalidTrialError("Session already completed")

            trials = {t.id: t for t in s.exec(
                select(Trial).where(Trial.eval_session_id == es.id)).all()}

            if len(answers) != es.size:
                raise InvalidTrialError("Session not fully answered")
            seen = set()
            for ans in answers:
                tid = ans.get("trial_id")
                if tid not in trials or tid in seen:
                    raise InvalidTrialError("Invalid or duplicate trial in answers")
                seen.add(tid)
            if len(seen) != es.size:
                raise InvalidTrialError("Answers do not cover all trials")

            # validate values before writing anything
            for ans in answers:
                t = trials[ans["trial_id"]]
                if t.kind == "mos":
                    if ans.get("score") not in self._VALID_SCORES:
                        raise InvalidTrialError("Invalid score")
                else:
                    if ans.get("choice") not in self._VALID_CHOICES:
                        raise InvalidTrialError("Invalid choice")

            # all valid -> write atomically
            for ans in answers:
                t = trials[ans["trial_id"]]
                t.consumed = True
                s.add(t)
                if t.kind == "mos":
                    s.add(MosScore(trial_id=t.id, session_id=client_session_id,
                                   sample_id=t.sample_id, model_id=t.model_id,
                                   score=ans["score"]))
                else:
                    s.add(CmosScore(trial_id=t.id, session_id=client_session_id,
                                    sample_id=t.sample_id, model_slot1=t.model_slot1,
                                    model_slot2=t.model_slot2, choice=ans["choice"]))
            es.completed = True
            s.add(es)
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


def _sample_without_replacement(items, k):
    rng = secrets.SystemRandom()
    pool = list(items)
    rng.shuffle(pool)
    return pool[:k]


def _stdev(vals: list[float]) -> float:
    n = len(vals)
    if n < 2:
        return 0.0
    mean = sum(vals) / n
    var = sum((x - mean) ** 2 for x in vals) / (n - 1)
    return math.sqrt(var)
