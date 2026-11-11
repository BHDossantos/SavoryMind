"""Configuration must not silently supply shared application keys."""
import pytest
from pydantic import ValidationError
from app.core.config import Settings


@pytest.mark.parametrize("field", ["secret_key", "social_login_secret", "token_encryption_key"])
@pytest.mark.parametrize("value", ["", "   "])
def test_blank_application_key_is_rejected(field, value):
    with pytest.raises(ValidationError, match="Set an explicit private key"):
        Settings(_env_file=None, **{field: value})


def test_explicit_test_keys_are_not_regenerated_on_settings_reload():
    first = Settings(_env_file=None)
    second = Settings(_env_file=None)
    for field in ("secret_key", "social_login_secret", "token_encryption_key"):
        assert getattr(first, field)
        assert getattr(first, field) == getattr(second, field)
