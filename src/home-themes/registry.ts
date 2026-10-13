/**
 * 首页主题注册表。
 *
 * 一个「首页主题」是一个自带样式与素材的完整组件（见 ./clover），
 * 而不是一组配置参数——不同风格后期可能布局完全不同（漂浮粒子、
 * 扇形卡片、吉祥物都是四叶草主题的专属元素），用配置参数去抽象
 * 反而会绑手绑脚。新增主题：新建一个目录实现组件，然后在
 * HOME_THEMES 里登记一行即可。
 *
 * SSR 与 hydration 首帧固定渲染 DEFAULT_HOME_THEME_ID
 * （见 src/pages/index.tsx），用户选择存 localStorage，挂载后才
 * 切换——非默认主题的用户首屏会先闪一下默认主题，这是纯
 * localStorage 方案的固有代价（与 FontPicker / 主题色注入一致）。
 *
 * 主题素材（hero 大图等）import 进 bundle 的只是 URL 字符串，
 * 浏览器只在真正渲染该主题时才下载图片，登记多个主题不会让
 * 首屏变重。
 */
import type {ComponentType} from 'react';
import CloverHome from './clover';

export type HomeThemeDef = {
  id: string;
  name: string;
  description: string;
  /** 选择器里的预览渐变色（起 / 止） */
  preview: [string, string];
  Component: ComponentType;
};

export const HOME_THEME_STORAGE_KEY = 'docs-home-theme';
/** 同页内（导航栏模态框 → 首页）广播主题切换的 CustomEvent 名 */
export const HOME_THEME_EVENT = 'docs-home-theme-change';
export const DEFAULT_HOME_THEME_ID = 'clover';

export const HOME_THEMES: HomeThemeDef[] = [
  {
    id: DEFAULT_HOME_THEME_ID,
    name: '幸运四叶草',
    description: '清晨草地、漂浮四叶草与幸运小龙',
    preview: ['#3fae5a', '#e0a92e'],
    Component: CloverHome,
  },
];

/** 按 id 取主题；未知 id 一律回退默认主题 */
export function getHomeTheme(id: string | null): HomeThemeDef {
  return HOME_THEMES.find((t) => t.id === id) ?? HOME_THEMES[0];
}

/** 读取本地保存的主题 id；非法值返回 null（= 默认主题） */
export function readStoredHomeThemeId(): string | null {
  try {
    const raw = localStorage.getItem(HOME_THEME_STORAGE_KEY);
    return raw && HOME_THEMES.some((t) => t.id === raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * 写入选择并广播。首页与导航栏模态框是两棵组件树，
 * 靠这个 CustomEvent 让首页即时切换；跨标签页由浏览器
 * 自带的 storage 事件兜底（首页那边监听）。
 */
export function persistHomeThemeId(id: string): void {
  try {
    localStorage.setItem(HOME_THEME_STORAGE_KEY, id);
  } catch {
    // localStorage 不可用（隐私模式等）时仅在当前页生效
  }
  window.dispatchEvent(new CustomEvent(HOME_THEME_EVENT, {detail: id}));
}
