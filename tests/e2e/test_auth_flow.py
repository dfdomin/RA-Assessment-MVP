import pytest


@pytest.mark.e2e
def test_pw01_login_success(browser_page, base_url_for_e2e):
    browser_page.goto(f"{base_url_for_e2e}/index.html")

    browser_page.fill("#email", "admin@iub.edu.co")
    browser_page.fill("#password", "Admin1234!")

    with browser_page.expect_navigation():
        browser_page.click("#submit-btn")

    assert "dashboard.html" in browser_page.url

    welcome_text = browser_page.text_content("#welcome-msg")
    assert welcome_text is not None
    assert "Administrador Sistema" in welcome_text
    assert "admin" in welcome_text


@pytest.mark.e2e
def test_pw02_login_wrong_password_inline_error(browser_page, base_url_for_e2e):
    browser_page.goto(f"{base_url_for_e2e}/index.html")

    browser_page.fill("#email", "admin@iub.edu.co")
    browser_page.fill("#password", "WrongPassword999!")

    browser_page.click("#submit-btn")

    error_box = browser_page.locator("#login-error")
    error_box.wait_for(state="visible", timeout=8000)

    error_text = error_box.text_content()
    assert error_text is not None
    assert "Credenciales incorrectas" in error_text
    assert "dashboard.html" not in browser_page.url


@pytest.mark.e2e
def test_pw03_logout_revokes_session(browser_page, base_url_for_e2e):
    browser_page.goto(f"{base_url_for_e2e}/index.html")

    browser_page.fill("#email", "admin@iub.edu.co")
    browser_page.fill("#password", "Admin1234!")

    with browser_page.expect_navigation():
        browser_page.click("#submit-btn")

    assert "dashboard.html" in browser_page.url

    browser_page.wait_for_selector("#logout-btn", timeout=5000)

    with browser_page.expect_navigation():
        browser_page.click("#logout-btn")

    assert "index.html" in browser_page.url

    browser_page.goto(f"{base_url_for_e2e}/dashboard.html")
    browser_page.wait_for_load_state("networkidle")

    assert "dashboard.html" not in browser_page.url or browser_page.url.endswith(
        "/index.html"
    )
