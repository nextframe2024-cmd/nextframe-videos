# Flight monitor — self-contained image. Includes Chromium so the live
# Playwright (Google Flights) provider works out of the box. Runs the 24/7
# loop by default. Nothing is installed on the host — everything is in here.
FROM node:22-slim

WORKDIR /app

# Install deps first for better layer caching. optionalDependencies
# (nodemailer + playwright) are installed; nodemailer is only used if SMTP is set.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund \
 || npm install --omit=dev --no-audit --no-fund

# Chromium + the OS libraries it needs, for PROVIDER=playwright live scraping.
# (Harmless if you run PROVIDER=mock — it just sits unused.)
RUN npx playwright install --with-deps chromium

COPY tsconfig.json ./
COPY src ./src

# Persist the SQLite DB, summaries and heartbeat outside the image.
VOLUME ["/app/data"]
ENV LOG_FORMAT=json

# Docker-native health check using the built-in probe.
HEALTHCHECK --interval=5m --timeout=15s --start-period=2m --retries=3 \
  CMD node --experimental-sqlite --no-warnings src/health.ts || exit 1

CMD ["node", "--experimental-sqlite", "--no-warnings", "--env-file-if-exists=.env", "src/loop.ts"]
