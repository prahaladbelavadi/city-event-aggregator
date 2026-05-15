#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  echo "Error: .env file not found. Copy .env.example and fill in values."
  exit 1
fi

get_env() {
  grep -E "^$1=" .env | cut -d '=' -f2- | tr -d '"' || true
}

MONGODB_URL=$(get_env MONGODB_URL)
EVENTBRITE_GUEST_COOKIE=$(get_env EVENTBRITE_GUEST_COOKIE)

if [ -z "$MONGODB_URL" ]; then
  echo "Error: MONGODB_URL not set in .env"
  exit 1
fi

echo "Setting secrets for worker-scraper..."
echo "$MONGODB_URL" | npx wrangler secret put MONGODB_URL --config workers/scraper/wrangler.toml

if [ -n "$EVENTBRITE_GUEST_COOKIE" ]; then
  echo "$EVENTBRITE_GUEST_COOKIE" | npx wrangler secret put EVENTBRITE_GUEST_COOKIE --config workers/scraper/wrangler.toml
else
  echo "Warning: EVENTBRITE_GUEST_COOKIE not set — Eventbrite scraping will be skipped until added."
fi

echo "Setting secrets for event-api..."
echo "$MONGODB_URL" | npx wrangler secret put MONGODB_URL --config workers/api/wrangler.toml

echo "All secrets set."
