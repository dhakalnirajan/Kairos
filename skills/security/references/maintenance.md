# known-vulnerable.json Maintenance

This file is a small, hand-curated, illustrative list — not a live feed.
It exists so `security` can do something useful offline and dependency-free,
not to compete with `npm audit`, `pip-audit`, or commercial SCA tools.

## Schema

```json
{
  "package": "lodash",
  "vulnerableBelow": "4.17.21",
  "severity": "high",
  "note": "short human-readable explanation"
}
```

`vulnerableBelow` is compared against the installed version with simple
numeric segment comparison (major.minor.patch), ignoring range prefixes
like `^` or `~`. This is intentionally simple and will not handle complex
semver ranges, pre-release tags, or OR-ranges correctly — it is a coarse
check.

## Updating

Add entries as new high-impact, well-known CVEs become relevant to
projects this harness is used on. Do not attempt to make this
comprehensive; that is explicitly out of scope. If a project needs
real dependency vulnerability coverage, run `npm audit` / `pip-audit` /
an SCA tool in CI — `security`'s dependency check is a reminder prompt,
not a gate.
