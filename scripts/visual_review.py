#!/usr/bin/env python3
"""
Visual + structural review of RA Assessment MVP views.

Captures screenshots, console errors, and DG-TSI-09-V4 heuristics per view.
Usage:
  python scripts/visual_review.py --base-url http://127.0.0.1:8765
  python scripts/visual_review.py --base-url https://dfdomin.github.io/RA-Assessment-MVP
  REVIEW_EMAIL=... REVIEW_PASSWORD=... python scripts/visual_review.py --base-url ...

Outputs: reviews/visual_<timestamp>/
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

VIEWS = [
    {
        "id": "login",
        "name": "Login",
        "path": "/frontend/index.html",
        "requires_auth": False,
    },
    {
        "id": "dashboard",
        "name": "Dashboard",
        "path": "/frontend/dashboard.html",
        "requires_auth": True,
    },
    {
        "id": "assessment",
        "name": "Wizard calificación",
        "path": "/frontend/assessment.html?module_id=1",
        "requires_auth": True,
    },
]

VIEWPORTS = [
    {"name": "desktop", "width": 1280, "height": 800},
    {"name": "tablet", "width": 1024, "height": 768},
    {"name": "mobile", "width": 390, "height": 844},
]

IUB_PRIMARY = "#1E2843"
IUB_ACCENT = "#FFDF2D"


@dataclass
class ViewReport:
    view_id: str
    viewport: str
    url: str
    title: str
    screenshot: str
    console_errors: list[str] = field(default_factory=list)
    page_errors: list[str] = field(default_factory=list)
    checks: dict[str, Any] = field(default_factory=dict)


def ensure_playwright():
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        print("Install: pip install playwright && playwright install chromium", file=sys.stderr)
        sys.exit(1)


def login_if_needed(page, base_url: str, email: str, password: str) -> bool:
    page.goto(f"{base_url.rstrip('/')}/frontend/index.html", wait_until="networkidle")
    page.fill("#email", email)
    page.fill("#password", password)
    page.click("#submit-btn")
    try:
        page.wait_for_url("**/dashboard.html**", timeout=15000)
        return True
    except Exception:
        pass
    page.wait_for_timeout(3000)
    if "dashboard.html" in page.url:
        return True
    err = page.locator("#login-error").inner_text().strip()
    if err:
        print(f"Login failed: {err}", file=sys.stderr)
    return False


def discover_module_id(page, base_url: str) -> int | None:
    page.goto(f"{base_url.rstrip('/')}/frontend/dashboard.html", wait_until="networkidle")
    page.wait_for_timeout(3000)
    href = page.evaluate(
        """() => {
          const link = document.querySelector('a[href*="assessment.html?module_id="]');
          return link ? link.getAttribute('href') : null;
        }"""
    )
    if not href:
        return None
    import re

    match = re.search(r"module_id=(\d+)", href)
    return int(match.group(1)) if match else None


def collect_dashboard_state(page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
          const status = document.getElementById('modules-status')?.textContent?.trim() || '';
          const welcome = document.getElementById('welcome-msg')?.textContent?.trim() || '';
          const rows = [...document.querySelectorAll('#modules-body tr')].map(tr => tr.textContent.trim());
          const leaderHidden = document.getElementById('leader-panel')?.hidden;
          return { status, welcome, row_count: rows.length, rows_preview: rows.slice(0, 5), leader_panel_hidden: leaderHidden };
        }"""
    )


def collect_checks(page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
          const header = document.querySelector('.site-header');
          const footer = document.querySelector('.site-footer');
          const main = document.querySelector('main');
          const headerBg = header ? getComputedStyle(header).backgroundColor : null;
          const bodyFont = getComputedStyle(document.body).fontFamily;
          const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth + 2;
          const logo = document.querySelector('.site-header .logo, .site-header img');
          const alertHidden = (() => {
            const el = document.getElementById('login-error');
            if (!el) return null;
            return el.textContent.trim() === '' || getComputedStyle(el).display === 'none';
          })();
          const scripts = [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
          const links = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.getAttribute('href'));
          const broken = [];
          for (const src of scripts) {
            if (!src || src.startsWith('http')) continue;
            // relative asset presence checked separately via network
          }
          return {
            has_header: !!header,
            has_footer: !!footer,
            has_main: !!main,
            header_background: headerBg,
            body_font_family: bodyFont,
            horizontal_scroll: hasHorizontalScroll,
            has_logo_element: !!logo,
            login_error_empty: alertHidden,
            script_tags: scripts,
            stylesheet_tags: links,
            document_width: document.documentElement.scrollWidth,
            viewport_width: window.innerWidth,
          };
        }"""
    )


def rgb_matches(hex_color: str, rgb_string: str) -> bool:
    hex_color = hex_color.lstrip("#")
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    expected = {f"rgb({r}, {g}, {b})", f"rgba({r}, {g}, {b}, 1)"}
    return rgb_string.replace(" ", "") in {x.replace(" ", "") for x in expected}


def analyze_report(report: ViewReport) -> list[str]:
    findings: list[str] = []
    c = report.checks

    if report.console_errors:
        findings.append(f"Console errors ({len(report.console_errors)}): " + "; ".join(report.console_errors[:3]))

    if report.page_errors:
        findings.append(f"Page errors: {'; '.join(report.page_errors)}")

    if not c.get("has_header"):
        findings.append("Falta header (DG-TSI: estructura header+contenido+footer)")
    if not c.get("has_footer"):
        findings.append("Falta footer")
    if not c.get("has_main"):
        findings.append("Falta elemento <main>")

    if c.get("horizontal_scroll"):
        findings.append(
            f"Scroll horizontal detectado (doc {c.get('document_width')}px > viewport {c.get('viewport_width')}px)"
        )

    header_bg = c.get("header_background") or ""
    if header_bg and not rgb_matches(IUB_PRIMARY, header_bg):
        findings.append(f"Header color {header_bg} ≠ IUB primario {IUB_PRIMARY}")

    font = (c.get("body_font_family") or "").lower()
    if not any(x in font for x in ("open sans", "arial", "helvetica", "verdana")):
        findings.append(f"Tipografía no IUB: {c.get('body_font_family')}")

    if report.view_id == "login" and c.get("login_error_empty") is False:
        findings.append("Caja de error de login visible al cargar (debería estar oculta)")

    assets = (c.get("script_tags") or []) + (c.get("stylesheet_tags") or [])
    if any(src and "BUILD_SHA" in src for src in assets):
        findings.append(
            "Cache-bust placeholder BUILD_SHA sin inyectar (ejecutar scripts/inject-cache-bust.sh antes de deploy)"
        )

    return findings


def run_review(base_url: str, browser_channel: str | None, email: str | None, password: str | None) -> Path:
    from playwright.sync_api import sync_playwright

    role_tag = os.environ.get("REVIEW_ROLE", "anon")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_dir = ROOT / "reviews" / f"visual_{role_tag}_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    reports: list[ViewReport] = []
    all_findings: dict[str, list[str]] = {}

    with sync_playwright() as p:
        launch_kwargs: dict[str, Any] = {"headless": True}
        if browser_channel:
            launch_kwargs["channel"] = browser_channel
        try:
            browser = p.chromium.launch(**launch_kwargs)
        except Exception:
            browser = p.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        console_errors: list[str] = []
        page_errors: list[str] = []

        def on_console(msg):
            if msg.type in ("error", "warning"):
                console_errors.append(f"[{msg.type}] {msg.text}")

        def on_page_error(err):
            page_errors.append(str(err))

        page.on("console", on_console)
        page.on("pageerror", on_page_error)

        logged_in = False
        module_id: int | None = None
        if email and password:
            logged_in = login_if_needed(page, base_url, email, password)
            auth_info: dict[str, Any] = {"logged_in": logged_in, "email": email}
            if logged_in:
                module_id = discover_module_id(page, base_url)
                auth_info["module_id"] = module_id
                dash_state = collect_dashboard_state(page)
                auth_info["dashboard"] = dash_state
                if dash_state.get("row_count", 0) <= 1:
                    all_findings["dashboard_data"] = [
                        f"Pocos módulos visibles: {dash_state.get('rows_preview')}",
                        f"Estado: {dash_state.get('status')}",
                    ]
                if any("Sin docente" in r for r in dash_state.get("rows_preview", [])):
                    all_findings.setdefault("dashboard_data", []).append(
                        "Módulos con 'Sin docente' en tabla"
                    )
            (out_dir / "auth.json").write_text(
                json.dumps(auth_info, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

        views_to_run = list(VIEWS)
        if module_id:
            views_to_run = [
                v if v["id"] != "assessment"
                else {**v, "path": f"/frontend/assessment.html?module_id={module_id}"}
                for v in views_to_run
            ]
        elif logged_in:
            all_findings["assessment"] = [
                "No se encontró enlace Calificar en dashboard — wizard no capturado"
            ]

        for view in views_to_run:
            if view["requires_auth"] and not logged_in:
                all_findings[view["id"]] = [
                    "Vista requiere auth — define REVIEW_EMAIL y REVIEW_PASSWORD para capturar pantalla autenticada"
                ]
                continue

            for vp in VIEWPORTS:
                console_errors.clear()
                page_errors.clear()
                page.set_viewport_size({"width": vp["width"], "height": vp["height"]})
                url = f"{base_url.rstrip('/')}{view['path']}"
                try:
                    page.goto(url, wait_until="networkidle", timeout=30000)
                    page.wait_for_timeout(1500)
                except Exception as exc:
                    all_findings.setdefault(view["id"], []).append(f"Navigation failed: {exc}")
                    continue

                shot_name = f"{view['id']}_{vp['name']}.png"
                shot_path = out_dir / shot_name
                page.screenshot(path=str(shot_path), full_page=True)

                checks = collect_checks(page)
                report = ViewReport(
                    view_id=view["id"],
                    viewport=vp["name"],
                    url=page.url,
                    title=page.title(),
                    screenshot=shot_name,
                    console_errors=list(console_errors),
                    page_errors=list(page_errors),
                    checks=checks,
                )
                reports.append(report)
                findings = analyze_report(report)
                key = f"{view['id']}_{vp['name']}"
                all_findings[key] = findings

        try:
            page.goto(f"{base_url.rstrip('/')}/frontend/dashboard.html", wait_until="domcontentloaded")
            dash_html = page.content()
            if "api.js" not in dash_html:
                all_findings["deploy_drift"] = [
                    "dashboard.html NO incluye api.js — el deploy remoto puede estar detrás del código local"
                ]
            if "proximamente" in dash_html:
                all_findings["dashboard_stubs"] = [
                    "HTML/JS desplegado aún referencia stubs 'próximamente' para reportes"
                ]
        except Exception:
            pass

        browser.close()

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "browser_channel": browser_channel or "chromium",
        "authenticated": bool(email and password),
        "reports": [asdict(r) for r in reports],
        "findings": all_findings,
    }
    (out_dir / "report.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    md_lines = [
        f"# Visual Review — {base_url}",
        f"Generated: {summary['generated_at']}",
        "",
    ]
    for key, items in all_findings.items():
        md_lines.append(f"## {key}")
        if items:
            for item in items:
                md_lines.append(f"- {item}")
        else:
            md_lines.append("- OK (sin hallazgos automáticos)")
        md_lines.append("")

    for key in ("deploy_drift", "dashboard_stubs"):
        if key in all_findings:
            md_lines.append(f"## {key}")
            for item in all_findings[key]:
                md_lines.append(f"- {item}")
            md_lines.append("")

    (out_dir / "FINDINGS.md").write_text("\n".join(md_lines), encoding="utf-8")
    print(f"Review saved to {out_dir}")
    return out_dir


def main():
    parser = argparse.ArgumentParser(description="RA Assessment MVP visual review")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("REVIEW_BASE_URL", "http://127.0.0.1:8765"),
        help="Base URL (local server or GitHub Pages)",
    )
    parser.add_argument(
        "--browser",
        default=os.environ.get("REVIEW_BROWSER", "chromium"),
        help="Playwright browser channel: chromium, chrome, msedge (fallback a chromium)",
    )
    args = parser.parse_args()

    ensure_playwright()
    email = os.environ.get("REVIEW_EMAIL")
    password = os.environ.get("REVIEW_PASSWORD")
    channel = None if args.browser == "chromium" else args.browser

    run_review(args.base_url, channel, email, password)


if __name__ == "__main__":
    main()
