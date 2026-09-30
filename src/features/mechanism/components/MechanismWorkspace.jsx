import { memo, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  CircleNotch,
  DownloadSimple,
  GearSix,
  Image as ImageIcon,
  Sparkle,
} from '@phosphor-icons/react';
import { generateImage, pollImage } from '../../../shared/utils/api.js';
import { findProvider } from '../../../shared/constants/providers.js';

const ASPECT_OPTIONS = [
  { id: '1:1', label: '方形 1:1', px: '1024x1024' },
  { id: '16:9', label: '横向 16:9', px: '1536x1024' },
  { id: '9:16', label: '纵向 9:16', px: '1024x1536' },
];

const QUALITY_OPTIONS = [
  { id: 'medium', label: '标准' },
  { id: 'high', label: '高质量' },
  { id: 'xhigh', label: '超高' },
];

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildDefaultPrompt(brief) {
  const body = (brief || '').trim() || '（请先在上方填写机制图主题与证据）';
  return [
    '绘制一张生物医学机制示意图，学术论文插图风格。',
    '要求：分区清晰、箭头标注方向与作用（促进 / 抑制）、标签简短规范、配色克制、白底。',
    '证据状态用视觉区分：直接证据用实线，推断用虚线，假说用浅色。',
    '',
    '内容依据：',
    body,
  ].join('\n');
}

function toSrc(image) {
  if (image.url) return image.url;
  if (image.b64) return `data:image/png;base64,${image.b64}`;
  return '';
}

export const MechanismWorkspace = memo(
  ({ brief, setBrief, showProcess, setShowProcess, onBack, onBegin, onNotice, imageReady, imageConfig, onOpenSettings }) => {
    const [prompt, setPrompt] = useState(() => buildDefaultPrompt(brief));
    const [aspect, setAspect] = useState(ASPECT_OPTIONS[0].id);
    const [quality, setQuality] = useState('high');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(null);
    const [results, setResults] = useState([]);
    const promptTouched = useRef(false);
    const abortedRef = useRef(false);

    const preset = findProvider('image', imageConfig?.providerId);
    const mode = preset?.mode || 'async';

    useEffect(() => {
      if (!promptTouched.current) setPrompt(buildDefaultPrompt(brief));
    }, [brief]);

    useEffect(
      () => () => {
        abortedRef.current = true;
      },
      []
    );

    async function runAsyncTask(taskId) {
      const started = Date.now();
      for (;;) {
        if (abortedRef.current) return;
        if (Date.now() - started > POLL_TIMEOUT) {
          throw new Error('生成超时（超过 5 分钟）。可稍后重试，或在服务商后台查看任务结果。');
        }
        await sleep(POLL_INTERVAL);
        if (abortedRef.current) return;

        const payload = await pollImage({ taskId, imageConfig, mode });
        setProgress(Number.isFinite(payload.progress) ? payload.progress : null);

        if (payload.images?.length) {
          setResults(payload.images);
          return;
        }
        const status = String(payload.status || '').toLowerCase();
        if (status === 'failed' || status === 'error') {
          throw new Error(payload.failure || '服务商返回任务失败。');
        }
        if (status === 'completed' || status === 'succeeded') {
          throw new Error('任务已完成，但未返回可用图片。');
        }
      }
    }

    async function handleGenerate() {
      if (busy) return;
      if (!imageReady) {
        onNotice?.('还没有填写图片生成的 API Key，请先完成设置。', 'warning');
        onOpenSettings?.();
        return;
      }
      const text = prompt.trim();
      if (!text) {
        onNotice?.('请先描述要生成的机制图内容。', 'info');
        return;
      }

      const option = ASPECT_OPTIONS.find(item => item.id === aspect) || ASPECT_OPTIONS[0];
      setBusy(true);
      setProgress(null);
      setResults([]);
      abortedRef.current = false;

      try {
        const payload = await generateImage({
          prompt: text,
          size: mode === 'sync' ? option.px : option.id,
          quality,
          n: 1,
          imageConfig,
          mode,
        });

        if (payload.mode === 'sync' && payload.images?.length) {
          setResults(payload.images);
          onNotice?.('示意图已生成，请核对节点关系与证据状态后再使用。', 'success');
          return;
        }

        if (payload.taskId) {
          await runAsyncTask(payload.taskId);
          if (!abortedRef.current) {
            onNotice?.('示意图已生成，请核对节点关系与证据状态后再使用。', 'success');
          }
          return;
        }

        throw new Error('服务商未返回图片或任务号。');
      } catch (error) {
        if (!abortedRef.current) onNotice?.(error.message, 'error');
      } finally {
        setBusy(false);
        setProgress(null);
      }
    }

    return (
      <section className="mechanism-page" aria-labelledby="mechanism-title">
        <div className="workspace-topline">
          <button className="back-link" type="button" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" />返回
          </button>
          <span>科研图示 · 证据先行</span>
        </div>
        <div className="workspace-heading mechanism-heading">
          <div>
            <div className="home-eyebrow">独立科研绘图工作区</div>
            <h1 id="mechanism-title">把生物学逻辑变成可核对的图</h1>
            <p>先核实节点关系与证据，再确认逻辑草图和绘图方式。</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            aria-expanded={showProcess}
            aria-controls="mechanism-process"
            onClick={() => setShowProcess(value => !value)}
          >
            {showProcess ? '收起制作过程' : '查看制作过程'} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        {showProcess && (
          <section id="mechanism-process" className="process-panel" aria-label="机制图制作过程">
            <p className="process-note">这是工作方法说明，不是实时进度。先确认逻辑，再让模型出图。</p>
            <ol className="process-list">
              <li><span>01</span><div><strong>明确图的任务</strong><small>确认场景、受众、核心主张和图中边界。</small></div></li>
              <li><span>02</span><div><strong>整理节点—关系—来源</strong><small>记录分子、细胞、组织、关系方向、模型背景和来源位置。</small></div></li>
              <li><span>03</span><div><strong>标明证据状态</strong><small>区分直接证据、推断、待验证假说；不凭空补线。</small></div></li>
              <li><span>04</span><div><strong>由研究者确认逻辑</strong><small>先处理争议和待核实问题，再进入视觉制作。</small></div></li>
              <li><span>05</span><div><strong>生成并检查</strong><small>用绘图模型产出草图，逐条核对标签与关系后定稿。</small></div></li>
            </ol>
          </section>
        )}

        <div className="mechanism-grid">
          <section className="workspace-panel discussion-panel" aria-labelledby="mechanism-brief-title">
            <div className="workspace-panel-heading">
              <div><span className="panel-kicker">需求整理</span><h2 id="mechanism-brief-title">机制图主题与证据</h2></div>
              <span className="panel-status">由你确认</span>
            </div>
            <label className="visually-hidden" htmlFor="mechanism-brief">描述机制图主题、已有证据和用途</label>
            <textarea id="mechanism-brief" className="discussion-textarea" value={brief} onChange={event => setBrief(event.target.value)} rows={9} />
            <div className="workspace-form-footer">
              <span>启动语会要求先核实关系来源和证据状态。</span>
              <button className="primary-button compact" type="button" onClick={() => onBegin(brief, '科研机制图')}>
                整理绘图启动语 <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>

          <div className="workspace-sidepanels">
            <section className="workspace-panel image-panel" aria-labelledby="image-title">
              <div className="workspace-panel-heading">
                <div><span className="panel-kicker">生成示意图</span><h2 id="image-title">出图</h2></div>
                {imageReady ? (
                  <span className="connection-pill ok">{imageConfig?.model}</span>
                ) : (
                  <button className="text-button" type="button" onClick={onOpenSettings}>
                    <GearSix size={14} aria-hidden="true" />去填写 API Key
                  </button>
                )}
              </div>

              <label className="field-label" htmlFor="image-prompt">绘图描述</label>
              <textarea
                id="image-prompt"
                className="discussion-textarea compact"
                value={prompt}
                onChange={event => { promptTouched.current = true; setPrompt(event.target.value); }}
                rows={6}
              />

              <div className="image-controls">
                <label className="field-label" htmlFor="image-size">画幅</label>
                <select id="image-size" value={aspect} onChange={event => setAspect(event.target.value)}>
                  {ASPECT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <label className="field-label" htmlFor="image-quality">质量</label>
                <select id="image-quality" value={quality} onChange={event => setQuality(event.target.value)}>
                  {QUALITY_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <button className="primary-button compact" type="button" onClick={handleGenerate} disabled={busy}>
                  {busy ? <><CircleNotch size={16} className="spin" aria-hidden="true" />生成中…</> : <><Sparkle size={16} aria-hidden="true" />生成示意图</>}
                </button>
              </div>

              {busy && (
                <div className="image-progress">
                  <div className="image-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined}>
                    <span style={{ width: `${progress ?? 8}%` }} />
                  </div>
                  <p className="image-note">
                    {progress !== null ? `正在生成… ${progress}%` : '已提交任务，正在等待服务商返回…'}
                    （通常 20–60 秒，最长 5 分钟，请勿关闭页面）
                  </p>
                </div>
              )}

              {!busy && results.length > 0 && (
                <div className="image-results">
                  {results.map((image, index) => {
                    const src = toSrc(image);
                    if (!src) return null;
                    return (
                      <figure key={index} className="image-result">
                        <img src={src} alt={`机制示意图 ${index + 1}`} loading="lazy" />
                        <figcaption>
                          <span>草图 {index + 1} · 请核对标签与关系</span>
                          <a className="inline-link" href={src} download={`mechanism-${Date.now()}-${index + 1}.png`} target="_blank" rel="noreferrer">
                            <DownloadSimple size={15} aria-hidden="true" />下载
                          </a>
                        </figcaption>
                      </figure>
                    );
                  })}
                  <p className="image-note"><ImageIcon size={15} aria-hidden="true" />生成结果为示意图草稿，正式使用前请人工核对每条关系与标签。</p>
                </div>
              )}

              {!busy && results.length === 0 && (
                <div className="workspace-empty">
                  <p>还没有生成示意图。</p>
                  <span>先在上面确认机制关系与证据，再点击「生成示意图」。</span>
                </div>
              )}
            </section>

            <section className="workspace-panel resource-panel" aria-labelledby="resource-title">
              <div className="workspace-panel-heading"><div><span className="panel-kicker">可选工具</span><h2 id="resource-title">技能库与绘图入口</h2></div></div>
              <div className="resource-link-list">
                <a href="https://github.com/BioTender-max/awesome-bio-agent-skills" target="_blank" rel="noreferrer"><span><strong>BioTender 生物技能库</strong><small>查找生物信息学、数据分析和科研图相关 skill</small></span><ArrowSquareOut size={17} aria-hidden="true" /></a>
                <a href="https://www.biorender.com/" target="_blank" rel="noreferrer"><span><strong>BioRender 绘图平台</strong><small>外部绘图工具；是否使用及是否上传材料由你决定</small></span><ArrowSquareOut size={17} aria-hidden="true" /></a>
              </div>
              <p className="resource-note">BioTender 是技能集合，不是绘图平台。以上外链只打开网站，不会传送研究内容。</p>
            </section>
          </div>
        </div>
      </section>
    );
  }
);

MechanismWorkspace.displayName = 'MechanismWorkspace';
