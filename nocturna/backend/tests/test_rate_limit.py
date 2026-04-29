from app.services.rate_limit import RateLimiter


def test_burst_then_throttle():
    rl = RateLimiter(rate_per_minute=60, burst=3)
    assert rl.take("ip1") is True
    assert rl.take("ip1") is True
    assert rl.take("ip1") is True
    assert rl.take("ip1") is False  # bucket empty


def test_independent_keys():
    rl = RateLimiter(rate_per_minute=60, burst=1)
    assert rl.take("a") is True
    assert rl.take("a") is False
    assert rl.take("b") is True


def test_refills_over_time(monkeypatch):
    import time
    base = [1000.0]
    monkeypatch.setattr(time, "monotonic", lambda: base[0])
    rl = RateLimiter(rate_per_minute=60, burst=1)  # 1 token/sec
    assert rl.take("ip") is True
    assert rl.take("ip") is False
    base[0] += 1.0
    assert rl.take("ip") is True
    base[0] += 0.5
    assert rl.take("ip") is False  # half a token short
    base[0] += 0.5
    assert rl.take("ip") is True


def test_n_greater_than_burst_fails():
    rl = RateLimiter(rate_per_minute=60, burst=1)
    assert rl.take("ip", n=2.0) is False
