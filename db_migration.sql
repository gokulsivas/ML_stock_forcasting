-- =====================================================
-- NSE Stock Predictor - Auth & Watchlist DB Migration
-- Run this in your PostgreSQL marketdata database:
--   psql -U postgres -d marketdata -f db_migration.sql
-- =====================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. User-specific watchlist table
--    Each user has their own set of watched symbols
CREATE TABLE IF NOT EXISTS user_watchlist (
    id        SERIAL PRIMARY KEY,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol    VARCHAR(50) NOT NULL,
    added_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, symbol)          -- prevent duplicate entries per user
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_uwl_user_id ON user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_uwl_symbol  ON user_watchlist(symbol);

-- Verify
SELECT 'users table' AS table_name, COUNT(*) FROM users
UNION ALL
SELECT 'user_watchlist', COUNT(*) FROM user_watchlist;
