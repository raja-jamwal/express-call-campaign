-- =============================================================================
-- SQL Schema for the Outbound Voice Campaign Microservice
-- =============================================================================
-- Database: PostgreSQL
-- Author: Raja Jamwal
-- =============================================================================

-- Enable the uuid-ossp extension to generate UUIDs.
-- This needs to be run once per database by a superuser.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables in reverse order of dependency to avoid foreign key errors
DROP TABLE IF EXISTS call_logs CASCADE;
DROP TABLE IF EXISTS call_tasks CASCADE;
DROP TABLE IF EXISTS call_campaigns CASCADE;
DROP TABLE IF EXISTS call_schedules CASCADE;
DROP TABLE IF EXISTS phone_numbers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom ENUM types
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS call_log_status;
DROP TYPE IF EXISTS phone_number_status;

-- =============================================================================
-- Custom ENUM Types for Status Fields
-- =============================================================================

CREATE TYPE task_status AS ENUM ('pending', 'in-progress', 'completed', 'failed');
CREATE TYPE call_log_status AS ENUM ('initiated', 'in-progress', 'completed', 'failed');
CREATE TYPE phone_number_status AS ENUM ('valid', 'invalid', 'do_not_call');

-- =============================================================================
-- 1. User Entity
-- =============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. PhoneNumber Entity
-- =============================================================================

CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number VARCHAR(50) NOT NULL,
    status phone_number_status NOT NULL DEFAULT 'valid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, number)
);
CREATE INDEX idx_phone_numbers_on_user_id ON phone_numbers(user_id);

-- =============================================================================
-- 3. CallSchedule Entity
-- =============================================================================

CREATE TABLE call_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    time_zone VARCHAR(100) NOT NULL,
    schedule_rules JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_call_schedules_on_user_id ON call_schedules(user_id);

-- =============================================================================
-- 4. CallCampaign Entity
-- =============================================================================

CREATE TABLE call_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_paused BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_id UUID REFERENCES call_schedules(id) ON DELETE SET NULL,
    max_concurrent_calls INTEGER NOT NULL DEFAULT 5,
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_delay_seconds INTEGER NOT NULL DEFAULT 300,
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    failed_tasks INTEGER NOT NULL DEFAULT 0,
    retries_attempted INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_call_campaigns_on_user_id ON call_campaigns(user_id);
CREATE INDEX idx_call_campaigns_on_schedule_id ON call_campaigns(schedule_id);
CREATE INDEX idx_call_campaigns_on_is_paused ON call_campaigns(is_paused);

-- =============================================================================
-- 5. CallTask Entity
-- =============================================================================

CREATE TABLE call_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES call_campaigns(id) ON DELETE CASCADE,
    phone_number_id UUID NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
    status task_status NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (campaign_id, phone_number_id)
);
CREATE INDEX idx_call_tasks_on_user_id ON call_tasks(user_id);
CREATE INDEX idx_call_tasks_on_campaign_id ON call_tasks(campaign_id);
CREATE INDEX idx_call_tasks_on_phone_number_id ON call_tasks(campaign_id, phone_number_id);
CREATE INDEX idx_call_tasks_on_status ON call_tasks(campaign_id, status);

-- =============================================================================
-- 6. CallLog Entity
-- =============================================================================

CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    call_task_id UUID NOT NULL REFERENCES call_tasks(id) ON DELETE CASCADE,
    phone_number_id UUID NOT NULL REFERENCES phone_numbers(id) ON DELETE RESTRICT,
    dialed_number VARCHAR(50) NOT NULL,
    external_call_id VARCHAR(255) UNIQUE,
    status call_log_status NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_call_logs_on_user_id ON call_logs(user_id);
CREATE INDEX idx_call_logs_on_call_task_id ON call_logs(call_task_id);
CREATE INDEX idx_call_logs_on_external_call_id ON call_logs(external_call_id);

-- =============================================================================
-- End of Schema
-- =============================================================================