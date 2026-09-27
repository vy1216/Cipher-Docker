# CIPHER V15.3 — Vision readability/alignment + Timeline clarity QA

## Scope
Frontend-only refinement based on V15.2. No backend source files were modified.

## Cipher Vision
- Increased investigator-facing text sizes across title, evidence controls, analysis stage, upload prompt, status, and matching results.
- Removed the redundant live-evidence command strip from the visual hierarchy without deleting its underlying controls.
- Removed the redundant bottom investigation strip from the visual hierarchy.
- Hid decorative diagnostic/code overlays that competed with the photo-analysis target.
- Corrected the large circular Vision background element: pseudo-elements now use explicit 50%/50% anchoring with translate(-50%, -50%).
- Centered the lens haze, orbital rings/dots, podium, and upload photo frame around the same stage center.
- Increased upload prompt and matching-result readability.

## Timeline
- Removed Confidence from timeline event cards.
- Removed Confidence from timeline event inspector provenance.
- Backend confidence fields remain available to application logic; they are simply not rendered in the Timeline UI.

## QA
- `node --check frontend/script.js` PASS
- `python -m py_compile python_backend/*.py` PASS
- Backend source comparison against V15 base: unchanged
