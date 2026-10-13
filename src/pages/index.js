import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const heroBg =
  require('@site/static/img/home/hero-meadow-20261013-111741-0.jpg').default;
const iconWrite =
  require('@site/static/img/home/icon-write-20261013-111820-0.jpg').default;
const iconBook =
  require('@site/static/img/home/icon-book-20261013-111819-0.jpg').default;
const iconGear =
  require('@site/static/img/home/icon-gear-20261013-112154-0.jpg').default;

/** 四叶草 SVG：四片心形叶子 + 一根叶柄，颜色跟随 currentColor */
function Clover({className}) {
  const leaf =
    'M0 0 C -15 -11, -21 -24, -12 -32 C -6 -37, 0 -32, 0 -25 ' +
    'C 0 -32, 6 -37, 12 -32 C 21 -24, 15 -11, 0 0 Z';
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g transform="translate(50 44)" fill="currentColor">
        {[45, 135, 225, 315].map((angle) => (
          <path key={angle} transform={`rotate(${angle})`} d={leaf} />
        ))}
      </g>
      <path
        d="M50 48 Q 57 70 45 92"
        stroke="currentColor"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Hero 区域漂浮的四叶草粒子（位置 / 大小 / 动画节奏均为固定编排） */
const FLOATING_CLOVERS = [
  {left: '7%', top: '20%', size: 42, delay: '0s', duration: '11s', opacity: 0.55},
  {left: '16%', top: '62%', size: 26, delay: '1.4s', duration: '9s', opacity: 0.4},
  {left: '27%', top: '12%', size: 20, delay: '3s', duration: '12s', opacity: 0.35},
  {left: '72%', top: '16%', size: 30, delay: '0.8s', duration: '10s', opacity: 0.5},
  {left: '84%', top: '52%', size: 48, delay: '2.2s', duration: '13s', opacity: 0.45},
  {left: '92%', top: '24%', size: 22, delay: '4s', duration: '9.5s', opacity: 0.35},
  {left: '62%', top: '68%', size: 18, delay: '2.8s', duration: '8.5s', opacity: 0.3},
  {left: '38%', top: '74%', size: 24, delay: '1s', duration: '10.5s', opacity: 0.35},
];

function Hero() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header
      className={styles.hero}
      style={{backgroundImage: `url(${heroBg})`}}>
      <div className={styles.heroShade} />
      {FLOATING_CLOVERS.map((c, i) => (
        <span
          key={i}
          className={styles.cloverFloat}
          style={{
            left: c.left,
            top: c.top,
            width: c.size,
            opacity: c.opacity,
            animationDelay: c.delay,
            animationDuration: c.duration,
          }}>
          <Clover className={styles.cloverSvg} />
        </span>
      ))}
      <div className={clsx('container', styles.heroContent)}>
        <span className={clsx(styles.badge, styles.fadeUp)} style={{animationDelay: '0.05s'}}>
          <Clover className={styles.badgeClover} />
          幸运四叶草 · 个人知识库
        </span>
        <Heading as="h1" className={clsx(styles.title, styles.fadeUp)} style={{animationDelay: '0.15s'}}>
          {siteConfig.title}
        </Heading>
        <p className={clsx(styles.subtitle, styles.fadeUp)} style={{animationDelay: '0.3s'}}>
          在清晨的草地上，种下每一份笔记
          <br />
          让知识像四叶草一样，悄悄生长、久久幸运
        </p>
        <div className={clsx(styles.buttons, styles.fadeUp)} style={{animationDelay: '0.45s'}}>
          <Link className={styles.btnPrimary} to="/docs/writing/create-a-document">
            开始阅读
            <span className={styles.btnArrow}>→</span>
          </Link>
          <Link className={styles.btnGhost} to="https://github.com/345jr/docs">
            GitHub
          </Link>
        </div>
      </div>
      {/* 草地波浪：衔接 Hero 与下方内容区 */}
      <svg
        className={styles.wave}
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        aria-hidden="true">
        <path
          className={styles.waveBack}
          d="M0 64 C 180 110 360 20 560 44 C 760 68 900 116 1100 92 C 1260 74 1360 40 1440 56 L1440 120 L0 120 Z"
        />
        <path
          className={styles.waveFront}
          d="M0 88 C 200 120 420 56 660 76 C 880 94 1080 122 1280 100 C 1360 92 1410 84 1440 88 L1440 120 L0 120 Z"
        />
      </svg>
    </header>
  );
}

const FEATURES = [
  {
    img: iconWrite,
    alt: '羽毛笔与笔记本上的四叶草',
    title: '写作即播种',
    text: 'Markdown 驱动，专注内容本身。写下的每一段文字，都是埋在草地里的种子。',
  },
  {
    img: iconBook,
    alt: '书本上生长的四叶草',
    title: '知识在生长',
    text: '结构化侧边栏与分类，把零散的笔记连成一片草地，沉淀为可检索的知识。',
  },
  {
    img: iconGear,
    alt: '四叶草形状的齿轮',
    title: '风格由你定',
    text: 'React 组件、自定义主题与字体随心搭配，让站点长成自己喜欢的样子。',
  },
];

function Features() {
  return (
    <section className={styles.features}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          这片草地上，藏着什么
        </Heading>
        <p className={styles.sectionSubtitle}>
          一株四叶草的幸运，刚好分给写作、沉淀与热爱
        </p>
        <div className={styles.cardGrid}>
          {FEATURES.map((f) => (
            <article key={f.title} className={styles.card}>
              <div className={styles.cardIconWrap}>
                <img src={f.img} alt={f.alt} className={styles.cardIcon} loading="lazy" />
              </div>
              <Heading as="h3" className={styles.cardTitle}>
                {f.title}
              </Heading>
              <p className={styles.cardText}>{f.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BottomCta() {
  return (
    <section className={styles.cta}>
      <Clover className={clsx(styles.ctaClover, styles.ctaCloverLeft)} />
      <Clover className={clsx(styles.ctaClover, styles.ctaCloverRight)} />
      <div className={clsx('container', styles.ctaInner)}>
        <Heading as="h2" className={styles.ctaTitle}>
          把每一份笔记，种成一片幸运
        </Heading>
        <p className={styles.ctaText}>现在开始，翻阅这片已经长出来的草地</p>
        <Link className={styles.ctaButton} to="/docs/writing/create-a-document">
          进入文档 →
        </Link>
      </div>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Lopop 的个人知识库：写作、沉淀与分享，让知识像四叶草一样生长。">
      <main className={styles.page}>
        <Hero />
        <Features />
        <BottomCta />
      </main>
    </Layout>
  );
}
