/* ============================================================
   StudyNook · mochi.js — draws Mochi, your study pet, as inline
   SVG. Stages: egg → baby → kitten → study cat → scholar → legend
   Moods:  idle · focus · break · celebrate · sad
   Animation hooks (styles.css): .m-body (breathe), .m-eye-blink
   (blink), .m-zzz (zfloat).
   ============================================================ */
'use strict';
window.Mochi = (function () {

  // Gradient/clip ids must be unique: the sprite can be on screen twice.
  let uid = 0;

  // One restrained palette; it sits on --surface-2 in both themes.
  const C = {
    line: '#8C6651',    // the one outline colour
    ink: '#4A3428',     // eyes, mouth
    blush: '#F2A096',
    innerEar: '#F4B9AE',
    tear: '#8DB3D6',
    accent: '#7FA89E',  // muted sage: scarf, cushion
    accentDk: '#5E8A80',
    cover: '#93AECF',   // book cover
    page: '#FFFCF6',
    gold: '#F1C55B',
    zzz: '#B5A392',
    sparkle: '#E9B24F',
  };
  const SW = 3; // the one outline weight (viewBox units, ~1.6 px on screen);\n  // only interior detail (book pages, glasses, scarf stripes) uses thinner lines

  const n = (v) => Math.round(v * 100) / 100;

  /* ---------- defs ---------- */
  function defs(id) {
    return `<defs>
      <radialGradient id="mb${id}" cx=".38" cy=".3" r=".85">
        <stop offset="0" stop-color="#FFFBF4"/><stop offset=".55" stop-color="#FCEBD7"/><stop offset="1" stop-color="#F1D1B0"/>
      </radialGradient>
      <radialGradient id="me${id}" cx=".4" cy=".3" r=".85">
        <stop offset="0" stop-color="#FFFEFA"/><stop offset=".6" stop-color="#FAF0E1"/><stop offset="1" stop-color="#EBD7BC"/>
      </radialGradient>
      <radialGradient id="ms${id}" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#4A3428" stop-opacity=".32"/><stop offset="1" stop-color="#4A3428" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="mg${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F7D77E"/><stop offset="1" stop-color="#E3AE3E"/>
      </linearGradient>
      <linearGradient id="ma${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8DB5AB"/><stop offset="1" stop-color="#6F998F"/>
      </linearGradient>
    </defs>`;
  }

  /* ---------- shapes ---------- */
  // A soft dumpling: domed top, slightly flattened bottom. base = bottom y.
  function blobPath(cx, base, w, h) {
    const t = base - h;
    return `M ${n(cx - w)} ${n(base - h * 0.38)}`
      + ` C ${n(cx - w)} ${n(t + h * 0.12)} ${n(cx - w * 0.56)} ${n(t)} ${n(cx)} ${n(t)}`
      + ` C ${n(cx + w * 0.56)} ${n(t)} ${n(cx + w)} ${n(t + h * 0.12)} ${n(cx + w)} ${n(base - h * 0.38)}`
      + ` C ${n(cx + w)} ${n(base - h * 0.06)} ${n(cx + w * 0.66)} ${n(base)} ${n(cx)} ${n(base)}`
      + ` C ${n(cx - w * 0.66)} ${n(base)} ${n(cx - w)} ${n(base - h * 0.06)} ${n(cx - w)} ${n(base - h * 0.38)} Z`;
  }

  function shadow(id, cx, y, rx) {
    return `<ellipse cx="${n(cx)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(rx * 0.14)}" fill="url(#ms${id})"/>`;
  }

  // side = -1 (left) or 1 (right)
  function earPath(cx, top, w, h, side) {
    const b1x = cx + side * w * 0.9, b1y = top + h * 0.42;
    const tx = cx + side * w * 0.74, ty = top - h * 0.12;
    const b2x = cx + side * w * 0.2, b2y = top + h * 0.08;
    return `M ${n(b1x)} ${n(b1y)}`
      + ` C ${n(b1x + side * w * 0.02)} ${n(top + h * 0.12)} ${n(tx + side * w * 0.04)} ${n(ty + h * 0.08)} ${n(tx)} ${n(ty)}`
      + ` C ${n(tx - side * w * 0.06)} ${n(ty - h * 0.03)} ${n(b2x + side * w * 0.2)} ${n(b2y - h * 0.08)} ${n(b2x)} ${n(b2y)} Z`;
  }
  function ears(id, cx, top, w, h) {
    let out = '';
    [-1, 1].forEach((side) => {
      const d = earPath(cx, top, w, h, side);
      // inner ear: the same shape, shrunk toward a point near its base
      const ix = cx + side * w * 0.62, iy = top + h * 0.12;
      out += `<path d="${d}" fill="url(#mb${id})" stroke="${C.line}" stroke-width="${SW}" stroke-linejoin="round"/>`
        + `<path d="${d}" fill="${C.innerEar}" transform="translate(${n(ix)} ${n(iy)}) scale(.5) translate(${n(-ix)} ${n(-iy)})"/>`;
    });
    return out;
  }

  function tail(cx, base, w, h) {
    const x0 = cx + w * 0.78, y0 = base - h * 0.14;
    const d = `M ${n(x0)} ${n(y0)} C ${n(x0 + w * 0.42)} ${n(y0 + h * 0.02)} ${n(x0 + w * 0.5)} ${n(y0 - h * 0.34)} ${n(x0 + w * 0.3)} ${n(y0 - h * 0.46)}`;
    return `<path d="${d}" stroke="${C.line}" stroke-width="${n(w * 0.22 + SW * 2)}" fill="none" stroke-linecap="round"/>`
      + `<path d="${d}" stroke="#F6E0C6" stroke-width="${n(w * 0.22)}" fill="none" stroke-linecap="round"/>`;
  }

  function feet(id, cx, base, w) {
    return [-1, 1].map((side) =>
      `<ellipse cx="${n(cx + side * w * 0.4)}" cy="${n(base - 2)}" rx="${n(w * 0.17)}" ry="${n(w * 0.11)}" fill="url(#mb${id})" stroke="${C.line}" stroke-width="${SW}"/>`
    ).join('');
  }

  /* ---------- face ---------- */
  function openEyes(cx, ey, dx, s, ry) {
    const rx = 4.3 * s, r2 = ry * s;
    return `<g class="m-eye-blink">`
      + [-1, 1].map((side) => {
        const x = cx + side * dx;
        return `<ellipse cx="${n(x)}" cy="${n(ey)}" rx="${n(rx)}" ry="${n(r2)}" fill="${C.ink}"/>`
          + `<circle cx="${n(x + 1.5 * s)}" cy="${n(ey - r2 * 0.42)}" r="${n(1.7 * s)}" fill="#fff"/>`
          + `<circle cx="${n(x - 1.6 * s)}" cy="${n(ey + r2 * 0.45)}" r="${n(0.8 * s)}" fill="#fff" opacity=".7"/>`;
      }).join('') + `</g>`;
  }
  function stroke(d, w, color) {
    return `<path d="${d}" stroke="${color || C.ink}" stroke-width="${n(w)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // cx = face centre, ey = eye line, dx = half eye spacing, s = scale
  function face(mood, cx, ey, dx, s) {
    const my = ey + 8.5 * s;          // mouth line
    const lw = 2.3 * s;               // feature line weight
    let eyes = '', mouth = '', more = '';
    const blushes = [-1, 1].map((side) =>
      `<ellipse cx="${n(cx + side * (dx + 6.5 * s))}" cy="${n(ey + 6.5 * s)}" rx="${n(5.2 * s)}" ry="${n(3 * s)}" fill="${C.blush}" opacity=".55"/>`).join('');

    if (mood === 'sleep' || mood === 'break') {
      // relaxed, closed eyes (gentle downward arcs) and a small content smile
      eyes = [-1, 1].map((side) => {
        const x = cx + side * dx;
        return stroke(`M ${n(x - 4.6 * s)} ${n(ey - 0.5 * s)} q ${n(4.6 * s)} ${n(4 * s)} ${n(9.2 * s)} 0`, lw);
      }).join('');
      mouth = stroke(`M ${n(cx - 2.6 * s)} ${n(my)} q ${n(2.6 * s)} ${n(2.2 * s)} ${n(5.2 * s)} 0`, lw * 0.9);
    } else if (mood === 'celebrate') {
      // ^ ^ eyes and an open, happy mouth
      eyes = [-1, 1].map((side) => {
        const x = cx + side * dx;
        return stroke(`M ${n(x - 4.6 * s)} ${n(ey + 2 * s)} q ${n(4.6 * s)} ${n(-6.4 * s)} ${n(9.2 * s)} 0`, lw);
      }).join('');
      mouth = `<path d="M ${n(cx - 5 * s)} ${n(my - 1 * s)} q ${n(5 * s)} ${n(1.4 * s)} ${n(10 * s)} 0 q ${n(-1 * s)} ${n(7.5 * s)} ${n(-5 * s)} ${n(7.5 * s)} q ${n(-4 * s)} 0 ${n(-5 * s)} ${n(-7.5 * s)} Z" fill="#8E4B44" stroke="${C.ink}" stroke-width="${n(lw * 0.8)}" stroke-linejoin="round"/>`
        + `<ellipse cx="${n(cx)}" cy="${n(my + 4.4 * s)}" rx="${n(2.6 * s)}" ry="${n(1.6 * s)}" fill="#E68A85"/>`;
    } else if (mood === 'sad') {
      eyes = openEyes(cx, ey + 1 * s, dx, s, 4.4);
      // worried brows: inner ends raised
      more = [-1, 1].map((side) => {
        const x = cx + side * dx;
        return stroke(`M ${n(x + side * 4.5 * s)} ${n(ey - 7 * s)} L ${n(x - side * 3.5 * s)} ${n(ey - 9.5 * s)}`, lw * 0.85);
      }).join('');
      mouth = stroke(`M ${n(cx - 4 * s)} ${n(my + 2 * s)} q ${n(4 * s)} ${n(-3.6 * s)} ${n(8 * s)} 0`, lw);
      const tx = cx + dx + 3 * s, ty = ey + 5 * s;
      more += `<path d="M ${n(tx)} ${n(ty)} q ${n(-3 * s)} ${n(4.6 * s)} 0 ${n(6.2 * s)} q ${n(3 * s)} ${n(-1.6 * s)} 0 ${n(-6.2 * s)} Z" fill="${C.tear}"/>`;
    } else if (mood === 'focus') {
      // steady eyes (a touch narrower) and a small, set mouth
      eyes = openEyes(cx, ey, dx, s, 4.3);
      mouth = stroke(`M ${n(cx - 2.6 * s)} ${n(my + 0.6 * s)} q ${n(2.6 * s)} ${n(1.2 * s)} ${n(5.2 * s)} 0`, lw * 0.9);
    } else {
      // idle: open eyes and a cat "w" mouth
      eyes = openEyes(cx, ey, dx, s, 5.2);
      mouth = stroke(`M ${n(cx - 5 * s)} ${n(my - 0.6 * s)} q ${n(2.5 * s)} ${n(3.2 * s)} ${n(5 * s)} 0 q ${n(2.5 * s)} ${n(3.2 * s)} ${n(5 * s)} 0`, lw * 0.9);
    }
    return blushes + eyes + mouth + more;
  }

  /* ---------- accents (drawn, no emoji) ---------- */
  function zzz(x, y) {
    return `<g class="m-zzz" fill="none" stroke="${C.zzz}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M ${x} ${y} h 8 l -8 9 h 8"/><path d="M ${x + 13} ${y - 11} h 6 l -6 7 h 6"/></g>`;
  }
  function sparkle(x, y, r) {
    const k = r * 0.22;
    return `<path class="m-zzz" d="M ${n(x)} ${n(y - r)} Q ${n(x + k)} ${n(y - k)} ${n(x + r)} ${n(y)} Q ${n(x + k)} ${n(y + k)} ${n(x)} ${n(y + r)} Q ${n(x - k)} ${n(y + k)} ${n(x - r)} ${n(y)} Q ${n(x - k)} ${n(y - k)} ${n(x)} ${n(y - r)} Z" fill="${C.sparkle}"/>`;
  }

  /* ---------- accessories ---------- */
  function shellCap(id, cx, top, w, h) {
    // the top half of the eggshell, still sitting on the hatchling's head
    const l = cx - w * 0.66, r = cx + w * 0.66, y = top + h * 0.2;
    let d = `M ${n(l)} ${n(y)} C ${n(l)} ${n(top - h * 0.12)} ${n(r)} ${n(top - h * 0.12)} ${n(r)} ${n(y)}`;
    const teeth = 6;
    for (let i = 1; i <= teeth; i++) {
      const x = r - (r - l) * (i / teeth);
      const yy = i % 2 ? y - h * 0.09 : y;
      d += ` L ${n(x)} ${n(yy)}`;
    }
    return `<path d="${d} Z" fill="url(#me${id})" stroke="${C.line}" stroke-width="${SW}" stroke-linejoin="round" transform="rotate(-9 ${n(cx)} ${n(top)})"/>`;
  }

  function scarf(id, cx, top, w, h, bodyD) {
    const y0 = top + h * 0.56, t = h * 0.12, sag = h * 0.06;
    const band = `M ${n(cx - w - 4)} ${n(y0 - sag * 0.4)} Q ${n(cx)} ${n(y0 + sag * 1.6)} ${n(cx + w + 4)} ${n(y0 - sag * 0.4)}`
      + ` L ${n(cx + w + 4)} ${n(y0 + t - sag * 0.4)} Q ${n(cx)} ${n(y0 + t + sag * 1.6)} ${n(cx - w - 4)} ${n(y0 + t - sag * 0.4)} Z`;
    const ex = cx - w * 0.84, ey = y0 + t * 0.3;
    const end = `M ${n(ex)} ${n(ey)} l ${n(w * 0.24)} ${n(h * 0.02)} l ${n(-w * 0.1)} ${n(h * 0.27)} l ${n(-w * 0.24)} ${n(-h * 0.04)} Z`;
    return `<clipPath id="mc${id}"><path d="${bodyD}"/></clipPath>`
      + `<g clip-path="url(#mc${id})"><path d="${band}" fill="url(#ma${id})" stroke="${C.line}" stroke-width="${SW}"/></g>`
      + `<path d="${bodyD}" fill="none" stroke="${C.line}" stroke-width="${SW}"/>`
      + `<path d="${end}" fill="url(#ma${id})" stroke="${C.line}" stroke-width="${SW}" stroke-linejoin="round"/>`
      + stroke(`M ${n(ex - w * 0.02)} ${n(ey + h * 0.11)} l ${n(w * 0.2)} ${n(h * 0.02)} M ${n(ex - w * 0.05)} ${n(ey + h * 0.18)} l ${n(w * 0.2)} ${n(h * 0.02)}`, 1.6, C.accentDk);
  }

  function glasses(cx, ey, dx, s) {
    const r = 8.6 * s;
    return [-1, 1].map((side) =>
      `<circle cx="${n(cx + side * dx)}" cy="${n(ey)}" r="${n(r)}" fill="#fff" fill-opacity=".22" stroke="${C.line}" stroke-width="2.4"/>`).join('')
      + stroke(`M ${n(cx - dx + r)} ${n(ey - 1)} q ${n(dx - r)} ${n(-3.4 * s)} ${n(2 * (dx - r))} 0`, 2.4, C.line);
  }

  function crown(id, cx, top) {
    const y = top + 5;
    const d = `M ${cx - 15} ${y} L ${cx - 17} ${y - 16} L ${cx - 8} ${y - 8} L ${cx} ${y - 20} L ${cx + 8} ${y - 8} L ${cx + 17} ${y - 16} L ${cx + 15} ${y} Q ${cx} ${y + 3} ${cx - 15} ${y} Z`;
    return `<path d="${d}" fill="url(#mg${id})" stroke="${C.line}" stroke-width="${SW}" stroke-linejoin="round"/>`
      + `<circle cx="${cx}" cy="${y - 20}" r="2.4" fill="${C.gold}" stroke="${C.line}" stroke-width="1.6"/>`
      + `<circle cx="${cx}" cy="${y - 4}" r="2.2" fill="#D98C8C"/>`;
  }

  function book(id, cx, base, w) {
    const hw = w * 0.58, y = base - 17, ph = 16;
    const cover = `M ${n(cx)} ${n(y + 4)} C ${n(cx - hw * 0.35)} ${n(y - 2)} ${n(cx - hw * 0.75)} ${n(y - 2)} ${n(cx - hw - 3)} ${n(y + 2)}`
      + ` L ${n(cx - hw - 3)} ${n(y + ph + 4)} C ${n(cx - hw * 0.7)} ${n(y + ph)} ${n(cx - hw * 0.3)} ${n(y + ph + 1)} ${n(cx)} ${n(y + ph + 6)}`
      + ` C ${n(cx + hw * 0.3)} ${n(y + ph + 1)} ${n(cx + hw * 0.7)} ${n(y + ph)} ${n(cx + hw + 3)} ${n(y + ph + 4)}`
      + ` L ${n(cx + hw + 3)} ${n(y + 2)} C ${n(cx + hw * 0.75)} ${n(y - 2)} ${n(cx + hw * 0.35)} ${n(y - 2)} ${n(cx)} ${n(y + 4)} Z`;
    const page = (side) => {
      const e = cx + side * hw;
      return `M ${n(cx)} ${n(y + 3)} C ${n(cx + side * hw * 0.35)} ${n(y - 4)} ${n(cx + side * hw * 0.75)} ${n(y - 4)} ${n(e)} ${n(y)}`
        + ` L ${n(e)} ${n(y + ph)} C ${n(cx + side * hw * 0.7)} ${n(y + ph - 4)} ${n(cx + side * hw * 0.3)} ${n(y + ph - 3)} ${n(cx)} ${n(y + ph + 2)} Z`;
    };
    const lines = [-1, 1].map((side) => [0.35, 0.6].map((f) =>
      stroke(`M ${n(cx + side * hw * 0.22)} ${n(y + ph * f)} q ${n(side * hw * 0.25)} ${n(-3)} ${n(side * hw * 0.55)} ${n(-1)}`, 1.4, '#C9B8A6')).join('')).join('');
    const paws = [-1, 1].map((side) =>
      `<ellipse cx="${n(cx + side * (hw - 2))}" cy="${n(y + 3)}" rx="6.4" ry="5.2" fill="url(#mb${id})" stroke="${C.line}" stroke-width="${SW}"/>`).join('');
    return `<path d="${cover}" fill="${C.cover}" stroke="${C.line}" stroke-width="${SW}" stroke-linejoin="round"/>`
      + `<path d="${page(-1)}" fill="${C.page}" stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round"/>`
      + `<path d="${page(1)}" fill="${C.page}" stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round"/>`
      + lines + paws;
  }

  /**
   * build(stage, mood) → svg markup string (viewBox 200x180)
   */
  function build(stage, mood) {
    const id = ++uid;
    const cx = 100, base = 150;
    let back = '', body = '', extras = '';

    if (stage <= 0) {
      // sleepy egg on a cushion
      const top = 62;
      const egg = `M ${cx} ${top} C ${cx + 25} ${top} ${cx + 38} ${top + 42} ${cx + 38} ${top + 60}`
        + ` C ${cx + 38} ${top + 80} ${cx + 21} ${base - 2} ${cx} ${base - 2} C ${cx - 21} ${base - 2} ${cx - 38} ${top + 80} ${cx - 38} ${top + 60}`
        + ` C ${cx - 38} ${top + 42} ${cx - 25} ${top} ${cx} ${top} Z`;
      back = shadow(id, cx, base + 8, 56)
        + `<path d="M ${cx - 54} ${base} C ${cx - 56} ${base - 14} ${cx - 30} ${base - 16} ${cx} ${base - 15} C ${cx + 30} ${base - 16} ${cx + 56} ${base - 14} ${cx + 54} ${base} C ${cx + 52} ${base + 10} ${cx + 28} ${base + 11} ${cx} ${base + 11} C ${cx - 28} ${base + 11} ${cx - 52} ${base + 10} ${cx - 54} ${base} Z" fill="url(#ma${id})" stroke="${C.line}" stroke-width="${SW}"/>`
        + `<circle cx="${cx - 34}" cy="${base + 1}" r="1.8" fill="${C.accentDk}"/><circle cx="${cx + 34}" cy="${base + 1}" r="1.8" fill="${C.accentDk}"/>`;
      body = `<g class="m-body">
          <path d="${egg}" fill="url(#me${id})" stroke="${C.line}" stroke-width="${SW}"/>
          <ellipse cx="${cx - 15}" cy="${top + 22}" rx="6" ry="8.5" fill="#F3E2CB" transform="rotate(-18 ${cx - 15} ${top + 22})"/>
          <ellipse cx="${cx + 19}" cy="${top + 38}" rx="4" ry="5.5" fill="#F3E2CB"/>
          ${face('sleep', cx, top + 52, 12, 1)}
        </g>`;
      extras = zzz(cx + 40, top - 2);
    } else {
      const s = stage === 1 ? 0.72 : stage === 2 ? 0.88 : 1;
      const w = 50 * s, h = (stage === 1 ? 80 : 84) * s;
      const top = base - h;
      const bodyD = blobPath(cx, base, w, h);
      const ey = top + h * (stage === 1 ? 0.52 : 0.45);
      const dx = 15 * s;
      const fs = Math.max(s, 0.86); // keep the face readable on the small stages
      const holdsBook = mood === 'focus' || stage >= 3;

      back = shadow(id, cx, base + 1, w * 1.05);
      if (stage >= 2) back += tail(cx, base, w, h);

      let parts = '';
      if (stage >= 2) parts += ears(id, cx, top, w, h);
      parts += `<path d="${bodyD}" fill="url(#mb${id})" stroke="${C.line}" stroke-width="${SW}"/>`;
      // soft sheen on the upper-left of the body
      parts += `<ellipse cx="${n(cx - w * 0.45)}" cy="${n(top + h * 0.22)}" rx="${n(w * 0.16)}" ry="${n(h * 0.08)}" fill="#fff" opacity=".55" transform="rotate(-30 ${n(cx - w * 0.45)} ${n(top + h * 0.22)})"/>`;
      if (stage >= 2 && !holdsBook) parts += feet(id, cx, base, w);
      if (stage >= 3) parts += scarf(id, cx, top, w, h, bodyD);
      parts += face(mood, cx, ey, dx * (fs / s), fs);
      if (stage >= 4) parts += glasses(cx, mood === 'sad' ? ey + fs : ey, dx * (fs / s), fs);
      if (stage === 1) parts += shellCap(id, cx, top, w, h);
      if (stage >= 5) parts += crown(id, cx, top);
      if (holdsBook) parts += book(id, cx, base, Math.max(w, 44));
      body = `<g class="m-body">${parts}</g>`;

      if (stage >= 5 && mood !== 'celebrate') extras += sparkle(cx - 60, top + 6, 7) + sparkle(cx - 66, top + 36, 4);
      if (mood === 'break') extras += zzz(cx + w * 0.9 + 4, top - 2);
      if (mood === 'celebrate') extras += sparkle(cx - w - 12, top + 18, 7) + sparkle(cx + w + 8, top - 4, 6) + sparkle(cx - w - 4, top + h * 0.62, 4);
    }

    return `<svg class="mochi-svg" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">${defs(id)}${back}${body}${extras}</svg>`;
  }

  return { build };
})();
