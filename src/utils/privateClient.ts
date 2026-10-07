/**
 * 私有文档 API 客户端。
 *
 * 与在线编辑器共用同一套登录：token 就是编辑器 unlock 签发的
 * `docs-editor-token`，没有第二套解锁、没有加密派生。后端
 * （Steward /docs-editor/private/*）只认这个 token，保存即时生效、
 * 不进 git、不触发构建。
 */

const API = '/editor/api/private';
const TOKEN_KEY = 'docs-editor-token';

// 与编辑器页面同名事件：401 时两边一起回登录页。
export const UNAUTHORIZED_EVENT = 'docs-editor:unauthorized';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * 用密钥解锁（与在线编辑器完全相同的接口与 token）。
 * @returns {Promise<string>} session token
 */
export async function unlock(key) {
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

async function call(path, options = {}) {
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
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

/** 目录树（FileEntry 结构与编辑器 /tree 完全一致）。 */
export const fetchTree = () => call('/tree');

/** 读取一篇私有文档（含 front matter 的原始 markdown）。 */
export async function readDoc(path) {
  const {content} = await call(`/read?path=${encodeURIComponent(path)}`);
  return content;
}

/** 保存（新建或更新）私有文档，即时生效。 */
export function saveDoc({path, content}) {
  return call('/save', {method: 'POST', body: {path, content}});
}

/** 移动（改分类 / 改文件名），可选同时覆写内容。 */
export function moveDoc({path, newPath, content}) {
  const body = {path, new_path: newPath};
  if (content != null) body.content = content;
  return call('/move', {method: 'POST', body});
}

/** 删除一篇私有文档。 */
export function deleteDoc(path) {
  return call('/delete', {method: 'POST', body: {path}});
}

/** 新建/更新私有分类（_category_.json），即时生效。 */
export function saveCategory({path, label, description}) {
  return call('/category', {
    method: 'POST',
    body: {path, label, description: description || ''},
  });
}

/** 删除空的私有分类。 */
export function deleteCategory(path) {
  return call('/category/delete', {method: 'POST', body: {path}});
}
