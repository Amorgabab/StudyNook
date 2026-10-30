'use strict';
/* StudyNook extension · label.js — what the blocked page shows where a countdown would go.
   Pure, so it is unit-tested. It used to print "Blocking is set to always on" whenever there was no
   countdown, which was wrong for a paused session and for a StudyNook that had simply been closed. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NookBlockLabel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  /** → { kind: 'countdown', endsAt } | { kind: 'paused', remainingSec } | { kind: 'offline' } | { kind: 'always' } */
  function blockLabel(st) {
    st = st || {};
    const s = st.session || {};
    const focus = !!(s.active && s.phase === 'focus');
    if (st.connected && focus && s.running) return { kind: 'countdown', endsAt: null, remainingSec: s.remainingSec };
    if (st.connected && focus) return { kind: 'paused', remainingSec: s.remainingSec };                 // pausing stops the clock, never the blocking
    if (!st.connected && st.timer && st.timer.running && st.timer.phase === 'focus') return { kind: 'countdown', endsAt: st.timer.endsAt };
    if (st.sites && st.sites.when === 'always') return { kind: 'always' };                              // the student chose "always"
    if (!st.connected && focus) return { kind: 'offline' };                                             // the app went away mid-session
    return { kind: 'always' };
  }
  return { blockLabel };
});
