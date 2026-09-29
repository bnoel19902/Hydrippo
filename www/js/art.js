/*
 * Hydrippo artwork: Drip the hippo and the bottle shapes. All original SVG.
 * Colors come from CSS classes (see app.css) so both themes work.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function el(markup) {
    var t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstChild;
  }

  // A wide sine strip whose top edge sits at y=0 and fills down to `depth`.
  function wave(x0, x1, amp, len, depth) {
    var d = 'M' + x0 + ' 0 Q ' + (x0 + len / 4) + ' ' + (-amp) + ' ' + (x0 + len / 2) + ' 0';
    for (var x = x0 + len / 2; x < x1; x += len / 2) d += ' T ' + (x + len / 2) + ' 0';
    d += ' L ' + x1 + ' ' + depth + ' L ' + x0 + ' ' + depth + ' Z';
    return d;
  }

  /* ------------------------------------------------------------------ */
  /* Drip the hippo, sitting in his pond. fill 0..1 = today's progress.  */
  /* ------------------------------------------------------------------ */

  function drip(opts) {
    opts = opts || {};
    var id = 'drip' + (++uid);
    var svg = el(
      '<svg class="drip" viewBox="0 0 160 120" role="img" aria-label="Drip the hippo" data-mood="ok" data-acc="none">' +
        '<defs><clipPath id="' + id + 'c"><rect x="0" y="0" width="160" height="120" rx="18"/></clipPath></defs>' +
        '<g clip-path="url(#' + id + 'c)">' +
          '<rect class="d-sky" x="0" y="0" width="160" height="120"/>' +
          '<ellipse class="d-reed" cx="18" cy="96" rx="4" ry="30"/><ellipse class="d-reed" cx="27" cy="104" rx="3" ry="22"/>' +
          '<ellipse class="d-reed" cx="146" cy="100" rx="4" ry="26"/>' +
          '<g class="d-bob">' +
            '<ellipse class="d-hippo" cx="80" cy="114" rx="56" ry="30"/>' +
            '<ellipse class="d-hippo" cx="80" cy="54" rx="27" ry="19"/>' +
            '<ellipse class="d-hippo" cx="57" cy="35" rx="6" ry="8.5" transform="rotate(-24 57 35)"/>' +
            '<ellipse class="d-hippo" cx="103" cy="35" rx="6" ry="8.5" transform="rotate(24 103 35)"/>' +
            '<ellipse class="d-ear" cx="57" cy="36" rx="2.6" ry="4.4" transform="rotate(-24 57 36)"/>' +
            '<ellipse class="d-ear" cx="103" cy="36" rx="2.6" ry="4.4" transform="rotate(24 103 36)"/>' +
            '<circle class="d-hippo" cx="68" cy="45" r="9.5"/><circle class="d-hippo" cx="92" cy="45" r="9.5"/>' +
            '<ellipse class="d-hippo" cx="80" cy="76" rx="37" ry="25"/>' +
            '<ellipse class="d-shade" cx="80" cy="90" rx="30" ry="9"/>' +
            // eyes: open
            '<g class="d-eyes-open">' +
              '<circle class="d-eyewhite" cx="68" cy="46" r="5.6"/><circle class="d-eyewhite" cx="92" cy="46" r="5.6"/>' +
              '<circle class="d-ink" cx="69" cy="47" r="3.1"/><circle class="d-ink" cx="93" cy="47" r="3.1"/>' +
              '<circle class="d-glint" cx="70" cy="45.6" r="1"/><circle class="d-glint" cx="94" cy="45.6" r="1"/>' +
              '<g class="d-lids"><rect class="d-hippo" x="61" y="38.5" width="14" height="7"/><rect class="d-hippo" x="85" y="38.5" width="14" height="7"/></g>' +
            '</g>' +
            // eyes: happy arcs
            '<g class="d-eyes-happy"><path class="d-stroke" d="M63 48 Q68 42 73 48"/><path class="d-stroke" d="M87 48 Q92 42 97 48"/></g>' +
            '<ellipse class="d-nostril" cx="70" cy="61" rx="3.4" ry="2.4"/><ellipse class="d-nostril" cx="90" cy="61" rx="3.4" ry="2.4"/>' +
            '<circle class="d-cheek" cx="53" cy="80" r="6"/><circle class="d-cheek" cx="107" cy="80" r="6"/>' +
            // mouths
            '<path class="d-stroke d-m-ok" d="M67 86 Q80 93 93 86"/>' +
            '<g class="d-m-happy"><path class="d-mouth" d="M62 83 Q80 101 98 83 Q80 90 62 83 Z"/><rect class="d-tooth" x="70" y="85.5" width="5" height="5" rx="1.2"/><rect class="d-tooth" x="85" y="85.5" width="5" height="5" rx="1.2"/></g>' +
            '<g class="d-m-thirsty"><ellipse class="d-mouth" cx="80" cy="88" rx="6.5" ry="4.5"/><path class="d-tongue" d="M76 89.5 Q80 97 84 89.5 Z"/></g>' +
            '<path class="d-sweat" d="M112 44 Q116 51 112 54 Q108 51 112 44 Z"/>' +
            // signature droplet tuft
            '<path class="d-tuft" d="M80 22 Q86 30 83 35 Q80 38 77 35 Q74 30 80 22 Z"/>' +
            // accessories (Plus)
            '<g class="d-acc d-acc-cap"><path class="d-cap" d="M55 40 Q57 22 80 21 Q103 22 105 40 Z"/><path class="d-cap" d="M98 38 Q118 36 124 42 Q112 45 98 43 Z"/><circle class="d-capdot" cx="80" cy="22" r="2.4"/></g>' +
            '<g class="d-acc d-acc-lily"><ellipse class="d-pad" cx="104" cy="28" rx="11" ry="4.5"/><path class="d-petal" d="M104 27 Q98 18 104 12 Q110 18 104 27 Z"/><path class="d-petal" d="M104 27 Q95 23 94 16 Q101 18 104 27 Z"/><path class="d-petal" d="M104 27 Q113 23 114 16 Q107 18 104 27 Z"/></g>' +
            '<g class="d-acc d-acc-shades"><rect class="d-ink" x="58" y="40" width="20" height="12" rx="5"/><rect class="d-ink" x="82" y="40" width="20" height="12" rx="5"/><rect class="d-ink" x="76" y="43" width="8" height="3" rx="1.5"/><rect class="d-glint" x="61" y="42.5" width="6" height="2" rx="1"/><rect class="d-glint" x="85" y="42.5" width="6" height="2" rx="1"/></g>' +
            // hard hat (for the warehouse crowd)
            '<g class="d-acc d-acc-hardhat"><path class="d-hat-y" d="M54 38 Q55 17 80 16 Q105 17 106 38 Z"/><rect class="d-hat-y2" x="76" y="15" width="8" height="22" rx="4"/><rect class="d-hat-y2" x="47" y="35" width="66" height="6.5" rx="3.2"/></g>' +
            // headphones
            '<g class="d-acc d-acc-headphones"><path class="d-band" d="M50 46 Q50 13 80 13 Q110 13 110 46"/><rect class="d-cup" x="43" y="37" width="13" height="20" rx="6"/><rect class="d-cup" x="104" y="37" width="13" height="20" rx="6"/></g>' +
            // beanie
            '<g class="d-acc d-acc-beanie"><path class="d-bea" d="M55 39 Q56 15 80 14 Q104 15 105 39 Z"/><rect class="d-bea2" x="52" y="33" width="56" height="9" rx="4.5"/><circle class="d-pom" cx="80" cy="13" r="5.5"/></g>' +
            // sweatband
            '<g class="d-acc d-acc-sweatband"><rect class="d-band2" x="55" y="31" width="50" height="7" rx="3.5"/><rect class="d-glint" x="58" y="33.5" width="44" height="1.6" rx="0.8" opacity="0.7"/></g>' +
            // crown (earned with a 30-day streak)
            '<g class="d-acc d-acc-crown"><path class="d-crown" d="M61 35 L63 19 L71.5 27.5 L80 15 L88.5 27.5 L97 19 L99 35 Z"/><circle class="d-gem" cx="80" cy="29" r="2.6"/><circle class="d-gem2" cx="69" cy="31" r="1.8"/><circle class="d-gem2" cx="91" cy="31" r="1.8"/></g>' +
          '</g>' +
          '<rect class="d-mud" x="0" y="110" width="160" height="10"/>' +
          '<g class="d-level" style="transform: translateY(120px)">' +
            '<g class="d-wave"><path class="d-water" d="' + wave(-160, 320, 3, 40, 80) + '"/></g>' +
            '<g class="d-bubbles"><circle cx="64" cy="18" r="2.2"/><circle cx="96" cy="26" r="1.6"/><circle cx="80" cy="34" r="1.9"/></g>' +
          '</g>' +
        '</g>' +
      '</svg>'
    );

    var level = svg.querySelector('.d-level');
    function update(o) {
      var f = Math.max(0, Math.min(1, o.fill || 0));
      var y = 120 - f * (120 - 66); // full = water just under the nostrils
      level.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
      var mood = f >= 1 ? 'splash' : f >= 0.75 ? 'happy' : f >= 0.25 ? 'ok' : 'thirsty';
      svg.setAttribute('data-mood', mood);
      svg.setAttribute('data-acc', o.accessory || 'none');
      svg.setAttribute('aria-label', 'Drip the hippo, ' + Math.round(f * 100) + ' percent soaked');
    }
    update({ fill: opts.fill || 0, accessory: opts.accessory });
    return { el: svg, update: update };
  }

  /* ------------------------------------------------------------------ */
  /* Bottles. viewBox 0 0 250 380; bottle centered on x=100, ticks right. */
  /* ------------------------------------------------------------------ */

  var SHAPES = {
    tumbler: {
      outer: 'M38 74 L162 74 L148 362 Q147 370 139 370 L61 370 Q53 370 52 362 Z',
      inner: 'M45 80 L155 80 L142 357 Q141 363 135 363 L65 363 Q59 363 58 357 Z',
      full: 88, empty: 363, left: 45, right: 155,
      back: '',
      front: '<rect class="b-color" x="113" y="2" width="11" height="54" rx="5.5" transform="rotate(8 118 52)" opacity="0.9"/>' +
             '<rect class="b-color" x="31" y="46" width="138" height="32" rx="12"/><rect class="b-shade" x="31" y="68" width="138" height="10" rx="4"/>' +
             '<path class="b-shine" d="M56 96 L63 336"/>'
    },
    sport: {
      outer: 'M72 60 L128 60 L128 80 Q158 90 158 118 L158 352 Q158 370 140 370 L60 370 Q42 370 42 352 L42 118 Q42 90 72 80 Z',
      inner: 'M78 66 L122 66 L122 85 Q151 95 151 120 L151 350 Q151 363 138 363 L62 363 Q49 363 49 350 L49 120 Q49 95 78 85 Z',
      full: 104, empty: 363, left: 49, right: 151,
      back: '',
      front: '<path class="b-loop" d="M84 30 Q100 2 116 30"/><rect class="b-color" x="64" y="26" width="72" height="38" rx="12"/><rect class="b-shade" x="64" y="54" width="72" height="10" rx="4"/>' +
             '<path class="b-rib" d="M42 236 L158 236 M42 268 L158 268"/><path class="b-shine" d="M58 130 L58 330"/>'
    },
    jug: {
      outer: 'M50 70 L90 70 L94 88 L150 88 Q172 88 172 112 L172 350 Q172 370 152 370 L48 370 Q28 370 28 350 L28 112 Q28 92 46 88 Z',
      inner: 'M55 76 L85 76 L89 94 L148 94 Q165 94 165 114 L165 348 Q165 363 150 363 L50 363 Q35 363 35 348 L35 114 Q35 98 50 94 Z',
      full: 112, empty: 363, left: 35, right: 165,
      back: '<path class="b-handle-edge" d="M112 90 L112 58 Q112 44 126 44 L150 44 Q164 44 164 58 L164 98"/><path class="b-handle" d="M112 90 L112 58 Q112 44 126 44 L150 44 Q164 44 164 58 L164 98"/>',
      front: '<rect class="b-color" x="46" y="50" width="48" height="24" rx="6"/><rect class="b-shade" x="46" y="66" width="48" height="8" rx="3"/>' +
             '<path class="b-rib" d="M28 160 L172 160 M28 270 L172 270"/><path class="b-shine" d="M44 124 L44 336"/>'
    },
    disposable: {
      outer: 'M86 40 L114 40 L114 58 Q140 72 140 104 L140 356 Q140 370 126 370 L74 370 Q60 370 60 356 L60 104 Q60 72 86 58 Z',
      inner: 'M91 46 L109 46 L109 62 Q134 76 134 106 L134 354 Q134 363 125 363 L75 363 Q66 363 66 354 L66 106 Q66 76 91 62 Z',
      full: 100, empty: 363, left: 66, right: 134,
      back: '',
      front: '<rect class="b-color" x="82" y="18" width="36" height="24" rx="5"/><rect class="b-label" x="60" y="190" width="80" height="62"/>' +
             '<path class="b-rib" d="M60 140 L140 140 M60 152 L140 152 M60 300 L140 300"/><path class="b-shine" d="M72 112 L72 180 M72 262 L72 340"/>'
    },
    glass: {
      outer: 'M44 120 L156 120 L144 362 Q143 370 135 370 L65 370 Q57 370 56 362 Z',
      inner: 'M50 124 L150 124 L139 358 Q138 364 132 364 L68 364 Q62 364 61 358 Z',
      full: 140, empty: 364, left: 50, right: 150,
      back: '',
      front: '<ellipse class="b-color" cx="100" cy="373" rx="64" ry="6"/><path class="b-shine" d="M62 140 L70 340"/>'
    }
  };

  function niceStep(capacity, units) {
    var steps = units === 'ml' ? [50, 100, 200, 250, 500, 1000] : [2, 4, 5, 8, 10, 16, 20, 32];
    for (var i = 0; i < steps.length; i++) {
      var n = capacity / steps[i];
      if (n <= 6) return steps[i];
    }
    return steps[steps.length - 1];
  }

  function bottle(shapeName, color) {
    var s = SHAPES[shapeName] || SHAPES.sport;
    var id = 'bt' + (++uid);
    var svg = el(
      '<svg class="bottle" viewBox="0 0 250 380" data-shape="' + shapeName + '">' +
        '<defs><clipPath id="' + id + 'c"><path d="' + s.inner + '"/></clipPath></defs>' +
        s.back +
        '<path class="b-glass" d="' + s.outer + '"/>' +
        '<g clip-path="url(#' + id + 'c)">' +
          '<g class="b-level" style="transform: translateY(' + s.full + 'px)">' +
            '<g class="b-wave"><path class="b-water" d="' + wave(-40, 300, 4, 44, 400) + '"/></g>' +
          '</g>' +
          '<rect class="b-ghost" x="0" y="0" width="250" height="0"/>' +
        '</g>' +
        '<path class="b-edge" d="' + s.outer + '"/>' +
        s.front +
        '<g class="b-ticks"></g>' +
        '<g class="b-handle-g" tabindex="0" role="slider" aria-label="Water left in your bottle">' +
          '<line class="b-line" x1="' + (s.left - 6) + '" x2="' + (s.right + 6) + '" y1="0" y2="0"/>' +
          '<rect class="b-knob" x="72" y="-13" width="56" height="26" rx="13"/>' +
          '<path class="b-grip" d="M90 -4 L110 -4 M90 0 L110 0 M90 4 L110 4"/>' +
        '</g>' +
      '</svg>'
    );
    svg.style.setProperty('--bottle-color', color || '#2E86B8');

    var level = svg.querySelector('.b-level');
    var handle = svg.querySelector('.b-handle-g');
    var ghost = svg.querySelector('.b-ghost');
    var ticks = svg.querySelector('.b-ticks');

    function yFor(frac) { return s.empty - Math.max(0, Math.min(1, frac)) * (s.empty - s.full); }
    function fracFor(y) { return (s.empty - y) / (s.empty - s.full); }
    var lineY = s.full;

    // Screen-space Y of the water line, used to decide whether a touch grabs the line or scrolls the page.
    function lineClientY() {
      var r = svg.getBoundingClientRect();
      return r.top + (lineY / 380) * r.height;
    }

    // frac = current water; ghostFrac (optional) = level before this drag, shown as a faint band.
    function setLevel(frac, ghostFrac) {
      var y = yFor(frac);
      lineY = y;
      level.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
      handle.setAttribute('transform', 'translate(0 ' + y.toFixed(1) + ')');
      if (ghostFrac != null && ghostFrac > frac) {
        var gy = yFor(ghostFrac);
        ghost.setAttribute('y', gy.toFixed(1));
        ghost.setAttribute('height', Math.max(0, y - gy).toFixed(1));
      } else {
        ghost.setAttribute('height', '0');
      }
    }

    function setTicks(capacityMl, units) {
      var C = root.HydCore;
      var cap = units === 'ml' ? capacityMl : C.mlToOz(capacityMl);
      var step = niceStep(cap, units);
      var out = '';
      for (var v = step; v <= cap + 0.01; v += step) {
        var y = yFor(v / cap);
        var label = units === 'ml' && v >= 1000 ? (v / 1000) + 'L' : String(Math.round(v));
        out += '<line class="b-tick" x1="178" x2="188" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>' +
               '<text class="b-ticktext" x="194" y="' + (y + 4).toFixed(1) + '">' + label + '</text>';
      }
      ticks.innerHTML = out;
    }

    // Converts a pointer's clientY to a 0..1 fill fraction.
    function fracFromClient(clientX, clientY) {
      var pt = svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      var m = svg.getScreenCTM();
      if (!m) return null;
      var p = pt.matrixTransform(m.inverse());
      return fracFor(p.y);
    }

    return { el: svg, handle: handle, setLevel: setLevel, setTicks: setTicks, fracFromClient: fracFromClient, lineClientY: lineClientY, full: s.full, empty: s.empty };
  }

  // Small static bottle icon for pickers.
  function bottleIcon(shapeName, color) {
    var s = SHAPES[shapeName] || SHAPES.sport;
    var id = 'bi' + (++uid);
    return '<svg class="bottle-icon" viewBox="20 0 170 380" aria-hidden="true" style="--bottle-color:' + color + '">' +
      '<defs><clipPath id="' + id + '"><path d="' + s.inner + '"/></clipPath></defs>' + s.back +
      '<path class="b-glass" d="' + s.outer + '"/>' +
      '<g clip-path="url(#' + id + ')"><rect class="b-water" x="0" y="' + (s.full + (s.empty - s.full) * 0.35) + '" width="250" height="400"/></g>' +
      '<path class="b-edge" d="' + s.outer + '"/>' + s.front + '</svg>';
  }

  root.HydArt = { drip: drip, bottle: bottle, bottleIcon: bottleIcon, SHAPES: SHAPES };
})(window);
