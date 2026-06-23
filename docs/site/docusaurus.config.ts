import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Kairos Code',
  tagline: 'Terminal-native AI coding agent. Bun runtime, Blessed TUI, SQLite memory, multi-provider LLM.',
  favicon: 'img/favicon.ico',

  future: {
    v4: false,
  },

  url: 'https://dhakalnirajan.github.io',
  baseUrl: '/Kairos/',

  organizationName: 'dhakalnirajan',
  projectName: 'Kairos',

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/dhakalnirajan/Kairos/tree/main/docs/site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/kairos-social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Kairos Code',
      logo: {
        alt: 'Kairos Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/dhakalnirajan/Kairos',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/docs/intro' },
            { label: 'Configuration', to: '/docs/user-guide/configuration' },
            { label: 'Tools', to: '/docs/user-guide/tools' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/dhakalnirajan/Kairos' },
            { label: 'Issues', href: 'https://github.com/dhakalnirajan/Kairos/issues' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Changelog', to: '/docs/changelog' },
            { label: 'Contributing', to: '/docs/contributing' },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Kairos Code. MIT License.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'typescript'],
    },
    docs: {
      sidebar: {
        hideable: false,
        autoCollapseCategories: true,
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
