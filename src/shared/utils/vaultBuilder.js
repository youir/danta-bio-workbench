/**
 * 知识库骨架落地工具。
 *
 * 说清楚一件事：网页（哪怕是部署在云端的这个页面）默认**无法**写你的本地磁盘。
 * 唯一能让浏览器直接写盘的通道是 File System Access API（Chrome / Edge）：
 * 用户主动授予「读写」权限后，网页拿到目录句柄，可以创建子目录与文件。
 *
 * 所以本文件提供两条真实可用的通道：
 *   - writeVaultToFolder()  浏览器直写（需 Chrome / Edge + 用户授权）
 *   - 复制指令 / 下载脚本    交给本机 AI 代理或终端执行（Safari / 火狐 走这条）
 *
 * 所有写入都遵循同一条规矩：**已存在的文件一律跳过，绝不覆盖**。
 */

import { VAULT_DIRS, renderTemplate, templateStats } from '../constants/vaultTemplate.js';

export function supportsWritableFolder() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * 申请一个可写的目录句柄。
 * 返回 { supported, cancelled, handle, name, error }
 */
export async function pickWritableFolder() {
  if (!supportsWritableFolder()) return { supported: false };

  try {
    const handle = await window.showDirectoryPicker({ id: 'danta-vault', mode: 'readwrite' });
    return { supported: true, handle, name: handle?.name || '' };
  } catch (error) {
    if (error?.name === 'AbortError') return { supported: true, cancelled: true };
    return { supported: true, error: error?.name || 'unknown' };
  }
}

/**
 * 扫描目录，用于判断「是不是空的」。
 * 只数到 limit 个条目就停，避免遇到超大资料库时卡住。
 */
export async function scanFolder(handle, limit = 400) {
  let fileCount = 0;
  let dirCount = 0;
  let truncated = false;
  const topLevel = [];

  async function walk(dir, depth) {
    for await (const entry of dir.values()) {
      if (fileCount + dirCount >= limit) {
        truncated = true;
        return;
      }
      if (depth === 0) topLevel.push(entry.name);
      if (entry.kind === 'directory') {
        dirCount += 1;
        await walk(entry, depth + 1);
      } else {
        fileCount += 1;
      }
      if (truncated) return;
    }
  }

  try {
    await walk(handle, 0);
  } catch (error) {
    return { fileCount, dirCount, isEmpty: false, truncated, topLevel, error: error?.name || 'unknown' };
  }

  return {
    fileCount,
    dirCount,
    isEmpty: fileCount === 0 && dirCount === 0,
    truncated,
    topLevel: topLevel.slice(0, 20),
  };
}

async function ensureDir(root, segments) {
  let current = root;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

async function fileExists(dir, name) {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * 把骨架写进目录。
 * @param {FileSystemDirectoryHandle} handle
 * @param {{ overwrite?: boolean }} options
 * @returns {{ created: number, skipped: number, failed: Array<{path: string, reason: string}> }}
 */
export async function writeVaultToFolder(handle, { overwrite = false } = {}) {
  const files = renderTemplate();
  const result = { created: 0, skipped: 0, failed: [] };

  // 先建目录（用户能看到进度感），再写文件
  for (const dir of VAULT_DIRS) {
    try {
      await ensureDir(handle, dir.split('/'));
    } catch (error) {
      result.failed.push({ path: `${dir}/`, reason: error?.name || 'unknown' });
    }
  }

  for (const item of files) {
    const segments = item.path.split('/');
    const fileName = segments.pop();
    try {
      const dir = await ensureDir(handle, segments);
      if (!overwrite && (await fileExists(dir, fileName))) {
        result.skipped += 1;
        continue;
      }
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(item.content);
      await writable.close();
      result.created += 1;
    } catch (error) {
      result.failed.push({ path: item.path, reason: error?.name || 'unknown' });
    }
  }

  return result;
}

/** 触发一次文本文件下载。 */
export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 复制文本到剪贴板，带降级方案。 */
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  return ok;
}

export { templateStats };
