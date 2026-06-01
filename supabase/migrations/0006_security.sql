-- Migration 0006: Security and Audit
-- Tables: revoked_tokens, security_events

CREATE TABLE public.revoked_tokens (
    jti UUID PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_revoked_tokens_expires ON public.revoked_tokens(expires_at);

-- Periodic cleanup: DELETE FROM revoked_tokens WHERE expires_at < NOW();

CREATE TABLE public.security_events (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event VARCHAR(60) NOT NULL,
    user_id UUID REFERENCES public.users(id),
    ip INET,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR')),
    detail JSONB
);

CREATE INDEX idx_security_events_ts ON public.security_events(ts);
CREATE INDEX idx_security_events_event ON public.security_events(event);
CREATE INDEX idx_security_events_user ON public.security_events(user_id);
