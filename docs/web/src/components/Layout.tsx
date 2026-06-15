import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface Doc {
  path: string;
  file: string;
  title: string;
}

export default function Layout({ docs, children }: { docs: Doc[]; children: React.ReactNode }) {
  const [search, setSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const filteredDocs = docs.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen bg-dark">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-dark-surface border-b border-dark-border z-50 flex items-center px-4">
        <button
          className="md:hidden mr-4 text-gray-400 hover:text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          ☰
        </button>
        <Link to="/" className="flex items-center gap-2">
          <span className="text-primary font-bold text-xl">KAIROS</span>
          <span className="text-gray-400 text-sm">Docs</span>
        </Link>
        <div className="ml-auto">
          <input
            type="text"
            placeholder="Search docs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-dark border border-dark-border rounded px-3 py-1 text-sm text-white w-64 focus:outline-none focus:border-primary"
          />
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar pt-4 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <nav className="px-4">
          {filteredDocs.map((doc) => (
            <Link
              key={doc.path}
              to={doc.path}
              className={`block py-2 px-3 rounded text-sm ${
                location.pathname === doc.path
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-border'
              }`}
            >
              {doc.title}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="content pt-20">
        {children}
      </main>
    </div>
  );
}
