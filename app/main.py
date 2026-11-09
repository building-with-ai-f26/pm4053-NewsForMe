"""NewsForMe web app (FastAPI + server-rendered Jinja2, no build step)."""
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()  # read .env before any module reads os.environ

from contextlib import asynccontextmanager  # noqa: E402

from fastapi import FastAPI, Form, Request  # noqa: E402
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from fastapi.templating import Jinja2Templates  # noqa: E402

from app import db, llm, pipeline  # noqa: E402

BASE_DIR = Path(__file__).resolve().parent

@asynccontextmanager
async def lifespan(_app: "FastAPI"):
    db.init_db()  # create the SQLite schema on a fresh clone
    yield


app = FastAPI(title="NewsForMe", version="0.1.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

POSTHOG_KEY = os.environ.get("POSTHOG_PUBLIC_KEY", "")
POSTHOG_HOST = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com")


def _ctx(request: Request, **kwargs):
    base = {
        "posthog_key": POSTHOG_KEY,
        "posthog_host": POSTHOG_HOST,
        "model_configured": llm.is_configured(),
        "model_name": llm.DEFAULT_MODEL if llm.is_configured() else None,
    }
    base.update(kwargs)
    return base


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "model_configured": llm.is_configured(),
            "db": db.DB_PATH,
        }
    )


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    conn = db.connect()
    try:
        profile = db.get_profile(conn)
        if profile is None or not profile.get("keywords"):
            return RedirectResponse("/profile", status_code=303)
        briefings = db.list_briefings(conn, limit=10)
        return templates.TemplateResponse(
            request,
            "home.html",
            _ctx(
                request,
                profile=profile,
                briefings=briefings,
                feedback=db.feedback_counts(conn),
            ),
        )
    finally:
        conn.close()


@app.get("/profile", response_class=HTMLResponse)
def profile_form(request: Request):
    conn = db.connect()
    try:
        profile = db.get_profile(conn) or dict(db.DEFAULT_PROFILE)
        return templates.TemplateResponse(
            request, "profile.html", _ctx(request, profile=profile, saved=False)
        )
    finally:
        conn.close()


def _split_lines(raw: str):
    """Accept comma- or newline-separated lists from the form."""
    out = []
    for chunk in (raw or "").replace("\n", ",").split(","):
        item = chunk.strip()
        if item and item not in out:
            out.append(item)
    return out


@app.post("/profile")
def profile_save(
    display_name: str = Form(""),
    field: str = Form(""),
    keywords: str = Form(""),
    venues: str = Form(""),
    arxiv_categories: str = Form(""),
    lookback_days: int = Form(7),
):
    conn = db.connect()
    try:
        db.save_profile(
            conn,
            {
                "display_name": display_name.strip(),
                "field": field.strip(),
                "keywords": _split_lines(keywords),
                "venues": _split_lines(venues),
                "arxiv_categories": _split_lines(arxiv_categories),
                "lookback_days": max(1, min(90, int(lookback_days))),
            },
        )
    finally:
        conn.close()
    return RedirectResponse("/?saved=1", status_code=303)


@app.post("/briefing/new")
def briefing_new():
    conn = db.connect()
    try:
        profile = db.get_profile(conn)
        if profile is None or not profile.get("keywords"):
            return RedirectResponse("/profile", status_code=303)
        briefing_id = pipeline.generate_briefing(conn, profile)
        return RedirectResponse("/briefing/%d" % briefing_id, status_code=303)
    finally:
        conn.close()


@app.get("/briefing/{briefing_id}", response_class=HTMLResponse)
def briefing_view(request: Request, briefing_id: int):
    conn = db.connect()
    try:
        briefing = db.get_briefing(conn, briefing_id)
        if briefing is None:
            return HTMLResponse("<h1>No such briefing</h1>", status_code=404)
        profile = db.get_profile(conn) or dict(db.DEFAULT_PROFILE)
        return templates.TemplateResponse(
            request,
            "briefing.html",
            _ctx(request, briefing=briefing, profile=profile),
        )
    finally:
        conn.close()


@app.post("/feedback")
def feedback(
    paper_id: int = Form(...),
    vote: str = Form(...),
    briefing_id: Optional[int] = Form(None),
):
    if vote not in ("useful", "not_useful"):
        return JSONResponse({"error": "bad vote"}, status_code=400)
    conn = db.connect()
    try:
        db.record_feedback(conn, paper_id, briefing_id, vote)
    finally:
        conn.close()
    target = "/briefing/%d" % briefing_id if briefing_id else "/"
    return RedirectResponse(target, status_code=303)
