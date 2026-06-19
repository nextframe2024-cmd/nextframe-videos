# Flight monitor — minimal image. Runs the 24/7 loop by default.
FROM node:22-slim

WORKDIR /app

# Install (optional) deps first for better layer caching. nodemailer is optional;
# the app degrades to file summaries if it is absent.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund || echo "optional deps skipped"

COPY tsconfig.json ./
COPY src ./src

# Persist the SQLite DB, summaries and heartbeat outside the image.
VOLUME ["/app/data"]
ENV LOG_FORMAT=json

# Docker-native health check using the built-in probe.
HEALTHCHECK --interval=5m --timeout=15s --start-period=1m --retries=3 \
  CMD node --experimental-sqlite --no-warnings src/health.ts || exit 1

CMD ["node", "--experimental-sqlite", "--no-warnings", "--env-file-if-exists=.env", "src/loop.ts"]
