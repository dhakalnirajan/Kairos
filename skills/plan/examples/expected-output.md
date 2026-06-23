# Implementation Plan

## Summary
Add rate limiting to the /api/upload endpoint

## Affected Files (candidates)
- `upload/handler.ts`
- `upload/route.ts`
- `middleware/rate-limit.ts`

## Steps
1. Identify the precise entry point (route handler, function, or component) the task refers to.
2. Review the 3 candidate file(s) listed below for current behavior.
3. Write or update tests that describe the desired behavior (see the `tdd` skill).
4. Implement the change in the smallest viable diff.
5. Run the existing test suite plus any new tests (see the `testing` skill).
6. Self-review the diff for scope creep (see the `code-review` skill).

## Risks
- No high-risk keywords detected. Standard review process applies.

## Open Questions
- _(fill in manually — this tool does not infer intent beyond keyword matching)_

## Suggested Follow-up Skills
- `tdd` — write failing tests for the new behavior first
- `code-generation` — implement once the plan is approved
- `code-review` — review the resulting diff
