"""Schemas for account lifecycle endpoints (delete-request, etc.).

Kept in its own module so /api/account/* doesn't need to share an auth.py
schema file with login/register concerns."""
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class AccountDeleteRequest(BaseModel):
    """Body for POST /api/account/delete-request. Public endpoint —
    no auth required, because Google Play requires the deletion request
    page to be reachable by users who have already uninstalled the app
    (and therefore can't log in).

    `email` is the address the user signed up with. `reason` is optional
    free-text to help us improve the product.

    Uses plain `str` for email (matching UserRegister/UserLogin) to avoid
    adding the `email-validator` dependency — the "@" sanity check happens
    at send-time inside resend_client."""
    email:  str = Field(min_length=5, max_length=254)
    reason: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("email")
    @classmethod
    def _basic_email_shape(cls, v: str) -> str:
        v = v.strip().lower()
        # Cheap shape check — full RFC validation is the SMTP server's job.
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("email must look like an email address")
        return v
