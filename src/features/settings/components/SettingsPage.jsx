import { memo, useEffect, useState } from 'react';
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Eye,
  EyeSlash,
  FolderOpen,
  Key,
  PlugsConnected,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { CHAT_PROVIDERS, IMAGE_PROVIDERS } from '../../../shared/constants/providers.js';
import { PROMPT_STARTERS } from '../../../shared/constants/workflows.js';
import { testConnection } from '../../../shared/utils/api.js';
import { VaultBuilder } from '../../vault/components/VaultBuilder.jsx';

const TABS = [
  { id: 'models', label: '模型与 API', hint: '对话与生图凭据' },
  { id: 'knowledge', label: '知识库', hint: '文件夹与匹配规则' },
  { id: 'about', label: '关于与数据', hint: '本地存储说明' },
];

const FILE_TYPE_OPTIONS = [
  { id: 'md', label: '.md' },
  { id: 'txt', label: '.txt' },
  { id: 'pdf', label: '.pdf' },
  { id: 'docx', label: '.docx' },
  { id: 'csv', label: '.csv' },
  { id: 'xlsx', label: '.xlsx' },
];

/** 单个模型服务配置卡片。 */
const ChannelCard = memo(
  ({ title, kicker, description, providers, preset, channelConfig, onSelectProvider, onChange, onTest, testing, testResult }) => {
    const [reveal, setReveal] = useState(false);
    const presetDef = providers.find(item => item.id === channelConfig.providerId) || providers[0];
    const listId = `model-list-${title}`;

    return (
      <section className="settings-card" aria-label={title}>
        <header className="settings-card-head">
          <div>
            <span className="panel-kicker">{kicker}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <span className={`config-pill ${preset ? '' : 'warn'}`}>{preset ? '已填写' : '待填写'}</span>
        </header>

        <div className="settings-field">
          <label htmlFor={`${listId}-provider`}>服务平台</label>
          <select
            id={`${listId}-provider`}
            value={channelConfig.providerId}
            onChange={event => onSelectProvider(event.target.value)}
          >
            {providers.map(item => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {presetDef.note && <small className="settings-help">{presetDef.note}</small>}
        </div>

        <div className="settings-field">
          <label htmlFor={`${listId}-base`}>Base URL</label>
          <input
            id={`${listId}-base`}
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder="https://api.example.com/v1"
            value={channelConfig.baseUrl}
            onChange={event => onChange({ baseUrl: event.target.value })}
          />
          <small className="settings-help">填写到 /v1 为止，末尾不要带斜杠。</small>
        </div>

        <div className="settings-field">
          <label htmlFor={`${listId}-key`}>
            API Key
            {presetDef.keyUrl && (
              <a className="settings-keylink" href={presetDef.keyUrl} target="_blank" rel="noreferrer">
                获取 Key <ArrowSquareOut size={12} aria-hidden="true" />
              </a>
            )}
          </label>
          <div className="settings-keyrow">
            <input
              id={`${listId}-key`}
              type={reveal ? 'text' : 'password'}
              spellCheck={false}
              autoComplete="off"
              placeholder={presetDef.keyHint || 'sk-…'}
              value={channelConfig.apiKey}
              onChange={event => onChange({ apiKey: event.target.value })}
            />
            <button className="ghost-icon-button" type="button" onClick={() => setReveal(value => !value)} aria-label={reveal ? '隐藏 Key' : '显示 Key'}>
              {reveal ? <EyeSlash size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
          <small className="settings-help"><Key size={12} aria-hidden="true" />只保存在你自己的浏览器里，随请求临时转发，服务端不存储。</small>
        </div>

        <div className="settings-field">
          <label htmlFor={`${listId}-model`}>模型</label>
          <input
            id={`${listId}-model`}
            type="text"
            list={listId}
            spellCheck={false}
            autoComplete="off"
            placeholder="模型名，例如 gpt-image-2.5-sunburst"
            value={channelConfig.model}
            onChange={event => onChange({ model: event.target.value })}
          />
          <datalist id={listId}>
            {(presetDef.models || []).map(model => (
              <option key={model} value={model} />
            ))}
          </datalist>
          <small className="settings-help">可从下拉中选择，也可以直接输入其他模型名。</small>
        </div>

        <div className="settings-card-actions">
          <button className="secondary-button" type="button" onClick={onTest} disabled={testing}>
            {testing ? (
              <>
                <CircleNotch size={15} className="spin" aria-hidden="true" />测试中…
              </>
            ) : (
              <>
                <PlugsConnected size={15} aria-hidden="true" />测试连接
              </>
            )}
          </button>
          {testResult?.ok && (
            <span className="settings-test ok">
              <CheckCircle size={14} weight="fill" aria-hidden="true" />
              连接正常 · 可用模型 {testResult.modelCount} 个
              {testResult.modelAvailable === false && '（当前模型名未在列表中，请核对）'}
            </span>
          )}
          {testResult?.error && (
            <span className="settings-test bad">
              <WarningCircle size={14} weight="fill" aria-hidden="true" />
              {testResult.error}
            </span>
          )}
        </div>
      </section>
    );
  }
);
ChannelCard.displayName = 'ChannelCard';

export const SettingsPage = memo(
  ({
    settings,
    chatReady,
    imageReady,
    serverKeys,
    onSelectProvider,
    onChangeChannel,
    onUpdateKnowledge,
    onToggleKnowledgeList,
    onClearSecrets,
    onResetAll,
    folderInputRef,
    onPickFolder,
    onFolderInputChange,
    onManualFolder,
    onFolderName,
    onNotice,
  }) => {
    const [tab, setTab] = useState('models');
    const [testing, setTesting] = useState({ chat: false, image: false });
    const [results, setResults] = useState({ chat: null, image: null });
    const [manualFolder, setManualFolder] = useState('');

    useEffect(() => {
      folderInputRef?.current?.setAttribute('webkitdirectory', '');
      folderInputRef?.current?.setAttribute('directory', '');
    }, [folderInputRef]);

    async function runTest(channel) {
      const channelConfig = settings[channel];
      setTesting(current => ({ ...current, [channel]: true }));
      setResults(current => ({ ...current, [channel]: null }));
      try {
        const payload = await testConnection({
          channel,
          channelConfig,
          mode: channel === 'image' ? settings.imageProviderMode : undefined,
        });
        setResults(current => ({ ...current, [channel]: payload }));
      } catch (error) {
        setResults(current => ({ ...current, [channel]: { error: error.message } }));
      } finally {
        setTesting(current => ({ ...current, [channel]: false }));
      }
    }

    const { knowledge } = settings;

    return (
      <section className="settings-page" aria-labelledby="settings-title">
        <div className="home-eyebrow">工作台设置</div>
        <h1 id="settings-title">模型、凭据与知识库</h1>
        <p className="subpage-lede">
          本工作台不内置任何 API Key。填写你自己的 Key 即可启用对话与生图；所有配置只保存在本机浏览器。
        </p>

        <div className="settings-layout">
          <nav className="settings-tabs" aria-label="设置分类">
            {TABS.map(item => (
              <button
                key={item.id}
                type="button"
                className={`settings-tab ${tab === item.id ? 'is-active' : ''}`}
                aria-current={tab === item.id ? 'true' : undefined}
                onClick={() => setTab(item.id)}
              >
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </button>
            ))}
          </nav>

          <div className="settings-panel">
            {tab === 'models' && (
              <>
                {(serverKeys?.chatConfigured || serverKeys?.imageConfigured) && (
                  <div className="settings-banner">
                    <PlugsConnected size={16} weight="fill" aria-hidden="true" />
                    本服务端已配置兜底 Key，暂未填写的项会自动使用它；填写你自己的 Key 将优先生效。
                  </div>
                )}
                <ChannelCard
                  title="对话模型"
                  kicker="自然语言与 Agent"
                  description="承载选题、论文、PPT、组会、日报、机制图六个角色。需支持 OpenAI 兼容的 /chat/completions。"
                  providers={CHAT_PROVIDERS}
                  preset={chatReady}
                  channelConfig={settings.chat}
                  onSelectProvider={value => onSelectProvider('chat', value)}
                  onChange={patch => onChangeChannel('chat', patch)}
                  onTest={() => runTest('chat')}
                  testing={testing.chat}
                  testResult={results.chat}
                />

                <ChannelCard
                  title="图片生成"
                  kicker="机制图出图"
                  description="用于机制示意图生成。平台为任务制时，提交后由前端自动轮询进度。"
                  providers={IMAGE_PROVIDERS}
                  preset={imageReady}
                  channelConfig={settings.image}
                  onSelectProvider={value => onSelectProvider('image', value)}
                  onChange={patch => onChangeChannel('image', patch)}
                  onTest={() => runTest('image')}
                  testing={testing.image}
                  testResult={results.image}
                />
              </>
            )}

            {tab === 'knowledge' && (
              <>
                <section className="settings-card" aria-label="知识库文件夹">
                  <header className="settings-card-head">
                    <div>
                      <span className="panel-kicker">本地资料</span>
                      <h2>知识库文件夹</h2>
                      <p>选择你本机的文献或笔记文件夹。浏览器不会把真实磁盘路径交给网页，这里只记录文件夹名称，不扫描、不上传、不读取内容。</p>
                    </div>
                  </header>

                  <div className="settings-field">
                    <label>已选择</label>
                    <div className="settings-folder">
                      <span className={`status-dot ${knowledge.folderName ? 'selected' : ''}`} aria-hidden="true" />
                      <strong>{knowledge.folderName || '尚未选择文件夹'}</strong>
                      <button className="secondary-button compact" type="button" onClick={onPickFolder}>
                        <FolderOpen size={15} aria-hidden="true" />{knowledge.folderName ? '重新选择' : '选择文件夹'}
                      </button>
                    </div>
                    <input ref={folderInputRef} type="file" hidden onChange={onFolderInputChange} />
                    <small className="settings-help">
                      选择后会弹出一个文件夹窗口（确认按钮在 macOS 上就叫「打开」）。<strong>文件夹里没有任何文件时取不到名称</strong>，此时可以用下方的一键构建把它建成标准骨架，或手动填写名称。
                    </small>
                  </div>

                  <div className="settings-field">
                    <label htmlFor="manual-folder">手动填写名称或路径</label>
                    <div className="settings-keyrow">
                      <input
                        id="manual-folder"
                        type="text"
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="例如：文献库 或 ~/Documents/我的课题"
                        value={manualFolder}
                        onChange={event => setManualFolder(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            onManualFolder?.(manualFolder);
                          }
                        }}
                      />
                      <button
                        className="secondary-button compact"
                        type="button"
                        onClick={() => onManualFolder?.(manualFolder)}
                      >
                        保存
                      </button>
                    </div>
                    <small className="settings-help">浏览器读不到真实路径，手动填写的内容会原样写进启动语的路径提示里。</small>
                  </div>
                </section>

                <section className="settings-card" aria-label="一键构建知识库">
                  <header className="settings-card-head">
                    <div>
                      <span className="panel-kicker">从零开始</span>
                      <h2>文件夹是空的？直接建一套</h2>
                      <p>
                        没有现成资料库也能开工。下面是三条通道，任选一条把标准骨架落到本机，模板已按科研记录的习惯排好。
                      </p>
                    </div>
                  </header>
                  <VaultBuilder onNotice={onNotice} onFolderName={onFolderName} />
                </section>

                <section className="settings-card" aria-label="匹配规则">
                  <header className="settings-card-head">
                    <div>
                      <span className="panel-kicker">匹配规则</span>
                      <h2>检索与关联</h2>
                      <p>决定内容生成时如何引用你的资料。这些是偏好设置，不会自动上传任何文件。</p>
                    </div>
                  </header>

                  <div className="settings-field">
                    <label>引用方式</label>
                    <div className="settings-radio-row">
                      <label className={`settings-radio ${knowledge.matchMode === 'manual' ? 'is-active' : ''}`}>
                        <input
                          type="radio"
                          name="matchMode"
                          checked={knowledge.matchMode === 'manual'}
                          onChange={() => onUpdateKnowledge({ matchMode: 'manual' })}
                        />
                        <span><strong>手动引用</strong><small>由我决定每次引用哪些资料</small></span>
                      </label>
                      <label className={`settings-radio ${knowledge.matchMode === 'auto' ? 'is-active' : ''}`}>
                        <input
                          type="radio"
                          name="matchMode"
                          checked={knowledge.matchMode === 'auto'}
                          onChange={() => onUpdateKnowledge({ matchMode: 'auto' })}
                        />
                        <span><strong>自动匹配</strong><small>按主题自动关联相关文件</small></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label>纳入的文件类型</label>
                    <div className="settings-chips">
                      {FILE_TYPE_OPTIONS.map(option => (
                        <button
                          key={option.id}
                          type="button"
                          className={`chip-toggle ${knowledge.fileTypes.includes(option.id) ? 'is-on' : ''}`}
                          aria-pressed={knowledge.fileTypes.includes(option.id)}
                          onClick={() => onToggleKnowledgeList('fileTypes', option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-field">
                    <label>关联的工作区</label>
                    <div className="settings-chips">
                      {PROMPT_STARTERS.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          className={`chip-toggle ${knowledge.linkedWorkflows.includes(item.id) ? 'is-on' : ''}`}
                          aria-pressed={knowledge.linkedWorkflows.includes(item.id)}
                          onClick={() => onToggleKnowledgeList('linkedWorkflows', item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={knowledge.autoAttach}
                      onChange={event => onUpdateKnowledge({ autoAttach: event.target.checked })}
                    />
                    <span><strong>生成启动语时附带知识库路径提示</strong><small>仅写入路径文字，不会读取文件内容</small></span>
                  </label>
                </section>
              </>
            )}

            {tab === 'about' && (
              <section className="settings-card" aria-label="关于与数据">
                <header className="settings-card-head">
                  <div>
                    <span className="panel-kicker">说明</span>
                    <h2>数据与隐私</h2>
                    <p>全部配置存储在本机浏览器的 localStorage，不上传、不同步。</p>
                  </div>
                </header>
                <ul className="settings-list">
                  <li>API Key：仅存于本机浏览器；调用时临时转发给服务端，服务端不落盘、不记录。</li>
                  <li>公开链接：分享给他人时，对方需填写自己的 Key，彼此互不可见。</li>
                  <li>知识库：只记录你选择的文件夹名称，网页无法读取其中内容。</li>
                  <li>对话记录：仅存在于当前页面内存，刷新即清空，不写入任何数据库。</li>
                </ul>
                <div className="settings-card-actions">
                  <button className="secondary-button" type="button" onClick={() => { onClearSecrets(); onNotice?.('已清除本机保存的 API Key。', 'success'); }}>
                    <Trash size={15} aria-hidden="true" />清除已保存的 Key
                  </button>
                  <button className="danger-button" type="button" onClick={() => { onResetAll(); onNotice?.('已恢复默认设置。', 'success'); }}>
                    恢复全部默认
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </section>
    );
  }
);

SettingsPage.displayName = 'SettingsPage';
