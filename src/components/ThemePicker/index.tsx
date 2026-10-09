import React, {useEffect, useMemo, useState} from 'react';
import {Dialog} from '@base-ui/react/dialog';
import styles from './styles.module.css';

/**
 * 顶部导航栏主题色选择器。
 *
 * 主题色即 Infima 的 --ifm-color-primary 及其 6 个明暗梯度（dark/darker/
 * darkest/light/lighter/lightest），全站的链接、按钮、tabs、admonition
 * 边框等都引用它们。
 *
 * 实现方式与 FontPicker 的按需注入 <link> 一致：默认色仍在 custom.css 里，
 * 只有用户选中主题后才往 <head> 注入一段 <style>（分别覆盖亮 / 暗两套梯度，
 * 且排在 custom.css 之后所以优先级更高）；重置即移除 <style> 节点。
 * 不改 custom.css，构建产物保持零成本——没选过主题的访客不多下载一个字节。
 *
 * 选择结果存 localStorage，SSR 初始渲染始终是站点默认色，
 * 在 useEffect 中恢复用户选择，避免 hydration mismatch。
 */

const STORAGE_KEY = 'docs-site-theme';
const STYLE_ID = 'site-theme-color';

type ShadeKey = 'dark' | 'darker' | 'darkest' | 'light' | 'lighter' | 'lightest';

/** Infima 生成梯度的亮度偏移（见 Infima 源码 shadeColor） */
const RAMP: [ShadeKey, number][] = [
  ['dark', -0.1],
  ['darker', -0.15],
  ['darkest', -0.2],
  ['light', 0.1],
  ['lighter', 0.15],
  ['lightest', 0.2],
];

type Ramp = {
  base: string;
  dark: string;
  darker: string;
  darkest: string;
  light: string;
  lighter: string;
  lightest: string;
} & Partial<Record<ShadeKey, string>>;

type ThemeChoice = {
  name: string;
  /** 亮色模式主色 */
  light: string;
  /** 暗色模式主色；缺省时由亮色提亮推导 */
  dark?: string;
};

/** 预设配色（亮 / 暗成对挑选，暗色统一用同色相的高亮度档） */
const PRESETS: ThemeChoice[] = [
  {name: '松绿 · 默认', light: '#2e8555', dark: '#25c2a0'},
  {name: '靛蓝', light: '#4263eb', dark: '#5c7cfa'},
  {name: '晴空', light: '#1c7ed6', dark: '#339af0'},
  {name: '青碧', light: '#0ca678', dark: '#38d9a9'},
  {name: '绛紫', light: '#6741d9', dark: '#9775fa'},
  {name: '洋红', light: '#9c36b5', dark: '#da77f2'},
  {name: '落日橙', light: '#f76707', dark: '#ffa94d'},
  {name: '绯红', light: '#f03e3e', dark: '#ff8787'},
  {name: '樱粉', light: '#f06595', dark: '#faa2c1'},
];

function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) {
    return [0, 0, 0.5];
  }
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const f = (p: number) => {
    const k = (p + hue / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** 按 Infima 的规则从基色生成完整梯度 */
function buildRamp(base: string): Ramp {
  const [h, s, l] = hexToHsl(base);
  const ramp = {base} as Ramp;  // RAMP 逐个填入，运行时完整
  for (const [key, delta] of RAMP) {
    ramp[key] = hslToHex(h, s, Math.min(1, Math.max(0, l + delta)));
  }
  return ramp;
}

/**
 * 暗色模式基色：亮色主色通常饱和度偏高、亮度偏低，直接用到暗色背景下
 * 对比度过高，Infima 的做法是同色相提亮一档，这里统一把亮度拉到 55% 以上。
 */
function darkBaseOf(light: string): string {
  const [h, s, l] = hexToHsl(light);
  return hslToHex(h, s, Math.max(l, 0.55));
}

/** 生成注入的 CSS 文本：亮 / 暗两套完整梯度 */
function themeCss(choice: ThemeChoice): string {
  const light = buildRamp(choice.light);
  const dark = buildRamp(choice.dark ?? darkBaseOf(choice.light));
  const block = (ramp: Ramp) =>
    [
      `--ifm-color-primary: ${ramp.base};`,
      ...RAMP.map(([key]) => `--ifm-color-primary-${key}: ${ramp[key]};`),
    ].join(' ');
  return `:root{${block(light)}}[data-theme='dark']{${block(dark)}}`;
}

function readStored(): ThemeChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ThemeChoice>;
    if (typeof parsed.light !== 'string' || !/^#[0-9a-f]{6}$/i.test(parsed.light)) {
      return null;
    }
    const dark =
      typeof parsed.dark === 'string' && /^#[0-9a-f]{6}$/i.test(parsed.dark)
        ? parsed.dark
        : undefined;
    return {name: parsed.name ?? '自定义', light: parsed.light, dark};
  } catch {
    return null;
  }
}

export default function ThemePicker(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  const [customHex, setCustomHex] = useState('#4263eb');
  // 「跟随系统」下暗色模式的实际生效色，用于预览与回显
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setChoice(readStored());
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemDark(document.documentElement.dataset.theme === 'dark');
    sync();
    // colorMode.respectPrefersColorScheme 开着，暗色切换可能由系统偏好驱动
    query.addEventListener('change', sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    return () => {
      query.removeEventListener('change', sync);
      observer.disconnect();
    };
  }, []);

  const apply = (next: ThemeChoice | null) => {
    setChoice(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        document.head.appendChild(style);
      }
      style.textContent = themeCss(next);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      document.getElementById(STYLE_ID)?.remove();
    }
  };

  const activeDark = useMemo(
    () => choice?.dark ?? (choice ? darkBaseOf(choice.light) : null),
    [choice],
  );

  const handleCustom = () => {
    apply({name: '自定义', light: customHex});
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={styles.trigger}
        aria-label="配置主题色"
        title="配置主题色">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="7.5" cy="8.5" r="3.2" fill="#f03e3e" />
          <circle cx="15" cy="6.5" r="3.2" fill="#f59f00" />
          <circle cx="19" cy="13.5" r="3.2" fill="#37b24d" />
          <circle cx="13.5" cy="17.5" r="3.2" fill="#4263eb" />
          <path
            d="M12 21.5c-5.2 0-9.5-4.2-9.5-9.5S6.8 2.5 12 2.5 21.5 6.8 21.5 12c0 1.9-1.2 3-3 3h-2.2c-1.1 0-1.9.9-1.9 2 0 .6.2 1 .5 1.5.3.4.5.9.5 1.4 0 .9-.8 1.6-2.4 1.6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup}>
          <Dialog.Title className={styles.title}>主题色</Dialog.Title>
          <Dialog.Description className={styles.description}>
            选中后立即生效并保存在本地浏览器，覆盖站点默认配色。
          </Dialog.Description>

          <div className={styles.grid}>
            {PRESETS.map((preset) => {
              const selected = choice?.light.toLowerCase() === preset.light.toLowerCase();
              return (
                <button
                  key={preset.light}
                  type="button"
                  className={`${styles.item} ${selected ? styles.itemActive : ''}`}
                  onClick={() => apply(preset)}>
                  <span
                    className={styles.swatch}
                    style={{background: preset.light}}
                    data-dark={preset.dark}
                  />
                  <span className={styles.itemLabel}>{preset.name}</span>
                  {selected && (
                    <svg className={styles.check} width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M3 8.5l3.5 3.5L13 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          <div className={styles.customRow}>
            <label className={styles.customLabel} htmlFor="theme-custom-color">
              自定义
            </label>
            <input
              id="theme-custom-color"
              type="color"
              className={styles.colorWell}
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
            />
            <input
              type="text"
              className={styles.hexInput}
              value={customHex}
              onChange={(e) => {
                const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                  setCustomHex(v.toLowerCase());
                }
              }}
              onBlur={() => {
                if (!/^#[0-9a-f]{6}$/i.test(customHex)) {
                  setCustomHex('#4263eb');
                }
              }}
              maxLength={7}
              spellCheck={false}
              aria-label="自定义主题色十六进制值"
            />
            <button
              type="button"
              className={styles.applyBtn}
              disabled={!/^#[0-9a-f]{6}$/i.test(customHex)}
              onClick={handleCustom}>
              应用
            </button>
          </div>

          <div className={styles.footer}>
            <span className={styles.current}>
              当前：
              {choice ? (
                <>
                  {choice.name}
                  <span
                    className={styles.currentSwatch}
                    style={{background: systemDark ? activeDark ?? choice.light : choice.light}}
                  />
                </>
              ) : (
                '站点默认'
              )}
            </span>
            <div className={styles.footerActions}>
              <button
                type="button"
                className={styles.resetBtn}
                disabled={!choice}
                onClick={() => apply(null)}>
                恢复默认
              </button>
              <Dialog.Close className={styles.doneBtn}>完成</Dialog.Close>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
