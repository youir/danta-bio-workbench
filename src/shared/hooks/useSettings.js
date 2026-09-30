import { useCallback, useEffect, useState } from 'react';
import {
  CHAT_PROVIDERS,
  IMAGE_PROVIDERS,
  blankChannel,
  channelReady,
  findProvider,
} from '../constants/providers.js';

const STORAGE_KEY = 'danta-workbench-settings-v1';

/**
 * 使用者自己的配置：模型与 API、知识库匹配。
 *
 * 注意：API Key 只保存在浏览器本机（localStorage），随每次请求临时传给后端转发，
 * 服务端不落盘、不打印、不返回。因此公开分享的链接不会泄露任何人的 Key。
 */

export const DEFAULT_KNOWLEDGE = {
  folderName: '',
  matchMode: 'manual', // manual | auto
  fileTypes: ['md', 'txt', 'pdf', 'docx', 'csv'],
  linkedWorkflows: ['topic', 'writing', 'ppt', 'meeting', 'briefing'],
  autoAttach: false,
};

function normalizeChannel(channel, stored) {
  const fallback = blankChannel(channel);
  if (!stored) return fallback;

  const preset = findProvider(channel, stored.providerId);
  const catalog = channel === 'chat' ? CHAT_PROVIDERS : IMAGE_PROVIDERS;

  return {
    providerId: preset ? stored.providerId : catalog[0].id,
    baseUrl:
      typeof stored.baseUrl === 'string' ? stored.baseUrl : preset?.baseUrl || fallback.baseUrl,
    apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '',
    model: typeof stored.model === 'string' ? stored.model : preset?.models?.[0] || '',
  };
}

function normalizeKnowledge(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_KNOWLEDGE };
  return {
    folderName: typeof stored.folderName === 'string' ? stored.folderName : '',
    matchMode: stored.matchMode === 'auto' ? 'auto' : 'manual',
    fileTypes: Array.isArray(stored.fileTypes) ? stored.fileTypes : [...DEFAULT_KNOWLEDGE.fileTypes],
    linkedWorkflows: Array.isArray(stored.linkedWorkflows)
      ? stored.linkedWorkflows
      : [...DEFAULT_KNOWLEDGE.linkedWorkflows],
    autoAttach: Boolean(stored.autoAttach),
  };
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    const stored = readStored();
    return {
      chat: normalizeChannel('chat', stored?.chat),
      image: normalizeChannel('image', stored?.image),
      knowledge: normalizeKnowledge(stored?.knowledge),
    };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // 隐私模式下写入失败，不影响本次会话使用
    }
  }, [settings]);

  const updateChannel = useCallback((channel, patch) => {
    setSettings(current => ({ ...current, [channel]: { ...current[channel], ...patch } }));
  }, []);

  /** 切换平台时同步替换 Base URL 与默认模型。 */
  const selectProvider = useCallback((channel, providerId) => {
    const preset = findProvider(channel, providerId);
    if (!preset) return;
    setSettings(current => ({
      ...current,
      [channel]: {
        ...current[channel],
        providerId,
        baseUrl: preset.baseUrl,
        model: preset.models[0] || '',
      },
    }));
  }, []);

  const updateKnowledge = useCallback(patch => {
    setSettings(current => ({ ...current, knowledge: { ...current.knowledge, ...patch } }));
  }, []);

  const toggleKnowledgeList = useCallback((field, value) => {
    setSettings(current => {
      const list = current.knowledge[field] || [];
      const next = list.includes(value) ? list.filter(item => item !== value) : [...list, value];
      return { ...current, knowledge: { ...current.knowledge, [field]: next } };
    });
  }, []);

  const resetAll = useCallback(() => {
    setSettings({
      chat: blankChannel('chat'),
      image: blankChannel('image'),
      knowledge: { ...DEFAULT_KNOWLEDGE },
    });
  }, []);

  const clearSecrets = useCallback(() => {
    setSettings(current => ({
      ...current,
      chat: { ...current.chat, apiKey: '' },
      image: { ...current.image, apiKey: '' },
    }));
  }, []);

  return {
    settings,
    setSettings,
    updateChannel,
    selectProvider,
    updateKnowledge,
    toggleKnowledgeList,
    resetAll,
    clearSecrets,
    chatReady: channelReady(settings.chat),
    imageReady: channelReady(settings.image),
  };
}
