import React, {useEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import matter from 'gray-matter';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import styles from './editor.module.css';

// ── API 封装 ──────────────────────────────────────────

const API = '/editor/api';

async function api(path, options = {}) {
  const headers = {...(options.headers || {})};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── front matter 工具 ─────────────────────────────────

function parseFrontMatter(raw) {
  try {
    const {data, content} = matter(raw);
    return {data, content};
  } catch {
    return {data: {}, content: raw};
  }
}

function serializeFrontMatter(data, content) {
  const keys = Object.keys(data);
  if (keys.length === 0) return content;
  const lines = ['---'];
  for (const k of keys) {
    const v = data[k];
    if (Array.isArray(v)) lines.push(`${k}: [${v.join(', ')}]`);
    else if (typeof v === 'object') lines.push(`${k}: ${JSON.stringify(v)}`);
    else lines.push(`${k}: ${v}`);
  }
  return ['---', ...lines, '---', '', content].join('\n');
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
    }
  };

  return (
    <div className={styles.unlockWrap}>
      <form className={styles.unlock} onSubmit={submit}>
        <h2>解锁在线编辑</h2>
        <p className={styles.unlockHint}>输入解锁密钥进入编辑器，密钥只在本次会话生效。</p>
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

function FileTree({token, active, onSelect}) {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/tree', {token}).then(setTree).catch((e) => setError(e.message));
  }, [token]);

  const renderNode = (node) => {
    if (node.is_dir) {
      return (
        <details key={node.path} className={styles.dir} open>
          <summary>{node.name}/</summary>
          {node.children?.map(renderNode)}
        </details>
      );
    }
    return (
      <button
        key={node.path}
        className={`${styles.file} ${active === node.path ? styles.active : ''}`}
        onClick={() => onSelect(node.path)}>
        {node.name}
      </button>
    );
  };

  if (error) return <p className={styles.error}>{error}</p>;
  if (!tree) return <p className={styles.muted}>加载中…</p>;
  return <div className={styles.tree}>{tree.map(renderNode)}</div>;
}

// ── 编辑器主体（Milkdown 动态加载，仅客户端）────────────

function Editor({token, path, onBack, onDeleted}) {
  const [fm, setFm] = useState({});
  const [body, setBody] = useState(null); // null = 加载中
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rootRef = useRef(null);
  const sourceRef = useRef(null);
  const crepeRef = useRef(null);
  const [crepeMod, setCrepeMod] = useState(null);
  const isMdx = path.endsWith('.mdx');

  // 动态加载 Milkdown（避免 SSR 报错）
  useEffect(() => {
    let cancelled = false;
    Promise.all([import('@milkdown/crepe'), import('@milkdown/kit/utils'), import('@milkdown/kit/core'), import('remark-directive')])
      .then(([crepe, kitUtils, kitCore, directive]) => {
        if (cancelled) return;
        setCrepeMod({Crepe: crepe.Crepe, CrepeFeature: crepe.CrepeFeature, replaceAll: kitUtils.replaceAll, remarkPluginsCtx: kitCore.remarkPluginsCtx, remarkDirective: directive.default ?? directive});
      })
      .catch((e) => setError(`编辑器加载失败: ${e.message}`));
    return () => {
      cancelled = true;
    };
  }, []);

  // 加载文件
  useEffect(() => {
    let cancelled = false;
    setError('');
    setStatus('');
    setBody(null);
    setConfirmDelete(false);
    api(`/read?path=${encodeURIComponent(path)}`, {token})
      .then(({content}) => {
        if (cancelled) return;
        const {data, content: bodyContent} = parseFrontMatter(content);
        setFm(data);
        setBody(bodyContent);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [path, token]);

  // 初始化 / 更新 Crepe（仅 .md，.mdx 用源码模式）
  useEffect(() => {
    if (body === null || isMdx || !crepeMod) return;
    const {Crepe, CrepeFeature, replaceAll, remarkPluginsCtx, remarkDirective} = crepeMod;
    let crepe = crepeRef.current;

    if (!crepe && rootRef.current) {
      crepe = new Crepe({
        root: rootRef.current,
        defaultValue: body,
        features: {
          [CrepeFeature.CodeMirror]: true,
          [CrepeFeature.Toolbar]: true,
          [CrepeFeature.Table]: true,
          [CrepeFeature.ImageBlock]: true,
        },
      });
      // 注入 remark-directive 支持 Docusaurus admonition（:::tip[标题]）
      crepe.editor.config((ctx) => {
        ctx.update(remarkPluginsCtx, (prev) => [...prev, {plugin: remarkDirective}]);
      });
      // 内容变化时同步到 state（用于保存）
      crepe.on((api) => {
        api.markdownUpdated((_ctx, markdown) => {
          setBody(markdown);
        });
      });
      crepe.create();
      crepeRef.current = crepe;
    } else if (crepe) {
      crepe.editor.action(replaceAll(body));
    }
    return () => {
      crepeRef.current?.destroy();
      crepeRef.current = null;
    };
  }, [body, isMdx, crepeMod]);

  const getBody = () => {
    if (isMdx) return sourceRef.current?.value ?? body ?? '';
    if (crepeRef.current) return crepeRef.current.getMarkdown();
    return body ?? '';
  };

  const save = async () => {
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const content = serializeFrontMatter(fm, getBody());
      const res = await api('/save', {
        method: 'POST',
        token,
        body: {
          path,
          content,
          message: message.trim() || `docs: 在线编辑更新 ${path}`,
        },
      });
      setStatus(res.pushed ? '已推送，构建部署中（约 1~2 分钟）' : '已提交但推送失败，见服务器日志');
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
      onDeleted(path);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const fmKeys = ['title', 'sidebar_position', 'description', 'tags'];
  const extraFm = Object.fromEntries(Object.entries(fm).filter(([k]) => !fmKeys.includes(k)));

  const setFmField = (key, value) => {
    setFm((prev) => {
      const next = {...prev};
      if (value === '' || value == null) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  return (
    <div className={styles.editorWrap}>
      <div className={styles.topbar}>
        <button className={styles.btn} onClick={onBack}>
          ← 返回
        </button>
        <span className={styles.path}>{path}</span>
        <span className={styles.badge}>{isMdx ? '源码模式' : 'WYSIWYG'}</span>
        <div className={styles.spacer} />
        <input
          className={styles.msgInput}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="提交信息（可选）"
        />
        <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setConfirmDelete(true)}>
          删除
        </button>
        <button className={styles.btnPrimary} onClick={save} disabled={saving || body === null}>
          {saving ? '保存中…' : '保存并发布'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {status && <p className={styles.ok}>{status}</p>}

      {confirmDelete && (
        <div className={styles.confirm}>
          <span>确认删除 {path}？此操作会立即推送并删除线上页面。</span>
          <button className={styles.btnDanger} onClick={del} disabled={deleting}>
            {deleting ? '删除中…' : '确认删除'}
          </button>
          <button className={styles.btn} onClick={() => setConfirmDelete(false)}>
            取消
          </button>
        </div>
      )}

      <div className={styles.main}>
        {/* front matter 表单 */}
        <div className={styles.fmPanel}>
          <h3>Front Matter</h3>
          {body === null ? (
            <p className={styles.muted}>加载中…</p>
          ) : (
            <>
              <label>
                标题 title
                <input value={fm.title ?? ''} onChange={(e) => setFmField('title', e.target.value)} />
              </label>
              <label>
                排序 sidebar_position
                <input
                  type="number"
                  value={fm.sidebar_position ?? ''}
                  onChange={(e) => setFmField('sidebar_position', Number(e.target.value))}
                />
              </label>
              <label>
                描述 description
                <textarea
                  value={fm.description ?? ''}
                  onChange={(e) => setFmField('description', e.target.value)}
                />
              </label>
              <label>
                标签 tags（逗号分隔）
                <input
                  value={Array.isArray(fm.tags) ? fm.tags.join(', ') : fm.tags ?? ''}
                  onChange={(e) =>
                    setFmField(
                      'tags',
                      e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    )
                  }
                />
              </label>
              {Object.entries(extraFm).map(([k, v]) => (
                <label key={k}>
                  {k}
                  <input value={String(v)} onChange={(e) => setFmField(k, e.target.value)} />
                </label>
              ))}
            </>
          )}
        </div>

        {/* 正文 */}
        <div className={styles.bodyPanel}>
          {body === null ? (
            <p className={styles.muted}>加载中…</p>
          ) : isMdx ? (
            <textarea ref={sourceRef} className={styles.source} defaultValue={body} />
          ) : (
            <div ref={rootRef} className={styles.milkdown} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────

export default function EditorPage() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState(null);
  const [path, setPath] = useState(null);

  useEffect(() => {
    setMounted(true);
    setToken(sessionStorage.getItem('docs-editor-token'));
  }, []);

  const lock = () => {
    sessionStorage.removeItem('docs-editor-token');
    setToken(null);
    setPath(null);
  };

  return (
    <Layout title="在线编辑">
      {!mounted ? null : !token ? (
        <Unlock onUnlock={setToken} />
      ) : !path ? (
        <div className={styles.page}>
          <div className={styles.treeHeader}>
            <h2>选择要编辑的文档</h2>
            <button className={styles.btn} onClick={lock}>
              锁定
            </button>
          </div>
          <FileTree token={token} onSelect={setPath} />
        </div>
      ) : (
        <div className={styles.page}>
          <Editor token={token} path={path} onBack={() => setPath(null)} onDeleted={() => setPath(null)} />
        </div>
      )}
    </Layout>
  );
}
