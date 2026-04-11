# Claude Code Developer Guide — Teeko

This guide outlines the recommended workflow for building Teeko features using Claude Code. Follow these steps for every major feature or module.

---

## 1. Install Required Skills

Before you start, install these Claude Code skills:

### context-mode
Keeps your context window lean during long sessions. Without it, raw tool output floods the window and degrades response quality.

```bash
# Follow install instructions at:
# https://github.com/mksglu/context-mode
```

Once installed, context-mode tools (`ctx_batch_execute`, `ctx_search`, `ctx_execute_file`) become available. Prefer them over Bash/Read for any command that produces more than ~20 lines of output.

### frontend-design (UIUX Pro Max)
Generates production-grade, distinctive UI — avoids the generic AI aesthetic. Use this skill whenever building screens, components, or pages.

To invoke it, simply prefix your prompt with `/frontend-design` or mention it in your request. The skill automatically applies high-quality design principles.

---

## 2. Always Start a New Feature in Planning Mode

**Model: Opus** (most capable — use for architecture and planning)

Before writing a single line of code, enter plan mode:

```
/plan
```

In plan mode, describe the feature in plain language. Opus will:
- Identify affected files and dependencies
- Propose an implementation strategy
- Surface compliance or performance risks early

> Do not exit plan mode until you are satisfied with the approach.

---

## 3. Generate a Frontend Mockup Before the Full Plan

**Before finalising the plan**, create a visual mockup of the screen or flow. This grounds the plan in actual UI decisions and prevents back-and-forth later.

**Step 3a — Generate a frontend tech spec MD**

In your current session, ask Claude to produce a frontend spec from the PRD:

```
Based on docs/v0.1/prd/teeko-rider-prd.md (or the relevant PRD),
generate a frontend tech spec for [feature name].
Include: screen list, component breakdown, state requirements,
navigation flow, and API touchpoints.
Save it to docs/v0.1/claude-code/specs/[feature-name]-frontend-spec.md
```

**Step 3b — Open a new session for the mockup**

Once the spec file is saved, **start a fresh Claude Code session** and use Sonnet (fast, cost-efficient for UI generation):

```
/frontend-design

Read docs/v0.1/claude-code/specs/[feature-name]-frontend-spec.md
and generate a high-fidelity React Native mockup for [screen name].
```

> Why a new session? The planning session accumulates large context. A fresh session with only the spec file keeps the mockup generation clean and fast.

---

## 4. Finalise the Plan and Build

Return to your planning session (or open a new one with Opus). With the mockup as reference:

1. Confirm the component structure matches the mockup
2. Lock the plan — exit plan mode
3. Implement feature by feature, keeping sessions focused

---

## Workflow Summary

```
1. Install context-mode + frontend-design skills
2. /plan (Opus) — describe the feature
3a. Generate frontend-spec.md from the PRD (same session)
3b. New session (Sonnet) + /frontend-design — build mockup from spec
4. Return to plan, confirm structure, exit plan mode, build
```

---

## Model Selection Quick Reference

| Task | Model |
|---|---|
| Architecture, planning, PRD analysis | Opus |
| UI mockups, component generation | Sonnet |
| Quick lookups, small edits, Q&A | Haiku |

---

## Golden Rules

- **One concern per session.** Planning, mockups, and implementation each get their own session.
- **Spec before screen.** Never generate UI without a written spec derived from the PRD.
- **PRD is the source of truth.** All decisions trace back to `docs/v0.1/prd/`. If the PRD doesn't cover it, discuss before building.
- **context-mode always on.** If a command output exceeds 20 lines, use `ctx_batch_execute` or `ctx_execute_file` — never raw Bash.
- **CLAUDE.md is persistent memory.** Add project-wide decisions there so every session starts with the right context.

---

## Relevant PRD Files

| File | Covers |
|---|---|
| `docs/v0.1/prd/teeko-prd.md` | Core product requirements |
| `docs/v0.1/prd/teeko-rider-prd.md` | Rider app flows |
| `docs/v0.1/prd/teeko-driver-prd.md` | Driver app flows |
| `docs/v0.1/prd/teeko-admin-prd.md` | Admin panel |
| `docs/v0.1/tech/teeko-tech-stack.md` | Tech stack decisions |
| `docs/v0.1/prd/teeko-deferred.md` | Features deferred post-MVP |
