import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import Layout from '@theme/Layout';
import {EditorContent, useEditor, useEditorState} from '@tiptap/react';
import {StarterKit} from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';
import {TableKit} from '@tiptap/extension-table';
import {Image} from '@tiptap/extension-image';
import toast, {Toaster} from 'react-hot-toast';
import {Admonition} from '../theme/tiptap/admonition';
import styles from './editor.module.css';
import '../theme/tiptap/admonition.css';

// ── API ──────────────────────────────────────────────

const API = '/editor/api';

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
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
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

function categoryOptions(tree, pending) {
  const byPath = new Map();
  const walk = (nodes, depth) => {
    for (const n of nodes || []) {
      if (n.is_dir) {
        byPath.set(n.path, {path: n.path, label: n.label || n.name, depth, pending: false});
        walk(n.children, depth + 1);
      }
    }
  };
  walk(tree, 0);
  for (const p of pending || []) {
    if (!byPath.has(p.path)) {
      byPath.set(p.path, {
        path: p.path,
        label: p.label,
        depth: Math.max(0, p.path.split('/').length - 1),
        pending: true,
      });
    }
  }
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

const IconChevronLeft = () => (
  <Ic>
    <path d="m15 6-6 6 6 6" />
  </Ic>
);

const IconChevronRight = () => (
  <Ic>
    <path d="m9 6 6 6-6 6" />
  </Ic>
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

// 顶部栏流水线指示点：绿=成功 黄=运行中 红=失败 灰=未知。
function PipelineDot({pipeline}) {
  const {status, refresh} = pipeline;
  const latest = status?.latest;
  const busy = status?.busy;
  let cls = '';
  let label = '流水线状态未知';
  if (busy) {
    cls = styles.dotBusy;
    label = 'CI/CD 构建部署中…';
  } else if (latest?.status === 'completed' && latest.conclusion === 'success') {
    cls = styles.dotOk;
    label = '最近一次构建部署成功';
  } else if (latest?.status === 'completed') {
    cls = styles.dotFail;
    label = `最近一次构建失败（${latest.conclusion || 'unknown'}）`;
  } else if (latest) {
    label = `最近一次：${latest.status}`;
  }
  if (latest?.html_url) {
    return (
      <a
        className={`${styles.pipeDotWrap} ${cls}`}
        href={latest.html_url}
        target="_blank"
        rel="noreferrer"
        title={`${label}（查看日志）`}>
        <span className={styles.pipeDot} />
      </a>
    );
  }
  return (
    <button
      type="button"
      className={`${styles.pipeDotWrap} ${cls}`}
      title={`${label}（点击刷新）`}
      onClick={refresh}>
      <span className={styles.pipeDot} />
    </button>
  );
}

// ── 登录 ──────────────────────────────────────────────

function Login({onLogin}) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {token} = await api('/unlock', {method: 'POST', body: {key}});
      sessionStorage.setItem('docs-editor-token', token);
      onLogin(token);
      toast.success('已进入');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setKey('');
    }
  };

  return (
    <div className={styles.loginWrap}>
      <div className={styles.login}>
        <h1 className={styles.loginTitle}>在线编辑</h1>
        <form className={styles.loginForm} onSubmit={submit}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="密钥"
            autoFocus
          />
          <button type="submit" className={styles.loginBtn} disabled={loading || !key}>
            <span>{loading ? '进入中…' : '进入'}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2 8h11M9 3.5 13.5 8 9 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

// ── 文件树 ────────────────────────────────────────────

function FileTree({tree, active, onSelect}) {
  const renderNode = (node, depth) => {
    const indent = {paddingLeft: `${0.75 + depth * 0.9}rem`};
    if (node.is_dir) {
      return (
        <details key={node.path} className={styles.dir} open>
          <summary style={indent}>
            {node.label || node.name}
            <span className={styles.catTag}>分类</span>
          </summary>
          {(node.children || []).map((c) => renderNode(c, depth + 1))}
        </details>
      );
    }
    return (
      <button
        key={node.path}
        type="button"
        style={indent}
        className={`${styles.file} ${active === node.path ? styles.active : ''}`}
        onClick={() => onSelect(node.path)}>
        {node.title || node.name}
      </button>
    );
  };

  if (tree.length === 0) return <p className={styles.muted}>还没有文档</p>;
  return <div className={styles.tree}>{tree.map((n) => renderNode(n, 0))}</div>;
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

function MetaForm({fm, setFm}) {
  const setField = (key, value) => {
    setFm((prev) => {
      const next = {...prev};
      if (value === '' || value == null) delete next[key];
      else next[key] = value;
      return next;
    });
  };
  const tags = fm.tags;
  return (
    <div className={styles.metaGrid}>
      <label>
        <span>标题 title（留空则用正文 H1）</span>
        <input value={fm.title ?? ''} onChange={(e) => setField('title', e.target.value)} />
      </label>
      <label>
        <span>排序 sidebar_position</span>
        <input
          type="number"
          value={fm.sidebar_position ?? ''}
          onChange={(e) =>
            setField('sidebar_position', e.target.value === '' ? '' : Number(e.target.value))
          }
        />
      </label>
      <label>
        <span>描述 description</span>
        <textarea
          rows={2}
          value={fm.description ?? ''}
          onChange={(e) => setField('description', e.target.value)}
        />
      </label>
      <label>
        <span>标签 tags（逗号分隔）</span>
        <input
          value={Array.isArray(tags) ? tags.join(', ') : tags ?? ''}
          onChange={(e) =>
            setField(
              'tags',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
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
  pendingCategories,
  pipeline,
  scrollRef,
  onSelect,
  onTreeChange,
  onDirtyChange,
  onCategoryBundled,
  onDraftSaved,
}) {
  const isNew = Boolean(draft);
  const activePath = draft?.path || path;

  const editorRef = useRef(null);
  const sourceRef = useRef(null);
  const [slots, setSlots] = useState({meta: null, actions: null});
  const [activeHead, setActiveHead] = useState(-1);

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
  const pendingMeta = (pendingCategories || []).find((p) => p.path === category) || null;
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
    api(`/read?path=${encodeURIComponent(activePath)}`, {token})
      .then(({content}) => {
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

  const editFm = (updater) => {
    setDirty(true);
    setFm(updater);
  };

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
    const cat = pendingMeta
      ? {
          label: pendingMeta.label,
          position: pendingMeta.position ?? null,
          description: pendingMeta.description || '',
        }
      : undefined;
    const msg = message.trim() || undefined;
    const payload = {content, category: cat, message: msg};
    const res = await commitAndWait(pipeline.refresh, '提交中…', () =>
      !isNew && targetPath !== activePath
        ? api('/move', {method: 'POST', token, body: {path: activePath, new_path: targetPath, ...payload}})
        : api('/save', {method: 'POST', token, body: {path: targetPath, ...payload}}),
    );
    setSaving(false);
    if (!res) return;
    if (cat) onCategoryBundled?.(category);
    setDirty(false);
    onTreeChange();
    if (isNew) onDraftSaved(targetPath);
    else if (targetPath !== activePath) onSelect(targetPath);
  };

  const del = async () => {
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
            <span className={styles.badge}>{isMdx ? 'MDX' : sourceMode ? '源码' : '富文本'}</span>
            {dirty && <span className={styles.dirtyBadge}>未保存</span>}
          </>,
          slots.meta,
        )}
      {slots.actions &&
        createPortal(
          <>
            {!isNew && !isMdx && (
              <button type="button" className={styles.btn} onClick={() => setSourceMode((v) => !v)}>
                {sourceMode ? '富文本' : '源码'}
              </button>
            )}
            {!isNew && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => setConfirmDelete(true)}>
                删除
              </button>
            )}
            <button type="button" className={styles.btnPrimary} onClick={save} disabled={saving}>
              {saving ? '处理中…' : isNew ? '创建并发布' : '保存并发布'}
            </button>
          </>,
          slots.actions,
        )}

      {confirmDelete && (
        <div className={styles.confirm}>
          <span>确认删除 {activePath}？此操作会立即推送并删除线上页面。</span>
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

        <aside className={styles.metaPanel}>
          {toc.length > 0 && (
            <section className={styles.metaSection}>
              <h3>锚点</h3>
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
            </section>
          )}

          <section className={styles.metaSection}>
            <h3>文章信息</h3>
            <div className={styles.locRow}>
              <label>
                <span>所属分类</span>
                <select
                  value={category}
                  onChange={(e) => {
                    setDirty(true);
                    setCategory(e.target.value);
                  }}>
                  <option value="">（根目录）</option>
                  {categories.map((c) => (
                    <option key={c.path} value={c.path}>
                      {'\u00A0'.repeat(c.depth * 2)}
                      {c.label}
                      {c.pending ? '（待创建）' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>文件名</span>
                <input
                  value={fileName}
                  onChange={(e) => {
                    setDirty(true);
                    setFileName(e.target.value.trim());
                  }}
                  placeholder="english-lowercase-hyphen"
                />
              </label>
              <label>
                <span>格式</span>
                <select
                  value={ext}
                  onChange={(e) => {
                    setDirty(true);
                    setExt(e.target.value);
                  }}>
                  <option value=".md">.md</option>
                  <option value=".mdx">.mdx</option>
                </select>
              </label>
            </div>
            <MetaForm fm={fm} setFm={editFm} />
            <label className={styles.msgField}>
              <span>提交信息（可选）</span>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="默认：docs: 在线编辑更新 <路径>"
              />
            </label>
          </section>
        </aside>
      </div>
    </>
  );
}

// ── 新建文章（只产生草稿，不提交）─────────────────────

function NewArticle({categories, onCreate, onCancel}) {
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [category, setCategory] = useState('');
  const [position, setPosition] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const name = slugify(fileName || title);
    const path = `${category ? `${category}/` : ''}${name}.md`;
    const fm = {
      title: title.trim() || undefined,
      sidebar_position: position === '' ? undefined : Number(position),
    };
    onCreate({path, fm, body: `# ${title.trim() || name}\n\n`});
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <h2>新建文章</h2>
      <p className={styles.muted}>此步骤只在本地生成草稿，点「创建并发布」后才会提交。</p>
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
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">（根目录）</option>
          {categories.map((c) => (
            <option key={c.path} value={c.path}>
              {'\u00A0'.repeat(c.depth * 2)}
              {c.label}
              {c.pending ? '（待创建）' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>排序 sidebar_position</span>
        <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} />
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

// ── 新建分类（先暂存，保存文章时创建）────────────────

function NewCategory({categories, onCreate, onCancel}) {
  const [parent, setParent] = useState('');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [position, setPosition] = useState('');
  const [description, setDescription] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const dir = slugify(name);
    onCreate({
      path: `${parent ? `${parent}/` : ''}${dir}`,
      label: label.trim() || dir,
      position: position === '' ? null : Number(position),
      description: description.trim(),
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <h2>新建分类</h2>
      <p className={styles.muted}>
        分类先暂存，保存文章到该分类时会一并创建（同一个提交）；也可在左侧「待创建分类」里立即创建。
      </p>
      <label>
        <span>上级分类</span>
        <select value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">（顶层）</option>
          {categories.map((c) => (
            <option key={c.path} value={c.path}>
              {'\u00A0'.repeat(c.depth * 2)}
              {c.label}
            </option>
          ))}
        </select>
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
        <span>排序 position</span>
        <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} />
      </label>
      <label>
        <span>分类页描述（可选）</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={!name}>
          暂存分类
        </button>
        <button type="button" className={styles.btn} onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

// ── 主页面 ────────────────────────────────────────────

export default function EditorPage() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState(null);
  const [tree, setTree] = useState([]);
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [mode, setMode] = useState('idle');
  const [refresh, setRefresh] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const mainRef = useRef(null);
  const pipeline = usePipeline(token);

  useEffect(() => {
    setMounted(true);
    setToken(sessionStorage.getItem('docs-editor-token'));
  }, []);

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
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  const categories = useMemo(() => categoryOptions(tree, pending), [tree, pending]);
  const reload = useCallback(() => setRefresh((v) => v + 1), []);
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
  };

  const selectFile = (p) => {
    if (dirty && !window.confirm('有未保存的修改，确定要离开吗？')) return;
    setDraft(null);
    setMode('idle');
    setSelected(p);
  };

  const addPending = (cat) => {
    setPending((prev) => [...prev.filter((p) => p.path !== cat.path), cat]);
    setMode('idle');
    toast.success(`分类「${cat.label}」已暂存，保存文章时创建`);
  };

  const createCategoryNow = async (cat) => {
    const res = await commitAndWait(pipeline.refresh, '创建分类…', () =>
      api('/category', {
        method: 'POST',
        token,
        body: {
          path: cat.path,
          label: cat.label,
          position: cat.position ?? null,
          description: cat.description || '',
          message: `docs: 新增分类 ${cat.label}`,
        },
      }),
    );
    if (res) {
      setPending((prev) => prev.filter((p) => p.path !== cat.path));
      reload();
    }
  };

  const startNew = (m) => {
    if (dirty && !window.confirm('有未保存的修改，确定要离开吗？')) return;
    setDraft(null);
    setSelected(null);
    setMode(m);
  };

  return (
    <Layout title="在线编辑">
      <Toaster position="top-center" toastOptions={{duration: 4000}} />
      {!mounted ? null : !token ? (
        <Login onLogin={setToken} />
      ) : (
        <div className={styles.shell}>
          <div className={styles.body}>
            <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
              <div className={styles.sidebarScroll}>
                {pending.length > 0 && (
                  <div className={styles.pendingBox}>
                    <div className={styles.pendingTitle}>待创建分类</div>
                    {pending.map((p) => (
                      <div key={p.path} className={styles.pendingItem}>
                        <span>{p.label}</span>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => createCategoryNow(p)}>
                          立即创建
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FileTree tree={tree} active={draft ? null : selected} onSelect={selectFile} />
              </div>
              <button
                type="button"
                className={styles.collapseBtn}
                onClick={() => setCollapsed(true)}
                title="收起侧边栏">
                <IconChevronLeft />
                收起侧边栏
              </button>
            </aside>

            <div className={styles.contentCol}>
              <header className={styles.subbar}>
                <span className={styles.brand}>在线编辑</span>
            <span id="editor-meta-slot" className={styles.metaSlot} />
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
            <PipelineDot pipeline={pipeline} />
            <button type="button" className={styles.barBtn} onClick={exitEdit}>
              <IconLogout />
              退出
            </button>
              </header>

              <main className={styles.main} ref={mainRef}>
              {mode === 'new-article' ? (
                <NewArticle
                  categories={categories}
                  onCreate={(d) => {
                    setDraft(d);
                    setMode('idle');
                    setSelected(null);
                  }}
                  onCancel={() => setMode('idle')}
                />
              ) : mode === 'new-category' ? (
                <NewCategory
                  categories={categories}
                  onCreate={addPending}
                  onCancel={() => setMode('idle')}
                />
              ) : draft || selected ? (
                <ArticleEditor
                  key={draft ? `draft:${draft.path}` : selected}
                  token={token}
                  path={draft ? undefined : selected}
                  draft={draft}
                  categories={categories}
                  pendingCategories={pending}
                  pipeline={pipeline}
                  scrollRef={mainRef}
                  onSelect={(p) => {
                    setDraft(null);
                    setSelected(p);
                  }}
                  onTreeChange={reload}
                  onDirtyChange={handleDirty}
                  onCategoryBundled={(p) => setPending((prev) => prev.filter((x) => x.path !== p))}
                  onDraftSaved={(p) => {
                    setDraft(null);
                    setSelected(p);
                  }}
                />
              ) : (
                <p className={styles.placeholder}>从左侧选择一篇文章开始编辑，或点击上方「新建文章」。</p>
              )}
              </main>
            </div>
          </div>
          {collapsed && (
            <button
              type="button"
              className={styles.expandBtn}
              onClick={() => setCollapsed(false)}
              title="展开侧边栏">
              <IconChevronRight />
            </button>
          )}
        </div>
      )}
    </Layout>
  );
}
