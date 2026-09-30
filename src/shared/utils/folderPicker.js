/**
 * 本地文件夹选择。
 *
 * 浏览器出于安全考虑，**永远不会**把真实磁盘路径交给网页（拿不到 /Users/xxx/…）。
 * 我们最多能拿到文件夹「名称」，用于在启动语里写一句路径提示。
 *
 * 两条通道，按可用性择优：
 *
 * 1. File System Access API（`showDirectoryPicker`，Chrome / Edge 支持）
 *    - 直接返回文件夹句柄 → 空文件夹也能读到名称；
 *    - 不需要枚举目录下成百上千个文件，秒回。
 *
 * 2. `webkitdirectory` 文件选择（其余浏览器的兜底）
 *    - 只能从返回的文件列表里反推第一层目录名；
 *    - 文件夹里没有可读文件时返回空列表，此时拿不到任何信息。
 */

export function supportsDirectoryPicker() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * 调起目录选择器。返回文件夹名称。
 * - 用户取消 → 返回 { cancelled: true }
 * - 不支持该 API → 返回 { supported: false }，由调用方走 input 兜底
 */
export async function pickFolderName() {
  if (!supportsDirectoryPicker()) return { supported: false };

  try {
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    return { supported: true, name: handle?.name || '' };
  } catch (error) {
    if (error?.name === 'AbortError') return { supported: true, cancelled: true };
    return { supported: true, error: error?.name || 'unknown' };
  }
}

/**
 * 从 `webkitdirectory` 返回的文件列表里反推文件夹名。
 * 空列表（文件夹里没有任何可读文件）时 name 为空字符串。
 */
export function folderNameFromFiles(fileList) {
  const files = fileList ? [...fileList] : [];
  if (!files.length) return { name: '', fileCount: 0 };

  const first = files[0];
  const name = first.webkitRelativePath?.split('/')[0] || first.name || '';
  return { name, fileCount: files.length };
}
