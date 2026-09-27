# CIPHER Evidence Processing Performance Fix

## What changed

Evidence processing is now asynchronous from the investigator's HTTP request:

1. Upload saves the file and returns normally.
2. The process endpoint marks the document `QUEUED` and returns immediately.
3. A FastAPI background task runs extraction, including the optional Gemini call.
4. Review opens immediately instead of waiting for AI extraction.
5. The frontend polls only the document status once per second and refreshes Review when processing finishes.
6. Network, GIS, and Timeline refresh only after the document reaches `PROCESSED`.
7. General case refreshes now run independent data loads in parallel with `Promise.allSettled`, avoiding avoidable serial waits.
8. Duplicate clicks while a document is already `QUEUED` or `PROCESSING` do not create duplicate background jobs.

## User-visible behavior

After selecting evidence, the UI reports that processing has started in the background and opens Review immediately. Review may briefly show no new findings while extraction is running; the new pending items appear automatically when processing completes.

## Validation

A local end-to-end HTTP smoke test measured the queue endpoint at about 3 ms on the validation environment, compared with the previous synchronous architecture which necessarily waited for extraction/LLM completion. The background job then completed and the document reached `PROCESSED`.
