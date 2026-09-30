#!/usr/bin/env node
/**
 * 生物科研工作台 · 本机 / 云端后端服务
 *
 * 职责：
 *   1. 托管前端构建产物（dist/）
 *   2. 作为纯粹的转发层：API Key 由使用者在浏览器里自行填写，随请求临时传来，
 *      服务端只做转发，不保存、不记录、不回传任何凭据
 *      - GET  /api/health         服务状态与服务端兜底配置情况
 *      - GET  /api/agents         可用 agent 角色列表
 *      - POST /api/chat           流式对话（SSE 透传）
 *      - POST /api/image          提交图片生成任务
 *      - POST /api/image/status   查询异步生图任务进度
 *
 * 零第三方依赖，仅使用 Node 20+ 内置能力。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listAgents, getAgent } from './agents.mjs';
import {
  requestChatStream,
  requestImage,
  pollImage,
  testProvider,
  serverDefaults,
} from './providers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

/**
 * 前端产物目录。
 * 部署沙箱会排除 dist/ 这类构建产物，因此也支持把构建结果放在 web/ 里一起上传。
 * 优先级：STATIC_DIR 环境变量 → dist/ → web/。
 */
const distDir = resolveStaticDir();

function resolveStaticDir() {
  const candidates = [process.env.STATIC_DIR, 'dist', 'web'].filter(Boolean);
  for (const candidate of candidates) {
    const absolute = path.isAbsolute(candidate) ? candidate : path.join(projectRoot, candidate);
    if (fs.existsSync(path.join(absolute, 'index.html'))) return absolute;
  }
  return path.join(projectRoot, 'dist');
}

loadEnvFile(path.join(projectRoot, '.env'));

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 1_000_000;
const MAX_MESSAGES = 40;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    if (res.headersSent) {
      res.end();
      return;
    }
    sendJson(res, error.status && error.status < 600 ? error.status : 500, {
      error: error.message || '服务器内部错误。',
    });
  });
});

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    await handleApi(req, res, pathname);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: '不支持的请求方法。' });
    return;
  }

  serveStatic(res, pathname);
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/health' && req.method === 'GET') {
    const defaults = serverDefaults();
    sendJson(res, 200, {
      ok: true,
      // serverKeys：本机/自部署时服务端是否填了兜底 Key；公开链接下通常为 false，
      // 使用者需要在网页「模型设置」里填自己的 Key。
      serverKeys: defaults,
    });
    return;
  }

  if (pathname === '/api/agents' && req.method === 'GET') {
    sendJson(res, 200, { agents: listAgents() });
    return;
  }

  if (pathname === '/api/chat' && req.method === 'POST') {
    await handleChat(req, res);
    return;
  }

  if (pathname === '/api/image' && req.method === 'POST') {
    await handleImage(req, res);
    return;
  }

  if (pathname === '/api/image/status' && req.method === 'POST') {
    await handleImageStatus(req, res);
    return;
  }

  if (pathname === '/api/test' && req.method === 'POST') {
    await handleTest(req, res);
    return;
  }

  sendJson(res, 404, { error: '接口不存在。' });
}

async function handleChat(req, res) {
  const body = await readJson(req);

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const history = incoming
    .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
    .filter(message => typeof message.content === 'string' && message.content.trim())
    .slice(-MAX_MESSAGES)
    .map(message => ({ role: message.role, content: message.content.slice(0, 20000) }));

  if (!history.length) {
    sendJson(res, 400, { error: '请先输入内容。' });
    return;
  }

  const agent = getAgent(body.agentId);
  const messages = [{ role: 'system', content: agent.system }, ...history];

  let upstream;
  try {
    upstream = await requestChatStream({
      messages,
      creds: readCreds(body),
      model: typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined,
      temperature: Number.isFinite(body.temperature) ? body.temperature : undefined,
    });
  } catch (error) {
    sendJson(res, error.status || 502, { error: error.message });
    return;
  }

  const contentType = upstream.headers.get('content-type') || '';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 上游返回标准 SSE：原样透传，前端按 OpenAI 兼容格式解析
  if (contentType.includes('text/event-stream') && upstream.body) {
    try {
      for await (const chunk of upstream.body) {
        res.write(chunk);
      }
    } catch (error) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: `连接中断：${error.message}` })}\n\n`);
    }
    res.end();
    return;
  }

  // 上游返回一次性 JSON：转换为单个 SSE 事件
  try {
    const payload = await upstream.json();
    const text = payload?.choices?.[0]?.message?.content || '';
    if (text) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: '上游未返回文本内容。' })}\n\n`);
    }
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: `解析上游响应失败：${error.message}` })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

async function handleImage(req, res) {
  const body = await readJson(req);
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  if (!prompt) {
    sendJson(res, 400, { error: '请先描述要生成的图。' });
    return;
  }

  try {
    const result = await requestImage({
      prompt,
      size: typeof body.size === 'string' ? body.size : undefined,
      quality: typeof body.quality === 'string' ? body.quality : undefined,
      n: Number.isFinite(body.n) ? body.n : 1,
      creds: readCreds(body),
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, error.status || 502, { error: error.message });
  }
}

async function handleImageStatus(req, res) {
  const body = await readJson(req);
  const taskId = typeof body.taskId === 'string' ? body.taskId.trim() : '';

  if (!taskId) {
    sendJson(res, 400, { error: '缺少任务号。' });
    return;
  }

  try {
    const result = await pollImage({ taskId, creds: readCreds(body) });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, error.status || 502, { error: error.message });
  }
}

async function handleTest(req, res) {
  const body = await readJson(req);
  try {
    const result = await testProvider({ channel: body.channel, creds: readCreds(body) });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, error.status || 502, { error: error.message });
  }
}

/** 从请求体中提取使用者填写的服务商配置；缺失字段交给环境变量兜底。 */
function readCreds(body) {
  const raw = body && typeof body.credentials === 'object' && body.credentials ? body.credentials : {};
  return {
    baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : '',
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
    model: typeof raw.model === 'string' ? raw.model : '',
    mode: typeof raw.mode === 'string' ? raw.mode : '',
  };
}

/* ---------------------------- 基础设施 ---------------------------- */

function serveStatic(res, pathname) {
  if (!fs.existsSync(distDir)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('前端尚未构建。请先运行 npm run build，再用 npm run serve 启动。');
    return;
  }

  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    sendJson(res, 403, { error: '禁止访问。' });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html'); // SPA 回退
  }

  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: '资源不存在。' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('请求内容过大。'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('请求体不是合法 JSON。'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

server.listen(PORT, HOST, () => {
  const defaults = serverDefaults();
  console.log('');
  console.log('  生物科研工作台 · 服务已启动');
  console.log(`  → http://127.0.0.1:${PORT}`);
  console.log(
    `  对话兜底 Key：${defaults.chatConfigured ? `已配置（${defaults.chatBaseUrl}）` : '未配置 · 使用者需在网页自行填写'}`
  );
  console.log(
    `  生图兜底 Key：${defaults.imageConfigured ? `已配置（${defaults.imageBaseUrl}）` : '未配置 · 使用者需在网页自行填写'}`
  );
  console.log('');
});
