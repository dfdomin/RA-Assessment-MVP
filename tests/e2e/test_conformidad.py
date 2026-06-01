import pytest


@pytest.mark.e2e
def test_pw04_dg_tsi_09_v4_colors_and_structure(browser_page, base_url_for_e2e):
    browser_page.set_viewport_size({"width": 1366, "height": 768})
    browser_page.goto(f"{base_url_for_e2e}/index.html")

    browser_page.wait_for_selector(".site-header", timeout=5000)

    colors = browser_page.evaluate(
        """
        () => {
          const root = getComputedStyle(document.documentElement);
          const header = getComputedStyle(document.querySelector(".site-header"));
          return {
            primary: root.getPropertyValue("--color-primary").trim(),
            accent: root.getPropertyValue("--color-accent").trim(),
            headerBackground: header.backgroundColor,
            viewportWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            hasFooter: Boolean(document.querySelector(".site-footer")),
            hasLogo: Boolean(document.querySelector(".site-header .logo")),
          };
        }
        """
    )

    assert colors["primary"] == "#1E2843"
    assert colors["accent"] == "#FFDF2D"
    assert colors["headerBackground"] == "rgb(30, 40, 67)"
    assert colors["hasFooter"] is True
    assert colors["hasLogo"] is True
    assert colors["scrollWidth"] <= colors["viewportWidth"]


@pytest.mark.e2e
def test_pw05_teacher_dashboard_shows_modules(browser_page, base_url_for_e2e):
    browser_page.goto(f"{base_url_for_e2e}/index.html")

    browser_page.fill("#email", "docente@iub.edu.co")
    browser_page.fill("#password", "Docente1234!")

    with browser_page.expect_navigation():
        browser_page.click("#submit-btn")

    assert "dashboard.html" in browser_page.url

    browser_page.locator("text=Cálculo Diferencial").wait_for(state="visible", timeout=8000)

    assert "Docente Demo" in browser_page.text_content("#welcome-msg")
    assert browser_page.locator("#period-select").input_value() != ""
    assert browser_page.locator("#modules-table").is_visible()
    assert browser_page.locator("text=Cálculo Diferencial").is_visible()
    assert browser_page.locator("text=A1").is_visible()
    assert browser_page.locator("#modules-table").get_by_text("Docente Demo").is_visible()
    assert browser_page.locator("text=Calificar").is_visible()


@pytest.mark.e2e
def test_pw07_leader_dashboard_shows_editable_analysis_by_pi(browser_page, base_url_for_e2e):
    browser_page.goto(f"{base_url_for_e2e}/index.html")

    browser_page.fill("#email", "lider@iub.edu.co")
    browser_page.fill("#password", "Lider1234!")

    with browser_page.expect_navigation():
        browser_page.click("#submit-btn")

    assert "dashboard.html" in browser_page.url

    browser_page.locator("#leader-panel").wait_for(state="visible", timeout=8000)
    browser_page.locator("text=Análisis del líder").wait_for(state="visible", timeout=8000)

    assert browser_page.locator("#period-progress-bar").is_visible()
    assert browser_page.locator("#view-report-btn").is_visible()
    assert browser_page.locator("#close-period-btn").is_visible()
    assert browser_page.locator("#send-reminder-btn").is_visible()
    browser_page.locator('textarea[data-pi-id]').first.wait_for(state="visible", timeout=8000)

    analysis = browser_page.locator('textarea[data-pi-id]').first
    analysis.fill("El líder identifica avance estable y seguimiento pendiente.")
    browser_page.click("#save-leader-analysis-btn")

    browser_page.locator("text=Análisis del líder guardado.").wait_for(
        state="visible",
        timeout=8000,
    )
