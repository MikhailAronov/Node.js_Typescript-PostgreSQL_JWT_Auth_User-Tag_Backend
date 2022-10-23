CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    file TEXT,
    created_at TIMESTAMP DEFAULT now()
);