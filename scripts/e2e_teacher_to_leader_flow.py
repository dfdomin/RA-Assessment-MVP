#!/usr/bin/env python3
"""
E2E: docente califica y envía un módulo RA3 → líder consolidador lo ve completado.

Usage:
  PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers python3 scripts/e2e_teacher_to_leader_flow.py

Env opcionales:
  E2E_BASE_URL, TEACHER_PASSWORD, EVALUATION_ID, TEACHER_EMAIL, LEADER_EMAIL
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "final_runs" / f"run_teacher_leader_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

EVALUATION_ID = int(os.getenv("EVALUATION_ID", "19"))
TEACHER_EMAIL = os.getenv("TEACHER_EMAIL", "john.doe@iub.edu.co")
LEADER_EMAIL = os.getenv("LEADER_EMAIL", "john.doe@iub.edu.co")
PERIOD_ID = int(os.getenv("PERIOD_ID", "3"))
PROGRAM_ID = int(os.getenv("PROGRAM_ID", "6"))


def _load_peer_script():
    path = ROOT / "scripts" / "e2e_leader_peer_simulation.py"
    spec = importlib.util.spec_from_file_location("e2e_peers", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def leader_stats(page, period_id: int, program_id: int) -> dict:
    return page.evaluate(
        """async ({ periodId, programId }) => {
      const sb = window.supabase;
      const { data } = await sb.from('module_ra_evaluations')
        .select('id,status,module:modules(course_code,group_name,program_id)')
        .eq('period_id', periodId);
      const scoped = (data || []).filter(r => r.module && String(r.module.program_id) === String(programId));
      return {
        total: scoped.length,
        completed: scoped.filter(r => r.status === 'completed').length,
      };
    }""",
        {"periodId": period_id, "programId": program_id},
    )


def leader_row_for_eval(page, evaluation_id: int) -> dict | None:
    return page.evaluate(
        """async (evalId) => {
      const sb = window.supabase;
      const { data: ev } = await sb.from('module_ra_evaluations')
        .select('id,status,module:modules(course_code,group_name,program_id)')
        .eq('id', evalId)
        .maybeSingle();
      if (!ev) return null;
      return {
        eval_id: ev.id,
        status: ev.status,
        course_code: ev.module?.course_code,
        group_name: ev.module?.group_name,
        program_id: ev.module?.program_id,
      };
    }""",
        evaluation_id,
    )


def complete_grading_visible(page, e2e, step: int) -> None:
    page.click('[data-step-target="grading"]')
    page.wait_for_selector('[data-grading-panel="weights"]', timeout=15000)

    total = page.locator(".weight-total")
    if total.count() and "100" not in (total.first.text_content() or ""):
        inputs = page.locator(".pi-weight-input")
        n = inputs.count()
        if n:
            each = round(100 / n, 2)
            for i in range(n):
                inputs.nth(i).fill(str(each))

    page.click('[data-grading-sub="rubric"]')
    page.wait_for_selector("#rubric-review-ack", timeout=10000)
    if not page.locator("#rubric-review-ack").is_checked():
        page.check("#rubric-review-ack")
    page.click('[data-grading-sub="capture"]')
    page.wait_for_selector(".level-radio", timeout=15000)

    while True:
        all_radios = page.locator(".level-radio[value='4']")
        for i in range(all_radios.count()):
            r = all_radios.nth(i)
            if r.is_visible() and not r.is_checked():
                r.check(force=True)
                page.wait_for_timeout(200)
        page.wait_for_timeout(600)
        next_btn = page.locator("#btn-next-student")
        if next_btn.count() and next_btn.is_visible() and not next_btn.is_disabled():
            next_btn.click()
            page.wait_for_timeout(500)
            continue
        break

    page.wait_for_timeout(1500)
    e2e.log(step, "grading complete for all active students")


def complete_analysis_and_submit(page, e2e, teacher_idx: int, step: int) -> None:
    page.click('[data-step-target="analysis"]')
    page.wait_for_selector('[data-analysis-panel="quantitative"]', timeout=15000)
    page.wait_for_function(
        """() => {
          const btn = document.getElementById('continue-qualitative-btn');
          return !!(btn && btn.offsetParent);
        }""",
        timeout=30000,
    )
    page.click("#continue-qualitative-btn")
    page.wait_for_function(
        """() => {
          const tas = document.querySelectorAll('#analysis-body textarea[data-field=\"analysis\"]');
          return Array.from(tas).some(t => t.offsetParent !== null);
        }""",
        timeout=15000,
    )
    for ta in page.locator('#analysis-body textarea[data-field="analysis"]').all():
        if ta.is_visible() and not ta.input_value().strip():
            ta.fill(f"Análisis E2E docente {teacher_idx}: desempeño adecuado en el indicador.")

    qualitative_fields = [
        ("#conclusions-text", "Conclusiones E2E: el grupo alcanzó niveles esperados."),
        ("#recommendations-text", "Recomendaciones E2E: reforzar casos prácticos."),
        ("#preventive-measures-text", "Medidas preventivas E2E: tutorías semanales."),
        ("#corrective-measures-text", "Medidas correctivas E2E: plan de recuperación."),
        ("#improvement-plan-text", "Plan de mejora E2E: seguimiento próximo ciclo."),
    ]
    for sel, text in qualitative_fields:
        loc = page.locator(sel)
        if loc.count() and loc.is_visible() and not loc.input_value().strip():
            loc.fill(text)

    page.wait_for_timeout(1200)
    page.click('[data-step-target="submit"]')
    page.wait_for_selector("#submit-module-btn", timeout=10000)
    submit = page.locator("#submit-module-btn")
    if submit.is_disabled():
        e2e.shot(page, step, "submit_blocked")
        raise RuntimeError("Submit button still disabled")
    submit.click()
    page.wait_for_selector("text=Módulo enviado", timeout=30000)
    e2e.log(step, "module submitted")


def evaluate_teacher_module(page, e2e, evaluation_id: int, teacher_idx: int, base_step: int) -> None:
    """Complete wizard for one evaluation (roster wait tuned for real modules)."""
    page.goto(f"{e2e.BASE_URL}/assessment.html?evaluation_id={evaluation_id}")
    page.wait_for_selector(".wizard-steps", timeout=30000)
    if e2e.evaluation_status(page, evaluation_id) == "completed":
        e2e.log(base_step, f"skip already completed eval {evaluation_id}")
        return

    page.click('[data-step-target="general"]')
    page.wait_for_timeout(800)
    page.click('[data-step-target="roster"]')
    page.wait_for_selector("#roster-body", timeout=15000)
    page.wait_for_function(
        """() => {
          const status = document.getElementById('assessment-status')?.textContent || '';
          const active = document.querySelectorAll('#roster-body tr .roster-exclude-btn').length;
          return active > 0 || status.includes('Datos cargados') || status.includes('Sin estudiantes');
        }""",
        timeout=20000,
    )
    active = page.locator("#roster-body tr .roster-exclude-btn").count()
    if active < 1:
        e2e.ensure_roster_students(page, teacher_idx, base_step + 1)
    else:
        e2e.log(base_step + 1, f"roster already has {active} active student(s)")

    complete_grading_visible(page, e2e, base_step + 2)
    complete_analysis_and_submit(page, e2e, teacher_idx, base_step + 3)
    e2e.shot(page, base_step + 4, "teacher_submitted")


def verify_leader_sees_module(page, e2e, evaluation_id: int, step: int) -> dict:
    e2e.login(page, LEADER_EMAIL, step)
    page.wait_for_function(
        """() => (document.getElementById('welcome-msg')?.textContent || '').includes('John Doe')""",
        timeout=20000,
    )
    page.select_option("#period-select", str(PERIOD_ID))
    page.wait_for_function(
        """() => {
          const sel = document.getElementById('program-select');
          return sel && !sel.disabled;
        }""",
        timeout=20000,
    )
    page.select_option("#program-select", str(PROGRAM_ID))
    page.wait_for_timeout(3500)

    stats = leader_stats(page, PERIOD_ID, PROGRAM_ID)
    row = leader_row_for_eval(page, evaluation_id)
    ui_progress = page.locator("#period-progress-text").text_content() or ""
    ui_status = page.locator("#modules-status").text_content() or ""

    body_text = page.locator("#modules-body").inner_text()
    module_visible = row and row.get("course_code") and row["course_code"] in body_text

    e2e.shot(page, step + 1, "leader_after_submit")
    result = {
        "leader_email": LEADER_EMAIL,
        "program_stats": stats,
        "evaluation": row,
        "ui_progress": ui_progress.strip(),
        "ui_status": ui_status.strip(),
        "module_visible_in_table": module_visible,
    }
    e2e.log(step + 2, f"leader verify: {json.dumps(result, ensure_ascii=False)}")
    return result


def main() -> int:
    os.environ.setdefault("STUDENTS_PER_MODULE", "1")
    e2e = _load_peer_script()
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    e2e.RUN_DIR = RUN_DIR
    e2e.SCREENSHOTS = RUN_DIR / "screenshots"
    e2e.LOG_PATH = RUN_DIR / "final_script_log.txt"
    if e2e.LOG_PATH.exists():
        e2e.LOG_PATH.unlink()

    e2e.log(0, f"teacher_to_leader eval={EVALUATION_ID} teacher={TEACHER_EMAIL}")

    from playwright.sync_api import sync_playwright

    summary: dict = {"evaluation_id": EVALUATION_ID, "errors": []}

    with sync_playwright() as p:
        browser = e2e.launch_browser(p)
        page = browser.new_context(viewport=e2e.VIEWPORT).new_page()

        try:
            e2e.login(page, LEADER_EMAIL, 1)
            before = leader_stats(page, PERIOD_ID, PROGRAM_ID)
            before_eval = leader_row_for_eval(page, EVALUATION_ID)
            summary["before"] = {"stats": before, "evaluation": before_eval}
            e2e.log(2, f"before leader stats: {json.dumps(summary['before'], ensure_ascii=False)}")
            e2e.logout(page)

            status_before = e2e.evaluation_status(page, EVALUATION_ID)
            if status_before == "completed":
                e2e.log(3, f"eval {EVALUATION_ID} already completed — skipping teacher wizard")
            else:
                summary["target"] = {
                    "evaluation_id": EVALUATION_ID,
                    "teacher_email": TEACHER_EMAIL,
                    "course_code": before_eval.get("course_code") if before_eval else "?",
                    "group_name": before_eval.get("group_name") if before_eval else "?",
                }
                e2e.login(page, TEACHER_EMAIL, 10)
                evaluate_teacher_module(page, e2e, EVALUATION_ID, 1, 10)
                e2e.logout(page)
                status_after = e2e.evaluation_status(page, EVALUATION_ID)
                summary["teacher_status_after"] = status_after
                if status_after != "completed":
                    summary["errors"].append(f"Teacher submit did not set completed (got {status_after})")

            leader_result = verify_leader_sees_module(page, e2e, EVALUATION_ID, 900)
            summary["leader"] = leader_result
            after_stats = leader_result["program_stats"]
            ev = leader_result.get("evaluation") or {}

            if ev.get("status") != "completed":
                summary["errors"].append(f"Leader still sees status={ev.get('status')}")
            if after_stats.get("completed", 0) <= before.get("completed", 0) and status_before != "completed":
                summary["errors"].append(
                    f"Completed count did not increase: {before.get('completed')} -> {after_stats.get('completed')}"
                )

        finally:
            page.context.close()
            browser.close()

    out = RUN_DIR / "summary.json"
    out.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    e2e.log(999, f"DONE summary={out}")

    print("\n=== Resultado E2E docente → líder ===")
    print(f"Evaluación: {EVALUATION_ID}")
    before_s = summary.get("before", {}).get("stats", {})
    leader_s = (summary.get("leader") or {}).get("program_stats", {})
    print(f"Completados CE/RA3: {before_s.get('completed', '?')} → {leader_s.get('completed', '?')} / {leader_s.get('total', '?')}")
    print(f"Estado eval: {(summary.get('leader') or {}).get('evaluation', {}).get('status', '?')}")
    print(f"UI progreso: {(summary.get('leader') or {}).get('ui_progress', '?')}")
    if summary["errors"]:
        print("Errores:")
        for err in summary["errors"]:
            print(f"  - {err}")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
