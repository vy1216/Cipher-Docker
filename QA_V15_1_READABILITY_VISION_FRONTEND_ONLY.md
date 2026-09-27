# Cipher V15.1 — AI Drawer Readability + Cipher Vision Restoration

## Scope
Frontend-only refinement on top of `CIPHER_V15_UI_POLISH_AI_LANDING_FRONTEND_ONLY_QA.zip`.

### Backend constraint
No backend files were modified. AI query behavior, API contracts, evidence retrieval, Vision endpoints, face matching, case data, and LLM/provider logic remain unchanged.

## Fixes
- Increased AI drawer answer typography to a readable investigative scale.
- Increased answer line-height and spacing for paragraphs/lists/headings.
- Reworked dynamic evidence-reference rows so long filenames wrap instead of colliding with action buttons.
- Increased source labels, metadata, evidence buttons, direct action buttons, and loading/welcome text without turning them into oversized UI.
- Increased AI query field and prompt-chip readability.
- Restored Cipher Vision's larger title, command bar, evidence rail, central identity-analysis stage, podium, and matching-results typography/dimensions.
- Restored a deliberate three-column Vision cockpit at desktop widths and stacked it responsively at smaller widths.
- Preserved all existing DOM IDs and JS behavior.

## QA
- `node --check frontend/script.js` — PASS
- `python -m py_compile python_backend/*.py` — PASS
- Backend source comparison against V15 base — UNCHANGED
- `frontend/index.html` — unchanged
- `frontend/script.js` — unchanged
- CSS-only UI refinement applied in `frontend/style.css`

Visual browser screenshots were not used as the source of truth for this pass; the supplied screenshot was used to target the typography/spacing defects, and the final CSS cascade was inspected statically.
