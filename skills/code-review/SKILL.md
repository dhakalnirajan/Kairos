---
name: code-review-and-quality
description: Conducts multi-axis code review. Use before merging any change.
---

# Code Review and Quality

## Overview

Multi-dimensional code review with quality gates. Every change gets reviewed before merge — no exceptions. Review covers five axes: correctness, readability, architecture, security, and performance.

## When to Use

- Before merging any PR or change
- After completing a feature implementation
- When another agent or model produced code you need to evaluate
- When refactoring existing code

## The Five-Axis Review

### 1. Correctness
Does the code do what it claims to do?

### 2. Readability & Simplicity
Can another engineer understand this code without the author explaining it?

### 3. Architecture
Does the change fit the system's design?

### 4. Security
Does the change introduce vulnerabilities?

### 5. Performance
Does the change introduce performance problems?

## Change Sizing

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Split it.
```

## Review Process

### Step 1: Understand the Context
- What is this change trying to accomplish?
- What spec or task does it implement?

### Step 2: Review the Tests First
- Do tests exist for the change?
- Do they test behavior (not implementation details)?

### Step 3: Review the Implementation
Walk through the code with the five axes in mind.

### Step 4: Categorize Findings

| Prefix | Meaning | Author Action |
|--------|---------|---------------|
| *(no prefix)* | Required change | Must address before merge |
| **Critical:** | Blocks merge | Security vulnerability, data loss |
| **Nit:** | Minor, optional | Author may ignore |
| **Optional:** | Suggestion | Worth considering but not required |
| **FYI** | Informational only | No action needed |

## Verification

After review is complete:

- [ ] All Critical issues are resolved
- [ ] Tests pass
- [ ] Build succeeds
- [ ] The verification story is documented
