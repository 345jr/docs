import React, {useMemo, useState} from 'react';
import clsx from 'clsx';
import {Menu} from '@base-ui/react/menu';
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

function IconFit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 收起按钮箭头：与文档站 `@theme/Icon/Arrow` 完全一致（双人字 + 20px）。
 * 自己画个单箭头虽然更小，但与私有文档侧栏并排时一眼能看出不是同一套。
 */
function IconArrow() {
  return (
    <svg width="20" height="20" aria-hidden="true">
      <g fill="#7a7a7a">
        <path d="M9.992 10.023c0 .2-.062.399-.172.547l-4.996 7.492a.982.982 0 01-.828.454H1c-.55 0-1-.453-1-1 0-.2.059-.403.168-.551l4.629-6.942L.168 3.078A.939.939 0 010 2.528c0-.548.45-.997 1-.997h2.996c.352 0 .649.18.828.45L9.82 9.472c.11.148.172.347.172.55zm0 0" />
        <path d="M19.98 10.023c0 .2-.058.399-.168.547l-4.996 7.492a.987.987 0 01-.828.454h-3c-.547 0-.996-.453-.996-1 0-.2.059-.403.168-.551l4.625-6.942-4.625-6.945a.939.939 0 01-.168-.55 1 1 0 01.996-.997h3c.348 0 .649.18.828.45l4.996 7.492c.11.148.168.347.168.55zm0 0" />
      </g>
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
  return (
    <li className="menu__list-item">
      <div className={clsx(styles.row, active && styles.rowActive)}>
        {/* 用 Infima 的 menu__link 类名，hover / active / 缩进直接继承文档站样式 */}
        <button
          type="button"
          className={clsx('menu__link', active && 'menu__link--active')}
          onClick={onSelect}
          title={board.path}
          aria-current={active ? 'page' : undefined}>
          <span className={styles.rowTitle}>{board.title}</span>
          <span className={styles.rowMeta}>
            {formatTime(board.updated_at)}
            {board.size > 1024 * 1024 ? ` · ${formatBytes(board.size)}` : ''}
          </span>
        </button>

        {/* 行内操作菜单走 Base UI Menu（Portal + Positioner）：
            早先手写的 absolute 菜单挂在 static 的 <li> 上，会相对 aside 定位，
            直接落到侧栏底部之外，再被侧栏的 overflow/clip-path 裁掉——
            点了「完全没反应」就是这个原因。Portal 到 body 后不再受裁切影响。 */}
        <Menu.Root>
          <Menu.Trigger className={styles.rowMenuBtn} aria-label="更多操作">
            <IconDots />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              className={styles.menuPositioner}
              sideOffset={4}
              align="end">
              <Menu.Popup className={styles.menu}>
                <Menu.Item className={styles.menuItem} onClick={onRename}>
                  重命名
                </Menu.Item>
                <Menu.Item
                  className={clsx(styles.menuItem, styles.menuItemDanger)}
                  onClick={onDelete}>
                  删除
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
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
  footer,
  onSelect,
  onCreate,
  onFit,
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
          <div className={styles.sidebarActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onFit}
              disabled={!activePath}
              title="适应画布（缩放到全部内容）"
              aria-label="适应画布">
              <IconFit />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onCreate}
              title="新建白板"
              aria-label="新建白板">
              <IconPlus />
            </button>
          </div>
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

        {/* 滚动容器与文档站侧栏同名同结构：`menu thin-scrollbar`，
            细滚动条 + 内边距由 Infima 与本文件的 .sidebarScroll 共同决定。 */}
        <div className={clsx('menu', 'thin-scrollbar', styles.sidebarScroll)}>
          {loading ? (
            <p className={styles.placeholder}>加载中…</p>
          ) : shown.length === 0 ? (
            <p className={styles.placeholder}>
              {boards && boards.length > 0
                ? '没有匹配的白板。'
                : '还没有白板。点右上角 + 新建一块。'}
            </p>
          ) : (
            <ul className="menu__list">
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

        {/* 当前白板信息（保存状态）挂在侧栏底部 */}
        {footer ? <div className={styles.sidebarFooter}>{footer}</div> : null}

        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}>
          <IconArrow />
        </button>
      </div>

      {/* 收起态：与文档站一致，在裁切后的窄列上盖一个撑满高度的展开按钮。
          注意必须放在 .sidebarInner 外面——内层在收起态是 visibility: hidden，
          放在里面会连展开按钮一起隐形，用户就没法再展开了。 */}
      {collapsed && (
        <button
          type="button"
          className={styles.expandBtn}
          onClick={onToggleCollapse}
          title="展开侧边栏"
          aria-label="展开侧边栏">
          <IconArrow />
        </button>
      )}
    </aside>
  );
}
