import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DocPage from './pages/DocPage';

const docs = [
  { path: '/', file: 'index.md', title: 'Home' },
  { path: '/getting-started', file: 'getting-started.md', title: 'Getting Started' },
  { path: '/installation', file: 'installation.md', title: 'Installation' },
  { path: '/configuration', file: 'configuration.md', title: 'Configuration' },
  { path: '/providers', file: 'providers.md', title: 'Providers' },
  { path: '/cli-flags', file: 'cli-flags.md', title: 'CLI Flags' },
  { path: '/slash-commands', file: 'slash-commands.md', title: 'Slash Commands' },
  { path: '/safety', file: 'safety.md', title: 'Safety' },
  { path: '/memory', file: 'memory.md', title: 'Memory' },
  { path: '/tools', file: 'tools.md', title: 'Tools' },
  { path: '/research', file: 'research.md', title: 'Research' },
  { path: '/protocols', file: 'protocols.md', title: 'Protocols' },
  { path: '/tui', file: 'tui.md', title: 'TUI' },
  { path: '/recipes', file: 'recipes.md', title: 'Recipes' },
  { path: '/skills', file: 'skills.md', title: 'Skills' },
  { path: '/api-reference', file: 'api-reference.md', title: 'API Reference' },
  { path: '/contributing', file: 'contributing.md', title: 'Contributing' },
  { path: '/changelog', file: 'changelog.md', title: 'Changelog' },
];

function LayoutWrapper() {
  return <Layout docs={docs}><></></Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<LayoutWrapper />}>
        {docs.map((doc) => (
          <Route key={doc.path} path={doc.path} element={<DocPage file={doc.file} title={doc.title} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
