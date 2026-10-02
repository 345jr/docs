import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import {EditorContent, useEditor, useEditorState} from '@tiptap/react';
import {StarterKit} from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';
import {TableKit} from '@tiptap/extension-table';
import {Image} from '@tiptap/extension-image';
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
  const keys = Object.keys(data).filter(
    (k) => data[k] !== '' && data[k] != null,
  );
  if (keys.length === 0) return content;
  const lines = ['---'];
  for (const k of keys) lines.push(`${k}: ${formatYamlValue(data[k])}`);
  return [...lines, '---', '', content].join('\n');
}

// ── 路径工具 ──────────────────────────────────────────

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

// ── 解锁 ──────────────────────────────────────────────

function Unlock({onUnlock}) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const {token} = await api('/unlock', {method: 'POST', body: {key}});
      sessionStorage.setItem('docs-editor-token', token);
      onUnlock(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setKey('');
    }
  };

  return (
    <div className={styles.unlockWrap}>
      <form className={styles.unlock} onSubmit={submit}>
        <h2>解锁在线编辑</h2>
        <p className={styles.unlockHint}>
          输入解锁密钥进入编辑专区，密钥只在本次会话生效。
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="解锁密钥"
          autoFocus
        />
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" disabled={loading || !key}>
          {loading ? '解锁中…' : '解锁'}
        </button>
      </form>
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

function ArticleEditor({token, path, categories, onSelect, onTreeChange}) {
  const [loading, setLoading] = useState(true);
  const [fm, setFm] = useState({});
  const [body, setBody] = useState('');
  const [fileName, setFileName] = useState('');
  const [category, setCategory] = useState('');
  const [ext, setExt] = useState('.md');
  const [sourceMode, setSourceMode] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const originalContent = useRef('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setStatus('');
    setConfirmDelete(false);
    setSourceMode(false);
    api(`/read?path=${encodeURIComponent(path)}`, {token})
      .then(({content}) => {
        if (cancelled) return;
        originalContent.current = content;
        const {data, content: rest} = parseFrontMatter(content);
        const {dir, name, ext: e} = splitPath(path);
        setFm(data);
        setBody(rest);
        setCategory(dir);
        setFileName(name);
        setExt(e);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, token]);

  const targetPath = `${category ? `${category}/` : ''}${fileName}${ext}`;
  const isMdx = ext === '.mdx';

  const save = async () => {
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const content = serializeFrontMatter(fm, body.replace(/\s+$/, ''));
      const msg = message.trim() || undefined;
      if (targetPath !== path) {
        await api('/move', {
          method: 'POST',
          token,
          body: {path, new_path: targetPath, content, message: msg},
        });
      } else {
        await api('/save', {
          method: 'POST',
          token,
          body: {path: targetPath, content, message: msg},
        });
      }
      originalContent.current = content;
      setStatus('已推送，构建部署中（约 1~2 分钟）');
      onTreeChange();
      if (targetPath !== path) onSelect(targetPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    setDeleting(true);
    setError('');
    try {
      await api('/delete', {
        method: 'POST',
        token,
        body: {path, message: `docs: 在线编辑删除 ${path}`},
      });
      onTreeChange();
      onSelect(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className={styles.muted}>加载中…</p>;

  return (
    <div className={styles.article}>
      <div className={styles.topbar}>
        <span className={styles.path}>{path}</span>
        <span className={styles.badge}>{isMdx ? 'MDX' : sourceMode ? '源码' : '富文本'}</span>
        <div className={styles.spacer} />
        <button
          type="button"
          className={styles.btn}
          onClick={() => setSourceMode((v) => !v)}>
          {sourceMode ? '富文本' : '源码'}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnDanger}`}
          onClick={() => setConfirmDelete(true)}>
          删除
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={save}
          disabled={saving}>
          {saving ? '保存中…' : '保存并发布'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {status && <p className={styles.ok}>{status}</p>}

      {confirmDelete && (
        <div className={styles.confirm}>
          <span>确认删除 {path}？此操作会立即推送并删除线上页面。</span>
          <button type="button" className={styles.btnDanger} onClick={del} disabled={deleting}>
            {deleting ? '删除中…' : '确认删除'}
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
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">（根目录）</option>
              {categories.map((c) => (
                <option key={c.path} value={c.path}>
                  {'\u00A0'.repeat(c.depth * 2)}
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>文件名</span>
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value.trim())}
              placeholder="english-lowercase-hyphen"
            />
          </label>
          <label>
            <span>格式</span>
            <select value={ext} onChange={(e) => setExt(e.target.value)}>
              <option value=".md">.md</option>
              <option value=".mdx">.mdx</option>
            </select>
          </label>
        </div>
        <MetaForm fm={fm} setFm={setFm} />
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
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <TiptapBody key={path} initialMarkdown={body} onChange={setBody} />
        )}
      </div>
    </div>
  );
}

// ── 新建文章 ──────────────────────────────────────────

function NewArticle({token, categories, onCreated, onCancel}) {
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [category, setCategory] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const name = slugify(fileName || title);
      const path = `${category ? `${category}/` : ''}${name}.md`;
      const fm = {title: title.trim() || undefined, sidebar_position: position === '' ? undefined : Number(position)};
      const body = `# ${title.trim() || name}\n\n`;
      await api('/save', {
        method: 'POST',
        token,
        body: {path, content: serializeFrontMatter(fm, body), message: `docs: 新增 ${name}`},
      });
      onCreated(path);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <h2>新建文章</h2>
      <label>
        <span>标题</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label>
        <span>文件名（英文小写加连字符，留空按标题生成）</span>
        <input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="my-new-post"
        />
      </label>
      <label>
        <span>所属分类</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">（根目录）</option>
          {categories.map((c) => (
            <option key={c.path} value={c.path}>
              {'\u00A0'.repeat(c.depth * 2)}
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>排序 sidebar_position</span>
        <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={busy}>
          {busy ? '创建中…' : '创建'}
        </button>
        <button type="button" className={styles.btn} onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

// ── 新建分类 ──────────────────────────────────────────

function NewCategory({token, categories, onCreated, onCancel}) {
  const [parent, setParent] = useState('');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [position, setPosition] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const dir = slugify(name);
      const path = `${parent ? `${parent}/` : ''}${dir}`;
      await api('/category', {
        method: 'POST',
        token,
        body: {
          path,
          label: label.trim() || dir,
          position: position === '' ? null : Number(position),
          description: description.trim(),
          message: `docs: 新增分类 ${label.trim() || dir}`,
        },
      });
      onCreated(path);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <h2>新建分类</h2>
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
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={busy || !name}>
          {busy ? '创建中…' : '创建'}
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
  const [treeError, setTreeError] = useState('');
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('idle');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setMounted(true);
    setToken(sessionStorage.getItem('docs-editor-token'));
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api('/tree', {token})
      .then((data) => {
        if (!cancelled) {
          setTree(data);
          setTreeError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setTreeError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  const categories = useMemo(() => {
    const out = [];
    const walk = (nodes, depth) => {
      for (const n of nodes || []) {
        if (n.is_dir) {
          out.push({path: n.path, label: n.label || n.name, depth});
          walk(n.children, depth + 1);
        }
      }
    };
    walk(tree, 0);
    return out;
  }, [tree]);

  const reload = useCallback(() => setRefresh((v) => v + 1), []);

  const lock = () => {
    sessionStorage.removeItem('docs-editor-token');
    setToken(null);
    setSelected(null);
  };

  return (
    <Layout title="在线编辑">
      {!mounted ? null : !token ? (
        <Unlock onUnlock={setToken} />
      ) : (
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <strong>在线编辑</strong>
              <button type="button" className={styles.btn} onClick={lock}>
                锁定
              </button>
            </div>
            <div className={styles.sideActions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setMode('new-article');
                  setSelected(null);
                }}>
                ＋ 新建文章
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setMode('new-category');
                  setSelected(null);
                }}>
                ＋ 新建分类
              </button>
            </div>
            {treeError && <p className={styles.error}>{treeError}</p>}
            <FileTree
              tree={tree}
              active={selected}
              onSelect={(p) => {
                setMode('idle');
                setSelected(p);
              }}
            />
          </aside>

          <main className={styles.main}>
            {mode === 'new-article' ? (
              <NewArticle
                token={token}
                categories={categories}
                onCreated={(p) => {
                  reload();
                  setMode('idle');
                  setSelected(p);
                }}
                onCancel={() => setMode('idle')}
              />
            ) : mode === 'new-category' ? (
              <NewCategory
                token={token}
                categories={categories}
                onCreated={() => {
                  reload();
                  setMode('idle');
                }}
                onCancel={() => setMode('idle')}
              />
            ) : selected ? (
              <ArticleEditor
                key={selected}
                token={token}
                path={selected}
                categories={categories}
                onSelect={setSelected}
                onTreeChange={reload}
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
