-- Giai đoạn 8: parity quản trị với bản MVC.
-- Chỉ bổ sung, không xóa dữ liệu hiện có.
ALTER TYPE "customer_status" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "view_count" INTEGER NOT NULL DEFAULT 0;

ALTER TYPE "user_status" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;
