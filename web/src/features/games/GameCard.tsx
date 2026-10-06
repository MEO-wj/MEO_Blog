import type { CSSProperties } from 'react';
import type { GameEntry } from './gameRegistry';
import './games.css';

export function GameCard({ game, selected, dragging, onSelect, onDeselect, onOpen }: {
  game: GameEntry; selected: boolean; dragging: boolean;
  onSelect: () => void; onDeselect: () => void; onOpen: () => void;
}) {
  return (
    <article className={`switch-project-card meo-game-card ${selected ? 'is-hovered' : ''}`}
      style={{ '--project-accent': game.accentColor } as CSSProperties} aria-label={game.title} aria-current={selected}
      onMouseEnter={() => { if (!dragging) onSelect(); }} onMouseLeave={() => { if (!dragging) onDeselect(); }}>
      <button type="button" className={`meo-game-cover meo-game-cover-${game.gameId}`} aria-label={`游玩${game.title}`} onClick={onOpen}>
        <span className="meo-game-emblem" aria-hidden="true">{game.gameId === 'zelda' ? '△' : 'M'}</span>
        <strong>{game.coverLabel}</strong><span>{game.subtitle}</span>
      </button>
      <div className="switch-project-meta"><span className="switch-project-title">{game.title}</span><span className="switch-project-subtitle">电脑键盘游玩</span></div>
    </article>
  );
}
