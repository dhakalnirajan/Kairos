# Key Flattening and String Detection Notes

## Translation Key Flattening

Nested JSON like:

```json
{ "auth": { "login": { "title": "Sign in" } } }
```

flattens to the dot-path key `auth.login.title`. Arrays are treated as
leaf values (not recursed into), since translation files conventionally
nest by object structure, not arrays, and recursing into array indices
would produce unstable, hard-to-read key paths.

## Hardcoded String Heuristic

A candidate string must:
1. Contain at least one space (filters out single-word identifiers/CSS
   classes).
2. Start with an uppercase letter (filters out most variable names and
   attribute values).
3. Not appear on a line that also contains a `t(`, `$t(`, or `i18n.t(`
   call (best-effort — a line with both a translated and an untranslated
   string will miss the untranslated one; this is a known limitation of
   line-level rather than expression-level matching).

This is tuned to favor precision over recall: it will miss real hardcoded
strings that don't match these shapes (lowercase-starting strings,
strings built via template literals/concatenation), but it should rarely
flag something that clearly isn't prose.

## Known Limitations

- Does not parse JSX/Vue template ASTs — purely regex over raw file text.
- Cannot detect strings interpolated across multiple template expressions.
- `--check-keys` treats `null` values as leaf keys present, not missing —
  a locale file with `"title": null` counts as having that key.
