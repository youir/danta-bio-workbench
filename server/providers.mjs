/**
 * 上游 API 配置与调用（对话 / 图片生成）。
 *
 * 凭据来源优先级：
 *   1. 请求体里携带的 credentials（使用者在网页上自己填写的 Key，只在本次请求内使用）
 *   2. 服务端环境变量（自部署时可选，作为兜底，方便本机调试）
 *
 * 服务端不保存、不记录、不回传任何使用者凭据。
 */

function env(name, fallback = '') {
  return (process.env[name] || fallback).trim();
}

function trimSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 解析一次对话请求的最终配置。
 * creds = { baseUrl, apiKey, model }
 */
export function resolveChat(creds = {}) {
  const rawTemperature = env('KIMI_TEMPERATURE', '');

  return {
    baseUrl: trimSlash(clean(creds.baseUrl) || env('KIMI_BASE_URL', 'https://api.moonshot.cn/v1')),
    apiKey: clean(creds.apiKey) || env('KIMI_API_KEY'),
    model: clean(creds.model) || env('KIMI_MODEL', 'kimi-k3'),
    // 留空表示不下发 temperature，交由模型使用自己的默认值。
    // 部分模型（如 kimi-k2.7-code）只接受特定温度，写死会直接 400。
    temperature: rawTemperature === '' ? null : Number(rawTemperature),
  };
}

/**
 * 解析一次生图请求的最终配置。
 * creds = { baseUrl, apiKey, model, mode }
 * mode: 'async'（提交任务后轮询，如 ToAPIs） 或 'sync'（一次性返回）
 */
export function resolveImage(creds = {}) {
  const requested = clean(creds.mode);
  const fallbackMode = env('IMAGE_MODE', 'async') === 'sync' ? 'sync' : 'async';

  return {
    baseUrl: trimSlash(clean(creds.baseUrl) || env('IMAGE_BASE_URL')),
    apiKey: clean(creds.apiKey) || env('IMAGE_API_KEY'),
    model: clean(creds.model) || env('IMAGE_MODEL', 'gpt-image-2.5-sunburst'),
    mode: requested === 'sync' || requested === 'async' ? requested : fallbackMode,
    // 相对 Base URL 的路径：Base URL 通常已包含 /v1，这里不要再写 /v1。
    path: env('IMAGE_PATH', '/images/generations'),
    defaultSize: env('IMAGE_SIZE', '1:1'),
  };
}

/** 服务端自身是否配置了兜底凭据（仅用于界面提示，不代表使用者已可调用）。 */
export function serverDefaults() {
  const chat = resolveChat({});
  const image = resolveImage({});
  return {
    chatConfigured: Boolean(env('KIMI_API_KEY')),
    imageConfigured: Boolean(env('IMAGE_API_KEY') && env('IMAGE_BASE_URL')),
    chatBaseUrl: chat.baseUrl,
    imageBaseUrl: image.baseUrl || null,
  };
}

function authHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * 流式对话，返回上游 Response（调用方负责透传 SSE）。
 */
export async function requestChatStream({ messages, creds, model, temperature }) {
  const cfg = resolveChat(creds);
  if (!cfg.apiKey) {
    throw Object.assign(new Error('尚未填写对话模型的 API Key，请点击右上角「模型设置」填写。'), { status: 503 });
  }
  if (!cfg.baseUrl) {
    throw Object.assign(new Error('尚未填写对话服务的 Base URL。'), { status: 503 });
  }

  const payload = {
    model: clean(model) || cfg.model,
    messages,
    stream: true,
  };

  const temp = Number.isFinite(temperature) ? temperature : cfg.temperature;
  if (Number.isFinite(temp)) payload.temperature = temp;

  const upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(cfg.apiKey),
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    throw Object.assign(new Error(describeUpstreamError(upstream.status, detail)), {
      status: upstream.status,
    });
  }

  return upstream;
}

/**
 * 从上游回包里提取可读的错误说明。
 * 上游的 error 可能是字符串，也可能是 { code, message } 对象。
 */
function upstreamMessage(payload) {
  const err = payload?.error;
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const message = clean(err.message);
    const code = clean(err.code);
    if (message && code) return `${code}：${message}`;
    return message || code;
  }
  return '';
}

function pickImages(payload) {
  const items = payload?.data || payload?.images || payload?.result?.data || [];
  return items
    .map(item => {
      if (typeof item === 'string') {
        return item.startsWith('http') ? { url: item } : { b64: item };
      }
      if (item?.url) return { url: item.url };
      if (item?.b64_json) return { b64: item.b64_json };
      if (item?.image_url) return { url: item.image_url };
      return null;
    })
    .filter(Boolean);
}

/**
 * 发起图片生成。
 * 返回 { mode:'sync', images:[…] } 或 { mode:'async', taskId:'…' }
 */
export async function requestImage({ prompt, size, n, quality, creds }) {
  const cfg = resolveImage(creds);
  if (!cfg.apiKey) {
    throw Object.assign(new Error('尚未填写图片生成的 API Key，请点击右上角「模型设置」填写。'), { status: 503 });
  }
  if (!cfg.baseUrl) {
    throw Object.assign(new Error('尚未填写图片服务的 Base URL。'), { status: 503 });
  }

  const aspect = clean(size) || cfg.defaultSize;
  const body = {
    model: cfg.model,
    prompt,
    n: Number.isFinite(n) && n > 0 ? n : 1,
    size: aspect,
    response_format: 'b64_json',
    quality: clean(quality) || 'high',
    metadata: {
      resolution: '1K',
      orientation: aspect === '1:1' ? 'square' : aspect === '16:9' ? 'landscape' : 'portrait',
    },
  };

  const upstream = await fetch(`${cfg.baseUrl}${cfg.path}`, {
    method: 'POST',
    headers: authHeaders(cfg.apiKey),
    body: JSON.stringify(body),
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    throw Object.assign(
      new Error(describeUpstreamError(upstream.status, upstreamMessage(payload) || (payload ? JSON.stringify(payload) : ''))),
      { status: upstream.status }
    );
  }

  // 异步任务制：上游先返回任务号
  const taskId = payload?.id || payload?.taskId || payload?.data?.taskId;
  const status = clean(payload?.status);
  if (taskId && status && status !== 'completed' && status !== 'succeeded') {
    return { mode: 'async', taskId };
  }

  const images = pickImages(payload);
  if (images.length) return { mode: 'sync', images };

  if (taskId) return { mode: 'async', taskId };

  throw Object.assign(new Error('上游未返回图片或任务号。'), { status: 502 });
}

/**
 * 查询异步任务状态。返回 { status, progress, images }。
 */
export async function pollImage({ taskId, creds }) {
  const cfg = resolveImage(creds);
  if (!cfg.apiKey || !cfg.baseUrl) {
    throw Object.assign(new Error('查询进度时缺少服务商凭据。'), { status: 503 });
  }

  const upstream = await fetch(`${cfg.baseUrl}${cfg.path}/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: authHeaders(cfg.apiKey),
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    throw Object.assign(
      new Error(describeUpstreamError(upstream.status, payload ? JSON.stringify(payload) : '')),
      { status: upstream.status }
    );
  }

  const status = clean(payload?.status) || 'unknown';
  const progress = Number.isFinite(payload?.progress) ? payload.progress : null;
  const images = pickImages(payload);
  const failure = upstreamMessage(payload) || clean(payload?.failure_reason) || clean(payload?.message);

  return { status, progress, images, failure: failure || null };
}

/**
 * 连接测试：用当前凭据拉一次 /models，确认 Key 与 Base URL 是否可用。
 */
export async function testProvider({ channel, creds }) {
  const isChat = channel !== 'image';
  const cfg = isChat ? resolveChat(creds) : resolveImage(creds);
  const label = isChat ? '对话模型' : '图片生成';

  if (!cfg.apiKey) throw Object.assign(new Error(`${label}：尚未填写 API Key。`), { status: 400 });
  if (!cfg.baseUrl) throw Object.assign(new Error(`${label}：尚未填写 Base URL。`), { status: 400 });

  const upstream = await fetch(`${cfg.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    throw Object.assign(
      new Error(describeUpstreamError(upstream.status, upstreamMessage(payload) || (payload ? JSON.stringify(payload) : ''))),
      { status: upstream.status }
    );
  }

  const ids = (payload?.data || payload?.models || [])
    .map(item => (typeof item === 'string' ? item : item?.id))
    .filter(Boolean);

  const wanted = clean(creds.model);
  return {
    ok: true,
    label,
    baseUrl: cfg.baseUrl,
    modelCount: ids.length,
    modelAvailable: wanted ? ids.includes(wanted) : null,
    model: wanted || cfg.model,
  };
}

function describeUpstreamError(status, detail) {
  const brief = String(detail || '').slice(0, 300);
  if (status === 401 || status === 403)
    return `服务商拒绝了这次请求（${status}），请检查 API Key 是否正确、是否有该模型权限。${brief}`;
  if (status === 402) return `账户余额不足（402）。${brief}`;
  if (status === 429) return `请求过于频繁或额度用尽（429），请稍后重试。${brief}`;
  if (status >= 500) return `服务商暂时异常（${status}），请稍后重试。${brief}`;
  return `服务商返回错误（${status}）。${brief}`;
}
