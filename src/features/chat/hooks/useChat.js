import { useCallback, useRef, useState } from 'react';
import { streamChat } from '../../../shared/utils/api.js';

/**
 * 对话状态管理：消息列表、当前 agent、流式输出与中断。
 * chatConfig 为使用者自带的对话模型配置（含 Key），只随请求临时转发。
 */
export function useChat({ onNotice, chatConfig } = {}) {
  const [messages, setMessages] = useState([]);
  const [agentId, setAgentId] = useState('general');
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef(null);
  const configRef = useRef(chatConfig);
  configRef.current = chatConfig;

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(false);
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(false);
    setMessages([]);
  }, []);

  const send = useCallback(
    text => {
      const content = (text || '').trim();
      if (!content || streaming) return;

      const outgoing = [...messages, { role: 'user', content }];
      setMessages([...outgoing, { role: 'assistant', content: '' }]);
      setStreaming(true);

      controllerRef.current = streamChat({
        agentId,
        messages: outgoing,
        chatConfig: configRef.current,
        onDelta: delta => {
          setMessages(current => {
            const next = [...current];
            const last = next.length - 1;
            if (last >= 0 && next[last].role === 'assistant') {
              next[last] = { ...next[last], content: next[last].content + delta };
            }
            return next;
          });
        },
        onError: error => {
          setStreaming(false);
          controllerRef.current = null;
          setMessages(current => {
            const next = [...current];
            const last = next.length - 1;
            if (last >= 0 && next[last].role === 'assistant' && !next[last].content) {
              next.pop();
            }
            return next;
          });
          onNotice?.(error.message, 'error');
        },
        onDone: () => {
          setStreaming(false);
          controllerRef.current = null;
        },
      });
    },
    [agentId, messages, streaming, onNotice]
  );

  return { messages, agentId, setAgentId, streaming, send, stop, reset };
}
