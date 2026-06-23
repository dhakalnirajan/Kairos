import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Kairos Code',
  tagline: 'Terminal-native AI coding agent. Local-first, extensible, secure.',
  favicon: 'img/logo.png',

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
    image: 'img/logo.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Kairos',
      logo: {
        alt: 'Kairos Code',
        src: 'img/logo.png',
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
            { label: 'Providers', to: '/docs/user-guide/providers' },
            { label: 'Telegram', to: '/docs/user-guide/telegram' },
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
      copyright: `© ${new Date().getFullYear()} Kairos Code. Built with Docusaurus. MIT License.`,
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
