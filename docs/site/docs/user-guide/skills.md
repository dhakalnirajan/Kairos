---
title: Skills
sidebar_position: 8
description: Reusable knowledge and workflows for Kairos.
---

# Skills

Kairos supports skills — reusable knowledge and workflows.

## What Are Skills?

Skills are markdown files containing:
- **Name** and **description**
- **Trigger conditions** (when to apply)
- **Step-by-step instructions**

## Skill Format

```markdown
---
name: code-review
description: Comprehensive code review checklist
trigger: code review request
---

# Code Review Skill

## Steps

1. Check for type safety (`any` usage, missing null checks)
2. Verify error handling
3. Look for security issues
4. Assess performance
5. Check test coverage
6. Review documentation
```

## Creating Skills

### Manual Creation

```bash
# Create skill directory
mkdir -p ~/.kairos/skills

# Create skill file
cat > ~/.kairos/skills/code-review.md << 'EOF'
---
name: code-review
description: Code review checklist
trigger: review
---

# Code Review

1. Check types
2. Check errors
3. Check security
4. Check performance
EOF
```

### Via Command

```bash
/skill create --name my-skill --description "My custom skill"
```

## Using Skills

### Automatic Matching

Skills are automatically matched based on trigger conditions and injected into the system prompt.

### Manual Invocation

```bash
/skill list          # List available skills
/skill run code-review  # Run a specific skill
```

## Skill Storage

Skills are stored in:
- `~/.kairos/skills/` — Global skills
- `.kairos/skills/` — Project skills

## Distilled Skills

Kairos can learn skills from your interactions:

```bash
# Distill patterns from recent conversations
/distill
```

This analyzes your recent interactions and creates reusable skill files.

## Skill Marketplace

```bash
# Search for skills
/marketplace search code-review

# Install a skill
/marketplace install my-skill

# List installed skills
/marketplace list
```

## Next Steps

- [Recipes](../guides/recipes.md) — Common workflows
- [Tools](tools.md) — Available tools