"""Tests for the Snap-a-Menu endpoint."""
import io
from unittest.mock import patch


# Smallest valid JPEG payload that Pillow / Claude will accept as an image.
# (1x1 white pixel.)
_TINY_JPEG = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000"
    "ffdb004300080606070605080707070909080a0c"
    "140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20"
    "242e2720222c231c1c2837292c30313434341f27"
    "393d38323c2e333432"
    "ffc00011080001000103012200021101031101"
    "ffc4001f0000010501010101010100000000000000"
    "000102030405060708090a0b"
    "ffc400b5100002010303020403050504040000017d"
    "01020300041105122131410613516107227114328191"
    "a1082342b1c11552d1f02433627282090a161718191a"
    "25262728292a3435363738393a434445464748494a53"
    "5455565758595a636465666768696a737475767778797a"
    "838485868788898a92939495969798999aa2a3a4a5a6"
    "a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9ca"
    "d2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3"
    "f4f5f6f7f8f9fa"
    "ffda000c03010002110311003f00fb"
    "d2bfffd9"
)


def _stub_recommendation():
    return {
        "dish":         "Tagliata di manzo",
        "why":          "Rare beef matches savoury preferences and is the menu's best value.",
        "alternatives": ["Risotto ai funghi"],
        "warnings":     [],
        "share_title":  "Tonight: Tagliata di manzo. The menu's best value.",
    }


def test_snap_menu_returns_recommendation(client, db_session):
    with patch("app.services.menu_snap_service.recommend_from_image", return_value=_stub_recommendation()):
        res = client.post(
            "/api/discover/snap-menu",
            files={"image": ("menu.jpg", _TINY_JPEG, "image/jpeg")},
            data={"language": "it", "cuisines": "Italian,Japanese"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["source"] == "ai"
    assert body["recommendation"]["dish"] == "Tagliata di manzo"


def test_snap_menu_falls_back_to_stub_when_claude_unconfigured(client, db_session):
    """The /menu page should render even when the AI is down."""
    with patch("app.services.menu_snap_service.recommend_from_image", return_value=None):
        res = client.post(
            "/api/discover/snap-menu",
            files={"image": ("menu.jpg", _TINY_JPEG, "image/jpeg")},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "stub"
    assert "dish" in body["recommendation"]


def test_snap_menu_rejects_unsupported_image_type(client, db_session):
    """A PDF or HEIC upload should 400 cleanly, not crash."""
    res = client.post(
        "/api/discover/snap-menu",
        files={"image": ("menu.pdf", b"%PDF-1.4 garbage", "application/pdf")},
    )
    assert res.status_code == 400


def test_snap_menu_rejects_empty_image(client, db_session):
    res = client.post(
        "/api/discover/snap-menu",
        files={"image": ("menu.jpg", b"", "image/jpeg")},
    )
    assert res.status_code == 400


def test_snap_menu_rejects_oversized_image(client, db_session):
    """A 6MB upload should 413 (over the 5MB hard cap). Clients are
    expected to client-side compress to <1MB before posting."""
    huge = b"\xff" * (6 * 1024 * 1024)
    res = client.post(
        "/api/discover/snap-menu",
        files={"image": ("menu.jpg", huge, "image/jpeg")},
    )
    assert res.status_code == 413
