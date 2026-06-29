"""Shared rate limiter instance.

Lives in its own module so route files can attach `@limiter.limit(...)`
decorators without importing main.py (which would create a circular import).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Keyed on the client's IP. Behind Cloud Run, the client IP is preserved in
# the X-Forwarded-For header; slowapi's get_remote_address picks it up via
# Request.client.host once Starlette resolves it.
limiter = Limiter(key_func=get_remote_address)
