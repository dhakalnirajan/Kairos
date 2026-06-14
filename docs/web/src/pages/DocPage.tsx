import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface DocPageProps {
  file?: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function generateId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[*_`]/g, '');
      items.push({
        id: generateId(text),
        text,
        level,
      });
    }
  }

  return items;
}

function Breadcrumbs({ fileName }: { fileName: string }) {
  const formatName = (name: string) =>
    name
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const parts = fileName.split('/');

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          <Link to="/" className="breadcrumb-link">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Docs
          </Link>
        </li>
        {parts.map((part, idx) => (
          <li key={idx} className="breadcrumb-item">
            <span className="breadcrumb-separator">/</span>
            {idx === parts.length - 1 ? (
              <span className="breadcrumb-current">{formatName(part)}</span>
            ) : (
              <Link to={`/${parts.slice(0, idx + 1).join('/')}`} className="breadcrumb-link">
                {formatName(part)}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className="toc" aria-label="Table of contents">
      <h4 className="toc-title">On this page</h4>
      <ul className="toc-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`toc-item toc-level-${item.level} ${item.id === activeId ? 'active' : ''}`}
          >
            <a href={`#${item.id}`} className="toc-link">
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const headingComponents = {
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const text = typeof children === 'string' ? children : '';
    const id = generateId(text);
    return <h2 id={id} {...props}>{children}</h2>;
  },
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const text = typeof children === 'string' ? children : '';
    const id = generateId(text);
    return <h3 id={id} {...props}>{children}</h3>;
  },
};

export function DocPage({ file: propFile }: DocPageProps) {
  const { doc } = useParams();
  const fileName = propFile ?? doc ?? 'index';
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    window.scrollTo(0, 0);

    fetch(`/docs/${fileName}.md`)
      .then((res) => {
        if (!res.ok) throw new Error('Document not found');
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [fileName]);

  const toc = useMemo(() => extractToc(content), [content]);

  if (loading) {
    return (
      <div className="doc-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="doc-error">
        <div className="error-icon">!</div>
        <h2>Document not found</h2>
        <p>{error}</p>
        <Link to="/" className="error-link">Back to docs</Link>
      </div>
    );
  }

  return (
    <div className="doc-layout">
      <div className="doc-sidebar">
        <Breadcrumbs fileName={fileName} />
      </div>

      <article className="doc-content prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={headingComponents}
        >
          {content}
        </ReactMarkdown>
      </article>

      <aside className="doc-toc-sidebar">
        <TableOfContents items={toc} />
      </aside>
    </div>
  );
}
