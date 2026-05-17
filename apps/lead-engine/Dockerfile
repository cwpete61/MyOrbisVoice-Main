# Lead engine — Python scraping + enrichment service.
# Build context is the repo root (matches the api/web/gateway Dockerfiles).
FROM python:3.12-slim

WORKDIR /app

COPY apps/lead-engine/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/lead-engine/app ./app

# Run unprivileged — a service that fetches arbitrary remote pages should
# never run as root.
RUN useradd --create-home --uid 1001 leadengine && chown -R leadengine:leadengine /app
USER leadengine

EXPOSE 7000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7000"]
