-- Phase 4 only adds a non-destructive index for the periodic expiry scan.
CREATE INDEX IF NOT EXISTS "bookings_source_status_payment_expiry_idx"
ON "public"."bookings" ("source", "status", "payment_status", "expires_at");
