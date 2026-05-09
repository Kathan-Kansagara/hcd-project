-- Initialize PostgreSQL database with PostGIS extension
-- This script runs automatically when the container is first created

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS public;

-- Grant privileges
GRANT ALL ON SCHEMA public TO zenon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zenon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zenon;

-- Log the initialization
SELECT 'Database initialized with PostGIS extension' AS message;
