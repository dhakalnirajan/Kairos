import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search } from './Search';

interface SidebarProps {
  files: string[];
}

interface DocSection {
  name: string;
  files: string[];
}

const sectionMap: Record<string, string[]> = {
  'Getting Started': ['index', 'getting-started', 'installation'],
  'Configuration': ['configuration', 'providers', 'cli-flags'],
  'Features': ['slash-commands', 'tools', 'memory', 'safety'],
  'Advanced': ['research', 'protocols', 'tui', 'skills'],
  'Meta': ['recipes', 'api-reference', 'contributing', 'changelog'],
};

function groupFilesIntoSections(files: string[]): DocSection[] {
  const sections: DocSection[] = [];
  const grouped = new Set<string>();

  for (const [name, sectionFiles] of Object.entries(sectionMap)) {
    const matching = sectionFiles.filter(f => files.includes(f));
    if (matching.length > 0) {
      sections.push({ name, files: matching });
      matching.forEach(f => grouped.add(f));
    }
  }

  const remaining = files.filter(f => !grouped.has(f));
  if (remaining.length > 0) {
    sections.push({ name: 'Other', files: remaining });
  }

  return sections;
}

export function Sidebar({ files }: SidebarProps) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const all = new Set(Object.keys(sectionMap));
    const currentFile = location.pathname.replace('/', '') || 'index';
    for (const [name, sectionFiles] of Object.entries(sectionMap)) {
      if (sectionFiles.includes(currentFile)) {
        all.add(name);
      }
    }
    return all;
  });
  const [searchOpen, setSearchOpen] = useState(false);

  const sections = useMemo(() => groupFilesIntoSections(files), [files]);

  const toggleSection = (name: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const formatName = (file: string) => {
    return file
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const currentFile = location.pathname.replace('/', '') || 'index';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="block">
          <h1 className="text-xl font-bold text-primary">Kairos Code</h1>
          <p className="text-xs text-muted">Documentation</p>
        </Link>
      </div>

      <button
        onClick={() => setSearchOpen(!searchOpen)}
        className="sidebar-search-toggle"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search docs...</span>
        <kbd className="kbd">/</kbd>
      </button>

      {searchOpen && (
        <div className="px-3 pb-3">
          <Search onClose={() => setSearchOpen(false)} />
        </div>
      )}

      <nav className="sidebar-nav">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.name);
          const hasActiveChild = section.files.includes(currentFile);

          return (
            <div key={section.name} className="sidebar-section">
              <button
                onClick={() => toggleSection(section.name)}
                className={`sidebar-section-header ${hasActiveChild ? 'active-parent' : ''}`}
              >
                <span className="sidebar-section-chevron">
                  <svg
                    className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
                <span>{section.name}</span>
                <span className="sidebar-section-count">{section.files.length}</span>
              </button>

              {isExpanded && (
                <div className="sidebar-section-files">
                  {section.files.map((file) => {
                    const path = file === 'index' ? '/' : `/${file}`;
                    const isActive = file === currentFile;

                    return (
                      <Link
                        key={file}
                        to={path}
                        className={`sidebar-link ${isActive ? 'active' : ''}`}
                      >
                        <span className="sidebar-link-indicator" />
                        {formatName(file)}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
