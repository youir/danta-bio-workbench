import { memo, useEffect, useRef, useState } from 'react';
import { ArrowRight, Broom, CircleNotch, GearSix, PaperPlaneRight, Sparkle, Stop } from '@phosphor-icons/react';
import { renderMarkdown } from '../../../shared/utils/markdown.js';

export const ChatPage = memo(({ agents, chat, chatReady, chatConfig, seed, onNotice, onOpenSettings }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const { messages, agentId, setAgentId, streaming, send, stop, reset } = chat;
  const activeAgent = agents.find(agent => agent.id === agentId) || agents[0];

  // 从工作区带入的上下文：填入输入框，由研究者确认后发送
  useEffect(() => {
    if (seed?.text) {
      setInput(seed.text);
      requestAnimationFrame(() => {
        const element = textareaRef.current;
        if (!element) return;
        element.focus();
        element.setSelectionRange(element.value.length, element.value.length);
      });
    }
  }, [seed]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  function submit() {
    if (!input.trim() || streaming) return;
    if (!chatReady) {
      onNotice?.('还没有填写对话模型的 API Key，请先完成设置。', 'warning');
      onOpenSettings?.();
      return;
    }
    send(input);
    setInput('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <section className="chat-page" aria-labelledby="chat-title">
      <div className="chat-head">
        <div>
          <div className="home-eyebrow">自然语言协作</div>
          <h1 id="chat-title">与研究助理对话</h1>
          <p className="chat-lede">
            选择一位角色，直接讨论你的研究问题。判断与结论始终由你和导师作出。
          </p>
        </div>
        <div className="chat-head-actions">
          {chatReady ? (
            <span className="config-pill">{chatConfig?.model || '已配置'}</span>
          ) : (
            <span className="config-pill warn">尚未填写 API Key</span>
          )}
          <button className="secondary-button" type="button" onClick={onOpenSettings}>
            <GearSix size={16} aria-hidden="true" />模型设置
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={reset}
            disabled={!messages.length && !streaming}
          >
            <Broom size={16} aria-hidden="true" />清空对话
          </button>
        </div>
      </div>

      <div className="agent-picker" role="tablist" aria-label="选择研究助理角色">
        {agents.map(agent => (
          <button
            key={agent.id}
            type="button"
            role="tab"
            aria-selected={agent.id === agentId}
            className={`agent-chip ${agent.id === agentId ? 'is-active' : ''}`}
            onClick={() => setAgentId(agent.id)}
            disabled={streaming}
          >
            <strong>{agent.label}</strong>
            <small>{agent.detail}</small>
          </button>
        ))}
      </div>

      <div className="chat-body" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <Sparkle size={22} weight="light" aria-hidden="true" />
            <h2>{activeAgent?.label}</h2>
            <p>{activeAgent?.detail}</p>
            <p className="chat-empty-note">
              写下你正在处理的观察、困惑或任务，我会先复述理解、再给出可核对的思路。
            </p>
            {!chatReady && (
              <button className="primary-button compact" type="button" onClick={onOpenSettings}>
                <GearSix size={16} aria-hidden="true" />填写我自己的 API Key
              </button>
            )}
          </div>
        )}

        {messages.map((message, index) => (
          <article key={index} className={`chat-bubble chat-${message.role}`}>
            <span className="chat-role">{message.role === 'user' ? '我' : activeAgent?.label || '研究助理'}</span>
            {message.role === 'assistant' ? (
              message.content ? (
                <div className="chat-content md-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
              ) : (
                <div className="chat-typing">
                  <CircleNotch size={16} className="spin" aria-hidden="true" />
                  正在整理回复…
                </div>
              )
            ) : (
              <div className="chat-content">{message.content}</div>
            )}
          </article>
        ))}
      </div>

      <div className="chat-composer">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            chatReady
              ? '例如：我怀疑某通路参与了这个表型，手头证据还缺什么？'
              : '先在「模型设置」里填写你自己的 API Key，然后就可以直接对话'
          }
          rows={3}
          disabled={streaming}
        />
        <div className="chat-composer-actions">
          <span className="chat-hint">Enter 发送 · Shift + Enter 换行</span>
          {streaming ? (
            <button className="secondary-button" type="button" onClick={stop}>
              <Stop size={16} aria-hidden="true" />停止
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={submit} disabled={!input.trim()}>
              发送 <PaperPlaneRight size={16} weight="fill" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <p className="local-note">
        API Key 只保存在你自己的浏览器 · 对话内容不会写入知识库
        <ArrowRight size={13} aria-hidden="true" />
      </p>
    </section>
  );
});

ChatPage.displayName = 'ChatPage';
