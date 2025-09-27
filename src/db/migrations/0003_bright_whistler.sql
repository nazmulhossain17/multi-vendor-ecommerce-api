DROP INDEX "products_slug_uq";--> statement-breakpoint
DROP INDEX "product_vendor_idx";--> statement-breakpoint
DROP INDEX "product_brand_idx";--> statement-breakpoint
DROP INDEX "product_slug_idx";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tags" text[];