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
import type {RefObject, ReactNode} from 'react';
import type {Node} from '@xyflow/react';
import type {Editor} from '@tiptap/react';

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
  /** 禅模式：纯前端状态，隐藏侧边栏/顶栏、居中专注编辑 */
  zen: boolean;
  /** 切换禅模式 */
  onToggleZen: () => void;
};

// ── 目录树 / 排序画布 ───────────────────────────────

/** 目录树节点（`/tree` 与私有文档树返回的结构） */
export type TreeNode = {
  path: string;
  is_dir: boolean;
  label?: string;
  title?: string;
  name?: string;
  children?: TreeNode[];
};

/**
 * 排序管理器上报给后端的树：只报「结构 + 原路径」，
 * position 由后端按画布顺序计算。
 */
export type SerializedNode =
  | {path: string; is_dir: true; children?: SerializedNode[]}
  | {path: string; is_dir: false};

/** 目录树扁平化后的画布条目 */
export type BoardItem = {
  id: string;
  label: string;
  isDir: boolean;
  parentId: string | null;
};

/** 画布节点携带的数据（分类与卡片共用） */
export type SortNodeData = {label: string; isDir: boolean};

/** React Flow 画布节点：分类是父节点，文档相对父节点定位 */
export type SortNode = Node<SortNodeData>;

/** 拖拽态上下文：自定义节点从中读「当前拖拽项 / 当前落点」 */
export type SortDragState = {draggingId: string | null; dropTargetId: string | null};

// ── 小型表单与展示组件的 props ──────────────────────

export type CategorySelectProps = {
  value: string;
  onChange: (path: string) => void;
  categories: CategoryOption[];
  rootLabel?: string;
};

export type NewArticleProps = {
  categories: CategoryOption[];
  isPrivate: boolean;
  onCreate: (draft: NewDraft) => void;
  onCancel: () => void;
};

export type NewCategoryProps = {
  categories: CategoryOption[];
  isPrivate: boolean;
  onCreate: (input: NewCategoryInput) => Promise<boolean> | boolean;
  onCancel: () => void;
};

/** 三步骤进度条的单步状态 */
export type BuildStepState = 'done' | 'active' | 'pending' | 'fail';

export type BuildStepsProps = {
  phase: string;
  activeStep: number;
  inline?: boolean;
};

export type SortManagerProps = {
  open: boolean;
  tree: TreeNode[];
  token: string | null;
  pipeline: Pipeline;
  onTreeChange?: () => void;
  onClose: () => void;
};

/** 假光标样式（Monkeytype 式：竖线 / 方块 / 下划线 / 描边） */
export type CaretStyle = 'line' | 'block' | 'underline' | 'outline';

/** `SmoothCaret` 的 props：编辑器实例 + 当前光标样式 */
export type SmoothCaretProps = {
  editor: Editor | null;
  caretStyle: CaretStyle;
};

// ── 侧边栏文件树 ─────────────────────────────────────

export type TreeItemProps = {
  node: TreeNode;
  active?: string | null;
  onSelect: (path: string) => void;
};

export type CategoryItemProps = TreeItemProps;

export type FileTreeProps = {
  tree: TreeNode[];
  active?: string | null;
  onSelect: (path: string) => void;
};

// ── 登录 / 顶部构建状态 ──────────────────────────────

export type LoginProps = {onLogin: (token: string) => void};

export type TopBuildStatusProps = {pipeline: Pipeline};

// ── Tiptap 编辑器 ────────────────────────────────────

/**
 * 仅依赖编辑器实例的 `view.dom`（滚动定位要用），
 * 这样页面不必到处 import Tiptap 的 Editor 类型。
 */
export type EditorHandle = {view: {dom: HTMLElement}};

export type TiptapBodyProps = {
  initialMarkdown: string;
  onChange: (md: string) => void;
  editorRef: RefObject<EditorHandle | null>;
  /** 假光标样式：由编辑器页持有、走 localStorage 持久化 */
  caretStyle: CaretStyle;
};

export type ToolbarProps = {editor: Editor};

export type ToolBtnProps = {
  icon: ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
};

// ── 元信息表单 ───────────────────────────────────────

export type TagsFieldProps = {
  value?: string | string[];
  onChange: (tags: string[]) => void;
};

export type MetaFormProps = {
  fm: FrontMatter;
  /** 只接收 updater（与页面里 editMetaFm 的实际签名一致） */
  setFm: (updater: (prev: FrontMatter) => FrontMatter) => void;
};
