/* Adapter for dataquestio/FullScreenMario, revision 96a1e362. */
(() => {
  'use strict';
  let game, paused = true, muted = false, locationId = 0, restoring = false, lastSaved;
  const maps = /^(?:[1-8]-[1-4])$/;
  function validate(save) {
    if (!save || save.version !== 1 || !maps.test(save.map) || !Number.isInteger(save.location) || save.location < 0 || save.location > 100 || !save.stats) throw new Error('马里奥存档格式不正确');
    for (const key of ['lives', 'score', 'coins', 'power']) {
      if (!Number.isInteger(save.stats[key]) || save.stats[key] < 0 || save.stats[key] > 10000000) throw new Error('马里奥存档数值不正确');
    }
    if (save.stats.power < 1 || save.stats.power > 3 || !game.MapsCreator.getMap(save.map).locations[save.location]) throw new Error('马里奥检查点无效');
    return save;
  }
  function snapshot() {
    const stats = {};
    for (const key of ['lives', 'score', 'coins', 'power']) stats[key] = game.StatsHolder.get(key);
    return { version: 1, map: game.MapsHandler.getMapName(), location: Number(locationId), stats };
  }
  async function save() {
    // Restore at the current area's safe entrance, never serialize transient actors.
    if (!game.player || !game.player.alive || game.StatsHolder.get('lives') <= 0) {
      if (lastSaved) return { ...lastSaved, unchanged: true };
      throw new Error('当前正在死亡或切换关卡，请回到安全位置后保存。');
    }
    const payload = validate(snapshot());
    const candidate = { payload, savedAt: new Date().toISOString(), summary: `关卡 ${payload.map} · 区域入口 ${payload.location + 1}` };
    await MEO.put(candidate); lastSaved = candidate; MEO.committed(lastSaved); return lastSaved;
  }
  function clearKeys() { if (game.player) game.player.keys = game.player.getKeys(); }
  function pause() { paused = true; clearKeys(); game.GamesRunner.pause(); game.AudioPlayer.pauseAll(); }
  function resume() { paused = false; game.GamesRunner.play(); if (!muted) game.AudioPlayer.resumeAll(); window.focus(); }
  function restore(payload) {
    const value = validate(payload);
    restoring = true;
    for (const key of ['lives', 'score', 'coins', 'power']) game.StatsHolder.set(key, value.stats[key]);
    game.setMap(value.map, value.location);
    locationId = value.location;
    restoring = false;
    if (paused) pause();
  }
  MEO.start({
    buildId: 'fsm-96a1e362-v1', contentId: 'smb-original-32-v1', capabilities: { saveMode: 'checkpoint' },
    async boot() {
      // The old engine preloads with play(). Use load() and handle modern play promises.
      AudioPlayr.prototype.createAudio = function (name, sectionName) {
        const sound = document.createElement('audio');
        sound.src = `${this.directory}/${sectionName}/mp3/${name}.mp3`;
        sound.preload = 'auto'; sound.volume = 0;
        sound.setAttribute('volumeReal', '1'); sound.setAttribute('used', '0');
        sound.load(); return sound;
      };
      AudioPlayr.prototype.playSound = function (sound) {
        if (!sound) return false;
        sound.play()?.catch(error => {
          if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') console.warn('Mario audio:', error);
        });
        return true;
      };
      AudioPlayr.prototype.resumeAll = function () {
        for (const name of Object.keys(this.sounds)) this.playSound(this.sounds[name]);
      };
      AudioPlayr.prototype.resumeTheme = function () { if (this.theme) this.playSound(this.theme); };
      FullScreenMario.prototype.settings.audio.fileTypes = ['mp3'];
      FullScreenMario.prototype.settings.input.InputWritrArgs.aliases.up = [90, 38, 32];
      FullScreenMario.prototype.settings.input.InputWritrArgs.aliases.sprint = [88, 16];
      FullScreenMario.prototype.settings.input.InputWritrArgs.aliases.pause = [];
      game = window.FSM = new FullScreenMario({ width: 640, height: 464 });
      document.getElementById('game').append(game.container);
      const setLocation = game.setLocation;
      game.setLocation = function (id) {
        setLocation.call(game, id); locationId = id || 0;
        if (!restoring) setTimeout(() => { void save().catch(error => MEO.send('NOTICE', { message: `自动保存失败：${error.message}` })); }, 0);
        if (paused) game.GamesRunner.pause();
      };
      const down = game.InputWriter.makePipe('onkeydown', 'keyCode', true);
      const up = game.InputWriter.makePipe('onkeyup', 'keyCode', true);
      document.addEventListener('keydown', event => { if (!paused && !event.repeat) down(event); });
      document.addEventListener('keyup', event => up(event));
      lastSaved = await MEO.get();
      restoring = true;
      game.gameStart();
      restoring = false;
      if (lastSaved?.payload) restore(lastSaved.payload);
      else await save();
      pause();
      setInterval(() => { if (!paused) void save().catch(error => MEO.send('NOTICE', { message: `自动保存失败：${error.message}` })); }, 15000);
      function resize() {
        const scale = Math.min(innerWidth / 640, innerHeight / 464);
        game.container.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
      resize(); addEventListener('resize', resize);
    },
    pause, resume, save,
    flush: save,
    mute(value) { muted = value; game.AudioPlayer.setMuted(value); if (paused || value) game.AudioPlayer.pauseAll(); else game.AudioPlayer.resumeAll(); },
    async export() { const saved = await save(); return saved.payload; },
    async import(payload) { validate(payload); restore(payload); return save(); },
  }).catch(MEO.error);
})();
