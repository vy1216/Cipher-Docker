# Cipher — Scrollbar + Readability Final Pass

## Scope
Frontend-only visual polish. No backend source files were changed.

## Scrollbar audit
Reviewed the frontend for real scroll surfaces and legacy hidden-scrollbar rules, including:

- Landing page / document viewport
- Sign-in / Sign-up authentication panel
- Cases workspace scroll surface
- Network tool and inspector panels
- GIS inspector and fullscreen tool panels
- Timeline stage and inspector panel
- AI Investigator workspace and pending-content areas
- Review Queue, queue column, inspector body, dialogs/forms
- CSV preview and other overflow containers
- Fullscreen workspace tool panes

### Cipher scrollbar language
All actual scrollable surfaces now use the same visual system:

- black / near-black track
- slim rounded thumb
- neon Cipher green gradient
- restrained green glow
- brighter hover state
- transparent scrollbar corner
- horizontal scrollbars receive the same treatment
- Firefox uses standards-based `scrollbar-width` / `scrollbar-color`
- Chromium/WebKit receives the richer `::-webkit-scrollbar` treatment

Previously hidden native scrollbars in the Review Queue, GIS/Timeline/Network inspectors, and tool panes are no longer intentionally invisible; the user can see and grab the themed scrollbar.

## Sign-up behavior
The authentication panel is now an intentional scroll container on compact viewport heights and long sign-up content. The left visual remains fixed while the form side can scroll vertically without exposing an ugly platform scrollbar.

## Readability pass
### AI Investigator
The existing readability pass was retained and strengthened:

- response/body copy: 14px
- response line-height: 1.75
- welcome/intro copy: 14px
- rule descriptions: 12px
- activity labels: 10.5px
- activity values: 12px
- guardrail text: 11px with increased line-height

### Review Queue
The compact queue typography was lifted for better visibility without turning the interface into oversized dashboard text:

- queue header: 9px
- sort note: 8px
- card title: 13px
- card description/quote: 10px
- metadata: 8.5px
- badges/actions: 8px
- inspector body text: 10px
- form controls: 10px
- empty-state copy: 10px

Mobile rules reduce card text slightly where necessary to preserve layout density.

## Validation
- CSS brace balance checked.
- No JavaScript/backend logic changed in this pass.
- No backend files modified in this pass.
- Previous frontend graph/CSV QA remains intact.
