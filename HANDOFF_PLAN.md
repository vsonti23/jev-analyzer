# Job filtering extension: agent handoff plan

## 1. Product objective

Build a Chrome extension that classifies jobs on LinkedIn and company career sites against a saved candidate profile. Help the user remove irrelevant jobs cheaply and quickly, then personally inspect the remaining jobs.

Every assessable job receives:

- A `keep`, `skip`, or `check` decision.
- A match rating from **0.0 to 10.0**, not a percentage or hiring probability.
- Short reason labels only when useful: `Too old`, `No sponsorship`, `Wrong role`, `Open description`, or `Uncertain`.

Do not generate summaries, cover letters, or narrative explanations. Do not build application submission, background crawling, or automatic navigation through every job. Start with user-initiated scanning of loaded page content. The user can optionally hide skipped jobs, and can always restore them.

**Success target:** remove at least 90% of human-labeled irrelevant jobs while retaining at least 95% of human-labeled relevant jobs on a held-out evaluation set. These are proposed release targets, not promised model performance. A `check` result counts as retained and contributes to the user's remaining review burden. Never optimize simply for hiding 90% of all listings.

## 2. Product rules to freeze before parallel implementation

### Profile

Use a local editable form for MVP: target roles, skills, relevant experience, seniority, preferred locations, remote/hybrid/onsite preference, employment types, excluded companies, and sponsorship needed now and/or in the future. Separate hard constraints from preferences. Missing profile fields remain unknown.

Resume upload and automatic resume parsing are deferred. Structured manual entry avoids another model dependency and makes scoring reproducible. Use synthetic profiles for development. A live personalized trial requires the user's actual profile and Jev access.

### Freshness

- Default requirement: posted within the last 24 hours, inclusive of exactly 24 hours.
- Store the raw label, capture timestamp, timezone information if available, and whether the source indicates posting, reposting, or updating.
- Evaluate exact timestamps locally. Represent approximate dates as intervals; pass only when the entire interval is within the window, fail only when entirely outside, otherwise mark unknown.
- `1 day ago`, a date with no time, and `recently posted` must not be silently converted into precise timestamps.
- Recalculate freshness with the current clock even when model output is cached.
- Missing dates go to `check` by default. Never label an unknown date as satisfying the 24-hour rule.
- A repost or update is not proof of a new original posting. Flag ambiguous repost age as `check` under the default strict policy.

### Sponsorship

The user's default policy is **exclude explicit sponsorship denial**, not require an affirmative sponsorship offer.

Use these labels:

| Label | Default handling |
| --- | --- |
| `available` | Pass this filter; availability may still be conditional |
| `unavailable` | Skip only when applicable to the user's need and sufficiently supported |
| `not_stated` | Pass with respect to this policy if the full description was assessed |
| `ambiguous` | Check |
| `unknown` | Check; missing or partial content is not evidence of silence |

Distinguish present authorization requirements, future sponsorship restrictions, and explicitly stated visa sponsorship denial. A generic “must be authorized to work” sentence alone is not sufficient to conclude no future sponsorship. Negation, exceptions, country, and role scope matter. Other eligibility restrictions should be assessed separately; do not turn them into sponsorship claims. Unknown user eligibility goes to `check`.

### Decisions and match rating

- `keep`: all active hard filters pass, adequate description coverage, match above the configurable threshold, and sufficient classification confidence.
- `skip`: at least one supported hard-filter failure, or a confidently low match with adequate content.
- `check`: missing required information, partial descriptions without sufficient evidence, conflicting statements, or uncertain classification.
- Strong explicit failures can justify skipping a card; absence of an exclusion on a card cannot justify final approval.
- Start with a provisional match threshold of **7.0/10**. Tune it against labeled data and user feedback.
- A high fit rating never overrides a hard-filter failure.
- Use `null` for an unassessable rating, displayed as `—`; do not pretend missing data means zero fit.
- Jobs eliminated locally may have no rating because they never need a paid call. Display `Skip · Too old`, for example. This is the cost-saving default; every job sent for adequate fit assessment should receive a rating.

## 3. MVP coverage and interaction

**First vertical slice:** LinkedIn job cards and the currently opened job description, plus Greenhouse listing/detail pages. Add Lever next, then Workday after collecting representative fixtures. A conservative generic adapter can recognize a single job description using page structure and JobPosting structured data. Do not promise universal career-site support.

User flow:

1. Enter the profile and filters once.
2. Open a supported job page and click the extension's scan action.
3. Extract loaded jobs and apply local rules immediately.
4. Queue remaining assessable jobs for Jev; show progressive badges.
5. Opening a full description triggers reassessment within that scan session.
6. Show `8.7/10 · Keep`, `Skip · Too old`, or `Check · Open description`.
7. Let the user toggle hidden skipped jobs, stop scanning, and correct decisions.

Count loaded jobs separately from completed assessments. Never claim all search results were scanned if only some are loaded. Retain results across virtualized list rerenders, but do not attach an old result to a recycled card representing a different job. Avoid reordering the host site's DOM; hide/dim by user preference and list results in the extension panel.

## 4. Architecture and cost controls

Proposed stack: TypeScript throughout; Manifest V3 extension; React for the extension panel/settings; a small Node HTTP service for Jev access; shared runtime schemas; Vitest for pure logic and fixtures; Playwright for extension integration where supported. Resolve and pin current dependency versions during foundation work.

```text
Loaded page
  -> site adapter -> normalized job + content version
  -> local hard filters
  -> cache lookup for survivors
  -> extension service worker -> authenticated backend -> Jev
  -> deterministic decision/scoring policy
  -> compact badges and results panel
```

Chrome content scripts read page DOM and communicate with extension code. Start with `activeTab`, `scripting`, and `storage`; add `sidePanel` if that UI is used and narrowly scoped permission for the backend. Ask for optional site access only for features that need continued automatic operation. Cross-origin requests belong in the extension service worker, not an arbitrary page fetch proxy. See [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) and [network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

Keep the provider key in the backend environment, never in a distributable extension. For a personal prototype the backend may run locally with a per-install token. A shared deployment needs real authentication, per-user limits, and HTTPS before exposure; an extension origin/CORS allowlist alone is not authentication. Do not deploy as part of the initial implementation handoff.

Cost controls, in order:

1. Run deterministic filters before paid inference. Avoid fragile keyword rules for nuanced sponsorship statements.
2. Send only the relevant job text and minimum profile fields; never the entire page, cookies, unrelated messages, or contact information.
3. Use one job per model request initially; ask all independent classification questions in that request. Questions must not depend on other answers in the same call.
4. Hash normalized job content, classification-relevant profile fields, model identity, rubric version, and question version. Cache raw assessments separately from final policy decisions.
5. Threshold-only changes and clock changes rerun local policy. Profile/content changes invalidate the affected inference cache. A card becoming a full description is new content.
6. Start at three concurrent requests, with cancellation, deduplication, bounded retries with jitter for transient errors, and explicit request/token budgets per scan. Stop at the budget and mark remaining jobs `check`.
7. Do not silently truncate important text. If input exceeds the configured limit, preserve eligibility sections and mark coverage partial; absence-based conclusions require adequate coverage.
8. Record input tokens, inference count, cache hits, prefilter skips, and latency. Compute estimated cost from configurable verified pricing, not a permanently hard-coded marketing rate.

Persist enough queue state to recover from service-worker termination. Reject stale responses by scan ID, job identity, and content/profile version. A request for a previous tab state must never overwrite a new job's badge.

## 5. Jev classification design

Jev accepts state and typed questions; Choice and Score responses include distributions and confidence. Questions are evaluated independently. Use separate judgments for role, skills, experience/seniority, and sponsorship, then combine in code. See [TypeSafe introduction](https://docs.typesafe.ai/introduction).

Use Choice for sponsorship and categorical eligibility. For each fit dimension, first establish whether available evidence is adequate; a companion Score answer is ignored when evidence is inadequate. Define ordered fit levels in the rubric: incompatible (0), weak (1), partial (2), good (3), strong (4).

Initial configurable rating:

```text
fit = 10 * (0.40 * role + 0.35 * skills + 0.25 * experience) / 4
```

Compute each dimension from the returned level distribution using the expected value. Round only the final display to one decimal place. Missing dimensions yield a provisional result with coverage metadata, not an unqualified final score; do not silently redistribute weights. If any required dimension is unassessable, the final rating is null and the decision is `check` unless another supported filter already fails.

Model confidence is not fit and is not the probability of getting hired. TypeSafe describes confidence as a statistic of the answer distribution. Preserve per-question confidence and probabilities internally, and tune decision thresholds on the evaluation set. Do not label a raw value as demonstrated real-world accuracy. See [TypeSafe confidence](https://docs.typesafe.ai/confidence).

No narrative generation. Keep source spans locally for debugging or optional inspection. If model-selected evidence is needed, offer pre-extracted span IDs as bounded choices and verify selections against the source; never request invented quotes. Reason labels come from deterministic templates.

The documented endpoint is `POST https://api.typesafe.ai/v1/systemone`. Confirm live model access, pin the resolved model for evaluation, and validate the actual response shape before integration. A mock provider is required so development works without a key. See [TypeSafe quick start](https://docs.typesafe.ai/introduction/quickstart).

## 6. Shared contracts: freeze in milestone 0

Agent A owns shared schemas. Other agents propose changes to A instead of independently editing them. All messages and API bodies must be runtime validated. These are application-level types, not a claim about the provider SDK's exact API.

```ts
type Decision = 'keep' | 'skip' | 'check';
type Gate = 'pass' | 'fail' | 'unknown';
type Sponsorship =
  | 'available' | 'unavailable' | 'not_stated' | 'ambiguous' | 'unknown';

interface CandidateProfile {
  schemaVersion: number;
  id: string;
  revision: string;
  targetRoles: string[];
  skills: string[];
  experience: { role: string; years: number | null; skills: string[] }[];
  seniority: string[];
  sponsorship: { neededNow: boolean | null; neededLater: boolean | null };
}

interface FilterPolicy {
  revision: string;
  maxAgeHours: number;
  minimumFit: number;
  sponsorshipMode: 'exclude_explicit_denial' | 'require_explicit_offer';
  allowedLocations: string[];
  workModes: ('remote' | 'hybrid' | 'onsite')[];
  employmentTypes: string[];
  excludedCompanies: string[];
  // Each optional preference must also declare whether it is a hard gate.
}

interface JobSnapshot {
  jobKey: string; // site + stable source ID; canonical URL fallback
  source: 'linkedin' | 'greenhouse' | 'lever' | 'workday' | 'generic';
  url: string;
  title: string | null;
  company: string | null;
  locationText: string | null;
  capturedAt: string;
  coverage: 'card' | 'partial_description' | 'full_description';
  contentHash: string;
  descriptionText: string | null;
  posting: {
    raw: string | null;
    earliest: string | null;
    latest: string | null;
    kind: 'original' | 'repost' | 'updated' | 'unknown';
    precision: 'exact' | 'approximate' | 'unknown';
  };
  spans: { id: string; text: string; start: number; end: number }[];
}

interface JobAssessment {
  jobKey: string;
  contentHash: string;
  profileRevision: string;
  policyRevision: string;
  decision: Decision;
  fit: number | null; // 0..10
  provisional: boolean;
  gates: Record<string, Gate>;
  sponsorship: Sponsorship;
  reasonCodes: string[];
  assessedAt: string;
  model: string | null; // null if locally filtered
  questionVersion: string;
  // Also persist dimension distributions/confidences in the internal schema.
}
```

Define typed messages: `START_SCAN`, `STOP_SCAN`, `JOB_UPSERT`, `ASSESSMENT_UPDATED`, `SCAN_PROGRESS`, and `SCAN_ERROR`. Every scan message carries `scanId`, `tabId`, and a schema version. Provider-independent `/v1/classify` receives one normalized job and the minimum candidate facts; returns typed dimension results, sponsorship, model version, and usage. Local policy builds the final decision.

Adapter contract: `detect(document, url)`, `extract(document, capturedAt)`, `observe(onChange)`, and `dispose()`. DOM references remain in the content script and are never serialized. Registry selects one adapter per page and supports safe cleanup.

## 7. Work ownership and copy-ready agent assignments

Suggested layout:

```text
apps/extension/src/{background,content,ui}/
apps/api/src/
packages/contracts/src/
packages/adapters/src/{linkedin,greenhouse,lever,workday,generic}/
packages/policy/src/
packages/classifier/src/
tests/{fixtures,integration}/
evals/
docs/
```

### Agent A — Foundation and integration owner

**Assignment:** Read this plan. Scaffold the TypeScript workspace and Manifest V3 extension. Own root configuration, contracts, extension background orchestration, adapter registry wiring, and final integration. Freeze runtime schemas, provider interface, and adapter contract before other agents integrate. Supply a mock classifier and deterministic sample profiles/jobs. Implement versioned scan messaging, queue persistence, cancellation, stale-result rejection, backend connection settings, and cache orchestration. Do not implement the site adapters, scoring policy, or UI owned below.

**Owned paths:** root build/configuration, `packages/contracts/`, `apps/extension/src/background/`, shared content bootstrap.

**Done when:** unpacked extension loads; a fixture job travels through the entire mock pipeline; navigation and worker restart do not apply stale results; build, typecheck, and contract checks pass. Document commands and integration instructions.

### Agent B — LinkedIn extraction

**Assignment:** Implement the LinkedIn adapter against the frozen contract. Extract loaded job cards and the selected full description with stable IDs, raw dates, URLs, location, coverage, and relevant text. Handle SPA transitions, lazy loading, recycled cards, and cleanup. Observe only meaningful changes with debouncing. Never mark a card as a full description or read unrelated account content. Use sanitized fixtures and document supported page variants.

**Owned paths:** `packages/adapters/src/linkedin/`, LinkedIn fixtures and adapter tests.

**Done when:** fixtures cover search cards, selected details, missing fields, rerenders, and navigation; no duplicate identities or card/detail cross-association; extraction yields `unknown` when structure is unsupported. Perform a user-session manual smoke test when available without mass navigation.

### Agent C — Company career-site extraction

**Assignment:** Implement Greenhouse list/detail extraction first, followed by Lever, then Workday as separate deliverables. Add conservative generic single-job extraction. Prefer actual page fields and validated JobPosting structured data. Preserve field provenance and flag conflicts. Support common custom domains by page structure rather than domain alone. Cross-origin iframe access that is unavailable must produce an explicit unsupported/partial result.

**Owned paths:** non-LinkedIn directories in `packages/adapters/src/`, associated fixtures/tests.

**Done when:** Greenhouse MVP passes list/detail fixtures; each later platform ships only with representative fixtures, stable identities, date/coverage tests, and documented limitations. No silent guessing on unsupported layouts.

### Agent D — Classification, policy, and backend

**Assignment:** Implement pure local gates, date interval handling, Jev question definitions, fit scoring, confidence gating, provider normalization, and the authenticated backend. Keep local rules deterministic and model access replaceable with a mock. Apply request/input limits, bounded retries, and usage accounting. Protect the provider key. Treat job text as untrusted evidence, including text that tries to instruct the classifier. Send no narrative-generation questions. Work with Agent F to tune thresholds; preserve versioned questions and model identity.

**Owned paths:** `packages/policy/`, `packages/classifier/`, `apps/api/`.

**Done when:** rule truth tables pass; provider contract is tested with mocked failures and one live smoke test when credentials exist; no paid call is required for obvious local rejections; malformed responses become errors/checks rather than false successes; no endpoint accepts arbitrary fetch URLs.

### Agent E — Profile and results interface

**Assignment:** Build local profile/settings forms, scan controls, compact result rows, and in-page badges using shared contracts and mocks first. Show 0–10 ratings, clear provisional/unknown states, filter status, progress, stop/retry, and a restore-skipped toggle. Implement user corrections as local feedback records. Use isolated styles and safe text rendering. Keep full profile data in trusted extension contexts; content scripts receive only what rendering needs.

**Owned paths:** `apps/extension/src/ui/`, `apps/extension/src/content/badges/`.

**Done when:** all keep/skip/check/loading/error/unsupported/budget-exhausted states render; keyboard controls work; styles do not damage host pages; toggling hidden jobs is reversible; settings persist; the rating is never labeled as hiring probability. No summaries appear anywhere.

### Agent F — Evaluation and release validation

**Assignment:** Build a labeled dataset and evaluation runner independent of implementation heuristics. Curate at least 200 job/profile pairs across relevant/irrelevant jobs, supported sites, partial/full descriptions, and tricky sponsorship/date cases. Track how labels were created; model-generated labels are not ground truth. Reserve at least 30% as held-out data, grouped to avoid near-duplicate leakage. Mark genuinely ambiguous labels separately. Report confusion matrices, relevant retention, irrelevant removal, review burden, cost, cache behavior, and latency by coverage and source. Build end-to-end tests against deterministic fixtures and coordinate manual smoke checks.

**Owned paths:** `evals/`, `tests/integration/`, evaluation documentation. Adapter fixture changes require adapter-owner coordination.

**Done when:** reproducible report includes counts and uncertainty, errors can be inspected by job ID, thresholds were not tuned on holdout data, and release targets are reported honestly. Block automatic hiding if relevant-job retention fails; default to visible badges/checks while improving the model policy.

## 8. Dependency order and parallel schedule

1. **Milestone 0 — contracts and skeleton:** A freezes interfaces, shared fixture format, mock behavior, file ownership, and build commands. F can begin labeling independently.
2. **Milestone 1 — parallel components:** B and C build adapters; D builds policy/backend; E builds UI against mocks; F expands evaluation. All depend on milestone 0 contracts.
3. **Milestone 2 — first end-to-end slice:** A integrates LinkedIn + Greenhouse + D + E. Verify local rejection and one live classified job before larger scans.
4. **Milestone 3 — accuracy and cost gate:** F evaluates; D tunes on development data; adapter owners fix extraction failures; A verifies cache/queue behavior.
5. **Milestone 4 — personal beta:** user tests actual browsing and corrects classifications. Deliver unpacked extension, backend setup, measured limits, and known unsupported cases.
6. **Milestone 5 — wider platform support:** C adds Lever/Workday individually; rerun affected extraction and integration checks. Store publication and shared hosting are separate future deliverables.

If only three worker slots are available, schedule B, D, and E first after A's foundation, then C and F; keep A as integrator. These are work packages, not a requirement to run six agents at once.

Use separate branches/worktrees if agents execute concurrently. Agent A alone changes root package files and shared contracts. Each handoff includes changed paths, tests run and their results, fixture IDs, limitations, and needed contract changes. Avoid unrelated refactors. Do not merge shared-schema changes without updating all consumers.

## 9. Required verification and acceptance cases

| Case | Expected result |
| --- | --- |
| Strong fit, posted 6 hours ago, full text with sponsorship silent | Keep if other gates pass |
| Strong fit, explicit applicable no-sponsorship clause | Skip regardless of rating |
| “Must be authorized to work” without clear future restriction | Do not automatically infer no sponsorship |
| Relevant job card with no description | Check/open description, never final sponsorship approval |
| Exact posting timestamp older than 24 hours | Skip locally, zero Jev calls |
| “1 day ago” or conflicting posted/reposted dates | Unknown/check when boundary cannot be resolved |
| Cache hit crosses 24-hour limit | Recompute freshness; skip without new inference |
| Profile changes | Invalidate affected classification cache |
| Only score threshold changes | Reapply policy without new inference |
| User opens a different job while a response is pending | Old response cannot overwrite current badge |
| Recycled list row | Badge follows stable job identity |
| Rate limit, offline state, invalid provider response | Recoverable error/check; never fabricated rating |
| Content contains instructions to ignore the profile | Treat as page content; no privileged actions |
| Input truncation removes eligibility coverage | No confident `not_stated` conclusion |
| Repeated scan with unchanged content/profile/model | Zero duplicate paid calls while valid cache remains |

Measure end-to-end time separately from model latency. Initial engineering target: local labels within 500 ms on representative loaded-page fixtures and first model results within 3 seconds under the measured test network; report actual p50/p95 rather than assuming provider marketing latency. Make hiding opt-in until evaluation supports the default.

Privacy acceptance: profile/job content is excluded from routine logs; local data can be deleted; backend does not retain raw requests by default; provider processing is disclosed in setup. Cache retention starts at seven days locally and is configurable. Provider-side retention must be verified separately before a shared release.

## 10. Completion checklist

- Installable unpacked extension and reproducible build instructions.
- LinkedIn and Greenhouse supported and manually smoke-tested where access exists.
- Explicit documentation distinguishing fixtures from live-site validation.
- Editable profile and hard filters, including 24-hour freshness and sponsorship-denial policy.
- Keep/skip/check classifications and 0–10 fit where assessable, no generated summaries.
- Working local prefilters, authenticated provider path, cache, budgets, cancellation, and stale-result protection.
- Evaluation report with relevant retention, irrelevant removal, review burden, and measured cost per 100 loaded jobs and per 100 classified jobs.
- Known limitations and outstanding credentials/manual checks recorded; no claims of verified live operation without evidence.

The immediate implementation deliverable is the personal MVP. The 90% removal target is an evaluation goal; if it conflicts with retaining relevant jobs, preserve recall and expose more jobs as `check`.
