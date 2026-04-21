import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.consumer import SocialConnection, BehaviorLog
from ...schemas.consumer import (
    WinePairingRequest, WinePairingResponse, WineRecommendation,
    MusicMoodRequest, MusicMoodResponse, MusicRecommendation,
    SocialConnectionUpdate, SocialConnectionResponse,
    ProfileUpdate, BehaviorLogCreate,
)
from ...services import wine_service, music_service

router = APIRouter(prefix="/consumer", tags=["consumer"])


def _require_consumer(user: User) -> User:
    if user.account_type != "consumer":
        raise HTTPException(status_code=403, detail="Consumer account required.")
    return user


# --- Wine Pairing ---

@router.post("/wine-pairing", response_model=WinePairingResponse, status_code=201)
def create_wine_pairing(
    body: WinePairingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    record = wine_service.save_pairing(db, current_user.id, body.dish_name, body.dish_description)
    recs = [WineRecommendation(**r) for r in json.loads(record.recommendations)]
    return WinePairingResponse(id=record.id, dish_name=record.dish_name, recommendations=recs, created_at=record.created_at)


@router.get("/wine-pairing", response_model=list[WinePairingResponse])
def list_wine_pairings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    records = wine_service.get_pairings(db, current_user.id)
    result = []
    for r in records:
        recs = [WineRecommendation(**w) for w in json.loads(r.recommendations)]
        result.append(WinePairingResponse(id=r.id, dish_name=r.dish_name, recommendations=recs, created_at=r.created_at))
    return result


# --- Music Mood ---

@router.post("/music-mood", response_model=MusicMoodResponse, status_code=201)
def create_music_mood(
    body: MusicMoodRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    record = music_service.save_music_mood(db, current_user.id, body.mood, body.food_type, body.occasion)
    recs = MusicRecommendation(**json.loads(record.recommendations))
    return MusicMoodResponse(
        id=record.id, mood=record.mood, food_type=record.food_type,
        occasion=record.occasion, recommendations=recs, created_at=record.created_at,
    )


@router.get("/music-mood", response_model=list[MusicMoodResponse])
def list_music_moods(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    records = music_service.get_music_moods(db, current_user.id)
    result = []
    for r in records:
        recs = MusicRecommendation(**json.loads(r.recommendations))
        result.append(MusicMoodResponse(
            id=r.id, mood=r.mood, food_type=r.food_type,
            occasion=r.occasion, recommendations=recs, created_at=r.created_at,
        ))
    return result


# --- Social Connections ---

@router.get("/connections", response_model=list[SocialConnectionResponse])
def get_connections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    return db.query(SocialConnection).filter(SocialConnection.user_id == current_user.id).all()


@router.patch("/connections/{platform}", response_model=SocialConnectionResponse)
def update_connection(
    platform: str,
    body: SocialConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    conn = db.query(SocialConnection).filter(
        SocialConnection.user_id == current_user.id,
        SocialConnection.platform == platform,
    ).first()
    if not conn:
        conn = SocialConnection(user_id=current_user.id, platform=platform)
        db.add(conn)
    conn.connected = body.connected
    conn.username = body.username
    conn.profile_url = body.profile_url
    db.commit()
    db.refresh(conn)
    return conn


# --- Profile ---

@router.patch("/profile")
def update_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return {"id": current_user.id, "display_name": current_user.display_name, "bio": current_user.bio}


# --- Behavior Logging ---

@router.post("/behavior", status_code=201)
def log_behavior(
    body: BehaviorLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = BehaviorLog(
        user_id=current_user.id,
        action_type=body.action_type,
        action_meta=json.dumps(body.metadata) if body.metadata else None,
    )
    db.add(log)
    db.commit()
    return {"status": "logged"}


# --- AI Recommendations based on behavior ---

@router.get("/recommendations")
def get_recommendations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    pairings = wine_service.get_pairings(db, current_user.id)
    moods = music_service.get_music_moods(db, current_user.id)

    recs = []

    # Recommend based on recent wine pairings
    if pairings:
        latest = pairings[0]
        wines = json.loads(latest.recommendations)
        if wines:
            top_wine = wines[0]
            recs.append({
                "type": "wine",
                "title": f"Try {top_wine['name']} with your next dish",
                "body": f"Based on your love of {latest.dish_name}, {top_wine['name']} will elevate your next meal.",
                "icon": "🍷",
            })

    # Recommend based on music moods
    if moods:
        mood_counts: dict[str, int] = {}
        for m in moods:
            mood_counts[m.mood] = mood_counts.get(m.mood, 0) + 1
        fav_mood = max(mood_counts, key=mood_counts.get)
        recs.append({
            "type": "music",
            "title": f"Your go-to vibe: {fav_mood.title()}",
            "body": f"You've chosen {fav_mood} music {mood_counts[fav_mood]} times. We've curated a playlist just for you.",
            "icon": "🎵",
        })

    # Generic onboarding tip
    connections = db.query(SocialConnection).filter(
        SocialConnection.user_id == current_user.id,
        SocialConnection.connected == True,
    ).count()
    if connections == 0:
        recs.append({
            "type": "connect",
            "title": "Connect Spotify for instant playlists",
            "body": "Link your music accounts to get one-tap playlist generation after every mood selection.",
            "icon": "🔗",
        })

    return recs
