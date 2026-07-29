# Playwright base image ships Chromium + all system deps (fonts, libs) — keeps
# the heavy browser isolated from the lean API container.
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app
COPY package.json ./
# playwright npm pkg is already present in the base image; install pins the version.
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./

ENV PORT=4500
EXPOSE 4500
# Non-root: an app-layer RCE can't be root or drop system miners (breach hardening).
RUN chown -R pwuser:pwuser /app
USER pwuser
CMD ["node", "server.mjs"]
