/**
 * 可选的服务商预设。
 *
 * 设计原则：本工作台不内置任何 API Key。使用者自行选择平台并填入自己的 Key，
 * 平台信息仅保存在浏览器本地（localStorage），不会写入仓库或服务端。
 */

export const CHAT_PROVIDERS = [
  {
    id: 'kimi',
    label: 'Kimi 官方（Moonshot）',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.7-code', 'kimi-k3', 'kimi-k2.6'],
    keyHint: 'sk-…',
    keyUrl: 'https://platform.kimi.com/docs/get-api-key',
    note: 'OpenAI 兼容协议，支持流式输出。',
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI 兼容（自定义）',
    baseUrl: '',
    models: [],
    keyHint: 'sk-…',
    note: '任何兼容 /chat/completions 的服务，请填写 Base URL 与模型名。',
  },
];

export const IMAGE_PROVIDERS = [
  {
    id: 'toapis',
    label: 'ToAPIs',
    baseUrl: 'https://api.toapis.com/v1',
    mode: 'async',
    // 顺序即推荐顺序：第一个为默认选中。
    // 实测 2026-09-30：sunburst-official / flare / doubao-seedream-5-0-pro 稳定；
    // 裸 sunburst 的异步渠道会临时不可用，遇到失败时换 model 即可。
    models: [
      'gpt-image-2.5-sunburst-official',
      'gpt-image-2.5-sunburst',
      'gpt-image-2.5-flare',
      'doubao-seedream-5-0-pro',
      'gemini-3-pro-image-official',
      'flux-2-pro',
      'qwen-image-3.0-pro',
    ],
    keyHint: 'sk-…',
    keyUrl: 'https://toapis.com',
    note: '异步任务制：提交后由后台轮询进度，通常 20–60 秒出图。若报「暂不支持异步生成」，换同平台另一个模型即可。',
  },
  {
    id: 'openai-compatible-image',
    label: 'OpenAI 兼容（同步）',
    baseUrl: '',
    mode: 'sync',
    models: ['gpt-image-2.5-sunburst', 'gpt-image-1'],
    keyHint: 'sk-…',
    keyUrl: '',
    note: '标准 /images/generations 同步接口，直接返回图片地址或 base64。',
  },
];

export const PROVIDER_INDEX = {
  chat: Object.fromEntries(CHAT_PROVIDERS.map(item => [item.id, item])),
  image: Object.fromEntries(IMAGE_PROVIDERS.map(item => [item.id, item])),
};

export function findProvider(channel, providerId) {
  return PROVIDER_INDEX[channel]?.[providerId] || null;
}

/** 生成一栏的空白配置（默认选第一个平台）。 */
export function blankChannel(channel) {
  const preset = (channel === 'chat' ? CHAT_PROVIDERS : IMAGE_PROVIDERS)[0];
  return {
    providerId: preset.id,
    baseUrl: preset.baseUrl,
    apiKey: '',
    model: preset.models[0] || '',
  };
}

/** 一栏配置是否已可用于发起请求。 */
export function channelReady(channelConfig) {
  return Boolean(
    channelConfig &&
      channelConfig.apiKey?.trim() &&
      channelConfig.baseUrl?.trim() &&
      channelConfig.model?.trim()
  );
}
