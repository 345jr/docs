import React, {useEffect, useState} from 'react';
import {Select} from '@base-ui/react/select';
import toast from 'react-hot-toast';
import {usePluginData} from '@docusaurus/useGlobalData';
import {useBaseUrlUtils} from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

/**
 * 顶部导航栏字体选择器。
 *
 * - 只对文档正文生效（见 custom.css 中 .main-wrapper main 的作用域），
 *   侧边栏 / 导航栏不受影响。
 * - 「系统默认」不加载任何字体；
 * - 「霞鹜文楷」为 unicode-range 分片 woff2，浏览器按需下载可见字符分片。
 *   其 @font-face 清单由 plugins/lxgw-webfont 拷到 assets/fonts/ 下，
 *   这里只注入一个 <link>，选中之前不占任何主包体积；
 * - 「方正宋三」为单个 ttf（约 3MB），首次选择时通过 FontFace API
 *   懒加载并弹出加载提示，之后由浏览器缓存。
 *
 * 选择结果存 localStorage，SSR 初始渲染始终为「系统默认」，
 * 在 useEffect 中恢复用户选择，避免 hydration mismatch。
 */

type FontChoice = 'system' | 'lxgw' | 'fzsong';

type LxgwWebfontData = {
  /** 霞鹜文楷版本号，与包内字体版本一致 */
  version: string;
  /** 相对于 baseUrl 的产物目录，如 assets/fonts/lxgw-wenkai/1.522 */
  baseDir: string;
};

const STORAGE_KEY = 'docs-content-font';

const FONTS: {
  value: FontChoice;
  label: string;
  family?: string;
  /** 标题 / <strong> 用的字体，缺省跟正文一致 */
  emphasis?: string;
  /** 标题字重，缺省用主题的 --ifm-heading-font-weight */
  headingWeight?: string;
}[] = [
  {value: 'system', label: '系统默认'},
  {
    value: 'lxgw',
    label: '霞鹜文楷',
    family: "'LXGW WenKai'",
    // 霞鹜文楷只有一个 Regular 字重，标题直接继承 700 会被浏览器合成出
    // 很难看的伪粗体。改用官方同包的 Medium（真实字重）承担标题与行内加粗。
    emphasis: "'LXGW WenKai Medium'",
    headingWeight: '500',
  },
  {
    value: 'fzsong',
    label: '方正宋三',
    family: "'FZSongS', '方正宋三简体'",
  },
];

// 霞鹜文楷 webfont 的 CSS（两个字重共 448 条 @font-face）按需加载，只加载一次。
// 注意：包里根目录的 style.css 用 @import 引了全部 6 个字重（含等宽 Mono），
// 不能直接用；只取正文需要的 Regular + Medium 两个 result.css。
let lxgwCssPromise: Promise<unknown> | null = null;

function loadLxgwCss(hrefs: string[]): Promise<unknown> {
  if (!lxgwCssPromise) {
    lxgwCssPromise = Promise.all(
      hrefs.map(
        (href) =>
          new Promise<void>((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = () => resolve();
            link.onerror = () => {
              link.remove();
              reject(new Error(`Failed to load font stylesheet: ${href}`));
            };
            document.head.appendChild(link);
          }),
      ),
    ).catch((err) => {
      // 失败后清空缓存，允许用户重试
      lxgwCssPromise = null;
      throw err;
    });
  }
  return lxgwCssPromise;
}

// 方正宋三 ttf 的加载 promise 缓存在模块级，重复选择不会重新下载
// （浏览器 HTTP 缓存兜底，刷新页面后第二次加载也很快）。
// 注意：不能用 document.fonts.check() 判断 —— 对尚未注册的字体族
// 它也会返回 true（规范行为），会导致首次加载被跳过。
let fzSongPromise: Promise<FontFace> | null = null;
let fzSongLoaded = false;

function loadFZSong(): Promise<FontFace> {
  if (!fzSongPromise) {
    const face = new FontFace(
      'FZSongS',
      "url('/fonts/FZSongS.ttf') format('truetype')",
    );
    fzSongPromise = face.load();
    fzSongPromise
      .then((loaded) => {
        fzSongLoaded = true;
        document.fonts.add(loaded);
      })
      .catch(() => {
        // 失败后清空缓存，允许用户重试
        fzSongPromise = null;
      });
  }
  return fzSongPromise;
}

function applyFont(choice: FontChoice) {
  const font = FONTS.find((f) => f.value === choice);
  const root = document.documentElement;
  const vars: [string, string | undefined][] = [
    ['--site-content-font', font?.family],
    ['--site-emphasis-font', font?.emphasis ?? font?.family],
    ['--site-heading-weight', font?.headingWeight],
  ];
  for (const [name, value] of vars) {
    if (value) {
      root.style.setProperty(name, value);
    } else {
      root.style.removeProperty(name);
    }
  }
}

export default function FontPicker(): React.ReactNode {
  const [value, setValue] = useState<FontChoice>('system');
  const webfont = usePluginData('lxgw-webfont') as LxgwWebfontData;
  const {withBaseUrl} = useBaseUrlUtils();
  const lxgwCssHrefs = [
    withBaseUrl(`/${webfont.baseDir}/regular/result.css`),
    withBaseUrl(`/${webfont.baseDir}/medium/result.css`),
  ];

  // 恢复上次的字体选择
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as FontChoice | null;
    if (!saved || !FONTS.some((f) => f.value === saved)) {
      return;
    }
    setValue(saved);
    if (saved === 'fzsong') {
      // 正文先用回退字体渲染，FontFace 就绪后自动替换（font-display 行为）
      loadFZSong()
        .then(() => applyFont('fzsong'))
        .catch(() => {});
    } else if (saved === 'lxgw') {
      // 等 @font-face 就位后再切字体，避免先回落再跳一下
      loadLxgwCss(lxgwCssHrefs)
        .then(() => applyFont('lxgw'))
        .catch(() => {});
    } else {
      applyFont(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (choice: FontChoice) => {
    setValue(choice);
    localStorage.setItem(STORAGE_KEY, choice);

    if (choice === 'fzsong') {
      if (fzSongLoaded) {
        applyFont('fzsong');
        return;
      }
      const toastId = toast.loading('字体加载中…');
      loadFZSong()
        .then(() => {
          applyFont('fzsong');
          toast.success('方正宋三加载完成', {id: toastId});
        })
        .catch(() => {
          toast.error('字体加载失败，请稍后重试', {id: toastId});
        });
    } else if (choice === 'lxgw' && !lxgwCssPromise) {
      // 首次选择才需要等 CSS 分片；已加载过时直接切换，无感知
      const toastId = toast.loading('字体加载中…');
      loadLxgwCss(lxgwCssHrefs)
        .then(() => {
          applyFont('lxgw');
          toast.success('霞鹜文楷加载完成', {id: toastId});
        })
        .catch(() => {
          toast.error('字体加载失败，请稍后重试', {id: toastId});
        });
    } else {
      applyFont(choice);
    }
  };

  return (
    <Select.Root<FontChoice> value={value} onValueChange={handleChange}>
      <Select.Trigger className={styles.trigger} aria-label="选择正文字体">
        <Select.Value>{(v) => FONTS.find((f) => f.value === v)?.label}</Select.Value>
        <Select.Icon className={styles.icon}>
          <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 6l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className={styles.positioner}
          align="end"
          alignItemWithTrigger={false}
          sideOffset={6}>
          <Select.Popup className={styles.popup}>
            {FONTS.map((font) => (
              <Select.Item
                key={font.value}
                value={font.value}
                className={styles.item}>
                <Select.ItemIndicator className={styles.indicator}>
                  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M3 8.5l3.5 3.5L13 4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </Select.ItemIndicator>
                <Select.ItemText>
                  <span
                    className={styles.label}
                    style={font.family ? {fontFamily: font.family} : undefined}>
                    {font.label}
                  </span>
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
