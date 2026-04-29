"""In-memory token bucket per (key, scope).

Lives in process memory. On Cloud Run with min-instances=0 + autoscaling,
limits reset on each cold-start, so this is best for "stop the same hot
attacker within an instance lifetime", not strict global enforcement.
For real abuse cases plug in Redis (the interface stays the same).
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass


@dataclass
class _Bucket:
    tokens: float
    last: float


class RateLimiter:
    def __init__(self, rate_per_minute: float, burst: float):
        self.rate = rate_per_minute / 60.0  # per-second refill
        self.burst = burst
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    def take(self, key: str, n: float = 1.0) -> bool:
        now = time.monotonic()
        with self._lock:
            b = self._buckets.get(key)
            if b is None:
                b = _Bucket(tokens=self.burst, last=now)
                self._buckets[key] = b
            elapsed = now - b.last
            b.tokens = min(self.burst, b.tokens + elapsed * self.rate)
            b.last = now
            if b.tokens >= n:
                b.tokens -= n
                return True
            return False

    def reset(self, key: str) -> None:
        with self._lock:
            self._buckets.pop(key, None)


# Global limiters tuned for guest abuse (planner/booking spam). Easy to
# raise via env later; defaults are conservative enough that no real user
# trips them.
PLANNER = RateLimiter(rate_per_minute=20, burst=10)
BOOKING = RateLimiter(rate_per_minute=10, burst=5)
