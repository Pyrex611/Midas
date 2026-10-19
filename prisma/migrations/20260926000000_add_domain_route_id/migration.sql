-- Adds Domain.route_id: tracks the Mailgun inbound Route (created
-- automatically by domain.service.ts::ensureInboundRoute once a domain's
-- send test passes) so retries can detect an already-provisioned route
-- instead of creating duplicates.

ALTER TABLE "Domain" ADD COLUMN "route_id" TEXT;
