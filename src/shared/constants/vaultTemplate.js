/**
 * 知识库骨架定义（唯一事实来源）。
 *
 * 三条落地通道共用本文件：
 *   1. 浏览器直接写入   —— File System Access API（Chrome / Edge）
 *   2. WorkBuddy 指令   —— 复制提示词，由本机 AI 代理完成文件创建
 *   3. 本地脚本         —— 下载 .sh 后执行
 *
 * 改这里 = 三条通道同时生效。
 */

export const VAULT_VERSION = '1.0.0';

const README = `# 科研知识库

> 本文件夹由工作台「一键构建知识库」生成。建议用 Obsidian 打开为仓库（Vault）。

## 目录导航

| 目录 | 放什么 |
| --- | --- |
| 00-总览 | 课题总览、术语与缩写、当前进度 |
| 01-文献笔记 | 一篇文献一条笔记，含结论、方法、质疑 |
| 02-实验记录 | 实验方案与原始观察，一条实验一条记录 |
| 03-组会与周报 | 组会纪要、周报、待办 |
| 04-写作素材 | 引言 / 方法 / 结果段落草稿 |
| 05-数据与图表 | 数据文件与图表说明 |
| 06-方法SOP | 标准操作流程，带版本记录 |

## 标签约定

- #待核实 结论尚未确认
- #已确认 已核对过
- #模板 可直接复制的模板

## 使用建议

1. 先填 00-总览/研究总览.md，把课题讲清楚。
2. 每读完一篇文献，复制 01-文献笔记 里的模板新建一条。
3. 每做一次实验，复制 02-实验记录 里的模板新建一条。
4. 讨论、写作、组会前，先看 03 与 04 两个目录。

_由生物科研工作台生成 · 模板版本 __VAULT_VERSION___
`;

const OVERVIEW = `---
tags: [总览]
type: overview
created: __TODAY__
status: 进行中
---

# 研究总览

## 一句话概括

（用一句话说清：以什么为对象，考察什么，想回答什么问题）

## 三个子问题

1. **表型问题**：
2. **分子问题**：
3. **干预问题**：

## 当前进度

| 子问题 | 进度 | 卡点 |
| --- | --- | --- |
| 表型问题 |  |  |
| 分子问题 |  |  |
| 干预问题 |  |  |

## 待核实

- #待核实

## 相关笔记

- [[术语与缩写]]
`;

const GLOSSARY = `---
tags: [术语]
type: glossary
created: __TODAY__
---

# 术语与缩写

| 缩写 | 全称 | 一句话解释 |
| --- | --- | --- |
|  |  |  |

## 命名规范

- 实验编号：EXP-序号
- 数据文件：日期_实验编号_指标.csv
- 图像文件：实验编号_靶标_放大倍数.png
`;

const LIT_TEMPLATE = `---
tags: [文献笔记, 模板]
type: literature
year:
first_author:
journal:
created: __TODAY__
rating:
---

# 作者 年份 · 标题

## 基本信息

- 作者：
- 年份：
- 类型：
- 阅读状态：#待核实

## 核心结论

1.
2.

## 方法要点

-

## 与我的课题的关系

| 关联点 | 影响 |
| --- | --- |
|  |  |

## 我的质疑

- #待核实

## 可引用段落

> 

## 相关

-
`;

const EXP_TEMPLATE = `---
tags: [实验记录, 模板]
type: experiment
id: EXP-000
date: __TODAY__
status: 进行中
---

# EXP-000 · 实验名称

## 目的

（一句话说清要回答什么问题）

## 材料与试剂

-

## 步骤

1.
2.

## 观察与结果

| 时间点 | 现象 | 判断 |
| --- | --- | --- |
|  |  |  |

## 问题与调整

-

## 下一步

-

## 关联

- 文献：
- 数据文件：
- SOP：
`;

const WEEKLY_TEMPLATE = `---
tags: [周报, 模板]
type: weekly
week:
date_range:
---

# 年第 周周报

## 本周做了什么

1.

## 关键进展

-

## 遇到的问题

| 问题 | 影响 | 拟对策 |
| --- | --- | --- |
|  |  |  |

## 下周计划

1.

## 需要导师确认

- #待核实

## 相关

-
`;

const MEETING_TEMPLATE = `---
tags: [组会, 模板]
type: meeting
date: __TODAY__
attendees:
---

# 组会纪要 · 日期

## 汇报要点

1.

## 导师意见

-

## 形成的决议

| 决议 | 负责人 | 期限 |
| --- | --- | --- |
|  |  |  |

## 待办

- [ ]

## 下次组会

- 时间：
- 议题：
`;

const INTRO_DRAFT = `---
tags: [写作素材, 模板]
type: writing
section: 引言
status: 草稿
---

# 引言段落草稿

## 背景段

（领域现状：已知什么）

## 问题段

（尚未解决什么，分歧在哪）

## 本文思路段

（本研究怎么做，想回答什么）

## 待补充

- [ ]

## 相关

-
`;

const METHOD_DRAFT = `---
tags: [写作素材, 模板]
type: writing
section: 方法 / 结果
status: 草稿
---

# 方法与结果段落

## 方法段

（按操作顺序写，参数写全，可被他人复现）

## 结果段

（每句结论都要能回溯到具体图号或数据）

## 写作注意

- 结论句必须能回溯到数据或图号
- 未重复的现象一律标注为「初步观察」
- #待核实 误差棒代表标准差还是标准误？需统一
`;

const FIGURE_LIST = `---
tags: [图表, 模板]
type: figure-list
---

# 图表清单

| 图号 | 内容 | 数据来源 | 状态 |
| --- | --- | --- | --- |
| 图 1A |  |  | 未开始 |
| 图 1B |  |  | 未开始 |

## 出图规范

- 柱状图带散点，标明 n 值与统计方法
- 误差棒口径统一（SD 或 SEM），图注中写明
- 配色不超过 4 种，灰度打印仍可区分
- 图注需自洽，可脱离正文单独阅读
`;

const DATA_NOTE = `---
tags: [数据, 模板]
type: data-note
---

# 数据说明

| 文件名 | 指标 | 采集日期 | 备注 |
| --- | --- | --- | --- |
|  |  |  |  |

## 通用要求

- 原始数据只读，处理过程另存新文件
- 表格第一行为列名，列名用英文短名，不要有合并单元格
- 缺失值留空，不要写 0 或 NA 混用
`;

const SOP_TEMPLATE = `---
tags: [SOP, 模板]
type: sop
id: SOP-000
version: 1.0
updated: __TODAY__
---

# SOP-000 · 方法名称

## 适用范围

## 材料

-

## 步骤

### 1.

1.

## 注意事项

-

## 常见问题

| 现象 | 可能原因 | 对策 |
| --- | --- | --- |
|  |  |  |

## 版本记录

| 版本 | 日期 | 改动 |
| --- | --- | --- |
| 1.0 | __TODAY__ | 初版 |
`;

const TXT_NOTE = `科研知识库 · 使用说明
========================

一、怎么开始
1. 用 Obsidian「打开文件夹作为仓库」指向本文件夹。
2. 先填 00-总览/研究总览.md。
3. 复制模板文件 → 重命名 → 填写。模板不要直接改。

二、为什么用文件夹而不是一个大文档
- 一条笔记一件事，便于被检索和引用
- 双链 [[ ]] 让笔记之间自己长出结构
- 单文件损坏不会带走全部资料

三、什么时候该拆
一条笔记超过两屏还没讲完，就说明该拆成两条。

四、保留来源
任何结论都记下它的出处（哪篇文献、哪次实验、哪个数据文件）。
没有出处的结论，三个月后自己也认不出来。
`;

const OBSIDIAN_APP = `{
  "alwaysUpdateLinks": true,
  "attachmentFolderPath": "05-数据与图表",
  "newFileLocation": "folder",
  "newFileFolderPath": "02-实验记录",
  "useMarkdownLinks": false
}
`;

const OBSIDIAN_APPEARANCE = `{
  "accentColor": "#6d5bd0",
  "theme": "moonstone",
  "baseFontSize": 16
}
`;

/** 需要创建的目录（按层级顺序）。 */
export const VAULT_DIRS = [
  '00-总览',
  '01-文献笔记',
  '02-实验记录',
  '03-组会与周报',
  '04-写作素材',
  '05-数据与图表',
  '06-方法SOP',
  '.obsidian',
];

/** 需要写入的文件。path 用 / 分隔，逐级创建。 */
export const VAULT_TEMPLATE = [
  { path: 'README.md', content: README },
  { path: '附-使用说明.txt', content: TXT_NOTE },
  { path: '00-总览/研究总览.md', content: OVERVIEW },
  { path: '00-总览/术语与缩写.md', content: GLOSSARY },
  { path: '01-文献笔记/_文献笔记模板.md', content: LIT_TEMPLATE },
  { path: '02-实验记录/_实验记录模板.md', content: EXP_TEMPLATE },
  { path: '03-组会与周报/_周报模板.md', content: WEEKLY_TEMPLATE },
  { path: '03-组会与周报/_组会纪要模板.md', content: MEETING_TEMPLATE },
  { path: '04-写作素材/_引言段落草稿.md', content: INTRO_DRAFT },
  { path: '04-写作素材/_方法与结果段落.md', content: METHOD_DRAFT },
  { path: '05-数据与图表/_图表清单.md', content: FIGURE_LIST },
  { path: '05-数据与图表/_数据说明.md', content: DATA_NOTE },
  { path: '06-方法SOP/_SOP模板.md', content: SOP_TEMPLATE },
  { path: '.obsidian/app.json', content: OBSIDIAN_APP },
  { path: '.obsidian/appearance.json', content: OBSIDIAN_APPEARANCE },
];

function today() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 把占位符替换为实际值。 */
export function renderTemplate() {
  const day = today();
  return VAULT_TEMPLATE.map(item => ({
    path: item.path,
    content: item.content
      .replaceAll('__TODAY__', day)
      .replaceAll('__VAULT_VERSION__', VAULT_VERSION),
  }));
}

export function templateStats() {
  const files = renderTemplate();
  return {
    version: VAULT_VERSION,
    dirCount: VAULT_DIRS.length,
    fileCount: files.length,
    bytes: files.reduce((sum, item) => sum + item.content.length, 0),
  };
}

/** 生成给 WorkBuddy（或 Codex / Claude Code）的指令。 */
export function buildWorkbuddyPrompt(targetPath) {
  const files = renderTemplate();
  const body = files
    .map(item => `### 文件：${item.path}\n\n~~~\n${item.content}~~~`)
    .join('\n');

  return `请在本机创建一个科研知识库骨架，共 ${files.length} 个文件、${VAULT_DIRS.length} 个目录。

目标目录：${targetPath || '（我没有指定，请你选一个合适的位置，优先放在我的文稿/文档目录下，文件夹名用「科研知识库」，完成后把绝对路径告诉我）'}

执行要求：
1. 先确认目标目录是否存在；不存在就创建。
2. 严格按下面的目录与文件清单创建，文件内容照抄，不要改写、不要润色、不要增加解释性内容。
3. 目标文件已存在时不要覆盖，跳过即可，最后单独列出跳过清单。
4. 只在这个目标目录内操作，不要删除、移动或修改目录之外的任何文件。
5. 完成后汇报：目标目录绝对路径、实际创建的文件数、目录树（两层）、以及跳过清单。

需要创建的目录：
${VAULT_DIRS.map(dir => `- ${dir}/`).join('\n')}

需要创建的文件（完整内容如下，分隔线内为文件正文）：

${body}
`;
}

/** 生成可下载的本地构建脚本（纯 bash，不依赖 node）。 */
export function buildShellScript() {
  const files = renderTemplate();
  const marker = index => `__WB_EOF_${index}__`;
  const writes = files
    .map((item, index) => {
      const end = marker(index);
      const dir = item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : '';
      const mkdir = dir ? `  mkdir -p "$TARGET/${dir}"\n` : '';
      return `if [ -e "$TARGET/${item.path}" ]; then
  SKIPPED=$((SKIPPED + 1))
  echo "  跳过已存在：${item.path}"
else
${mkdir}  cat > "$TARGET/${item.path}" <<'${end}'
${item.content}${end}
  CREATED=$((CREATED + 1))
  echo "  已创建：${item.path}"
fi`;
    })
    .join('\n\n');

  return `#!/bin/bash
# 科研知识库 · 一键构建脚本
# 由生物科研工作台生成，模板版本 ${VAULT_VERSION}
# 用法：bash 本文件路径  [目标目录]
#   不传目标目录时，默认写入 ~/Documents/科研知识库
# 行为：只创建缺失的文件，已存在的文件一律跳过，绝不覆盖。

set -uo pipefail

TARGET="\${1:-$HOME/Documents/科研知识库}"
CREATED=0
SKIPPED=0

echo "目标目录：$TARGET"
mkdir -p "$TARGET"

${writes}

echo ""
echo "✅ 完成"
echo "   目标目录：$TARGET"
echo "   新建文件：$CREATED 个"
echo "   跳过已存在：$SKIPPED 个"
echo "   下一步：用 Obsidian「打开文件夹作为仓库」指向该目录。"
`;
}
