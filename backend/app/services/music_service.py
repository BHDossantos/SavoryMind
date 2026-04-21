import json
from sqlalchemy.orm import Session
from ..models.consumer import MusicMood

MOOD_BASE = {
    "romantic": {
        "vibe": "Intimate & Romantic",
        "emoji": "🕯️",
        "genres": ["Jazz", "Bossa Nova", "Soft Classical", "Acoustic Soul"],
        "artists": ["Norah Jones", "Miles Davis", "Sade", "Frank Sinatra", "João Gilberto"],
        "bpm_range": "60–80 BPM — slow and intentional",
        "spotify_query": "romantic jazz dinner",
        "amazon_station": "Romantic Evening Radio",
        "alexa_command": "Alexa, play romantic dinner music",
    },
    "celebratory": {
        "vibe": "Festive & Uplifting",
        "emoji": "🎉",
        "genres": ["Pop", "Funk", "Soul", "Motown"],
        "artists": ["Bruno Mars", "Earth Wind & Fire", "Stevie Wonder", "Dua Lipa"],
        "bpm_range": "110–140 BPM — energetic and bright",
        "spotify_query": "celebration party hits",
        "amazon_station": "Party Hits Radio",
        "alexa_command": "Alexa, play celebration songs",
    },
    "casual": {
        "vibe": "Relaxed & Easygoing",
        "emoji": "☀️",
        "genres": ["Indie Pop", "Acoustic", "Alternative", "Lo-fi"],
        "artists": ["Jack Johnson", "Ben Harper", "The Paper Kites", "Bon Iver"],
        "bpm_range": "80–100 BPM — comfortable and breezy",
        "spotify_query": "chill indie folk acoustic",
        "amazon_station": "Chill Vibes Radio",
        "alexa_command": "Alexa, play chill background music",
    },
    "focused": {
        "vibe": "Productive & Focused",
        "emoji": "🎯",
        "genres": ["Ambient", "Post-rock", "Classical", "Lo-fi Hip Hop"],
        "artists": ["Brian Eno", "Tycho", "Explosions in the Sky", "Lofi Girl"],
        "bpm_range": "70–90 BPM — steady and undistracting",
        "spotify_query": "focus work study music",
        "amazon_station": "Deep Focus Radio",
        "alexa_command": "Alexa, play focus music",
    },
    "melancholy": {
        "vibe": "Reflective & Soulful",
        "emoji": "🌧️",
        "genres": ["Indie Folk", "Blues", "Singer-Songwriter", "Slow Jazz"],
        "artists": ["Nick Drake", "Elliott Smith", "Phoebe Bridgers", "B.B. King"],
        "bpm_range": "50–75 BPM — slow and contemplative",
        "spotify_query": "sad indie folk acoustic",
        "amazon_station": "Soulful Blues Radio",
        "alexa_command": "Alexa, play reflective music",
    },
    "energetic": {
        "vibe": "High Energy & Bold",
        "emoji": "⚡",
        "genres": ["Latin", "Reggaeton", "Rock", "Electronic Dance"],
        "artists": ["Bad Bunny", "Rosalía", "The Killers", "Calvin Harris"],
        "bpm_range": "120–160 BPM — fast and powerful",
        "spotify_query": "high energy latin dance",
        "amazon_station": "High Energy Radio",
        "alexa_command": "Alexa, play high energy music",
    },
}

FOOD_TYPE_MODIFIERS: dict[str, list[str]] = {
    "spicy":   ["Latin", "Flamenco", "Reggae"],
    "sweet":   ["Pop", "R&B", "Indie Pop"],
    "rich":    ["Jazz", "Blues", "Soul"],
    "light":   ["Acoustic", "Indie Folk", "Bossa Nova"],
    "umami":   ["Jazz", "Neo Soul", "Trip Hop"],
    "neutral": [],
}

OCCASION_MODIFIERS: dict[str, list[str]] = {
    "date_night":    ["Bossa Nova", "Soft Jazz"],
    "dinner_party":  ["Funk", "Soul", "Jazz"],
    "solo":          ["Singer-Songwriter", "Lo-fi"],
    "family":        ["Pop", "Classic Rock"],
    "work_lunch":    ["Ambient", "Lo-fi"],
    "brunch":        ["Acoustic Pop", "Jazz Brunch"],
}


def build_music_recommendation(mood: str, food_type: str, occasion: str) -> dict:
    base = MOOD_BASE.get(mood, MOOD_BASE["casual"])
    extra_genres = (
        FOOD_TYPE_MODIFIERS.get(food_type, []) +
        OCCASION_MODIFIERS.get(occasion, [])
    )
    genres = list(dict.fromkeys(base["genres"] + extra_genres))[:6]  # deduplicated, max 6

    return {
        "genres": genres,
        "artists": base["artists"],
        "bpm_range": base["bpm_range"],
        "vibe": base["vibe"],
        "emoji": base["emoji"],
        "spotify_query": base["spotify_query"],
        "amazon_station": base["amazon_station"],
        "alexa_command": base["alexa_command"],
    }


def save_music_mood(db: Session, user_id: int, mood: str, food_type: str, occasion: str) -> MusicMood:
    recs = build_music_recommendation(mood, food_type, occasion)
    record = MusicMood(
        user_id=user_id,
        mood=mood,
        food_type=food_type,
        occasion=occasion,
        recommendations=json.dumps(recs),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_music_moods(db: Session, user_id: int) -> list[MusicMood]:
    return db.query(MusicMood).filter(MusicMood.user_id == user_id).order_by(MusicMood.created_at.desc()).all()
