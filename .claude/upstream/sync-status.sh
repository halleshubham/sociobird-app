#!/usr/bin/env bash
# Tracks which Postiz upstream changes SocioBird has decided on. See README.md in this folder.
# Usage: sync-status.sh [fetch|status|report|conflicts|divergences|inventory|verify|record|advance|check]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DIR="${UPSTREAM_DIR:-.claude/upstream}"
BASELINE="$DIR/baseline.env"
LEDGER="$DIR/ledger.tsv"
# shellcheck disable=SC1090
source "$BASELINE"
TRIAGED_THROUGH="${TRIAGED_OVERRIDE:-$TRIAGED_THROUGH}"   # override is for testing only
REF="${UPSTREAM_REF:-$UPSTREAM_REMOTE/$UPSTREAM_BRANCH}"
VALID_STATUS="adopted modified skipped deferred baseline"

die() { echo "error: $*" >&2; exit 1; }

need_ref() {
  git rev-parse --verify -q "$REF^{commit}" >/dev/null ||
    die "$REF not found. Run: $0 fetch"
  git merge-base --is-ancestor "$TRIAGED_THROUGH" "$REF" ||
    die "TRIAGED_THROUGH is not an ancestor of $REF (upstream history rewritten?)"
}

# Stable identity for an upstream change that does not depend on our history: PR number if the
# subject has one (merge commits and squash commits both do), else the short sha.
key_of() {
  local pr
  pr=$(printf '%s' "$1" | grep -oE '#[0-9]+' | head -1 | tr -d '#' || true)
  if [ -n "$pr" ]; then echo "PR#$pr"; else echo "sha:${2:0:8}"; fi
}

is_noise() { case "$1" in "Merge branch"*|"Merge remote-tracking"*) return 0;; esac; return 1; }

ledger_status() { awk -F'\t' -v k="$1" 'NR>1 && $1==k {print $4; exit}' "$LEDGER"; }

# prints: sha<TAB>key<TAB>subject for each first-parent upstream change in $1..$2, oldest first
upstream_changes() {
  git log --first-parent --reverse --format='%H%x09%s' "$1..$2" | while IFS=$'\t' read -r sha subj; do
    is_noise "$subj" && continue
    printf '%s\t%s\t%s\n' "$sha" "$(key_of "$subj" "$sha")" "$subj"
  done
}

cmd_fetch() {
  git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1 || git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_REPO"
  git fetch "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"
}

cmd_status() {
  need_ref
  echo "Baseline (last full merge): ${BASE_SHA:0:8}  $BASE_DATE  $BASE_SUBJECT"
  echo "Triaged through:            ${TRIAGED_THROUGH:0:8}"
  echo "Upstream tip ($REF):        $(git rev-parse --short=8 "$REF")  $(git log -1 --format='%ad' --date=short "$REF")"
  echo
  local n_new=0 n_done=0
  printf '%-14s %-10s %s\n' KEY STATUS SUBJECT
  while IFS=$'\t' read -r sha key subj; do
    st=$(ledger_status "$key")
    if [ -z "$st" ]; then st="UNTRIAGED"; n_new=$((n_new+1)); else n_done=$((n_done+1)); fi
    printf '%-14s %-10s %s\n' "$key" "$st" "${subj:0:90}"
  done < <(upstream_changes "$TRIAGED_THROUGH" "$REF")
  echo
  echo "$n_new untriaged, $n_done already decided, in range ${TRIAGED_THROUGH:0:8}..$(git rev-parse --short=8 "$REF")"
}

cmd_report() {
  echo "Decisions recorded in $LEDGER"
  awk -F'\t' 'NR>1 {c[$4]++} END {for (s in c) printf "  %-9s %d\n", s, c[s]}' "$LEDGER" | sort
  echo
  awk -F'\t' 'NR>1 {printf "%-22s %-9s %-10s %s\n", $1, $4, $6, substr($3,1,70)}' "$LEDGER"
}

# Files upstream changed since TRIAGED_THROUGH that we also changed since BASE_SHA: likely conflicts.
cmd_conflicts() {
  need_ref
  comm -12 \
    <(git diff --name-only "$TRIAGED_THROUGH" "$REF" | sort) \
    <(git diff --name-only "$BASE_SHA" HEAD | sort)
}

cmd_divergences() {
  git rev-parse --verify -q "$BASE_SHA^{commit}" >/dev/null || die "baseline commit $BASE_SHA is not in this clone"
  for s in A M D; do
    printf '%s: %s files\n' "$s" "$(git diff --name-status "$BASE_SHA" HEAD | awk -v s="$s" '$1==s' | wc -l)"
  done
  echo
  git diff --name-status "$BASE_SHA" HEAD | grep -v 'translation/locales/\|pnpm-lock.yaml' | sort -k2
}

cmd_record() {
  [ $# -ge 3 ] || die "usage: record <key> <status> <title> [our_ref] [notes]"
  local key="$1" status="$2" title="$3" our="${4:-}" notes="${5:-}"
  case " $VALID_STATUS " in *" $status "*) ;; *) die "status must be one of: $VALID_STATUS";; esac
  [ -z "$(ledger_status "$key")" ] || die "$key is already in the ledger; edit the row by hand if the decision changed"
  clean() { printf '%s' "$1" | tr '\t\n' '  '; }
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(clean "$key")" "change" "$(clean "$title")" "$status" "$(clean "$our")" "$(date +%F)" "$(clean "$notes")" >> "$LEDGER"
  echo "recorded $key as $status"
}

cmd_advance() {
  [ $# -eq 1 ] || die "usage: advance <upstream-sha>"
  need_ref
  local target; target=$(git rev-parse --verify "$1^{commit}")
  git merge-base --is-ancestor "$TRIAGED_THROUGH" "$target" || die "$1 is behind TRIAGED_THROUGH"
  git merge-base --is-ancestor "$target" "$REF" || die "$1 is not on $REF"
  local missing=0
  while IFS=$'\t' read -r sha key subj; do
    if [ -z "$(ledger_status "$key")" ]; then echo "no decision for $key  $subj"; missing=$((missing+1)); fi
  done < <(upstream_changes "$TRIAGED_THROUGH" "$target")
  [ "$missing" -eq 0 ] || die "$missing change(s) between TRIAGED_THROUGH and $1 have no ledger row; record them first"
  sed -i "s/^TRIAGED_THROUGH=.*/TRIAGED_THROUGH=$target/" "$BASELINE"
  echo "TRIAGED_THROUGH is now ${target:0:8}"
}

cmd_check() {
  awk -F'\t' -v valid=" $VALID_STATUS " '
    NR==1 { next }
    NF!=7 { printf "line %d: %d columns, expected 7\n", NR, NF; bad=1; next }
    index(valid, " " $4 " ")==0 { printf "line %d: bad status \"%s\"\n", NR, $4; bad=1 }
    seen[$1]++ { printf "line %d: duplicate key %s\n", NR, $1; bad=1 }
    END { if (!bad) print "ledger ok"; exit bad }' "$LEDGER"
}

case "${1:-status}" in
  fetch) cmd_fetch ;;
  status) cmd_status ;;
  report) cmd_report ;;
  conflicts) cmd_conflicts ;;
  divergences) cmd_divergences ;;
  inventory) shift; python3 "$DIR/features.py" inventory "$@" ;;
  verify) python3 "$DIR/features.py" verify ;;
  record) shift; cmd_record "$@" ;;
  advance) shift; cmd_advance "$@" ;;
  check) cmd_check ;;
  *) sed -n '2,3p' "$0"; exit 1 ;;
esac
