"""The release candidate must have one head containing both shipped branches."""
from pathlib import Path
from alembic.config import Config
from alembic.script import ScriptDirectory


def test_release_migration_graph_joins_stripe_and_native_store_branches():
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    script = ScriptDirectory.from_config(config)
    assert script.get_heads() == ["a31d11e70007"]
    revisions = {revision.revision for revision in script.walk_revisions()}
    assert {"a1d4f8c20b91", "a31d11e70006"} <= revisions
    assert set(script.get_revision("a31d11e70007").down_revision) == {
        "a1d4f8c20b91", "a31d11e70006"
    }
