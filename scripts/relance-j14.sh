#!/usr/bin/env bash
# Relance J+14 (vague 2, segment A, non-cliqueurs) — exécutée de façon autonome
# par launchd (25-26/08 à 9h) ou à la main. Journalise tout dans scripts/logs/.
# Le script de campagne est sûr : cap journalier, marquage anti-doublon,
# idempotent (en cas d'échec, relancer reprend où il en était).
set -uo pipefail

REPO="/Users/cedric/Documents/coding/fluance-io"
export HOME="/Users/cedric"
LOG_DIR="$REPO/scripts/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/relance-j14-$(date +%Y%m%d-%H%M%S).log"
exec > "$LOG" 2>&1

echo "=== Relance J+14 — $(date '+%Y-%m-%d %H:%M:%S %Z') ==="

export MAILJET_API_KEY="$(/opt/homebrew/bin/firebase functions:secrets:access MAILJET_API_KEY --project fluance-protected-content 2>/dev/null | tr -d '\n')"
export MAILJET_API_SECRET="$(/opt/homebrew/bin/firebase functions:secrets:access MAILJET_API_SECRET --project fluance-protected-content 2>/dev/null | tr -d '\n')"
export REENGAGEMENT_SIGNING_SECRET="$(/opt/homebrew/bin/firebase functions:secrets:access REENGAGEMENT_SIGNING_SECRET --project fluance-protected-content 2>/dev/null | tr -d '\n')"

if [ -z "$MAILJET_API_KEY" ] || [ -z "$MAILJET_API_SECRET" ] || [ -z "$REENGAGEMENT_SIGNING_SECRET" ]; then
  echo "❌ Secrets Firebase indisponibles (session firebase CLI ?). Relance manuelle requise :"
  echo "   /opt/homebrew/bin/node $REPO/scripts/send-reengagement-campaign.js --wave=2 --days-after=14 --apply --daily-cap=150"
  exit 1
fi

cd "$REPO"
/opt/homebrew/bin/node scripts/send-reengagement-campaign.js --wave=2 --days-after=14 --apply --daily-cap=150

echo "=== Fin — $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
