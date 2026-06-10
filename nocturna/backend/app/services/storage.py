"""Pluggable photo storage backend.

Selection is controlled by the env var `NOCTURNA_STORAGE_BACKEND`:

  - `local` (default) — writes to `./uploads/` on disk. FastAPI serves it
    at `/uploads/...`. Fine for development and single-instance deploys.
  - `gcs` — writes to a Google Cloud Storage bucket. Object becomes
    publicly readable; the returned URL is the GCS HTTPS path.

Both backends accept the same `save(filename_hint, content, mime_type) -> url`
and `delete(url) -> bool` interface so the upload endpoint never has to
care which one is wired.
"""
from __future__ import annotations

import logging
import mimetypes
import os
import re
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

log = logging.getLogger("nocturna.storage")


# Public size + mime limits used by the upload endpoint.
MAX_BYTES = int(os.getenv("NOCTURNA_UPLOAD_MAX_BYTES", str(5 * 1024 * 1024)))  # 5 MB
ALLOWED_MIME_PREFIXES = ("image/",)


def is_allowed_mime(mime: Optional[str]) -> bool:
    if not mime:
        return False
    return any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES)


def is_within_size(size: int) -> bool:
    return 0 < size <= MAX_BYTES


def _ext_from(filename_hint: str, mime_type: str) -> str:
    """Pick a clean extension. Falls back to mimetypes guess, then `.bin`."""
    suffix = Path(filename_hint).suffix.lower()
    if suffix and re.match(r"\.[a-z0-9]{2,5}$", suffix):
        return suffix
    guess = mimetypes.guess_extension(mime_type or "") or ""
    if guess:
        # Normalise quirky jpe → jpg.
        return ".jpg" if guess == ".jpe" else guess
    return ".bin"


class Storage(ABC):
    @abstractmethod
    def save(self, *, namespace: str, filename_hint: str, content: bytes, mime_type: str) -> str:
        """Persist `content`, return a URL the frontend can render."""

    @abstractmethod
    def delete(self, url: str) -> bool:
        """Best-effort delete. Returns True if removed (or it was already gone)."""


# Local-disk backend ---------------------------------------------------------


class LocalStorage(Storage):
    """Disk-backed storage under `./uploads/`.

    The FastAPI app should mount the same directory as `/uploads/*` so the
    URLs we return resolve. See `app/main.py`.
    """

    def __init__(self, root: Optional[Path] = None, url_prefix: str = "/uploads"):
        self.root = Path(root or os.getenv("NOCTURNA_UPLOAD_DIR", "./uploads")).resolve()
        self.url_prefix = url_prefix.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, *, namespace: str, filename_hint: str, content: bytes, mime_type: str) -> str:
        ns = re.sub(r"[^a-z0-9_-]+", "-", namespace.lower()).strip("-") or "misc"
        ext = _ext_from(filename_hint, mime_type)
        name = f"{uuid.uuid4().hex}{ext}"
        target_dir = self.root / ns
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / name
        target_path.write_bytes(content)
        return f"{self.url_prefix}/{ns}/{name}"

    def delete(self, url: str) -> bool:
        if not url.startswith(self.url_prefix + "/"):
            return False
        rel = url[len(self.url_prefix) + 1:]
        # Defensive: refuse anything that would escape the upload root.
        if ".." in rel.split("/"):
            log.warning("storage.delete refused path-traversal candidate: %s", url)
            return False
        target = (self.root / rel).resolve()
        try:
            target.relative_to(self.root)
        except ValueError:
            log.warning("storage.delete refused out-of-root path: %s", url)
            return False
        if target.exists():
            target.unlink()
            return True
        return True  # already gone — treat as success


# GCS backend ----------------------------------------------------------------


class GCSStorage(Storage):
    """Google Cloud Storage backend. Objects are made public-read."""

    def __init__(self, bucket: Optional[str] = None, prefix: str = "venues"):
        try:
            from google.cloud import storage as gcs  # type: ignore
        except ImportError as e:  # pragma: no cover — only when gcs extra missing
            raise RuntimeError("google-cloud-storage not installed; pip install google-cloud-storage") from e
        self._gcs = gcs
        self.bucket_name = bucket or os.getenv("NOCTURNA_GCS_BUCKET")
        if not self.bucket_name:
            raise RuntimeError("NOCTURNA_GCS_BUCKET not set")
        self.prefix = prefix.strip("/")
        self._client = gcs.Client()

    def _bucket(self):
        return self._client.bucket(self.bucket_name)

    def save(self, *, namespace: str, filename_hint: str, content: bytes, mime_type: str) -> str:
        ns = re.sub(r"[^a-z0-9_-]+", "-", namespace.lower()).strip("-") or "misc"
        ext = _ext_from(filename_hint, mime_type)
        key = f"{self.prefix}/{ns}/{uuid.uuid4().hex}{ext}"
        blob = self._bucket().blob(key)
        blob.upload_from_string(content, content_type=mime_type)
        try:
            blob.make_public()
        except Exception as e:  # pragma: no cover
            log.warning("could not make %s public: %s", key, e)
        return f"https://storage.googleapis.com/{self.bucket_name}/{key}"

    def delete(self, url: str) -> bool:
        # Only delete things that look like our own URL — never blindly trust user input.
        parsed = urlparse(url)
        expected_prefix = f"/{self.bucket_name}/"
        if not parsed.path.startswith(expected_prefix):
            log.warning("storage.delete refused foreign URL: %s", url)
            return False
        key = parsed.path[len(expected_prefix):]
        try:
            self._bucket().blob(key).delete()
            return True
        except Exception as e:
            log.warning("gcs delete failed (treating as no-op): %s", e)
            return False


# Backend selection ----------------------------------------------------------


_backend: Optional[Storage] = None


def get_backend() -> Storage:
    """Singleton accessor. Reads NOCTURNA_STORAGE_BACKEND lazily."""
    global _backend
    if _backend is None:
        name = (os.getenv("NOCTURNA_STORAGE_BACKEND") or "local").lower()
        if name == "gcs":
            _backend = GCSStorage()
        else:
            _backend = LocalStorage()
        log.info("storage backend: %s", type(_backend).__name__)
    return _backend


def reset_backend_for_tests() -> None:
    """Drop the cached backend — only used by pytest fixtures."""
    global _backend
    _backend = None
