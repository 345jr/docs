/**
 * 首页主题「幸运四叶草」（默认主题）：清晨草地背景 + 漂浮四叶草粒子
 * + 扇形特性便签 + 幸运小龙吉祥物。素材与样式全部内聚在本目录，
 * 登记见 ../registry.ts。
 */
import React, {useRef} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';

import heroBg from '../../../static/img/home/hero-meadow-20261013-111741-0.jpg';
import heroWordmark from '../../../static/img/home/hero-wordmark.png';
import mascotLucky from '../../../static/img/home/mascot-lucky-20261013-114830-0.jpg';
import iconWrite from '../../../static/img/home/icon-write-20261013-111820-0.jpg';
import iconBook from '../../../static/img/home/icon-book-20261013-111819-0.jpg';
import iconGear from '../../../static/img/home/icon-gear-20261013-112154-0.jpg';

import styles from './styles.module.css';

/** 四叶草 SVG：四片心形叶子 + 一根叶柄，颜色跟随 currentColor */
function Clover({className}: {className?: string}): React.ReactNode {
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

/** 四芒星 SVG：幸运闪光 */
function Sparkle({className}: {className?: string}): React.ReactNode {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 1.5 L14.2 9.8 L22.5 12 L14.2 14.2 L12 22.5 L9.8 14.2 L1.5 12 L9.8 9.8 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 全屏漂浮的四叶草粒子（位置 / 大小 / 动画节奏均为固定编排） */
const FLOATING_CLOVERS = [
  {left: '3%', top: '14%', size: 40, delay: '0s', duration: '11s', opacity: 0.4},
  {left: '11%', top: '72%', size: 26, delay: '1.4s', duration: '9s', opacity: 0.32},
  {left: '24%', top: '6%', size: 20, delay: '3s', duration: '12s', opacity: 0.28},
  {left: '55%', top: '10%', size: 24, delay: '0.8s', duration: '10s', opacity: 0.3},
  {left: '48%', top: '82%', size: 30, delay: '2.2s', duration: '13s', opacity: 0.3},
  {left: '94%', top: '70%', size: 34, delay: '4s', duration: '9.5s', opacity: 0.32},
];

/** 金色闪光粒子 */
const SPARKLES = [
  {left: '34%', top: '16%', size: 16, delay: '0s'},
  {left: '58%', top: '62%', size: 12, delay: '0.9s'},
  {left: '87%', top: '12%', size: 18, delay: '1.7s'},
  {left: '70%', top: '40%', size: 11, delay: '2.5s'},
];

const FEATURES = [
  {
    img: iconWrite,
    alt: '羽毛笔与笔记本上的四叶草',
    accent: '#3fae5a',
    title: '写作即播种',
    text: 'Markdown 轻装上阵，写下的每段文字，都是埋进土里的种子。',
  },
  {
    img: iconBook,
    alt: '书本上生长的四叶草',
    accent: '#e0a92e',
    title: '知识在生长',
    text: '结构化目录把零散笔记连成草地，沉淀为可检索的知识。',
  },
  {
    img: iconGear,
    alt: '四叶草形状的齿轮',
    accent: '#e06a9a',
    title: '风格由你定',
    text: '组件、主题与字体随心搭配，站点长成你喜欢的样子。',
  },
];

/** 吉祥物卡片：鼠标视差倾斜（外圈负责漂浮动画，内圈负责倾斜，互不干扰） */
function MascotCard(): React.ReactNode {
  const tiltRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) {
      return;
    }
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform =
      `perspective(1000px) rotateY(${(x * 9).toFixed(2)}deg) ` +
      `rotateX(${(-y * 9).toFixed(2)}deg)`;
  };

  const handleLeave = () => {
    const el = tiltRef.current;
    if (el) {
      el.style.transform = 'perspective(1000px)';
    }
  };

  return (
    <div className={styles.mascotFloat}>
      <div
        ref={tiltRef}
        className={styles.mascotCard}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}>
        <img
          src={mascotLucky}
          alt="顶着幸运四叶草的小恐龙，周围漂浮着星星、彩虹与马蹄铁"
          className={styles.mascotImg}
        />
        <span className={styles.mascotChip}>
          <Clover className={styles.mascotChipClover} />
          幸运小龙 · 今日也在守护你的笔记
        </span>
      </div>
    </div>
  );
}

export default function CloverHome(): React.ReactNode {
  return (
    <main className={styles.page} style={{backgroundImage: `url(${heroBg})`}}>
      <div className={styles.veil} />
      {FLOATING_CLOVERS.map((c, i) => (
        <span
          key={`c${i}`}
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
      {SPARKLES.map((s, i) => (
        <span
          key={`s${i}`}
          className={styles.sparkle}
          style={{left: s.left, top: s.top, width: s.size, animationDelay: s.delay}}>
          <Sparkle className={styles.cloverSvg} />
        </span>
      ))}

      <div className={styles.wordmarkWrap}>
        <img
          src={heroWordmark}
          alt="Lopop Docs 幸运四叶草 · 个人知识库"
          className={clsx(styles.wordmark, styles.fadeUp)}
          style={{animationDelay: '0.05s'}}
        />
      </div>

      <div className={styles.stage}>
        {/* 左栏：文案 + 扇形特性卡片 */}
        <section className={styles.intro}>
          <p className={clsx(styles.subtitle, styles.fadeUp)} style={{animationDelay: '0.15s'}}>
            在清晨的草地上，种下每一份笔记，
            <br />
            让知识像四叶草一样，悄悄生长、久久幸运。
          </p>
          <div className={clsx(styles.buttons, styles.fadeUp)} style={{animationDelay: '0.25s'}}>
            <Link className={styles.btnPrimary} to="/docs/writing/create-a-document">
              开始阅读
              <span className={styles.btnArrow}>→</span>
            </Link>
          </div>

          {/* 扇形排布的三张便签卡：错落旋转，悬停回正浮起 */}
          <div className={clsx(styles.fan, styles.fadeUp)} style={{animationDelay: '0.4s'}}>
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className={styles.fanCard}
                style={{'--accent': f.accent} as React.CSSProperties}>
                <div className={styles.fanIconWrap}>
                  <img src={f.img} alt={f.alt} className={styles.fanIcon} loading="lazy" />
                </div>
                <Heading as="h3" className={styles.fanTitle}>
                  {f.title}
                </Heading>
                <p className={styles.fanText}>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 右栏：幸运小龙吉祥物 */}
        <section className={clsx(styles.mascotPane, styles.fadeUp)} style={{animationDelay: '0.3s'}}>
          <MascotCard />
        </section>
      </div>

      {/* 底部雾中草浪 */}
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
    </main>
  );
}
