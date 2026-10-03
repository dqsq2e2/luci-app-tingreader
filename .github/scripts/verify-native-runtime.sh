#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_ARCH:?}" "${RUNNER_TEMP:?}"
case "$APP_ARCH" in
  amd64) loader=ld-linux-x86-64.so.2 ;;
  arm64) loader=ld-linux-aarch64.so.1 ;;
  *) exit 2 ;;
esac

check_dir="$(mktemp -d "$RUNNER_TEMP/tingreader-native-runtime.XXXXXX")"
# Force the legacy dependencies used by older native plugin toolchains, even
# though this runner's glibc exports their functions directly from libc.
cat > "$check_dir/plugin.c" <<'C'
#include <dlfcn.h>
#include <pthread.h>

static void *worker(void *value) {
  return value;
}

int tingreader_runtime_probe(void) {
  pthread_t thread;
  if (pthread_create(&thread, NULL, worker, NULL) != 0) {
    return 1;
  }
  if (pthread_join(thread, NULL) != 0) {
    return 1;
  }
  void *self = dlopen(NULL, RTLD_NOW | RTLD_LOCAL);
  if (self == NULL) {
    return 1;
  }
  return dlclose(self) == 0 ? 0 : 1;
}
C
gcc -std=c11 -Wall -Wextra -Werror -O2 -shared -fPIC \
  "$check_dir/plugin.c" -Wl,--no-as-needed -l:libpthread.so.0 -l:libdl.so.2 \
  -l:librt.so.1 -l:libutil.so.1 -l:libanl.so.1 \
  -o "$check_dir/plugin.so"

cat > "$check_dir/load-plugin.c" <<'C'
#include <dlfcn.h>
#include <stdio.h>

int main(int argc, char **argv) {
  if (argc != 2) {
    return 2;
  }
  void *library = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
  if (library == NULL) {
    fprintf(stderr, "Native plugin load failed: %s\n", dlerror());
    return 1;
  }
  dlerror();
  int (*probe)(void) = (int (*)(void))dlsym(library, "tingreader_runtime_probe");
  const char *error = dlerror();
  if (error != NULL || probe == NULL) {
    fprintf(stderr, "Native plugin probe missing: %s\n",
            error != NULL ? error : "null entry");
    dlclose(library);
    return 1;
  }
  if (probe() != 0) {
    fputs("Native plugin threading or dynamic loading failed\n", stderr);
    dlclose(library);
    return 1;
  }
  puts("Native plugin loaded and executed with only the bundled runtime");
  return dlclose(library) == 0 ? 0 : 1;
}
C
mkdir "$check_dir/root"
cp -a _pkg/runtime "$check_dir/root/runtime"
cp "$check_dir/plugin.so" "$check_dir/root/plugin.so"
gcc -std=c11 -Wall -Wextra -Werror -O2 "$check_dir/load-plugin.c" \
  -ldl -o "$check_dir/root/load-plugin"
# The empty root has no host /lib, /usr/lib or ld.so.cache to mask missing
# dependencies. This runs natively on each architecture's build runner.
sudo chroot "$check_dir/root" "/runtime/$loader" --inhibit-cache \
  --library-path /runtime /load-plugin /plugin.so
