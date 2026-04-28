"""Seed the database with Rome barbers so the customer search screen has supply on day one.

Run: `python -m app.seed`
"""
from datetime import time

from sqlmodel import Session, select

from .db import engine, init_db
from .models import Availability, Provider, Role, Service, User
from .security import hash_password


BARBERS = [
    {
        "email": "marco@romebarbers.it",
        "first_name": "Marco",
        "last_name": "Rossi",
        "display_name": "Marco's Barber Shop",
        "bio": "Classic Italian barbering, fades, beard sculpting. 12 years experience.",
        "neighborhood": "Trastevere",
        "address": "Via della Lungaretta 45, Roma",
        "languages": "it,en",
        "is_verified": True,
        "average_rating": 4.8,
        "review_count": 132,
        "services": [
            ("Men's haircut", 30, 2500),
            ("Fade", 40, 3000),
            ("Beard trim", 20, 1500),
            ("Haircut + beard", 60, 4000),
        ],
    },
    {
        "email": "luca@bottegabarbieri.it",
        "first_name": "Luca",
        "last_name": "Bianchi",
        "display_name": "Bottega dei Barbieri",
        "bio": "Modern cuts, skin fades, hot towel shaves.",
        "neighborhood": "Monti",
        "address": "Via dei Serpenti 88, Roma",
        "languages": "it,en,es",
        "is_verified": True,
        "average_rating": 4.9,
        "review_count": 210,
        "services": [
            ("Men's haircut", 30, 2800),
            ("Skin fade", 45, 3500),
            ("Hot towel shave", 30, 2500),
            ("Haircut + beard", 60, 4500),
        ],
    },
    {
        "email": "ahmed@pratifades.it",
        "first_name": "Ahmed",
        "last_name": "Khalil",
        "display_name": "Prati Fades",
        "bio": "Specialist in fades, line-ups, curly hair.",
        "neighborhood": "Prati",
        "address": "Via Cola di Rienzo 220, Roma",
        "languages": "it,en,ar",
        "is_verified": True,
        "average_rating": 4.7,
        "review_count": 89,
        "services": [
            ("Fade", 35, 3000),
            ("Line up", 15, 1500),
            ("Beard design", 25, 2000),
            ("Haircut + beard", 55, 4000),
        ],
    },
    {
        "email": "giorgio@centrostorico.it",
        "first_name": "Giorgio",
        "last_name": "Ferrari",
        "display_name": "Giorgio Centro Storico",
        "bio": "Old-school Italian barbershop near Pantheon.",
        "neighborhood": "Centro Storico",
        "address": "Via dei Coronari 12, Roma",
        "languages": "it,en",
        "is_verified": True,
        "average_rating": 4.6,
        "review_count": 75,
        "services": [
            ("Men's haircut", 30, 2200),
            ("Beard trim", 20, 1200),
            ("Haircut + beard", 50, 3200),
        ],
    },
    {
        "email": "paolo@testacciocuts.it",
        "first_name": "Paolo",
        "last_name": "Conti",
        "display_name": "Testaccio Cuts",
        "bio": "Walk-ins welcome. Quick, sharp cuts.",
        "neighborhood": "Testaccio",
        "address": "Via Marmorata 56, Roma",
        "languages": "it",
        "is_verified": False,
        "average_rating": 4.4,
        "review_count": 41,
        "services": [
            ("Men's haircut", 25, 2000),
            ("Fade", 35, 2500),
            ("Beard trim", 15, 1000),
        ],
    },
    {
        "email": "ricardo@sangiovannibarber.it",
        "first_name": "Ricardo",
        "last_name": "Moretti",
        "display_name": "San Giovanni Barber",
        "bio": "Family barbershop, three generations.",
        "neighborhood": "San Giovanni",
        "address": "Via Appia Nuova 110, Roma",
        "languages": "it,en",
        "is_verified": True,
        "average_rating": 4.5,
        "review_count": 60,
        "services": [
            ("Men's haircut", 30, 2300),
            ("Fade", 40, 2800),
            ("Beard trim", 20, 1300),
            ("Kids cut", 25, 1800),
        ],
    },
    {
        "email": "stefano@parioligrooming.it",
        "first_name": "Stefano",
        "last_name": "Galli",
        "display_name": "Parioli Grooming",
        "bio": "Premium grooming for professionals.",
        "neighborhood": "Parioli",
        "address": "Viale Parioli 90, Roma",
        "languages": "it,en,fr",
        "is_verified": True,
        "average_rating": 4.9,
        "review_count": 154,
        "services": [
            ("Men's haircut", 45, 4000),
            ("Hot towel shave", 30, 3000),
            ("Haircut + beard", 75, 6000),
        ],
    },
    {
        "email": "yannis@eurbarbershop.it",
        "first_name": "Yannis",
        "last_name": "Papadopoulos",
        "display_name": "EUR Barbershop",
        "bio": "Modern barbershop in EUR. Espresso while you wait.",
        "neighborhood": "EUR",
        "address": "Viale Europa 45, Roma",
        "languages": "it,en,el",
        "is_verified": True,
        "average_rating": 4.7,
        "review_count": 98,
        "services": [
            ("Men's haircut", 30, 2700),
            ("Skin fade", 45, 3300),
            ("Beard trim", 20, 1500),
        ],
    },
    {
        "email": "davide@montibarberco.it",
        "first_name": "Davide",
        "last_name": "Russo",
        "display_name": "Monti Barber Co.",
        "bio": "Hipster barbershop, vinyl on the turntable.",
        "neighborhood": "Monti",
        "address": "Via del Boschetto 30, Roma",
        "languages": "it,en",
        "is_verified": True,
        "average_rating": 4.8,
        "review_count": 120,
        "services": [
            ("Men's haircut", 35, 3000),
            ("Fade", 45, 3500),
            ("Beard sculpt", 30, 2500),
            ("Haircut + beard", 65, 5000),
        ],
    },
    {
        "email": "andrea@trastevereshave.it",
        "first_name": "Andrea",
        "last_name": "Greco",
        "display_name": "Trastevere Shave",
        "bio": "Traditional straight-razor shaves.",
        "neighborhood": "Trastevere",
        "address": "Vicolo del Cinque 18, Roma",
        "languages": "it,en",
        "is_verified": True,
        "average_rating": 4.6,
        "review_count": 67,
        "services": [
            ("Men's haircut", 30, 2500),
            ("Straight razor shave", 40, 3000),
            ("Haircut + shave", 60, 4500),
        ],
    },
]


# Mon-Sat 9:00-19:00 by default
DEFAULT_HOURS = [(d, time(9, 0), time(19, 0)) for d in range(0, 6)]


def run() -> None:
    init_db()
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.email == BARBERS[0]["email"])).first()
        if existing:
            print("Seed data already present, skipping.")
            return

        # demo customer
        if not session.exec(select(User).where(User.email == "demo@availablenow.app")).first():
            session.add(
                User(
                    email="demo@availablenow.app",
                    password_hash=hash_password("password123"),
                    first_name="Demo",
                    last_name="Customer",
                    role=Role.customer,
                )
            )

        for spec in BARBERS:
            user = User(
                email=spec["email"],
                password_hash=hash_password("password123"),
                first_name=spec["first_name"],
                last_name=spec["last_name"],
                role=Role.provider,
            )
            session.add(user)
            session.commit()
            session.refresh(user)

            provider = Provider(
                user_id=user.id,
                display_name=spec["display_name"],
                bio=spec["bio"],
                category="barber",
                city="Rome",
                neighborhood=spec["neighborhood"],
                address=spec["address"],
                languages=spec["languages"],
                is_verified=spec["is_verified"],
                average_rating=spec["average_rating"],
                review_count=spec["review_count"],
            )
            session.add(provider)
            session.commit()
            session.refresh(provider)

            for name, duration, price in spec["services"]:
                session.add(
                    Service(
                        provider_id=provider.id,
                        name=name,
                        duration_minutes=duration,
                        price_cents=price,
                    )
                )

            for dow, start, end in DEFAULT_HOURS:
                session.add(
                    Availability(
                        provider_id=provider.id,
                        day_of_week=dow,
                        start_time=start,
                        end_time=end,
                    )
                )

        session.commit()
        print(f"Seeded {len(BARBERS)} providers and 1 demo customer.")
        print("Login as customer: demo@availablenow.app / password123")
        print("Login as a provider e.g.: marco@romebarbers.it / password123")


if __name__ == "__main__":
    run()
