-- SavoryMind Database Schema
-- Note: For local development SQLite is used (auto-created by the backend).
-- This file is for PostgreSQL production deployments.

CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price FLOAT NOT NULL,
    cost FLOAT NOT NULL,
    orders_last_30_days INTEGER DEFAULT 0,
    rating FLOAT DEFAULT 0.0,
    description TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    menu_item VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    sentiment_score FLOAT DEFAULT 0.0,
    sentiment_label VARCHAR(50) DEFAULT 'neutral',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_reviews_menu_item ON reviews(menu_item);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment_label);
