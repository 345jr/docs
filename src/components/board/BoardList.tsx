import React, {useMemo, useState} from 'react';
import clsx from 'clsx';
import type {BoardListProps, BoardSummary} from '../../types/boardTypes';
import {formatBytes} from '../../utils/boardScene';
import styles from './styles.module.css';

/** 「更新于」：今天显示时分，更早显示日期。 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return sameDay
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${d.getMonth() + 1}月${d.getDate()}日`;
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconDots() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.5" cy="8" r="1.3" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type RowProps = {
  board: BoardSummary;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
};

function BoardRow({board, active, onSelect, onRename, onDelete}: RowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <li className={styles.row}>
      <button
        type="button"
        className={clsx(styles.rowMain, active && styles.rowMainActive)}
        onClick={onSelect}
        title={board.path}>
        <span className={styles.rowTitle}>{board.title}</span>
        <span className={styles.rowMeta}>
          {formatTime(board.updated_at)}
          {board.size > 1024 * 1024 ? ` · ${formatBytes(board.size)}` : ''}
        </span>
      </button>
      <button
        type="button"
        className={styles.rowMenuBtn}
        aria-label="更多操作"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}>
        <IconDots />
      </button>
      {menuOpen && (
        <>
          {/* 点空白处关闭：用一个透明遮罩接住点击，比全局监听省事且不吞滚动 */}
          <button
            type="button"
            className={styles.menuScrim}
            aria-label="关闭菜单"
            onClick={() => setMenuOpen(false)}
          />
          <div className={styles.menu} role="menu">
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                setMenuOpen(false);
                onRename();
              }}>
              重命名
            </button>
            <button
              type="button"
              role="menuitem"
              className={clsx(styles.menuItem, styles.menuItemDanger)}
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}>
              删除
            </button>
          </div>
        </>
      )}
    </li>
  );
}

/**
 * 白板侧栏：与在线编辑的文件树同款视觉（Infima menu 观感 + 可收起）。
 * 平铺列表而非目录树——白板一开始就不做分类，路径只有一层。
 */
export default function BoardList({
  boards,
  activePath,
  loading,
  collapsed,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onToggleCollapse,
}: BoardListProps): React.ReactNode {
  const [keyword, setKeyword] = useState('');
  const shown = useMemo(() => {
    const list = boards || [];
    const k = keyword.trim().toLowerCase();
    if (!k) return list;
    return list.filter(
      (b) =>
        b.title.toLowerCase().includes(k) || b.path.toLowerCase().includes(k),
    );
  }, [boards, keyword]);

  return (
    <aside className={clsx(styles.sidebar, collapsed && styles.sidebarCollapsed)}>
      <div className={styles.sidebarInner}>
        <div className={styles.sidebarHead}>
          <span className={styles.sidebarTitle}>白板</span>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onCreate}
            title="新建白板"
            aria-label="新建白板">
            <IconPlus />
          </button>
        </div>

        <div className={styles.searchWrap}>
          <input
            type="search"
            className={styles.search}
            value={keyword}
            placeholder="搜索白板"
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className={styles.sidebarScroll}>
          {loading ? (
            <p className={styles.placeholder}>加载中…</p>
          ) : shown.length === 0 ? (
            <p className={styles.placeholder}>
              {boards && boards.length > 0
                ? '没有匹配的白板。'
                : '还没有白板。点右上角 + 新建一块。'}
            </p>
          ) : (
            <ul className={styles.list}>
              {shown.map((b) => (
                <BoardRow
                  key={b.path}
                  board={b}
                  active={b.path === activePath}
                  onSelect={() => onSelect(b.path)}
                  onRename={() => onRename(b)}
                  onDelete={() => onDelete(b)}
                />
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}>
          <IconArrow />
        </button>
      </div>
    </aside>
  );
}
