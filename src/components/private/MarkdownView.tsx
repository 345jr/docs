import React, {useMemo} from 'react';
import clsx from 'clsx';
import {marked} from 'marked';
import type {Token, Tokens} from 'marked';
import {Highlight, themes} from 'prism-react-renderer';
import {ThemeClassNames, useColorMode} from '@docusaurus/theme-common';
import Heading from '@theme/Heading';
import type {MarkdownViewProps} from '../../types/privateTypes';
import styles from './MarkdownView.module.css';

/**
 * 私有文档正文渲染器：marked 词法分析 → 递归 React 渲染。
 *
 * 不使用 innerHTML（无 XSS 注入面）；原始 HTML 标签直接忽略不渲染。
 * 支持的语法与在线编辑器产出的 markdown 对齐：GFM（表格/任务列表/删除线）、
 * admonition（:::tip[标题]）、围栏代码块（prism 高亮，配色跟随明暗模式）。
 */

// ── admonition 预切分（与 Docusaurus 3 语法一致：:::type[标题] … :::）──
//
// marked 会把整块 admonition 拆散到多个 paragraph token 里
//（opener 粘住第一段、closer 粘住最后一段），整块正则根本匹配不到，
// 所以在 lexer 之前按行预切分：围栏代码块里的 ::: 不处理，
// 没配对 closer 的 opener 当普通文本（与 Docusaurus 行为一致）。

type Segment =
  | {kind: 'md'; text: string}
  | {kind: 'adm'; admType: string; title: string; body: string};

const ADMONITION_OPEN_RE =
  /^:::(tip|note|warning|danger|info|caution)(?:\[([^\]]*)\])?[ \t]*$/;
const ADMONITION_CLOSE_RE = /^:::[ \t]*$/;
const FENCE_RE = /^\s*(```+|~~~+)/;

function splitAdmonitions(src: string): Segment[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const segs: Segment[] = [];
  const buf: string[] = [];
  const flush = () => {
    // 纯空白碎片（如两个 admonition 之间的空行）直接丢掉，lexer 出来也是 space
    if (buf.length > 0 && buf.join('').trim() !== '') {
      segs.push({kind: 'md', text: buf.join('\n')});
    }
    buf.length = 0;
  };
  let i = 0;
  let inFence = false;
  let fenceChar = '';
  while (i < lines.length) {
    const line = lines[i];
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const ch = fence[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inFence = false;
      }
      buf.push(line);
      i += 1;
      continue;
    }
    const open = !inFence ? ADMONITION_OPEN_RE.exec(line) : null;
    if (open) {
      // 向后找配对的 :::（跳过围栏代码块里的）
      let j = i + 1;
      let innerFence = false;
      let innerChar = '';
      while (j < lines.length) {
        const l = lines[j];
        const f = FENCE_RE.exec(l);
        if (f) {
          const ch = f[1][0];
          if (!innerFence) {
            innerFence = true;
            innerChar = ch;
          } else if (ch === innerChar) {
            innerFence = false;
          }
        } else if (!innerFence && ADMONITION_CLOSE_RE.test(l)) {
          break;
        }
        j += 1;
      }
      if (j < lines.length) {
        flush();
        segs.push({
          kind: 'adm',
          admType: open[1],
          title: open[2] || open[1].toUpperCase(),
          body: lines.slice(i + 1, j).join('\n'),
        });
        i = j + 1;
        continue;
      }
      // 没找到配对 closer：当普通文本处理
    }
    buf.push(line);
    i += 1;
  }
  flush();
  return segs;
}

// ── 代码高亮 ──

function CodeBlock({code, lang}: {code: string; lang?: string}) {
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

function Inline({tokens = []}: {tokens?: Token[]}) {
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

// marked 的 heading depth（1-6）→ @theme/Heading 的 HeadingType（'h1'~'h6'）
function headingTag(depth: number | string) {
  return `h${depth}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function Blocks({tokens = []}: {tokens?: Token[]}) {
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'heading':
            // 走 @theme/Heading，拿到与公开文档一致的 anchor 样式与悬浮 # 链接
            return (
              <Heading key={i} as={headingTag(t.depth)} id={slugifyHeading(t.text)}>
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
                {t.items.map((item: Tokens.ListItem, j: number) => (
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
                      {t.header.map((cell: Tokens.TableCell, j: number) => (
                        <th key={j}>
                          <Inline tokens={cell.tokens} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((row: Tokens.TableCell[], j: number) => (
                      <tr key={j}>
                        {row.map((cell: Tokens.TableCell, k: number) => (
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
            // 未知块级 token：按段落兜底（admonition 已在 lexer 前预切分，这里不再处理）
            return (
              <p key={i}>
                <Inline tokens={(t as Tokens.Generic).tokens || []} />
              </p>
            );
          }
        }
      })}
    </>
  );
}

function AdmonitionBlock({admType, title, body}: {admType: string; title: string; body: string}) {
  // body 里允许再嵌套 admonition，递归切分
  const inner = useMemo(() => splitAdmonitions(body), [body]);
  return (
    <div className={`admonition admonition--${admType} ${styles.admonition}`}>
      <div className="admonition-heading">
        <h5>{title}</h5>
      </div>
      <div className="admonition-content">
        <Segments segments={inner} />
      </div>
    </div>
  );
}

function Segments({segments}: {segments: Segment[]}) {
  return (
    <>
      {segments.map((s, i) =>
        s.kind === 'adm' ? (
          <AdmonitionBlock key={i} admType={s.admType} title={s.title} body={s.body} />
        ) : (
          <Blocks key={i} tokens={marked.lexer(s.text)} />
        ),
      )}
    </>
  );
}

export default function MarkdownView({content, title}: MarkdownViewProps) {
  const segments = useMemo(() => {
    try {
      return splitAdmonitions(content || '');
    } catch {
      const fallback: Segment[] = [{kind: 'md', text: content || ''}];
      return fallback;
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
      <Segments segments={segments} />
    </div>
  );
}
