"""In-memory job store for lead searches.

A search is slow (Google Maps scrape + per-site email crawl), so the API
returns a jobId immediately and the work runs in a background task. The app
polls job status.

In-memory by design for v1: one leadengine container, one process. A restart
loses in-flight jobs — acceptable because the app records the search row and
can re-trigger. Move to Redis only if the volume justifies it.
"""
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum


class JobStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class Job:
    id: str
    queries: list[str]  # one or more niche variations to search
    location: str
    count: int
    status: JobStatus = JobStatus.PENDING
    progress: int = 0  # 0-100
    leads: list = field(default_factory=list)
    error: str | None = None
    created_at: float = field(default_factory=time.time)


_jobs: dict[str, Job] = {}
_lock = threading.Lock()


def create_job(queries: list[str], location: str, count: int) -> Job:
    job = Job(id=str(uuid.uuid4()), queries=list(queries), location=location, count=count)
    with _lock:
        _jobs[job.id] = job
    return job


def get_job(job_id: str) -> Job | None:
    with _lock:
        return _jobs.get(job_id)


def update_job(job_id: str, **fields) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        for key, value in fields.items():
            setattr(job, key, value)
