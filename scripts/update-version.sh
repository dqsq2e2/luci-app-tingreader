#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY="dqsq2e2/ting-reader"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="$ROOT_DIR/version.mk"
REQUESTED_VERSION="${1:-latest}"
WORK_DIR="$(mktemp -d)"

cleanup() {
	rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

if [[ "$REQUESTED_VERSION" == "latest" || -z "$REQUESTED_VERSION" ]]; then
	EFFECTIVE_URL="$(curl -fsSIL -o /dev/null -w '%{url_effective}' \
		"https://github.com/$REPOSITORY/releases/latest")"
	VERSION="${EFFECTIVE_URL##*/}"
else
	VERSION="$REQUESTED_VERSION"
fi

VERSION="${VERSION#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || {
	echo "Invalid Ting Reader version: $VERSION" >&2
	exit 2
}

BASE_URL="https://github.com/$REPOSITORY/releases/download/v$VERSION"
AMD64_FILE="ting-reader-backend-linux-amd64-$VERSION.tar.gz"
ARM64_FILE="ting-reader-backend-linux-arm64-$VERSION.tar.gz"
FRONTEND_FILE="ting-reader-frontend-$VERSION.tar.gz"

for file in "$AMD64_FILE" "$ARM64_FILE" "$FRONTEND_FILE"; do
	curl -fL --retry 3 "$BASE_URL/$file" -o "$WORK_DIR/$file"
	tar -tzf "$WORK_DIR/$file" >/dev/null
done

AMD64_HASH="$(sha256sum "$WORK_DIR/$AMD64_FILE" | awk '{print $1}')"
ARM64_HASH="$(sha256sum "$WORK_DIR/$ARM64_FILE" | awk '{print $1}')"
FRONTEND_HASH="$(sha256sum "$WORK_DIR/$FRONTEND_FILE" | awk '{print $1}')"

cat > "$VERSION_FILE" <<EOF
TINGREADER_VERSION:=$VERSION
TINGREADER_BACKEND_AMD64_HASH:=$AMD64_HASH
TINGREADER_BACKEND_ARM64_HASH:=$ARM64_HASH
TINGREADER_FRONTEND_HASH:=$FRONTEND_HASH
EOF

echo "Pinned Ting Reader $VERSION in $VERSION_FILE"
