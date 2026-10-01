#!/usr/bin/env python3
"""Generate the installer manifest from the exact Release archives."""

import hashlib
import json
import os
import pathlib
import re
import tarfile

version = os.environ["VERSION"]
if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9]+([.-][A-Za-z0-9]+)*)?", version):
    raise ValueError("Invalid Release version")
dist = pathlib.Path("dist")


def describe(name):
    path = dist / name
    with tarfile.open(path, "r:gz") as archive:
        members = archive.getmembers()
        for member in members:
            parts = pathlib.PurePosixPath(member.name).parts
            if member.name.startswith("/") or ".." in parts or not (member.isfile() or member.isdir()):
                raise ValueError(f"Unsafe archive member: {member.name}")
        unpacked = sum(member.size for member in members)
    with path.open("rb") as source:
        sha = hashlib.file_digest(source, "sha256").hexdigest()
    return {"file": name, "sha256": sha, "size": path.stat().st_size, "unpacked_size": unpacked}


manifest = {
    "schema": 1,
    "version": version,
    "backend": {
        arch: describe(f"ting-reader-backend-linux-{arch}-{version}.tar.gz")
        for arch in ("amd64", "arm64")
    },
    "frontend": describe(f"ting-reader-frontend-{version}.tar.gz"),
}
text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
(dist / "manifest.json").write_text(text, encoding="utf-8")
(dist / "latest.json").write_text(text, encoding="utf-8")
(dist / "SHA256SUMS").write_text(
    "".join(f"{item['sha256']}  {item['file']}\n" for item in [*manifest["backend"].values(), manifest["frontend"]]),
    encoding="utf-8",
)
