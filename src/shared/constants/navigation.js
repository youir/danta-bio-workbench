import { BookOpenText, ChatsCircle, GearSix, House, Notebook, ShareNetwork, FolderOpen } from '@phosphor-icons/react';

export const NAV_ITEMS = [
  { id: 'start', label: '开始', Icon: House },
  { id: 'chat', label: 'AI 对话', Icon: ChatsCircle },
  { id: 'mechanism', label: '机制图', Icon: ShareNetwork },
  { id: 'records', label: '研究记录', Icon: Notebook },
  { id: 'literature', label: '文献与信息源', Icon: BookOpenText },
  { id: 'vault', label: '知识库', Icon: FolderOpen },
  { id: 'settings', label: '设置', Icon: GearSix },
];
