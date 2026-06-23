---
name: "content-humanizer"
version: "1.0.0"
description: "Flags formulaic AI-writing tells in a text file (stock openers, robotic transition words, hedging hype phrases, repetitive sentence rhythm) with file:line references, without rewriting the text itself"
author: "harness-core"
category: "documentation"
tools:
  - read_file
permissions:
  - allow: [read_file]
  - ask: []
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`content-humanizer` detects, rather than fixes, the most common
mechanical tells of unedited AI-generated prose: stock openers ("In
today's fast-paced world"), robotic transition words used as sentence
starters ("Moreover,", "Furthermore,", "Additionally,"), vague corporate
hype phrases ("leverage synergies", "seamlessly integrated",
"unprecedented"), and uniform sentence length (a strong signal of
unedited generation, since human writing naturally varies sentence
length more). It reports findings with line numbers so the actual editing
— which requires judgment about voice and context this tool doesn't have
— stays a human or careful-rewrite task, not an automated find-replace.

## Behavior Patterns

- Checks against a configurable word/phrase list
  (`references/tell-phrases.json`) for stock openers, hedge words, and
  hype phrases, matched case-insensitively at sentence boundaries where
  relevant (openers) or anywhere in text (hype phrases).
- Computes sentence-length variance across the document; flags the
  document as a whole (not per-line) if variance is unusually low relative
  to a configurable threshold, since uniform sentence length is a
  document-level signal, not a single-line one.
- Counts transition-word sentence-starters (`Moreover`, `Furthermore`,
  `Additionally`, `Consequently`, etc.) and flags the document if their
  frequency exceeds a threshold — occasional use is normal human writing;
  high frequency is a tell.
- Every per-line finding includes the exact matched phrase and its line
  number; the document-level findings (sentence variance, transition
  density) are reported separately with supporting statistics, not tied
  to a single line.
- Never rewrites or suggests replacement text — explicitly out of scope,
  since good rewriting requires understanding voice and intent that a
  phrase-matching scanner doesn't have.

## When to Use

- Reviewing drafted content (blog posts, documentation, reports) before
  publishing, to catch mechanical tells worth manually revising.
- Not a guarantee of "sounding human" if all findings are addressed — it
  catches the most common, most easily mechanically detectable tells, not
  every signal of unedited generation.

## Example Invocations

```
/skill run content-humanizer --file draft.md
/skill run content-humanizer --file references/blog-post.md --threshold-transition-density 0.05
```

## Expected Inputs

- `--file` (path, required): the text/Markdown file to analyze.
- `--threshold-transition-density` (number, optional, default 0.08):
  fraction of sentences starting with a flagged transition word above
  which the document-level finding triggers.
- `--threshold-variance` (number, optional, default 15): minimum sentence-
  length standard deviation (in words) below which low-variance is
  flagged.

## Expected Outputs

JSON: `{ "lineFindings": [{ "line": number, "phrase": string, "category": "stock-opener"|"hype-phrase" }], "documentFindings": { "transitionDensity": number, "transitionDensityFlagged": boolean, "sentenceLengthStdDev": number, "lowVarianceFlagged": boolean } }`.

## Side Effects and Warnings

- Entirely read-only.
- Phrase matching is a fixed list (`references/tell-phrases.json`) and
  will not catch every formulaic pattern, nor every domain's specific
  jargon-as-hype-phrase usage — treat findings as a starting checklist,
  not exhaustive coverage.
- Sentence-length variance is a probabilistic signal, not proof of AI
  generation — deliberately uniform, terse human writing (e.g. technical
  spec documents) can also trigger the low-variance finding; use judgment
  before assuming every flagged document needs a rewrite.
