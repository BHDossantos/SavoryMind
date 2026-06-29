-- Table for users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table for moods
CREATE TABLE moods (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    mood VARCHAR(50) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for dishes
CREATE TABLE dishes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    ingredients TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table for recommendations
CREATE TABLE recommendations (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    dish_id INT REFERENCES dishes(id),
    recommendation_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for analytics
CREATE TABLE analytics (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    dish_id INT REFERENCES dishes(id),
    mood_id INT REFERENCES moods(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    interaction_type VARCHAR(50) NOT NULL
);
