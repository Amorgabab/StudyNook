/* ============================================================
   StudyNook · mochi.js — draws Mochi, your study pet, as inline
   SVG. Stages: egg → baby → kitten → study cat → scholar → legend
   Moods:  idle · focus · break · celebrate · sad
   ============================================================ */
'use strict';
window.Mochi = (function () {

  function face(mood, x, y, s) {
    // returns eye+mouth svg at (x,y) scale s
    if (mood === 'break' || mood === 'celebrate') {
      // happy closed arcs  ^ ^
      return `
        <path d="M ${x - 16 * s} ${y} q ${6 * s} ${-7 * s} ${12 * s} 0" stroke="#7A5C4F" stroke-width="${2.4 * s}" fill="none" stroke-linecap="round"/>
        <path d="M ${x + 4 * s} ${y} q ${6 * s} ${-7 * s} ${12 * s} 0" stroke="#7A5C4F" stroke-width="${2.4 * s}" fill="none" stroke-linecap="round"/>
        <path d="M ${x - 5 * s} ${y + 7 * s} q ${5 * s} ${5 * s} ${10 * s} 0" stroke="#7A5C4F" stroke-width="${2.2 * s}" fill="none" stroke-linecap="round"/>`;
    }
    if (mood === 'sad') {
      return `
        <circle cx="${x - 10 * s}" cy="${y}" r="${2.6 * s}" fill="#7A5C4F"/>
        <circle cx="${x + 10 * s}" cy="${y}" r="${2.6 * s}" fill="#7A5C4F"/>
        <path d="M ${x - 5 * s} ${y + 10 * s} q ${5 * s} ${-5 * s} ${10 * s} 0" stroke="#7A5C4F" stroke-width="${2.2 * s}" fill="none" stroke-linecap="round"/>
        <path d="M ${x + 13 * s} ${y + 4 * s} q ${2 * s} ${5 * s} 0 ${8 * s}" stroke="#8FB8D8" stroke-width="${2.4 * s}" fill="none" stroke-linecap="round"/>`;
    }
    if (mood === 'focus') {
      // determined little eyes + tiny mouth
      return `
        <g class="m-eye-blink">
          <circle cx="${x - 10 * s}" cy="${y}" r="${3 * s}" fill="#5B4437"/>
          <circle cx="${x + 10 * s}" cy="${y}" r="${3 * s}" fill="#5B4437"/>
          <circle cx="${x - 9 * s}" cy="${y - 1 * s}" r="${1 * s}" fill="#fff"/>
          <circle cx="${x + 11 * s}" cy="${y - 1 * s}" r="${1 * s}" fill="#fff"/>
        </g>
        <path d="M ${x - 3 * s} ${y + 7 * s} q ${3 * s} ${2.5 * s} ${6 * s} 0" stroke="#7A5C4F" stroke-width="${2 * s}" fill="none" stroke-linecap="round"/>`;
    }
    // idle: soft blinky eyes
    return `
      <g class="m-eye-blink">
        <circle cx="${x - 10 * s}" cy="${y}" r="${2.8 * s}" fill="#5B4437"/>
        <circle cx="${x + 10 * s}" cy="${y}" r="${2.8 * s}" fill="#5B4437"/>
      </g>
      <path d="M ${x - 4 * s} ${y + 6 * s} q ${4 * s} ${3.5 * s} ${8 * s} 0" stroke="#7A5C4F" stroke-width="${2 * s}" fill="none" stroke-linecap="round"/>`;
  }

  function blush(x, y, s) {
    return `<ellipse cx="${x}" cy="${y}" rx="${6.5 * s}" ry="${3.6 * s}" fill="#F5B8AE" opacity=".8"/>`;
  }

  /**
   * build(stage, mood) → svg markup string (viewBox 200x180)
   */
  function build(stage, mood) {
    const cx = 100, cy = 108;
    let body = '', extras = '';

    if (stage <= 0) {
      // sleepy egg on a cushion
      body = `
        <ellipse cx="${cx}" cy="${cy + 34}" rx="52" ry="14" fill="#E8C9A8"/>
        <g class="m-body">
          <ellipse cx="${cx}" cy="${cy + 2}" rx="40" ry="48" fill="#FFF9F0" stroke="#E4CDB2" stroke-width="3"/>
          <ellipse cx="${cx - 12}" cy="${cy - 16}" rx="7" ry="10" fill="#F6E3CB"/>
          <ellipse cx="${cx + 14}" cy="${cy + 8}" rx="6" ry="8" fill="#F6E3CB"/>
          ${face('break', cx, cy - 2, 0.9)}
          ${blush(cx - 22, cy + 6, 0.9)}${blush(cx + 22, cy + 6, 0.9)}
        </g>`;
      extras = `<text x="${cx + 44}" y="${cy - 34}" font-size="15" class="m-zzz">💤</text>`;
    } else {
      const s = stage === 1 ? 0.72 : stage === 2 ? 0.88 : 1;
      const ry = 44 * s, rx = 52 * s;
      const by = cy + (44 - ry);
      // ears (from kitten stage up)
      const ears = stage >= 2 ? `
        <path d="M ${cx - rx * 0.62} ${by - ry * 0.62} q ${-6 * s} ${-26 * s} ${16 * s} ${-14 * s} q ${8 * s} ${5 * s} ${8 * s} ${12 * s} Z" fill="#FFF6EA" stroke="#E4CDB2" stroke-width="3"/>
        <path d="M ${cx + rx * 0.62} ${by - ry * 0.62} q ${6 * s} ${-26 * s} ${-16 * s} ${-14 * s} q ${-8 * s} ${5 * s} ${-8 * s} ${12 * s} Z" fill="#FFF6EA" stroke="#E4CDB2" stroke-width="3"/>` : (stage === 1 ? `
        <circle cx="${cx - rx * 0.5}" cy="${by - ry * 0.78}" r="${7 * s}" fill="#FFF6EA" stroke="#E4CDB2" stroke-width="2.5"/>
        <circle cx="${cx + rx * 0.5}" cy="${by - ry * 0.78}" r="${7 * s}" fill="#FFF6EA" stroke="#E4CDB2" stroke-width="2.5"/>` : '');
      const tail = stage >= 2 ? `<path d="M ${cx + rx * 0.9} ${by + ry * 0.5} q ${26 * s} ${-6 * s} ${20 * s} ${-30 * s}" stroke="#E4CDB2" stroke-width="${7 * s}" fill="none" stroke-linecap="round"/>` : '';
      body = `
        ${tail}
        <g class="m-body">
          ${ears}
          <ellipse cx="${cx}" cy="${by}" rx="${rx}" ry="${ry}" fill="#FFF9F0" stroke="#E4CDB2" stroke-width="3"/>
          ${face(mood, cx, by - 4 * s, s)}
          ${blush(cx - 24 * s, by + 6 * s, s)}${blush(cx + 24 * s, by + 6 * s, s)}
          ${stage >= 1 ? `<path d="M ${cx - 8 * s} ${by + 16 * s} q ${8 * s} ${5 * s} ${16 * s} 0" stroke="#EBD3B8" stroke-width="${2 * s}" fill="none"/>` : ''}
        </g>`;

      if (stage >= 3) { // reading scarf
        body += `<path d="M ${cx - rx * 0.7} ${by + ry * 0.35} q ${rx * 0.7} ${14 * s} ${rx * 1.4} 0 l ${-4 * s} ${16 * s} q ${-rx * 0.6} ${10 * s} ${-rx * 1.2} 0 Z" fill="#E8A0A8" opacity=".9"/>`;
      }
      if (stage >= 4) { // round scholar glasses
        body += `
          <circle cx="${cx - 10 * s}" cy="${by - 4 * s}" r="${8 * s}" fill="none" stroke="#8A6A4F" stroke-width="2"/>
          <circle cx="${cx + 10 * s}" cy="${by - 4 * s}" r="${8 * s}" fill="none" stroke="#8A6A4F" stroke-width="2"/>
          <path d="M ${cx - 2 * s} ${by - 4 * s} h ${4 * s}" stroke="#8A6A4F" stroke-width="2"/>`;
      }
      if (stage >= 5) { // tiny crown + sparkles
        body += `<path d="M ${cx - 14} ${by - ry - 6} l 5 -12 l 6 8 l 5 -10 l 5 10 l 6 -8 l 5 12 Z" fill="#F2C14E" stroke="#D9A63B" stroke-width="2"/>`;
        extras += `<text x="${cx - 62}" y="${by - 30}" font-size="13" class="m-zzz">✨</text><text x="${cx + 48}" y="${by - 14}" font-size="11" class="m-zzz">✨</text>`;
      }
      if (mood === 'focus' || stage >= 3) { // little open book in front
        body += `
          <path d="M ${cx - 30 * s} ${by + ry * 0.72} q ${15 * s} ${-8 * s} ${30 * s} 0 q ${15 * s} ${-8 * s} ${30 * s} 0 l 0 ${14 * s} q ${-15 * s} ${-7 * s} ${-30 * s} 0 q ${-15 * s} ${-7 * s} ${-30 * s} 0 Z" fill="#BFD8EA" stroke="#8FB8D8" stroke-width="2"/>
          <path d="M ${cx} ${by + ry * 0.72 - 2 * s} l 0 ${14 * s}" stroke="#8FB8D8" stroke-width="2"/>`;
      }
      if (mood === 'break') extras += `<text x="${cx + 46}" y="${by - 26}" font-size="15" class="m-zzz">💤</text>`;
      if (mood === 'celebrate') extras += `<text x="${cx - 62}" y="${by - 24}" font-size="14" class="m-zzz">🎉</text><text x="${cx + 46}" y="${by - 30}" font-size="14" class="m-zzz">🌸</text>`;
    }

    return `<svg class="mochi-svg" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">${body}${extras}</svg>`;
  }

  return { build };
})();
