# UX Improvements Backlog

Purpose:
Track all future UX improvements for the building design study workflow in one place.

Update rule:
- Add every new UX suggestion or usability issue to this file.
- Keep items concise and actionable.
- Mark status explicitly: `proposed`, `in-progress`, `shipped`, or `deferred`.

## Current Priorities

### 1) Session Context Bar
- Status: proposed
- Goal: reduce confusion about current context while exploring alternatives.
- Add a persistent top status strip showing:
  - active design node name
  - active building name
  - last run status
  - active metric shown in 3D (`DF`/`sDA`)

### 2) Action Grouping by Intent
- Status: proposed
- Goal: clarify mental model between editing, analyzing, and recording.
- Group primary actions as:
  - Explore: edit, duplicate, reinstate
  - Analyze: run study, view results
  - Record: save node

### 3) Study Lifecycle Stepper
- Status: proposed
- Goal: improve run transparency and expected wait behavior.
- Show explicit lifecycle: `Queued -> Running -> Post-processing -> Ready`.

### 4) Result Source Badge
- Status: proposed
- Goal: prevent ambiguity about what result is currently visible.
- Add badge near legend:
  - selected building
  - design node
  - active metric

### 5) Reinstate Restore Summary
- Status: proposed
- Goal: make restore behavior obvious and trustworthy.
- Show toast after reinstate with summary:
  - geometry restored
  - cached results restored (if available)
  - next action hint (`View Result`)

### 6) Design Graph Responsive Details
- Status: in-progress
- Goal: avoid overflow and improve readability in the right details panel.
- Notes:
  - panel now has fixed width + internal scroll
  - long values wrap/break
  - grouped metric cards
- Remaining:
  - optional collapsible details panel on small screens

### 7) Run Status Modal Consistency
- Status: in-progress
- Goal: keep baseline and user-triggered run status UX consistent.
- Notes:
  - live poll status from `GET /v1/studies/{study_id}` now shown
  - save/run overlay style aligned with baseline overlay
- Remaining:
  - add ETA or stage descriptions when available from backend

### 8) 3D Smoothness and Quality Modes
- Status: proposed
- Goal: let users trade fidelity for responsiveness intentionally.
- Add selectable viewport quality presets:
  - Performance
  - Balanced
  - Quality

## Entry Template

Use this template for new items:

```md
### <short title>
- Status: proposed
- Goal: <one sentence>
- Change:
  - <specific UX change 1>
  - <specific UX change 2>
- Acceptance:
  - <how we know this improved UX>
```
