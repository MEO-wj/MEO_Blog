import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import type { GameEntry } from './gameRegistry';
import './games.css';

const protocol = 'meo-game-v1';
type Phase = 'loading' | 'playing' | 'paused' | 'failed';
interface Saved { savedAt: string; summary: string }
interface Pending { resolve: (value: any) => void; reject: (error: Error) => void; timer: number }

export function GameHost({ game, onExit }: { game: GameEntry; onExit: () => void }) {
  const [generation, setGeneration] = useState(0);
  const sessionId = useMemo(() => crypto.randomUUID(), [generation]);
  const frame = useRef<HTMLIFrameElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(new Map<string, Pending>());
  const ready = useRef(false);
  const leaving = useRef(false);
  const nativeExit = useRef(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState('正在加载本地游戏资源…');
  const [saved, setSaved] = useState<Saved | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(true);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !leaving.current && currentLocation.pathname !== nextLocation.pathname);
  const blocked = blocker.state === 'blocked';
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const command = useCallback((type: string, payload?: unknown) => new Promise<any>((resolve, reject) => {
    if (!ready.current || !frame.current?.contentWindow) { reject(new Error('游戏尚未准备好')); return; }
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => { pending.current.delete(requestId); reject(new Error('游戏响应超时，请重试或返回主页')); }, 20000);
    pending.current.set(requestId, { resolve, reject, timer });
    frame.current.contentWindow.postMessage({ protocol, gameId: game.gameId, sessionId, requestId, type, payload }, location.origin);
  }), [game.gameId, sessionId]);

  const pause = useCallback(async () => {
    if (!ready.current || leaving.current) return;
    setPhase('paused');
    nativeExit.current = false;
    try { await command('PAUSE'); await command('CANCEL_SAVE'); } catch (error) { setNotice((error as Error).message); }
  }, [command]);

  const leave = useCallback(async () => {
    setBusy(true);
    try {
      if (ready.current) await command('DISPOSE');
      leaving.current = true;
      window.dispatchEvent(new CustomEvent('meo-game-return', { detail: game.gameId }));
      if (blocker.state === 'blocked') blocker.proceed(); else onExit();
    } catch (error) { setNotice((error as Error).message); setPhase('paused'); }
    finally { setBusy(false); }
  }, [blocker, command, game.gameId, onExit]);
  const nativeDone = useRef<() => void>(() => {});
  nativeDone.current = () => { if (nativeExit.current) { nativeExit.current = false; void leave(); } else void pause(); };

  useEffect(() => {
    ready.current = false; nativeExit.current = false; leaving.current = false;
    setPhase('loading'); setProgress('正在加载本地游戏资源…'); setNotice('');
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || !data || data.protocol !== protocol || data.gameId !== game.gameId || data.sessionId !== sessionId) return;
      if (data.type === 'ACK') {
        const request = pending.current.get(data.requestId); if (!request) return;
        clearTimeout(request.timer); pending.current.delete(data.requestId);
        if (data.message) request.reject(new Error(data.message)); else request.resolve(data.result);
      } else if (data.type === 'READY') {
        ready.current = true; setSaved(data.saved || null); setMuted(true);
        void (async () => {
          try {
            await command('SET_MUTED', true);
            if (blockedRef.current) { await command('PAUSE'); setPhase('paused'); }
            else { await command('RESUME'); setPhase('playing'); frame.current?.focus(); }
          } catch (error) { setNotice((error as Error).message); setPhase('paused'); }
        })();
      } else if (data.type === 'PROGRESS' && typeof data.message === 'string') setProgress(data.message);
      else if (data.type === 'ERROR') { setProgress(String(data.message)); setPhase('failed'); }
      else if (data.type === 'NOTICE') setNotice(String(data.message));
      else if (data.type === 'PAUSE_REQUEST') { nativeExit.current = false; setPhase('paused'); void command('CANCEL_SAVE').catch(() => {}); }
      else if (data.type === 'SAVED') setSaved(data.saved);
      else if (data.type === 'NATIVE_SAVED') nativeDone.current();
    };
    window.addEventListener('message', receive);
    const timeout = window.setTimeout(() => { if (!ready.current) { setProgress('资源加载超时，请检查网络后重试。'); setPhase('failed'); } }, 90000);
    return () => {
      window.removeEventListener('message', receive); clearTimeout(timeout);
      for (const item of pending.current.values()) { clearTimeout(item.timer); item.reject(new Error('游戏已关闭')); }
      pending.current.clear(); ready.current = false;
    };
  }, [command, game.gameId, sessionId]);

  useEffect(() => { if (blocked) void pause(); }, [blocked, pause]);
  useEffect(() => {
    if (phase === 'paused' || phase === 'failed') menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [phase]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) void pause(); };
    const blur = () => { if (!document.hasFocus()) void pause(); };
    const key = (event: KeyboardEvent) => { if (event.code === 'Escape') { event.preventDefault(); void pause(); } };
    const unload = (event: BeforeUnloadEvent) => { if (ready.current && !leaving.current) { event.preventDefault(); event.returnValue = ''; } };
    const media = matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 1024px)');
    const resize = () => { if (media.matches) { setNotice('窗口已切换到移动端大小，请保存后返回主页。'); void pause(); } };
    window.addEventListener('blur', blur); window.addEventListener('keydown', key);
    window.addEventListener('beforeunload', unload); document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', resize);
    return () => {
      window.removeEventListener('blur', blur); window.removeEventListener('keydown', key);
      window.removeEventListener('beforeunload', unload); document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', resize);
    };
  }, [pause]);

  async function action(work: () => Promise<void>) {
    setBusy(true); setNotice('');
    try { await work(); } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }
  async function resume() {
    if (blocker.state === 'blocked') blocker.reset();
    await command('RESUME'); setPhase('playing'); frame.current?.focus();
  }
  async function save(exit: boolean) {
    nativeExit.current = exit;
    const result = await command('SAVE');
    if (result?.needsNativeSave) {
      setNotice(`先按 Enter 确认结束当前游戏，再选择 SAVE AND QUIT 并按 Enter；确认保存后会自动返回${exit ? '主页' : '暂停菜单'}。取消保存可按 Esc。`);
      setPhase('playing'); frame.current?.focus();
    } else if (exit) await leave(); else setNotice(result?.unchanged ? '当前正在死亡或切换关卡，已保留上次安全检查点。' : '检查点已保存到这个浏览器。');
  }
  async function exportSave() {
    const backup = await command('EXPORT');
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `meo-${game.gameId}-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('备份已导出到本地文件。');
  }
  async function importSave(file?: File) {
    if (!file) return;
    await action(async () => {
      if (file.size > 15 * 1024 * 1024) throw new Error('备份不能超过 15 MB');
      const result = await command('IMPORT', JSON.parse(await file.text()));
      if (result?.reloadRequired) { await command('DISPOSE'); setGeneration(value => value + 1); }
      else { setNotice('存档已恢复。'); setPhase('paused'); }
    });
  }

  return <section className="meo-game-host" aria-label={`${game.title}游戏窗口`}>
    <header className="meo-game-bar"><div><small>MEO · SWITCH</small><strong>{game.title}</strong></div>
      <div><button disabled={!ready.current || busy} onClick={() => void action(async () => { await command('SET_MUTED', !muted); setMuted(!muted); frame.current?.focus(); })}>{muted ? '开启声音' : '静音'}</button>
        <button disabled={!ready.current || busy} onClick={() => void pause()}>暂停 / Home</button></div></header>
    <div className="meo-game-display">
      <iframe key={sessionId} ref={frame} title={`${game.title}运行画面`} src={`${game.entry}?session=${sessionId}`}
        sandbox="allow-scripts allow-same-origin" allow="autoplay" referrerPolicy="no-referrer" />
      {phase !== 'playing' && <div className="meo-game-shade"><div ref={menu} className="meo-game-menu" role="dialog" aria-modal="true" aria-label="游戏菜单"
        onKeyDown={event => {
          if (event.key !== 'Tab') return;
          const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
          if (!buttons.length) return;
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        }}>
        <small>仅在本机保存</small><h1>{phase === 'loading' ? '正在启动' : phase === 'failed' ? '暂时无法运行' : blocked ? '离开游戏前' : '游戏已暂停'}</h1>
        {phase === 'loading' || phase === 'failed' ? <p role="status">{progress}</p> : <>
          <p>{game.controls}</p>
          <p className="meo-game-save-info">{saved ? `上次保存：${new Date(saved.savedAt).toLocaleString()} · ${saved.summary}` : '尚未建立存档'}</p>
          <p>{game.saveMode === 'native' ? '塞尔达通过原生 SAVE 菜单保存进度；“返回上次存档”会放弃尚未保存的游玩进度。首次取名可按 Tab 切换键盘输入。' : '自动保存关卡和区域入口，每 15 秒更新。继续时从区域安全入口开始。'}</p>
          <div className="meo-game-buttons">
            <button disabled={busy} onClick={() => void action(resume)}>继续游玩</button>
            <button disabled={busy} onClick={() => void action(() => save(false))}>保存进度</button>
            <button disabled={busy} onClick={() => void action(() => save(true))}>保存并返回主页</button>
            {game.saveMode === 'native' && <button disabled={busy} onClick={() => void leave()}>返回上次存档并退出</button>}
            <button disabled={busy} onClick={() => void action(exportSave)}>导出存档</button>
            <button disabled={busy} onClick={() => input.current?.click()}>导入存档（替换当前存档）</button>
          </div>
          <p className="meo-game-local-note">存档不会上传服务器。清理本站浏览器数据会删除存档，可用导出文件备份。</p>
        </>}
        {(phase === 'loading' || phase === 'failed') && <div className="meo-game-buttons">
          {phase === 'failed' && <button disabled={busy} onClick={() => { if (ready.current) void command('PAUSE').catch(() => {}); setGeneration(value => value + 1); }}>重新加载</button>}
          <button disabled={busy} onClick={() => { ready.current = false; void leave(); }}>返回主页</button>
        </div>}
        {notice && <p role="status" className="meo-game-notice">{notice}</p>}
      </div></div>}
    </div>
    <footer className="meo-game-footer"><span>{game.controls}</span><span>{phase === 'playing' && notice ? notice : 'Esc / Home 暂停 · 存档仅在本机'} · <a href="/game-assets/NOTICE.html" target="_blank" rel="noopener noreferrer">来源与许可</a></span></footer>
    <input ref={input} hidden type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importSave(file); }} />
  </section>;
}
