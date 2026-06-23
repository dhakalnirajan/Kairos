# Review Checklist Categories

`code-review` runs four independent checks. Each can surface zero or more
comments; they are not mutually exclusive on a single file.

## 1. Scope Creep

Only runs when `--task` is provided. Extracts keywords (words longer than
3 characters) from the task description and checks whether each changed
file's path contains any of them. Files with no match get a `nit` comment
asking for confirmation — this is a prompt to double check, not a
correctness claim, since plenty of legitimate changes touch files with
unrelated names (e.g. a shared utils file).

## 2. Missing Tests

If any non-test source file changed and zero test files changed in the
same diff, every changed source file gets a `should-fix` comment. This is
diff-level, not function-level — it won't catch "added a new function to
an already-changed file with no new assertions for that function."

## 3. Naming Consistency

Counts camelCase vs snake_case identifier occurrences per file. Flags
files with significant mixing (>3 of each) as `nit`. Common legitimate
cases that will trigger this: files wrapping a snake_case external API or
database column names in an otherwise camelCase codebase.

## 4. Obvious Smells

Line-level pattern matching for: leftover `console.log`/`console.debug`,
`TODO`/`FIXME` markers, and empty `catch` blocks. Empty catch blocks are
the only check that produces `blocking` severity — silently swallowed
errors are considered always worth flagging hard.

## Severity Definitions

- **blocking** — should not merge without addressing.
- **should-fix** — strong recommendation, use judgment.
- **nit** — minor, stylistic, or needs-confirmation only.
