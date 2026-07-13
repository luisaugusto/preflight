#!/usr/bin/env bash
#
# check-expo-public-secrets.sh
#
# Targeted guard for this repo's documented footgun: a secret assigned to an
# EXPO_PUBLIC_* variable. Expo inlines every EXPO_PUBLIC_* value into the client
# bundle at build time, so a token placed there ships to every device and can be
# read straight out of the shipped IPA. The README's "Sanity Studio" section
# spells this out ("Never expose that token through an EXPO_PUBLIC_ variable").
#
# This is a fast, dependency-free complement to the gitleaks scan. It runs in CI
# and can be run locally at any time:
#
#   scripts/ci/check-expo-public-secrets.sh            # scan tracked files
#   scripts/ci/check-expo-public-secrets.sh --selftest # prove the rules fire
#
# Exit status: 0 when clean, 1 when a violation (or a failed self-test) is found.

set -euo pipefail

# Pattern 1: an EXPO_PUBLIC_* variable whose NAME implies a secret
# (TOKEN/SECRET/KEY/PASSWORD/AUTH/CREDENTIAL/PRIVATE) assigned a non-empty value
# of 6+ non-space characters. Catches e.g. EXPO_PUBLIC_SANITY_AUTH_TOKEN=...
readonly SECRET_VAR_RE='EXPO_PUBLIC_[A-Za-z0-9_]*(TOKEN|SECRET|KEY|PASSWORD|PASSWD|AUTH|CREDENTIAL|PRIVATE)[A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*[^[:space:]#]{6,}'

# Pattern 2: any EXPO_PUBLIC_* variable whose value starts with a Sanity-style
# sk token, regardless of the variable name. Catches e.g. EXPO_PUBLIC_FOO=sk...
readonly SANITY_TOKEN_RE='EXPO_PUBLIC_[A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*["'\'']?sk(_(test|live|prod))?[-_]?[A-Za-z0-9]{10,}'

# The scanner's own config/workflow/docs contain the pattern text itself, so
# exclude them from the tree scan to avoid matching rule definitions.
readonly EXCLUDE_RE='^(scripts/ci/check-expo-public-secrets\.sh|\.gitleaks\.toml|\.github/workflows/secret-scan\.yml)$'

# Returns 0 if the given line matches either rule.
line_matches() {
  printf '%s' "$1" | grep -qEi -e "$SECRET_VAR_RE" -e "$SANITY_TOKEN_RE"
}

selftest() {
  local -a should_fire=(
    'EXPO_PUBLIC_SANITY_AUTH_TOKEN=sk_test_51H8xAbCdEfGhIjKlMnOpQrStUv'
    'EXPO_PUBLIC_API_SECRET="s3cr3t-value-goes-right-here"'
    'EXPO_PUBLIC_FOO=skLiveABCDEFGH1234567890'
    '  EXPO_PUBLIC_SESSION_PASSWORD: hunter2hunter2'
  )
  local -a should_pass=(
    'EXPO_PUBLIC_SANITY_PROJECT_ID=4qoowg94'
    'EXPO_PUBLIC_SANITY_DATASET=production'
    'EXPO_PUBLIC_CONTENT_MANIFEST_URL='
    'SANITY_AUTH_TOKEN=sk_test_serverSideTokenIsFine'
    'const token = process.env.SANITY_AUTH_TOKEN'
    '# Never prefix this token with EXPO_PUBLIC_.'
  )

  local failures=0 line
  for line in "${should_fire[@]}"; do
    if line_matches "$line"; then
      printf '  ok   (caught)   %s\n' "$line"
    else
      printf '  FAIL (missed)  %s\n' "$line"
      failures=$((failures + 1))
    fi
  done
  for line in "${should_pass[@]}"; do
    if line_matches "$line"; then
      printf '  FAIL (false +) %s\n' "$line"
      failures=$((failures + 1))
    else
      printf '  ok   (ignored) %s\n' "$line"
    fi
  done

  if [[ "$failures" -ne 0 ]]; then
    printf '\nSelf-test failed: %d case(s) behaved unexpectedly.\n' "$failures" >&2
    return 1
  fi
  printf '\nSelf-test passed: all cases behaved as expected.\n'
}

scan_tree() {
  cd "$(git rev-parse --show-toplevel)"

  # Scan tracked text files only (never node_modules or build output). grep -I
  # skips binary files. Capture output and decide on emptiness so xargs/grep
  # exit codes cannot mask a finding.
  local hits
  hits="$(
    git ls-files -z \
      | grep -zvE "$EXCLUDE_RE" \
      | xargs -0 -r grep -InEi -e "$SECRET_VAR_RE" -e "$SANITY_TOKEN_RE" -- 2>/dev/null \
      || true
  )"

  if [[ -n "$hits" ]]; then
    echo "❌ Secret assigned to an EXPO_PUBLIC_* variable — this would ship in the client bundle:" >&2
    echo >&2
    printf '%s\n' "$hits" >&2
    echo >&2
    echo "EXPO_PUBLIC_* values are inlined into the app binary by Expo and are readable by anyone" >&2
    echo "with the IPA. Move the secret to a non-public, server-side variable (e.g. SANITY_AUTH_TOKEN)" >&2
    echo "and rotate it in Sanity if it was ever committed. If this is a genuine public value, rename" >&2
    echo "the variable so it does not read as a secret." >&2
    return 1
  fi

  echo "✅ No secrets assigned to EXPO_PUBLIC_* variables."
}

main() {
  case "${1:-}" in
    --selftest) selftest ;;
    "") scan_tree ;;
    *)
      echo "usage: $0 [--selftest]" >&2
      return 2
      ;;
  esac
}

main "$@"
