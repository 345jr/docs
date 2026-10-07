import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import Layout from '@theme/Layout';
import {EditorContent, useEditor, useEditorState} from '@tiptap/react';
import {StarterKit} from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';
import {TableKit} from '@tiptap/extension-table';
import {Image} from '@tiptap/extension-image';
import {Dialog} from '@base-ui/react/dialog';
import {Select} from '@base-ui/react/select';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import toast, {Toaster} from 'react-hot-toast';
import {Admonition} from '../theme/tiptap/admonition';
import styles from './editor.module.css';
import '../theme/tiptap/admonition.css';
import LoginForm from '../components/LoginForm';
import {
  fetchTree as pvFetchTree,
  readDoc as pvReadDoc,
  saveDoc as pvSaveDoc,
  moveDoc as pvMoveDoc,
  deleteDoc as pvDeleteDoc,
  saveCategory as pvSaveCategory,
} from '../utils/privateClient';

// ── API ──────────────────────────────────────────────

const API = '/editor/api';
// session 失效时广播，EditorPage 监听后清 token、回到登录页。
const UNAUTHORIZED_EVENT = 'docs-editor:unauthorized';

async function api(path, options = {}) {
  const headers = {...(options.headers || {})};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 401 表示 session 失效（如 Steward 重启后内存 session 清空）；
    // unlock 本身返回 401 是密码错误，不触发登出。
    if (res.status === 401 && path !== '/unlock' && typeof window !== 'undefined') {
      if (sessionStorage.getItem('docs-editor-token')) {
        sessionStorage.removeItem('docs-editor-token');
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── front matter（纯正则，避免引入 yaml 依赖）──────────

function unquote(v) {
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1).replace(/\\"/g, '"');
  }
  return v;
}

function parseYamlValue(raw) {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((s) => unquote(s.trim()))
      .filter((s) => s !== '');
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === '' || v === 'null' || v === '~') return '';
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return unquote(v);
}

function parseFrontMatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return {data: {}, content: raw};
  const data = {};
  for (const line of m[1].split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf(':');
    if (i <= 0) continue;
    data[s.slice(0, i).trim()] = parseYamlValue(s.slice(i + 1));
  }
  return {data, content: raw.slice(m[0].length)};
}

const YAML_SPECIAL = /[:#[\]{},&*!|>'"%@`\n]/;

function formatScalar(v) {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (s === '' || YAML_SPECIAL.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

function formatYamlValue(v) {
  if (Array.isArray(v)) return `[${v.map(formatScalar).join(', ')}]`;
  if (v && typeof v === 'object') return JSON.stringify(v);
  return formatScalar(v);
}

function serializeFrontMatter(data, content) {
  const keys = Object.keys(data).filter((k) => data[k] !== '' && data[k] != null);
  if (keys.length === 0) return content;
  const lines = ['---'];
  for (const k of keys) lines.push(`${k}: ${formatYamlValue(data[k])}`);
  return [...lines, '---', '', content].join('\n');
}

// ── 路径 / 分类工具 ───────────────────────────────────

function splitPath(path) {
  const seg = path.split('/');
  const file = seg.pop() || '';
  const dot = file.lastIndexOf('.');
  return {
    dir: seg.join('/'),
    name: dot >= 0 ? file.slice(0, dot) : file,
    ext: dot >= 0 ? file.slice(dot) : '.md',
  };
}

function slugify(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}

function categoryOptions(tree) {
  const byPath = new Map();
  const walk = (nodes, depth) => {
    for (const n of nodes || []) {
      if (n.is_dir) {
        byPath.set(n.path, {path: n.path, label: n.label || n.name, depth});
        walk(n.children, depth + 1);
      }
    }
  };
  walk(tree, 0);
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

// ── 正文锚点（解析 H1-H3）────────────────────────────

function stripInline(s) {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .trim();
}

function parseToc(md) {
  const items = [];
  const lines = md.split('\n');
  let inFence = false;
  let offset = 0;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
    } else if (!inFence) {
      const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
      if (m) items.push({level: m[1].length, text: stripInline(m[2]), offset});
    }
    offset += line.length + 1;
  }
  return items;
}

// ── 图标 ─────────────────────────────────────────────

function Ic({children, size = 16}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      {children}
    </svg>
  );
}

const IconArrow = (props) => (
  /* 与文档站 @theme/Icon/Arrow 完全一致的双箭头图标 */
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" {...props}>
    <g fill="#7a7a7a">
      <path d="M9.992 10.023c0 .2-.062.399-.172.547l-4.996 7.492a.982.982 0 01-.828.454H1c-.55 0-1-.453-1-1 0-.2.059-.403.168-.551l4.629-6.942L.168 3.078A.939.939 0 010 2.528c0-.548.45-.997 1-.997h2.996c.352 0 .649.18.828.45L9.82 9.472c.11.148.172.347.172.55zm0 0" />
      <path d="M19.98 10.023c0 .2-.058.399-.168.547l-4.996 7.492a.987.987 0 01-.828.454h-3c-.547 0-.996-.453-.996-1 0-.2.059-.403.168-.551l4.625-6.942-4.625-6.945a.939.939 0 01-.168-.55 1 1 0 01.996-.997h3c.348 0 .649.18.828.45l4.996 7.492c.11.148.168.347.168.55zm0 0" />
    </g>
  </svg>
);

const IconNewFile = () => (
  <Ic>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
    <path d="M14 3v6h6" />
    <path d="M12 12v6M9 15h6" />
  </Ic>
);

const IconNewFolder = () => (
  <Ic>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M12 11v6M9 14h6" />
  </Ic>
);

const IconLogout = () => (
  <Ic>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Ic>
);

const IconLock = () => (
  <Ic>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Ic>
);

const IconSliders = () => (
  <Ic>
    <path d="M4 21v-7M4 10V3" />
    <path d="M12 21v-9M12 8V3" />
    <path d="M20 21v-5M20 12V3" />
    <path d="M2 14h4M10 8h4M18 16h4" />
  </Ic>
);

const IconCode = () => (
  <Ic>
    <path d="m16 18 6-6-6-6" />
    <path d="m8 6-6 6 6 6" />
  </Ic>
);

const IconTrash = () => (
  <Ic>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Ic>
);

const IconPublish = () => (
  <Ic>
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    <path d="m7 11 5-5 5 5" />
    <path d="M12 4v12" />
  </Ic>
);

const IconChevronDown = () => (
  <Ic>
    <path d="m6 9 6 6 6-6" />
  </Ic>
);

const IconCheck = () => (
  <Ic>
    <path d="m20 6-11 11-5-5" />
  </Ic>
);

const IconX = () => (
  <Ic size={12}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Ic>
);

const IconPlus = () => (
  <Ic>
    <path d="M12 5v14M5 12h14" />
  </Ic>
);

const IconSort = () => (
  <Ic>
    <path d="M7 4v16M7 4 3 8M7 4l4 4" />
    <path d="M17 20V4M17 20l-4-4M17 20l4-4" />
  </Ic>
);

const IconFolderSmall = () => (
  <Ic size={14}>
    <path d="M3 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </Ic>
);

const IconFileSmall = () => (
  <Ic size={14}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
  </Ic>
);

const IconGrip = () => (
  <Ic size={12}>
    <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="17" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" />
  </Ic>
);

// ── 流水线状态 ────────────────────────────────────────

function usePipeline(token) {
  const [status, setStatus] = useState(null);
  const refresh = useCallback(async () => {
    if (!token) return null;
    try {
      const s = await api('/status', {token});
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, [token]);
  useEffect(() => {
    if (!token) return undefined;
    refresh();
    const timer = setInterval(refresh, 12000);
    return () => clearInterval(timer);
  }, [token, refresh]);
  return {status, refresh};
}

// 写操作前置检查：流水线运行中则阻止。
async function ensureIdle(refresh) {
  const s = await refresh();
  if (s?.busy) {
    toast.error('当前有 CI/CD 流水线正在运行，请等部署完成后再操作');
    return false;
  }
  return true;
}

// 提交后等待对应的 workflow run 结束。
async function waitForPipeline(refresh, commit, onPhase) {
  const short = (commit || '').slice(0, 7);
  const deadline = Date.now() + 8 * 60 * 1000;
  let phase = 'waiting';
  while (Date.now() < deadline) {
    const s = await refresh();
    const runs = s?.runs || [];
    const run = short ? runs.find((x) => (x.head_sha || '').startsWith(short)) : runs[0];
    if (run && run.status === 'completed') {
      return run.conclusion === 'success' ? 'success' : 'failure';
    }
    const active = run
      ? run.status === 'queued' || run.status === 'in_progress'
      : Boolean(s?.busy);
    if (active && phase !== 'running') {
      phase = 'running';
      onPhase?.('running');
    }
    await sleep(5000);
  }
  return 'timeout';
}

// 统一的「提交 + 等待部署」流程。
async function commitAndWait(refresh, loadingMsg, fn) {
  if (!(await ensureIdle(refresh))) return null;
  const id = toast.loading(loadingMsg);
  try {
    const res = await fn();
    toast.success('已提交，等待构建部署', {id});
    const outcome = await waitForPipeline(refresh, res.commit, (phase) =>
      toast.loading(phase === 'waiting' ? '等待 CI 启动…' : '构建部署中…', {id}),
    );
    if (outcome === 'success') toast.success('构建部署完成 ✓', {id});
    else if (outcome === 'failure') toast.error('构建或部署失败，请查看 Steward', {id});
    else toast('已提交，未在预期时间内检测到流水线结束', {id, icon: 'ℹ️'});
    return res;
  } catch (err) {
    toast.error(err.message, {id});
    return null;
  }
}

// 顶部栏构建状态：有正在跑的流水线就显示三步骤，否则显示「当前暂无更新」。
function TopBuildStatus({pipeline}) {
  const runs = pipeline.status?.runs || [];
  const active = runs.find((r) => r.status === 'queued' || r.status === 'in_progress');
  if (!active) return <span className={styles.noUpdate}>当前暂无更新</span>;
  return <BuildSteps phase="running" activeStep={active.status === 'in_progress' ? 1 : 0} inline />;
}

// ── 登录 ──────────────────────────────────────────────

function Login({onLogin}) {
  return (
    <LoginForm
      title="在线编辑"
      onSubmit={async (key) => {
        const {token} = await api('/unlock', {method: 'POST', body: {key}});
        sessionStorage.setItem('docs-editor-token', token);
        onLogin(token);
        toast.success('已进入');
      }}
    />
  );
}

// ── 文件树 ────────────────────────────────────────────

// ── 侧边栏文件树（复用 Infima 菜单样式，与文档站侧边栏视觉一致）──

function CategoryItem({node, active, onSelect}) {
  const containsActive = !!active && active.startsWith(`${node.path}/`);
  const [open, setOpen] = useState(true);
  const toggle = () => setOpen((v) => !v);
  return (
    <li className={`menu__list-item ${open ? '' : 'menu__list-item--collapsed'}`}>
      <div className="menu__list-item-collapsible">
        <button
          type="button"
          className={`clean-btn menu__link menu__link--sublist ${
            containsActive ? 'menu__link--active' : ''
          }`}
          aria-expanded={open}
          onClick={toggle}>
          {node.label || node.name}
        </button>
        {/* 与文档站带链接分类一致：独立的 menu__caret 按钮（靠右、折叠时箭头旋转） */}
        <button
          type="button"
          className="clean-btn menu__caret"
          aria-expanded={open}
          aria-label={open ? '折叠分类' : '展开分类'}
          onClick={toggle}
        />
      </div>
      {/* 折叠动画：grid-template-rows 1fr → 0fr（对齐文档站 Collapsible 效果）*/}
      <div className={styles.collapsibleBody} aria-hidden={!open}>
        <ul className="menu__list">
          {(node.children || []).map((c) => (
            <TreeItem key={c.path} node={c} active={active} onSelect={onSelect} />
          ))}
        </ul>
      </div>
    </li>
  );
}

function TreeItem({node, active, onSelect}) {
  if (node.is_dir) {
    return <CategoryItem node={node} active={active} onSelect={onSelect} />;
  }
  return (
    <li className="menu__list-item">
      <button
        type="button"
        className={`clean-btn menu__link ${active === node.path ? 'menu__link--active' : ''}`}
        onClick={() => onSelect(node.path)}>
        {node.title || node.name}
      </button>
    </li>
  );
}

function FileTree({tree, active, onSelect}) {
  if (tree.length === 0) return <p className={styles.muted}>还没有文档</p>;
  return (
    <ul className="menu__list">
      {tree.map((n) => (
        <TreeItem key={n.path} node={n} active={active} onSelect={onSelect} />
      ))}
    </ul>
  );
}

// ── 富文本编辑器（Tiptap）─────────────────────────────

function TiptapBody({initialMarkdown, onChange, editorRef}) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({heading: {levels: [1, 2, 3, 4]}}),
        Markdown.configure({markedOptions: {gfm: true, breaks: false}}),
        TableKit,
        Image,
        Admonition,
      ],
      content: initialMarkdown,
      contentType: 'markdown',
      immediatelyRender: false,
      editorProps: {attributes: {class: 'tiptap-content'}},
      onUpdate: ({editor: ed}) => onChange(ed.getMarkdown()),
    },
    [],
  );

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  return (
    <>
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className={styles.tiptap} />
    </>
  );
}

function Toolbar({editor}) {
  const state = useEditorState({
    editor,
    selector: ({editor: ed}) =>
      ed
        ? {
            bold: ed.isActive('bold'),
            italic: ed.isActive('italic'),
            strike: ed.isActive('strike'),
            code: ed.isActive('code'),
            h1: ed.isActive('heading', {level: 1}),
            h2: ed.isActive('heading', {level: 2}),
            h3: ed.isActive('heading', {level: 3}),
            bullet: ed.isActive('bulletList'),
            ordered: ed.isActive('orderedList'),
            quote: ed.isActive('blockquote'),
            codeBlock: ed.isActive('codeBlock'),
            link: ed.isActive('link'),
          }
        : null,
  });

  if (!editor || !state) return null;
  const chain = () => editor.chain().focus();

  const Btn = ({label, title, active, onClick}) => (
    <button
      type="button"
      title={title}
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className={styles.toolbar}>
      <Btn label="H1" title="一级标题" active={state.h1} onClick={() => chain().toggleHeading({level: 1}).run()} />
      <Btn label="H2" title="二级标题" active={state.h2} onClick={() => chain().toggleHeading({level: 2}).run()} />
      <Btn label="H3" title="三级标题" active={state.h3} onClick={() => chain().toggleHeading({level: 3}).run()} />
      <span className={styles.toolSep} />
      <Btn label="B" title="加粗" active={state.bold} onClick={() => chain().toggleBold().run()} />
      <Btn label="I" title="斜体" active={state.italic} onClick={() => chain().toggleItalic().run()} />
      <Btn label="S" title="删除线" active={state.strike} onClick={() => chain().toggleStrike().run()} />
      <Btn label="‹›" title="行内代码" active={state.code} onClick={() => chain().toggleCode().run()} />
      <span className={styles.toolSep} />
      <Btn label="•" title="无序列表" active={state.bullet} onClick={() => chain().toggleBulletList().run()} />
      <Btn label="1." title="有序列表" active={state.ordered} onClick={() => chain().toggleOrderedList().run()} />
      <Btn label="❝" title="引用" active={state.quote} onClick={() => chain().toggleBlockquote().run()} />
      <Btn label="{}" title="代码块" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()} />
      <Btn label="—" title="分割线" onClick={() => chain().setHorizontalRule().run()} />
      <span className={styles.toolSep} />
      <Btn
        label="链接"
        title="插入/编辑链接"
        active={state.link}
        onClick={() => {
          const prev = editor.getAttributes('link').href || '';
          const url = window.prompt('链接地址', prev);
          if (url === null) return;
          if (url === '') chain().extendMarkRange('link').unsetLink().run();
          else chain().extendMarkRange('link').setLink({href: url}).run();
        }}
      />
      <Btn
        label="图片"
        title="插入图片"
        onClick={() => {
          const src = window.prompt('图片地址（如 /img/logo.svg）');
          if (!src) return;
          const alt = window.prompt('图片描述（alt）', '') || '';
          chain().setImage({src, alt}).run();
        }}
      />
      <Btn
        label="表格"
        title="插入表格"
        onClick={() => chain().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()}
      />
      <Btn
        label="提示框"
        title="插入提示框"
        onClick={() =>
          chain()
            .insertContent({
              type: 'admonition',
              attrs: {type: 'tip', title: null},
              content: [{type: 'paragraph'}],
            })
            .run()
        }
      />
    </div>
  );
}

// ── 元信息表单 ────────────────────────────────────────

function TagsField({value, onChange}) {
  const tags = (Array.isArray(value) ? value : value ? [value] : []).map(String);
  const [text, setText] = useState('');

  const add = () => {
    const t = text.trim();
    if (!t) return;
    if (!tags.includes(t)) onChange([...tags, t]);
    setText('');
  };

  const remove = (t) => onChange(tags.filter((x) => x !== t));

  return (
    <div className={styles.tagsField}>
      <div className={styles.tagInputRow}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="输入标签后点右侧 + 添加"
        />
        <button
          type="button"
          className={styles.tagAdd}
          onClick={add}
          disabled={!text.trim()}
          title="添加标签"
          aria-label="添加标签">
          <IconPlus />
        </button>
      </div>
      {tags.length > 0 && (
        <div className={styles.tagList}>
          {tags.map((t) => (
            <span key={t} className={styles.tagPill}>
              {t}
              <button
                type="button"
                className={styles.tagRemove}
                onClick={() => remove(t)}
                title={`删除 ${t}`}
                aria-label={`删除标签 ${t}`}>
                <IconX />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaForm({fm, setFm}) {
  const setField = (key, value) => {
    setFm((prev) => {
      const next = {...prev};
      if (value === '' || value == null) delete next[key];
      else next[key] = value;
      return next;
    });
  };
  return (
    <div className={styles.metaGrid}>
      <label>
        <span>标题 title（留空则用正文 H1）</span>
        <input value={fm.title ?? ''} onChange={(e) => setField('title', e.target.value)} />
      </label>
      <label>
        <span>描述 description</span>
        <textarea
          rows={3}
          value={fm.description ?? ''}
          onChange={(e) => setField('description', e.target.value)}
        />
      </label>
      <label>
        <span>标签 tags（输入后回车创建）</span>
        <TagsField
          value={fm.tags}
          onChange={(next) => setField('tags', next.length ? next : undefined)}
        />
      </label>
    </div>
  );
}

// ── 文章编辑器 ────────────────────────────────────────

const TOC_LEVEL_CLASS = {
  1: '',
  2: styles.tocH2,
  3: styles.tocH3,
};

function ArticleEditor({
  token,
  path,
  draft,
  categories,
  pipeline,
  scrollRef,
  onSelect,
  onTreeChange,
  onDirtyChange,
  onDraftSaved,
  pv,
}) {
  const isNew = Boolean(draft);
  const activePath = draft?.path || path;
  // 私有模式：读写走加密外的私有接口（同一 token），保存即时生效、不等流水线

  const editorRef = useRef(null);
  const sourceRef = useRef(null);
  const [slots, setSlots] = useState({meta: null, actions: null});
  const [activeHead, setActiveHead] = useState(-1);
  const [showMeta, setShowMeta] = useState(false);
  const [meta, setMeta] = useState(null);

  const [loading, setLoading] = useState(!isNew);
  const [fm, setFm] = useState(draft?.fm || {});
  const [body, setBody] = useState(draft?.body || '');
  const [fileName, setFileName] = useState('');
  const [category, setCategory] = useState('');
  const [ext, setExt] = useState('.md');
  const [sourceMode, setSourceMode] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(isNew);

  const targetPath = `${category ? `${category}/` : ''}${fileName}${ext}`;
  const isMdx = ext === '.mdx';
  const toc = useMemo(() => parseToc(body), [body]);

  // 顶部栏插槽（portal 目标）
  useEffect(() => {
    setSlots({
      meta: document.getElementById('editor-meta-slot'),
      actions: document.getElementById('editor-actions-slot'),
    });
  }, []);

  // 初始化 / 切换文件
  useEffect(() => {
    if (isNew) {
      const {dir, name, ext: e} = splitPath(draft.path);
      setCategory(dir);
      setFileName(name);
      setExt(e);
      setFm(draft.fm || {});
      setBody(draft.body || '');
      setDirty(true);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setSourceMode(false);
    setConfirmDelete(false);
    setDirty(false);
    (pv ? pvReadDoc(activePath) : api(`/read?path=${encodeURIComponent(activePath)}`, {token}).then(({content}) => content))
      .then((content) => {
        if (cancelled) return;
        const {data, content: rest} = parseFrontMatter(content);
        const {dir, name, ext: e} = splitPath(activePath);
        setFm(data);
        setBody(rest);
        setCategory(dir);
        setFileName(name);
        setExt(e);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, token, isNew]);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  // 滚动时高亮当前锚点（仅富文本模式）
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el || isMdx || sourceMode) {
      setActiveHead(-1);
      return undefined;
    }
    const measure = () => {
      const ed = editorRef.current;
      if (!ed) return;
      const heads = ed.view.dom.querySelectorAll('h1, h2, h3');
      const base = el.getBoundingClientRect().top;
      let idx = -1;
      heads.forEach((h, i) => {
        if (h.getBoundingClientRect().top <= base + 80) idx = i;
      });
      setActiveHead(idx);
    };
    measure();
    el.addEventListener('scroll', measure, {passive: true});
    return () => el.removeEventListener('scroll', measure);
  }, [scrollRef, isMdx, sourceMode, activePath]);

  // 源码模式：textarea 随内容自动撑高，避免内部滚动条
  useEffect(() => {
    const ta = sourceRef.current;
    if (!ta || !(isMdx || sourceMode)) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }, [body, sourceMode, isMdx, loading]);

  // 元信息弹窗的 Esc 关闭由 Base UI Dialog 处理

  // 打开时基于当前状态生成草稿，仅“暂存”才写回
  const openMeta = () => {
    setMeta({fm: {...fm}, category, fileName, ext, message});
    setShowMeta(true);
  };

  const patchMeta = (patch) => setMeta((prev) => (prev ? {...prev, ...patch} : prev));

  const editMetaFm = (updater) => {
    setMeta((prev) => (prev ? {...prev, fm: updater(prev.fm)} : prev));
  };

  const stageMeta = () => {
    if (!meta) return;
    setDirty(true);
    setFm(meta.fm);
    setCategory(meta.category);
    setFileName(meta.fileName);
    setExt(meta.ext);
    setMessage(meta.message);
    setShowMeta(false);
  };

  const cancelMeta = () => setShowMeta(false);

  const jumpTo = (i) => {
    const item = toc[i];
    if (!item) return;
    if (isMdx || sourceMode) {
      // 源码模式：把光标移动到对应标题行
      const ta = sourceRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(item.offset, item.offset);
      return;
    }
    const ed = editorRef.current;
    if (!ed) return;
    const heads = ed.view.dom.querySelectorAll('h1, h2, h3');
    heads[i]?.scrollIntoView({behavior: 'smooth', block: 'start'});
    setActiveHead(i);
  };

  const save = async () => {
    setSaving(true);
    const content = serializeFrontMatter(fm, body.replace(/\s+$/, ''));
    if (pv) {
      // 私有文档：即时保存，不进 git、不触发构建
      try {
        if (!isNew && targetPath !== activePath) {
          await pvMoveDoc({path: activePath, newPath: targetPath, content});
        } else {
          await pvSaveDoc({path: targetPath, content});
        }
        setDirty(false);
        onTreeChange();
        toast.success('已保存');
        if (isNew) onDraftSaved(targetPath);
        else if (targetPath !== activePath) onSelect(targetPath);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setSaving(false);
      }
      return;
    }
    const msg = message.trim() || undefined;
    const payload = {content, message: msg};
    const res = await commitAndWait(pipeline.refresh, '提交中…', () =>
      !isNew && targetPath !== activePath
        ? api('/move', {method: 'POST', token, body: {path: activePath, new_path: targetPath, ...payload}})
        : api('/save', {method: 'POST', token, body: {path: targetPath, ...payload}}),
    );
    setSaving(false);
    if (!res) return;
    setDirty(false);
    onTreeChange();
    if (isNew) onDraftSaved(targetPath);
    else if (targetPath !== activePath) onSelect(targetPath);
  };

  const del = async () => {
    if (pv) {
      try {
        setSaving(true);
        await pvDeleteDoc(activePath);
        setConfirmDelete(false);
        setDirty(false);
        onTreeChange();
        onSelect(null);
        toast.success('已删除');
      } catch (err) {
        toast.error(err.message);
      } finally {
        setSaving(false);
      }
      return;
    }
    const res = await commitAndWait(pipeline.refresh, '删除中…', () =>
      api('/delete', {method: 'POST', token, body: {path: activePath, message: `docs: 在线编辑删除 ${activePath}`}}),
    );
    if (res) {
      setConfirmDelete(false);
      setDirty(false);
      onTreeChange();
      onSelect(null);
    }
  };

  if (loading) return <p className={styles.muted}>加载中…</p>;

  return (
    <>
      {slots.meta &&
        createPortal(
          <>
            <span className={styles.path} title={targetPath}>
              {targetPath}
            </span>
            {pv ? (
              <span className={`${styles.badge} ${styles.pvBadge}`}>🔒 私有</span>
            ) : (
              <span className={styles.badge}>{isMdx ? 'MDX' : sourceMode ? '源码' : '富文本'}</span>
            )}
            {dirty && <span className={styles.dirtyBadge}>未保存</span>}
          </>,
          slots.meta,
        )}
      {slots.actions &&
        createPortal(
          <>
            <button type="button" className={styles.barBtn} onClick={openMeta}>
              <IconSliders />
              元信息
            </button>
            {!isNew && !isMdx && (
              <button type="button" className={styles.barBtn} onClick={() => setSourceMode((v) => !v)}>
                <IconCode />
                {sourceMode ? '富文本' : '源码'}
              </button>
            )}
            {!isNew && (
              <button
                type="button"
                className={`${styles.barBtn} ${styles.barBtnDanger}`}
                onClick={() => setConfirmDelete(true)}>
                <IconTrash />
                删除
              </button>
            )}
            <button type="button" className={styles.barBtn} onClick={save} disabled={saving}>
              <IconPublish />
              {saving ? '处理中…' : isNew ? (pv ? '创建' : '创建并发布') : pv ? '保存' : '保存并发布'}
            </button>
          </>,
          slots.actions,
        )}

      {confirmDelete && (
        <div className={styles.confirm}>
          <span>
            确认删除 {activePath}？
            {pv ? '此操作会删除这篇私有文档。' : '此操作会立即推送并删除线上页面。'}
          </span>
          <button type="button" className={styles.btnDanger} onClick={del}>
            确认删除
          </button>
          <button type="button" className={styles.btn} onClick={() => setConfirmDelete(false)}>
            取消
          </button>
        </div>
      )}

      <div className={styles.editorRow}>
        <div className={styles.editorMain}>
          <div className={styles.editorArea}>
            {isMdx || sourceMode ? (
              <textarea
                ref={sourceRef}
                className={styles.source}
                value={body}
                onChange={(e) => {
                  setDirty(true);
                  setBody(e.target.value);
                }}
                spellCheck={false}
              />
            ) : (
              <TiptapBody
                key={activePath}
                editorRef={editorRef}
                initialMarkdown={body}
                onChange={(v) => {
                  setDirty(true);
                  setBody(v);
                }}
              />
            )}
          </div>
        </div>

        {toc.length > 0 && (
          <aside className={styles.tocPanel}>
            <div className={styles.tocTitle}>锚点</div>
            <nav className={styles.toc}>
              {toc.map((h, i) => (
                <button
                  key={`${h.offset}-${i}`}
                  type="button"
                  className={`${styles.tocItem} ${TOC_LEVEL_CLASS[h.level]} ${
                    !(isMdx || sourceMode) && i === activeHead ? styles.tocActive : ''
                  }`}
                  onClick={() => jumpTo(i)}>
                  {h.text || '（空标题）'}
                </button>
              ))}
            </nav>
          </aside>
        )}
      </div>

      <Dialog.Root open={showMeta} onOpenChange={setShowMeta}>
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.modalBackdrop} />
          {meta && (
            <Dialog.Popup className={styles.modal} aria-label="文章信息">
              <div className={styles.modalHeader}>
                <Dialog.Title className={styles.modalTitle} render={<h3 />}>
                  文章信息
                </Dialog.Title>
                <Dialog.Close className={styles.modalClose} title="关闭（Esc）">
                  ×
                </Dialog.Close>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.locRow}>
                  <label>
                    <span>所属分类</span>
                    <CategorySelect
                      value={meta.category}
                      onChange={(v) => patchMeta({category: v})}
                      categories={categories}
                    />
                  </label>
                  <label>
                    <span>文件名</span>
                    <input
                      value={meta.fileName}
                      onChange={(e) => patchMeta({fileName: e.target.value.trim()})}
                      placeholder="english-lowercase-hyphen"
                    />
                  </label>
                  <label>
                    <span>格式</span>
                    <Select.Root value={meta.ext} onValueChange={(v) => patchMeta({ext: v})}>
                      <Select.Trigger className={styles.selectTrigger}>
                        <Select.Value />
                        <Select.Icon className={styles.selectIcon}>
                          <IconChevronDown />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Positioner
                          className={styles.selectPositioner}
                          sideOffset={4}
                          alignItemWithTrigger={false}>
                          <Select.Popup className={styles.selectPopup}>
                            {['.md', '.mdx'].map((v) => (
                              <Select.Item key={v} value={v} className={styles.selectItem}>
                                <Select.ItemIndicator className={styles.selectItemIndicator}>
                                  <IconCheck />
                                </Select.ItemIndicator>
                                <Select.ItemText className={styles.selectItemText}>
                                  {v}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Popup>
                        </Select.Positioner>
                      </Select.Portal>
                    </Select.Root>
                  </label>
                </div>
                <MetaForm fm={meta.fm} setFm={editMetaFm} />
                {!pv && (
                  <label className={styles.msgField}>
                    <span>提交信息（可选）</span>
                    <input
                      value={meta.message}
                      onChange={(e) => patchMeta({message: e.target.value})}
                      placeholder="默认：docs: 在线编辑更新 <路径>"
                    />
                  </label>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btn} onClick={cancelMeta}>
                  取消
                </button>
                <button type="button" className={styles.btnPrimary} onClick={stageMeta}>
                  暂存
                </button>
              </div>
            </Dialog.Popup>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// ── 分类下拉（Base UI）──────────────────────────────

function CategorySelect({value, onChange, categories, rootLabel = '（根目录）'}) {
  const ROOT = '__root__';
  return (
    <Select.Root value={value || ROOT} onValueChange={(v) => onChange(v === ROOT ? '' : v)}>
      <Select.Trigger className={styles.selectTrigger}>
        <Select.Value>
          {(v) => (v === ROOT ? rootLabel : categories.find((c) => c.path === v)?.label ?? v)}
        </Select.Value>
        <Select.Icon className={styles.selectIcon}>
          <IconChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className={styles.selectPositioner} sideOffset={4} alignItemWithTrigger={false}>
          <Select.Popup className={styles.selectPopup}>
            <Select.Item value={ROOT} className={styles.selectItem}>
              <Select.ItemIndicator className={styles.selectItemIndicator}>
                <IconCheck />
              </Select.ItemIndicator>
              <Select.ItemText className={styles.selectItemText}>{rootLabel}</Select.ItemText>
            </Select.Item>
            {categories.map((c) => (
              <Select.Item key={c.path} value={c.path} className={styles.selectItem}>
                <Select.ItemIndicator className={styles.selectItemIndicator}>
                  <IconCheck />
                </Select.ItemIndicator>
                <Select.ItemText className={styles.selectItemText}>
                  <span style={{paddingLeft: c.depth * 12}}>{c.label}</span>
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

// ── 新建文章（只产生草稿，不提交）─────────────────────

function NewArticle({categories, onCreate, onCancel, isPrivate}) {
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [category, setCategory] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const name = slugify(fileName || title);
    const path = `${category ? `${category}/` : ''}${name}.md`;
    const fm = {
      title: title.trim() || undefined,
    };
    onCreate({path, fm, body: `# ${title.trim() || name}\n\n`});
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <h2>新建文章{isPrivate ? '（私有）' : ''}</h2>
      <p className={styles.muted}>
        此步骤只在本地生成草稿，{isPrivate ? '点「创建」后即时保存，不触发构建。' : '点「创建并发布」后才会提交。'}
      </p>
      <label>
        <span>标题</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label>
        <span>文件名（英文小写加连字符，留空按标题生成）</span>
        <input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="my-new-post" />
      </label>
      <label>
        <span>所属分类</span>
        <CategorySelect value={category} onChange={setCategory} categories={categories} />
      </label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary}>
          开始编辑
        </button>
        <button type="button" className={styles.btn} onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

// ── 新建分类（直接创建并触发部署）────────────────────

function NewCategory({categories, onCreate, onCancel, isPrivate}) {
  const [parent, setParent] = useState('');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (saving || !name.trim()) return;
    const dir = slugify(name);
    setSaving(true);
    const ok = await onCreate({
      path: `${parent ? `${parent}/` : ''}${dir}`,
      label: label.trim() || dir,
      description: description.trim(),
    });
    setSaving(false);
    if (ok) onCancel();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <h2>新建分类{isPrivate ? '（私有）' : ''}</h2>
      <p className={styles.muted}>{isPrivate ? '保存后立即生效，不触发构建。' : '保存后立即提交并触发构建部署。'}</p>
      <label>
        <span>上级分类</span>
        <CategorySelect value={parent} onChange={setParent} categories={categories} rootLabel="（顶层）" />
      </label>
      <label>
        <span>目录名（英文小写加连字符）</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="advanced" />
      </label>
      <label>
        <span>显示名称 label</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="进阶" />
      </label>
      <label>
        <span>分类页描述（可选）</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={!name.trim() || saving}>
          {saving ? '创建中…' : isPrivate ? '保存' : '保存并发布'}
        </button>
        <button type="button" className={styles.btn} onClick={onCancel} disabled={saving}>
          取消
        </button>
      </div>
    </form>
  );
}

// ── 排序管理：目录树 ⇄ 容器画布 ─────────────────────

// TOP/BOTTOM：分类容器内第一个/最后一个卡片相对容器内壁的留白。
const BOARD = {
  CARD_W: 220,
  CARD_H: 44,
  MIN_W: 244,
  MIN_H: 120,
  HEADER: 42,
  PAD: 12,
  TOP: 12,
  BOTTOM: 12,
  GAP: 8,
  COL_GAP: 36,
};

// 只保留分类目录与 .md/.mdx 文档；图片等 colocated 资源不入画布，由后端随目录一起搬。
function filterReorderNodes(nodes) {
  const out = [];
  for (const n of nodes || []) {
    if (n.is_dir) {
      out.push({...n, children: filterReorderNodes(n.children)});
    } else if (/\.mdx?$/i.test(n.path)) {
      out.push({...n, children: undefined});
    }
  }
  return out;
}

// 只上报「结构 + 原路径」，position 由后端按画布顺序计算。
function serializeReorderTree(nodes) {
  return (nodes || []).map((n) =>
    n.is_dir
      ? {path: n.path, is_dir: true, children: serializeReorderTree(n.children)}
      : {path: n.path, is_dir: false},
  );
}

// 目录树 → 扁平条目 {id,label,isDir,parentId}。
function flattenBoard(tree) {
  const items = [];
  const walk = (list, parentId) => {
    for (const n of list || []) {
      items.push({
        id: n.path,
        label: n.label || n.title || n.name || n.path,
        isDir: !!n.is_dir,
        parentId,
      });
      if (n.is_dir) walk(n.children, n.path);
    }
  };
  walk(tree, null);
  return items;
}

// 自底向上算每个分类容器的最小尺寸。
function boardSizes(items) {
  const kidsOf = (pid) => items.filter((it) => it.parentId === pid);
  const size = new Map();
  const calc = (it) => {
    if (size.has(it.id)) return size.get(it.id);
    let s;
    if (!it.isDir) {
      s = {w: BOARD.CARD_W, h: BOARD.CARD_H};
    } else {
      let y = BOARD.HEADER + BOARD.TOP;
      let bottom = y;
      let w = 0;
      for (const k of kidsOf(it.id)) {
        const ks = calc(k);
        w = Math.max(w, ks.w);
        y += ks.h + BOARD.GAP;
        bottom = y - BOARD.GAP;
      }
      s = {
        w: Math.max(BOARD.MIN_W, w + 2 * BOARD.PAD),
        h: Math.max(BOARD.MIN_H, bottom + BOARD.BOTTOM),
      };
    }
    size.set(it.id, s);
    return s;
  };
  for (const it of items) calc(it);
  return {kidsOf, size};
}

// 条目列表 → React Flow 节点（分类作为父节点，子节点相对父节点定位）。
function itemsToNodes(items) {
  const {kidsOf, size} = boardSizes(items);
  const nodes = [];
  const emit = (it, pos, parentId) => {
    const s = size.get(it.id);
    nodes.push({
      id: it.id,
      type: it.isDir ? 'category' : 'doc',
      position: pos,
      ...(parentId ? {parentId} : {}),
      data: {label: it.label, isDir: it.isDir},
      style: {width: s.w, height: s.h},
    });
    if (it.isDir) {
      let y = BOARD.HEADER + BOARD.TOP;
      for (const k of kidsOf(it.id)) {
        emit(k, {x: BOARD.PAD, y}, it.id);
        y += size.get(k.id).h + BOARD.GAP;
      }
    }
  };
  let x = 0;
  for (const it of kidsOf(null)) {
    emit(it, {x, y: 0}, null);
    x += size.get(it.id).w + BOARD.COL_GAP;
  }
  return nodes;
}

function treeToBoard(tree) {
  return itemsToNodes(flattenBoard(tree));
}

// 画布节点 → 目录树（同级按从上到下、再从左到右）。
function flowToTree(nodes) {
  const byParent = new Map();
  for (const n of nodes) {
    const p = n.parentId || '';
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(n);
  }
  const build = (pid) =>
    (byParent.get(pid) || [])
      .slice()
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      .map((n) =>
        n.data.isDir
          ? {path: n.id, is_dir: true, children: build(n.id)}
          : {path: n.id, is_dir: false},
      );
  return build('');
}

function nodeAbsPos(nodes, node) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let x = node.position.x;
  let y = node.position.y;
  let pid = node.parentId;
  while (pid) {
    const p = byId.get(pid);
    if (!p) break;
    x += p.position.x;
    y += p.position.y;
    pid = p.parentId;
  }
  return {x, y};
}

function nodeBox(node) {
  const w = node.style?.width ?? node.measured?.width ?? BOARD.CARD_W;
  const h = node.style?.height ?? node.measured?.height ?? BOARD.CARD_H;
  return {w, h};
}

// React Flow 的 onNodeDrag/onNodeDragStop 第三个参数只含「当前被拖拽的节点」，
// 因此这里把拖拽中的最新位置合并回全量节点列表，供落点计算与重排使用。
function mergeDraggedNodes(list, node) {
  const i = list.findIndex((n) => n.id === node.id);
  if (i === -1) return list;
  const next = list.slice();
  next[i] = {...next[i], position: node.position, dragging: node.dragging};
  return next;
}

function isAncestor(nodes, ancestorId, id) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cur = byId.get(id);
  while (cur && cur.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
}

// 找出包含某点、层级最深的分类容器（排除自身及其后代）。
function deepestContainer(nodes, point, excludeId) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let best = null;
  let bestDepth = -1;
  for (const n of nodes) {
    if (!n.data.isDir || n.id === excludeId) continue;
    if (isAncestor(nodes, excludeId, n.id)) continue;
    const p = nodeAbsPos(nodes, n);
    const {w, h} = nodeBox(n);
    if (point.x < p.x || point.x > p.x + w || point.y < p.y || point.y > p.y + h) continue;
    let depth = 0;
    let pid = n.parentId;
    while (pid) {
      depth += 1;
      pid = byId.get(pid)?.parentId;
    }
    if (depth > bestDepth) {
      bestDepth = depth;
      best = n;
    }
  }
  return best;
}

// 拖拽态上下文：让自定义节点读取「当前拖拽项 / 当前落点」，
// 这样拖拽过程中不必逐帧重建节点 data，只重渲染消费该上下文的节点。
const SortDragContext = React.createContext({draggingId: null, dropTargetId: null});

// 分类容器节点。
function CategoryNode({id, data, selected, dragging}) {
  const {dropTargetId} = React.useContext(SortDragContext);
  const isDropTarget = dropTargetId === id;
  const cls = [
    styles.catBox,
    selected && styles.catBoxSelected,
    dragging && styles.catBoxDragging,
    isDropTarget && styles.catBoxDrop,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      <div className={styles.catHeader}>
        <IconFolderSmall />
        <span className={styles.catHeaderLabel}>{data.label}</span>
        {isDropTarget && <span className={styles.dropBadge}>松手放入</span>}
      </div>
    </div>
  );
}

// 文档卡片节点。
function DocNode({data, selected, dragging}) {
  const cls = [
    styles.docCard,
    selected && styles.docCardSelected,
    dragging && styles.docCardDragging,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      <IconFileSmall />
      <span className={styles.docCardLabel}>{data.label}</span>
      <span className={styles.docGrip}>
        <IconGrip />
      </span>
    </div>
  );
}

const BOARD_NODE_TYPES = {category: CategoryNode, doc: DocNode};

// 提交后轮询对应 commit 的 workflow，回调步骤：0 排队 / 1 构建 / 3 完成。
async function pollReorderBuild(refresh, commit, onStep) {
  const short = (commit || '').slice(0, 7);
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    const s = await refresh();
    const run = (s?.runs || []).find((x) => (x.head_sha || '').startsWith(short));
    if (run && run.status === 'completed') {
      onStep(3);
      return run.conclusion === 'success' ? 'success' : 'failure';
    }
    if (run && run.status === 'in_progress') onStep(1);
    else if (run && run.status === 'queued') onStep(0);
    else if (s?.busy) onStep(0);
    await sleep(4000);
  }
  return 'timeout';
}

// 三步骤进度条：排队 → 构建 → 完成（参考 Steward 的构建状态条）。
function BuildSteps({phase, activeStep, inline = false}) {
  if (phase === 'idle') return null;
  const labels = ['排队', '构建', '完成'];
  const stateOf = (i) => {
    if (phase === 'success') return 'done';
    if (phase === 'failure') return i === 1 ? 'fail' : i === 0 ? 'done' : 'pending';
    if (phase === 'timeout') return i <= activeStep ? 'done' : 'pending';
    if (i < activeStep) return 'done';
    if (i === activeStep) return 'active';
    return 'pending';
  };
  const cls = {
    done: styles.stepDone,
    active: styles.stepActive,
    pending: styles.stepPending,
    fail: styles.stepFail,
  };
  return (
    <div className={`${styles.steps} ${inline ? styles.stepsInline : ''}`}>
      {labels.map((label, i) => {
        const st = stateOf(i);
        return (
          <div key={label} className={styles.stepItem}>
            <span className={`${styles.stepDot} ${cls[st]}`}>
              {st === 'done' && <IconCheck />}
            </span>
            <span className={`${styles.stepLabel} ${st === 'active' ? styles.stepLabelActive : ''}`}>
              {label}
            </span>
            {i < labels.length - 1 && (
              <span
                className={`${styles.stepLine} ${
                  phase === 'success' || i < activeStep ? styles.stepLineDone : ''
                }`}
              />
            )}
          </div>
        );
      })}
      {!inline && (
        <span className={styles.stepNote}>
          {phase === 'success'
            ? '构建部署完成'
            : phase === 'failure'
              ? '构建或部署失败'
              : phase === 'timeout'
                ? '未在预期时间内检测到结束'
                : '构建部署中…'}
        </span>
      )}
    </div>
  );
}

// ── 排序管理模态框 ───────────────────────────────────

function SortManager({open, tree, token, pipeline, onTreeChange, onClose}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const originalRef = useRef([]);
  const flowRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [dragState, setDragState] = useState({draggingId: null, dropTargetId: null});
  const [phase, setPhase] = useState('idle');
  const [activeStep, setActiveStep] = useState(0);

  const treeRef = useRef(tree);
  treeRef.current = tree;

  // 每次打开都从最新目录树重新构建画布，避免构建完成后被父级刷新打断。
  useEffect(() => {
    if (!open) return undefined;
    const filtered = filterReorderNodes(treeRef.current);
    setNodes(treeToBoard(filtered));
    originalRef.current = serializeReorderTree(filtered);
    setSaving(false);
    setDragState({draggingId: null, dropTargetId: null});
    setPhase('idle');
    setActiveStep(0);
    const timer = window.setTimeout(
      () => flowRef.current?.fitView({padding: 0.2, duration: 300}),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [open, setNodes]);

  const currentTree = useMemo(() => flowToTree(nodes), [nodes]);
  const dirty = useMemo(
    () => JSON.stringify(currentTree) !== JSON.stringify(originalRef.current),
    [currentTree],
  );
  const running = phase === 'running';

  // 当前落点容器名，用于顶部拖拽提示。
  const dropTargetLabel = useMemo(() => {
    if (!dragState.dropTargetId) return null;
    return nodes.find((n) => n.id === dragState.dropTargetId)?.data?.label || null;
  }, [dragState.dropTargetId, nodes]);

  // 解析拖拽落点：返回被拖节点、其中心点、以及命中的最深分类容器 id。
  const resolveDrop = (allNodes, node) => {
    const dragged = allNodes.find((n) => n.id === node.id) || node;
    const abs = nodeAbsPos(allNodes, dragged);
    const {w, h} = nodeBox(dragged);
    const center = {x: abs.x + w / 2, y: abs.y + h / 2};
    const target = deepestContainer(allNodes, center, dragged.id);
    return {dragged, center, targetId: target ? target.id : null};
  };

  // 拖拽中实时高亮落点容器。
  const onNodeDragStart = (event, node) => {
    setDragState({draggingId: node.id, dropTargetId: null});
  };

  const onNodeDrag = (event, node) => {
    const {targetId} = resolveDrop(mergeDraggedNodes(nodes, node), node);
    setDragState((prev) =>
      prev.draggingId === node.id && prev.dropTargetId === targetId
        ? prev
        : {draggingId: node.id, dropTargetId: targetId},
    );
  };

  // 拖拽结束：按落点决定新的父容器与插入位置，然后整体重新排布（容器自适应大小）。
  const onNodeDragStop = (event, node) => {
    setDragState({draggingId: null, dropTargetId: null});
    const allNodes = mergeDraggedNodes(nodes, node);
    const {dragged, center, targetId} = resolveDrop(allNodes, node);

    const others = allNodes.filter((n) => n.id !== dragged.id);
    const byParent = new Map();
    for (const n of others) {
      const p = n.parentId || '';
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(n);
    }
    const absCache = new Map(others.map((n) => [n.id, nodeAbsPos(others, n)]));
    for (const list of byParent.values()) {
      list.sort(
        (a, b) =>
          absCache.get(a.id).y - absCache.get(b.id).y ||
          absCache.get(a.id).x - absCache.get(b.id).x,
      );
    }

    const list = byParent.get(targetId || '') || [];
    const useX = targetId === null;
    let index = list.length;
    for (let i = 0; i < list.length; i++) {
      const sAbs = absCache.get(list[i].id);
      const sBox = nodeBox(list[i]);
      const mid = useX ? sAbs.x + sBox.w / 2 : sAbs.y + sBox.h / 2;
      const at = useX ? center.x : center.y;
      if (at < mid) {
        index = i;
        break;
      }
    }
    list.splice(index, 0, dragged);
    byParent.set(targetId || '', list);

    const items = [];
    for (const l of byParent.values()) {
      for (const n of l) {
        items.push({
          id: n.id,
          label: n.data.label,
          isDir: !!n.data.isDir,
          parentId: n.id === dragged.id ? targetId : n.parentId || null,
        });
      }
    }
    setNodes(itemsToNodes(items));
  };

  const autoLayout = () => {
    setNodes(
      itemsToNodes(
        nodes.map((n) => ({
          id: n.id,
          label: n.data.label,
          isDir: !!n.data.isDir,
          parentId: n.parentId || null,
        })),
      ),
    );
    window.setTimeout(() => flowRef.current?.fitView({padding: 0.2, duration: 400}), 0);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (!(await ensureIdle(pipeline.refresh))) {
        setSaving(false);
        return;
      }
      const res = await api('/reorder', {
        method: 'POST',
        token,
        body: {tree: currentTree},
      });
      if (!res.commit) {
        toast('顺序没有变化');
        setSaving(false);
        return;
      }
      setPhase('running');
      setActiveStep(0);
      toast.success('已提交，等待构建部署');
      const outcome = await pollReorderBuild(pipeline.refresh, res.commit, setActiveStep);
      setSaving(false);
      if (outcome === 'success') {
        setPhase('success');
        setActiveStep(3);
        toast.success('构建部署完成 ✓');
        onTreeChange?.();
      } else if (outcome === 'failure') {
        setPhase('failure');
        toast.error('构建或部署失败，请查看 Steward');
      } else {
        setPhase('timeout');
        toast('已提交，未在预期时间内检测到流水线结束', {icon: 'ℹ️'});
      }
    } catch (err) {
      setSaving(false);
      toast.error(err.message);
    }
  };

  const handleOpenChange = (next) => {
    if (next || running || saving) return;
    onClose();
  };

  const hint =
    phase === 'idle'
      ? '把卡片/分类拖进目标分类框即可归入；松手后按视觉位置自动排布，顺序即站点顺序。'
      : phase === 'running'
        ? '正在构建部署，完成后可关闭。'
        : phase === 'success'
          ? '构建部署完成，可以关闭了。'
          : phase === 'failure'
            ? '构建或部署失败，请到 Steward 查看日志。'
            : '已提交，等待流水线完成。';

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange} disablePointerDismissal={running}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.modalBackdrop} />
        <Dialog.Popup className={`${styles.modal} ${styles.sortModal}`} aria-label="排序管理">
          <div className={styles.modalHeader}>
            <Dialog.Title className={styles.modalTitle} render={<h3 />}>
              排序管理
            </Dialog.Title>
            <Dialog.Close className={styles.modalClose} title="关闭（Esc）" disabled={running}>
              ×
            </Dialog.Close>
          </div>
          <BuildSteps phase={phase} activeStep={activeStep} />
          <div className={`${styles.flowWrap} ${dragState.draggingId ? styles.flowDragging : ''}`}>
            {dragState.draggingId && (
              <div className={styles.dragHint}>
                {dropTargetLabel ? (
                  <>
                    放入「<b>{dropTargetLabel}</b>」
                  </>
                ) : (
                  '松手放到顶层'
                )}
              </div>
            )}
            <SortDragContext.Provider value={dragState}>
              <ReactFlow
                nodes={nodes}
                nodeTypes={BOARD_NODE_TYPES}
                onInit={(instance) => {
                  flowRef.current = instance;
                }}
                onNodesChange={onNodesChange}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                nodeDragThreshold={4}
                nodesDraggable={!running}
                nodesConnectable={false}
                nodesFocusable={!running}
                deleteKeyCode={null}
                elevateNodesOnSelect
                fitView
                fitViewOptions={{padding: 0.2}}
                minZoom={0.2}
                maxZoom={1.6}>
                <Background variant="dots" gap={20} size={1} />
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </SortDragContext.Provider>
          </div>
          <div className={styles.sortFooter}>
            <span className={styles.sortHint}>{hint}</span>
            <div className={styles.formActions}>
              {phase === 'idle' ? (
                <>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={autoLayout}
                    disabled={saving || running}>
                    自动布局
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={onClose}
                    disabled={saving || running}>
                    取消
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={save}
                    disabled={!dirty || saving || running}>
                    {saving ? '提交中…' : '保存排序'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={onClose}
                  disabled={running}>
                  {running ? '构建中…' : '关闭'}
                </button>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── 主页面 ────────────────────────────────────────────

export default function EditorPage() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState(null);
  const [tree, setTree] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [mode, setMode] = useState('idle');
  const [refresh, setRefresh] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // 内层是否已隐藏并显示展开按钮：等宽度动画结束后再切换，避免动画中内容回流
  const [collapsedShown, setCollapsedShown] = useState(false);
  // 私有模式：侧边栏切到私有文档树，读写走私有接口（同一 token，无二次认证）
  const [privateMode, setPrivateMode] = useState(false);
  const [pvTree, setPvTree] = useState([]);
  const [pvRefresh, setPvRefresh] = useState(0);

  const mainRef = useRef(null);
  const pipeline = usePipeline(token);

  useEffect(() => {
    setMounted(true);
    setToken(sessionStorage.getItem('docs-editor-token'));
  }, []);

  // session 失效时自动退出登录，无需手动点退出。
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setSelected(null);
      setDraft(null);
      setMode('idle');
      setPrivateMode(false);
      toast.error('登录已失效，请重新登录');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  useEffect(() => {
    if (!collapsed) {
      setCollapsedShown(false);
      return;
    }
    // 关闭动画偏好下 transitionend 不会触发，直接切换
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCollapsedShown(true);
    }
  }, [collapsed]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    api('/tree', {token})
      .then((data) => {
        if (!cancelled) setTree(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.message);
      });
    pvFetchTree()
      .then((data) => {
        if (!cancelled) setPvTree(data || []);
      })
      .catch(() => {}); // 401 由事件统一处理，其余静默
    return () => {
      cancelled = true;
    };
  }, [token, refresh, pvRefresh]);

  const categories = useMemo(() => categoryOptions(tree), [tree]);
  const pvCategories = useMemo(() => categoryOptions(pvTree), [pvTree]);
  const reload = useCallback(() => setRefresh((v) => v + 1), []);
  const pvReload = useCallback(() => setPvRefresh((v) => v + 1), []);
  const handleDirty = useCallback((v) => setDirty(v), []);

  useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const exitEdit = () => {
    sessionStorage.removeItem('docs-editor-token');
    setToken(null);
    setSelected(null);
    setDraft(null);
    setPrivateMode(false);
  };

  const selectFile = (p) => {
    if (dirty && !window.confirm('有未保存的修改，确定要离开吗？')) return;
    setDraft(null);
    setMode('idle');
    setSelected(p);
  };

  const createCategory = async (cat) => {
    const res = await commitAndWait(pipeline.refresh, '创建分类…', () =>
      api('/category', {
        method: 'POST',
        token,
        body: {
          path: cat.path,
          label: cat.label,
          description: cat.description || '',
          message: `docs: 新增分类 ${cat.label}`,
        },
      }),
    );
    if (res) reload();
    return Boolean(res);
  };

  // 私有分类：即时创建，不进 git、不触发构建
  const createPrivateCategory = async (cat) => {
    try {
      await pvSaveCategory({path: cat.path, label: cat.label, description: cat.description});
      pvReload();
      toast.success('已创建');
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  // 切换公开 / 私有模式：同一 token，无需重新认证
  const togglePrivateMode = () => {
    if (dirty && !window.confirm('有未保存的修改，确定要切换吗？')) return;
    setDraft(null);
    setSelected(null);
    setMode('idle');
    setPrivateMode((v) => !v);
  };

  const startNew = (m) => {
    if (dirty && !window.confirm('有未保存的修改，确定要离开吗？')) return;
    setDraft(null);
    setSelected(null);
    setMode(m);
  };

  // 侧栏宽度动画结束后才隐藏内层、显示展开按钮（参考文档站 hideable sidebar）
  const handleSidebarTransitionEnd = (e) => {
    if (e.propertyName === 'width' && collapsed) setCollapsedShown(true);
  };

  return (
    <Layout title="在线编辑">
      <Toaster position="top-center" toastOptions={{duration: 4000}} />
      {!mounted ? null : !token ? (
        <Login onLogin={setToken} />
      ) : (
        <div className={styles.shell}>
          <div className={styles.body}>
            <aside
              className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
              onTransitionEnd={handleSidebarTransitionEnd}>
              <div
                className={`${styles.sidebarInner} ${
                  collapsedShown ? styles.sidebarInnerHidden : ''
                }`}>
                <div className={styles.sidebarScroll}>
                  {privateMode && (
                    <p className={styles.pvHeading}>🔒 私有文档</p>
                  )}
                  <FileTree
                    tree={privateMode ? pvTree : tree}
                    active={draft ? null : selected}
                    onSelect={selectFile}
                  />
                </div>
                <button
                  type="button"
                  className={`${styles.pvModeBtn} ${privateMode ? styles.pvModeBtnOn : ''}`}
                  onClick={togglePrivateMode}
                  title="切换私有模式（仅自己可见的私有文档，保存即时生效）"
                  aria-label="切换私有模式">
                  <IconLock />
                  <span>私有模式</span>
                </button>
                <button
                  type="button"
                  className={`button button--secondary button--outline ${styles.collapseBtn}`}
                  onClick={() => setCollapsed(true)}
                  title="收起侧边栏"
                  aria-label="收起侧边栏">
                  <IconArrow className={styles.collapseBtnIcon} />
                </button>
              </div>
              {collapsedShown && (
                <button
                  type="button"
                  className={styles.expandBtn}
                  onClick={() => setCollapsed(false)}
                  title="展开侧边栏"
                  aria-label="展开侧边栏">
                  <IconArrow className={styles.expandBtnIcon} />
                </button>
              )}
            </aside>

            <div className={styles.contentCol}>
              <header className={styles.subbar}>
                <span className={styles.brand}>在线编辑</span>
            <span id="editor-meta-slot" className={styles.metaSlot} />
            <TopBuildStatus pipeline={pipeline} />
            <div className={styles.spacer} />
            <div id="editor-actions-slot" className={styles.actionsSlot} />
            <span className={styles.subbarSep} />
            <button type="button" className={styles.barBtn} onClick={() => startNew('new-article')}>
              <IconNewFile />
              新建文章
            </button>
            <button type="button" className={styles.barBtn} onClick={() => startNew('new-category')}>
              <IconNewFolder />
              新建分类
            </button>
            {!privateMode && (
              <button type="button" className={styles.barBtn} onClick={() => setSortOpen(true)}>
                <IconSort />
                排序管理
              </button>
            )}
            <button type="button" className={styles.barBtn} onClick={exitEdit}>
              <IconLogout />
              退出
            </button>
              </header>

              <main className={styles.main} ref={mainRef}>
              {mode === 'new-article' ? (
                <NewArticle
                  categories={privateMode ? pvCategories : categories}
                  isPrivate={privateMode}
                  onCreate={(d) => {
                    setDraft(d);
                    setMode('idle');
                    setSelected(null);
                  }}
                  onCancel={() => setMode('idle')}
                />
              ) : mode === 'new-category' ? (
                <NewCategory
                  categories={privateMode ? pvCategories : categories}
                  isPrivate={privateMode}
                  onCreate={privateMode ? createPrivateCategory : createCategory}
                  onCancel={() => setMode('idle')}
                />
              ) : draft || selected ? (
                <ArticleEditor
                  key={draft ? `draft:${draft.path}` : selected}
                  token={token}
                  path={draft ? undefined : selected}
                  draft={draft}
                  categories={privateMode ? pvCategories : categories}
                  pipeline={pipeline}
                  scrollRef={mainRef}
                  pv={privateMode}
                  onSelect={(p) => {
                    setDraft(null);
                    setSelected(p);
                  }}
                  onTreeChange={privateMode ? pvReload : reload}
                  onDirtyChange={handleDirty}
                  onDraftSaved={(p) => {
                    setDraft(null);
                    setSelected(p);
                  }}
                />
              ) : (
                <p className={styles.placeholder}>
                  {privateMode
                    ? '从左侧选择一篇私有文档开始编辑，或点击上方「新建文章」。'
                    : '从左侧选择一篇文章开始编辑，或点击上方「新建文章」。'}
                </p>
              )}
              </main>
            </div>
          </div>
          <SortManager
            open={sortOpen}
            tree={tree}
            token={token}
            pipeline={pipeline}
            onTreeChange={reload}
            onClose={() => setSortOpen(false)}
          />
        </div>
      )}
    </Layout>
  );
}
