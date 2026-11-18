-- Add priority per application for leads/admin to choose
-- This design enforces only three labels because its unlikey we'll add more
ALTER TABLE applications
ADD priority TEXT CHECK (priority IN ('high', 'medium', 'low'));

