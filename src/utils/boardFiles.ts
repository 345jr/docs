/**
 * 白板图片：场景里给 Excalidraw 的永远是 data URL，落盘前换成 r2: 引用。
 *
 * Excalidraw 0.18 把 files[].dataURL 直接赋给 img.src，并且缩放时按 data URL
 * 做 atob。所以线上地址不能进画布。引用格式 r2:<sha256>.<ext>，字节在 R2，
 * 浏览器经同源 /editor/api/boards/blob 用 Bearer 取回后再转回 data URL。
 */

import {fetchBlob, putBlob} from './boardClient';

const refByDataURL = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function decodeDataURL(dataURL: string): {mime: string; bytes: Uint8Array} | null {
  const comma = dataURL.indexOf(',');
  if (!dataURL.startsWith('data:') || comma < 0) return null;
  const meta = dataURL.slice('data:'.length, comma);
  if (!meta.endsWith(';base64')) return null;
  const mime = meta.slice(0, -';base64'.length) || 'application/octet-stream';
  let binary: string;
  try {
    binary = atob(dataURL.slice(comma + 1));
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return {mime, bytes};
}

function bytesToDataURL(mime: string, bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** 从 JSON 文本里读出一个字符串。value 为 null 表示引号配对了但 JSON.parse 失败。 */
function readJSONString(
  content: string,
  i: number,
): {end: number; value: string | null} | null {
  if (content[i] !== '"') return null;
  let j = i + 1;
  while (j < content.length) {
    const c = content.charCodeAt(j);
    if (content[j] === '\\') {
      if (j + 1 >= content.length) return null;
      j += 2;
      continue;
    }
    if (content[j] === '"') {
      try {
        const value: unknown = JSON.parse(content.slice(i, j + 1));
        if (typeof value !== 'string') return {end: j + 1, value: null};
        return {end: j + 1, value};
      } catch {
        return {end: j + 1, value: null};
      }
    }
    if (c < 0x20) return null;
    j++;
  }
  return null;
}

/**
 * 只替换 JSON 字符串的值，其余字节不动。replace 返回 null 表示保留原字符串。
 * 没有替换时返回原字符串（同一引用）。
 */
function replaceJSONStrings(
  content: string,
  replace: (value: string) => string | null,
): string {
  let out = '';
  let changed = false;
  let i = 0;
  while (i < content.length) {
    const quote = content.indexOf('"', i);
    if (quote < 0) {
      return changed ? out + content.slice(i) : content;
    }
    const parsed = readJSONString(content, quote);
    if (!parsed) throw new Error('场景 JSON 字符串未闭合');
    const next = parsed.value === null ? null : replace(parsed.value);
    if (next === null) {
      if (changed) out += content.slice(i, parsed.end);
    } else {
      if (!changed) out += content.slice(0, quote);
      else out += content.slice(i, quote);
      out += JSON.stringify(next);
      changed = true;
    }
    i = parsed.end;
  }
  return changed ? out : content;
}

function isDataURL(value: string): boolean {
  return value.startsWith('data:') && value.includes(';base64,');
}

function isRef(value: string): boolean {
  return /^r2:[0-9a-f]{64}\.[a-z0-9]+$/.test(value);
}

function collect(content: string, pred: (value: string) => boolean): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  replaceJSONStrings(content, (value) => {
    if (pred(value) && !seen.has(value)) {
      seen.add(value);
      found.push(value);
    }
    return null;
  });
  return found;
}

async function uploadDataURL(dataURL: string): Promise<string> {
  const cached = refByDataURL.get(dataURL);
  if (cached) return cached;
  const pending = inflight.get(dataURL);
  if (pending) return pending;
  const job = (async () => {
    const decoded = decodeDataURL(dataURL);
    if (!decoded) throw new Error('无法解析图片 data URL');
    const ref = await putBlob(decoded.bytes, decoded.mime);
    refByDataURL.set(dataURL, ref);
    return ref;
  })().finally(() => {
    inflight.delete(dataURL);
  });
  inflight.set(dataURL, job);
  return job;
}

/** 把场景里的 data URL 换成 r2: 引用。没有图片时返回原字符串。 */
export async function externalizeScene(content: string): Promise<string> {
  const urls = collect(content, isDataURL);
  if (urls.length === 0) return content;
  const refs = new Map<string, string>();
  await Promise.all(
    urls.map(async (url) => {
      refs.set(url, await uploadDataURL(url));
    }),
  );
  return replaceJSONStrings(content, (value) => refs.get(value) ?? null);
}

/**
 * 只用已经上传过的缓存替换，不发请求。关页面时 keepalive 请求体大约只有 64KB，
 * 来不及等上传，能瘦多少是多少，剩下的交给服务端保存时再外置。
 */
export function externalizeCached(content: string): string {
  if (!content.includes('"data:')) return content;
  return replaceJSONStrings(content, (value) => {
    if (!isDataURL(value)) return null;
    return refByDataURL.get(value) ?? null;
  });
}

/** 打开白板后把 r2: 引用拉回来，还原成 Excalidraw 能画的 data URL。 */
export async function hydrateScene(content: string): Promise<string> {
  const refs = collect(content, isRef);
  if (refs.length === 0) return content;
  const urls = new Map<string, string>();
  await Promise.all(
    refs.map(async (ref) => {
      try {
        const blob = await fetchBlob(ref.slice('r2:'.length));
        const dataURL = bytesToDataURL(blob.mime, new Uint8Array(blob.bytes));
        urls.set(ref, dataURL);
        refByDataURL.set(dataURL, ref);
      } catch {
        // 缺图就留着引用，画布上那一张不显示，其余内容照常打开。
      }
    }),
  );
  if (urls.size === 0) return content;
  return replaceJSONStrings(content, (value) => urls.get(value) ?? null);
}

/** 画布一变就后台上传新图片，自动保存时正文里只剩引用。失败忽略，保存时再试。 */
export function prefetchSceneImages(content: string): void {
  if (!content.includes('"data:')) return;
  let urls: string[];
  try {
    urls = collect(content, isDataURL);
  } catch {
    return;
  }
  for (const url of urls) {
    void uploadDataURL(url).catch(() => undefined);
  }
}
