import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useLocation, useHistory} from '@docusaurus/router';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {Dialog} from '@base-ui/react/dialog';
import toast, {Toaster} from 'react-hot-toast';
// 刻意用相对路径而非 `@site/` 别名：站点没有 tsconfig，`@site/*` 只由打包器
// 解析，tsc 会报 TS2307 并让下游参数退化成隐式 any（同 private.tsx）。
import LoginForm from '../components/LoginForm';
import BoardList from '../components/board/BoardList';
import SaveIndicator from '../components/board/SaveIndicator';
import {
  ConflictError,
  UNAUTHORIZED_EVENT,
  createBoard,
  deleteBoard,
  fetchBoards,
  getToken,
  readBoard,
  renameBoard,
  saveBoard,
  unlock,
} from '../utils/boardClient';
import {
  MAX_BOARD_BYTES,
  byteSize,
  emptyScene,
  ensureScene,
  formatBytes,
  pathToTitle,
  readTitle,
  titleToPath,
  writeTitle,
} from '../utils/boardScene';
import type {
  BoardSummary,
  ExcalidrawApi,
  SaveStatus,
} from '../types/boardTypes';
import boardStyles from '../components/board/styles.module.css';
import styles from './whiteboard.module.css';

/**
 * 私有白板页：登录门 → 左侧白板列表 → 右侧 Excalidraw 画布。
 *
 * - 鉴权与私有文档、在线编辑完全共用：同一个 `docs-editor-token`，
 *   同一个 401 广播事件，登录过一次三处互通。
 * - 画布只在浏览器加载（BrowserOnly + lazy），样式与字体由
 *   `plugins/excalidraw-assets` 版本化托管，不进全局 styles.css。
 * - 布局是纯左右两栏：左侧栏占满导航栏以下的高度，右侧是画布。没有横贯
 *   整屏的顶栏，标题编辑 / 路径 / 保存状态都挂在侧栏底部的 footer 插槽里。
 * - 边画边存：改动后防抖 1.2s 落盘，侧栏状态灯常驻；切板/关页面前会强制落盘。
 * - 每块白板是真实路径 `/whiteboard/<文件名>`，刷新/收藏/新标签页都成立。
 */

const BoardCanvas = lazy(() => import('../components/board/BoardCanvas'));

/** 改动后多久落盘（ms）。Excalidraw 拖动时 onChange 很密集，防抖必须给足。 */
const SAVE_DEBOUNCE_MS = 1200;

/** 侧栏「已保存」状态保持多久再淡出（ms）。 */
const SAVED_HINT_MS = 4000;

type Current = {
  path: string;
  title: string;
  rev: number;
  content: string;
};

function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    return e.message;
  }
  return String(e);
}

// ── 命名对话框（新建 / 重命名共用）────────────────────

type NameDialogProps = {
  open: boolean;
  mode: 'create' | 'rename';
  initialTitle: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (title: string) => void;
};

function NameDialog({
  open,
  mode,
  initialTitle,
  busy,
  onCancel,
  onSubmit,
}: NameDialogProps): React.ReactNode {
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (open) setTitle(initialTitle);
  }, [open, initialTitle]);

  const trimmed = title.trim();
  const submit = () => {
    if (trimmed && !busy) onSubmit(trimmed);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onCancel();
      }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={boardStyles.modalBackdrop} />
        <Dialog.Popup
          className={boardStyles.modal}
          aria-label={mode === 'create' ? '新建白板' : '重命名白板'}>
          <div className={boardStyles.modalHeader}>
            <Dialog.Title className={boardStyles.modalTitle} render={<h3 />}>
              {mode === 'create' ? '新建白板' : '重命名白板'}
            </Dialog.Title>
            <Dialog.Close className={boardStyles.modalClose} title="关闭（Esc）">
              ×
            </Dialog.Close>
          </div>

          <div className={boardStyles.modalBody}>
            <label className={boardStyles.fieldLabel} htmlFor="board-name-input">
              名称
            </label>
            <input
              id="board-name-input"
              className={boardStyles.fieldInput}
              value={title}
              autoFocus
              placeholder="例如：架构草图"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </div>

          <div className={boardStyles.modalFooter}>
            <Dialog.Close className={boardStyles.btn}>取消</Dialog.Close>
            <button
              type="button"
              className={`${boardStyles.btn} ${boardStyles.btnPrimary}`}
              disabled={!trimmed || busy}
              onClick={submit}>
              {busy ? '处理中…' : mode === 'create' ? '创建' : '保存'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── 主页面 ────────────────────────────────────────────

export default function WhiteboardPage(): React.ReactNode {
  const location = useLocation();
  const history = useHistory();

  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [current, setCurrent] = useState<Current | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dialog, setDialog] = useState<
    {mode: 'create'} | {mode: 'rename'; board: BoardSummary} | null
  >(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  /**
   * 对话框退场期间沿用最后一次非空的配置。
   *
   * 关闭时 `setDialog(null)` 会立即生效，但 Base UI 还要把弹窗渲染 ~150ms
   * 做退场动画（`data-ending-style`）。若直接从 `dialog` 推导 mode/标题，
   * 这段时间会落到 `create` 分支——用户看到的就是「点取消的一瞬间标题从
   * 重命名白板闪成新建白板」。用 ref 留住上一次的值即可。
   */
  const lastDialogRef = useRef<
    {mode: 'create'} | {mode: 'rename'; board: BoardSummary} | null
  >(null);
  if (dialog) lastDialogRef.current = dialog;
  const shownDialog = dialog ?? lastDialogRef.current;

  // 待保存内容：画布回调写这里，防抖计时器统一落盘
  const pendingRef = useRef<{content: string; title: string} | null>(null);
  const timerRef = useRef<number | null>(null);
  const currentRef = useRef<Current | null>(null);
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const savedHintRef = useRef<number | null>(null);

  currentRef.current = current;

  const slug = useMemo(() => {
    const raw = location.pathname.replace(/^\/whiteboard\/?/, '');
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [location.pathname]);

  useEffect(() => {
    setMounted(true);
    setToken(getToken());
    // 移动端侧栏默认收起：260px 的侧栏在 390px 屏上会盖掉大半个画布，
    // 而白板的首要用途是看/画内容，不是切列表。
    if (window.matchMedia('(max-width: 996px)').matches) setCollapsed(true);
  }, []);

  // session 失效（含在编辑器/私有文档那边失效）时回到登录页
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setBoards(null);
      setCurrent(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // ── 列表 ──────────────────────────────────────────

  const reloadList = useCallback(async () => {
    setLoadingList(true);
    try {
      setBoards(await fetchBoards());
    } catch (err) {
      // 401 已由 boardClient 广播处理，这里只提示其余错误
      if (getToken()) toast.error(errMsg(err));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void reloadList();
  }, [token, reloadList]);

  // ── 保存 ──────────────────────────────────────────

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /** 立刻把待保存内容落盘。force=true 时忽略冲突检测（用户选了「覆盖保存」）。 */
  const flush = useCallback(
    async (opts: {force?: boolean} = {}): Promise<boolean> => {
      clearTimer();
      const pending = pendingRef.current;
      const cur = currentRef.current;
      if (!pending || !cur) return true;

      const payload = writeTitle(pending.content, pending.title);
      const size = byteSize(payload);
      if (size > MAX_BOARD_BYTES) {
        pendingRef.current = null;
        setStatus('error');
        toast.error(`白板内容 ${formatBytes(size)} 超过 ${formatBytes(MAX_BOARD_BYTES)} 上限，未保存`);
        return false;
      }

      setStatus('saving');
      try {
        const res = await saveBoard({
          path: cur.path,
          content: payload,
          title: pending.title,
          baseRev: opts.force ? -1 : cur.rev,
        });
        // 保存期间可能有新的改动进来：只在没有新 pending 时清状态
        if (pendingRef.current === pending) pendingRef.current = null;
        setCurrent((c) => (c && c.path === cur.path ? {...c, rev: res.rev} : c));
        setStatus(pendingRef.current ? 'dirty' : 'saved');
        setSavedAt(Date.now());
        if (savedHintRef.current !== null) window.clearTimeout(savedHintRef.current);
        savedHintRef.current = window.setTimeout(() => {
          setStatus((s) => (s === 'saved' ? 'idle' : s));
          savedHintRef.current = null;
        }, SAVED_HINT_MS);
        void reloadList();
        return true;
      } catch (err) {
        if (err instanceof ConflictError) {
          setStatus('conflict');
          return false;
        }
        setStatus('error');
        toast.error(`保存失败：${errMsg(err)}`);
        return false;
      }
    },
    [reloadList],
  );

  /** 画布改动：记 pending，重置防抖计时器。 */
  const handleCanvasChange = useCallback(
    (content: string) => {
      const cur = currentRef.current;
      if (!cur) return;
      pendingRef.current = {content, title: cur.title};
      setStatus((s) => (s === 'saving' ? s : 'dirty'));
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  // 组件卸载 / 切板前兜底：有未保存内容就尽力落一次
  useEffect(
    () => () => {
      clearTimer();
      const pending = pendingRef.current;
      const cur = currentRef.current;
      if (!pending || !cur) return;
      // 卸载时没法 await，直接发请求（keepalive 保证页面关闭也能发出去）
      const body = JSON.stringify({
        path: cur.path,
        content: writeTitle(pending.content, pending.title),
        title: pending.title,
        base_rev: cur.rev,
      });
      void fetch('/editor/api/boards/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken() || ''}`,
        },
        body,
        keepalive: true,
      }).catch(() => undefined);
    },
    [],
  );

  // 关标签页 / 刷新时提醒（浏览器不支持自定义文案，只能给默认提示）
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!pendingRef.current) return undefined;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // ── 打开白板 ──────────────────────────────────────

  const openBoard = useCallback(
    async (path: string) => {
      if (path === currentRef.current?.path) return;
      // 切板前先把当前改动落盘，避免丢内容
      if (pendingRef.current) {
        const ok = await flush();
        if (!ok && !window.confirm('当前白板还没保存成功，仍要切换吗？')) return;
      }
      setLoadingBoard(true);
      setCurrent(null);
      pendingRef.current = null;
      setStatus('idle');
      try {
        const payload = await readBoard(path);
        const content = ensureScene(payload.content);
        setCurrent({
          path: payload.path,
          title: payload.title || readTitle(content) || pathToTitle(payload.path),
          rev: payload.rev,
          content,
        });
        setSavedAt(null);
        // 移动端选完白板就把列表收起来，把整屏让给画布
        if (window.matchMedia('(max-width: 996px)').matches) setCollapsed(true);
      } catch (err) {
        toast.error(errMsg(err));
        // 文件不存在（被别处删掉）时退回空态并刷新列表
        void reloadList();
      } finally {
        setLoadingBoard(false);
      }
    },
    [flush, reloadList],
  );

  // URL → 打开对应白板；列表就绪后才知道这块板还在不在
  useEffect(() => {
    if (!token || !boards) return;
    if (!slug) {
      // 根路径：自动打开最近一块，没有就停在空态
      if (!currentRef.current && boards.length > 0) {
        void openBoard(boards[0].path);
      }
      return;
    }
    if (currentRef.current?.path === slug) return;
    // 列表里没有这个 slug 就别读了：典型场景是刚删掉当前白板——那时
    // setBoards 已生效但 history.replace 还没刷新 location，effect 会拿
    // 旧 slug 再读一次已删除的文件，弹出一个莫名其妙的「不存在」错误。
    // 顺带也处理了「别处删掉了这块板」：停在空态而不是报错。
    if (!boards.some((b) => b.path === slug)) {
      if (currentRef.current) {
        pendingRef.current = null;
        setCurrent(null);
        setStatus('idle');
      }
      return;
    }
    void openBoard(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, boards, token]);

  // 打开的白板同步到地址栏（便于刷新与收藏）
  const lastPushedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!current) return;
    if (lastPushedRef.current === current.path) return;
    lastPushedRef.current = current.path;
    const target = `/whiteboard/${encodeURIComponent(current.path)}`;
    if (location.pathname !== target) history.replace(target);
  }, [current, history, location.pathname]);

  // 浏览器标题
  useEffect(() => {
    document.title = current
      ? `${current.title} | 私有白板`
      : '私有白板 | Lopop Docs';
  }, [current]);

  // ── 新建 / 重命名 / 删除 ──────────────────────────

  const handleCreate = useCallback(
    async (title: string) => {
      setDialogBusy(true);
      try {
        const path = titleToPath(title);
        if (boards?.some((b) => b.path === path)) {
          toast.error(`已存在同名白板：${path}`);
          return;
        }
        const created = await createBoard({path, title});
        setDialog(null);
        // 本地先插入列表（服务端按 updated_at 排序，新建的总在最前）
        setBoards((list) => [
          {
            path: created.path,
            title: created.title || title,
            size: (created.content || '').length,
            updated_at: new Date().toISOString(),
          },
          ...(list || []).filter((b) => b.path !== created.path),
        ]);
        lastPushedRef.current = null;
        setCurrent({
          path: created.path,
          title: created.title || title,
          rev: created.rev,
          content: ensureScene(created.content || emptyScene()),
        });
        setSavedAt(null);
        setStatus('idle');
        toast.success('白板已创建');
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setDialogBusy(false);
      }
    },
    [boards],
  );

  const handleRename = useCallback(
    async (title: string) => {
      const target = dialog?.mode === 'rename' ? dialog.board : null;
      if (!target) return;
      setDialogBusy(true);
      try {
        const newPath = titleToPath(title);
        const res = await renameBoard({
          path: target.path,
          newPath: newPath === target.path ? target.path : newPath,
          title,
        });
        setDialog(null);
        // 先本地改写列表：服务端列表刷新是异步的，等它回来之前侧栏会短暂
        // 显示旧名字（用户看到的就是「改名没生效」）。
        setBoards((list) =>
          (list || []).map((b) =>
            b.path === target.path ? {...b, path: res.path, title} : b,
          ),
        );
        // 改的是当前打开的这块：更新本地状态与地址栏
        if (currentRef.current?.path === target.path) {
          const content = writeTitle(
            pendingRef.current?.content ?? currentRef.current.content,
            title,
          );
          setCurrent((c) => (c ? {...c, path: res.path, title, content} : c));
          // 允许地址栏跟着改到新路径
          lastPushedRef.current = null;
        }
        void reloadList();
        toast.success('已重命名');
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setDialogBusy(false);
      }
    },
    [dialog, reloadList],
  );

  const handleDelete = useCallback(
    async (board: BoardSummary) => {
      if (!window.confirm(`删除白板「${board.title}」？此操作不可撤销。`)) return;
      try {
        await deleteBoard(board.path);
        setBoards((list) => (list || []).filter((b) => b.path !== board.path));
        if (currentRef.current?.path === board.path) {
          pendingRef.current = null;
          lastPushedRef.current = null;
          // 先改地址栏再清 current：反过来会让 effect 用旧 slug 多读一次
          history.replace('/whiteboard');
          setCurrent(null);
          setStatus('idle');
        }
        void reloadList();
        toast.success('已删除');
      } catch (err) {
        toast.error(errMsg(err));
      }
    },
    [history, reloadList],
  );

  // 重载：把服务端最新内容拉回来（冲突时用）
  const handleReload = useCallback(async () => {
    const cur = currentRef.current;
    if (!cur) return;
    pendingRef.current = null;
    setStatus('idle');
    try {
      const payload = await readBoard(cur.path);
      const content = ensureScene(payload.content);
      setCurrent({
        path: payload.path,
        title: payload.title || pathToTitle(payload.path),
        rev: payload.rev,
        content,
      });
      toast.success('已载入最新版本');
    } catch (err) {
      toast.error(errMsg(err));
    }
  }, []);

  // ── 渲染 ──────────────────────────────────────────

  return (
    <Layout title="私有白板" description="仅自己可见的白板">
      <Toaster position="top-center" toastOptions={{duration: 4000}} />
      {!mounted ? null : !token ? (
        <LoginForm
          title="私有白板"
          submitLabel="解锁"
          onSubmit={async (key) => {
            const t = await unlock(key);
            setToken(t);
            toast.success('已解锁');
          }}
        />
      ) : (
        <div className={styles.shell}>
          <div className={styles.body}>
            {!collapsed && (
              <div
                className={styles.sidebarScrim}
                onClick={() => setCollapsed(true)}
                role="presentation"
              />
            )}
            <BoardList
              boards={boards}
              activePath={current?.path ?? null}
              loading={loadingList}
              collapsed={collapsed}
              onSelect={(p) => void openBoard(p)}
              onCreate={() => setDialog({mode: 'create'})}
              onFit={() => {
                apiRef.current?.scrollToContent(undefined, {fitToContent: true});
              }}
              onRename={(b) => setDialog({mode: 'rename', board: b})}
              onDelete={(b) => void handleDelete(b)}
              onToggleCollapse={() => setCollapsed((v) => !v)}
              footer={
                <SaveIndicator
                  status={status}
                  savedAt={savedAt}
                  onRetry={() => {
                    setStatus('dirty');
                    void flush({force: true});
                  }}
                  onReload={() => void handleReload()}
                />
              }
            />

            <div className={styles.contentCol}>
              <div className={styles.canvasArea}>
                {loadingBoard ? (
                  <p className={styles.canvasFallback}>加载白板中…</p>
                ) : current ? (
                  <BrowserOnly fallback={<p className={styles.canvasFallback}>正在加载画布…</p>}>
                    {() => (
                      <Suspense fallback={<p className={styles.canvasFallback}>正在加载画布…</p>}>
                        <BoardCanvas
                          path={current.path}
                          content={current.content}
                          onChange={handleCanvasChange}
                          onReady={(api) => {
                            apiRef.current = api;
                          }}
                        />
                      </Suspense>
                    )}
                  </BrowserOnly>
                ) : (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>还没有打开白板</p>
                    <p>
                      {boards && boards.length > 0
                        ? '从左侧选择一块，或新建一块空白白板。'
                        : '点左上角的 + 开始第一块白板。'}
                    </p>
                    <button
                      type="button"
                      className={styles.emptyAction}
                      onClick={() => setDialog({mode: 'create'})}>
                      新建白板
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <NameDialog
            open={dialog !== null}
            mode={shownDialog?.mode === 'rename' ? 'rename' : 'create'}
            initialTitle={shownDialog?.mode === 'rename' ? shownDialog.board.title : ''}
            busy={dialogBusy}
            onCancel={() => setDialog(null)}
            onSubmit={(title) => {
              if (dialog?.mode === 'rename') void handleRename(title);
              else void handleCreate(title);
            }}
          />
        </div>
      )}
    </Layout>
  );
}
