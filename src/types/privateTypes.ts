/**
 * 私有文档功能的共享类型：`pages/private.tsx` + `utils/privateClient.ts`。
 *
 * 与 `editorTypes.ts` 分开——两边只是共用同一个 token（编辑器 unlock 签发的
 * `docs-editor-token`），UI 和数据结构各走各的，混在一个文件里反而难找。
 *
 * ⚠️ 同样别放进 `src/pages/`：Docusaurus 会把该目录下每个文件当路由
 * （详见 `editorTypes.ts` 头部注释）。
 */

// ── 后端数据 ─────────────────────────────────────────

/**
 * `/tree` 返回的文件条目。结构与编辑器 `/tree` 完全一致（后端同一套），
 * `name` 恒有值：侧栏过滤、去扩展名都靠它。
 */
export type FileEntry = {
  path: string;
  name: string;
  is_dir: boolean;
  label?: string;
  title?: string;
  children?: FileEntry[];
};

/** `privateClient.call()` 的可选参数（与编辑器 `api()` 的参数同构） */
export type CallOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

/** `/unlock` 响应：成功带 token；失败时 `call()` 直接 throw */
export type UnlockPayload = {token: string; error?: string};

// ── 页面数据 ─────────────────────────────────────────

/** 当前打开的私有文档（已剥掉 front matter 与正文一级标题） */
export type DocEntry = {
  path: string;
  title: string;
  content: string;
};

/**
 * 侧边栏项：Docusaurus sidebar item 的子集
 * （`DocsSidebarProvider` 只需要 category / link 两种，且都带 href）。
 */
export type SidebarItem =
  | {
      type: 'category';
      label: string;
      collapsible: true;
      collapsed: false;
      href: string;
      items: SidebarItem[];
    }
  | {
      type: 'link';
      href: string;
      label: string;
    };

/** 面包屑项：最后一项（当前页）的 href 为 null */
export type Crumb = {
  label: string;
  href: string | null;
};

/** TOC 项：`TOC` / `TOCCollapsible` 的最小字段 */
export type TocItem = {
  id: string;
  value: string;
  level: number;
};

// ── privateClient 的入参 ─────────────────────────────

export type SaveDocArgs = {
  path: string;
  content: string;
};

export type MoveDocArgs = {
  path: string;
  newPath: string;
  content?: string;
};

export type SaveCategoryArgs = {
  path: string;
  label: string;
  description?: string;
};

// ── 组件 props ───────────────────────────────────────

export type PrivateBreadcrumbsProps = {
  crumbs?: Crumb[];
};

export type CategoryIndexProps = {
  node: FileEntry;
};

// ── 正文渲染器 ───────────────────────────────────────

export type MarkdownViewProps = {
  /** 原始 markdown（可缺省，缺省时只渲染空容器） */
  content?: string;
  /** 从正文里抽出来的一级标题，单独渲染到 header；没有则为空 */
  title?: string | null;
};
