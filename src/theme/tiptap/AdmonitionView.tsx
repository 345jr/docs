import React from 'react';
import {NodeViewContent, NodeViewWrapper, type NodeViewProps} from '@tiptap/react';
import {Select} from '@base-ui/react/select';
import {ADMONITION_TYPES, type AdmonitionType} from './admonition';

const LABELS: Record<AdmonitionType, string> = {
  note: 'Note',
  tip: 'Tip',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
};

export default function AdmonitionView({node, updateAttributes}: NodeViewProps) {
  const type = (node.attrs.type as AdmonitionType) || 'note';
  const title = (node.attrs.title as string) || '';

  const handleChange = (next: AdmonitionType | null) => {
    if (next) {
      updateAttributes({type: next});
    }
  };

  return (
    <NodeViewWrapper className={`admonition-node admonition-node--${type}`}>
      <div className="admonition-node__header" contentEditable={false}>
        <Select.Root<AdmonitionType> value={type} onValueChange={handleChange}>
          <Select.Trigger className="admonition-node__type" aria-label="选择提示框类型">
            <Select.Value>{(v: AdmonitionType) => LABELS[v] ?? v}</Select.Value>
            <Select.Icon className="admonition-node__type-icon" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 16 16">
                <path
                  d="M4 6l4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner
              className="admonition-node__type-positioner"
              alignItemWithTrigger={false}
              sideOffset={4}>
              <Select.Popup className="admonition-node__type-popup">
                {ADMONITION_TYPES.map((t) => (
                  <Select.Item
                    key={t}
                    value={t}
                    className="admonition-node__type-item">
                    <Select.ItemIndicator className="admonition-node__type-indicator">
                      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                        <path
                          d="M3 8.5l3.5 3.5L13 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </Select.ItemIndicator>
                    <Select.ItemText>{LABELS[t]}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
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
