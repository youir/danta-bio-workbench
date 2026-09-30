/**
 * agent 角色的前端兜底列表。
 * 正常运行时以 /api/agents 返回的结果为准；后端不可用时用这份列表保证界面可用。
 */
export const FALLBACK_AGENTS = [
  { id: 'general', label: '通用研究助理', detail: '先理解问题，再决定是提问、梳理还是直接动手' },
  { id: 'topic', label: '选题思路', detail: '从现象、证据缺口和现实条件出发形成可讨论的问题' },
  { id: 'writing', label: '论文写作', detail: '起草、修改、润色或回复审稿意见' },
  { id: 'ppt', label: '科研 PPT', detail: '组会、开题与阶段汇报的可编辑汇报稿' },
  { id: 'meeting', label: '组会准备 / 复盘', detail: '整理讨论目标、决定事项与行动项' },
  { id: 'briefing', label: '生物科研日报', detail: '按已确认的研究兴趣汇总有来源的动态' },
  { id: 'mechanism', label: '科研机制图', detail: '先核对节点—关系—证据，再产出可编辑图形' },
];
