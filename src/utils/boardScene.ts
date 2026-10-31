/**
 * `.excalidraw` 场景 JSON 的读写小工具。
 *
 * 为什么标题要自己塞进 JSON 顶层：Excalidraw 的 `appState.name` 只标记
 * `browser`（导出/服务端都丢掉，见上游 `x6` 表），所以「文件名」才是唯一
 * 稳定载体；但文件名里不能有 `/` 等字符，展示又不友好。折中做法是
 * 在场景 JSON 顶层加一个 `_title` 键——Excalidraw 的 `restore()` 会忽略
 * 未知顶层键，文件仍然是合法的 `.excalidraw`（官方应用也能直接打开）。
 */

/** 场景 JSON 里保存标题的顶层键（下划线前缀表示「本站扩展」）。 */
export const TITLE_KEY = '_title';

/** 白板文件扩展名。 */
export const BOARD_EXT = '.excalidraw';

/** 单块白板的内容上限（字节），与后端保持一致；超过时前端先拦住。 */
export const MAX_BOARD_BYTES = 16 * 1024 * 1024;

type Scene = Record<string, unknown>;

function parseScene(content: string): Scene | null {
  try {
    const data: unknown = JSON.parse(content);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return data as Scene;
  } catch {
    return null;
  }
}

/** 读取场景标题；缺失或非法时返回 null。 */
export function readTitle(content: string): string | null {
  const scene = parseScene(content);
  const t = scene?.[TITLE_KEY];
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

/**
 * 写入场景标题。
 * 解析失败时原样返回——宁可丢标题，也不要把用户内容改成非法 JSON。
 */
export function writeTitle(content: string, title: string): string {
  const scene = parseScene(content);
  if (!scene) return content;
  const clean = title.trim();
  if (clean) scene[TITLE_KEY] = clean;
  else delete scene[TITLE_KEY];
  return JSON.stringify(scene, null, 2);
}

/**
 * 把标题转成安全的文件名主干。
 *
 * 只挡「会把文件写到别处」和「文件系统不认」的字符，中文原样保留
 * （与私有文档一致，URL 由浏览器负责百分号编码）。
 */
export function titleToFileName(title: string): string {
  const base = title
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
    .trim();
  return base || '未命名白板';
}

/** 从路径取展示名（去掉目录与扩展名）。 */
export function pathToTitle(path: string): string {
  const file = path.split('/').pop() || path;
  return file.endsWith(BOARD_EXT) ? file.slice(0, -BOARD_EXT.length) : file;
}

/** 标题 → 相对路径（默认放在根目录）。 */
export function titleToPath(title: string): string {
  return `${titleToFileName(title)}${BOARD_EXT}`;
}

/**
 * 校验后端返回的内容是不是可用场景。
 * 空串或坏 JSON 时返回一个最小合法场景，避免画布挂载失败白屏。
 */
export function ensureScene(content: string): string {
  if (parseScene(content)) return content;
  return emptyScene();
}

/** 最小合法空白场景（新建白板时用）。 */
export function emptyScene(): string {
  return JSON.stringify(
    {
      type: 'excalidraw',
      version: 2,
      source: 'docs.lopop.top',
      elements: [],
      appState: {gridSize: null, viewBackgroundColor: '#ffffff'},
      files: {},
    },
    null,
    2,
  );
}

/** 字节数（UTF-8），用于前端体积上限提示。 */
export function byteSize(content: string): number {
  return new TextEncoder().encode(content).length;
}

/** 人类可读体积。 */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
