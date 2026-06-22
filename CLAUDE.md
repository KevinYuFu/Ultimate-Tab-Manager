# CLAUDE.md — Working agreement for Ultimate Tab Manager

How we build in this repo. Applies to every Claude session here.

## Project
Keyboard-driven Chrome Extension (Manifest V3) for tab hoarders. TypeScript,
React, Tailwind, Vite. Product spec in `TECHSPEC.md`.

## How we work
1. **Plan whole, ship in slices.** Design the full feature first (data model,
   components, cross-cutting concerns), then deliver it as small, single-concept
   PRs that conform to that design. Too big to review in one sitting = split it.
2. **Every PR is reviewable and teaches.** Include a reviewer's guide (where to
   start, the key function, the riskiest line), explain new patterns plainly,
   and flag your own smells/tradeoffs.
3. **Git:** never commit to `main`; branch + PR for every change (user reviews
   and merges); `npm run build` before pushing.
4. **Communicate before changing.** Agree on changes before large/unrequested
   rewrites. Never revert or resurrect removed code without asking.

## Architecture
- `components/` — React UI only.
- `services/` — all `chrome.*` and storage access plus their logic; components
  call services, never the Chrome APIs directly.
- `themes/`, `types/` — themes and shared types.
- Icons from `lucide-react` (no hand-authored SVGs).

## UX principles
- Solve interactions within the input modality in use (cancel a drag by dragging
  back, not with a key).
- Keyboard-first/vim-like: every action has a configurable hotkey, matched via
  the user's keybindings.
- Consistent select/open grammar: single click selects, double click (or Enter)
  opens — "open" is type-specific (tab → browser, bin → expand). New item types
  inherit it. (Bins currently experiment with click = select+toggle; see
  `BinRow`.)
