import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface SearchProps {
  onClose: () => void;
}

interface SearchResult {
  file: string;
  title: string;
  excerpt: string;
  score: number;
  matches: Array<{ field: string; indices: [number, number][] }>;
}

const DOC_FILES = [
  'index', 'getting-started', 'installation', 'configuration', 'providers',
  'slash-commands', 'cli-flags', 'safety', 'memory', 'tools', 'research',
  'protocols', 'tui', 'recipes', 'skills', 'api-reference', 'contributing', 'changelog',
];

function formatName(file: string): string {
  return file
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function fuzzyMatch(text: string, query: string): { score: number; indices: [number, number][] } | null {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryLen = lowerQuery.length;
  const textLen = lowerText.length;

  if (queryLen === 0) return { score: 1, indices: [] };
  if (queryLen > textLen) return null;

  // Exact substring match gets highest score
  const exactIdx = lowerText.indexOf(lowerQuery);
  if (exactIdx !== -1) {
    return {
      score: 100,
      indices: [[exactIdx, exactIdx + queryLen - 1]],
    };
  }

  // Fuzzy character-by-character match
  let queryIdx = 0;
  let score = 0;
  const indices: [number, number][] = [];
  let lastMatchIdx = -1;
  let consecutiveBonus = 0;

  for (let i = 0; i < textLen && queryIdx < queryLen; i++) {
    if (lowerText[i] === lowerQuery[queryIdx]) {
      score += 10;
      if (lastMatchIdx === i - 1) {
        consecutiveBonus += 5;
        score += consecutiveBonus;
      } else {
        consecutiveBonus = 0;
      }
      if (indices.length > 0 && indices[indices.length - 1][1] === i - 1) {
        indices[indices.length - 1][1] = i;
      } else {
        indices.push([i, i]);
      }
      lastMatchIdx = i;
      queryIdx++;
    }
  }

  if (queryIdx !== queryLen) return null;

  // Penalize long gaps
  const gapPenalty = (textLen - queryLen) * 0.5;
  score = Math.max(1, score - gapPenalty);

  // Bonus for matching at word boundaries
  for (const [start] of indices) {
    if (start === 0 || text[start - 1] === ' ' || text[start - 1] === '-' || text[start - 1] === '_') {
      score += 15;
    }
  }

  return { score, indices };
}

function highlightText(text: string, indices: [number, number][]): React.ReactNode {
  if (indices.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;

  for (const [start, end] of indices) {
    if (start > lastIdx) {
      parts.push(text.slice(lastIdx, start));
    }
    parts.push(
      <mark key={start} className="search-highlight">
        {text.slice(start, end + 1)}
      </mark>
    );
    lastIdx = end + 1;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}

export function Search({ onClose }: SearchProps) {
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    async function loadDocs() {
      const loaded: Record<string, string> = {};
      await Promise.all(
        DOC_FILES.map(async (file) => {
          try {
            const res = await fetch(`/docs/${file}.md`);
            if (res.ok) {
              loaded[file] = await res.text();
            }
          } catch {
            // Skip failed loads
          }
        })
      );
      setDocs(loaded);
      setLoading(false);
    }
    loadDocs();
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const q = query.trim();
    const searchResults: SearchResult[] = [];

    for (const [file, content] of Object.entries(docs)) {
      const title = formatName(file);
      const titleMatch = fuzzyMatch(title, q);
      const contentMatch = fuzzyMatch(content.slice(0, 5000), q);

      if (titleMatch || contentMatch) {
        const titleScore = titleMatch?.score ?? 0;
        const contentScore = contentMatch?.score ?? 0;
        const totalScore = titleScore * 2 + contentScore;

        let excerpt = '';
        const matches: SearchResult['matches'] = [];

        if (contentMatch && contentMatch.indices.length > 0) {
          const firstIdx = contentMatch.indices[0][0];
          const start = Math.max(0, firstIdx - 40);
          const end = Math.min(content.length, firstIdx + 120);
          excerpt = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
          matches.push({ field: 'content', indices: contentMatch.indices.map(([s, e]) => [s - start + (start > 0 ? 3 : 0), e - start + (start > 0 ? 3 : 0)]) });
        }

        searchResults.push({ file, title, excerpt, score: totalScore, matches });
      }
    }

    return searchResults.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [query, docs]);

  const handleSelect = useCallback((file: string) => {
    navigate(file === 'index' ? '/' : `/${file}`);
    onClose();
  }, [navigate, onClose]);

  return (
    <div className="search-container">
      <div className="search-input-wrapper">
        <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documentation..."
          className="search-input"
        />
        <kbd className="kbd text-xs" onClick={onClose}>ESC</kbd>
      </div>

      {loading && (
        <div className="search-loading">Loading documents...</div>
      )}

      {!loading && query && results.length === 0 && (
        <div className="search-empty">
          No results for &quot;{query}&quot;
        </div>
      )}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((result) => (
            <button
              key={result.file}
              onClick={() => handleSelect(result.file)}
              className="search-result"
            >
              <div className="search-result-title">{result.title}</div>
              {result.excerpt && (
                <div className="search-result-excerpt">
                  {highlightText(result.excerpt, result.matches.find(m => m.field === 'content')?.indices ?? [])}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
