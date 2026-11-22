# AI test results – GR verification

Log of the manual GR verification tests run with `npm run check:gr` (spec section 6).
All images and names are **dummy data** (fictional delivery note, ACE International → Valda Corp.).

## Test setup

| Item | Value |
|---|---|
| Script | `scripts/check-gr.mjs` (system prompt, Zod schema and code guards from spec section 6) |
| Context A | `scripts/gr-context-a.json`: SI-2026-00123 · Valda Corp. · PO-2026-1192 · DN-2026-0845 · recipient **Manolito Bayle** · QR none |
| Context B | `scripts/gr-context-b.json`: same as A, but recipient **Maria Santos** (wrong signer) |
| Delivery date in context | `2026-11-21` unless noted (printed on the document as November 21, 2026) |
| Cost | Estimated from tokens × OpenRouter list price (Claude Sonnet 5: $2 / $10 per million tokens in / out; Gemini 3.8 Flash: $0.825 / $4.125). PHP at ₱58 per USD. |

### Images used

`gr-01-valid-signed.jpg` was replaced twice during testing; the versions are labelled below.

| Label | File | Handwritten received date | Notes |
|---|---|---|---|
| gr-01 (v1) | `gr-01-valid-signed.jpg`, first version (2.9 MB) | 10/25/2026 | Shadow across the page; date is **before** the printed delivery date. No longer in the repo. |
| gr-02 | `gr-02-valid-signed.jpg` (3.5 MB) | 11/22/2026 | One day **after** the test date of 21 Nov. |
| gr-01 (v3) | `gr-01-valid-signed.jpg`, current version (3.5 MB) | 11/21/2026 | Same day as delivery. The version in the repo. |

## Results

| # | Date (Manila) | Image | Context | Expected | Actual (final) | Confidence | Model | Tokens in / out | Cost per check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-21 | gr-01 (v1) | A | VALID | 🟡 NEEDS_REVIEW | MEDIUM | `anthropic/claude-sonnet-5` | 6,672 / 1,227 | $0.0256 (₱1.48) | **Correct for the document:** received 10/25/2026 is before delivery 2026-11-21. The AI flagged the date and chose NEEDS_REVIEW. |
| 2 | 2026-11-21 | gr-01 (v1) | B | INVALID | 🔴 INVALID | HIGH | `anthropic/claude-sonnet-5` | 6,670 / 571 | $0.0191 (₱1.11) | Correct: signer Manolito Bayle ≠ Maria Santos; date also flagged. |
| 3 | 2026-11-21 | gr-01 (v1) | A | VALID | 🟡 NEEDS_REVIEW | MEDIUM | `anthropic/claude-sonnet-5` | 6,672 / 866 | $0.0220 (₱1.28) | Rerun after script fixes (Manila date, image format). Same result as #1. |
| 4 | 2026-11-21 | gr-01 (v1) | A, delivery date changed to `2026-10-25` | VALID | 🟢 VALID | MEDIUM | `anthropic/claude-sonnet-5` | 6,672 / 1,424 | $0.0276 (₱1.60) | Correct. Medium confidence because the printed delivery date (Nov 21) conflicts with the context; the AI noted it "for awareness". |
| 5 | 2026-11-21 | gr-02 | A | NEEDS_REVIEW (future date) | ⚠️ not run | – | `anthropic/claude-sonnet-5` | – | – | OpenRouter refused: no credits left. |
| 6 | 2026-11-21 | gr-02 | B | INVALID | 🔴 INVALID | HIGH | `anthropic/claude-sonnet-5` | 6,670 / 440 | $0.0177 (₱1.03) | Verdict correct, **but the AI misjudged "today"**: it called 2026-11-22 "not in the future" when today was 2026-11-21 and set Date valid = YES. This led to spec v2.1 (date check moved into code). |
| 7 | 2026-11-21 | gr-01 (v3) | A | VALID | ⚠️ not run | – | `anthropic/claude-sonnet-5` | – | – | No credits. |
| 8 | 2026-11-21 | gr-01 (v3) | B | INVALID | ⚠️ not run | – | `anthropic/claude-sonnet-5` | – | – | No credits. |
| 9 | 2026-11-22 | gr-01 (v3) | A | VALID | 🟢 VALID | HIGH | `google/gemini-3.8-flash` | 2,326 / 930 (727 thinking) | $0.0058 (₱0.33) | Correct. First run after switching model and adding credits. |
| 10 | 2026-11-22 | gr-01 (v3) | B | INVALID | 🔴 INVALID | HIGH | `google/gemini-3.8-flash` | 2,323 / 828 (532 thinking) | $0.0053 (₱0.31) | Correct; reason names both people. |
| 11 | 2026-11-22 | gr-01 (v3) | A | VALID | 🟢 VALID | HIGH | `google/gemini-3.8-flash` | 2,325 / 682 (509 thinking) | $0.0047 (₱0.27) | Correct. **Spec v2.1:** date checked in code (`lib/grGuards.ts`), AI only reads the date. |
| 12 | 2026-11-22 | gr-01 (v3) | B | INVALID | 🔴 INVALID | HIGH | `google/gemini-3.8-flash` | 2,322 / 717 (550 thinking) | $0.0049 (₱0.28) | Correct, spec v2.1. |

## Summary

- **Verdicts:** all 9 checks that ran gave a final verdict that was correct for the document as photographed. Runs #1 and #3 returned NEEDS_REVIEW instead of the expected VALID because the photo's own dates conflicted; 3 checks (#5, #7, #8) did not run (no credits).
- **Date judgement:** Claude Sonnet 5 misjudged a next-day date as "not in the future" (#6). Since spec v2.1 the date is validated in code, so this can no longer affect the verdict; the cases are covered by unit tests in `tests/grGuards.test.ts`.
- **Cost:** about **$0.02–0.03 per check** with Claude Sonnet 5 versus **about $0.005 per check** with Gemini 3.8 Flash (roughly 4–5× cheaper, partly because the image uses fewer input tokens).
- **"Thinking" models:** Gemini 3.8 Flash spends most of its output tokens on reasoning; answer limits must leave room for it (`check-gr.mjs` uses 4,000).
- **Still to test:** the full 10-image manual set from spec section 10 (target ≥ 8/10 correct).
