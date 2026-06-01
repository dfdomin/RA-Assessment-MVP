# Council Transcript — Infraestructura externa RA Assessment App

**Timestamp**: 2026-05-18 13:47 -0500  
**Skill**: `$llm-council`  
**Question type**: decisión metodológica/arquitectónica con impacto en TDD, spec-driven development, staging y calidad de pruebas.

---

## Original Question

Necesito que se empiecen a implementar tareas que corresponden a infraestructura externa, es decir, la base de datos, servidor http, etc. Mi punto de vista es porque así se podrán hacer mejores test. Sin embargo, como no soy experto en la metodología spec-driven development ni en la de Test Driven Development, acudo al `$llm-council` para que haga un veredicto y nos indique cuál es la mejor decisión.

---

## Framed Question

Decision: Should the RA Assessment App project start implementing external infrastructure tasks now (PostgreSQL real/staging database, HTTP server/Caddy, hardening, fail2ban, backups) instead of continuing only with application features, so that testing quality improves?

Project context: The RA Assessment App is a FastAPI + SQLAlchemy async + PostgreSQL 16 + static HTML/JS app for IUB ABET assessment workflows. The codebase currently has S1-S4 feature slices largely implemented. Current test evidence: 174/174 local tests passing, 5 PostgreSQL opt-in tests skipped because `TEST_PG_URL` is not defined. Existing tests use SQLite StaticPool plus Playwright E2E server with SQLite. PRD says external infrastructure is Hetzner CAX11 ARM64, Caddy 2, PostgreSQL 16, backups GPG/R2. `NEXT_STEPS` lists INFRA-01 hardening, INFRA-02 Caddy TLS, INFRA-03 fail2ban, INFRA-04 GPG backups as parallel tasks, and E2E-PG-02 is blocked until a real PostgreSQL staging URL exists. S5 pending includes F15 bulk admin CSV/Excel imports and F16 `file_adapter`; PRD S5 gate includes backups GPG and parser testing. The user is not an expert in spec-driven/TDD and wants a verdict on whether infrastructure should begin now to enable better tests.

What's at stake: If infrastructure starts too early, it can distract from app features and introduce ops complexity. If it starts too late, tests may keep missing PostgreSQL/Caddy/deploy/security behavior and the project may accumulate false confidence from SQLite-only tests.

---

## Advisor Responses

### The Contrarian

Yes, start infrastructure now, but only the minimum staging spine. The fatal flaw in continuing feature-only is that your “174/174 passing” is increasingly a comfort metric, not a reliability metric.

SQLite is not PostgreSQL. It will not catch the same transaction behavior, constraint behavior, type behavior, migration issues, async driver issues, concurrency problems, connection pooling failures, encoding quirks, or deployment-time environment mistakes. Worse, every new feature built on SQLite-only confidence increases the surface area you may later have to debug under real PostgreSQL.

The risk is not “ops distraction.” The bigger risk is building F15/F16 imports, file parsing, backups-adjacent workflows, and assessment data paths without the database and deployment assumptions they will actually run under. That is how projects get a green test suite and still fail at staging.

But do not implement the whole infrastructure wishlist as a grand ops campaign. That is the trap. Do not start with hardening, fail2ban, backups, Caddy polish, and deployment ceremonies all at once. Start with the smallest thing that unblocks truth:

1. Real PostgreSQL staging database.
2. `TEST_PG_URL` wired into CI or opt-in local workflow.
3. Existing skipped PostgreSQL tests running.
4. One deployed/staging FastAPI instance behind the intended HTTP path.
5. Basic smoke/E2E against staging.

Backups matter, but they do not improve test quality before there is real data behavior to test. Fail2ban also does not unblock application correctness. Caddy matters once HTTP behavior, TLS, static file serving, uploads, headers, and routing become part of your test surface.

Verdict: begin infrastructure now, narrowly. Treat it as test infrastructure, not production ops. The project has reached the point where avoiding staging is no longer discipline; it is delaying contact with reality.

### The First Principles Thinker

The real problem is not “infrastructure vs features.” It is evidence quality.

Right now the project can prove that the app works in a local SQLite-shaped universe. But the declared production universe is PostgreSQL 16 behind Caddy on Hetzner, with backups and operational constraints. If the app’s acceptance standard is institutional reliability, then SQLite-only passing tests are not enough evidence. They are useful, but incomplete.

So yes: start external infrastructure now, but only the minimum slice that converts skipped assumptions into runnable evidence.

Do not start by “doing ops.” Start by creating a staging test substrate:

1. Provision a real PostgreSQL staging database.
2. Wire `TEST_PG_URL` into CI or a repeatable local/staging test path.
3. Run the existing 5 skipped PostgreSQL tests.
4. Add at least one Playwright/E2E path against the app using PostgreSQL.
5. Add backup/restore proof before S5 import work becomes serious.

Caddy, TLS, hardening, and fail2ban matter, but they are secondary unless they affect deployability or security tests now. The first principles question is: “What claims are we making that we cannot currently verify?” The answer is PostgreSQL behavior, deployed HTTP behavior, and backup recoverability.

F15/F16 imports especially should not be built on untested persistence assumptions. Bulk import is exactly where PostgreSQL constraints, transactions, encoding, file handling, and rollback behavior matter.

Verdict: begin infrastructure now, not as a parallel hobby project, but as a testing-enabler milestone. The next feature slice should run against the same class of system the institution will actually depend on.

### The Expansionist

Yes, start external infrastructure now, but treat it as a product accelerator, not an ops side quest.

The upside is bigger than “better tests.” A real PostgreSQL staging environment turns the app from a local prototype with good unit coverage into an institutional system that can be trusted under deployment conditions. Right now, 174 passing tests prove discipline, but they do not prove the real stack: PostgreSQL behavior, async DB pooling, migrations, Caddy routing, TLS boundaries, upload limits, backup recovery, and production-like failure modes. Those are not cosmetic. They are where confidence compounds.

This is especially valuable before S5. Bulk CSV/Excel imports and file adapters are exactly the kind of features that can quietly break under real database constraints, transaction semantics, encoding issues, file size limits, timeout behavior, and recovery needs. Waiting until after S5 means you may build the most operationally sensitive slice against the least representative environment.

The hidden opportunity: infrastructure unlocks a staging discipline the user can understand. Instead of abstract TDD/spec-driven rituals, the project gets a simple quality ladder: local SQLite tests, opt-in PostgreSQL tests, staging E2E, backup restore proof. That is legible, repeatable, and confidence-building.

Do it now, but define a narrow infra milestone: provision PostgreSQL staging, set `TEST_PG_URL`, run the skipped tests, add Caddy staging access, implement backup/restore smoke test. Do not boil the ocean. The goal is not “become DevOps”; the goal is to make every future feature prove itself against the world it will actually live in.

### The Outsider

Yes, start external infrastructure now, but only the minimum version that unlocks better testing.

From the outside, the current evidence has a blind spot: the app claims PostgreSQL 16 as part of the stack, but the main test suite is proving behavior mostly against SQLite. That is useful, but it is not the same system. The five skipped PostgreSQL tests are the giveaway: the project already knows what it cannot verify because `TEST_PG_URL` is missing.

Do not frame this as “pause product work and become an ops project.” Frame it as creating a staging test substrate.

Implement now:

1. A real PostgreSQL staging database.
2. A stable `TEST_PG_URL` workflow.
3. Caddy/HTTP staging deployment if browser/E2E behavior depends on production-like routing, TLS, headers, static serving, or uploads.
4. Basic backups before S5 file/import work becomes important.
5. Enough hardening to avoid an exposed toy server, not a grand security program.

Do not overbuild:

- No elaborate multi-environment platform.
- No Kubernetes-style detour.
- No perfect observability stack.
- No weeks spent polishing server automation before F15/F16.

The clearest reason to start now is that S5 includes bulk imports, file adapter work, parser testing, and backup gates. Those are exactly the kinds of features where SQLite-only confidence is weakest and where real PostgreSQL, file storage behavior, deployment limits, and recovery assumptions matter.

Verdict: begin infrastructure now as a test-enabling slice, not as a full operations phase. The project has enough app surface area to justify it, and waiting longer will make the test evidence look stronger than it really is.

### The Executor

Yes, start infrastructure now, but only the smallest slice that unblocks better testing.

Monday morning path: provision a staging PostgreSQL 16 database and define `TEST_PG_URL`. That is the immediate bottleneck. You already have 5 PostgreSQL tests skipped, and E2E-PG-02 is explicitly blocked. Stop accepting “174/174 passing” as complete evidence when the production database is PostgreSQL and the main E2E path still runs on SQLite.

Do not start with the whole ops wishlist. Do not disappear into hardening, fail2ban tuning, backup architecture, and Caddy polishing before the app has a staging test target. The fastest useful move is:

1. Create a real staging Postgres instance.
2. Add `.env.example` / docs for `TEST_PG_URL`.
3. Run the skipped PostgreSQL tests in CI or a documented local command.
4. Add one Playwright E2E mode against FastAPI + PostgreSQL.
5. Only then add Caddy/TLS staging smoke tests.
6. Implement GPG/R2 backups before the S5 gate, because the PRD requires it and imports raise data-loss stakes.

This is not “ops for ops’ sake.” It is test infrastructure. The project is already past the point where SQLite-only confidence is enough. SQLAlchemy async behavior, PostgreSQL constraints, transactions, migrations, connection pooling, deployment headers, file upload limits, and reverse proxy behavior are exactly where late surprises happen.

Verdict: begin infrastructure now, narrowly. First deliver staging PostgreSQL and test wiring. Treat Caddy, hardening, fail2ban, and backups as sequenced follow-ons, not a giant detour.

---

## Peer Reviews

**Anonymization mapping:**
- Response A: The Executor
- Response B: The Contrarian
- Response C: The Outsider
- Response D: The Expansionist
- Response E: The First Principles Thinker

### Review 1

1. **Strongest: Response A.** It gives the clearest execution order: staging PostgreSQL, `TEST_PG_URL`, run skipped tests, add PostgreSQL E2E, then Caddy smoke tests, then GPG/R2 backups before S5. It avoids the false binary and turns the decision into a sequenced testing milestone. It is also the most actionable for a non-expert user because it names the Monday-morning next step.

2. **Biggest Blind Spot: Response D.** D is directionally right, but it over-expands the mission. “Async pooling, migrations, Caddy routing, TLS boundaries, upload limits, backup recovery, production-like failure modes” is valid, but for this decision it risks making infrastructure feel like a broad platform program. It underemphasizes strict scope control and could pull the project away from S5 feature delivery.

3. **What All Five Missed:** They did not explicitly require a definition of done for the infrastructure slice. The project needs a hard gate like: “PostgreSQL staging is complete only when CI or a documented command runs PG tests, at least one E2E flow uses PG, migrations apply cleanly from empty DB, and backup restore has been tested once.” They also missed cost/ownership: who maintains the server, secrets, failures, backups, and credentials after setup?

### Review 2

1. Strongest: **Response A**. It gives the clearest execution path: Postgres staging, `TEST_PG_URL`, run skipped tests, add CI/local command, add Playwright against FastAPI + PostgreSQL, then Caddy smoke tests, then backups before S5. It turns the verdict into an ordered implementation slice instead of just a principle.

2. Biggest blind spot: **Response D**. It is strategically right, but it expands the ambition too much. “Institutional system trusted under deployment conditions” and “quality ladder” are good framing, but it risks encouraging the exact ops expansion the decision is trying to avoid. It under-specifies the boundary between minimum test-enabling infrastructure and a broader production-readiness campaign.

3. What all five missed: ownership, cost, and rollback criteria. They say “start infrastructure now,” but not who owns it, how much time is allowed, or what counts as done. The council should recommend a strict timebox and exit criteria, for example: one week, staging Postgres available, skipped PG tests running, one PG-backed E2E path passing, backup restore documented. If that cannot be achieved cleanly, pause and reassess instead of letting infrastructure sprawl. They also missed migration discipline: Alembic/schema parity must be verified against real PostgreSQL, not just app tests.

### Review 3

1. Strongest: **Response A**. It gives the clearest execution order: staging PostgreSQL, `TEST_PG_URL`, run skipped tests, add PG-backed Playwright mode, then Caddy/TLS smoke tests, then GPG/R2 backups before S5. It turns the verdict into a concrete sequence and keeps scope tight.

2. Biggest blind spot: **Response D**. It is directionally right, but it expands the opportunity frame too broadly. “Async pooling, migrations, Caddy routing, TLS boundaries, upload limits, backup recovery” are all valid, but it does not distinguish what must happen immediately from what can wait. That risks exactly the ops sprawl the decision is trying to avoid.

3. What all five missed: ownership and cost control. None says who will operate this staging infrastructure, how much time it is allowed to consume, or what “done” means. The project needs an infra timebox and acceptance criteria, for example: “2-3 day infra spike; existing PG tests run; one PG E2E passes; restore test documented; no feature work blocked beyond that.” They also missed CI/secrets implications: where `TEST_PG_URL` lives, how credentials are rotated, and whether staging data must be anonymized or synthetic.

### Review 4

1. Strongest: **Response A**. It gives the clearest Monday-morning execution order: provision staging PostgreSQL, set `TEST_PG_URL`, run skipped tests, add PostgreSQL Playwright E2E, then Caddy smoke tests, then backups before S5. It is specific enough to act on without turning infra into a vague “quality improvement” theme.

2. Biggest blind spot: **Response D**. It is directionally right, but it expands the frame too much: “institutional system,” “TLS boundaries,” “upload limits,” “failure modes,” “quality ladder.” Useful ideas, but less disciplined about what to do first. Its risk is encouraging a broad ops push before the immediate blocker, PostgreSQL test execution, is solved.

3. What all five missed: they did not explicitly mention **CI gating and ownership**. A staging database helps only if someone decides which PostgreSQL tests become required, when they run, who maintains secrets/credentials, and what failure blocks merges. They also missed **migration discipline**: PostgreSQL staging should verify Alembic/app schema setup from empty database, not just point tests at a manually prepared DB. Finally, they should require a **backup restore drill**, not merely “backups exist,” before S5 imports.

### Review 5

1. **Strongest: Response A.** It gives the clearest execution path: provision PostgreSQL 16, define `TEST_PG_URL`, run skipped tests, add PostgreSQL Playwright mode, then Caddy smoke tests, then GPG/R2 before the S5 gate. It translates the verdict into a sequence, which is what this project needs.

2. **Biggest blind spot: Response D.** It is directionally right, but it risks inflating the work. “Product accelerator” sounds attractive, but it bundles migrations, Caddy, TLS, uploads, backup recovery, and failure modes into one quality ladder. For a non-expert user, that can easily become scope creep disguised as maturity. It underplays the need to keep the first infrastructure pass boring and tiny.

3. **What all five missed:** none explicitly mention **cost of maintaining two test worlds**. Once PostgreSQL staging exists, the team must decide which tests remain SQLite, which must run on PostgreSQL, and which are duplicated. Without that policy, the suite can become slow, flaky, or confusing.

They also missed **data/reset strategy**: staging tests need seeded data, isolation, teardown, migration discipline, and protection from destroying valuable data. “Set `TEST_PG_URL`” is not enough; the URL must point to a disposable or clearly test-owned database.

---

## Chairman Synthesis

## Where the Council Agrees

The council is unanimous: start infrastructure now, but only as a narrow testing-enabler.

The shared reasoning is strong: the app’s current evidence is incomplete because production is PostgreSQL 16, while most tests and E2E coverage run against SQLite. The five skipped PostgreSQL tests and blocked `E2E-PG-02` are not minor bookkeeping. They identify a real confidence gap.

Everyone also agrees this should not become a broad ops project. The goal is not “finish infrastructure.” The goal is to make real-stack behavior testable before S5 bulk imports, file adapters, backups, and parser workflows increase risk.

## Where the Council Clashes

The clash is scope.

One side, especially the Expansionist, sees infrastructure as a wider quality ladder: PostgreSQL, staging E2E, Caddy, TLS, upload limits, backups, restore proof, failure modes.

The stricter side, led by the Executor and Outsider, says that is directionally right but dangerous if started all at once. Reasonable advisors disagree because infra does create compounding value, but it also has infinite surface area. The winning resolution is sequencing: start infra now, but define the first milestone brutally small.

## Blind Spots the Council Caught

The peer review caught the missing operational discipline.

The original advisor responses under-specified definition of done, timebox, ownership, cost control, CI/secrets policy, migration discipline, and staging data reset strategy.

Most important: `TEST_PG_URL` must point to disposable, test-owned data. Do not aim tests at a valuable staging database unless reset, isolation, and migration behavior are explicit.

The council also clarified that not every test must move to PostgreSQL. SQLite remains useful for fast local coverage. PostgreSQL should cover database-specific behavior, migrations, async SQLAlchemy/driver behavior, and at least one production-like E2E path.

## The Recommendation

Start external infrastructure now.

Do not continue feature-only development under the illusion that `174/174` SQLite-backed tests prove production readiness. They prove useful application behavior, but not the declared deployment stack. PostgreSQL, Caddy, backups, migrations, and staging HTTP behavior are part of the product’s real operating environment.

But the recommendation is not “go do all infra.” It is: create the minimum staging spine that converts skipped assumptions into evidence.

Definition of done for the first infra slice: PostgreSQL staging exists, migrations apply cleanly from an empty database, the skipped PostgreSQL tests run against `TEST_PG_URL`, at least one Playwright E2E flow runs against FastAPI using PostgreSQL, and one backup/restore proof is completed before S5 import work is treated as gate-ready.

## The One Thing to Do First

Provision a disposable PostgreSQL 16 staging/test database and wire `TEST_PG_URL` so the five currently skipped PostgreSQL tests run against it.
