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
 * - 中文字体都是 unicode-range 分片 woff2，浏览器按需下载可见字符分片。
 *   @font-face 清单由 plugins/cjk-webfonts 拷到 assets/fonts/ 下，
 *   这里仅在用户真正选中时才注入 <link>，选中之前不占任何主包体积。
 *
 * 选择结果存 localStorage，SSR 初始渲染始终为「系统默认」，
 * 在 useEffect 中恢复用户选择，避免 hydration mismatch。
 */

type FontChoice = 'system' | 'lxgw' | 'notoSerif';

const STORAGE_KEY = 'docs-content-font';

type WebfontMeta = {
  /** 字体资源版本号，与包内字体版本一致 */
  version: string;
  /** 相对于 baseUrl 的产物目录，如 assets/fonts/lxgw/1.522 */
  baseDir: string;
  /** 该字体各字重的 @font-face 清单，相对 baseUrl */
  stylesheets: string[];
};
type WebfontsData = Record<'lxgw' | 'notoSerif', WebfontMeta>;

const FONTS: {
  value: FontChoice;
  label: string;
  family?: string;
  /** 标题 / <strong> / <th> 用的字体，缺省跟正文一致 */
  emphasis?: string;
  /** 标题字重，缺省用主题的 --ifm-heading-font-weight */
  headingWeight?: string;
}[] = [
  {value: 'system', label: '系统默认'},
  {
    value: 'lxgw',
    label: '霞鹜文楷',
    family: "'LXGW WenKai'",
    // 霞鹜文楷只有 Regular 一个字重，标题继承 700 会被浏览器合成伪粗体。
    // 改用同包的 Medium（真字重）；注意它的 CSS 里 family 名是
    // 'LXGW WenKai Medium'，与 Regular 是两个独立 family，得显式切过去。
    emphasis: "'LXGW WenKai Medium'",
    headingWeight: '500',
  },
  {
    value: 'notoSerif',
    label: '思源宋体',
    family: "'Noto Serif SC'",
    // Regular 与 Bold 同属 'Noto Serif SC'，标题直接吃 700 就是真 Bold，
    // 不需要 emphasis / headingWeight。
  },
];

/**
 * 按需注入 webfont 的 @font-face 清单。全局 CSS 里没有它们（见 cjk-webfonts 插件），
 * 所以切到某个中文字体时要把对应的 <link> 挂上；<link> 一旦挂上就无法卸载，
 * 重复切换直接命中缓存。
 */
const cssPromises = new Map<FontChoice, Promise<unknown>>();

function loadWebfontCss(
  choice: FontChoice,
  hrefs: string[],
): Promise<unknown> {
  const cached = cssPromises.get(choice);
  if (cached) {
    return cached;
  }
  const promise = Promise.all(
    hrefs.map(
      (href) =>
        new Promise<void>((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          link.dataset.fontCss = choice;
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
    cssPromises.delete(choice);
    throw err;
  });
  cssPromises.set(choice, promise);
  return promise;
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
  const webfonts = usePluginData('cjk-webfonts') as WebfontsData;
  const {withBaseUrl} = useBaseUrlUtils();
  // 清单路径来自构建期注入的 globalData（见 plugins/cjk-webfonts），
  // 已挂过的 <link> 跳过，避免重复插入。
  const hrefsOf = (choice: FontChoice): string[] => {
    const meta = webfonts[choice];
    if (!meta) {
      return [];
    }
    return meta.stylesheets
      .filter(
        (href) =>
          !document.querySelector(
            `link[data-font-css="${choice}"][href$="${href}"]`,
          ),
      )
      .map(withBaseUrl);
  };

  // 恢复上次的字体选择
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as FontChoice | null;
    if (!saved || !FONTS.some((f) => f.value === saved)) {
      return;
    }
    setValue(saved);
    if (saved === 'system') {
      applyFont(saved);
    } else {
      // 等 @font-face 就位后再切字体，避免先回落再跳一下
      loadWebfontCss(saved, hrefsOf(saved))
        .then(() => applyFont(saved))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (choice: FontChoice) => {
    setValue(choice);
    localStorage.setItem(STORAGE_KEY, choice);

    if (choice === 'system' || cssPromises.has(choice)) {
      // 系统默认不加载任何字体；已加载过的中文字体直接切，无感知
      applyFont(choice);
      return;
    }
    const toastId = toast.loading('字体加载中…');
    loadWebfontCss(choice, hrefsOf(choice))
      .then(() => {
        applyFont(choice);
        toast.success(`${FONTS.find((f) => f.value === choice)?.label}加载完成`, {
          id: toastId,
        });
      })
      .catch(() => {
        toast.error('字体加载失败，请稍后重试', {id: toastId});
      });
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