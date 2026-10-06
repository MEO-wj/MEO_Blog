import type { SwitchHomeProject } from '../switch-ui/switchHomeData';

export type GameId = 'zelda' | 'mario';
export interface GameEntry extends SwitchHomeProject {
  gameId: GameId;
  entry: string;
  controls: string;
  saveMode: 'native' | 'checkpoint';
}

// Metadata only: importing this file never loads an engine, sound or WASM.
export const desktopGames: GameEntry[] = [
  {
    id: 'game:zelda', gameId: 'zelda', title: '塞尔达传说', subtitle: '初代冒险',
    category: 'ZQuest Classic · 初代任务', coverLabel: 'ZELDA', icon: 'lab', accentColor: '#d4b868',
    entry: '/game-assets/zelda/v1/index.html', saveMode: 'native',
    controls: '方向键移动 · Z / X 使用道具 · Enter 菜单 / 确认 · Esc 暂停',
  },
  {
    id: 'game:mario', gameId: 'mario', title: '超级马里奥', subtitle: '32 个经典关卡',
    category: 'FullScreenMario', coverLabel: 'MARIO', icon: 'lab', accentColor: '#ed6758',
    entry: '/game-assets/mario/v1/index.html', saveMode: 'checkpoint',
    controls: '← → 移动 · Z / ↑ / 空格 跳跃 · X / Shift 加速 / 发射 · Esc 暂停',
  },
];

export function findGame(id?: string) { return desktopGames.find(game => game.gameId === id); }
export function isGameEntry(entry: SwitchHomeProject): entry is GameEntry { return 'gameId' in entry; }
