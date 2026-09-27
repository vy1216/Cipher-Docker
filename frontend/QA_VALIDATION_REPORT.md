# CIPHER Frontend QA Validation — Spider Logo / Case Orbit / GIS Marker Pass

Date: 2026-09-18

## Scope

This pass is intentionally frontend-only. The backend source files were not edited.

### Changes in this pass
- Stabilized the Cases orbital carousel physics so cards are positioned from deterministic angular slots around the same center.
- Kept click-to-focus behavior while preventing hover CSS from overwriting the physics transform.
- Improved desktop/mobile orbital radii to reduce card stacking/overlap.
- Kept drag + momentum and wheel rotation behavior.
- Changed GIS tactical markers from circular dots to a pin-shaped map marker treatment.
- Added a dedicated WAYPOINT marker archetype so saved waypoints use the same marker language.
- Increased the Cipher spider logo lockup sizing/spacing for a more balanced spider + CIPHER horizontal brand.

## Automated validation

| Check | Result |
|---|---|
| JavaScript syntax (`node --check`) | PASS |
| HTML parser | PASS |
| CSS brace balance | PASS |
| Duplicate HTML IDs | PASS — none found |
| Frontend fetch paths vs backend route shapes | PASS — 19 paths matched |
| Python backend smoke test | PASS |
| Backend/root file diff vs input ZIP | PASS — 0 non-frontend changes |
| Logo references | PASS — 4 frontend brand placements use `cipher-spider-logo.png` |
| Orbital geometry sanity | PASS — 5-card desktop slot minimum center separation ≈ 282 px |

## Important note

The container's Chromium process did not complete headless page rendering within the available execution window, so this report does **not** claim a successful real-browser click/drag visual test. The deterministic orbit math, source-level wiring, HTML/CSS/JS validation, frontend/backend route contract, and backend smoke suite were still executed.
