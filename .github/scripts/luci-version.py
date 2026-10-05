#!/usr/bin/env python3
"""Keep LuCI package and translation versions aligned with the release."""

import argparse
import os
from pathlib import Path
import re


def replace_once(text, pattern, value):
    result, count = re.subn(pattern, lambda _: value, text, flags=re.MULTILINE)
    if count != 1:
        raise ValueError(f"Expected one version field matching {pattern}")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--release-tag", default="")
    source.add_argument("--version")
    parser.add_argument("--revision")
    args = parser.parse_args()

    root = Path("luci-app-tingreader")
    makefile = root / "Makefile"
    contents = makefile.read_text(encoding="utf-8")
    version = re.search(r"^PKG_VERSION:=(.+)$", contents, re.MULTILINE).group(1)
    revision = re.search(r"^PKG_RELEASE:=(.+)$", contents, re.MULTILINE).group(1)
    if args.release_tag:
        if not args.release_tag.startswith("luci-v"):
            raise ValueError("LuCI release tags must start with luci-v")
        version = args.release_tag.removeprefix("luci-v")
        tag_revision = re.fullmatch(r"(.+)-r([1-9][0-9]*)", version)
        if tag_revision:
            version, revision = tag_revision.groups()
        else:
            revision = "1"
    if args.version:
        if args.version != version:
            revision = "1"
        version = args.version
    if args.revision:
        revision = args.revision
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9]+([.-][A-Za-z0-9]+)*)?", version):
        raise ValueError("Invalid LuCI package version")
    if not re.fullmatch(r"[1-9][0-9]*", revision):
        raise ValueError("Invalid LuCI package revision")

    contents = replace_once(contents, r"^PKG_VERSION:=.+$", f"PKG_VERSION:={version}")
    contents = replace_once(contents, r"^PKG_RELEASE:=.+$", f"PKG_RELEASE:={revision}")
    updates = {makefile: contents}
    catalogs = [root / "po/templates/tingreader.pot", *root.glob("po/*/tingreader.po")]
    for path in catalogs:
        updates[path] = replace_once(
            path.read_text(encoding="utf-8"),
            r'^"Project-Id-Version: luci-app-tingreader [^"\\]+\\n"$',
            f'"Project-Id-Version: luci-app-tingreader {version}\\n"',
        )
    for path, text in updates.items():
        path.write_text(text, encoding="utf-8", newline="\n")

    if output := os.environ.get("GITHUB_OUTPUT"):
        with Path(output).open("a", encoding="utf-8") as stream:
            stream.write(f"version={version}\nrevision={revision}\n")
    print(f"LuCI package version: {version}-r{revision}")


if __name__ == "__main__":
    main()
