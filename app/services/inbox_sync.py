from __future__ import annotations


class InboxSyncService:
    """Adapter seam for polling inbound mailbox provider/webhooks."""

    def fetch_new_replies(self) -> list[dict[str, str]]:
        return []
