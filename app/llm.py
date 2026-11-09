"""OpenRouter layer: re-rank the shortlist and write one 'relevant because' line.

Design rule: this layer is optional. If no key is set, the call fails, or the
model returns unparseable output, the caller keeps the deterministic ranking and
the keyword rationales. The app must never hard-fail because a model did.
"""
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-haiku-4.5")
ABSTRACT_CHARS = 700


class LLMUnavailable(Exception):
    """Raised when the model layer cannot be used; caller falls back."""


def api_key() -> Optional[str]:
    key = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if not key or key.startswith("sk-or-v1-replace"):
        return None
    return key


def is_configured() -> bool:
    return api_key() is not None


def build_prompt(papers: List[Dict[str, Any]], profile: Dict[str, Any]) -> str:
    lines = [
        "Researcher profile",
        "- Field: %s" % (profile.get("field") or "unspecified"),
        "- Tracked topics: %s" % ", ".join(profile.get("keywords", []) or ["unspecified"]),
        "- Venues they care about: %s"
        % ", ".join(profile.get("venues", []) or ["any reputable journal"]),
        "",
        "Candidate papers",
    ]
    for i, p in enumerate(papers):
        abstract = (p.get("abstract") or "")[:ABSTRACT_CHARS]
        lines.append(
            "[%d] TITLE: %s\n    VENUE: %s\n    ABSTRACT: %s"
            % (i, p.get("title", ""), p.get("venue", "unknown"), abstract or "(none)")
        )
    lines += [
        "",
        "For each candidate, decide whether this specific researcher should read it "
        "this week, and say why in one sentence that names the connection to their "
        "tracked topics. Be strict: mark keep=false for papers that only share "
        "generic vocabulary with their interests.",
        "",
        'Reply with JSON only: {"results":[{"index":0,"keep":true,'
        '"relevance":0-100,"reason":"one sentence"}]}',
    ]
    return "\n".join(lines)


def _extract_json(content: str) -> Dict[str, Any]:
    """Models sometimes wrap JSON in prose or code fences. Dig it out."""
    text = content.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise LLMUnavailable("model did not return JSON")


def review_papers(
    papers: List[Dict[str, Any]],
    profile: Dict[str, Any],
    model: Optional[str] = None,
    timeout: float = 90.0,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Ask the model to judge the shortlist.

    Returns (results, usage). Raises LLMUnavailable on any failure so the
    pipeline can fall back without a half-applied state.
    """
    key = api_key()
    if key is None:
        raise LLMUnavailable("OPENROUTER_API_KEY is not set")
    if not papers:
        return [], {}

    model_name = model or DEFAULT_MODEL
    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "system",
                "content": "You triage new research papers for one named PhD "
                "researcher. You are concise and you never invent findings that "
                "are not in the abstract you were given.",
            },
            {"role": "user", "content": build_prompt(papers, profile)},
        ],
        "temperature": 0.2,
        "max_tokens": 1600,
    }
    headers = {
        "Authorization": "Bearer %s" % key,
        "Content-Type": "application/json",
        "X-Title": "NewsForMe",
    }
    try:
        resp = httpx.post(OPENROUTER_URL, json=payload, headers=headers, timeout=timeout)
    except httpx.HTTPError as exc:
        raise LLMUnavailable("network error: %s" % exc)
    if resp.status_code != 200:
        raise LLMUnavailable("OpenRouter %s: %s" % (resp.status_code, resp.text[:200]))

    body = resp.json()
    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise LLMUnavailable("unexpected response shape")

    parsed = _extract_json(content)
    results = parsed.get("results")
    if not isinstance(results, list):
        raise LLMUnavailable("no results array in model output")

    usage = body.get("usage") or {}
    return results, {
        "model_used": body.get("model", model_name),
        "prompt_tokens": int(usage.get("prompt_tokens", 0) or 0),
        "completion_tokens": int(usage.get("completion_tokens", 0) or 0),
    }


def apply_reviews(
    papers: List[Dict[str, Any]], results: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Merge model verdicts onto the ranked papers.

    An index the model made up is ignored. A paper the model never mentioned
    keeps its deterministic rank and keyword rationale.
    """
    by_index: Dict[int, Dict[str, Any]] = {}
    for r in results:
        if not isinstance(r, dict):
            continue
        try:
            idx = int(r.get("index"))
        except (TypeError, ValueError):
            continue
        if 0 <= idx < len(papers):
            by_index[idx] = r

    out: List[Dict[str, Any]] = []
    for i, paper in enumerate(papers):
        enriched = dict(paper)
        review = by_index.get(i)
        if review is None:
            out.append(enriched)
            continue
        if review.get("keep") is False:
            continue
        reason = str(review.get("reason") or "").strip()
        if reason:
            enriched["rationale"] = reason
            enriched["rationale_source"] = "model"
        try:
            relevance = float(review.get("relevance"))
            enriched["model_relevance"] = max(0.0, min(100.0, relevance))
        except (TypeError, ValueError):
            pass
        out.append(enriched)

    # Model relevance reorders the shortlist; papers it skipped stay in
    # deterministic order behind the ones it scored.
    out.sort(
        key=lambda p: (
            -(p.get("model_relevance", -1.0)),
            -p.get("score", 0.0),
            p.get("title", ""),
        )
    )
    return out


def estimate_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    """Rough cost for the build log. Rates are env-configurable per 1M tokens."""
    in_rate = float(os.environ.get("MODEL_INPUT_USD_PER_MTOK", "1.00"))
    out_rate = float(os.environ.get("MODEL_OUTPUT_USD_PER_MTOK", "5.00"))
    return round(
        (prompt_tokens / 1_000_000.0) * in_rate
        + (completion_tokens / 1_000_000.0) * out_rate,
        6,
    )
