# Safety Pipeline

Kairos implements a 6-layer safety pipeline for all tool calls.

## Layers

### Layer 1: Input Sanitization
- Strips null bytes and control characters
- Removes ANSI escape codes
- Normalizes Unicode

### Layer 2: Harm Detection
- Blocks destructive commands (`rm -rf`, `format`, `drop table`)
- Detects fork bombs
- Blocks system directory access

### Layer 3: Path Confinement
- Enforces workspace root boundary
- Blocks path traversal (`../`)
- Blocks access to system directories

### Layer 4: Network Security
- Blocks private/internal IPs (127.x, 10.x, 192.168.x)
- Prevents SSRF attacks
- Blocks DNS rebinding

### Layer 5: HITL Approval
- Requires confirmation for high-risk tools
- Configurable per-tool approval
- TUI modal for approval

### Layer 6: Audit Logging
- Logs all tool executions
- Scrubs secrets from logs
- Records timestamps, duration, results

## Configuration

```json
{
  "safety": {
    "enabled": true,
    "allowedRiskLevels": ["read", "write", "execute"],
    "blockedCommands": ["rm -rf /", "format"],
    "requireConfirmationFor": ["bash", "write", "edit"],
    "autoApprove": false
  }
}
```

## Environment Variables

```bash
KAIROS_SAFETY_ENABLED=true
KAIROS_SAFETY_AUTO_APPROVE=false
```
