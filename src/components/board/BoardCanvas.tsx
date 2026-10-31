/**
 * Excalidraw 画布的浏览器端封装。
 *
 * 只有这个文件 import `@excalidraw/excalidraw`，且必须由调用方用
 * BrowserOnly + React.lazy 引入：
 *   1. Excalidraw 依赖 canvas / window，SSR 会直接炸（上游明确要求客户端渲染）；
 *   2. 整包 ~1MB gzip，不能让首页/文档页替它买单。
 *
 * 样式与字体不在 import 里，由 `plugins/excalidraw-assets` 拷到版本化目录，
 * 这里在画布挂载前注入 <link> 并设置 window.EXCALIDRAW_ASSET_PATH。
 */

import React, {useEffect, useRef, useState} from 'react';
import {usePluginData} from '@docusaurus/useGlobalData';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useColorMode} from '@docusaurus/theme-common';
import type {BoardCanvasProps, ExcalidrawApi} from '../../types/boardTypes';
import {ensureScene} from '../../utils/boardScene';
import styles from './styles.module.css';

type AssetsData = {
  version: string;
  baseDir: string;
  /** 相对 baseUrl，如 assets/excalidraw/0.18.1/index.css */
  stylesheet: string;
  /** 末尾带斜杠，如 assets/excalidraw/0.18.1/ */
  fontsPath: string;
};

/**
 * 按需注入白板样式表，同一页面多次挂载只注入一次。
 * 用 <link> 而不是 import：见 plugins/excalidraw-assets 顶部注释。
 */
const styleCache = new Map<string, Promise<void>>();

function loadStylesheet(href: string): Promise<void> {
  const cached = styleCache.get(href);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`样式加载失败: ${href}`));
    document.head.appendChild(link);
  });
  styleCache.set(href, p);
  return p;
}

/**
 * 内容签名：只取 elements 与 files，忽略 appState。
 *
 * appState 里混着 scrollX/zoom/选中态等视图信息（部分还会随交互变化），
 * 用整份 JSON 做签名会把「滚动画布」也当成改动。
 */
function sceneSignature(content: string): string {
  try {
    const s = JSON.parse(content) as Record<string, unknown>;
    return JSON.stringify({e: s.elements ?? [], f: s.files ?? {}});
  } catch {
    // 解析失败时退回全文比较，宁可多存一次也不要丢改动
    return content;
  }
}

/** 模块级缓存：动态 import 只跑一次。 */
type ExcalidrawModule = typeof import('@excalidraw/excalidraw');
let modulePromise: Promise<ExcalidrawModule> | null = null;

function loadExcalidraw(): Promise<ExcalidrawModule> {
  if (!modulePromise) modulePromise = import('@excalidraw/excalidraw');
  return modulePromise;
}

/**
 * 场景 JSON → Excalidraw 的 initialData。
 * 解析失败时返回空场景，保证画布一定挂得上（坏数据不应该白屏）。
 */
function toInitialData(content: string): Record<string, unknown> {
  try {
    const scene: unknown = JSON.parse(ensureScene(content));
    if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
      return {elements: []};
    }
    const s = scene as Record<string, unknown>;
    const asObject = (v: unknown): Record<string, unknown> =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : {};
    return {
      elements: Array.isArray(s.elements) ? s.elements : [],
      appState: asObject(s.appState),
      files: asObject(s.files),
      scrollToContent: true,
    };
  } catch {
    return {elements: []};
  }
}

export default function BoardCanvas({
  path,
  content,
  onChange,
  onReady,
}: BoardCanvasProps): React.ReactNode {
  const assets = usePluginData('excalidraw-assets') as AssetsData;
  // 必须走 useBaseUrl：相对路径会被解析成「当前页面目录 + 相对路径」，
  // 在 /whiteboard/<文件名> 下就变成 /whiteboard/assets/... 而 404。
  // useBaseUrl 返回的是绝对路径（含 baseUrl 前缀），两种页面都能用。
  const stylesheetHref = useBaseUrl(assets.stylesheet);
  const fontsPath = useBaseUrl(assets.fontsPath);
  // colorMode 只在客户端可用（SSG 阶段没有 ColorModeProvider）。
  // 本组件由 BrowserOnly 包住，所以放在这里取是安全的；
  // 放在页面顶层会让 `docusaurus build` 的 SSG 直接抛 ReactContextError。
  const {colorMode} = useColorMode();
  const theme = colorMode === 'dark' ? 'dark' : 'light';
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [mod, setMod] = useState<ExcalidrawModule | null>(null);

  // 初始场景只取一次：之后内容变化由画布自己管。若每次保存后都用服务端
  // 内容重建 initialData，用户正在画的图会被重置回上一版。
  const initialRef = useRef<Record<string, unknown> | null>(null);
  if (initialRef.current === null) initialRef.current = toInitialData(content);
  // 上一次已知的内容签名：挂载时先用初始场景打底，避免画布初始化
  // 立刻触发一次「内容变了」的假保存。
  const lastSigRef = useRef<string | null>(null);
  if (lastSigRef.current === null) lastSigRef.current = sceneSignature(content);

  useEffect(() => {
    // EXCALIDRAW_ASSET_PATH 必须在整包被求值前设好：它决定字体从哪拉，
    // 未设置时上游会退到 esm.sh CDN。
    (window as unknown as {EXCALIDRAW_ASSET_PATH?: string}).EXCALIDRAW_ASSET_PATH =
      fontsPath;
    let cancelled = false;
    // 样式与模块并行拉，两者都就绪才挂载画布（否则首帧没有样式，闪一下）
    Promise.all([loadStylesheet(stylesheetHref), loadExcalidraw()])
      .then(([, m]) => {
        if (cancelled) return;
        setMod(m);
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setFailed(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [fontsPath, stylesheetHref]);

  if (failed) {
    return (
      <div className={styles.canvasFallback}>
        <p>白板组件加载失败：{failed}</p>
        <p className={styles.canvasHint}>
          刷新页面重试；若持续失败请检查 /assets/excalidraw/ 是否可访问。
        </p>
      </div>
    );
  }

  if (!ready || !mod) {
    return (
      <div className={styles.canvasFallback}>
        <p>正在加载画布…</p>
      </div>
    );
  }

  const {Excalidraw, serializeAsJSON} = mod;

  return (
    <div className={styles.canvasHost}>
      <Excalidraw
        key={path}
        langCode="zh-CN"
        theme={theme}
        initialData={initialRef.current}
        // 这里不标注参数类型，交给 ExcalidrawProps 的上下文推导：
        // 上游用的是 OrderedExcalidrawElement / AppState / BinaryFiles，
        // 手写宽松类型（unknown / Record）会因为逆变而无法赋值。
        excalidrawAPI={(api) => onReady(api as unknown as ExcalidrawApi)}
        onChange={(elements, appState, files) => {
          // 统一走官方序列化器：它会剔除 scrollX/zoom/theme 等仅浏览器字段、
          // 丢掉已删除元素、把 files（图片 base64）一并带上。
          // 标题不在这里拼，由页面在保存前用 writeTitle 注入顶层 `_title`。
          const next = serializeAsJSON(
            elements as never,
            appState as never,
            files as never,
            'local',
          );
          // onChange 也会被「滚动 / 选中 / hover」这类纯视图变化触发，
          // 只有 elements + files 变了才是真的内容变化，否则会刚存完就变脏、
          // 无限循环保存。这里拿签名比一次，视图变化直接丢弃。
          const sig = sceneSignature(next);
          if (sig === lastSigRef.current) return;
          lastSigRef.current = sig;
          onChange(next);
        }}
      />
    </div>
  );
}
