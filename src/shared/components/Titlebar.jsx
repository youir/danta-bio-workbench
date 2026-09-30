import { memo } from 'react';
import { ArrowSquareOut, Atom, GearSix } from '@phosphor-icons/react';
import { UpdateControl } from './UpdateControl.jsx';

export const Titlebar = memo(({ guideUrl, frameworkUrl, chatReady, imageReady, onOpenSettings }) => {
  const missing = !chatReady || !imageReady;

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <Atom size={25} weight="light" aria-hidden="true" />
        <div><strong>生物科研工作台</strong><small>思维优先 · 决策在人</small></div>
      </div>
      <div className="titlebar-actions">
        <a className="titlebar-link" href={guideUrl} target="_blank" rel="noreferrer">使用说明 <ArrowSquareOut size={14} aria-hidden="true" /></a>
        <a className="titlebar-link" href={frameworkUrl} target="_blank" rel="noreferrer">架构图 <ArrowSquareOut size={14} aria-hidden="true" /></a>
        <button
          className={`titlebar-settings ${missing ? 'is-alert' : ''}`}
          type="button"
          onClick={onOpenSettings}
          title="模型与知识库设置"
        >
          <GearSix size={15} aria-hidden="true" />
          模型设置
          {missing && <span className="titlebar-dot" aria-hidden="true" />}
        </button>
        <UpdateControl />
      </div>
    </header>
  );
});

Titlebar.displayName = 'Titlebar';
