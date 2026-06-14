import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { DocPage } from './pages/DocPage';

const docFiles = [
  'index',
  'getting-started',
  'installation',
  'configuration',
  'providers',
  'slash-commands',
  'cli-flags',
  'safety',
  'memory',
  'tools',
  'research',
  'protocols',
  'tui',
  'recipes',
  'skills',
  'api-reference',
  'contributing',
  'changelog',
];

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <Sidebar files={docFiles} />
        <main className="flex-1 p-8 overflow-auto">
          <Routes>
            <Route path="/" element={<DocPage file="index" />} />
            <Route path="/:doc" element={<DocPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
