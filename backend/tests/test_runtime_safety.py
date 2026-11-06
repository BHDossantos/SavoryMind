"""Pure configuration tests: no database, credentials or provider requests."""
from types import SimpleNamespace
import unittest

from app.core.runtime_safety import (
    DEFAULT_SECRET, DEFAULT_SOCIAL_SECRET, DEFAULT_TOKEN_ENCRYPTION_KEY,
    validate_runtime,
)


class RuntimeSafetyTests(unittest.TestCase):
    def settings(self, **kwargs):
        values = dict(database_url="sqlite:///./local.db", app_env="development",
                      sentry_environment="development", secret_key="configured-signing",
                      social_login_secret="configured-social", token_encryption_key="configured-encryption")
        values.update(kwargs)
        return SimpleNamespace(**values)

    def test_local_sqlite_still_works_without_production_credentials(self):
        self.assertFalse(validate_runtime(self.settings(secret_key=DEFAULT_SECRET), {}))

    def test_hosted_sqlite_cannot_disable_production_validation(self):
        for signal in ("RENDER_SERVICE_ID", "K_SERVICE"):
            with self.subTest(signal=signal), self.assertRaisesRegex(RuntimeError, "durable DATABASE_URL"):
                validate_runtime(self.settings(), {signal: "service"})

    def test_explicit_production_and_monitoring_production_reject_sqlite(self):
        for kwargs in ({"app_env": "production"}, {"app_env": "prod"}, {"sentry_environment": "production"}, {"app_env": " Production "}, {"sentry_environment": " Production "}):
            with self.subTest(kwargs=kwargs), self.assertRaises(RuntimeError):
                validate_runtime(self.settings(**kwargs), {})

    def test_sqlite_driver_variant_is_not_a_durable_hosted_database(self):
        with self.assertRaises(RuntimeError):
            validate_runtime(self.settings(database_url="sqlite+pysqlite:///:memory:"), {"RENDER_SERVICE_ID": "service"})

    def test_blank_database_fails_closed(self):
        with self.assertRaises(RuntimeError):
            validate_runtime(self.settings(database_url="  "), {})

    def test_database_name_containing_sqlite_does_not_bypass_checks(self):
        with self.assertRaisesRegex(RuntimeError, "SECRET_KEY"):
            validate_runtime(self.settings(database_url="postgresql://localhost/sqlite_backup", secret_key=DEFAULT_SECRET), {})

    def test_all_default_and_empty_secrets_are_rejected_without_value_disclosure(self):
        for key, default in (("secret_key", DEFAULT_SECRET), ("social_login_secret", DEFAULT_SOCIAL_SECRET), ("token_encryption_key", DEFAULT_TOKEN_ENCRYPTION_KEY)):
            for value in (default, "", "   "):
                with self.subTest(key=key, value_type="default" if value == default else "empty"):
                    with self.assertRaises(RuntimeError) as error:
                        validate_runtime(self.settings(database_url="postgresql://localhost/app", **{key: value}), {})
                    self.assertIn(key.upper(), str(error.exception))
                    self.assertNotIn(default, str(error.exception))

    def test_configured_hosted_postgres_passes(self):
        self.assertTrue(validate_runtime(self.settings(database_url="postgresql://localhost/app"), {"RENDER_SERVICE_ID": "service"}))

    def test_legacy_postgres_without_environment_marker_still_checks_secrets(self):
        with self.assertRaisesRegex(RuntimeError, "SECRET_KEY"):
            validate_runtime(self.settings(database_url="postgres://localhost/app", secret_key=DEFAULT_SECRET), {})


def test_hosted_sqlite_is_rejected_before_startup_mutations(monkeypatch):
    import asyncio
    from unittest.mock import Mock
    import main

    monkeypatch.setenv("RENDER_SERVICE_ID", "test-service")
    monkeypatch.setattr(main.settings, "database_url", "sqlite:///./local.db")
    migrate = Mock()
    seed = Mock()
    monkeypatch.setattr(main, "_run_alembic_migrations", migrate)
    monkeypatch.setattr(main, "_seed_demo_restaurants", seed)

    async def start():
        async with main.lifespan(main.app):
            raise AssertionError("Unsafe runtime started")

    import pytest
    with pytest.raises(RuntimeError, match="durable DATABASE_URL"):
        asyncio.run(start())
    migrate.assert_not_called()
    seed.assert_not_called()
