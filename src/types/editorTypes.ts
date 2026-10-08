/**
 * 在线编辑页的共享类型。
 *
 * 单独开一个文件，避免 `pages/editor.tsx` 继续膨胀——那个文件已经 2000+ 行，
 * 类型散在组件之间会越来越难找。这里只放类型（`import type` 引入，零运行时开销）。
 *
 * ⚠️ 别把它放回 `src/pages/`：Docusaurus 会把该目录下的每个文件都当路由，
 * 放进去会多出一个 `/editorTypes` 页面，并在 SSG 阶段报
 * 「The page component at /editorTypes doesn't have a default export」构建失败。
 */
import type {RefObject} from 'react';

/** 新建文章时的内存草稿：落盘前一直存在 draft state 里，保存后转为 selected */
export type NewDraft = {
  path: string;
  fm: FrontMatter;
  body: string;
};

/**
 * front matter：字段随文章而定（title / description / tags / 日期……），
 * 由 Markdown 决定，所以只做开放约束，不逐字段列类型。
 */
export type FrontMatter = Record<string, any>;

/** 文章元信息弹窗里的草稿：`openMeta` 生成，`stageMeta` 才写回编辑器 */
export type ArticleMeta = {
  fm: FrontMatter;
  category: string;
  fileName: string;
  ext: string;
  message: string;
};

/** `categoryOptions` 产出的分类下拉项（depth 供下拉树缩进用） */
export type CategoryOption = {
  path: string;
  label: string;
  depth: number;
};

/** 新建分类时提交的字段 */
export type NewCategoryInput = {
  path: string;
  label: string;
  description?: string;
};

/** `/editor/api/status` 返回的单条 workflow run */
export type PipelineRun = {
  head_sha?: string;
  status?: string;
  conclusion?: string | null;
};

/** `/editor/api/status` 返回的流水线状态 */
export type PipelineStatus = {
  busy?: boolean;
  runs?: PipelineRun[];
};

/** `usePipeline(token)` 的返回值 */
export type Pipeline = {
  status: PipelineStatus | null;
  refresh: () => Promise<PipelineStatus | null>;
};

/** `ArticleEditor` 的完整 props —— 调用点与函数体两侧同时受检 */
export type ArticleEditorProps = {
  /** 解锁密钥，未登录时为 null */
  token: string | null;
  /** 编辑已有文章时的目标路径；新建草稿时为 undefined */
  path?: string | null;
  /** 新建文章的内存草稿，与 path 二选一（渲染条件是 draft || selected） */
  draft: NewDraft | null;
  categories: CategoryOption[];
  pipeline: Pipeline;
  /** 页面右侧滚动容器（`mainRef`），编辑器用它做滚动同步 */
  scrollRef: RefObject<HTMLElement | null>;
  /** 保存 / 移动 / 删除后切换到目标文章；取消选择时传 null */
  onSelect: (path: string | null) => void;
  /** 文件树需要刷新 */
  onTreeChange: () => void;
  /** 草稿是否未保存（目前仅保留给上层，编辑器内部不回调） */
  onDirtyChange: (dirty: boolean) => void;
  /** 新建文章首次保存成功，上层据此把 draft 转成 selected */
  onDraftSaved: (path: string) => void;
  /** 私有模式：读写走私有接口（同一 token） */
  pv: boolean;
};
