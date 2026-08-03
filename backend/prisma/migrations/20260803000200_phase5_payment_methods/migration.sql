-- Phase 5 preserves all legacy enum values and only adds the new names.
ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'CASH_COUNTER';
ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'CARD_POS';
