"""Admin endpoints for venue photo upload + delete.

Photos are stored via `services.storage.get_backend()` (local-disk in dev,
GCS in prod). The Venue row tracks the list of URLs in `Venue.photos`.
URLs are kept unique on insert so the same image can't appear twice.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_admin
from app.models import Venue
from app.services import storage

router = APIRouter(prefix="/api/admin/venues", tags=["admin"])


class PhotosOut(BaseModel):
    photos: List[str]


class DeletePhotoIn(BaseModel):
    url: str


@router.post("/{venue_id}/photos", response_model=PhotosOut)
async def upload_photo(
    venue_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
) -> PhotosOut:
    """Upload one image file; append the resulting URL to `Venue.photos`."""
    venue = db.query(Venue).get(venue_id)
    if not venue:
        raise HTTPException(404, "Venue not found")

    mime = file.content_type or ""
    if not storage.is_allowed_mime(mime):
        raise HTTPException(415, f"Unsupported media type: {mime!r}. Only images are allowed.")

    content = await file.read()
    if not storage.is_within_size(len(content)):
        raise HTTPException(
            413,
            f"File too large ({len(content)} bytes). Max is {storage.MAX_BYTES} bytes.",
        )

    backend = storage.get_backend()
    url = backend.save(
        namespace=str(venue_id),
        filename_hint=file.filename or "upload",
        content=content,
        mime_type=mime,
    )

    # Dedup — append only if not already present. Keep insertion order so
    # photos[0] (used by the OG image route) is the most recently-promoted
    # cover. Reorder is a separate, future task.
    photos: list[str] = list(venue.photos or [])
    if url not in photos:
        photos.append(url)
        venue.photos = photos
        db.commit()
        db.refresh(venue)
    return PhotosOut(photos=venue.photos or [])


@router.delete("/{venue_id}/photos", response_model=PhotosOut)
def delete_photo(
    venue_id: int,
    payload: DeletePhotoIn,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
) -> PhotosOut:
    """Remove `payload.url` from `Venue.photos` and best-effort delete from
    storage. Always returns the new array even if the URL was unknown."""
    venue = db.query(Venue).get(venue_id)
    if not venue:
        raise HTTPException(404, "Venue not found")

    backend = storage.get_backend()
    backend.delete(payload.url)  # best-effort; we don't fail the API on this

    photos = [p for p in (venue.photos or []) if p != payload.url]
    if photos != (venue.photos or []):
        venue.photos = photos
        db.commit()
        db.refresh(venue)
    return PhotosOut(photos=venue.photos or [])
