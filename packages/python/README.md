# midas-aem (Python SDK)

Official synchronous & asynchronous Python client for **MIDAS — Golden Email Infrastructure**.

## Install

```bash
pip install midas-aem
```

## Sync Usage

```python
from midas_aem import MidasClient

client = MidasClient(api_key="midas_live_...")

# Subscribe a lead to a Gong channel by slug
client.subscribe(
    email="founder@acme.com",
    name="Alex Mercer",
    gong_id="weekly-alpha",
    cadence="weekly",
    metadata={"is_developer": True},
)

# Send a guarded zero-setup sandbox test email
client.send_sandbox_test(subject="Hello from Python SDK")
```

## Async Usage (FastAPI / AI Agents)

```python
from midas_aem import AsyncMidasClient

async with AsyncMidasClient(api_key="midas_live_...") as client:
    stats = await client.get_stats()
    await client.dispatch_campaign("campaign_cuid_123")
```