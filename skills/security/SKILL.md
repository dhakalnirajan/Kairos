---
name: security-and-hardening
description: Hardens code against vulnerabilities. Use when handling user input, authentication, data storage, or external integrations.
---

# Security and Hardening

## Overview

Security-first development practices. Treat every external input as hostile, every secret as sacred, and every authorization check as mandatory.

## When to Use

- Building anything that accepts user input
- Implementing authentication or authorization
- Storing or transmitting sensitive data
- Integrating with external APIs or services

## Process: Threat Model First

1. **Map the trust boundaries.** Where does untrusted data cross into your system?
2. **Name the assets.** What's worth stealing or breaking?
3. **Run STRIDE over each boundary:**
   - Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege

## The Three-Tier Boundary System

### Always Do (No Exceptions)
- Validate all external input at the system boundary
- Parameterize all database queries
- Encode output to prevent XSS
- Use HTTPS for all external communication
- Hash passwords with bcrypt/scrypt/argon2
- Run `npm audit` before every release

### Ask First (Requires Human Approval)
- Adding new authentication flows
- Storing new categories of sensitive data
- Adding new external service integrations

### Never Do
- Never commit secrets to version control
- Never log sensitive data
- Never trust client-side validation as a security boundary
- Never use `eval()` or `innerHTML` with user-provided data

## Verification

After implementing security-relevant code:

- [ ] `npm audit` shows no critical or high vulnerabilities
- [ ] No secrets in source code or git history
- [ ] All user input validated at system boundaries
- [ ] Authentication and authorization checked on every protected endpoint
