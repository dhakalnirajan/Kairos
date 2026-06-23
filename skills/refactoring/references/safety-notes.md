# Operation Safety Notes

## Text-Based vs AST-Based

All four operations are text/regex-based, not AST-based. This means:

- **They are fast and dependency-free**, requiring no TypeScript compiler,
  no language server, no parser installation.
- **They can be fooled by**: identifiers inside string literals or
  comments (the word-boundary regex won't distinguish them from real
  identifier occurrences), multiline template literals, unusual
  indentation, and any case where context that an AST would resolve
  (scope, shadowing, type information) matters.

Treat every operation as: "this usually works for the common case, always
run `testing` after, and `git diff` is your safety net."

## Per-Operation Notes

### extract-function

Wraps a literal line range as a new function body, inserted immediately
before the extracted range, with a call replacing the range. Does not:
detect what values in the extracted range are used from the outer scope
(parameters would need to be inferred), check whether the range spans
multiple logical statements cleanly, or handle early `return` in the
middle of the extracted range. Best results on self-contained blocks
(e.g. a guard clause or a data-transformation block).

### rename-symbol

Word-boundary `\b`-anchored global find-and-replace in one file. Will
rename occurrences in comments and string literals, not just code. Prefer
running on a fresh git working tree so false positives can be reverted
with `git checkout -- <file>`.

### inline-variable

Requires exactly one assignment to the variable in the given range —
safety check to avoid incorrectly inlining a mutated variable. Replaces
every reference to the variable with the RHS value literally (no
expression complexity analysis). Does not handle destructuring
assignments or variables assigned via shorthand in an object.

### extract-constant

Inserts a `const NAME = VALUE;` line immediately before the target line
and replaces all occurrences of the literal value (by string equality,
not semantic equivalence) throughout the file. For string literals,
matches inside any quote character; for numeric literals, word-boundary
match. Produces one insertion line, so line numbers below the insertion
point shift by one — factor this in if running multiple operations on
the same file in one session.

## Recommended Workflow

1. `simplify --scope <file>` to identify candidates.
2. `refactoring --op <op> --file <file> ...` to apply one transformation.
3. `testing` to confirm behavior unchanged.
4. `code-review --files <file>` for a final check on the result.
