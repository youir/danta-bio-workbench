import { memo, useRef } from 'react';
import { ArrowRight, ClockCounterClockwise } from '@phosphor-icons/react';
import { PROMPT_STARTERS, getStartActionLabel } from '../../../shared/constants/workflows.js';

export const HomePage = memo(({ thought, setThought, taskFocus, onBegin, onChat, onOpenWorkflow, onOpenRecords }) => {
  const textareaRef = useRef(null);

  return (
    <section className="home-view" aria-labelledby="home-title">
      <div className="home-eyebrow">生物博士的研究工作台</div>
      <h1 id="home-title">今天，最想弄清楚什么？</h1>
      <p className="home-lede">写下一个观察、困惑或正在犹豫的决定。可以直接与研究助理对话，也可以先生成启动语带走。</p>

      <form className="thought-form" onSubmit={event => { event.preventDefault(); onChat(thought, 'general'); }}>
        <label className="visually-hidden" htmlFor="research-thought">写下研究观察、困惑或决定</label>
        <textarea
          id="research-thought"
          ref={textareaRef}
          value={thought}
          onChange={event => setThought(event.target.value)}
          onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') onChat(thought, 'general'); }}
          placeholder="例如：这个病理现象背后可能有哪些机制？我手头的证据还缺什么？"
          rows={4}
        />
        <div className="thought-actions">
          <button className="primary-button" type="submit">与 AI 讨论 <ArrowRight size={18} weight="bold" aria-hidden="true" /></button>
          <button className="secondary-button" type="button" onClick={() => onBegin(thought, taskFocus)}>{getStartActionLabel(taskFocus)}</button>
        </div>
      </form>

      <div className="quick-start-heading">
        <h2>或直接进入一项工作</h2>
        <p>每项工作都有自己的讨论页；启动语可以继续修改。</p>
      </div>
      <div className="workflow-entry-grid" aria-label="常用科研工作">
        {PROMPT_STARTERS.map((workflow, index) => (
          <button className="workflow-entry" key={workflow.id} type="button" onClick={() => onOpenWorkflow(workflow)}>
            <span className="workflow-entry-number">0{index + 1}</span>
            <span className="workflow-entry-copy"><strong>{workflow.label}</strong><small>{workflow.detail}</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        ))}
      </div>

      <button className="resume-row" type="button" onClick={onOpenRecords}>
        <ClockCounterClockwise size={20} aria-hidden="true" />
        <span className="resume-label">最近研究记录</span>
        <span className="resume-divider" aria-hidden="true" />
        <span className="resume-summary">研究记录尚未连接；进入后查看真实连接状态</span>
        <span className="inline-link">查看 <ArrowRight size={15} aria-hidden="true" /></span>
      </button>
      <p className="local-note">本机界面 · 不读取知识库内容 · 研究判断由研究者和导师作出</p>
    </section>
  );
});

HomePage.displayName = 'HomePage';
