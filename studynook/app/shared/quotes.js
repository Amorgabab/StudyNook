/* ============================================================
   StudyNook · quotes.js — cozy little lines for the app and
   the Chrome extension's blocked page. Pure data.
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NookQuotes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const QUOTES = [
    'Small steps every day make big dreams come true.',
    'You don\'t have to be perfect. You just have to be here.',
    'Focus is a kind of kindness you give your future self.',
    'One page. One problem. One minute at a time.',
    'The cozy way is the steady way.',
    'Rest when the timer says so, not when the feed says so.',
    'Your attention is a garden. Water what you want to grow.',
    'Done is cozier than perfect.',
    'Future you is already saying thank you.',
    'A distracted mind is a leaky teapot. Put the lid on.',
    'Studying now means sleeping better tonight.',
    'You are the calmest, most focused creature in this room.',
    'Deep work first, dopamine later.',
    'Every closed tab is a tiny victory. Collect them.',
    'Slow is smooth, smooth is fast.',
    'Make the next 25 minutes yours.',
    'Discipline is choosing between what you want now and what you want most.',
    'The essay won\'t write itself, but you can write it in sprints.',
    'Be where your hands are. Be where your eyes are.',
    'Ten focused minutes beat an hour of half-attention.',
    'Mochi believes in you. That\'s scientifically significant.',
    'Close the tabs. Open the mind.',
    'Your streak is watching. Affectionately.',
    'Somewhere out there, a future you is very glad you stayed.',
    'Warm drink, quiet mind, one task.',
    'Progress hides inside boring minutes.',
    'You can do hard things while sitting softly.',
    'The internet will still be there after your session.',
    'Today\'s focus is tomorrow\'s freedom.',
    'Breathe in. Breathe out. Begin again.'
  ];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  return { QUOTES, pick };
});
