/**
 * 与后端转发服务通信的封装层。
 *
 * 使用者自己的 API Key 存在浏览器本地，随请求临时传给后端转发；
 * 后端不保存、不回传任何凭据。
 */

async function requestJson(path, init = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error('无法连接工作台服务，请确认后端已启动。');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || `服务返回错误（${response.status}）。`);
  }

  return payload;
}

export function getHealth() {
  return requestJson('/api/health');
}

export function getAgents() {
  return requestJson('/api/agents');
}

/** 把一栏配置转成后端需要的凭据对象。 */
function toCredentials(channelConfig, mode) {
  return {
    baseUrl: channelConfig?.baseUrl || '',
    apiKey: channelConfig?.apiKey || '',
    model: channelConfig?.model || '',
    mode: mode || undefined,
  };
}

/** 轻量校验：用当前 Key 去拉一次模型列表，确认能否连通。 */
export function testConnection({ channel, channelConfig, mode }) {
  return requestJson('/api/test', {
    method: 'POST',
    body: JSON.stringify({ channel, credentials: toCredentials(channelConfig, mode) }),
  });
}

export function generateImage({ prompt, size, n, quality, imageConfig, mode }) {
  return requestJson('/api/image', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      size,
      n,
      quality,
      credentials: toCredentials(imageConfig, mode),
    }),
  });
}

export function pollImage({ taskId, imageConfig, mode }) {
  return requestJson('/api/image/status', {
    method: 'POST',
    body: JSON.stringify({ taskId, credentials: toCredentials(imageConfig, mode) }),
  });
}

/**
 * 流式对话。返回一个可用于中断的 controller。
 * onDelta(text) 在每次增量文本到达时调用；onDone() 正常结束；onError(error) 出错。
 */
export function streamChat({ agentId, messages, chatConfig, onDelta, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    let response;
    try {
      response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, messages, credentials: toCredentials(chatConfig) }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name !== 'AbortError')
        onError?.(new Error('无法连接工作台服务，请确认后端已启动。'));
      return;
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      onError?.(new Error(payload?.error || `服务返回错误（${response.status}）。`));
      return;
    }

    if (!response.body) {
      onError?.(new Error('当前环境不支持流式读取。'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamError = null;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const lines = block.split('\n');
          let event = 'message';
          const dataLines = [];

          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
          }

          const data = dataLines.join('\n');
          if (!data) continue;

          if (event === 'error') {
            try {
              streamError = new Error(JSON.parse(data).error || '对话出错。');
            } catch {
              streamError = new Error(data);
            }
            continue;
          }

          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) onDelta?.(delta);
          } catch {
            // 无法解析的分片直接忽略
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') streamError = new Error(`读取流失败：${error.message}`);
    }

    if (streamError) onError?.(streamError);
    else onDone?.();
  })();

  return controller;
}
