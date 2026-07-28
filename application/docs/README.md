# iiGrain Mobile — Knowledge Base

Permanent engineering documentation for the React Native application. Written
for a developer who joins in two years, opens the repo, and needs to understand
a module without asking anyone.

---

## 1. How this is organised

**One folder per module. Fixed document set. No exceptions.**

```
docs/
├── README.md              ← you are here: the index + the conventions
│
├── maps/                  ← ✅ complete (11 documents)
│   ├── README.md              Business + technical purpose, why this stack
│   ├── SETUP.md               Zero → working, per platform, with expected output
│   ├── CONFIGURATION.md       Every config file: purpose, reader, lifecycle
│   ├── ARCHITECTURE.md        Layers, folder rules, data flow
│   ├── FLOW.md                Runtime ordering — launch → tile → interaction
│   ├── BEST_PRACTICES.md      The rules, and the cost of breaking each
│   ├── SECURITY.md            Keys, restrictions, rotation, release checklist
│   ├── TROUBLESHOOTING.md     Every known failure: cause → debug → fix
│   ├── FUTURE_SCOPE.md        The roadmap, and what each item actually needs
│   ├── DECISION_LOG.md        ADRs: decision, alternatives, trade-offs
│   └── CHANGELOG.md           Every change to the module
│
└── (pre-existing, not yet migrated to the module convention)
    ├── ASSESSOR_PLAN.md · ASSESSOR_IMPLEMENTATION.md · ASSESSOR_PROGRESS.md
    ├── ASSESSOR_APP_BUILD_GUIDE.md
    └── IOS_SPLASH_VIDEO_SETUP.md
```

### Planned module folders

These are **deliberately not created yet.** An empty or speculative
`Authentication/ARCHITECTURE.md` is worse than no file: it looks authoritative,
nobody re-reads it, and it drifts from the code from the day it is written.

A module folder is created **when that module is next worked on** — written from
the actual code, by whoever is in it.

| Module | Status |
|---|---|
| `maps/` | ✅ Complete |
| `authentication/` | Code exists (`src/redux/slices/authSlice`, `src/api/authApi`) — undocumented |
| `farm/` | Code exists — undocumented |
| `field/` | Code exists — undocumented |
| `assessment/` | Partially documented in the loose `ASSESSOR_*.md` files above |
| `organization/` · `profile/` | Code exists — undocumented |
| `weather/` · `inventory/` · `analytics/` · `offline/` | Not built |

> **On the folder name.** The map documentation lives at `docs/maps/`, and that
> path is referenced from `android/app/build.gradle`, `ios/Podfile`,
> `AppDelegate.swift`, `.env.example` and ~30 cross-links. Renaming the root to
> `KnowledgeBase/` is a mechanical but wide change; say the word and it will be
> done in one pass. The convention below is identical either way.

---

## 2. The document set — what each file is for

Copy this list verbatim for a new module. If a document has nothing to say for
that module, still create it and write *why* it is empty — "this module has no
native configuration" is useful information.

| File | Answers | Reader |
|---|---|---|
| `README.md` | Why this module exists, business + technical purpose, what stack was chosen and why | Anyone, first contact |
| `ARCHITECTURE.md` | Where code goes, what the layers are, how data flows | Someone adding a feature |
| `FLOW.md` | *When* things happen — ordering, lifecycle, race conditions | Someone debugging timing |
| `CONFIGURATION.md` | Every config file: purpose, who reads it, when it executes, what breaks if removed | Someone changing config |
| `DECISION_LOG.md` | ADRs — decision, context, alternatives, trade-offs, future impact | Someone about to reverse a choice |
| `TROUBLESHOOTING.md` | Every known failure: symptom → cause → debug steps → fix | Someone with a broken build |
| `BEST_PRACTICES.md` | The rules, and the concrete cost of breaking each one | Someone writing code today |
| `FUTURE_SCOPE.md` | The roadmap, what exists already, what must be built, effort | Someone planning |
| `CHANGELOG.md` | Every change, newest first | Everyone, always |

`SETUP.md` and `SECURITY.md` are added when a module has native configuration or
handles credentials. Maps has both.

---

## 3. Writing rules

These are what make the difference between documentation people read and
documentation people skip.

1. **Write down the WHY, not the WHAT.** The code already says what it does. The
   docs exist for the reasoning that is *not* in the code — the constraint, the
   alternative that was rejected, the bug that this shape prevents.
2. **State the cost of breaking a rule.** "Memoise the map children" is ignorable.
   "Rebuilding them re-renders a native view on every keystroke" is not.
3. **Be honest about weaknesses.** `maps/DECISION_LOG.md` ADR-008 documents that
   the Directions API key cannot be app-restricted. A knowledge base that only
   contains good news is a marketing document.
4. **Every command has an expected output.** Map failures are silent — a blank
   screen, not an exception. "Run `pod install`" is useless; "you should see
   `Installing GoogleMaps (9.4.0)` — if not, iOS silently fell back to Apple
   Maps" is the whole point.
5. **Cross-link.** A failure in TROUBLESHOOTING should link to the config it
   comes from; a roadmap item should link to the ADR that constrains it.
6. **Never document code that does not exist.** If it is planned, it belongs in
   `FUTURE_SCOPE.md` marked as planned — not in `ARCHITECTURE.md` as if it were
   built.
7. **Update the CHANGELOG in the same commit as the code.** A CHANGELOG updated
   later is a CHANGELOG that is wrong.

---

## 4. Workflow for a new module

Documentation is not the last step. Three of these come before any code:

```
1. Business requirement          →  README.md          (draft)
2. Future requirements           →  FUTURE_SCOPE.md    (draft)
3. Architecture + folder plan    →  ARCHITECTURE.md    (draft)
   └─ review the plan before writing code
4. Implement
5. Verify (typecheck · lint · both platforms)
6. Complete the document set
7. CHANGELOG entry, in the same commit
```

The first three exist to make the *plan* reviewable. A plan reviewed as prose is
an hour; a plan reviewed as a merged feature is a rewrite.

### The ADR trigger

Open `DECISION_LOG.md` whenever a choice would be **expensive to reverse**:

- picking a library that touches native code
- a folder structure that many files will import from
- a data shape that crosses module boundaries
- anything where "we could also have done X" was said out loud

Record it *while deciding*, not afterwards — the alternatives are only clear in
the moment.

---

## 5. ADR template

```markdown
## ADR-0NN — Title

**Status:** Proposed | Accepted | Accepted, revisit | Superseded by ADR-0MM · DATE

**Decision.** One sentence.
**Context.** What forced the choice.
**Alternatives.** What else was considered, and why it lost.
**Trade-offs.** ✅ gains / ❌ costs. Be honest about the costs.
**Future impact.** What this makes easy, and what it makes expensive.
```

Worked examples: [maps/DECISION_LOG.md](./maps/DECISION_LOG.md) — twelve ADRs
covering provider choice, the one-import rule, key delivery through the build
system, and two known weaknesses.

---

## 6. Reusability — the standing rule

> Before building a UI surface, check whether an existing module already does
> the interaction. Adding a prop is always cheaper than a second copy.

Today's reusable surfaces:

| Need | Use | Do **not** |
|---|---|---|
| Browse/search/select N points on a map | `MapExplorer` (`src/maps`) | Copy `FieldMapScreen` |
| Pick a coordinate | `LocationPicker` / `LocationPickerModal` | Build a second picker |
| Show one fixed point | `FieldLocationPreview` | Embed a raw map |
| Live tracking + route | `VisitMap` | Re-implement routing |
| Any map at all | `AppMapView` | `import MapView from 'react-native-maps'` |

The pattern that made `MapExplorer` reusable — model the **interaction**, not the
**entity** — is the one to copy for the next shared surface. See
[maps/DECISION_LOG.md ADR-012](./maps/DECISION_LOG.md) and
[maps/BEST_PRACTICES.md §2](./maps/BEST_PRACTICES.md).
