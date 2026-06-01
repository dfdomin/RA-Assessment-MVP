import pytest


@pytest.mark.e2e
def test_pw06_teacher_assessment_wizard_blocks_submit_until_ready(
    browser_page,
    base_url_for_e2e,
):
    browser_page.goto(f"{base_url_for_e2e}/index.html")

    browser_page.fill("#email", "docente@iub.edu.co")
    browser_page.fill("#password", "Docente1234!")

    with browser_page.expect_navigation():
        browser_page.click("#submit-btn")

    browser_page.wait_for_selector("#modules-table tbody tr", timeout=8000)
    with browser_page.expect_navigation():
        browser_page.click("text=Calificar")

    browser_page.wait_for_selector(".wizard-steps", timeout=8000)

    assert browser_page.locator('[data-step-target="general"]').is_visible()
    assert browser_page.locator('[data-step-target="grading"]').is_visible()
    assert browser_page.locator('[data-step-target="distribution"]').is_visible()
    assert browser_page.locator('[data-step-target="analysis"]').is_visible()
    assert browser_page.locator('[data-step-target="submit"]').is_visible()
    assert browser_page.locator("#submit-module-btn").is_disabled()

    browser_page.click('[data-step-target="grading"]')
    assert browser_page.locator('[data-step-panel="grading"]').is_visible()

    browser_page.click("#wizard-next-btn")
    assert browser_page.locator('[data-step-panel="distribution"]').is_visible()
