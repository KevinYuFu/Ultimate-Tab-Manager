# CLAUDE.md — Working agreement for Ultimate Tab Manager

This file defines how we build in this repo. It applies to every Claude session
working here. Keep it short and current.

## Project

Ultimate Tab Manager — a keyboard-driven Chrome Extension (Manifest V3) for tab
hoarders. Stack: TypeScript, React, Tailwind, Vite. See `TECHSPEC.md` for the
product spec and `README.md` for the overview.

## How we work

### 1. Plan the architecture first, then deliver in slices
Design each feature **holistically** — with every sub-feature in mind — before
writing code. Decide the data model, components, and cross-cutting concerns
(e.g. drag-and-drop) up front. Then **implement that single design in small,
single-concept PRs.**

Planning holistically and shipping incrementally are separate things. The design
coherence comes from the plan; slicing only changes how it's delivered and
reviewed. A slice must never be designed in isolation — it always conforms to
the agreed whole-feature architecture. Expect later slices to lightly refine
shared abstractions; that's healthy, not a failure.

Rule of thumb: if a PR is too big to review in one sitting, it should have been
multiple PRs.

### 2. Each PR is reviewable and teaches
The user's main bottleneck is reviewing code, so every PR must be easy to learn
from:
- **Reviewer's guide** in the PR body: where to start reading, what the key
  function does, and the riskiest line/decision to scrutinize.
- **Explain new patterns** in plain English when introducing them (e.g. a
  recursive render, a non-obvious browser API), so the user learns the pattern,
  not just the result.
- **Flag your own code smells and tradeoffs** up front — don't make the user
  find them.

### 3. Git workflow
- **Never commit to `main`.** Always work on a feature branch.
- Open a **PR for every change** and **push each update to that PR**, so the
  user can always review the latest on GitHub. The user reviews and merges.
- Run `npm run build` after every change so it compiles before pushing — the
  user never has to touch the build.

### 4. Communicate before changing
Talk through proposed changes and get agreement before editing — no large or
unrequested rewrites. Never revert or resurrect code the user removed without
asking first.

### 5. Keep communication short and plain
The user is dyslexic, so long or dense text is hard to read. Keep **everything
you write — chat replies and PR text — short and straightforward**:
- Lead with the point. Short sentences, plain words.
- Use small chunks or bullets; cut anything the diff already shows.
- Still explain new patterns (§2) — just say it simply, not at length.

## Architecture conventions
- `src/components/` — React UI only (what things look like).
- `src/services/` — all `chrome.*` and storage access plus the logic that
  composes them (what things do). Components call services; they never touch the
  Chrome APIs directly.
- `src/themes/`, `src/types/` — theme definitions and shared TypeScript types.
- Icons come from `lucide-react` (no hand-authored SVG paths).

## UX principles
- Solve interaction problems within the input modality already in use (e.g.
  cancel a mouse drag by dragging back, not with the keyboard).
- Keyboard-first, vim-like: every action has a hotkey; hotkeys are configurable
  in Preferences and matched via the user's keybindings, not hardcoded.
- **Consistent select/open grammar across item types.** All navigator items
  (tabs, bins, and any future type) share the same interaction: single click =
  select, double click (or Enter on the selection) = open. "Open" is
  type-specific — a tab opens in the browser, a bin expands/collapses — but the
  trigger is identical. Keep select and open as separate operations so their
  triggers can be rebound. When adding a new item type, it inherits this grammar
  by default.
