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

/**
 * 全屏漂浮的四叶草粒子。
 *
 * 位置 / 大小 / 时长 / 透明度全部手写编排：铺满全屏但不排成网格，
 * 大小跨 14–34px、时长跨 8–13.5s、延迟打散到 5.6s，避免「同一批
 * 复制粘贴」的均匀感。密度按「氛围元素要么成气候要么没有」的
 * 原则拉到 28 颗，让边缘也留不下空白。
 */
const FLOATING_CLOVERS = [
  {left: '2%', top: '10%', size: 34, delay: '0s', duration: '11s', opacity: 0.34},
  {left: '8%', top: '30%', size: 18, delay: '5.2s', duration: '9.5s', opacity: 0.24},
  {left: '5%', top: '55%', size: 26, delay: '2.4s', duration: '12s', opacity: 0.28},
  {left: '3%', top: '80%', size: 20, delay: '4.1s', duration: '10s', opacity: 0.26},
  {left: '13%', top: '8%', size: 22, delay: '1.2s', duration: '13s', opacity: 0.26},
  {left: '15%', top: '45%', size: 16, delay: '3.3s', duration: '8.5s', opacity: 0.2},
  {left: '12%', top: '70%', size: 28, delay: '0.7s', duration: '11.5s', opacity: 0.3},
  {left: '19%', top: '20%', size: 15, delay: '4.8s', duration: '9s', opacity: 0.22},
  {left: '22%', top: '62%', size: 24, delay: '2.9s', duration: '12.5s', opacity: 0.27},
  {left: '27%', top: '5%', size: 20, delay: '1.7s', duration: '10.5s', opacity: 0.24},
  {left: '30%', top: '33%', size: 14, delay: '5.6s', duration: '8s', opacity: 0.2},
  {left: '33%', top: '88%', size: 22, delay: '0.4s', duration: '11s', opacity: 0.26},
  {left: '38%', top: '55%', size: 17, delay: '3.8s', duration: '13.5s', opacity: 0.22},
  {left: '44%', top: '12%', size: 26, delay: '2.1s', duration: '9.5s', opacity: 0.28},
  {left: '46%', top: '74%', size: 19, delay: '5s', duration: '12s', opacity: 0.24},
  {left: '52%', top: '40%', size: 15, delay: '1.4s', duration: '10s', opacity: 0.2},
  {left: '56%', top: '8%', size: 24, delay: '4.4s', duration: '11.5s', opacity: 0.27},
  {left: '60%', top: '84%', size: 30, delay: '0.9s', duration: '9s', opacity: 0.3},
  {left: '64%', top: '28%', size: 16, delay: '2.7s', duration: '12.5s', opacity: 0.21},
  {left: '68%', top: '58%', size: 22, delay: '5.3s', duration: '8.5s', opacity: 0.26},
  {left: '73%', top: '14%', size: 18, delay: '3.1s', duration: '13s', opacity: 0.23},
  {left: '76%', top: '44%', size: 25, delay: '1.9s', duration: '10.5s', opacity: 0.28},
  {left: '80%', top: '76%', size: 20, delay: '4.6s', duration: '11s', opacity: 0.25},
  {left: '85%', top: '22%', size: 32, delay: '0.6s', duration: '9.5s', opacity: 0.32},
  {left: '88%', top: '52%', size: 17, delay: '5.5s', duration: '12s', opacity: 0.22},
  {left: '92%', top: '34%', size: 21, delay: '2.3s', duration: '8s', opacity: 0.24},
  {left: '91%', top: '66%', size: 27, delay: '3.6s', duration: '13.5s', opacity: 0.3},
  {left: '93%', top: '12%', size: 15, delay: '4.9s', duration: '10s', opacity: 0.2},
];

/**
 * 闪光粒子：金色为主，掺约 1/3 淡奶油色（tone: 'pale'）制造冷暖层次。
 * 大小 9–16px、闪烁相位打散，密而不整齐。
 */
const SPARKLES: {left: string; top: string; size: number; delay: string; tone?: 'pale'}[] = [
  {left: '6%', top: '18%', size: 14, delay: '0s'},
  {left: '11%', top: '40%', size: 10, delay: '1.1s', tone: 'pale'},
  {left: '9%', top: '88%', size: 16, delay: '2.2s'},
  {left: '18%', top: '12%', size: 11, delay: '0.5s'},
  {left: '20%', top: '52%', size: 13, delay: '1.6s', tone: 'pale'},
  {left: '25%', top: '78%', size: 10, delay: '2.6s'},
  {left: '31%', top: '22%', size: 15, delay: '0.8s'},
  {left: '36%', top: '44%', size: 9, delay: '1.9s', tone: 'pale'},
  {left: '35%', top: '94%', size: 12, delay: '2.9s'},
  {left: '43%', top: '28%', size: 13, delay: '0.3s'},
  {left: '49%', top: '62%', size: 11, delay: '1.4s', tone: 'pale'},
  {left: '54%', top: '18%', size: 16, delay: '2.4s'},
  {left: '58%', top: '92%', size: 10, delay: '0.9s'},
  {left: '62%', top: '48%', size: 14, delay: '2s', tone: 'pale'},
  {left: '66%', top: '8%', size: 12, delay: '1.2s'},
  {left: '71%', top: '70%', size: 9, delay: '2.7s'},
  {left: '78%', top: '30%', size: 15, delay: '0.4s'},
  {left: '82%', top: '90%', size: 11, delay: '1.7s', tone: 'pale'},
  {left: '86%', top: '58%', size: 13, delay: '2.8s'},
  {left: '90%', top: '8%', size: 10, delay: '1s'},
  {left: '94%', top: '44%', size: 16, delay: '2.3s', tone: 'pale'},
  {left: '95%', top: '80%', size: 12, delay: '0.6s'},
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
          className={clsx(styles.sparkle, s.tone === 'pale' && styles.sparklePale)}
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
