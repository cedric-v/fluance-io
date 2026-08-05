#!/usr/bin/env bash
# Hook pre-commit : bloque la présence de données personnelles (PII) dans les
# fichiers stagés — principalement des emails qui ne sont ni internes ni des
# exemples. Voir PROTECTION_DONNEES_PERSONNELLES.md.
#
# ⚠️ Un email réel (hors allowlist) dans un fichier est présumé être une donnée
# personnelle : le commit est bloqué. Corrigez/retirez la valeur, ne la forcez pas.

set -u

# Domaine/emails internes et exemples autorisés
ALLOWED_PATTERNS=(
  '@fluance\.io'
  '@actu\.fluance\.io'
  '@example\.(com|org|net)'
  'votre-email'
  'votre@email\.com'
  '@votre-domaine'
  'user@example'
)

EMAIL_REGEX='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'

build_allow_regex() {
  local joined=""
  for p in "${ALLOWED_PATTERNS[@]}"; do
    joined="${joined:+$joined|}$p"
  done
  echo "$joined"
}

ALLOW_RE="$(build_allow_regex)"

files="$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null)"
if [ -z "$files" ]; then
  exit 0
fi

errors=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ -f "$f" ] || continue

  # 1) Noms de fichiers suspects (indices de PII : "client-<nom>", "<prenom>-access", etc.)
  if echo "$f" | grep -qiE '(fix|support|incident|acces|access)[-_][a-z]+[-_](access|pinto|carla)|[-_](carla|pinto)[-_]'; then
    echo "❌ PII potentielle dans le NOM DE FICHIER : $f"
    echo "   → Renommez en un nom générique (ex: scripts/fix-user-access.js)."
    errors=1
  fi

  # 2) Emails présents dans le contenu
  emails="$(grep -oE "$EMAIL_REGEX" "$f" 2>/dev/null | sort -u)"
  if [ -n "$emails" ]; then
    while IFS= read -r e; do
      [ -z "$e" ] && continue
      if ! echo "$e" | grep -qiE "$ALLOW_RE"; then
        echo "❌ Email personnel potentiel dans $f : $e"
        echo "   → Remplacez par un exemple (user@example.com) ou une variable d'environnement."
        errors=1
      fi
    done <<< "$emails"
  fi
done <<< "$files"

if [ "$errors" -ne 0 ]; then
  echo ""
  echo "⛔ Commit bloqué : données personnelles détectées. Voir PROTECTION_DONNEES_PERSONNELLES.md"
  exit 1
fi

exit 0
