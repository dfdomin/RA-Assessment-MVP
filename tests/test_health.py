import pytest


@pytest.mark.asyncio
async def test_health_ok(async_client):
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_me_unauthenticated(async_client):
    response = await async_client.get("/api/v1/me")
    assert response.status_code == 401
