# Complexity Metrics Reference

## Cyclomatic Complexity

Counted as `1 + (number of branch points)`, where branch points are
occurrences of `if`, `else if`, `for`, `while`, `case`, `catch`, ternary
`?`, `&&`, and `||`. This is a simplified approximation of McCabe
complexity — it counts boolean operators as branches too, which is stricter
than the classical definition but tends to correlate well with "hard to
hold in your head" code in practice.

## Nesting Depth

Maximum brace-nesting depth within the function body, tracked by a simple
counter incremented on `{` and decremented on `}`. Does not distinguish
control-flow braces from object-literal braces, so a function returning a
deeply nested object literal can register high depth without being
control-flow complex — check the flagged reason list, not just the number.

## Length

Raw line count of the function body including blank lines and comments.
A long function full of comments will still flag; this is intentional,
since long functions are harder to review regardless of why they're long.

## Parameter Count

Comma-separated count of the parameter list. Destructured parameters count
as one (e.g., `function f({a, b, c})` is 1 parameter, not 3) since the
heuristic splits on top-level commas inside the outer parens only when
they're simple — deeply nested destructuring may undercount.

## Known Limitations

This is a regex/brace heuristic, not an AST-based parser. It can misfire on:
- Arrow functions assigned without an explicit `function` keyword in some
  unusual formatting styles.
- Generated or minified code.
- Functions using unconventional brace placement (e.g., Allman style).

Treat `simplify` output as a prioritized worklist, not a certified audit.
