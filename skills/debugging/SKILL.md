---
name: debugging-and-error-recovery
description: Guides systematic root-cause debugging. Use when tests fail, builds break, or behavior doesn't match expectations.
---

# Debugging and Error Recovery

## Overview

Systematic debugging with structured triage. When something breaks, stop adding features, preserve evidence, and follow a structured process to find and fix the root cause.

## When to Use

- Tests fail after a code change
- The build breaks
- Runtime behavior doesn't match expectations
- A bug report arrives
- An error appears in logs or console

## The Stop-the-Line Rule

When anything unexpected happens:

```
1. STOP adding features or making changes
2. PRESERVE evidence (error output, logs, repro steps)
3. DIAGNOSE using the triage checklist
4. FIX the root cause
5. GUARD against recurrence
6. RESUME only after verification passes
```

## The Triage Checklist

### Step 1: Reproduce
Make the failure happen reliably.

### Step 2: Localize
Narrow down WHERE the failure happens.

### Step 3: Reduce
Create the minimal failing case.

### Step 4: Fix the Root Cause
Fix the underlying issue, not the symptom.

### Step 5: Guard Against Recurrence
Write a test that catches this specific failure.

### Step 6: Verify End-to-End
After fixing, verify the complete scenario.

## Verification

After fixing a bug:

- [ ] Root cause is identified and documented
- [ ] Fix addresses the root cause, not just symptoms
- [ ] A regression test exists that fails without the fix
- [ ] All existing tests pass
- [ ] Build succeeds
