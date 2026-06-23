import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <img src="/Kairos/img/logo.png" alt="Kairos Code" className={styles.heroLogo} />
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            Get Started
          </Link>
          <Link
            className="button button--secondary button--outline button--lg"
            href="https://github.com/dhakalnirajan/Kairos"
            style={{marginLeft: '1rem'}}>
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    title: '19 LLM Providers',
    description: 'Run with llama.cpp, Ollama, OpenAI, Anthropic, Gemini, Groq, and more. Local or cloud — your choice.',
  },
  {
    title: '82 Built-in Tools',
    description: 'File operations, shell commands, web search, AST analysis, debugging, security scanning, and more.',
  },
  {
    title: '4-Layer Safety',
    description: 'Harm detection, risk classification, blueprint policy, and human-in-the-loop approval for every tool call.',
  },
  {
    title: 'Persistent Memory',
    description: 'SQLite-backed memory with FTS5 full-text search. Remembers context across sessions.',
  },
  {
    title: '27 Skills',
    description: 'TDD, code review, security, deployment, research, and more. Skills the agent creates and reuses.',
  },
  {
    title: 'Web Search Pipeline',
    description: 'Brave API, Exa MCP, Mimo API, DuckDuckGo. Search, fetch, and extract content in one call.',
  },
];

function Feature({title, description}: {title: string; description: string}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md padding-vert--lg">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {features.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Terminal-native AI coding agent. Local-first, extensible, secure.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
