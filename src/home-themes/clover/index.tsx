/**
 * 首页主题「幸运四叶草」（默认主题）：清晨草地背景 + 漂浮四叶草粒子
 * + 扇形特性便签 + 幸运小龙吉祥物。素材与样式全部内聚在本目录，
 * 登记见 ../registry.ts。
 */
import React from 'react';
import clsx from 'clsx';

import heroBg from '../../../static/img/home/hero-meadow-20261013-111741-0.jpg';
import heroWordmark from '../../../static/img/home/hero-wordmark.png';
import mascotLucky from '../../../static/img/home/mascot-lucky-20261013-114830-0.jpg';
import postcardClover from '../../../static/img/home/postcard-clover-20261014-110822-0.jpg';
import postcardCoin from '../../../static/img/home/postcard-coin-20261014-111104-0.jpg';
import postcardCollage from '../../../static/img/home/postcard-collage-20261014-111132-0.jpg';

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

/**
 * 左栏三张明信片：幸运元素 × 三种艺术风格，由 Seedream 生成
 * variant 对应 styles.module.css 里的纸色 / 错落角度
 */
const POSTCARDS = [
  {
    img: postcardClover,
    alt: '水彩画：一株挂着露珠的四叶草从泥土中生长出来，旁边散落一颗种子',
    variant: 'pcClover',
    stamp: 'clover',
    caption: '写作即播种',
  },
  {
    img: postcardCoin,
    alt: '复古铜版雕刻画：一摞金币像小塔一样堆叠，顶端长出绿色嫩芽',
    variant: 'pcCoin',
    stamp: 'sparkle',
    caption: '知识在生长',
  },
  {
    img: postcardCollage,
    alt: '剪纸拼贴画：粉金色马蹄铁、黄色幸运星、彩虹与白云自由拼贴',
    variant: 'pcCollage',
    stamp: 'clover',
    caption: '风格由你定',
  },
];

/** 右栏明信片：奶白纸框 + 齿孔邮票 + 邮戳，静置无动效，像随手搁在草地上的一封信 */
function MascotPostcard(): React.ReactNode {
  return (
    <figure className={styles.postcard}>
      <span className={styles.stamp} aria-hidden="true">
        <Clover className={styles.stampClover} />
      </span>
      <span className={styles.postmark} aria-hidden="true">
        <span className={styles.postmarkText}>
          LUCKY
          <br />
          POST
        </span>
      </span>
      <img
        src={mascotLucky}
        alt="顶着幸运四叶草的小恐龙，周围漂浮着星星、彩虹与马蹄铁"
        className={styles.postcardImg}
      />
      <figcaption className={styles.postcardCaption}>
        幸运小龙 · 守护你的每一页笔记
      </figcaption>
    </figure>
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
        {/* 左栏：三张风格各异的明信片，像随手摊在草地上的收藏 */}
        <section className={styles.intro}>
          <div className={clsx(styles.fan, styles.fadeUp)} style={{animationDelay: '0.2s'}}>
            {POSTCARDS.map((p) => (
              <figure
                key={p.caption}
                className={clsx(styles.miniPostcard, styles[p.variant])}>
                <span className={styles.miniStamp} aria-hidden="true">
                  {p.stamp === 'clover' ? (
                    <Clover className={styles.miniStampIcon} />
                  ) : (
                    <Sparkle className={styles.miniStampIcon} />
                  )}
                </span>
                <img src={p.img} alt={p.alt} className={styles.miniImg} loading="lazy" />
                <figcaption className={styles.miniCaption}>{p.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* 右栏：幸运小龙明信片 */}
        <section className={clsx(styles.mascotPane, styles.fadeUp)} style={{animationDelay: '0.3s'}}>
          <MascotPostcard />
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
