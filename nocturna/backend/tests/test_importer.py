from app.models import Venue
from app.services.importer import import_rows, parse_csv, parse_json


CSV_TEXT = """slug,name,type,address,lat,lng,neighborhood,city,opening_hours,price_level,avg_price_eur,dress_code,music_types,vibe_tags,reservation_required,vip_available,phone
,Bar Centrale,bar,Via del Corso 100,41.9,12.48,Centro,rome,"{""mon"":[{""open"":""18:00"",""close"":""02:00""}]}",2,30,casual,jazz|lounge,romantic|trendy,true,false,+39 06 1111111
my-club,Club Galaxy,club,Via Veneto 1,41.91,12.49,Centro,rome,"{""fri"":[{""open"":""23:30"",""close"":""05:00""}],""sat"":[{""open"":""23:30"",""close"":""05:00""}]}",3,80,elegant,house|techno,wild|vip_friendly,false,true,+39 06 2222222
"""


def test_csv_parses(db):
    rows = parse_csv(CSV_TEXT)
    assert len(rows) == 2
    assert rows[0]["name"] == "Bar Centrale"
    assert rows[1]["slug"] == "my-club"


def test_dry_run_does_not_write(db):
    rows = parse_csv(CSV_TEXT)
    out = import_rows(db, rows, dry_run=True)
    assert out["dry_run"] is True
    assert out["counts"]["created"] == 2
    assert db.query(Venue).count() == 0


def test_commit_creates_then_updates(db):
    rows = parse_csv(CSV_TEXT)
    out = import_rows(db, rows, dry_run=False)
    assert out["counts"]["created"] == 2
    assert db.query(Venue).count() == 2
    bar = db.query(Venue).filter_by(slug="bar-centrale").one()
    assert bar.vibe_tags == ["romantic", "trendy"]
    assert bar.reservation_required is True
    assert bar.contact == {"phone": "+39 06 1111111"}

    # Re-import with one tweak -> idempotent: 1 unchanged + 1 update
    tweaked = CSV_TEXT.replace("Club Galaxy", "Club Galaxy (Renamed)")
    out2 = import_rows(db, parse_csv(tweaked), dry_run=False)
    assert out2["counts"]["updated"] == 1
    assert out2["counts"]["unchanged"] == 1
    assert db.query(Venue).filter_by(slug="my-club").one().name == "Club Galaxy (Renamed)"


def test_json_array_input(db):
    text = '[{"name":"Quick","type":"bar","address":"X","lat":41.9,"lng":12.5,"neighborhood":"Centro","music_types":["jazz"]}]'
    rows = parse_json(text)
    out = import_rows(db, rows, dry_run=False)
    assert out["counts"]["created"] == 1
    v = db.query(Venue).filter_by(slug="quick").one()
    assert v.music_types == ["jazz"]


def test_missing_required_returns_error(db):
    rows = parse_csv("name,type\nSomeBar,bar\n")
    out = import_rows(db, rows, dry_run=True)
    assert out["counts"]["errors"] == 1
    assert any("address" in e for e in out["results"][0]["errors"])
