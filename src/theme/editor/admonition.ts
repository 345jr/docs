// Milkdown 自定义 admonition 节点插件。
// 让 Milkdown 能解析/序列化 Docusaurus 的 :::tip[标题] 语法，
// 并渲染成带样式的提示框。
import type {Ctx} from '@milkdown/ctx';
import {$nodeSchema, $view} from '@milkdown/utils';

// 从 remark containerDirective 节点里提取标题。
// remark-directive 把标题放在带 directiveLabel 标记的段落里。
function extractTitle(children) {
  if (!Array.isArray(children) || children.length === 0) return '';
  const first = children[0];
  if (first?.data?.directiveLabel) {
    return (first.children ?? [])
      .map((c) => c.value ?? '')
      .join('')
      .trim();
  }
  return '';
}

export const admonitionSchema = $nodeSchema(
  'admonition',
  () => ({
    group: 'block',
    content: 'block+',
    defining: true,
    attrs: {
      name: {default: 'note'},
      title: {default: ''},
    },
    parseMarkdown: {
      match: (node) => node.type === 'containerDirective',
      runner: (state, node, type) => {
        const name = node.name || 'note';
        const children = Array.isArray(node.children) ? node.children : [];
        const title = extractTitle(children);
        // 跳过标题段落，只保留正文内容
        const content = children.filter((c) => !c.data?.directiveLabel);
        state.openNode(type, {name, title}).next(content).closeNode();
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'admonition',
      runner: (state, node) => {
        const {name, title} = node.attrs;
        state.openNode('containerDirective', undefined, {name, attributes: {}});
        if (title) {
          // 标题段落带 directiveLabel 标记，remark-directive 会输出 :::name[标题]
          state
            .openNode('paragraph', undefined, {data: {directiveLabel: true}})
            .addNode('text', undefined, title)
            .closeNode();
        }
        state.next(node.content);
        state.closeNode();
      },
    },
  })
);

// 提示框前缀类型到 CSS class 的映射（样式见 editor.module.css）
const ADMONITION_STYLE = {
  note: 'info',
  tip: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

// $view 的第一个参数需要传 $Node schema 对象（admonitionSchema.node 是 $Node）
export const admonitionView = $view(admonitionSchema.node, (ctx: Ctx) => (node) => {
  const {name, title} = node.attrs;
  const style = ADMONITION_STYLE[name] || 'info';
  const div = document.createElement('div');
  div.className = `milkdown-admonition admonition-${style}`;
  div.setAttribute('data-admonition', name);

  if (title) {
    const h = document.createElement('div');
    h.className = 'milkdown-admonition-title';
    h.textContent = title;
    div.appendChild(h);
  }
  const body = document.createElement('div');
  body.className = 'milkdown-admonition-body';
  const contentDOM = document.createElement('div');
  body.appendChild(contentDOM);
  div.appendChild(body);

  return {
    dom: div,
    contentDOM,
  };
});
