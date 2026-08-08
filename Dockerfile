# syntax=docker/dockerfile:1.7
FROM node:24.13.0-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund

COPY src ./src

ENV DATA_DIR=/app/data
ENV REPO_DIR=/app/repo

VOLUME ["/app/data", "/app/repo"]

CMD ["node", "src/index.mjs"]
