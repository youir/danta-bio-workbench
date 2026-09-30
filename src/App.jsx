import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Titlebar } from './shared/components/Titlebar.jsx';
import { Sidebar } from './shared/components/Sidebar.jsx';
import { HomePage } from './features/home/components/HomePage.jsx';
import { WorkflowWorkspace } from './features/workflows/components/WorkflowWorkspace.jsx';
import { MechanismWorkspace } from './features/mechanism/components/MechanismWorkspace.jsx';
import { ResearchRecordsPage } from './features/records/components/ResearchRecordsPage.jsx';
import { LiteraturePage } from './features/literature/components/LiteraturePage.jsx';
import { VaultConnection } from './features/vault/components/VaultConnection.jsx';
import { ChatPage } from './features/chat/components/ChatPage.jsx';
import { SettingsPage } from './features/settings/components/SettingsPage.jsx';
import { KickoffModal } from './shared/components/KickoffModal.jsx';
import { Notice } from './shared/components/Notice.jsx';
import { useNotice } from './shared/hooks/useNotice.js';
import { useSettings } from './shared/hooks/useSettings.js';
import { useChat } from './features/chat/hooks/useChat.js';
import { PROMPT_STARTERS } from './shared/constants/workflows.js';
import { FALLBACK_AGENTS } from './shared/constants/agents.js';
import { makeKickoffPrompt } from './shared/utils/promptBuilder.js';
import { folderNameFromFiles, pickFolderName } from './shared/utils/folderPicker.js';
import { getAgents, getHealth } from './shared/utils/api.js';

import quickstartImage from '../docs/quickstart.jpg';
import frameworkImage from '../docs/workbench-map.jpg';

const INITIAL_DRAFTS = Object.fromEntries(PROMPT_STARTERS.map(workflow => [workflow.id, workflow.seed]));
const MECHANISM_SEED = '研究主题 / 核心发现：……\n已有证据或参考文献：……\n使用场景：PPT 汇报 / 论文插图';

const NAV_PAGES = ['start', 'chat', 'records', 'mechanism', 'literature', 'vault', 'settings'];

export function App() {
  const [activePage, setActivePage] = useState('start');
  const [homeThought, setHomeThought] = useState('');
  const [drafts, setDrafts] = useState(INITIAL_DRAFTS);
  const [taskFocus, setTaskFocus] = useState('自由讨论');
  const [mechanismBrief, setMechanismBrief] = useState(MECHANISM_SEED);
  const [mechanismReturnTo, setMechanismReturnTo] = useState('start');
  const [filesByWorkflow, setFilesByWorkflow] = useState({});
  const [showMechanismProcess, setShowMechanismProcess] = useState(false);
  const [kickoff, setKickoff] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState(null);
  const [agents, setAgents] = useState(FALLBACK_AGENTS);
  const [chatSeed, setChatSeed] = useState(null);

  const [notice, showNotice, hideNotice] = useNotice();
  const settingsStore = useSettings();
  const pickerRef = useRef(null);
  const settingsFolderRef = useRef(null);
  const dialogRef = useRef(null);
  const copyButtonRef = useRef(null);

  const { settings, chatReady, imageReady } = settingsStore;
  const chat = useChat({ onNotice: showNotice, chatConfig: settings.chat });

  const vaultName = settings.knowledge.folderName;

  useEffect(() => {
    let cancelled = false;
    Promise.all([getHealth().catch(() => null), getAgents().catch(() => null)]).then(
      ([healthPayload, agentsPayload]) => {
        if (cancelled) return;
        if (healthPayload) setHealth(healthPayload);
        if (agentsPayload?.agents?.length) setAgents(agentsPayload.agents);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // 两个兜底用的 file input 都需要 webkitdirectory 才能选到「文件夹」
    [pickerRef, settingsFolderRef].forEach(ref => {
      ref.current?.setAttribute('webkitdirectory', '');
      ref.current?.setAttribute('directory', '');
    });
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePage]);

  const workflow = useMemo(() => PROMPT_STARTERS.find(item => item.id === activePage), [activePage]);
  const vaultStatus = vaultName ? `已选择名称 · ${vaultName}` : '尚未选择知识库文件夹';
  const activeNav = NAV_PAGES.includes(activePage) ? activePage : 'start';

  function navigate(page) {
    if (page === 'mechanism') setMechanismReturnTo('start');
    if (page === 'start') setTaskFocus('自由讨论');
    setActivePage(page);
  }

  function openWorkflow(item) {
    setTaskFocus(item.focus);
    setActivePage(item.id);
  }

  function beginDiscussion(text, focus) {
    if (!text.trim()) {
      showNotice('先写下一件观察、困惑或正在处理的任务。', 'info');
      return;
    }
    setTaskFocus(focus);
    setKickoff(makeKickoffPrompt(text, focus, settings.knowledge));
    setCopied(false);
    setModalOpen(true);
  }

  // 带着上下文进入对话页：填入输入框，由研究者确认后发送
  const openChat = useCallback(
    (text = '', agentId = 'general') => {
      chat.setAgentId(agentId);
      setChatSeed({ text: (text || '').trim(), nonce: Date.now() });
      setActivePage('chat');
    },
    [chat]
  );

  async function copyKickoff() {
    try {
      await navigator.clipboard.writeText(kickoff);
      setCopied(true);
      showNotice('启动语已复制，可粘贴到 Codex 或 Claude Code 继续。', 'success');
    } catch {
      showNotice('无法访问剪贴板，请手动选择启动语复制。', 'error');
    }
  }

  function openMechanism(from = 'start') {
    setMechanismReturnTo(from);
    setShowMechanismProcess(false);
    setActivePage('mechanism');
  }

  function addFiles(workflowId, event) {
    const names = [...(event.target.files || [])].map(file => file.name);
    if (names.length) {
      setFilesByWorkflow(current => ({
        ...current,
        [workflowId]: [...new Set([...(current[workflowId] || []), ...names])],
      }));
      showNotice('已暂存所选文件名；当前页面不会读取文件内容。', 'info');
    }
    event.target.value = '';
  }

  function rememberFolder(name, extra = '') {
    settingsStore.updateKnowledge({ folderName: name });
    showNotice(`已记下文件夹名称「${name}」${extra}；网页不会读取其中的内容。`, 'success');
  }

  /**
   * 打开文件夹选择。
   * 优先走 File System Access API（空文件夹也能拿到名称），
   * 不支持时才回退到 webkitdirectory 的 file input。
   */
  async function requestFolderPick(inputRef = pickerRef) {
    const result = await pickFolderName();

    if (result?.supported) {
      if (result.cancelled) return;
      if (result.name) {
        rememberFolder(result.name);
        return;
      }
      showNotice(`没有取到文件夹名称（${result.error || '未知原因'}），改用文件选择方式。`, 'warning');
    }

    inputRef?.current?.click();
  }

  /** webkitdirectory 兜底通道：从文件列表反推文件夹名。 */
  function handleVaultPick(event) {
    const files = event.target.files;
    event.target.value = '';

    const { name, fileCount } = folderNameFromFiles(files);
    if (!name) {
      showNotice(
        '这个文件夹是空的，选择器读不到名称。可以直接用「一键构建知识库」把它建成标准骨架，或在下方手动填写名称。',
        'warning'
      );
      return;
    }
    rememberFolder(name, `（含 ${fileCount} 个文件）`);
  }

  /** 手动填写文件夹名称或路径（浏览器拿不到真实路径时的兜底）。 */
  function handleManualFolder(name) {
    const value = (name || '').trim();
    if (!value) {
      showNotice('名称不能为空。', 'warning');
      return;
    }
    rememberFolder(value);
  }

  function renderContent() {
    if (activePage === 'start') {
      return (
        <HomePage
          thought={homeThought}
          setThought={setHomeThought}
          taskFocus={taskFocus}
          onBegin={beginDiscussion}
          onChat={openChat}
          onOpenWorkflow={openWorkflow}
          onOpenRecords={() => navigate('records')}
        />
      );
    }
    if (activePage === 'chat') {
      return (
        <ChatPage
          agents={agents}
          chat={chat}
          chatReady={chatReady}
          chatConfig={settings.chat}
          seed={chatSeed}
          onNotice={showNotice}
          onOpenSettings={() => navigate('settings')}
        />
      );
    }
    if (workflow) {
      return (
        <WorkflowWorkspace
          workflow={workflow}
          thought={drafts[workflow.id] || ''}
          setThought={value => setDrafts(current => ({ ...current, [workflow.id]: value }))}
          files={filesByWorkflow[workflow.id] || []}
          onBack={() => navigate('start')}
          onBegin={beginDiscussion}
          onChat={openChat}
          chatConfigured={chatReady}
          onFilesAdded={event => addFiles(workflow.id, event)}
          onRemoveFile={name =>
            setFilesByWorkflow(current => ({
              ...current,
              [workflow.id]: (current[workflow.id] || []).filter(file => file !== name),
            }))
          }
          onOpenMechanism={() => openMechanism('ppt')}
        />
      );
    }
    if (activePage === 'mechanism') {
      return (
        <MechanismWorkspace
          brief={mechanismBrief}
          setBrief={setMechanismBrief}
          showProcess={showMechanismProcess}
          setShowProcess={setShowMechanismProcess}
          onBack={() => navigate(mechanismReturnTo)}
          onBegin={beginDiscussion}
          onNotice={showNotice}
          imageReady={imageReady}
          imageConfig={settings.image}
          onOpenSettings={() => navigate('settings')}
        />
      );
    }
    if (activePage === 'records') {
      return <ResearchRecordsPage onOpenVault={() => navigate('vault')} onOpenChat={() => openChat('', 'general')} />;
    }
    if (activePage === 'literature') return <LiteraturePage onOpenVault={() => navigate('vault')} />;
    if (activePage === 'settings') {
      return (
        <SettingsPage
          settings={settings}
          chatReady={chatReady}
          imageReady={imageReady}
          serverKeys={health?.serverKeys}
          onSelectProvider={settingsStore.selectProvider}
          onChangeChannel={settingsStore.updateChannel}
          onUpdateKnowledge={settingsStore.updateKnowledge}
          onToggleKnowledgeList={settingsStore.toggleKnowledgeList}
          onClearSecrets={settingsStore.clearSecrets}
          onResetAll={settingsStore.resetAll}
          folderInputRef={settingsFolderRef}
          onPickFolder={() => requestFolderPick(settingsFolderRef)}
          onFolderInputChange={handleVaultPick}
          onManualFolder={handleManualFolder}
          onFolderName={name => settingsStore.updateKnowledge({ folderName: name })}
          onNotice={showNotice}
        />
      );
    }
    return (
      <section className="subpage-view">
        <div className="home-eyebrow">本机资料</div>
        <h1>知识库</h1>
        <p className="subpage-lede">
          先确认你已有的本地知识库文件夹。当前网页只记下所选文件夹名称，不扫描或读取研究内容。
        </p>
        <VaultConnection
          vaultName={vaultName}
          vaultStatus={vaultStatus}
          pickerRef={pickerRef}
          onRequestPick={() => requestFolderPick(pickerRef)}
          onPickerChange={handleVaultPick}
          onManualFolder={handleManualFolder}
          onNotice={showNotice}
        />
      </section>
    );
  }

  return (
    <div className="app-frame">
      <Titlebar
        guideUrl={quickstartImage}
        frameworkUrl={frameworkImage}
        chatReady={chatReady}
        imageReady={imageReady}
        onOpenSettings={() => navigate('settings')}
      />
      <div className="app-body">
        <Sidebar activePage={activeNav} vaultName={vaultName} onNavigate={navigate} />
        <main className="main-content">{renderContent()}</main>
      </div>
      <KickoffModal
        isOpen={modalOpen}
        kickoffPrompt={kickoff}
        copied={copied}
        onCopy={copyKickoff}
        onClose={() => setModalOpen(false)}
        copyButtonRef={copyButtonRef}
        dialogRef={dialogRef}
      />
      <Notice message={notice.message} type={notice.type} onClose={hideNotice} />
    </div>
  );
}
