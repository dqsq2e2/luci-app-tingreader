#!/usr/bin/env bash
# update-version.sh <version>
#
# Updates version.mk with the specified ting-reader version and fetches the
# SHA-256 hashes of:
#   - The statically-linked backend binaries from THIS repository's Releases
#     (published by .github/workflows/build-backend.yml)
#   - The frontend archive from the upstream ting-reader repository
#
# Usage:
#   ./scripts/update-version.sh 1.6.0
#   ./scripts/update-version.sh latest        # resolves to the latest backend release

set -Eeuo pipefail

SELF_REPO="dqsq2e2/luci-app-tingreader"
UPSTREAM_REPO="dqsq2e2/ting-reader"
SCRIPT_DIR="$(cd "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
VERSION_FILE="$ROOT_DIR/version.mk"
REQUESTED_VERSION="${1:-latest}"
WORK_DIR="$(mktemp -d)"

cleanup() {
	rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

# ── Resolve version ─────────────────────────────────────────────────────────
if [[ "$REQUESTED_VERSION" == "latest" || -z "$REQUESTED_VERSION" ]]; then
	# Resolve from the latest upstream ting-reader release tag
	EFFECTIVE_URL="$(curl -fsSIL -o /dev/null -w '%{url_effective}' \
		"https://github.com/$UPSTREAM_REPO/releases/latest")"
	VERSION="${EFFECTIVE_URL##*/}"
else
	VERSION="$REQUESTED_VERSION"
fi

VERSION="${VERSION#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || {
	echo "Invalid ting-reader version: $VERSION" >&2
	exit 2
}

echo "Updating to ting-reader $VERSION..."

# ── Backend binaries (from this repo's Releases, built statically) ───────────
BACKEND_BASE_URL="https://github.com/$SELF_REPO/releases/download/backend-v$VERSION"
AMD64_FILE="ting-reader-backend-linux-amd64-$VERSION.tar.gz"
ARM64_FILE="ting-reader-backend-linux-arm64-$VERSION.tar.gz"

for file in "$AMD64_FILE" "$ARM64_FILE"; do
	echo "  Downloading $file..."
	curl -fL --retry 3 "$BACKEND_BASE_URL/$file" -o "$WORK_DIR/$file"
	tar -tzf "$WORK_DIR/$file" > /dev/null
done

# ── Frontend (from upstream ting-reader Releases) ───────────────────────────
FRONTEND_BASE_URL="https://github.com/$UPSTREAM_REPO/releases/download/v$VERSION"
FRONTEND_FILE="ting-reader-frontend-$VERSION.tar.gz"

echo "  Downloading $FRONTEND_FILE..."
curl -fL --retry 3 "$FRONTEND_BASE_URL/$FRONTEND_FILE" -o "$WORK_DIR/$FRONTEND_FILE"
tar -tzf "$WORK_DIR/$FRONTEND_FILE" > /dev/null

# ── Compute hashes ──────────────────────────────────────────────────────────
AMD64_HASH="$(sha256sum "$WORK_DIR/$AMD64_FILE"   | awk '{print $1}')"
ARM64_HASH="$(sha256sum "$WORK_DIR/$ARM64_FILE"   | awk '{print $1}')"
FRONTEND_HASH="$(sha256sum "$WORK_DIR/$FRONTEND_FILE" | awk '{print $1}')"

# ── Write version.mk ────────────────────────────────────────────────────────
cat > "$VERSION_FILE" <<EOF
# Backend binaries are built from source by .github/workflows/build-backend.yml
# and published to this repository's Releases as statically-linked binaries.
# Run scripts/update-version.sh <version> to update these values.
TINGREADER_VERSION:=$VERSION
TINGREADER_BACKEND_AMD64_HASH:=$AMD64_HASH
TINGREADER_BACKEND_ARM64_HASH:=$ARM64_HASH
TINGREADER_FRONTEND_HASH:=$FRONTEND_HASH
EOF

echo "Pinned ting-reader $VERSION in $VERSION_FILE"
