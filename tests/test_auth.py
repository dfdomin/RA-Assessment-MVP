import pytest


LOGIN_URL = "/api/v1/auth/login"
LOGOUT_URL = "/api/v1/auth/logout"
ME_URL = "/api/v1/me"


@pytest.mark.asyncio
async def test_login_success_admin(async_client):
    response = await async_client.post(
        LOGIN_URL, json={"email": "admin@iub.edu.co", "password": "Admin1234!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "admin"
    assert "ra_session" in response.cookies


@pytest.mark.asyncio
async def test_login_wrong_password(async_client):
    response = await async_client.post(
        LOGIN_URL, json={"email": "admin@iub.edu.co", "password": "wrong"}
    )
    assert response.status_code == 401
    assert "ra_session" not in response.cookies


@pytest.mark.asyncio
async def test_login_unknown_email(async_client):
    response = await async_client.post(
        LOGIN_URL, json={"email": "noone@iub.edu.co", "password": "anything"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_rate_limit_sixth_attempt_is_429(async_client):
    payload = {"email": "admin@iub.edu.co", "password": "bad"}
    for _ in range(5):
        await async_client.post(LOGIN_URL, json=payload)
    response = await async_client.post(LOGIN_URL, json=payload)
    assert response.status_code == 429


@pytest.mark.asyncio
async def test_logout_revokes_token(async_client):
    # Login and grab cookie
    login_resp = await async_client.post(
        LOGIN_URL, json={"email": "docente@iub.edu.co", "password": "Docente1234!"}
    )
    assert login_resp.status_code == 200
    session_cookie = login_resp.cookies.get("ra_session")
    assert session_cookie is not None

    # Verify /me works while authenticated
    me_resp = await async_client.get(ME_URL)
    assert me_resp.status_code == 200

    # Logout
    logout_resp = await async_client.post(LOGOUT_URL)
    assert logout_resp.status_code == 200

    # /me must now return 401
    me_after = await async_client.get(ME_URL)
    assert me_after.status_code == 401


@pytest.mark.asyncio
async def test_revoked_token_is_rejected(async_client):
    """Token revoked by logout cannot access protected endpoint (JTI blocklist)."""
    # Login and capture the raw cookie value
    login_resp = await async_client.post(
        LOGIN_URL, json={"email": "lider@iub.edu.co", "password": "Lider1234!"}
    )
    assert login_resp.status_code == 200
    old_cookie = login_resp.cookies.get("ra_session")
    assert old_cookie is not None

    # Logout — this inserts the JTI into revoked_tokens
    logout_resp = await async_client.post(LOGOUT_URL)
    assert logout_resp.status_code == 200

    # Re-inject the old token cookie and verify it is now blocked
    async_client.cookies.set("ra_session", old_cookie)
    response = await async_client.get(ME_URL)
    assert response.status_code == 401
