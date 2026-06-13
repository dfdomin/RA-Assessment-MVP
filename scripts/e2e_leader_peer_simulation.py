#!/usr/bin/env python3
"""
Simula evaluaciones de N docentes (3 estudiantes c/u) para el mismo RA que Paulo Munarriz,
y verifica el panel del líder consolidador con Playwright.

Uso:
  PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers python3 scripts/e2e_leader_peer_simulation.py

Variables opcionales:
  E2E_BASE_URL          (default: GitHub Pages frontend)
  TEACHER_PASSWORD      (default: Demo1234!)
  REFERENCE_TEACHER     (default: paulo.munarriz@iub.edu.co)
  LEADER_EMAIL          (default: john.doe@iub.edu.co)
  PEER_COUNT            (default: 15)
  STUDENTS_PER_MODULE   (default: 3)
  HEADED                (1 = browser visible)
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN_ID = datetime.now().strftime("%Y%m%d_%H%M%S")
RUN_DIR = ROOT / "final_runs" / f"run_leader_peers_{RUN_ID}"
SCREENSHOTS = RUN_DIR / "screenshots"
LOG_PATH = RUN_DIR / "final_script_log.txt"

BASE_URL = os.getenv(
    "E2E_BASE_URL",
    "https://dfdomin.github.io/RA-Assessment-MVP/frontend",
).rstrip("/")
PASSWORD = os.getenv("TEACHER_PASSWORD", "Demo1234!")
REFERENCE_TEACHER = os.getenv("REFERENCE_TEACHER", "paulo.munarriz@iub.edu.co")
LEADER_EMAIL = os.getenv("LEADER_EMAIL", "john.doe@iub.edu.co")
PEER_COUNT = int(os.getenv("PEER_COUNT", "15"))
REFERENCE_EVALUATION_ID = os.getenv("REFERENCE_EVALUATION_ID", "")
STUDENTS_PER_MODULE = int(os.getenv("STUDENTS_PER_MODULE", "3"))
HEADED = os.getenv("HEADED", "0") == "1"
LEADER_ONLY = os.getenv("LEADER_ONLY", "0") == "1"
VIEWPORT = {"width": 1280, "height": 1800}
CHROME_BIN = ROOT / ".playwright-browsers/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"


def launch_browser(playwright):
    kwargs = {"headless": not HEADED, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
    if CHROME_BIN.exists():
        kwargs["executable_path"] = str(CHROME_BIN)
    return playwright.chromium.launch(**kwargs)


def log(step: int, action: str) -> None:
    line = f"step {step} action: {action}\n"
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(line)
    print(line, end="")


def shot(page, step: int, name: str) -> None:
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    path = SCREENSHOTS / f"final_execution_{step:02d}_{name}.png"
    page.screenshot(path=str(path))


def login(page, email: str, step: int) -> None:
    page.goto(f"{BASE_URL}/index.html")
    page.wait_for_selector("#email", timeout=20000)
    page.fill("#email", email)
    page.fill("#password", PASSWORD)
    with page.expect_navigation(timeout=30000):
        page.click("#submit-btn")
    page.wait_for_selector("#modules-table", timeout=30000)
    log(step, f"login ok as {email}")


def logout(page) -> None:
    btn = page.locator("#logout-btn")
    if btn.count():
        btn.click()
        page.wait_for_url(re.compile(r"index\.html"), timeout=15000)


def discover_reference_ra(page, forced_eval_id: str = "") -> dict:
    """Obtiene period_id y program_id del RA evaluado por Paulo (vía sesión autenticada)."""
    return page.evaluate(
        """async ({ refEmail, forcedEvalId }) => {
      const sb = window.supabase;
      const forcedId = forcedEvalId ? Number(forcedEvalId) : null;
      if (forcedId) {
        const { data: pick } = await sb.from('module_ra_evaluations')
          .select('id,status,period_id,module:modules(id,course_code,group_name,program_id,program:programs(name)),period:periods(name,student_outcome_id,student_outcome:student_outcomes(code))')
          .eq('id', forcedId)
          .maybeSingle();
        if (!pick) throw new Error('Reference evaluation not found: ' + forcedId);
        return {
          evaluation_id: pick.id,
          period_id: pick.period_id,
          period_name: pick.period && pick.period.name,
          ra_code: pick.period && pick.period.student_outcome && pick.period.student_outcome.code,
          student_outcome_id: pick.period && pick.period.student_outcome_id,
          program_id: pick.module && pick.module.program_id,
          program_name: pick.module && pick.module.program && pick.module.program.name,
          module_code: pick.module && pick.module.course_code,
          module_group: pick.module && pick.module.group_name,
          status: pick.status,
        };
      }
      const { data: users } = await sb.from('users').select('id,email').eq('email', refEmail).limit(1);
      if (!users || !users.length) throw new Error('Reference teacher not found: ' + refEmail);
      const uid = users[0].id;
      const { data: staff } = await sb.from('module_staff').select('module_id').eq('user_id', uid);
      const moduleIds = (staff || []).map(r => r.module_id);
      if (!moduleIds.length) throw new Error('Reference teacher has no modules');
      const { data: evals } = await sb.from('module_ra_evaluations')
        .select('id,status,period_id,module:modules(id,course_code,group_name,program_id,program:programs(name)),period:periods(name,student_outcome_id,student_outcome:student_outcomes(code))')
        .in('module_id', moduleIds);
      const ra3 = (evals || []).filter(e => e.period && e.period.student_outcome && e.period.student_outcome.code === 'RA3');
      const pick = ra3.find(e => e.status === 'completed') || ra3[0] || evals[0];
      if (!pick) throw new Error('No evaluations for reference teacher');
      return {
        evaluation_id: pick.id,
        period_id: pick.period_id,
        period_name: pick.period && pick.period.name,
        ra_code: pick.period && pick.period.student_outcome && pick.period.student_outcome.code,
        student_outcome_id: pick.period && pick.period.student_outcome_id,
        program_id: pick.module && pick.module.program_id,
        program_name: pick.module && pick.module.program && pick.module.program.name,
        module_code: pick.module && pick.module.course_code,
        module_group: pick.module && pick.module.group_name,
        status: pick.status,
      };
    }""",
        {"refEmail": REFERENCE_TEACHER, "forcedEvalId": forced_eval_id},
    )


def discover_leader_email(page, program_id: int, student_outcome_id: int | None) -> str:
    found = page.evaluate(
        """async ({ programId, studentOutcomeId }) => {
      const { data } = await window.supabase.from('ra_consolidator_assignments')
        .select('consolidator:users(email,full_name,role)')
        .eq('program_id', programId)
        .eq('student_outcome_id', studentOutcomeId)
        .limit(1)
        .maybeSingle();
      return data && data.consolidator ? data.consolidator : null;
    }""",
        {"programId": program_id, "studentOutcomeId": student_outcome_id},
    )
    if not found or not found.get("email"):
        return LEADER_EMAIL
    log(2, f"leader from mapping: {found.get('full_name')} <{found.get('email')}> role={found.get('role')}")
    return found["email"]


def resolve_leader_program(page, _period_id: int, student_outcome_id: int | None, program_id: int | None) -> dict:
    """Si program_id falta en el módulo, toma el programa asignado al líder para ese RA."""
    if program_id:
        return {"program_id": program_id}
    return page.evaluate(
        """async ({ leaderEmail, studentOutcomeId }) => {
      const sb = window.supabase;
      const { data: leader } = await sb.from('users').select('id').eq('email', leaderEmail).maybeSingle();
      if (!leader) throw new Error('Leader not found');
      const { data: rows } = await sb.from('ra_consolidator_assignments')
        .select('program_id, program:programs(name)')
        .eq('consolidator_user_id', leader.id)
        .eq('student_outcome_id', studentOutcomeId);
      if (!rows || !rows.length) throw new Error('Leader has no program assignment for this RA');
      const first = rows[0];
      return {
        program_id: first.program_id,
        program_name: first.program && first.program.name,
      };
    }""",
        {"leaderEmail": LEADER_EMAIL, "studentOutcomeId": student_outcome_id},
    )


def discover_peer_modules(page, period_id: int, program_id: int, ref_eval_id: int) -> list[dict]:
    return page.evaluate(
        """async ({ periodId, programId, refEvalId, refEmail, limit }) => {
      const sb = window.supabase;
      const { data: refUser } = await sb.from('users').select('id').eq('email', refEmail).maybeSingle();
      const refUid = refUser ? refUser.id : null;
      const { data: rows } = await sb.from('module_ra_evaluations')
        .select('id,status,module:modules(id,course_code,group_name,program_id,module_staff(user_id,users(email,full_name)))')
        .eq('period_id', periodId);
      const seenTeachers = new Set();
      const out = [];
      for (const r of (rows || [])) {
        if (!r.module || r.id === refEvalId) continue;
        if (programId && String(r.module.program_id) !== String(programId)) continue;
        if (r.status === 'completed') continue;
        const staff = (r.module.module_staff || [])[0];
        if (!staff || !staff.users || !staff.users.email) continue;
        if (refUid && staff.user_id === refUid) continue;
        if (seenTeachers.has(staff.users.email)) continue;
        seenTeachers.add(staff.users.email);
        out.push({
          evaluation_id: r.id,
          status: r.status,
          course_code: r.module.course_code,
          group_name: r.module.group_name,
          teacher_email: staff.users.email,
          teacher_name: staff.users.full_name,
        });
        if (out.length >= limit) break;
      }
      return out;
    }""",
        {
            "periodId": period_id,
            "programId": program_id,
            "refEvalId": ref_eval_id,
            "refEmail": REFERENCE_TEACHER,
            "limit": PEER_COUNT,
        },
    )


def evaluation_status(page, evaluation_id: int) -> str:
    return page.evaluate(
        """async (evalId) => {
      const { data } = await window.supabase.from('module_ra_evaluations')
        .select('status').eq('id', evalId).maybeSingle();
      return (data && data.status) || '';
    }""",
        evaluation_id,
    )


def ensure_roster_students(page, teacher_idx: int, step: int) -> None:
    page.click('[data-step-target="roster"]')
    page.wait_for_selector("#roster-body", timeout=15000)

    active_rows = page.locator("#roster-body tr:not(.roster-empty-row)")
    active_count = active_rows.count()

    if active_count < STUDENTS_PER_MODULE:
        toggle = page.locator("#roster-manual-toggle")
        if toggle.count() and not toggle.is_checked():
            toggle.check()
        page.wait_for_selector("#roster-manual-block:not([hidden])", timeout=5000)
        for i in range(STUDENTS_PER_MODULE - active_count):
            doc = f"990{teacher_idx:02d}{i+1:02d}"
            name = f"Estudiante E2E T{teacher_idx} S{i+1}"
            page.fill("#roster-manual-doc", doc)
            page.fill("#roster-manual-name", name)
            page.click("#roster-manual-add-btn")
            page.wait_for_timeout(800)
        page.wait_for_timeout(1000)

    while page.locator("#roster-body tr .roster-exclude-btn").count() > STUDENTS_PER_MODULE:
        btn = page.locator("#roster-body tr .roster-exclude-btn").first
        btn.click()
        page.wait_for_selector("#roster-exclude-dialog:not([hidden])", timeout=5000)
        page.select_option("#roster-exclude-reason", "other")
        page.locator("#roster-exclude-form button[type='submit']").click()
        page.wait_for_timeout(600)

    final_active = page.locator("#roster-body tr .roster-exclude-btn").count()
    if final_active != STUDENTS_PER_MODULE:
        shot(page, step, f"roster_unexpected_count_{final_active}")
        raise RuntimeError(f"Expected {STUDENTS_PER_MODULE} active students, got {final_active}")
    log(step, f"roster ready with {STUDENTS_PER_MODULE} students")


def complete_grading(page, step: int) -> None:
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
        radios = page.locator(".level-radio[value='4']")
        count = radios.count()
        for i in range(count):
            r = radios.nth(i)
            if not r.is_checked():
                r.check(force=True)
                page.wait_for_timeout(150)
        page.wait_for_timeout(500)
        next_btn = page.locator("#btn-next-student")
        if next_btn.count() and next_btn.is_visible() and not next_btn.is_disabled():
            next_btn.click()
            page.wait_for_timeout(400)
            continue
        break

    page.wait_for_timeout(800)
    log(step, "grading complete for all active students")


def complete_analysis_and_submit(page, teacher_idx: int, step: int) -> None:
    page.click('[data-step-target="analysis"]')
    page.wait_for_selector('[data-analysis-panel="quantitative"]', timeout=15000)
    cont = page.locator("#continue-qualitative-btn")
    if cont.count() and cont.is_visible():
        cont.click()
    else:
        page.click('[data-analysis-sub="qualitative"]')

    page.wait_for_selector("#analysis-body textarea", timeout=15000)
    for ta in page.locator("#analysis-body textarea[data-field='analysis']").all():
        if not ta.input_value().strip():
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
        if loc.count() and not loc.input_value().strip():
            loc.fill(text)

    page.wait_for_timeout(1200)
    page.click('[data-step-target="submit"]')
    page.wait_for_selector("#submit-module-btn", timeout=10000)
    submit = page.locator("#submit-module-btn")
    if submit.is_disabled():
        shot(page, step, "submit_blocked")
        raise RuntimeError("Submit button still disabled")
    submit.click()
    page.wait_for_selector("text=Módulo enviado", timeout=30000)
    log(step, "module submitted")


def evaluate_as_teacher(page, peer: dict, idx: int, base_step: int) -> None:
    email = peer["teacher_email"]
    eval_id = peer["evaluation_id"]
    login(page, email, base_step)
    page.goto(f"{BASE_URL}/assessment.html?evaluation_id={eval_id}")
    page.wait_for_selector(".wizard-steps", timeout=30000)

    if evaluation_status(page, eval_id) == "completed":
        log(base_step, f"skip already completed eval {eval_id} ({email})")
        return

    page.click('[data-step-target="general"]')
    ensure_roster_students(page, idx, base_step + 1)
    complete_grading(page, base_step + 2)
    complete_analysis_and_submit(page, idx, base_step + 3)
    shot(page, base_step + 4, f"teacher_{idx}_submitted")
    logout(page)


def count_program_modules(page, period_id: int, program_id: int) -> dict:
    return page.evaluate(
        """async ({ periodId, programId }) => {
      const { data: rows } = await window.supabase.from('module_ra_evaluations')
        .select('id,status,module:modules(program_id)')
        .eq('period_id', periodId);
      const scoped = (rows || []).filter(r => r.module && String(r.module.program_id) === String(programId));
      return {
        total: scoped.length,
        completed: scoped.filter(r => r.status === 'completed').length,
        pending: scoped.filter(r => r.status !== 'completed').length,
      };
    }""",
        {"periodId": period_id, "programId": program_id},
    )


def verify_leader_dashboard(page, ref: dict, leader_email: str, step: int) -> dict:
    login(page, leader_email, step)
    page.wait_for_function(
        """() => {
          const t = document.getElementById('welcome-msg')?.textContent || '';
          return /\\(leader\\)|\\(teacher\\)|\\(admin\\)/.test(t);
        }""",
        timeout=20000,
    )
    welcome = page.locator("#welcome-msg").text_content() or ""
    page.select_option("#period-select", str(ref["period_id"]))
    page.wait_for_timeout(1500)
    if page.locator("#program-select").count() and not page.locator("#program-select").is_hidden():
        page.select_option("#program-select", str(ref["program_id"]))
        page.wait_for_timeout(2000)

    leader_visible = page.locator("#leader-panel").is_visible()
    if not leader_visible:
        shot(page, step + 1, "leader_panel_hidden")
        raise RuntimeError(
            f"Panel líder no visible para {leader_email}. Bienvenida: {welcome.strip()}"
        )

    page.wait_for_selector("#leader-analysis-list", timeout=15000)
    progress = page.locator("#period-progress-text").text_content() or ""
    modules_status = page.locator("#modules-status").text_content() or ""
    module_rows = page.locator("#modules-body tr").count()
    leader_analysis = page.locator("#leader-analysis-list textarea").count()
    review_links = page.locator("#modules-body a.table-action", has_text="Revisar").count()

    shot(page, step + 1, "leader_dashboard")
    result = {
        "leader_email": leader_email,
        "welcome": welcome.strip(),
        "progress_text": progress.strip(),
        "modules_status": modules_status.strip(),
        "module_rows": module_rows,
        "review_links": review_links,
        "leader_analysis_fields": leader_analysis,
        "period": ref["period_name"],
        "program": ref["program_name"],
        "ra": ref["ra_code"],
    }
    log(step + 2, f"leader dashboard: {json.dumps(result, ensure_ascii=False)}")
    return result


def main() -> int:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    if LOG_PATH.exists():
        LOG_PATH.unlink()

    log(0, f"params base_url={BASE_URL} leader_only={LEADER_ONLY} peers={PEER_COUNT}")

    from playwright.sync_api import sync_playwright

    summary: dict = {"reference": None, "peers": [], "leader": None, "errors": []}

    with sync_playwright() as p:
        browser = launch_browser(p)
        context = browser.new_context(viewport=VIEWPORT)
        page = context.new_page()

        try:
            login(page, REFERENCE_TEACHER, 1)
            ref = discover_reference_ra(page, REFERENCE_EVALUATION_ID)
            if not ref.get("program_id"):
                prog = resolve_leader_program(
                    page,
                    ref["period_id"],
                    ref.get("student_outcome_id"),
                    ref.get("program_id"),
                )
                ref.update(prog)
            summary["reference"] = ref
            leader_email = discover_leader_email(
                page, ref["program_id"], ref.get("student_outcome_id")
            )
            ref["leader_email"] = leader_email
            log(2, f"reference RA: {json.dumps(ref, ensure_ascii=False)}")
            stats = count_program_modules(page, ref["period_id"], ref["program_id"])
            summary["program_stats"] = stats
            log(3, f"program stats: {json.dumps(stats)}")
            shot(page, 2, "reference_teacher_dashboard")

            logout(page)

            if LEADER_ONLY:
                log(5, "modo LEADER_ONLY: omitiendo simulación de docentes")
            else:
                login(page, leader_email, 4)
                peers = discover_peer_modules(
                    page,
                    ref["period_id"],
                    ref["program_id"],
                    ref["evaluation_id"],
                )
                summary["peers_planned"] = peers
                log(4, f"found {len(peers)} peer modules (need {PEER_COUNT})")
                shot(page, 4, "leader_modules_overview")

                if len(peers) < PEER_COUNT:
                    msg = (
                        f"Solo {len(peers)} módulos pendientes para simular "
                        f"(ya hay {stats.get('completed', 0)}/{stats.get('total', 0)} completados en el programa)."
                    )
                    summary["warnings"] = summary.get("warnings", []) + [msg]
                    log(4, msg)

                logout(page)

                if not peers:
                    log(5, "sin módulos pendientes: se omite simulación docente y solo se verifica panel líder")
                else:
                    for idx, peer in enumerate(peers[:PEER_COUNT], start=1):
                        try:
                            evaluate_as_teacher(page, peer, idx, 10 + idx * 10)
                            summary["peers"].append({"peer": peer, "ok": True})
                        except Exception as exc:  # noqa: BLE001
                            summary["peers"].append({"peer": peer, "ok": False, "error": str(exc)})
                            summary["errors"].append(f"{peer.get('teacher_email')}: {exc}")
                            shot(page, 10 + idx * 10 + 9, f"teacher_{idx}_error")
                            logout(page)

            summary["leader"] = verify_leader_dashboard(page, ref, leader_email, 900)

        finally:
            context.close()
            browser.close()

    out_json = RUN_DIR / "summary.json"
    out_json.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    log(999, f"DONE summary={out_json}")

    ok_peers = sum(1 for p in summary.get("peers", []) if p.get("ok"))
    ref = summary.get("reference") or {}
    stats = summary.get("program_stats") or {}
    print(f"\n=== Resultado ===")
    print(
        f"Referencia: {ref.get('period_name', '?')} · {ref.get('program_name', '?')} "
        f"· eval {ref.get('evaluation_id', '?')} ({ref.get('status', '?')})"
    )
    print(f"Programa: {stats.get('completed', '?')}/{stats.get('total', '?')} módulos completados en BD")
    print(f"Pares simulados en esta corrida: {ok_peers}/{min(len(summary.get('peers_planned', [])), PEER_COUNT)}")
    if summary.get("leader"):
        ld = summary["leader"]
        print(
            f"Líder ({ld.get('leader_email')}): {ld.get('progress_text')} · "
            f"filas={ld.get('module_rows')} · revisar={ld.get('review_links')} · "
            f"análisis PI={ld.get('leader_analysis_fields')}"
        )
    for w in summary.get("warnings", []):
        print(f"Aviso: {w}")
    if summary["errors"]:
        print("Errores:")
        for err in summary["errors"]:
            print(f"  - {err}")
        return 1
    if summary.get("leader") and summary["leader"].get("module_rows", 0) < 2:
        print("Error: el líder ve muy pocos módulos en la tabla.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
