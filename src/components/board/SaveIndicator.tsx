import React from 'react';
import clsx from 'clsx';
import type {SaveIndicatorProps} from '../../types/boardTypes';
import styles from './styles.module.css';

function relativeTime(ts: number | null): string {
  if (!ts) return '';
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 5) return '刚刚';
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  return `${Math.floor(diff / 3600)} 小时前`;
}

/**
 * 侧栏底部的保存状态灯。
 *
 * 白板是「边画边存」，没有保存按钮，所以状态必须一直可见：
 * 未保存 / 保存中 / 已保存 / 失败 / 冲突（别处改过）。
 */
export default function SaveIndicator({
  status,
  savedAt,
  onRetry,
  onReload,
}: SaveIndicatorProps): React.ReactNode {
  if (status === 'conflict') {
    return (
      <span className={clsx(styles.save, styles.saveConflict)}>
        别处已修改
        <button type="button" className={styles.saveLink} onClick={onReload}>
          载入最新
        </button>
        <button type="button" className={styles.saveLink} onClick={onRetry}>
          覆盖保存
        </button>
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className={clsx(styles.save, styles.saveError)}>
        保存失败
        <button type="button" className={styles.saveLink} onClick={onRetry}>
          重试
        </button>
      </span>
    );
  }

  const text =
    status === 'saving'
      ? '保存中…'
      : status === 'dirty'
        ? '未保存'
        : status === 'saved'
          ? `已保存 · ${relativeTime(savedAt)}`
          : savedAt
            ? `已保存 · ${relativeTime(savedAt)}`
            : '';

  if (!text) return null;

  return (
    <span
      className={clsx(
        styles.save,
        status === 'saving' && styles.saveBusy,
        status === 'dirty' && styles.saveDirty,
        status === 'saved' && styles.saveOk,
      )}>
      <span className={styles.saveDot} aria-hidden="true" />
      {text}
    </span>
  );
}
