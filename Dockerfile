# ── Stage 1: Chess app ────────────────────────────────────────────────────────
FROM node:20-slim AS chess-builder
WORKDIR /build
COPY apps/chess/package.json apps/chess/package-lock.json ./
RUN npm ci
COPY apps/chess/ ./
# Serve the chess app at /chess/ in production
RUN VITE_BASE=/chess/ npm run build

# ── Stage 2: Quiz app ─────────────────────────────────────────────────────────
FROM node:20-slim AS quiz-builder
WORKDIR /build
COPY apps/quiz/package.json apps/quiz/package-lock.json ./
RUN npm ci
COPY apps/quiz/ ./
# Serve the quiz app at /quiz/ in production
RUN VITE_BASE=/quiz/ npm run build

# ── Stage 3: Weather app ──────────────────────────────────────────────────────
FROM node:20-slim AS weather-builder
WORKDIR /build
COPY apps/weather/package.json apps/weather/package-lock.json ./
RUN npm ci
COPY apps/weather/ ./
# Serve the weather app at /weather/ in production
RUN VITE_BASE=/weather/ npm run build

# ── Stage 4: Main Chatbox web build ──────────────────────────────────────────
FROM node:20-slim AS main-builder
WORKDIR /build

# pnpm 10 (matches lockfileVersion 9.0)
RUN npm install -g pnpm@10

# Build tools needed for native modules (zipfile, etc.)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Prevent electron binary download — not needed for web build
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install deps (cache-friendly: manifests first)
COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches/ ./patches/
# postinstall.cjs needs .erb/ to exist before pnpm install runs
COPY .erb/ ./.erb/
COPY release/app/package.json ./release/app/
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .

# Inline the app subpaths so the LLM toolsets point to the right iframes
ENV VITE_CHESS_APP_URL=/chess/
ENV VITE_WEATHER_APP_URL=/weather/
ENV VITE_QUIZ_APP_URL=/quiz/
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Raise Node heap limit — the full Vite build (MUI + Mantine + Mermaid + AI SDKs) OOMs at default 2GB
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm exec vite build --config vite.web.config.ts

# ── Stage 5: nginx runtime ────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=chess-builder    /build/dist                       /usr/share/nginx/html/chess
COPY --from=quiz-builder     /build/dist                       /usr/share/nginx/html/quiz
COPY --from=weather-builder  /build/dist                       /usr/share/nginx/html/weather
COPY --from=main-builder     /build/release/app/dist/renderer  /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
EXPOSE 8080
CMD sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
