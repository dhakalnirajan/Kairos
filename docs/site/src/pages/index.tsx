import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {
  Zap,
  Wrench,
  Shield,
  Brain,
  Package,
  MessageSquare,
  Globe,
  Search,
  Monitor,
  Rocket,
  Settings,
  Keyboard,
  Terminal,
  Database,
  Code,
} from 'lucide-react';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>
      <div className="container">
        <img src="/Kairos/img/logo.png" alt="Kairos Code" className={styles.heroLogo} />
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/intro">
            Get Started
          </Link>
          <Link className="button button--secondary button--outline button--lg" href="https://github.com/dhakalnirajan/Kairos">
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  { icon: Zap, title: '19 LLM Providers', description: 'Run with llama.cpp, Ollama, OpenAI, Anthropic, Gemini, Groq, and more.', link: '/docs/user-guide/providers' },
  { icon: Wrench, title: '82 Built-in Tools', description: 'File operations, shell commands, web search, AST analysis, debugging, and more.', link: '/docs/user-guide/tools' },
  { icon: Shield, title: '4-Layer Safety', description: 'Harm detection, risk classification, blueprint policy, and HITL for every tool call.', link: '/docs/user-guide/safety' },
  { icon: Brain, title: 'Persistent Memory', description: 'SQLite-backed memory with FTS5 full-text search across sessions.', link: '/docs/user-guide/memory' },
  { icon: Package, title: '27 Skills', description: 'TDD, code review, security, deployment, research, and more.', link: '/docs/user-guide/skills' },
  { icon: MessageSquare, title: 'Telegram Bot', description: 'Full-featured messaging with streaming, groups, webhook support.', link: '/docs/user-guide/telegram' },
  { icon: Globe, title: 'Web Interface', description: 'Browser-based chat with streaming responses and tool execution.', link: '/docs/user-guide/tui' },
  { icon: Search, title: 'Web Search', description: 'Brave API, Exa MCP, Mimo API, DuckDuckGo with auto-fallback.', link: '/docs/user-guide/tools' },
  { icon: Monitor, title: 'Terminal TUI', description: 'Split panes, streaming, command palette, and themes.', link: '/docs/user-guide/tui' },
];

function Feature({icon: Icon, title, description, link}: {icon: React.ComponentType<{size?: number; className?: string}>; title: string; description: string; link: string}) {
  return (
    <div className={clsx('col col--4')}>
      <Link to={link} className={styles.featureLink}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <Icon size={32} strokeWidth={1.5} />
          </div>
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
        </div>
      </Link>
    </div>
  );
}

const quickLinks = [
  { title: 'Quick Start', description: 'Install and run your first session', link: '/docs/getting-started', icon: Rocket },
  { title: 'Configuration', description: 'Config files, env vars, CLI flags', link: '/docs/user-guide/configuration', icon: Settings },
  { title: 'Telegram Setup', description: 'Connect Kairos to Telegram', link: '/docs/user-guide/telegram', icon: MessageSquare },
  { title: 'All Commands', description: '111+ slash commands', link: '/docs/user-guide/slash-commands', icon: Keyboard },
];

function QuickLink({title, description, link, icon: Icon}: {title: string; description: string; link: string; icon: React.ComponentType<{size?: number; className?: string}>}) {
  return (
    <div className={clsx('col col--3')}>
      <Link to={link} className={styles.quickLink}>
        <div className={styles.quickLinkCard}>
          <div className={styles.quickLinkIcon}>
            <Icon size={24} strokeWidth={1.5} />
          </div>
          <Heading as="h4">{title}</Heading>
          <p>{description}</p>
        </div>
      </Link>
    </div>
  );
}

const techStack = [
  { icon: Terminal, label: 'Bun Runtime' },
  { icon: Code, label: 'TypeScript' },
  { icon: Database, label: 'SQLite + FTS5' },
  { icon: Shield, label: '4-Layer Safety' },
];

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <Heading as="h2" className="text--center" style={{marginBottom: '2rem'}}>Features</Heading>
            <div className="row">
              {features.map((props, idx) => <Feature key={idx} {...props} />)}
            </div>
          </div>
        </section>
        <section className={styles.quickLinks}>
          <div className="container">
            <Heading as="h2" className="text--center" style={{marginBottom: '2rem'}}>Quick Links</Heading>
            <div className="row">
              {quickLinks.map((props, idx) => <QuickLink key={idx} {...props} />)}
            </div>
          </div>
        </section>
        <section className={styles.techStack}>
          <div className="container">
            <div className="row" style={{justifyContent: 'center'}}>
              {techStack.map((item, idx) => (
                <div key={idx} className={styles.techItem}>
                  <item.icon size={20} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
