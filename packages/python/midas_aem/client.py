from __future__ import annotations

import hashlib
import hmac
import os
import time
from typing import Any, Dict, List, Optional

import httpx


class MidasAPIError(Exception):
    def __init__(self, status: int, message: str, payload: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.payload = payload


def verify_webhook_signature(raw_body: str | bytes, signature_header: str, secret: str) -> bool:
    if not signature_header or not secret:
        return False

    try:
        parts = dict(item.split("=", 1) for item in signature_header.split(",") if "=" in item)
        timestamp = parts.get("t", "")
        signature = parts.get("v1", "")
        if not timestamp or not signature:
            return False

        if abs(int(time.time()) - int(timestamp)) > 300:
            return False

        body_str = raw_body.decode("utf-8") if isinstance(raw_body, bytes) else raw_body
        expected = hmac.new(
            secret.encode("utf-8"),
            f"{timestamp}.{body_str}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(signature, expected)
    except Exception:
        return False


class _BaseClient:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, timeout: float = 30.0) -> None:
        resolved_key = api_key or os.getenv("MIDAS_API_KEY") or os.getenv("TOWN_CRIER_API_KEY")
        if not resolved_key:
            raise ValueError("Midas API key required. Pass api_key=... or set MIDAS_API_KEY.")

        self.api_key = resolved_key.strip()
        self.base_url = (base_url or os.getenv("MIDAS_BASE_URL") or "https://midas-aem.vercel.app").rstrip("/")
        self.timeout = timeout
        self._headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _handle_response(res: httpx.Response) -> Any:
        try:
            data = res.json() if res.content else {}
        except Exception:
            data = {"message": res.text}

        if not res.is_success:
            msg = data.get("error") or data.get("message") or f"HTTP {res.status_code}"
            raise MidasAPIError(res.status_code, str(msg), data)
        return data


class MidasClient(_BaseClient):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, timeout: float = 30.0) -> None:
        super().__init__(api_key, base_url, timeout)
        self._client = httpx.Client(base_url=self.base_url, headers=self._headers, timeout=self.timeout)

    def __enter__(self) -> "MidasClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def subscribe(
        self,
        email: str,
        name: Optional[str] = None,
        gong_id: Optional[str] = None,
        cadence: str = "weekly",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"email": email, "cadence": cadence}
        if name is not None:
            payload["name"] = name
        if gong_id is not None:
            payload["gongId"] = gong_id
        if tags is not None:
            payload["tags"] = tags
        if metadata is not None:
            payload["metadata"] = metadata
        return self._handle_response(self._client.post("/api/public/town-crier/subscribe", json=payload))

    def get_stats(self) -> Dict[str, Any]:
        return self._handle_response(self._client.get("/api/public/town-crier/stats"))

    def list_gongs(self) -> Dict[str, Any]:
        return self._handle_response(self._client.get("/api/public/town-crier/gongs"))

    def broadcast(self, gong_id_or_slug: str, subject: str, body: str, template_style: str = "card") -> Dict[str, Any]:
        return self._handle_response(
            self._client.post(
                f"/api/public/town-crier/gongs/{gong_id_or_slug}/broadcast",
                json={"subject": subject, "body": body, "templateStyle": template_style},
            )
        )

    def get_campaigns(self) -> List[Dict[str, Any]]:
        return self._handle_response(self._client.get("/api/campaigns"))

    def dispatch_campaign(self, campaign_id: str) -> Dict[str, Any]:
        return self._handle_response(self._client.post(f"/api/campaigns/{campaign_id}/dispatch-now"))

    def add_leads_to_campaign(self, campaign_id: str, lead_ids: List[str]) -> Dict[str, Any]:
        return self._handle_response(self._client.post(f"/api/campaigns/{campaign_id}/leads", json={"leadIds": lead_ids}))

    def send_sandbox_test(self, subject: Optional[str] = None, body: Optional[str] = None) -> Dict[str, Any]:
        return self._handle_response(self._client.post("/api/sandbox/test-send", json={"subject": subject, "body": body}))


class AsyncMidasClient(_BaseClient):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, timeout: float = 30.0) -> None:
        super().__init__(api_key, base_url, timeout)
        self._client = httpx.AsyncClient(base_url=self.base_url, headers=self._headers, timeout=self.timeout)

    async def __aenter__(self) -> "AsyncMidasClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    async def close(self) -> None:
        await self._client.aclose()

    async def subscribe(
        self,
        email: str,
        name: Optional[str] = None,
        gong_id: Optional[str] = None,
        cadence: str = "weekly",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"email": email, "cadence": cadence}
        if name is not None:
            payload["name"] = name
        if gong_id is not None:
            payload["gongId"] = gong_id
        if tags is not None:
            payload["tags"] = tags
        if metadata is not None:
            payload["metadata"] = metadata
        res = await self._client.post("/api/public/town-crier/subscribe", json=payload)
        return self._handle_response(res)

    async def get_stats(self) -> Dict[str, Any]:
        return self._handle_response(await self._client.get("/api/public/town-crier/stats"))

    async def list_gongs(self) -> Dict[str, Any]:
        return self._handle_response(await self._client.get("/api/public/town-crier/gongs"))

    async def broadcast(self, gong_id_or_slug: str, subject: str, body: str, template_style: str = "card") -> Dict[str, Any]:
        res = await self._client.post(
            f"/api/public/town-crier/gongs/{gong_id_or_slug}/broadcast",
            json={"subject": subject, "body": body, "templateStyle": template_style},
        )
        return self._handle_response(res)

    async def get_campaigns(self) -> List[Dict[str, Any]]:
        return self._handle_response(await self._client.get("/api/campaigns"))

    async def dispatch_campaign(self, campaign_id: str) -> Dict[str, Any]:
        return self._handle_response(await self._client.post(f"/api/campaigns/{campaign_id}/dispatch-now"))

    async def add_leads_to_campaign(self, campaign_id: str, lead_ids: List[str]) -> Dict[str, Any]:
        return self._handle_response(
            await self._client.post(f"/api/campaigns/{campaign_id}/leads", json={"leadIds": lead_ids})
        )

    async def send_sandbox_test(self, subject: Optional[str] = None, body: Optional[str] = None) -> Dict[str, Any]:
        res = await self._client.post("/api/sandbox/test-send", json={"subject": subject, "body": body})
        return self._handle_response(res)