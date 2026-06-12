-- Collapse any pre-existing duplicate reviews (from non-idempotent seeding)
-- down to one per document before enforcing uniqueness. Keep the most recently
-- reviewed row, tie-breaking on created_at then id.
DELETE FROM "document_reviews" dr
USING (
  SELECT id,
    row_number() OVER (
      PARTITION BY document_id
      ORDER BY reviewed_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS rn
  FROM "document_reviews"
) ranked
WHERE dr.id = ranked.id AND ranked.rn > 1;
--> statement-breakpoint
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_documentId_unique" UNIQUE("document_id");