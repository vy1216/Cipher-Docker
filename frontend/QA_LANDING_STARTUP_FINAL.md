# CIPHER Landing Startup QA

## Change
CIPHER now starts on the public landing page. Login/signup are explicit actions from the landing page and protected workspace access is not automatically opened during boot.

## Auth-expiry behavior
A stale token discovered while the public landing page is booting no longer hijacks the landing page by opening the login modal. Authentication is only reopened automatically when the protected workspace is already open.

## Routes retained
- `#auth-login` opens login when explicitly requested.
- `#auth-signup` opens signup when explicitly requested.
- `#workspace` opens the protected workspace when explicitly requested.
- No hash / unrelated hash opens the landing page.

## Backend
No backend files changed.
