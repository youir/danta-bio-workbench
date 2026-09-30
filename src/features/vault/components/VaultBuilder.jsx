import { memo, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Copy,
  DownloadSimple,
  FolderOpen,
  Lightning,
  TreeStructure,
  WarningCircle,
} from '@phosphor-icons/react';
import { VAULT_DIRS, buildShellScript, buildWorkbuddyPrompt } from '../../../shared/constants/vaultTemplate.js';
import {
  copyText,
  downloadText,
  pickWritableFolder,
  scanFolder,
  supportsWritableFolder,
  templateStats,
  writeVaultToFolder,
} from '../../../shared/utils/vaultBuilder.js';

/**
 * 一键构建知识库。
 *
 * 若选中的文件夹是空的，或用户想补全模板，都可以用它生成一套标准骨架。
 * 三条通道：浏览器直写 / 复制给 AI 代理 / 下载脚本。
 * 共同规矩：已存在的文件一律跳过，不覆盖。
 */
export const VaultBuilder = memo(({ onNotice, onFolderName, compact = false }) => {
  const stats = useMemo(() => templateStats(), []);
  const handleRef = useRef(null);
  const [targetPath, setTargetPath] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | scanning | ready | writing | done
  const [scan, setScan] = useState(null);
  const [result, setResult] = useState(null);
  const writable = supportsWritableFolder();

  async function chooseAndScan() {
    setPhase('scanning');
    setResult(null);
    const picked = await pickWritableFolder();

    if (!picked.supported) {
      setPhase('idle');
      onNotice?.('当前浏览器不支持直接写入文件夹，请改用「复制指令给 WorkBuddy」或「下载构建脚本」。', 'info');
      return;
    }
    if (picked.cancelled) {
      setPhase('idle');
      return;
    }
    if (picked.error) {
      setPhase('idle');
      onNotice?.(`没能打开文件夹（${picked.error}）。可以改用复制指令或下载脚本。`, 'warning');
      return;
    }

    handleRef.current = picked.handle;
    const info = await scanFolder(picked.handle);
    setScan({ ...info, name: picked.name });
    setPhase('ready');
    onFolderName?.(picked.name);

    if (info.isEmpty) {
      onNotice?.(`「${picked.name}」是空文件夹。点「开始构建」即可生成 ${stats.fileCount} 个模板文件。`, 'info');
    }
  }

  async function runBuild() {
    if (!handleRef.current) {
      await chooseAndScan();
      return;
    }
    setPhase('writing');
    const outcome = await writeVaultToFolder(handleRef.current);
    setResult(outcome);
    setPhase('done');
    const after = await scanFolder(handleRef.current);
    setScan(current => ({ ...after, name: current?.name || '已选择文件夹' }));

    if (outcome.failed.length) {
      onNotice?.(`构建完成，但有 ${outcome.failed.length} 个文件失败（见下方清单）。`, 'warning');
    } else {
      onNotice?.(`知识库构建完成：新建 ${outcome.created} 个文件，跳过 ${outcome.skipped} 个已存在文件。`, 'success');
    }
  }

  async function copyPrompt() {
    try {
      await copyText(buildWorkbuddyPrompt(targetPath.trim()));
      onNotice?.('已复制构建指令。粘贴给 WorkBuddy，它会在本机把知识库建好。', 'success');
    } catch {
      onNotice?.('剪贴板不可用，请手动选中指令内容复制。', 'error');
    }
  }

  function downloadScript() {
    downloadText('构建科研知识库.sh', buildShellScript());
    onNotice?.('脚本已下载。执行方式：bash ~/Downloads/构建科研知识库.sh', 'success');
  }

  return (
    <div className={`vault-builder ${compact ? 'is-compact' : ''}`}>
      <div className="vault-builder-head">
        <span className="panel-kicker">骨架生成</span>
        <h3>一键构建知识库</h3>
        <p>
          按标准结构生成一套可直接用的科研笔记骨架：<strong>{stats.dirCount}</strong> 个目录、
          <strong>{stats.fileCount}</strong> 个文件（含各类模板），约 {Math.round(stats.bytes / 1024)} KB。
          已存在的文件一律跳过，不会覆盖你写好的内容。
        </p>
      </div>

      <ul className="vault-builder-dirs">
        {VAULT_DIRS.map(dir => (
          <li key={dir}>
            <TreeStructure size={13} aria-hidden="true" />
            {dir}
          </li>
        ))}
      </ul>

      {!writable && (
        <div className="vault-build-note">
          <WarningCircle size={16} aria-hidden="true" />
          <span>
            当前浏览器（多为 Safari / 火狐）不允许网页直接写磁盘。请用下面两条通道之一：把指令交给 WorkBuddy
            在本机执行，或下载脚本后在终端运行。
          </span>
        </div>
      )}

      {phase === 'ready' || phase === 'writing' || phase === 'done' ? (
        <div className="vault-scanline">
          <span className={`status-dot ${scan?.isEmpty ? '' : 'selected'}`} aria-hidden="true" />
          <div>
            <strong>{scan?.name || '已选择文件夹'}</strong>
            <small>
              {scan?.truncated ? '（已统计前 400 项）' : ''}
              现有 {scan?.fileCount ?? 0} 个文件、{scan?.dirCount ?? 0} 个子目录
              {scan?.isEmpty ? ' —— 空的，正好从零构建' : ''}
            </small>
          </div>
        </div>
      ) : null}

      <div className="vault-builder-actions">
        <button
          className="primary-button"
          type="button"
          onClick={chooseAndScan}
          disabled={!writable || phase === 'scanning' || phase === 'writing'}
          title={writable ? '直接用浏览器把模板写进文件夹' : '当前浏览器不支持，请用下方两条通道'}
        >
          <FolderOpen size={16} aria-hidden="true" />
          {phase === 'scanning' ? '正在读取…' : handleRef.current ? '换一个文件夹' : '选择文件夹'}
        </button>

        <button
          className="secondary-button"
          type="button"
          onClick={runBuild}
          disabled={!handleRef.current || phase === 'writing'}
        >
          <Lightning size={16} aria-hidden="true" />
          {phase === 'writing' ? '正在生成…' : '开始构建'}
        </button>

        <button className="secondary-button" type="button" onClick={copyPrompt}>
          <Copy size={16} aria-hidden="true" />
          复制指令给 WorkBuddy
        </button>

        <button className="secondary-button" type="button" onClick={downloadScript}>
          <DownloadSimple size={16} aria-hidden="true" />
          下载构建脚本
        </button>
      </div>

      <div className="vault-builder-target">
        <label htmlFor="vault-target-path">目标路径（可选，只用于指令与脚本）</label>
        <input
          id="vault-target-path"
          type="text"
          spellCheck={false}
          autoComplete="off"
          placeholder="例如：~/Documents/科研知识库"
          value={targetPath}
          onChange={event => setTargetPath(event.target.value)}
        />
        <small>
          浏览器不会把真实路径交给网页，所以「直接写入」通道用的是你刚选中的文件夹，这里的路径只用于生成指令和脚本。
        </small>
      </div>

      {result && (
        <div className="vault-builder-result">
          <div className="vault-result-line">
            <CheckCircle size={16} weight="fill" aria-hidden="true" />
            新建 {result.created} 个文件，跳过 {result.skipped} 个已存在文件
          </div>
          {result.failed.length > 0 && (
            <ul className="vault-result-failed">
              {result.failed.map(item => (
                <li key={item.path}>
                  {item.path} —— {item.reason}
                </li>
              ))}
            </ul>
          )}
          <small>下一步：用 Obsidian「打开文件夹作为仓库」指向该目录，即可开始记笔记。</small>
        </div>
      )}
    </div>
  );
});

VaultBuilder.displayName = 'VaultBuilder';
