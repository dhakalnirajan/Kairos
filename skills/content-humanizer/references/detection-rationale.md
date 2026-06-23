# Detection Rationale

## Why Detection-Only, Not Rewriting

A phrase-matching scanner can reliably notice that "Moreover," opens a
sentence. It cannot reliably know whether the surrounding voice calls for
a blunt restart, a softer connective, or no transition at all — that
requires understanding intent, audience, and the rest of the document's
established voice, none of which this tool has access to. Reporting
findings with line numbers keeps the actual rewrite a deliberate human (or
careful, context-aware agent) decision.

## Stock Openers and Hype Phrases

Matched via substring search (case-insensitive) against
`tell-phrases.json`. This list is small and curated, not exhaustive — it
targets phrases that show up disproportionately often in unedited
LLM-generated text relative to typical human writing, not every possible
cliché.

## Transition Density

Counts sentences starting with a flagged transition word
(`Moreover`, `Furthermore`, etc.) as a fraction of total sentences.
Occasional use (one or two in a long document) is normal; LLM-generated
text often shows a noticeably higher rate. Default threshold: 8% of
sentences. This is a document-level statistic, not tied to specific
lines, since the *pattern* across the whole document is the signal, not
any single instance.

## Sentence Length Variance

Computes the standard deviation of sentence length (in words) across the
document. Human writing — even careful, formal human writing — tends to
vary sentence length more than unedited LLM output, which often produces
sentences clustering tightly around a similar length. Default threshold:
flag if standard deviation is below 15 words, computed only when the
document has at least 5 sentences (too few sentences make variance
unreliable).

**Caveat:** deliberately terse, uniform writing (technical specs, legal
boilerplate, some documentation styles) can trigger this finding
legitimately without being AI-generated. Use judgment, especially for
domains where short, uniform sentences are a stylistic choice rather than
a generation artifact.
