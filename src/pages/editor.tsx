import React, {useCallback, useEffect, useMemo, useState} from 'react';
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

// ── 流水线状态条 ──────────────────────────────────────

function PipelineBar({pipeline}) {
  const {status, refresh} = pipeline;
  const latest = status?.latest;
  const busy = status?.busy;
  let text = '流水线状态未知';
  let cls = styles.pipeIdle;
  if (busy) {
    text = 'CI/CD 构建部署中…';
    cls = styles.pipeBusy;
  } else if (latest) {
    if (latest.status === 'completed' && latest.conclusion === 'success') {
      text = '最近一次构建部署成功';
      cls = styles.pipeOk;
    } else if (latest.status === 'completed') {
      text = `最近一次构建失败（${latest.conclusion || 'unknown'}）`;
      cls = styles.pipeFail;
    } else {
      text = `最近一次：${latest.status}`;
    }
  }
  return (
    <div className={`${styles.pipe} ${cls}`}>
      <span className={styles.pipeDot} />
      <span>{text}</span>
      {latest?.html_url && (
        <a href={latest.html_url} target="_blank" rel="noreferrer">
          日志
        </a>
      )}
      <button type="button" className={styles.linkBtn} onClick={refresh}>
        刷新
      </button>
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

function TiptapBody({initialMarkdown, onChange}) {
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
      <label className={styles.metaWide}>
        <span>描述 description</span>
        <textarea
          rows={2}
          value={fm.description ?? ''}
          onChange={(e) => setField('description', e.target.value)}
        />
      </label>
      <label className={styles.metaWide}>
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

function ArticleEditor({
  token,
  path,
  draft,
  categories,
  pendingCategories,
  pipeline,
  onSelect,
  onTreeChange,
  onDirtyChange,
  onCategoryBundled,
  onDraftSaved,
}) {
  const isNew = Boolean(draft);
  const activePath = draft?.path || path;

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

  const editFm = (updater) => {
    setDirty(true);
    setFm(updater);
  };
  const targetPath = `${category ? `${category}/` : ''}${fileName}${ext}`;
  const isMdx = ext === '.mdx';
  const pendingMeta = (pendingCategories || []).find((p) => p.path === category) || null;

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
    <div className={styles.article}>
      <div className={styles.topbar}>
        <span className={styles.path}>{activePath}</span>
        <span className={styles.badge}>{isMdx ? 'MDX' : sourceMode ? '源码' : '富文本'}</span>
        {dirty && <span className={styles.dirtyBadge}>未保存</span>}
        <div className={styles.spacer} />
        {!isNew && (
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
      </div>

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

      <details className={styles.panel} open>
        <summary>文章信息（分类 / 排序 / 元信息）</summary>
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
      </details>

      <div className={styles.editorArea}>
        {isMdx || sourceMode ? (
          <textarea
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
            initialMarkdown={body}
            onChange={(v) => {
              setDirty(true);
              setBody(v);
            }}
          />
        )}
      </div>
    </div>
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

  const lock = () => {
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

  return (
    <Layout title="在线编辑">
      <Toaster position="top-center" toastOptions={{duration: 4000}} />
      {!mounted ? null : !token ? (
        <Login onLogin={setToken} />
      ) : (
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <strong>在线编辑</strong>
              <button type="button" className={styles.btn} onClick={lock}>
                退出
              </button>
            </div>
            <PipelineBar pipeline={pipeline} />
            <div className={styles.sideActions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  if (dirty && !window.confirm('有未保存的修改，确定要离开吗？')) return;
                  setDraft(null);
                  setSelected(null);
                  setMode('new-article');
                }}>
                ＋ 新建文章
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  if (dirty && !window.confirm('有未保存的修改，确定要离开吗？')) return;
                  setDraft(null);
                  setSelected(null);
                  setMode('new-category');
                }}>
                ＋ 新建分类
              </button>
            </div>

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

            <FileTree
              tree={tree}
              active={draft ? null : selected}
              onSelect={selectFile}
            />
          </aside>

          <main className={styles.main}>
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
              <p className={styles.placeholder}>从左侧选择一篇文章，或新建文章 / 分类。</p>
            )}
          </main>
        </div>
      )}
    </Layout>
  );
}
