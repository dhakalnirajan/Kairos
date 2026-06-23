# Design Document

## Problem
Need to rate limit uploads per user

## Goals
- _(fill in: what does success look like)_

## Non-Goals
- _(fill in: what is explicitly out of scope)_

## Proposed Approach
Token bucket in Redis, checked in middleware

## Alternatives Considered
### Alternative 1
Polling on a fixed interval

**Why not chosen:** _(fill in)_

### Alternative 2
Fixed-window counter in Postgres

**Why not chosen:** _(fill in)_

## Tradeoffs
- _(fill in: what does the proposed approach give up relative to alternatives)_

## Open Questions
- _(fill in: anything unresolved before implementation starts)_
