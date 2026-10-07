import React, {useEffect, useMemo, useState} from 'react';
import {useLocation} from '@docusaurus/router';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import {
  HtmlClassNameProvider,
  ThemeClassNames,
  useWindowSize,
} from '@docusaurus/theme-common';
import {DocsSidebarProvider} from '@docusaurus/plugin-content-docs/client';
import DocRootLayout from '@theme/DocRoot/Layout';
import TOC from '@theme/TOC';
import TOCCollapsible from '@theme/TOCCollapsible';
import {marked} from 'marked';
import toast, {Toaster} from 'react-hot-toast';
import MarkdownView from '@site/src/components/private/MarkdownView';
import LoginForm from '@site/src/components/LoginForm';
import {
  fetchTree,
  getToken,
  readDoc,
  UNAUTHORIZED_EVENT,
  unlock,
} from '@site/src/utils/privateClient';
import styles from './private.styles.module.css';

/**
 * 私有文档阅读页：直接复用文档站的 DocRootLayout / DocSidebar / TOC 组件，
 * 视觉与公开文档完全一致（含侧边栏收起、移动端遮罩、active 高亮）。
 *
 * 登录与在线编辑共用同一密钥与 token（编辑器登录过这里就直接进）。
 * 每篇文档是真实路径 /private/<分类>/<文档>，因此侧边栏的 active 判定、
 * 分享/收藏链接都和文档站行为一致。
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

// ── FileEntry 树 → Docusaurus sidebar items ─────────

const stripExt = (p) => p.replace(/\.mdx?$/, '');

/** 文档树 → sidebar items：分类为 collapsible category，文档为 /private/<路径> 链接。
 *  href 保持原始 unicode（与 docs 插件一致，不做百分号编码），
 *  这样 active 判定（isSamePath）与 react-router 的 pathname 才能对上。 */
function toSidebarItems(nodes) {
  return (nodes || [])
    .filter((n) => n.is_dir || /\.mdx?$/i.test(n.name))
    .map((n) =>
      n.is_dir
        ? {
            type: 'category',
            label: n.label || n.name,
            collapsible: true,
            collapsed: false,
            items: toSidebarItems(n.children),
          }
        : {
            type: 'link',
            href: `/private/${stripExt(n.path)}`,
            label: n.title || stripExt(n.name),
          },
    );
}

/** 按 URL slug（去掉扩展名的路径）在树里找文档节点。 */
function findDocBySlug(nodes, slug) {
  for (const n of nodes || []) {
    if (!n.is_dir) {
      if (stripExt(n.path) === slug) return n;
    } else {
      const hit = findDocBySlug(n.children, slug);
      if (hit) return hit;
    }
  }
  return null;
}

function docLabel(node) {
  return node.title || stripExt(node.name);
}

// ── TOC（从 markdown 提取 h2/h3，锚点 id 与 MarkdownView 一致）──

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function extractToc(content) {
  try {
    return marked
      .lexer(content || '')
      .filter((t) => t.type === 'heading' && t.depth >= 2 && t.depth <= 3)
      .map((h) => ({id: slugifyHeading(h.text), value: h.text, level: h.depth}));
  } catch {
    return [];
  }
}

// ── 主页面 ────────────────────────────────────────────

export default function PrivatePage() {
  const location = useLocation();
  const windowSize = useWindowSize();

  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState(null);
  const [tree, setTree] = useState(null); // FileEntry[]
  const [doc, setDoc] = useState(null); // {path, title, content}
  const [loadingDoc, setLoadingDoc] = useState(false);

  const slug = (() => {
    try {
      return decodeURIComponent(location.pathname.replace(/^\/private\/?/, ''));
    } catch {
      return location.pathname.replace(/^\/private\/?/, '');
    }
  })();

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

  // 登录后拉目录树
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    fetchTree()
      .then((items) => {
        if (!cancelled) setTree(items || []);
      })
      .catch((err) => {
        // 401 已由 privateClient 广播处理，这里只需安静退出
        if (!cancelled && getToken()) toast.error(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // 按 URL slug 加载文档
  useEffect(() => {
    if (!token || !tree) return undefined;
    if (!slug) {
      setDoc(null);
      return undefined;
    }
    const node = findDocBySlug(tree, slug);
    if (!node) {
      setDoc(null);
      return undefined;
    }
    if (doc?.path === node.path) return undefined;
    let cancelled = false;
    setLoadingDoc(true);
    readDoc(node.path)
      .then((raw) => {
        if (cancelled) return;
        setDoc({path: node.path, title: docLabel(node), content: stripFrontMatter(raw)});
        setLoadingDoc(false);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.message);
          setLoadingDoc(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tree, token]);

  // 文档标题同步到浏览器标签页（与文档站行为一致）
  useEffect(() => {
    document.title = doc ? `${doc.title} | Lopop Docs` : '私有文档 | Lopop Docs';
  }, [doc]);

  const sidebarItems = useMemo(() => toSidebarItems(tree), [tree]);
  const toc = useMemo(() => extractToc(doc?.content), [doc]);

  // 与 DocItem/Layout 一致：桌面右侧 TOC + 移动端折叠 TOC
  const tocDesktop =
    toc.length > 0 && (windowSize === 'desktop' || windowSize === 'ssr') ? (
      <TOC
        toc={toc}
        minHeadingLevel={2}
        maxHeadingLevel={3}
        className={ThemeClassNames.docs.docTocDesktop}
      />
    ) : undefined;
  const tocMobile =
    toc.length > 0 ? (
      <TOCCollapsible
        toc={toc}
        minHeadingLevel={2}
        maxHeadingLevel={3}
        className={ThemeClassNames.docs.docTocMobile}
      />
    ) : undefined;

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
        <HtmlClassNameProvider
          className={clsx(ThemeClassNames.wrapper.docsPages, ThemeClassNames.page.docsDocPage)}>
          <DocsSidebarProvider name="private" items={sidebarItems}>
            <DocRootLayout>
              <div className="row">
                <div className={clsx('col', styles.docItemCol)}>
                  <div className={styles.docItemContainer}>
                    <article>
                      {tocMobile}
                      {loadingDoc ? (
                        <p className={styles.placeholder}>加载中…</p>
                      ) : doc ? (
                        <MarkdownView content={doc.content} />
                      ) : slug ? (
                        <p className={styles.placeholder}>没有找到这篇私有文档。</p>
                      ) : (
                        <p className={styles.placeholder}>
                          {tree && tree.length > 0
                            ? '从左侧选择一篇文档。'
                            : '还没有私有文档。在「在线编辑」中切到私有模式即可新建。'}
                        </p>
                      )}
                    </article>
                  </div>
                </div>
                {tocDesktop && <div className="col col--3">{tocDesktop}</div>}
              </div>
            </DocRootLayout>
          </DocsSidebarProvider>
        </HtmlClassNameProvider>
      )}
    </Layout>
  );
}
