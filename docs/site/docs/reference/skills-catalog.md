---
title: Skills Catalog
sidebar_position: 3
description: Complete documentation for all 28 skills.
---

# Kairos Skills Reference

Complete documentation for all 28 skills in the Kairos agent harness.

---

## Development Workflow Skills

### plan
**Purpose:** Write actionable markdown plans without executing code.

**Behavior:**
- Read-only planning mode - no code changes, no mutations
- Creates bite-sized tasks (2-5 minutes each)
- Includes exact file paths, complete code, verification steps
- Saves plans to `.plans/` directory

**When to Use:**
- Before implementing multi-step features
- Breaking down complex requirements
- Delegating to subagents

**Example:**
```
/skill run plan --task "Add user authentication"
```

---

### tdd
**Purpose:** Enforce Red-Green-Refactor test-driven development.

**Behavior:**
- Write failing test FIRST (mandatory)
- Watch test fail
- Write minimal code to pass
- Watch test pass
- Refactor if needed
- Repeat for next behavior

**When to Use:**
- Implementing any new logic
- Fixing bugs
- Refactoring code
- Changing behavior

**Iron Law:** No production code without a failing test first.

---

### debug
**Purpose:** 4-phase root cause debugging.

**Behavior:**
1. **Root Cause Investigation** - Read errors, reproduce, check changes
2. **Pattern Analysis** - Find working examples, compare
3. **Hypothesis Testing** - Form theory, test minimally
4. **Implementation** - Fix root cause, verify

**When to Use:**
- Tests fail
- Build breaks
- Unexpected behavior
- Production bugs

**Iron Law:** No fixes without root cause investigation first.

---

### testing
**Purpose:** Testing strategies, patterns, and best practices.

**Behavior:**
- Test pyramid (80% unit, 15% integration, 5% E2E)
- Arrange-Act-Assert pattern
- One assertion per concept
- Test behavior, not implementation

**When to Use:**
- Writing tests for new features
- Improving test coverage
- Debugging test failures

---

### simplify
**Purpose:** Parallel 3-agent code cleanup.

**Behavior:**
- 3 parallel reviewers (Reuse, Quality, Efficiency)
- Each reviewer searches codebase for specific issues
- Aggregate findings, apply in risk order: SAFE → CAREFUL → RISKY
- Verify tests still pass

**When to Use:**
- After implementing features
- Before committing changes
- Code cleanup requests

---

### review
**Purpose:** Pre-commit verification pipeline.

**Behavior:**
1. Get diff
2. Static security scan
3. Baseline tests and linting
4. Self-review checklist
5. Independent reviewer subagent
6. Evaluate results
7. Auto-fix if needed
8. Commit with [verified] prefix

**When to Use:**
- Before `git commit` or `git push`
- After completing a task with 2+ file edits

---

### debugging
**Purpose:** Systematic root-cause debugging.

**Behavior:**
- 5-step triage: Reproduce → Localize → Reduce → Fix → Guard
- Stop-the-line rule
- Safe fallback patterns
- Evidence-based diagnosis

**When to Use:**
- Tests fail after code change
- Build breaks
- Runtime behavior doesn't match expectations

---

### code-review
**Purpose:** Multi-axis code review with quality gates.

**Behavior:**
- 5-axis review: Correctness, Readability, Architecture, Security, Performance
- Change sizing (~100 lines ideal)
- Severity labels: Critical, Required, Nit, Optional, FYI
- Review speed: respond within one business day

**When to Use:**
- Before merging any change
- After completing a feature
- When evaluating code quality

---

### performance
**Purpose:** Measure-first performance optimization.

**Behavior:**
- Establish baseline with real data
- Find actual bottleneck (not assumed)
- Fix specific bottleneck
- Measure again to confirm
- Add monitoring to prevent regression

**When to Use:**
- Performance requirements exist
- Users report slow behavior
- Suspecting performance regression

---

### security
**Purpose:** Security hardening practices.

**Behavior:**
- Threat model first (STRIDE)
- Three-tier boundary system (Always Do, Ask First, Never Do)
- OWASP Top 10 prevention patterns
- Input validation at system boundaries

**When to Use:**
- Handling user input
- Authentication/authorization
- Data storage
- External integrations

---

### git-workflow
**Purpose:** Git best practices and commit conventions.

**Behavior:**
- Conventional Commits format
- Trunk-based development
- Atomic commits
- Never force push to main

**When to Use:**
- Making any code change
- Creating commits
- Managing branches

---

## Design & Documentation Skills

### design-md
**Purpose:** DESIGN.md format specification for visual identities.

**Behavior:**
- YAML front matter with design tokens
- Markdown body with design rationale
- CLI tools for lint, diff, export
- Compatible with Tailwind, DTCG formats

**When to Use:**
- Building/modifying UI components
- Defining design systems
- Creating visual identities

---

### design-to-code
**Purpose:** Convert code to Stitch designs.

**Behavior:**
- Extract HTML from running apps
- Generate design systems
- Upload to Stitch projects
- Create design variants

**When to Use:**
- Converting frontend code to designs
- Generating design screens
- Managing design systems

---

### code-generation
**Purpose:** Generate code from designs.

**Behavior:**
- Convert designs to React components
- Generate React Native components
- Create walkthrough videos
- Build with shadcn/ui

**When to Use:**
- Converting designs to code
- Generating component libraries
- Creating UI from mockups

---

### documentation
**Purpose:** Documentation generation and maintenance.

**Behavior:**
- API documentation
- User guides
- Architecture docs
- Changelogs

**When to Use:**
- Writing API docs
- Creating user guides
- Documenting architecture

---

## Analysis Skills

### code-analyzer
**Purpose:** Analyze code quality, find issues, detect dead code.

**Behavior:**
- Quality analysis (complexity, style)
- Dead code detection
- Security scanning
- Dependency analysis
- Metrics collection

**When to Use:**
- Reviewing code quality
- Auditing codebases
- Finding security issues

---

### accessibility
**Purpose:** Web accessibility standards and WCAG compliance.

**Behavior:**
- WCAG 2.1 principles (POUR)
- Common issue detection
- Testing tools integration
- Quick fixes for common problems

**When to Use:**
- Building user interfaces
- Reviewing existing UIs
- Ensuring WCAG compliance

---

### i18n
**Purpose:** Internationalization and localization.

**Behavior:**
- String externalization
- Translation file management
- Date/number formatting
- RTL language support

**When to Use:**
- Adding multi-language support
- Localizing user interfaces
- Managing translations

---

## Operations Skills

### deployment
**Purpose:** Deployment automation and CI/CD.

**Behavior:**
- Blue-green, canary, rolling strategies
- CI/CD pipeline configuration
- Environment management
- Rollback procedures

**When to Use:**
- Setting up CI/CD pipelines
- Deploying applications
- Managing releases

---

### monitoring
**Purpose:** Monitoring, observability, and alerting.

**Behavior:**
- Three pillars: Metrics, Logs, Traces
- Structured logging format
- Alerting rules
- Performance analysis

**When to Use:**
- Setting up monitoring
- Configuring logging
- Debugging production issues

---

### migration
**Purpose:** Data/code migration strategies.

**Behavior:**
- Assessment → Preparation → Execution → Verification
- Small batch migrations
- Rollback planning
- Data integrity validation

**When to when to Use:**
- Migrating databases
- Upgrading frameworks
- Moving to new infrastructure

---

## Specialized Skills

### sdlc
**Purpose:** Autonomous SDLC sub-agent for full lifecycle management.

**Behavior:**
- Requirements gathering
- Architecture design
- Project planning
- Implementation
- Code review
- Testing
- Deployment
- Monitoring

**When to Use:**
- Full software development lifecycle
- Complex project management
- Multi-phase implementations

---

### skill-creator
**Purpose:** Create, test, and improve skills iteratively.

**Behavior:**
- Capture user intent
- Write SKILL.md drafts
- Run test prompts
- Evaluate results qualitatively and quantitatively
- Improve based on feedback
- Package for distribution

**When to Use:**
- Creating new skills
- Improving existing skills
- Running skill evaluations

---

### obsidian-vault-architect
**Purpose:** Organize Obsidian vaults with sub-agent orchestration.

**Behavior:**
- 4-phase process: Autopsy → Restructure → DNA → Curation
- Theme extraction and orphan detection
- Folder structure design
- Vault DNA documentation
- Note curation (keep/archive/delete)

**When to Use:**
- Organizing Obsidian vaults
- Restructuring folder hierarchies
- Curating dead notes

---

### system-design
**Purpose:** System architecture design and planning.

**Behavior:**
- Architecture diagrams (C4, UML, flowcharts)
- Component planning
- API and data model design
- Trade-off evaluation

**When to Use:**
- Designing new systems
- Refactoring architecture
- Planning infrastructure

---

## Skill File Structure

Each skill follows this structure:

```
skill-name/
├── SKILL.md              # Required: Metadata & Instructions
├── scripts/              # Executable code
├── references/           # Documentation for context
├── config/               # Configuration templates
├── examples/             # Usage samples
└── tests/                # Validation scripts
```

## Skill Registration

Skills are automatically discovered from the `skills/` directory. Each skill's `SKILL.md` frontmatter defines:
- `name`: Unique identifier
- `description`: When to trigger and what it does
- `tools`: Required agent tools
- `permissions`: Read/write/execute permissions
- `entrypoint`: Main script path (if applicable)