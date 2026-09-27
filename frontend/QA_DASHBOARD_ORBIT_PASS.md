# CIPHER Dashboard Orbit QA — Card Collision / New Case Pass

## Scope
Focused regression pass on the dashboard case orbital only. No backend code was intentionally changed.

## Checks
- JavaScript syntax: PASS (`node --check frontend/script.js`)
- CSS brace balance: PASS
- HTML script/section tag balance: PASS
- Required dashboard IDs (`caseStage`, `newCaseBtn`): PASS
- New-case live-card implementation markers: PASS
- Backend/non-frontend file changes versus previous QA build: NONE
- Frontend files changed: frontend/script.js, frontend/style.css
- Orbital collision simulation: PASS — no projected card-rectangle collisions in tested viewports/card counts

## Orbital behavior validated
The orbit uses one deterministic angular slot per card. Cards are all anchored to the same center and rotate by changing the shared orbital angle; adding a case increases the card count and assigns the new card the next slot rather than replacing an existing case.

## Collision simulation
Tested card counts: 5, 6, 7, 8.
Tested viewport/stage sizes: 1440x590, 1200x590, 1000x560, 900x560, 800x540, 600x560, 500x560, 400x560, 360x560.
Conservative projected rectangle test uses the largest base scale from the actual orbit formula and the current responsive card dimensions.

Result: NO OVERLAPS
