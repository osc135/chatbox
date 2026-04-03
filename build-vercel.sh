#!/bin/bash
set -e

# ── Chess app ──────────────────────────────────────────────────────────────────
echo "Building chess app..."
cd apps/chess
npm ci
VITE_BASE=/chess/ npm run build
cd ../..
mkdir -p dist/chess
cp -r apps/chess/dist/. dist/chess/

# ── Weather app ────────────────────────────────────────────────────────────────
echo "Building weather app..."
cd apps/weather
npm ci
VITE_BASE=/weather/ npm run build
cd ../..
mkdir -p dist/weather
cp -r apps/weather/dist/. dist/weather/

# ── Main chatbox app ───────────────────────────────────────────────────────────
echo "Building main app..."
export VITE_CHESS_APP_URL=/chess
export VITE_WEATHER_APP_URL=/weather
NODE_OPTIONS="--max-old-space-size=4096" pnpm exec vite build --config vite.web.config.ts
cp -r release/app/dist/renderer/. dist/

echo "Done."
