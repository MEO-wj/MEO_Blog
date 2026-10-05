/* MEO_Blog game bridge. Progress and backups remain on this browser. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('session') || 'standalone';
  const gameId = document.documentElement.dataset.game;
  const protocol = 'meo-game-v1';
  let adapter, ready = false, disposed = false, sequence = Promise.resolve(), releaseLock;
  const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('meo-game-saves', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  async function record(mode, action) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('records', mode);
      const request = action(transaction.objectStore('records'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('浏览器存储不可用'));
    });
  }
  function send(type, data = {}) {
    if (parent !== self) parent.postMessage({ protocol, gameId, sessionId, type, ...data }, location.origin);
  }
  function status(message) {
    const element = document.getElementById('status');
    if (element) { element.textContent = message; element.hidden = !message; }
    send('PROGRESS', { message });
  }
  function error(error) {
    const message = error instanceof Error ? error.message : String(error);
    status(message); send('ERROR', { message });
  }
  const runtime = window.MEO = {
    gameId, sessionId, send, status, error,
    get: () => record('readonly', store => store.get(gameId)),
    put: value => record('readwrite', store => store.put(value, gameId)),
    async digest(value) {
      const data = new TextEncoder().encode(JSON.stringify(value));
      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), byte => byte.toString(16).padStart(2, '0')).join('');
    },
    async lock() {
      if (!navigator.locks) throw new Error('当前浏览器不支持安全存档锁，请使用新版 Chrome、Edge 或 Firefox。');
      await new Promise((resolve, reject) => {
        navigator.locks.request(`meo-game:${gameId}`, { ifAvailable: true }, async lock => {
          if (!lock) { reject(new Error('这个游戏已在另一个标签页运行，请先关闭那个游戏。')); return; }
          resolve(); await new Promise(done => { releaseLock = done; });
        }).catch(reject);
      });
    },
    async start(value) {
      adapter = value;
      await runtime.lock();
      await adapter.boot();
      ready = true;
      status('');
      send('READY', { capabilities: adapter.capabilities, saved: await runtime.get() });
    },
    committed(saved) { send('SAVED', { saved }); },
    pauseRequest() {
      if (!ready || disposed) return;
      void adapter.pause(); send('PAUSE_REQUEST');
    },
    async command(type, payload) {
      if (!ready || disposed) throw new Error('游戏尚未准备好');
      switch (type) {
        case 'PAUSE': return adapter.pause();
        case 'RESUME': return adapter.resume();
        case 'SAVE': return adapter.save();
        case 'FLUSH': return adapter.flush();
        case 'SET_MUTED': return adapter.mute(Boolean(payload));
        case 'CANCEL_SAVE': return adapter.cancelSave?.();
        case 'EXPORT': {
          await adapter.pause();
          const value = { format: protocol, gameId, buildId: adapter.buildId, contentId: adapter.contentId, savedAt: new Date().toISOString(), payload: await adapter.export() };
          return { ...value, checksum: await runtime.digest(value) };
        }
        case 'IMPORT': {
          if (!payload || payload.format !== protocol || payload.gameId !== gameId || payload.buildId !== adapter.buildId || payload.contentId !== adapter.contentId) throw new Error('备份游戏或版本不匹配，原存档已保留。');
          const { checksum, ...body } = payload;
          if (await runtime.digest(body) !== checksum) throw new Error('备份文件校验失败，原存档已保留。');
          await adapter.pause(); return adapter.import(payload.payload);
        }
        case 'DISPOSE':
          await adapter.pause(); await adapter.flush(); disposed = true; releaseLock?.(); return null;
        default: throw new Error('未知游戏操作');
      }
    },
  };
  addEventListener('message', event => {
    const data = event.data;
    if (event.origin !== location.origin || event.source !== parent || !data || data.protocol !== protocol || data.gameId !== gameId || data.sessionId !== sessionId || typeof data.requestId !== 'string' || typeof data.type !== 'string') return;
    sequence = sequence.then(async () => {
      try { const result = await runtime.command(data.type, data.payload); send('ACK', { requestId: data.requestId, result }); }
      catch (e) { send('ACK', { requestId: data.requestId, message: e instanceof Error ? e.message : String(e) }); }
    });
  });
  addEventListener('keydown', event => {
    if (event.code !== 'Escape') return;
    event.preventDefault(); event.stopImmediatePropagation(); runtime.pauseRequest();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ready && !disposed) { runtime.pauseRequest(); void adapter.flush().catch(error); }
  });
  addEventListener('pagehide', () => { releaseLock?.(); if (ready) void adapter.flush().catch(() => {}); });
})();
