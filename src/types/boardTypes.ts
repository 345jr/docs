/**
 * 私有白板功能的共享类型：`pages/whiteboard.tsx` + `utils/boardClient.ts`。
 *
 * 与 `privateTypes.ts` 分开——白板是另一套后端存储（`data/private-boards`）
 * 和另一套接口（`/editor/api/boards/*`），只是共用同一个 session token
 * （编辑器 unlock 签发的 `docs-editor-token`）。
 *
 * ⚠️ 别放进 `src/pages/`：Docusaurus 会把该目录下每个文件当路由
 * （详见 `editorTypes.ts` 头部注释）。
 */

// ── 后端数据 ─────────────────────────────────────────

/** `GET /boards` 返回的一行。按 `updated_at` 降序，前端直接照序渲染。 */
export type BoardSummary = {
  /** 相对私有白板根目录的路径，形如 `2026-11-01-架构图.excalidraw` */
  path: string;
  /** 展示用标题（取自场景 JSON 顶层 `_title`，缺失时退回文件名） */
  title: string;
  /** 字节数，前端用来提示「文件较大」 */
  size: number;
  /** RFC3339，用于列表的「更新于」与排序 */
  updated_at: string;
};

/** `GET /boards/read` 返回体：场景 JSON 原文 + 标题 + 版本号。 */
export type BoardPayload = {
  path: string;
  title: string;
  /** 场景 JSON 原文（字符串，前端 JSON.parse 后交给 Excalidraw） */
  content: string;
  /** 服务端写入序号，用于并发检测（见 saveBoard 的 base_rev） */
  rev: number;
};

// ── 前端状态 ─────────────────────────────────────────

/** 画布内容：`.excalidraw` 场景 JSON 字符串（含 elements / appState / files） */
export type BoardScene = {
  /** `.excalidraw` 场景 JSON 字符串 */
  content: string;
  /** 白板标题，落在场景 JSON 顶层 `_title` */
  title: string;
};

/**
 * 保存状态机：
 * idle     — 无改动
 * dirty    — 有改动待保存（防抖计时中）
 * saving   — 请求在飞
 * saved    — 刚保存成功（短暂显示后回 idle）
 * error    — 保存失败，等下一次改动或手动重试
 * conflict — 服务端 rev 变了（别处改过），暂停自动保存，等用户决定
 */
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

// ── boardClient 的入参 ───────────────────────────────

/** `boardClient.call()` 的可选参数（与私有文档 `CallOptions` 同构，各自独立） */
export type CallOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type SaveBoardArgs = {
  path: string;
  /** 场景 JSON 字符串 */
  content: string;
  title: string;
  /** 读到该白板时的 rev；服务端 rev 与之不符则返回 409 */
  baseRev: number;
};

export type RenameBoardArgs = {
  path: string;
  newPath: string;
  title?: string;
};

export type CreateBoardArgs = {
  path: string;
  title?: string;
};

// ── 组件 props ───────────────────────────────────────

/** 侧栏白板列表 */
export type BoardListProps = {
  boards: BoardSummary[] | null;
  activePath: string | null;
  loading: boolean;
  collapsed: boolean;
  onSelect: (path: string) => void;
  onCreate: () => void;
  onRename: (board: BoardSummary) => void;
  onDelete: (board: BoardSummary) => void;
  onToggleCollapse: () => void;
};

/** 画布容器：Excalidraw 只在浏览器挂载，SSR 阶段由 BrowserOnly 兜住 */
export type BoardCanvasProps = {
  /** 切换白板时用，作为 React key 强制重建画布 */
  path: string;
  /** 场景 JSON 原文，交给 initialData 解析 */
  content: string;
  /** 场景变化回调，参数是序列化后的场景 JSON 字符串 */
  onChange: (content: string) => void;
  /** 首次挂载拿到 excalidrawAPI，用于读取当前场景与滚动位置 */
  onReady: (api: ExcalidrawApi) => void;
};

/**
 * Excalidraw 的命令式 API 里本项目用到的子集。
 *
 * 不从 `@excalidraw/excalidraw` 直接 import 类型：那会把整包类型拉进
 * 每个引用 `boardTypes.ts` 的文件（包括不需要画布的列表页），
 * 拖慢 tsc 并让 `src/` 的依赖图变脏。这里只声明实际调用的方法。
 */
export type ExcalidrawApi = {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
  scrollToContent: (target?: unknown, opts?: Record<string, unknown>) => void;
  updateScene: (scene: Record<string, unknown>) => void;
};

/** 顶栏保存状态灯 */
export type SaveIndicatorProps = {
  status: SaveStatus;
  /** 上次成功保存的时间戳（ms），null 表示本次会话还没存过 */
  savedAt: number | null;
  onRetry: () => void;
  onReload: () => void;
};
