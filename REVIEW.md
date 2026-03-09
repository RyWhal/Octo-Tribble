# Initial Security/Functionality Review

This document captures a focused review of the current webhook inspector implementation.

## High-severity findings

1. **`request_count` drifts upward and becomes incorrect over time.**
   - Ingest evicts oldest records once max is reached, then always increments `request_count`.
   - Single-request deletion also does not decrement `request_count`.
   - Impact: UI and API metadata become inaccurate, which can mislead operational decisions and troubleshooting.

2. **Worker TypeScript build currently fails.**
   - `scheduled` handler uses an outdated event type signature.
   - `TextDecoder` options object is incompatible with current TS typings in this setup.
   - Impact: cannot reliably type-check/build in CI as-is.

## Medium-severity findings

1. **Form body renderer can crash on malformed percent-encoding.**
   - `decodeURIComponent` throws on invalid escape sequences (e.g. `%E0%A4%A`).
   - There is no local error handling in `parseFormEncoded`, so one malicious or malformed request body can break rendering for that request view.

## Lower-priority observations

1. **Header capture comment and behavior are inconsistent.**
   - Code comment says sensitive CF headers are excluded, but all headers are currently stored.
   - If intentional, adjust the comment; otherwise implement explicit filtering.

2. **Potential race condition near FIFO cap.**
   - Count/check/delete/insert/increment is not atomic. Concurrent ingest bursts can briefly exceed cap and skew `request_count` further.

## Recommended fixes (priority order)

1. Make `request_count` derived from `COUNT(requests)` in reads, or keep it denormalized but maintain it transactionally on every delete/insert/evict path.
2. Fix worker TS errors (`ScheduledController` signature and compatible `TextDecoder` options / overload usage).
3. Harden `parseFormEncoded` with per-pair try/catch fallback behavior.
4. Align header-capture implementation with the stated comment/policy.
5. Add a small integration test script that exercises create → ingest past cap → delete one request and verifies count consistency.
