#!/usr/bin/env bash
# cleanup-actions-storage.sh
#
# Deletes stale GitHub Actions caches and old workflow runs.
# Adapted from VIKINGYFY/packages Cleanup-CI-History pattern.
#
# Environment variables (all have sensible defaults):
#   CACHE_RETENTION_DAYS   – delete caches not accessed within N days  (default: 3)
#   CACHE_KEEP_PER_GROUP   – keep at most N recent caches per group    (default: 2)
#   RUN_RETENTION_DAYS     – delete runs older than N days             (default: 14)
#   RUN_KEEP_PER_WORKFLOW  – keep at most N recent runs per workflow   (default: 10)
#   DRY_RUN                – set to "true" to preview without deleting (default: false)

set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

CACHE_RETENTION_DAYS="${CACHE_RETENTION_DAYS:-3}"
CACHE_KEEP_PER_GROUP="${CACHE_KEEP_PER_GROUP:-2}"
RUN_RETENTION_DAYS="${RUN_RETENTION_DAYS:-14}"
RUN_KEEP_PER_WORKFLOW="${RUN_KEEP_PER_WORKFLOW:-10}"
DRY_RUN="${DRY_RUN:-false}"

require_positive_integer() {
	local name="$1" value="$2"
	[[ "$value" =~ ^[1-9][0-9]*$ ]] || {
		printf '%s must be a positive integer: %s\n' "$name" "$value" >&2
		exit 1
	}
}

require_positive_integer CACHE_RETENTION_DAYS "$CACHE_RETENTION_DAYS"
require_positive_integer CACHE_KEEP_PER_GROUP "$CACHE_KEEP_PER_GROUP"
require_positive_integer RUN_RETENTION_DAYS   "$RUN_RETENTION_DAYS"
require_positive_integer RUN_KEEP_PER_WORKFLOW "$RUN_KEEP_PER_WORKFLOW"

# ── Cache grouping ─────────────────────────────────────────────────────────
# Group caches by logical target so we can keep the N most-recent per target.
cache_group() {
	case "$1" in
		openwrt-sdk-*)
			# Example: openwrt-sdk-aarch64_cortex-a53-24.10.8
			printf '%s\n' "$1"
			;;
		tingreader-dl-*)
			# Example: tingreader-dl-aarch64_cortex-a53-1.6.0 -> group by arch
			# Strips the version suffix so different versions of the same arch are in one group
			local prefix="${1%-*}"
			printf '%s\n' "$prefix"
			;;
		rust-*)
			# Example: rust-aarch64-unknown-linux-musl-<hash> -> group by target
			local prefix="${1%-*}"
			printf '%s\n' "$prefix"
			;;
	esac
}

delete_cache() {
	local cache_id="$1" key="$2" reason="$3"
	printf 'Delete cache: %s (%s)\n' "$key" "$reason"
	[[ "$DRY_RUN" == true ]] || gh api --method DELETE \
		"repos/$GITHUB_REPOSITORY/actions/caches/$cache_id"
}

delete_run() {
	local run_id="$1" name="$2" created_at="$3"
	printf 'Delete run: %s  id=%s  created=%s\n' "$name" "$run_id" "$created_at"
	[[ "$DRY_RUN" == true ]] || gh api --method DELETE \
		"repos/$GITHUB_REPOSITORY/actions/runs/$run_id"
}

now="$(date -u +%s)"
cache_cutoff=$((now - CACHE_RETENTION_DAYS * 86400))
run_cutoff=$((now - RUN_RETENTION_DAYS * 86400))
temp_dir="$(mktemp -d)"
trap 'rm -rf -- "$temp_dir"' EXIT INT TERM

# ── Clean caches ───────────────────────────────────────────────────────────
gh api --paginate \
	"repos/$GITHUB_REPOSITORY/actions/caches?per_page=100" \
	--jq '.actions_caches[] | [.id, .key, .ref, .last_accessed_at, .created_at, .size_in_bytes] | @tsv' \
	> "$temp_dir/caches.tsv"
LC_ALL=C sort -t $'\t' -k4,4r "$temp_dir/caches.tsv" > "$temp_dir/caches-sorted.tsv"

declare -A cache_group_counts=()
deleted_cache_count=0
deleted_cache_bytes=0
while IFS=$'\t' read -r cache_id key _ last_accessed created_at size; do
	[[ -n "$cache_id" ]] || continue
	[[ -n "$last_accessed" ]] || last_accessed="$created_at"
	last_accessed_epoch="$(date -u -d "$last_accessed" +%s)"
	group="$(cache_group "$key")"
	reason=''

	if [[ -n "$group" ]]; then
		count=$(( ${cache_group_counts[$group]:-0} + 1 ))
		cache_group_counts["$group"]="$count"
		if (( count > CACHE_KEEP_PER_GROUP )); then
			reason="exceeds per-group limit of ${CACHE_KEEP_PER_GROUP}"
		fi
	fi
	if (( last_accessed_epoch < cache_cutoff )); then
		reason="unused for more than ${CACHE_RETENTION_DAYS} days"
	fi

	[[ -n "$reason" ]] || continue
	delete_cache "$cache_id" "$key" "$reason"
	deleted_cache_count=$((deleted_cache_count + 1))
	deleted_cache_bytes=$((deleted_cache_bytes + size))
done < "$temp_dir/caches-sorted.tsv"

# ── Clean workflow runs ────────────────────────────────────────────────────
gh api --paginate \
	"repos/$GITHUB_REPOSITORY/actions/runs?status=completed&per_page=100" \
	--jq '.workflow_runs[] | [.id, .workflow_id, .name, .conclusion, .created_at] | @tsv' \
	> "$temp_dir/runs.tsv"
LC_ALL=C sort -t $'\t' -k5,5r "$temp_dir/runs.tsv" > "$temp_dir/runs-sorted.tsv"

declare -A workflow_success_counts=()
deleted_run_count=0
while IFS=$'\t' read -r run_id workflow_id name conclusion created_at; do
	[[ -n "$run_id" ]] || continue

	# Delete any failed or cancelled runs immediately
	if [[ "$conclusion" != "success" ]]; then
		delete_run "$run_id" "$name" "$created_at (conclusion: $conclusion)"
		deleted_run_count=$((deleted_run_count + 1))
		continue
	fi

	# For successful runs, keep at most RUN_KEEP_PER_WORKFLOW
	count=$(( ${workflow_success_counts[$workflow_id]:-0} + 1 ))
	workflow_success_counts["$workflow_id"]="$count"
	if (( count > RUN_KEEP_PER_WORKFLOW )); then
		delete_run "$run_id" "$name" "$created_at (exceeds keep limit of $RUN_KEEP_PER_WORKFLOW)"
		deleted_run_count=$((deleted_run_count + 1))
	fi
done < "$temp_dir/runs-sorted.tsv"

# ── Summary ────────────────────────────────────────────────────────────────
mode='executed'
[[ "$DRY_RUN" == false ]] || mode='dry-run'
printf '%s: caches deleted=%d (~%d bytes)  runs deleted=%d\n' \
	"$mode" "$deleted_cache_count" "$deleted_cache_bytes" "$deleted_run_count"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
	{
		printf '### CI Cleanup Results (%s)\n\n' "$mode"
		printf -- '- Caches deleted: %d\n' "$deleted_cache_count"
		printf -- '- Space freed: ~%d bytes\n' "$deleted_cache_bytes"
		printf -- '- Runs deleted: %d\n' "$deleted_run_count"
	} >> "$GITHUB_STEP_SUMMARY"
fi
