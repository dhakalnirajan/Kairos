# Research

Kairos is built on research in AI coding assistants and agentic systems.

## Key Concepts

### ReAct Pattern
- Thought → Action → Observation loop
- Tool dispatch based on LLM reasoning
- Iterative refinement through feedback

### Memory Systems
- SQLite with FTS5 for full-text search
- BM25 ranking for relevance
- Sliding window for conversation history
- Persistent storage across sessions

### Safety Architecture
- 6-layer defense-in-depth pipeline
- Input sanitization at entry point
- Harm detection via pattern matching
- Path confinement to workspace
- Network security against SSRF
- HITL approval for risky operations
- Audit logging for accountability

### Provider Abstraction
- Unified interface across 19 providers
- Auto-discovery for local models
- Fallback chain on failure
- Streaming unification

## References

- ReAct: Synergizing Reasoning and Acting in Language Models
- Toolformer: Language Models Can Teach Themselves to Use Tools
- Constitutional AI: Harmlessness from AI Feedback
- Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks
