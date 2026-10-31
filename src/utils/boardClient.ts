/**
 * 私有白板 API 客户端。
 *
 * 与私有文档/在线编辑共用同一个 session token（`docs-editor-token`），
 * 没有第二套解锁。后端挂载点与私有文档一致（nginx `/editor/api/` →
 * steward `/docs-api/`），只是路径前缀换成 `/boards`：
 *
 *   GET    /editor/api/boards            列表
 *   GET    /editor/api/boards/read       读单个白板
 *   POST   /editor/api/boards/save       保存（带 base_rev 做并发检测）
 *   POST   /editor/api/boards/create     新建（空场景）
 *   POST   /editor/api/boards/rename     改名 / 移动
 *   POST   /editor/api/boards/delete     删除
 *
 * 接口约定详见 docs/project-iteration/private-whiteboard-api.md。
 */

import type {
  BoardPayload,
  BoardSummary,
  CallOptions,
  CreateBoardArgs,
  RenameBoardArgs,
  SaveBoardArgs,
} from '../types/boardTypes';

const API = '/editor/api/boards';
const TOKEN_KEY = 'docs-editor-token';

// 与私有文档/编辑器同名事件：401 时整站一起回登录页。
export const UNAUTHORIZED_EVENT = 'docs-editor:unauthorized';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * 用密钥解锁（与在线编辑器、私有文档完全相同的接口与 token）。
 * @returns session token
 */
export async function unlock(key: string): Promise<string> {
  const res = await fetch('/editor/api/unlock', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({key}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  sessionStorage.setItem(TOKEN_KEY, data.token);
  return data.token;
}

/**
 * 保存冲突：服务端 rev 与客户端 base_rev 不一致，说明另一个标签页/设备
 * 已经改过这份白板。调用方据此暂停自动保存并提示用户选择覆盖或重载。
 */
export class ConflictError extends Error {
  readonly rev: number;

  constructor(rev: number) {
    super('这份白板在别处被修改过');
    this.name = 'ConflictError';
    this.rev = rev;
  }
}

// 返回值形状由后端决定，调用点各取所需（同 privateClient 的处理方式）。
async function call(path: string, options: CallOptions = {}): Promise<any> {
  const headers = {...(options.headers || {})};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    if (res.status === 409 && typeof data.rev === 'number') {
      throw new ConflictError(data.rev);
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

/** 白板列表（按 updated_at 降序）。 */
export async function fetchBoards(): Promise<BoardSummary[]> {
  const data = await call('');
  return data.boards || [];
}

/** 读取单个白板的场景 JSON。 */
export function readBoard(path: string): Promise<BoardPayload> {
  return call(`/read?path=${encodeURIComponent(path)}`);
}

/** 保存白板。baseRev 与服务端 rev 不一致时抛 ConflictError。 */
export function saveBoard({path, content, title, baseRev}: SaveBoardArgs): Promise<{
  ok: boolean;
  rev: number;
  updated_at: string;
}> {
  return call('/save', {
    method: 'POST',
    body: {path, content, title, base_rev: baseRev},
  });
}

/** 新建一块空白白板。 */
export function createBoard({path, title}: CreateBoardArgs): Promise<BoardPayload> {
  return call('/create', {method: 'POST', body: {path, title}});
}

/** 改名 / 移动白板（`new_path` 与 `path` 相同则只改标题）。 */
export function renameBoard({path, newPath, title}: RenameBoardArgs): Promise<{
  ok: boolean;
  path: string;
}> {
  return call('/rename', {
    method: 'POST',
    body: {path, new_path: newPath, title},
  });
}

/** 删除白板。 */
export function deleteBoard(path: string): Promise<{ok: boolean}> {
  return call('/delete', {method: 'POST', body: {path}});
}
