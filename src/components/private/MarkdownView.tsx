import React, {useMemo} from 'react';
import clsx from 'clsx';
import {marked} from 'marked';
import {Highlight, themes} from 'prism-react-renderer';
import {ThemeClassNames, useColorMode} from '@docusaurus/theme-common';
import Heading from '@theme/Heading';
import styles from './MarkdownView.module.css';

/**
 * 私有文档正文渲染器：marked 词法分析 → 递归 React 渲染。
 *
 * 不使用 innerHTML（无 XSS 注入面）；原始 HTML 标签直接忽略不渲染。
 * 支持的语法与在线编辑器产出的 markdown 对齐：GFM（表格/任务列表/删除线）、
 * admonition（:::tip[标题]）、围栏代码块（prism 高亮，配色跟随明暗模式）。
 */

// ── admonition 解析（与 Docusaurus 3 语法一致：:::type[标题]）──

const ADMONITION_RE = /^:::(tip|note|warning|danger|info|caution)(?:\[([^\]]*)\])?\s*\n([\s\S]*?)\n:::/;

function extractAdmonition(text) {
  const m = ADMONITION_RE.exec(text);
  if (!m) return null;
  return {type: m[1], title: m[2] || m[1].toUpperCase(), body: m[3]};
}

// ── 代码高亮 ──

function CodeBlock({code, lang}) {
  const {colorMode} = useColorMode();
  return (
    <Highlight code={code} language={lang || 'text'} theme={colorMode === 'dark' ? themes.dracula : themes.github}>
      {({tokens, getLineProps, getTokenProps}) => (
        <pre className={styles.codeBlock}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({line})}>
              {line.map((token, k) => (
                <span key={k} {...getTokenProps({token})} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

// ── 行内 token ──

function Inline({tokens}) {
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'text':
            return t.tokens ? <Inline key={i} tokens={t.tokens} /> : <React.Fragment key={i}>{t.text}</React.Fragment>;
          case 'escape':
            return <React.Fragment key={i}>{t.text}</React.Fragment>;
          case 'strong':
            return <strong key={i}><Inline tokens={t.tokens} /></strong>;
          case 'em':
            return <em key={i}><Inline tokens={t.tokens} /></em>;
          case 'del':
            return <del key={i}><Inline tokens={t.tokens} /></del>;
          case 'codespan':
            return <code key={i}>{t.text}</code>;
          case 'link':
            return (
              <a key={i} href={t.href} target="_blank" rel="noopener noreferrer">
                <Inline tokens={t.tokens} />
              </a>
            );
          case 'image':
            return <img key={i} src={t.href} alt={t.text || ''} />;
          case 'br':
            return <br key={i} />;
          default:
            return null;
        }
      })}
    </>
  );
}

// ── 块级 token ──

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function Blocks({tokens}) {
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'heading':
            // 走 @theme/Heading，拿到与公开文档一致的 anchor 样式与悬浮 # 链接
            return (
              <Heading key={i} as={`h${t.depth}`} id={slugifyHeading(t.text)}>
                <Inline tokens={t.tokens} />
              </Heading>
            );
          case 'paragraph':
            return (
              <p key={i}>
                <Inline tokens={t.tokens} />
              </p>
            );
          case 'code':
            return <CodeBlock key={i} code={t.text} lang={t.lang} />;
          case 'blockquote':
            return (
              <blockquote key={i}>
                <Blocks tokens={t.tokens} />
              </blockquote>
            );
          case 'list': {
            const Tag = t.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} start={t.start}>
                {t.items.map((item, j) => (
                  <li key={j} className={item.task ? styles.taskItem : undefined}>
                    {item.task && (
                      <input type="checkbox" disabled checked={item.checked} readOnly />
                    )}
                    <Blocks tokens={item.tokens} />
                  </li>
                ))}
              </Tag>
            );
          }
          case 'table':
            return (
              <div key={i} className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      {t.header.map((cell, j) => (
                        <th key={j}>
                          <Inline tokens={cell.tokens} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k}>
                            <Inline tokens={cell.tokens} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'hr':
            return <hr key={i} />;
          case 'space':
            return null;
          case 'html':
          case 'def':
            // 出于安全考虑不渲染原始 HTML；链接引用定义由 marked 内联展开
            return null;
          default: {
            // 段落里的 admonition（:::tip[标题] ... :::）
            const raw = t.raw || '';
            const adm = raw.startsWith(':::') ? extractAdmonition(raw) : null;
            if (adm) {
              return (
                <div key={i} className={`admonition admonition--${adm.type} ${styles.admonition}`}>
                  <div className="admonition-heading">
                    <h5>{adm.title}</h5>
                  </div>
                  <div className="admonition-content">
                    <Blocks tokens={marked.lexer(adm.body)} />
                  </div>
                </div>
              );
            }
            return <p key={i}><Inline tokens={t.tokens || []} /></p>;
          }
        }
      })}
    </>
  );
}

export default function MarkdownView({content, title}) {
  const tokens = useMemo(() => {
    try {
      return marked.lexer(content || '');
    } catch {
      return [];
    }
  }, [content]);
  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown', styles.markdown)}>
      {/* 标题与公开文档一致：放在 header 里，由 Infima 的 .markdown 规则定字号 */}
      {title ? (
        <header>
          <h1>{title}</h1>
        </header>
      ) : null}
      <Blocks tokens={tokens} />
    </div>
  );
}
