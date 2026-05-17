"""Background worker — runs a lead search end to end.

Pipeline: Places text search -> dedupe -> per-business website email/social
crawl -> score -> sort. Progress + partial results are written to the job as
it goes, so the app can show leads streaming in.
"""
from . import config, jobs
from .enrich import website_email
from .scoring import dedupe, score_lead
from .sources import serper


def run_search_job(job_id: str) -> None:
    job = jobs.get_job(job_id)
    if job is None:
        return

    jobs.update_job(job_id, status=jobs.JobStatus.RUNNING, progress=5)

    try:
        businesses = serper.search_businesses(
            job.industry, job.location, job.count, config.SERPER_API_KEY
        )
    except Exception as exc:  # search-source failure ends the job cleanly
        jobs.update_job(job_id, status=jobs.JobStatus.FAILED, error=str(exc)[:500])
        return

    businesses = dedupe(businesses)
    total = len(businesses)
    if total == 0:
        jobs.update_job(job_id, status=jobs.JobStatus.COMPLETED, progress=100, leads=[])
        return

    leads: list[dict] = []
    for index, business in enumerate(businesses):
        contact = website_email.find_contact(business.get("website") or "", config.PROXY_URL)
        lead = {
            **business,  # businessName, address, phone, website, lat/lng, rating, ...
            "email": contact["email"],
            "socials": contact["socials"],
            "ownerName": contact["ownerName"],
            "ownerTitle": contact["ownerTitle"],
        }
        lead["score"] = score_lead(lead)
        leads.append(lead)
        # 10-95% spans the enrichment loop; 5% search, 5% final sort.
        progress = 10 + int(85 * (index + 1) / total)
        jobs.update_job(job_id, progress=progress, leads=list(leads))

    leads.sort(key=lambda lead: lead["score"], reverse=True)
    jobs.update_job(job_id, status=jobs.JobStatus.COMPLETED, progress=100, leads=leads)
