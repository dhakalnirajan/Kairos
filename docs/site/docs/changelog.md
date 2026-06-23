---
title: Changelog
sidebar_position: 2
description: Version history and notable changes.
---

# Changelog

All notable changes to Kairos will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.1.1] - 2026-06-24

### Added
- **Web Search Tool** — 4-backend search: Mimo API (Xiaomi SSE streaming), Exa MCP (universal), Brave Search API, DuckDuckGo. Auto-fallback chain. Configurable via `webSearch` config section.
- **Web Fetch Tool** — HTML→Markdown conversion, format options (text/markdown/html), Cloudflare bot detection bypass, SSRF protection on redirects, 5MB response size limit, real browser User-Agent.
- **Skill Runner Tool** — Agent can list, search, info, and execute skills via `skill_runner` tool. 27 skills now accessible from the ReAct loop.
- **Skills in System Prompt** — Agent loop injects available skills into system prompt alongside tools.
- **Docusaurus Documentation Site** — Replaced custom Vite+React docs with Docusaurus 3.10. 19 migrated docs with proper sidebar navigation, dark mode, and GitHub Pages deployment.
- **CI/CD Workflows** — 3 GitHub Actions: CI (typecheck→test→build), Release (tag-triggered with tarball), Deploy Docs (Docusaurus build→GitHub Pages).
- **Progressive Skill Loading** — SkillRunner.loadSkills(dir) method added for loading from custom directories.
- **ToolContext.config** — Tools can now access full config via ctx.config.
- **web-search Skill** — Full search→fetch→summarize pipeline skill using Brave API with generic backend fallback.
- **27 Skills** — accessibility, api-design, code-analyzer, code-generation, code-review, content-humanizer, debug, deployment, design-md, design-to-code, documentation, git-workflow, i18n, migration, monitoring, obsidian-vault-architect, performance, plan, refactoring, sdlc, security, simplify, skill-creator, system-design, tdd, testing, web-search.

### Changed
- Version bumped to 0.1.1
- Safety pipeline documented as 4 layers (harm-detection, risk-classification, blueprint-policy, HITL) — matching actual code.
- Tool count corrected to 82 across all documentation.
- Test count corrected to ~214 across all documentation.
- Provider count corrected to 19 across all documentation.
- Slash command count corrected to ~111 across all documentation.
- .env.example expanded to include all 23 environment variables.
- Duplicate tool registrations removed (8 duplicates in TOOL_LOADERS array).
- Config schema expanded to support all 19 LLM providers.
- Config/index.ts expanded to handle all 19 providers in env vars and CLI flags.

### Fixed
- Version hardcoded as 0.1.0 in CLI/TUI — now reads from config.
- Config schema default version mismatch (was 0.1.1, now matches package.json 0.1.1).
- defaults.ts version mismatch (was 0.1.1, now matches).
- `/security` test timeout (was scanning entire workspace, now scans targeted path).
- Extensions test using wrong SKILL.md filename and directory structure.
- Config test version assertion mismatch.
- Internal link to LICENSE in intro.md (was broken relative link).
- Old docs/web/ Vite+React app removed (was crashing CI builds).

---

## [0.1.0] - 2025-01-15

### Added
- Initial release
- 16 built-in tools
- TUI interface
- Web interface
- Daemon mode
- 19 LLM providers
- 4-layer safety pipeline
- SQLite memory with FTS5
- Compose pipeline (8 stages)
- Agent personas
- Knowledge graph
- Session recording