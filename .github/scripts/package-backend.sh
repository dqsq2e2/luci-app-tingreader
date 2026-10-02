#!/usr/bin/env bash
set -Eeuo pipefail

: "${VERSION:?}" "${APP_ARCH:?}" "${GITHUB_WORKSPACE:?}"
FFMPEG_VERSION=8.1.2-2
TING_PLUGIN_STORE_VERSION=2.0.2
case "$APP_ARCH" in
  amd64)
    ffmpeg_arch=x86_64
    ffmpeg_sha=58246304b840d40f600e7a03673695061d51ee864b11b35dbaa0983aa6506bc6
    loader=ld-linux-x86-64.so.2
    ;;
  arm64)
    ffmpeg_arch=arm64
    ffmpeg_sha=c12dca8818065a1ad04023eecec3d2d44542b9c1095f13eb9b028fd224ac3d28
    loader=ld-linux-aarch64.so.1
    ;;
  *) exit 2 ;;
esac

binary="$(find target/release -maxdepth 1 -type f \( -name ting_reader -o -name ting-reader \) -print -quit)"
test -n "$binary"
mkdir -p _pkg/{bin,runtime/bin,preinstalled-plugins}
cp "$binary" _pkg/ting-reader
cp config.toml _pkg/config.toml
curl -fL --retry 3 \
  "https://github.com/dqsq2e2/ting-reader-plugin-store/releases/download/v${TING_PLUGIN_STORE_VERSION}/ting-reader-plugin-store-${TING_PLUGIN_STORE_VERSION}.tr" \
  -o _pkg/preinstalled-plugins/ting-reader-plugin-store.tr

ffmpeg_file="ffmpeg-${FFMPEG_VERSION%-*}-audio-encode-${ffmpeg_arch}-linux-gnu.tar.gz"
curl -fL --retry 3 \
  "https://github.com/dqsq2e2/ffmpeg-build/releases/download/v${FFMPEG_VERSION}/${ffmpeg_file}" -o ffmpeg.tar.gz
echo "$ffmpeg_sha  ffmpeg.tar.gz" | sha256sum -c -
mkdir -p _ffmpeg
tar -xzf ffmpeg.tar.gz -C _ffmpeg
for tool in ffmpeg ffprobe; do
  source="$(find _ffmpeg -type f -path "*/bin/$tool" -print -quit)"
  test -n "$source"
  cp "$source" "_pkg/bin/$tool"
done
chmod 755 _pkg/ting-reader _pkg/bin/*

# Collect the complete shared-library set, including the matching glibc loader.
for executable in _pkg/ting-reader _pkg/bin/ffmpeg _pkg/bin/ffprobe; do
  dependencies="$(ldd "$executable")"
  if grep -q 'not found' <<< "$dependencies"; then
    printf '%s\n' "$dependencies" >&2
    exit 1
  fi
  while IFS= read -r library; do
    test -f "$library"
    cp -L "$library" _pkg/runtime/
  done < <(awk '{ for (i=1; i<=NF; i++) if ($i ~ /^\//) print $i }' <<< "$dependencies" | sort -u)
done
test -x "_pkg/runtime/$loader"

# Explicit glibc launch makes current_exe point to the loader on OpenWrt.
# Relative launchers keep the application's bundled audio-tool lookup valid.
for tool in ffmpeg ffprobe; do
  cat > "_pkg/runtime/bin/$tool" <<'SH'
#!/bin/sh
runtime="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)" || exit 1
program="$(dirname "$runtime")"
case "$(uname -m)" in
  x86_64) loader=ld-linux-x86-64.so.2 ;;
  aarch64|arm64) loader=ld-linux-aarch64.so.1 ;;
  *) exit 1 ;;
esac
exec "$runtime/$loader" --library-path "$runtime" "$program/bin/${0##*/}" "$@"
SH
  chmod 755 "_pkg/runtime/bin/$tool"
  "_pkg/runtime/bin/$tool" -version
done
"_pkg/runtime/$loader" --library-path "$PWD/_pkg/runtime" --list "$PWD/_pkg/ting-reader"
printf '%s\n' "$VERSION" > _pkg/version
tar -czf "$GITHUB_WORKSPACE/ting-reader-backend-linux-${APP_ARCH}-${VERSION}.tar.gz" -C _pkg .
