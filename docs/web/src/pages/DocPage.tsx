import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

interface DocPageProps {
  file: string;
  title: string;
}

export default function DocPage({ file, title }: DocPageProps) {
  const [content, setContent] = useState('');

  useEffect(() => {
    const loadContent = async () => {
      try {
        const response = await fetch(`/docs/${file}`);
        if (response.ok) {
          const text = await response.text();
          setContent(text);
        } else {
          setContent(`# ${title}\n\nDocumentation not found.`);
        }
      } catch {
        setContent(`# ${title}\n\nLoading documentation...`);
      }
    };

    loadContent();
  }, [file, title]);

  return (
    <article className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-lg border border-[#334155] my-4"
                >
                  {codeString}
                </SyntaxHighlighter>
              );
            }

            return (
              <code
                className="bg-[#1e293b] px-1.5 py-0.5 rounded text-[#22d3ee] text-sm"
                {...props}
              >
                {children}
              </code>
            );
          },
          h1: ({ children }) => (
            <h1 className="text-4xl font-bold mb-6 text-white">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-semibold mt-12 mb-4 pb-2 border-b border-[#334155] text-white">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold mt-8 mb-3 text-white">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 text-[#94a3b8] leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-4 space-y-1 text-[#94a3b8]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-4 space-y-1 text-[#94a3b8]">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-[#38bdf8] hover:text-[#22d3ee] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#38bdf8] pl-4 my-4 bg-[rgba(56,189,248,0.05)] rounded-r-lg">
              <p className="text-[#94a3b8] italic">{children}</p>
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#1e293b] border-b-2 border-[#334155]">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left px-4 py-3 text-white font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 border-b border-[#334155] text-[#94a3b8]">{children}</td>
          ),
          hr: () => <hr className="border-[#334155] my-8" />,
          strong: ({ children }) => (
            <strong className="text-white font-semibold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-[#94a3b8] italic">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
