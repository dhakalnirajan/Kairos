# Skills

Skills are YAML-defined workflows that extend Kairos functionality.

## Skill Structure

```yaml
name: code-review
description: Automated code review workflow
triggers:
  - /review

steps:
  - action: read_files
    params:
      pattern: "**/*.ts"
  
  - action: analyze_code
    params:
      checks:
        - security
        - performance
        - style
  
  - action: generate_report
    params:
      format: markdown
```

## Creating Skills

1. Create a YAML file in `~/.kairos/skills/`
2. Define name, description, triggers, and steps
3. Skills are auto-discovered on startup

## Built-in Skills

| Skill | Description |
|-------|-------------|
| `code-review` | Automated code review |
| `test-gen` | Test generation |
| `refactor` | Code refactoring |
| `document` | Documentation generation |

## Skill Commands

```bash
/skill list          # List available skills
/skill run <name>    # Run a skill
/skill create        # Create new skill
```
