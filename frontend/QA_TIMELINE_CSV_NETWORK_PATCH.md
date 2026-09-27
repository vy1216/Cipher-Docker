# CIPHER — Timeline + CSV Network QA Patch

## Scope
Frontend-only patch. Backend source files are unchanged.

## Fixed
- Timeline is a strict four-column equal-spacing grid that grows downward.
- Timeline container permits vertical scrolling only; horizontal scrollbar is suppressed.
- Timeline card hover/focus/far/search states no longer blur, dim, or hide cards.
- Timeline sequence completion now uses the number of active cards instead of the original static card count.
- CSV parser strips UTF-8 BOM from headers.
- Master CSV detection uses parsed headers/record types instead of brittle raw-text regex.
- Master CSV relationship references resolve against uploaded node IDs and labels.
- CSV upload success keeps the investigator on Network instead of immediately switching to Review, so the uploaded CSV preview remains visible.
- Local CSV preview remains explicitly pending/unverified until review.

## QA against bundled master CSV
Input: `samples/CIPHER_complete_case_master_single_CSV.csv`
- 26 node records
- 33 relationship records
- 9 event records
- 5 location records
- 6 evidence records
- 8 review queue records

Expected network preview after upload:
- 26 CSV nodes
- 33 CSV links
- CSV PREVIEW / PENDING REVIEW status
- No fallback to the older case graph

## Backend
No files under `python_backend/` or `supabase/` were modified.
