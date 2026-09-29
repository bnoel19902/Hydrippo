/*
 * Hydrippo storage adapter.
 * Native (Capacitor): @capacitor/preferences  -> survives app updates, backed by SharedPreferences.
 * Web / prototype:     localStorage           -> per-browser, may be cleared.
 * Fallback:            in-memory              -> private windows, blocked storage.
 * Everything stays on the device. Nothing is sent anywhere.
 */
(function (root) {
  'use strict';

  var KEY = 'hydrippo.state.v1';
  var memory = null;

  function prefs() {
    var cap = root.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Preferences) {
      return cap.Plugins.Preferences;
    }
    return null;
  }

  async function load() {
    try {
      var p = prefs();
      if (p) {
        var r = await p.get({ key: KEY });
        return r && r.value ? JSON.parse(r.value) : null;
      }
      var raw = root.localStorage ? root.localStorage.getItem(KEY) : null;
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to memory */ }
    return memory ? JSON.parse(memory) : null;
  }

  var pending = null;
  function write(json) {
    try {
      var p = prefs();
      if (p) { p.set({ key: KEY, value: json }); return; }
      if (root.localStorage) root.localStorage.setItem(KEY, json);
    } catch (e) { /* storage unavailable; memory copy still holds this session */ }
  }
  // Debounced save so rapid taps don't hammer storage.
  function save(state) {
    var json = JSON.stringify(state);
    memory = json;
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () { pending = null; write(json); }, 150);
  }
  // Write a pending save immediately (app going to the background or closing).
  function flush() {
    if (!pending) return;
    clearTimeout(pending);
    pending = null;
    write(memory);
  }

  async function clear() {
    memory = null;
    try {
      var p = prefs();
      if (p) { await p.remove({ key: KEY }); return; }
      if (root.localStorage) root.localStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
  }

  root.HydStore = { load: load, save: save, flush: flush, clear: clear, KEY: KEY };
})(window);
