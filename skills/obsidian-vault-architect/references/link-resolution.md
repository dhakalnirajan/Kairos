# Link Resolution and Orphan Definition

## Wikilink Parsing

Matches `[[Note Name]]`, `[[Note Name|Display Text]]`, and
`[[Note Name#Heading]]` — in all three forms, only the note name portion
(before any `|` or `#`) is used for resolution. Resolution is
case-insensitive against the vault's actual filenames (minus `.md`),
matching Obsidian's own default link-resolution behavior.

## Orphan Definition

A note is orphaned only if **both** of these hold:
- Zero other notes link to it (`incoming` count is zero).
- It links to zero other notes itself (`outgoing` count is zero).

This is a stricter definition than "nothing links to it" — a note that
links out to several other notes but hasn't yet been linked back from
anywhere is still part of the graph's structure (it references context),
so it's not flagged. Only fully isolated notes — islands with no
connection in either direction — are reported as orphaned.

## Tag Inconsistency Grouping

Tags are normalized by lowercasing and stripping hyphens/underscores
before grouping: `#project-status`, `#ProjectStatus`, and
`#project_status` all normalize to `projectstatus` and would be grouped
together as one inconsistency if more than one literal form appears
anywhere in the vault. The `variants` array in output preserves the exact
literal forms found, so the actual fix (pick one, rename the others) can
be applied by hand.

## Frontmatter Convention Detection (for --new-note)

Samples up to the first 20 notes (by directory traversal order) found
with a frontmatter block, counts which YAML keys appear, and adopts any
key appearing in at least 50% of sampled notes as part of the "common"
convention. For an empty or very small vault, falls back to a minimal
`title`/`created`/`tags` set rather than producing an empty frontmatter
block.
