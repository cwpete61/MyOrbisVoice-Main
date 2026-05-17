"""Lead engine internal API.

Internal-only service (private Docker network). The app API submits a search,
polls status, and pulls results. Scraping + enrichment land in chunk 2.
"""
import hmac
import sys

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import config, jobs

app = FastAPI(title="MyOrbisVoice Lead Engine", version="0.1.0")

if not config.INTERNAL_TOKEN:
    print(
        "[leadengine] WARNING: LEADENGINE_INTERNAL_TOKEN is unset — "
        "internal API auth is DISABLED. Dev only; never run prod like this.",
        file=sys.stderr,
    )


def _auth(token: str | None) -> None:
    """Shared-secret check. Skipped when no token is configured (local dev).

    Uses a constant-time compare so a caller can't probe the token by timing.
    """
    if not config.INTERNAL_TOKEN:
        return
    if not hmac.compare_digest(token or "", config.INTERNAL_TOKEN):
        raise HTTPException(status_code=401, detail="bad internal token")


class SearchRequest(BaseModel):
    industry: str = Field(min_length=1, max_length=120)
    location: str = Field(min_length=1, max_length=120)
    count: int = Field(ge=1, le=200)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/jobs")
def create_job(
    req: SearchRequest,
    background: BackgroundTasks,
    x_internal_token: str | None = Header(default=None),
) -> dict:
    _auth(x_internal_token)
    job = jobs.create_job(req.industry, req.location, req.count)
    # Chunk 2 wires the real worker:
    #   background.add_task(run_search_job, job.id)
    return {"jobId": job.id, "status": job.status}


@app.get("/jobs/{job_id}")
def job_status(
    job_id: str,
    x_internal_token: str | None = Header(default=None),
) -> dict:
    _auth(x_internal_token)
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return {
        "jobId": job.id,
        "status": job.status,
        "progress": job.progress,
        "leadCount": len(job.leads),
        "error": job.error,
    }


@app.get("/jobs/{job_id}/results")
def job_results(
    job_id: str,
    x_internal_token: str | None = Header(default=None),
) -> dict:
    _auth(x_internal_token)
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return {"jobId": job.id, "status": job.status, "leads": job.leads}
