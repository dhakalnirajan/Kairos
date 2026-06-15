import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

interface Doc {
  path: string;
  title: string;
}

interface LayoutProps {
  docs: Doc[];
  children: React.ReactNode;
}

const docSections = [
  {
    title: 'Getting Started',
    items: [
      { path: '/', title: 'Home' },
      { path: '/getting-started', title: 'Getting Started' },
      { path: '/installation', title: 'Installation' },
      { path: '/configuration', title: 'Configuration' },
    ],
  },
  {
    title: 'Core Concepts',
    items: [
      { path: '/providers', title: 'Providers' },
      { path: '/tools', title: 'Tools' },
      { path: '/memory', title: 'Memory' },
      { path: '/safety', title: 'Safety' },
    ],
  },
  {
    title: 'Usage',
    items: [
      { path: '/cli-flags', title: 'CLI Flags' },
      { path: '/slash-commands', title: 'Slash Commands' },
      { path: '/tui', title: 'TUI Interface' },
      { path: '/recipes', title: 'Recipes' },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { path: '/protocols', title: 'Protocols' },
      { path: '/research', title: 'Research' },
      { path: '/skills', title: 'Skills' },
      { path: '/api-reference', title: 'API Reference' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { path: '/contributing', title: 'Contributing' },
      { path: '/changelog', title: 'Changelog' },
    ],
  },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[rgba(15,23,42,0.95)] backdrop-blur-xl border-b border-[#334155] z-50 flex items-center px-6">
        <button
          className="lg:hidden mr-4 text-gray-400 hover:text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>

        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#38bdf8] to-[#22d3ee] flex items-center justify-center">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <span className="text-white font-bold text-lg">Kairos Code</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6 ml-8">
          <a href="https://github.com/dhakalnirajan/Kairos" target="_blank" rel="noopener noreferrer" className="text-[#94a3b8] hover:text-[#38bdf8] text-sm transition-colors">
            GitHub
          </a>
          <a href="/changelog" className="text-[#94a3b8] hover:text-[#38bdf8] text-sm transition-colors">
            Changelog
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-10 pr-4 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-sm text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-[#64748b] bg-[#0f172a] border border-[#334155] rounded">
              ⌘K
            </kbd>
          </div>
        </div>
      </header>

      <div className="flex mt-16">
        {/* Sidebar */}
        <aside className={`w-64 bg-[#1e293b] border-r border-[#334155] fixed top-16 bottom-0 left-0 overflow-y-auto py-6 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} transition-transform`}>
          <nav className="space-y-6">
            {docSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] px-6 mb-2">
                  {section.title}
                </h3>
                <div>
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-6 py-2 text-sm transition-all border-l-2 ${
                        isActive(item.path)
                          ? 'text-[#38bdf8] bg-[rgba(56,189,248,0.1)] border-[#38bdf8]'
                          : 'text-[#94a3b8] border-transparent hover:text-white hover:bg-[rgba(56,189,248,0.05)]'
                      }`}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64">
          <article className="max-w-[900px] px-12 py-12">
            {children}
          </article>
        </main>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
