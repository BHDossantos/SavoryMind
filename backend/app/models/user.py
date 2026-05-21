from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Float
from datetime import datetime
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    email            = Column(String, unique=True, nullable=False, index=True)
    password_hash    = Column(String, nullable=True)   # null for social-only accounts
    social_provider  = Column(String(50),  nullable=True)  # google | github | microsoft | etc.
    social_id        = Column(String(255), nullable=True)
    account_type     = Column(String, default="restaurant")  # "consumer" | "restaurant" | "diner"
    display_name     = Column(String, nullable=False)
    restaurant_name  = Column(String, nullable=True)
    plan             = Column(String, default="free")
    bio              = Column(Text, nullable=True)
    avatar_url       = Column(String, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    # Personal info
    first_name       = Column(String(100), nullable=True)
    last_name        = Column(String(100), nullable=True)

    # Location (worldwide)
    city             = Column(String(150), nullable=True)
    country          = Column(String(100), nullable=True)
    latitude         = Column(Float, nullable=True)
    longitude        = Column(Float, nullable=True)

    # Preferences stored as JSON strings
    music_genres        = Column(Text, nullable=True)  # ["Jazz","Pop",...]
    cuisine_preferences = Column(Text, nullable=True)  # ["Italian","Japanese",...]
    dietary_preferences = Column(Text, nullable=True)  # ["Vegetarian","Gluten-Free",...]
    drinking_habits     = Column(Text, nullable=True)  # {"wine":"often","beer":"never",...}
    recipe_interests    = Column(Text, nullable=True)  # ["Quick meals","Desserts",...]

    # Extended Home Cook profile
    kitchen_style       = Column(String(100), nullable=True)  # e.g. "Comfort Lover"
    skill_level         = Column(String(50),  nullable=True)  # Beginner | Intermediate | Advanced | Chef energy
    cooking_frequency   = Column(String(50),  nullable=True)  # Every day | Weekends only | etc.
    cooking_time_pref   = Column(String(50),  nullable=True)  # Under 15 min | 15-30 min | etc.
    flavor_profile      = Column(Text, nullable=True)  # JSON: {proteins[], ingredients[], dislikes[], allergies[], spice_level, flavor_types[]}
    cooking_goals       = Column(Text, nullable=True)  # JSON array: ["Eat healthier", "Impress guests", ...]
    meal_types          = Column(Text, nullable=True)  # JSON array: ["Romantic dinners", "Quick weeknight meals", ...]
    kitchen_tools       = Column(Text, nullable=True)  # JSON array: ["Oven", "Air fryer", ...]
    ingredient_budget   = Column(String(50),  nullable=True)  # Budget | Moderate | Premium | Luxury
    music_moods         = Column(Text, nullable=True)  # JSON array: ["Romantic", "Relaxed", ...]
    non_alcoholic_ok    = Column(Boolean, nullable=True)       # wants non-alcoholic pairing options
    cuisine_dislikes    = Column(Text, nullable=True)  # JSON array of cuisines to avoid

    # Food Explorer (Diner) extended profile
    dining_occasions    = Column(Text, nullable=True)  # JSON: ["Romantic dinners","Wine nights",...]
    atmosphere_prefs    = Column(Text, nullable=True)  # JSON: ["Romantic","Elegant","Cozy",...]
    dining_budget       = Column(String(50), nullable=True)   # Budget | Moderate | Premium | Luxury
    dining_frequency    = Column(String(50), nullable=True)   # Daily | Weekly | Occasionally
    dining_group        = Column(Text, nullable=True)          # JSON: ["Alone","With friends",...]

    # Restaurant Owner profile
    business_type       = Column(String(50), nullable=True)   # Restaurant | Bar | Café | Lounge | etc.
    restaurant_cuisine  = Column(Text, nullable=True)          # JSON: cuisines the restaurant serves
    service_type        = Column(Text, nullable=True)          # JSON: [Dine-in, Takeout, Delivery]
    dining_style        = Column(String(50), nullable=True)   # Fine dining | Casual | Fast-paced | Tasting menu
    target_audience     = Column(Text, nullable=True)          # JSON: [Couples, Families, Business, etc.]
    peak_hours          = Column(Text, nullable=True)          # JSON: [Lunch, Dinner, Late night]
    restaurant_goals    = Column(Text, nullable=True)          # JSON: goals for SavoryMind
    wine_program        = Column(Text, nullable=True)          # JSON: [Red, White, Sparkling, etc.]
    seating_capacity    = Column(Integer, nullable=True)
    serves_wine         = Column(Boolean, nullable=True)
    serves_cocktails    = Column(Boolean, nullable=True)
    serves_beer         = Column(Boolean, nullable=True)

    # Online booking availability
    available_time_slots = Column(Text, nullable=True)    # comma-sep "12:00,19:00,20:00"
    booking_window_days  = Column(Integer, default=60)

    # Onboarding gate
    onboarding_completed = Column(Boolean, default=False)

    # IANA timezone string for restaurant-local scheduling (e.g. inventory
    # weekly digest fires Monday 8am restaurant-local). Defaults to UTC so
    # legacy rows don't break.
    timezone = Column(String(64), nullable=False, server_default="UTC", default="UTC")

    # i18n preference. ISO 639-1 lowercase. Frontend reads on hydration to
    # set its locale; backend reads on AI-driven endpoints so Flavor /
    # recommendations / etc. respond in the user's language. v1 supported
    # set: en, es, it. Validated at the schema layer.
    language = Column(String(10), nullable=False, server_default="en", default="en")

    # Staff account linkage — only set when account_type == "staff"
    employer_id = Column(Integer, nullable=True)   # FK → users.id (the restaurant owner)

    # Public, opaque per-staff identifier used to mint the employee QR code.
    # Set only when account_type == "staff"; auto-generated on staff creation
    # (backfilled by the migration for pre-existing staff rows). Unique so a
    # scanned token resolves to exactly one employee.
    qr_token = Column(String(36), unique=True, nullable=True, index=True)

    # Billing / subscription (Stripe). `plan` above is the entitlement gate
    # ("free" | "premium") read by the paywall; the columns below mirror
    # Stripe's state so the billing UI and webhook stay in sync. All null for
    # users who never started a checkout.
    stripe_customer_id      = Column(String(255), nullable=True, index=True)
    stripe_subscription_id  = Column(String(255), nullable=True)
    subscription_status     = Column(String(50),  nullable=True)  # active | trialing | past_due | canceled
    subscription_period_end = Column(DateTime,    nullable=True)  # current period end (naive UTC)
