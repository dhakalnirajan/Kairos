---
name: performance-optimization
description: Optimizes application performance. Use when performance requirements exist or when you suspect performance regressions.
---

# Performance Optimization

## Overview

Measure before optimizing. Performance work without measurement is guessing — and guessing leads to premature optimization that adds complexity without improving what matters.

## When to Use

- Performance requirements exist in the spec
- Users or monitoring report slow behavior
- You suspect a change introduced a regression
- Building features that handle large datasets or high traffic

## The Optimization Workflow

```
1. MEASURE  → Establish baseline with real data
2. IDENTIFY → Find the actual bottleneck (not assumed)
3. FIX      → Address the specific bottleneck
4. VERIFY   → Measure again, confirm improvement
5. GUARD    → Add monitoring or tests to prevent regression
```

## Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

## Common Anti-Patterns

### N+1 Queries (Backend)
```typescript
// BAD: N+1 — one query per task for the owner
const tasks = await db.tasks.findMany();
for (const task of tasks) {
  task.owner = await db.users.findUnique({ where: { id: task.ownerId } });
}

// GOOD: Single query with join/include
const tasks = await db.tasks.findMany({ include: { owner: true } });
```

### Large Bundle Size
```typescript
// GOOD: Dynamic import for heavy, rarely-used features
const ChartLibrary = lazy(() => import('./ChartLibrary'));
```

## Performance Budget

```
JavaScript bundle: < 200KB gzipped (initial load)
API response time: < 200ms (p95)
Lighthouse Performance score: ≥ 90
```

## Verification

After any performance-related change:

- [ ] Before and after measurements exist
- [ ] The specific bottleneck is identified and addressed
- [ ] Bundle size hasn't increased significantly
- [ ] Existing tests still pass
