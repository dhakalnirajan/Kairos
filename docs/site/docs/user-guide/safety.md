---
title: Safety
sidebar_position: 5
description: 4-layer safety pipeline for secure tool execution.
---

# Safety Pipeline

Kairos implements a 4-layer safety pipeline that runs on every tool call.

## Safety Layers

### L1: Input Sanitization

- Strips ANSI escape sequences
- Removes null bytes and control characters
- Detects prompt injection patterns ("ignore all previous instructions", "system: you are")

### L2: Harm Detection

11 regex patterns covering:
- **Destructive filesystem**: `rm -rf /`, `format`, `del /s /q`
- **Disk destruction**: `mkfs`, `dd if=`
- **Remote execution**: `curl|wget` piped to shell
- **Obfuscated execution**: base64 decode piped to shell
- **System shutdown**: `shutdown`, `reboot`, `poweroff`
- **User management**: `useradd`, `userdel`
- **Permission escalation**: `chmod 777`, `chown -R`
- **Fork bombs**: `:(){ :|:& };:`

### L3: Risk Classification

Maps tools to risk levels:
- **read**: Safe read-only operations
- **write**: File modifications
- **execute**: Shell commands
- **network**: HTTP requests

### L4: Policy Check

Mode-based blanket policies:
- **PLAN mode**: Blocks all mutating tools
- **ULTRAPLAN mode**: Blocks all mutating tools
- **DREAM mode**: Blocks all interactive tools
- **NORMAL mode**: HITL for risky tools

### L5: Path Confinement

Blocks writes/deletes to system directories:
- `/etc`, `/sys`, `/proc`, `/boot`
- `C:\Windows\System32`

### L6: HITL Approval

Human-in-the-loop approval for:
- Shell commands (`bash`)
- File writes (`write_file`)
- File edits (`edit_file`)

Configurable via `requireConfirmationFor` in config.

## Safety Configuration

```json
{
  "safety": {
    "enabled": true,
    "allowedRiskLevels": ["read", "write", "execute"],
    "blockedCommands": ["rm -rf /", "format", "del /s /q"],
    "blockedPaths": ["/etc", "/System", "/Windows/System32"],
    "autoApprove": false,
    "requireConfirmationFor": ["bash", "write", "edit"]
  }
}
```

## YOLO Mode

Skip all safety checks:

```bash
kairos --yolo
# or
kairos --mode YOLO
```

**WARNING**: YOLO mode bypasses all safety checks. Use only in controlled environments.

## Safety Commands

```bash
# View blocked commands
kairos config show | jq .safety.blockedCommands

# Add a blocked command
kairos config set safety.blockedCommands+ "dangerous_command"

# Disable safety (NOT recommended)
kairos config set safety.enabled false
```

## Next Steps

- [Configuration](configuration.md) — Safety configuration options
- [CLI Flags](cli-flags.md) — Safety-related flags