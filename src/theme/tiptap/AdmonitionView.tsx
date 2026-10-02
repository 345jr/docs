import React from 'react';
import {NodeViewContent, NodeViewWrapper, type NodeViewProps} from '@tiptap/react';
import {ADMONITION_TYPES} from './admonition';

const LABELS: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
};

export default function AdmonitionView({node, updateAttributes}: NodeViewProps) {
  const type = (node.attrs.type as string) || 'note';
  const title = (node.attrs.title as string) || '';

  return (
    <NodeViewWrapper className={`admonition-node admonition-node--${type}`}>
      <div className="admonition-node__header" contentEditable={false}>
        <select
          className="admonition-node__type"
          value={type}
          onChange={(e) => updateAttributes({type: e.target.value})}>
          {ADMONITION_TYPES.map((t) => (
            <option key={t} value={t}>
              {LABELS[t]}
            </option>
          ))}
        </select>
        <input
          className="admonition-node__title"
          value={title}
          placeholder="标题（可选）"
          onChange={(e) => updateAttributes({title: e.target.value || null})}
        />
      </div>
      <NodeViewContent className="admonition-node__content" />
    </NodeViewWrapper>
  );
}
