import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import toast, {Toaster} from 'react-hot-toast';
import {marked} from 'marked';
import MarkdownView from '@site/src/components/private/MarkdownView';
import LoginForm from '@site/src/components/LoginForm';
import {
  fetchTree,
  getToken,
  readDoc,
  UNAUTHORIZED_EVENT,
  unlock,
} from '@site/src/utils/privateClient';
import styles from './private.module.css';

/**
 * 私有文档阅读页：登录用与在线编辑相同的密钥（同一个 token，编辑器登录过
 * 这里就直接进），侧边栏/正文/TOC 视觉对齐文档站。内容存在 Steward 本地，
 * 接口按 session 鉴权，保存即时生效。
 */

// ── front matter（只取 title，正文整体交给 MarkdownView）──

function extractTitle(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!m) return null;
  const line = m[1].split('\n').find((l) => /^title\s*:/.test(l.trim()));
  if (!line) return null;
  const v = line.slice(line.indexOf(':') + 1).trim();
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
    ? v.slice(1, -1)
    : v;
}

function stripFrontMatter(raw) {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw);
  return m ? raw.slice(m[0].length) : raw;
}

// ── 侧边栏（Infima menu 结构，与文档站侧边栏视觉一致）──

function SidebarTree({items, activePath, onSelect}) {
  if (!items || items.length === 0) {
    return (
      <p
        className="menu__list-item"
        style={{padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--ifm-color-emphasis-600)'}}>
        还没有私有文档。去「在线编辑」切到私有模式新建第一篇。
      </p>
    );
  }
  return (
    <ul className="theme-doc-sidebar-menu menu__list">
      {items.map((n) =>
        n.is_dir ? (
          <SidebarCategory key={n.path} node={n} activePath={activePath} onSelect={onSelect} />
        ) : (
          <li key={n.path} className="menu__list-item">
            <button
              type="button"
              className={`clean-btn menu__link ${activePath === n.path ? 'menu__link--active' : ''}`}
              onClick={() => onSelect(n.path)}>
              {n.title || n.name}
            </button>
          </li>
        ),
      )}
    </ul>
  );
}

function SidebarCategory({node, activePath, onSelect}) {
  const containsActive = !!activePath && activePath.startsWith(`${node.path}/`);
  const [open, setOpen] = useState(true);
  return (
    <li className={`menu__list-item ${open ? '' : 'menu__list-item--collapsed'}`}>
      <div className="menu__list-item-collapsible">
        <button
          type="button"
          className={`clean-btn menu__link menu__link--sublist ${containsActive ? 'menu__link--active' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}>
          {node.label || node.name}
        </button>
        <button
          type="button"
          className={`clean-btn menu__caret ${styles.categoryCaret} ${open ? '' : styles.categoryCaretClosed}`}
          aria-expanded={open}
          aria-label={open ? '折叠' : '展开'}
          onClick={() => setOpen((v) => !v)}
        />
      </div>
      <div className={styles.collapsibleBody} aria-hidden={!open}>
        <ul className="menu__list">
          <SidebarTree items={node.children || []} activePath={activePath} onSelect={onSelect} />
        </ul>
      </div>
    </li>
  );
}

// ── TOC（从 markdown 提取 h2/h3，锚点 id 与 MarkdownView 一致）──

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function useToc(content) {
  return useMemo(() => {
    try {
      return marked
        .lexer(content || '')
        .filter((t) => t.type === 'heading' && t.depth >= 2 && t.depth <= 3)
        .map((h) => ({depth: h.depth, text: h.text, id: slugifyHeading(h.text)}));
    } catch {
      return [];
    }
  }, [content]);
}

function Toc({items}) {
  if (items.length === 0) return null;
  return (
    <nav className={styles.toc} aria-label="本页导航">
      <p className={styles.tocTitle}>本页</p>
      <ul>
        {items.map((h) => (
          <li key={h.id} className={h.depth === 3 ? styles.tocH3 : undefined}>
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── 主页面 ────────────────────────────────────────────

export default function PrivatePage() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState(null);
  const [tree, setTree] = useState(null); // FileEntry[]
  const [doc, setDoc] = useState(null); // {path, content}
  const [loadingDoc, setLoadingDoc] = useState(false);

  useEffect(() => {
    setMounted(true);
    setToken(getToken());
  }, []);

  // session 失效（含在编辑器那边失效）时回到登录页
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setTree(null);
      setDoc(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const openDoc = useCallback(async (path) => {
    setLoadingDoc(true);
    try {
      const raw = await readDoc(path);
      setDoc({path, content: stripFrontMatter(raw), title: extractTitle(raw)});
      history.replaceState(null, '', `/private?doc=${encodeURIComponent(path)}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingDoc(false);
    }
  }, []);

  // 拉目录树；支持 ?doc=path 直达
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    fetchTree()
      .then((items) => {
        if (cancelled) return;
        setTree(items || []);
        const slug = new URLSearchParams(window.location.search).get('doc');
        if (slug) openDoc(slug);
      })
      .catch((err) => {
        // 401 已由 privateClient 广播处理，这里只需安静退出
        if (!cancelled && getToken()) toast.error(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, openDoc]);

  const toc = useToc(doc?.content);

  return (
    <Layout title="私有文档" description="仅自己可见的私有文档">
      <Toaster position="top-center" toastOptions={{duration: 4000}} />
      {!mounted ? null : !token ? (
        <LoginForm
          title="私有文档"
          submitLabel="解锁"
          onSubmit={async (key) => {
            const t = await unlock(key);
            setToken(t);
            toast.success('已解锁');
          }}
        />
      ) : (
        <main className={styles.page}>
          <div className={styles.body}>
            <aside className={styles.sidebar}>
              <div className="sidebarViewport">
                <nav aria-label="私有文档" className={`menu thin-scrollbar ${styles.sidebarMenu}`}>
                  <ul className="theme-doc-sidebar-menu menu__list">
                    <li className="menu__list-item">
                      <span className={`menu__link ${styles.sidebarHeading}`}>🔒 私有文档</span>
                    </li>
                  </ul>
                  <SidebarTree items={tree} activePath={doc?.path} onSelect={openDoc} />
                </nav>
              </div>
            </aside>

            <div className={styles.mainCol}>
              <article className={styles.article}>
                {loadingDoc ? (
                  <p className={styles.muted}>加载中…</p>
                ) : doc ? (
                  <MarkdownView content={doc.content} />
                ) : (
                  <p className={styles.placeholder}>
                    {tree && tree.length > 0
                      ? '从左侧选择一篇私有文档。'
                      : '还没有私有文档。在「在线编辑」中切到私有模式即可新建。'}
                  </p>
                )}
              </article>
              {doc && !loadingDoc && <Toc items={toc} />}
            </div>
          </div>
        </main>
      )}
    </Layout>
  );
}
