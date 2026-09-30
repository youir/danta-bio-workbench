import { memo, useState } from 'react';
import { FolderOpen, Info } from '@phosphor-icons/react';
import { VaultBuilder } from './VaultBuilder.jsx';

export const VaultConnection = memo(
  ({ vaultName, vaultStatus, onPickerChange, onRequestPick, onManualFolder, onNotice, pickerRef }) => {
    const [manual, setManual] = useState('');

    return (
      <section className="vault-connection" aria-labelledby="vault-connection-title">
        <div className="vault-connection-header">
          <div>
            <span className="panel-kicker">Obsidian · 本地知识库</span>
            <h2 id="vault-connection-title">知识库状态</h2>
          </div>
          <span className="vault-status-pill">{vaultStatus}</span>
        </div>
        <p>
          选择知识库文件夹后，网页只显示文件夹名称，不扫描、不上传、不读取其中内容。
          浏览器出于安全考虑不会把真实磁盘路径交给网页，所以这里只能记录「名称」。
          <strong>如果文件夹是空的，选择器取不到名称</strong> —— 这种情况直接用下方的一键构建，或手动填写名称。
        </p>

        <input ref={pickerRef} type="file" className="visually-hidden" onChange={onPickerChange} aria-label="选择本地知识库文件夹" />
        <button className="secondary-button" type="button" onClick={onRequestPick}>
          <FolderOpen size={18} aria-hidden="true" />
          {vaultName ? '重新选择文件夹' : '选择知识库文件夹'}
        </button>

        <div className="vault-manual">
          <label htmlFor="vault-manual-name">手动填写名称或路径</label>
          <div className="vault-manual-row">
            <input
              id="vault-manual-name"
              type="text"
              spellCheck={false}
              autoComplete="off"
              placeholder="例如：文献库 或 ~/Documents/我的课题"
              value={manual}
              onChange={event => setManual(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onManualFolder?.(manual);
                }
              }}
            />
            <button className="secondary-button compact" type="button" onClick={() => onManualFolder?.(manual)}>
              保存
            </button>
          </div>
        </div>

        {vaultName && (
          <div className="vault-info">
            <strong>已选择名称</strong>
            <code>{vaultName}</code>
          </div>
        )}

        <VaultBuilder onNotice={onNotice} onFolderName={onManualFolder} />

        <div className="connection-explainer">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>关于读取</strong>
            <p>
              研究记录、RSS 面板和归档目前在 Obsidian 知识库与插件中维护，尚未同步到本机网页。
              要接入网页，需要另行实现并由研究者确认授权范围。
            </p>
          </div>
        </div>
      </section>
    );
  }
);

VaultConnection.displayName = 'VaultConnection';
