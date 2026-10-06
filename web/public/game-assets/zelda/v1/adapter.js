/* ZQuest Web adapter. The engine owns the authoritative IndexedDB files. */
(() => {
  'use strict';
  const questPath = '/quests/meo/zelda/1stClassic.qst';
  let paused = false, muted = false, mounted = false, pendingNativeSave = false;
  let wakeups = [], syncQueue = Promise.resolve(), readyResolve, saved;
  let nativeBaseline = '';
  const readyPromise = new Promise(resolve => { readyResolve = resolve; });
  window.MEORuntime = {
    sleep(ms) { return new Promise(resolve => setTimeout(() => { if (paused) wakeups.push(resolve); else resolve(); }, ms)); },
  };
  function clearKeys() {
    for (const [key, code, keyCode] of [['ArrowLeft', 'ArrowLeft', 37], ['ArrowUp', 'ArrowUp', 38], ['ArrowRight', 'ArrowRight', 39], ['ArrowDown', 'ArrowDown', 40], ['z', 'KeyZ', 90], ['x', 'KeyX', 88], ['Enter', 'Enter', 13], [' ', 'Space', 32]]) {
      document.dispatchEvent(new KeyboardEvent('keyup', { key, code, keyCode, which: keyCode, bubbles: true }));
    }
  }
  async function pause() { clearKeys(); paused = true; await Module.SDL2?.audioContext?.suspend(); }
  async function resume() {
    paused = false; const callbacks = wakeups; wakeups = []; callbacks.forEach(resolve => resolve());
    if (!muted) void Module.SDL2?.audioContext?.resume().catch(console.warn); window.focus(); canvas.focus();
  }
  function files() {
    return ZC.fsReadAllFiles('/local').filter(file => !file.path.includes('/.backup/') && !file.path.endsWith('.log') && !file.path.endsWith('.qst'));
  }
  function savedFiles() { return files().filter(file => /\.(?:sav|zsv)$/i.test(file.path)); }
  function signature() { return savedFiles().map(file => `${file.path}:${FS.stat(file.path).mtime.getTime()}:${FS.stat(file.path).size}`).sort().join('|'); }
  async function sync(populate = false) {
    syncQueue = syncQueue.catch(() => {}).then(() => new Promise((resolve, reject) => FS.syncfs(populate, error => error ? reject(error) : resolve())));
    await syncQueue;
  }
  function b64(bytes) {
    let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(text);
  }
  function decode(text) { return Uint8Array.from(atob(text), char => char.charCodeAt(0)); }
  const adapter = {
    buildId: 'zc-web-20261004-v1', contentId: 'anthus-591-classic-1.3', capabilities: { saveMode: 'native' },
    async boot() {
      if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') throw new Error('页面隔离未启用，塞尔达无法运行。请检查本站部署响应头。');
      saved = await MEO.get();
      ZC.dataOrigin = new URL('.', location.href).href.replace(/\/$/, '');
      ZC.getQuestManifest = async () => ({});
      ZC.setStatus = message => {
        if (message === 'Ready') { MEO.status(''); readyResolve(); }
        else if (message && message !== 'Running...') MEO.status(message);
      };
      ZC.configureMount = async () => {
        FS.mkdirTree('/local'); FS.mount(IDBFS, {}, '/local'); await sync(true); mounted = true;
        if (!FS.analyzePath('/local/zquest.cfg').exists) FS.writeFile('/local/zquest.cfg', FS.readFile('/zquest_web.cfg'));
        FS.writeFile('/etc/timidity.cfg', FS.readFile('/etc/zc.cfg'));
        const response = await fetch('./1stClassic.qst'); if (!response.ok) throw new Error('塞尔达任务加载失败');
        FS.mkdirTree('/quests/meo/zelda'); FS.writeFile(questPath, new Uint8Array(await response.arrayBuffer()));
      };
      ZC.fsSync = async populate => {
        await sync(populate);
        if (!populate && mounted && savedFiles().length) {
          saved = { savedAt: new Date().toISOString(), summary: '塞尔达原生存档', files: savedFiles().length };
          await MEO.put(saved); MEO.committed(saved);
          if (pendingNativeSave && signature() !== nativeBaseline) { pendingNativeSave = false; MEO.send('NATIVE_SAVED', { saved }); }
        }
      };
      Module = window.Module = {
        noInitialRun: true, canvas: document.getElementById('canvas'),
        locateFile: file => new URL(file, location.href).href,
        setStatus: ZC.setStatus,
        onAbort: message => MEO.error(new Error(`塞尔达运行失败：${message}`)),
        onRuntimeInitialized() { callMain(['-web-open', questPath]); },
        printErr: message => console.warn(message),
      };
      window.zcCanvasSize = () => {
        const factor = Math.min(innerWidth / 640, innerHeight / 480);
        const cssW = Math.floor(640 * factor), cssH = Math.floor(480 * factor);
        canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
        return { cssW, cssH, bufW: 640, bufH: 480 };
      };
      for (const source of ['zplayer.data.js', 'zplayer.js']) {
        await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = source; script.onload = resolve; script.onerror = () => reject(new Error(`无法加载 ${source}`)); document.body.append(script); });
      }
      await readyPromise; await pause();
      addEventListener('resize', () => { zcCanvasSize(); Module._zc_web_display_size_changed?.(); });
    },
    pause, resume,
    cancelSave() { pendingNativeSave = false; },
    async save() {
      nativeBaseline = signature(); pendingNativeSave = true; await resume();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', code: 'F6', keyCode: 117, which: 117, bubbles: true }));
      setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { key: 'F6', code: 'F6', keyCode: 117, which: 117, bubbles: true })), 80);
      return { needsNativeSave: true };
    },
    async flush() { if (mounted) await sync(false); return saved || null; },
    async mute(value) { muted = value; if (value || paused) await Module.SDL2?.audioContext?.suspend(); else void Module.SDL2?.audioContext?.resume().catch(console.warn); },
    async export() {
      await sync(false);
      if (!savedFiles().length) throw new Error('请先在游戏内按 F6 并选择 SAVE 建立存档。');
      return { files: files().map(({ path }) => ({ path: path.slice('/local/'.length), data: b64(FS.readFile(path)) })) };
    },
    async import(payload) {
      if (!payload || !Array.isArray(payload.files) || payload.files.length > 100) throw new Error('塞尔达备份格式错误');
      const decoded = payload.files.map(file => {
        if (!file || typeof file.path !== 'string' || typeof file.data !== 'string' || !/^[\w ./-]+$/.test(file.path) || file.path.startsWith('/') || file.path.split('/').some(part => !part || part === '.' || part === '..') || !/\.(?:sav|zsv|cfg|json|txt)$/.test(file.path)) throw new Error('备份文件路径不合法');
        return { path: '/local/' + file.path, data: decode(file.data) };
      });
      if (new Set(decoded.map(file => file.path)).size !== decoded.length) throw new Error('备份存在重复文件路径');
      if (decoded.reduce((size, file) => size + file.data.length, 0) > 10 * 1024 * 1024 || !decoded.some(file => /\.sav$|\.zsv$/i.test(file.path))) throw new Error('备份过大或缺少原生存档');
      const original = files().map(({ path }) => ({ path, data: FS.readFile(path).slice() }));
      try {
        for (const file of files()) FS.unlink(file.path);
        for (const file of decoded) { FS.mkdirTree(PATH.dirname(file.path)); FS.writeFile(file.path, file.data); }
        await sync(false);
      } catch (error) {
        for (const file of files()) FS.unlink(file.path);
        for (const file of original) { FS.mkdirTree(PATH.dirname(file.path)); FS.writeFile(file.path, file.data); }
        await sync(false); throw error;
      }
      saved = { savedAt: new Date().toISOString(), summary: '塞尔达已恢复的原生存档', files: savedFiles().length };
      await MEO.put(saved); MEO.committed(saved);
      return { reloadRequired: true };
    },
  };
  MEO.start(adapter).catch(MEO.error);
})();
