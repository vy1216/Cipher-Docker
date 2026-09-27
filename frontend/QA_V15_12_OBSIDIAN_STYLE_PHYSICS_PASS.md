# Cipher V15.12 — Obsidian-style Network Physics QA

Frontend-only physics pass based on V15.11.

- Restored V15.10 node visual design and entity colors.
- Preserved CSV relationship-driven Links panel from V15.11.
- Replaced the active continuous/breathing force behavior with a damped, bounded, settle-to-sleep force field.
- Removed the post-upload Cytoscape `cose` auto-layout so two competing layout engines cannot fight each other.
- Increased graph centering and damping while reducing repulsion/spring aggressiveness.
- Added hard viewport containment during node dragging.
- Nodes settle and stop instead of continuously drifting.
- No backend files changed.

Validation: `node --check frontend/script.js` passes.
