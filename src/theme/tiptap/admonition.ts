import {Node, mergeAttributes} from '@tiptap/core';
import {ReactNodeViewRenderer} from '@tiptap/react';
import AdmonitionView from './AdmonitionView';

export const ADMONITION_TYPES = ['note', 'tip', 'info', 'warning', 'danger'] as const;

export type AdmonitionType = (typeof ADMONITION_TYPES)[number];

/**
 * Docusaurus admonition 节点，round-trip 语法为 `:::type[标题]`。
 * 通过 markdownTokenizer / parseMarkdown / renderMarkdown 与 @tiptap/markdown 对接，
 * 保证编辑后仍输出 Docusaurus 3.1+ 的方括号标题写法。
 */
export const Admonition = Node.create({
  name: 'admonition',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: (element) => element.getAttribute('data-type') || 'note',
        renderHTML: (attributes) => ({'data-type': attributes.type}),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) =>
          attributes.title ? {'data-title': attributes.title} : {},
      },
    };
  },

  parseHTML() {
    return [{tag: 'div[data-admonition]'}];
  },

  renderHTML({HTMLAttributes}) {
    return ['div', mergeAttributes(HTMLAttributes, {'data-admonition': ''}), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AdmonitionView);
  },

  markdownTokenizer: {
    name: 'admonition',
    level: 'block',
    start: (src: string) => src.indexOf(':::'),
    tokenize: (src: string, _tokens: unknown, lexer: {blockTokens: (s: string) => unknown[]}) => {
      // :::type[标题] \n 内容 \n :::
      const match = /^:::(\w+)(?:\[([^\]]*)\])?\r?\n([\s\S]*?)\r?\n:::(?:\r?\n|$)/.exec(src);
      if (!match) return undefined;
      const [, type, title, text] = match;
      return {
        type: 'admonition',
        raw: match[0],
        admonitionType: type,
        admonitionTitle: title ?? null,
        tokens: lexer.blockTokens(text),
      };
    },
  },

  parseMarkdown: (token: any, helpers: any) => ({
    type: 'admonition',
    attrs: {
      type: token.admonitionType || 'note',
      title: token.admonitionTitle || null,
    },
    content: helpers.parseChildren(token.tokens || []),
  }),

  renderMarkdown: (node: any, helpers: any) => {
    const type = node.attrs?.type || 'note';
    const title = node.attrs?.title;
    const open = title ? `:::${type}[${title}]` : `:::${type}`;
    // 关闭符必须独占一行，否则再次解析会被当成普通文本而转义方括号
    const content = String(helpers.renderChildren(node.content || [])).replace(/\n+$/, '');
    return `${open}\n${content}\n:::`;
  },
});
