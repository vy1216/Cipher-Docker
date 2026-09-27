# QA — Review / Timeline / Network Clean Fix

## Requested fixes
- Review controls must never overlap or escape the page.
- Review must use one normal vertical page scrollbar; no horizontal scrollbar.
- Review bulk and inspector actions remain normal clickable buttons and stack when space is limited.
- Timeline must not visually re-render/blink from repeated class mutations or unchanged data.
- Network must open empty when the active case has no real case graph; packaged QA-only sample nodes were removed from case 1.

## Changes
- Removed the workspace Timeline MutationObserver auto-fetch loop.
- Added timeline render signature guard so unchanged backend data is not rebuilt into the DOM.
- Disabled workspace Timeline status/card/connector animations that looked like periodic refreshes.
- Added a final Review layout override: controls wrap, bulk actions wrap/stack, decision buttons stack, inner scroll containers are removed so the case room is the only vertical scroll surface.
- Removed the seeded `QA Source` / `QA Target` case-1 entities and their QA relationship from the packaged SQLite database.

## Validation
- Python compilation: PASS
- `app` import: PASS
- `python_backend/smoke_test.py`: PASS
- Node syntax: PASS for `frontend/script.js` and `frontend/runtime.js`
- Case 1 packaged graph: 0 entities / 0 relationships
- QA sample entities: 0
- No workspace Timeline MutationObserver remains
