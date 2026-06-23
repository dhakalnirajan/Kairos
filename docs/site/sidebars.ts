import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started', 'getting-started/installation'],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: [
        'user-guide/configuration',
        'user-guide/providers',
        'user-guide/cli-flags',
        'user-guide/slash-commands',
        'user-guide/safety',
        'user-guide/memory',
        'user-guide/tools',
        'user-guide/skills',
        'user-guide/tui',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/protocols',
        'reference/api',
        'reference/skills-catalog',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/recipes',
        'guides/research',
      ],
    },
    'contributing',
    'changelog',
  ],
};

export default sidebars;
