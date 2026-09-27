# CIPHER — Obsidian-style Network Physics Pass

## What changed
- Network nodes now use a lightweight frontend-only force simulation.
- Nodes repel one another, relationships behave as springs, and a soft center force keeps the graph in view.
- The main/high-connectivity node is larger.
- Nodes can be grabbed and dragged individually.
- A dragged node is pinned at the pointer position; its connected nodes respond through relationship springs, so moving the main node pulls its neighborhood naturally.
- Manual node positions are saved in browser localStorage per case.
- Existing backend IDs, relationships, APIs, CSV processing, inspector, and cross-view events are unchanged.

## Start / Stop
- `START_CIPHER.bat` creates the environment if necessary, installs backend requirements once, starts FastAPI/Uvicorn, and opens the browser.
- `STOP_CIPHER.bat` stops the CIPHER server using the saved PID, with a command-line fallback.

## Intentionally deferred
- Advanced community clustering physics
- Collision force tuning based on node labels
- Multi-level focus / camera physics
- Animated edge particles beyond the existing premium pulse
