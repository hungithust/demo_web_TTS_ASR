import math
import secrets
from collections import defaultdict

from sqlmodel import select

from app.errors import InvalidTrialError, NoTrialAvailableError
from app.models_eval import Audio, Model, Sample, Trial, MosScore, CmosScore, EvalSession
from app.schemas_eval import CRITERIA


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

            # validate values before writing anything (all 3 criteria required)
            for ans in answers:
                t = trials[ans["trial_id"]]
                if t.kind == "mos":
                    scores = ans.get("scores") or {}
                    if any(scores.get(c) not in self._VALID_SCORES for c in CRITERIA):
                        raise InvalidTrialError("Invalid or missing criterion score")
                else:
                    choices = ans.get("choices") or {}
                    if any(choices.get(c) not in self._VALID_CHOICES for c in CRITERIA):
                        raise InvalidTrialError("Invalid or missing criterion choice")

            # all valid -> write atomically
            for ans in answers:
                t = trials[ans["trial_id"]]
                t.consumed = True
                s.add(t)
                if t.kind == "mos":
                    scores = ans["scores"]
                    s.add(MosScore(trial_id=t.id, session_id=client_session_id,
                                   sample_id=t.sample_id, model_id=t.model_id,
                                   naturalness=scores["naturalness"],
                                   audio_quality=scores["audio_quality"],
                                   intelligibility=scores["intelligibility"]))
                else:
                    choices = ans["choices"]
                    s.add(CmosScore(trial_id=t.id, session_id=client_session_id,
                                    sample_id=t.sample_id, model_slot1=t.model_slot1,
                                    model_slot2=t.model_slot2,
                                    naturalness=choices["naturalness"],
                                    audio_quality=choices["audio_quality"],
                                    intelligibility=choices["intelligibility"]))
            es.completed = True
            s.add(es)
            s.commit()

    # ---------- Results ----------

    def mos_results(self, min_votes: int) -> list[dict]:
        """Per-model MOS, computed independently for each of the 3 criteria."""
        with self._session_factory() as s:
            # per_model[model_id][criterion] -> list of scores
            per_model: dict[str, dict[str, list[float]]] = defaultdict(
                lambda: {c: [] for c in CRITERIA})
            for sc in s.exec(select(MosScore)).all():
                for c in CRITERIA:
                    per_model[sc.model_id][c].append(getattr(sc, c))
            names = {m.id: m.name for m in s.exec(select(Model)).all()}

            rows = []
            for model_id, crit_vals in per_model.items():
                n = len(crit_vals[CRITERIA[0]])  # each vote covers all criteria
                row = {
                    "model_id": model_id,
                    "name": names.get(model_id),
                    "n": n,
                    "ranked": n >= min_votes,
                }
                for c in CRITERIA:
                    row[c] = _criterion_stat(crit_vals[c])
                rows.append(row)

            # ordering only (not a reported aggregate): mean across criteria
            def _sort_key(r):
                means = [r[c]["mos"] for c in CRITERIA if r[c]["mos"] is not None]
                return (r["ranked"], sum(means) / len(means) if means else 0.0)

            rows.sort(key=_sort_key, reverse=True)
            return rows

    def cmos_results(self) -> dict:
        """Per-pair and per-model win-rates, computed independently per criterion."""
        with self._session_factory() as s:
            # agg[(m1, m2)][criterion] -> {slot1, slot2, same}
            agg: dict[tuple, dict[str, dict[str, int]]] = defaultdict(
                lambda: {c: {"slot1": 0, "slot2": 0, "same": 0} for c in CRITERIA})
            for sc in s.exec(select(CmosScore)).all():
                bucket = agg[(sc.model_slot1, sc.model_slot2)]
                for c in CRITERIA:
                    bucket[c][getattr(sc, c)] += 1

            pairs = []
            # per-model, per-criterion win-rate accumulation for ranking
            wins: dict[str, dict[str, float]] = defaultdict(
                lambda: {c: 0.0 for c in CRITERIA})
            totals: dict[str, dict[str, int]] = defaultdict(
                lambda: {c: 0 for c in CRITERIA})

            for (m1, m2), crit in agg.items():
                row = {"model_slot1": m1, "model_slot2": m2}
                for c in CRITERIA:
                    cc = crit[c]
                    n = cc["slot1"] + cc["slot2"] + cc["same"]
                    wr1 = (cc["slot1"] + 0.5 * cc["same"]) / n if n else None
                    row[c] = {
                        "n": n,
                        "win_rate_slot1": round(wr1, 4) if wr1 is not None else None,
                    }
                    if n:
                        wins[m1][c] += cc["slot1"] + 0.5 * cc["same"]
                        wins[m2][c] += cc["slot2"] + 0.5 * cc["same"]
                        totals[m1][c] += n
                        totals[m2][c] += n
                pairs.append(row)

            ranking = {c: [] for c in CRITERIA}
            for m in totals:
                for c in CRITERIA:
                    if totals[m][c]:
                        ranking[c].append({
                            "model_id": m,
                            "avg_win_rate": round(wins[m][c] / totals[m][c], 4),
                            "n": totals[m][c],
                        })
            for c in CRITERIA:
                ranking[c].sort(key=lambda r: r["avg_win_rate"], reverse=True)
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


def _criterion_stat(vals: list[float]) -> dict:
    """MOS mean / std / 95% CI for one criterion's scores."""
    n = len(vals)
    if n == 0:
        return {"mos": None, "std": None, "ci95": None}
    mean = sum(vals) / n
    std = _stdev(vals)
    ci95 = 1.96 * std / math.sqrt(n) if n > 1 else None
    return {
        "mos": round(mean, 4),
        "std": round(std, 4),
        "ci95": round(ci95, 4) if ci95 is not None else None,
    }


def _stdev(vals: list[float]) -> float:
    n = len(vals)
    if n < 2:
        return 0.0
    mean = sum(vals) / n
    var = sum((x - mean) ** 2 for x in vals) / (n - 1)
    return math.sqrt(var)
