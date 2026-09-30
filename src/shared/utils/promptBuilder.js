import { TASK_GUIDES, PROMPT_STARTERS } from '../constants/workflows.js';

/**
 * 生成启动语。
 * knowledge 为可选的知识库匹配设置：只在开启「附带路径提示」时写入路径文字，
 * 不会读取任何文件内容。
 */
export function makeKickoffPrompt(thought, focus, knowledge) {
  const taskGuide = TASK_GUIDES[focus];
  const lines = [
    '使用 $danta-proposal-guide。',
    `本次方向：${focus}。`,
    taskGuide || '先陪我把问题想清楚：复述重点，区分已有事实、可能解释和待核实之处。',
    '先理解我的目标和已有材料，再决定是提问、梳理还是直接动手；研究判断由我和导师作出。',
  ];

  const hint = buildKnowledgeHint(knowledge, focus);
  if (hint) lines.push('', hint);

  lines.push('', `我现在想讨论：${thought.trim()}`);
  return lines.join('\n');
}

function buildKnowledgeHint(knowledge, focus) {
  if (!knowledge || !knowledge.autoAttach || !knowledge.folderName) return '';

  const workflow = PROMPT_STARTERS.find(item => item.focus === focus);
  const linked = knowledge.linkedWorkflows || [];
  if (workflow && !linked.includes(workflow.id)) return '';

  const types = (knowledge.fileTypes || []).map(type => `.${type}`).join(' / ');
  const mode = knowledge.matchMode === 'auto' ? '按主题自动匹配相关文件' : '由我指定引用的文件';
  return `知识库路径：${knowledge.folderName}（${mode}；纳入类型 ${types || '未限制'}）。此路径仅为提示，内容需我在对话中提供或授权。`;
}
