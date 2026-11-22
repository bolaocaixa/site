/** Gerador de QR Code (modo byte, correção de erro M, versões 1 a 14, até 362 bytes). Sem bibliotecas externas. */
(function (root) {
  'use strict';
  // por versão: [bytes de correção por bloco, blocos do grupo 1, dados por bloco, blocos do grupo 2, dados por bloco]
  var TAB = [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44], [30, 1, 50, 4, 51], [22, 6, 36, 2, 37], [22, 8, 37, 1, 38], [24, 4, 40, 5, 41]];
  var ALINHAR = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66]];

  var EXP = [], LOG = [];
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function geradora(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var nova = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { nova[j] ^= g[j]; nova[j + 1] ^= mul(g[j], EXP[i]); }
      g = nova;
    }
    return g;
  }

  function resto(dados, n) {
    var g = geradora(n), r = new Array(n).fill(0);
    dados.forEach(function (d) {
      var f = d ^ r[0];
      r.shift(); r.push(0);
      for (var i = 0; i < n; i++) r[i] ^= mul(g[i + 1], f);
    });
    return r;
  }

  function bytesUtf8(t) {
    var s = unescape(encodeURIComponent(String(t))), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function capacidadeDados(v) { var t = TAB[v]; return t[1] * t[2] + t[3] * t[4]; }

  function escolherVersao(n) {
    for (var v = 1; v <= 14; v++) {
      var bitsCont = v < 10 ? 8 : 16;
      if (4 + bitsCont + 8 * n <= capacidadeDados(v) * 8) return v;
    }
    throw new Error('Texto grande demais para o QR Code.');
  }

  function montarCodewords(bytes, v) {
    var bits = [];
    function push(valor, qtd) { for (var i = qtd - 1; i >= 0; i--) bits.push((valor >>> i) & 1); }
    push(4, 4); push(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });
    var cap = capacidadeDados(v) * 8;
    for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var dados = [];
    for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; dados.push(b); }
    for (var p = 0; dados.length < cap / 8; p++) dados.push(p % 2 ? 0x11 : 0xEC);
    var tab = TAB[v], blocos = [], pos = 0;
    for (var g = 0; g < tab[1]; g++) { blocos.push(dados.slice(pos, pos + tab[2])); pos += tab[2]; }
    for (var h = 0; h < tab[3]; h++) { blocos.push(dados.slice(pos, pos + tab[4])); pos += tab[4]; }
    var ecc = blocos.map(function (b) { return resto(b, tab[0]); });
    var saida = [], maxD = Math.max(tab[2], tab[4]);
    for (var a = 0; a < maxD; a++) blocos.forEach(function (b) { if (a < b.length) saida.push(b[a]); });
    for (var e = 0; e < tab[0]; e++) ecc.forEach(function (b) { saida.push(b[e]); });
    return saida;
  }

  function criarMatriz(v, codewords) {
    var n = 17 + 4 * v, mod = [], fun = [];
    for (var y = 0; y < n; y++) { mod.push(new Array(n).fill(false)); fun.push(new Array(n).fill(false)); }
    function set(x, y, cor) { mod[y][x] = cor; fun[y][x] = true; }
    for (var i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    function localizador(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        var d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    }
    localizador(3, 3); localizador(n - 4, 3); localizador(3, n - 4);
    var al = ALINHAR[v];
    al.forEach(function (cy, iy) { al.forEach(function (cx, ix) {
      if ((iy === 0 && ix === 0) || (iy === 0 && ix === al.length - 1) || (iy === al.length - 1 && ix === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    function formato(mascara) {
      var dados = mascara, r = dados; // nível M = 00
      for (var k = 0; k < 10; k++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var bits = ((dados << 10) | r) ^ 0x5412;
      var bit = function (j) { return ((bits >>> j) & 1) === 1; };
      for (var a = 0; a <= 5; a++) set(8, a, bit(a));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (var b = 9; b < 15; b++) set(14 - b, 8, bit(b));
      for (var c = 0; c < 8; c++) set(n - 1 - c, 8, bit(c));
      for (var d = 8; d < 15; d++) set(8, n - 15 + d, bit(d));
      set(8, n - 8, true);
    }
    formato(0);
    if (v >= 7) {
      var r = v;
      for (var k = 0; k < 12; k++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      var vb = (v << 12) | r;
      for (var q = 0; q < 18; q++) { var cor = ((vb >>> q) & 1) === 1, a2 = n - 11 + (q % 3), b2 = Math.floor(q / 3); set(a2, b2, cor); set(b2, a2, cor); }
    }
    var idx = 0;
    for (var dir = n - 1; dir >= 1; dir -= 2) {
      if (dir === 6) dir = 5;
      for (var vert = 0; vert < n; vert++) for (var j = 0; j < 2; j++) {
        var x = dir - j, sobe = ((dir + 1) & 2) === 0, yy = sobe ? n - 1 - vert : vert;
        if (!fun[yy][x] && idx < codewords.length * 8) { mod[yy][x] = ((codewords[idx >>> 3] >>> (7 - (idx & 7))) & 1) === 1; idx++; }
      }
    }
    return { n: n, mod: mod, fun: fun, formato: formato };
  }

  function mascara(m, x, y) {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
  }

  function aplicar(q, m) {
    for (var y = 0; y < q.n; y++) for (var x = 0; x < q.n; x++) if (!q.fun[y][x] && mascara(m, x, y)) q.mod[y][x] = !q.mod[y][x];
  }

  function penalidade(q) {
    var n = q.n, mod = q.mod, p = 0, x, y, i;
    function linha(get) {
      var run = 1, hist = [];
      for (i = 1; i <= n; i++) {
        if (i < n && get(i) === get(i - 1)) run++;
        else { hist.push(run); if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      // padrões 1:1:3:1:1 com 4 módulos claros de um lado
      for (i = 0; i + 6 < n; i++) {
        var s = '';
        for (var k = 0; k < 7; k++) s += get(i + k) ? '1' : '0';
        if (s === '1011101') {
          var antes = i >= 4 && [0, 1, 2, 3].every(function (k2) { return !get(i - 1 - k2); });
          var depois = i + 10 < n && [0, 1, 2, 3].every(function (k2) { return !get(i + 7 + k2); });
          if (antes || depois) p += 40;
        }
      }
    }
    for (y = 0; y < n; y++) linha(function (j) { return mod[y][j]; });
    for (x = 0; x < n; x++) linha(function (j) { return mod[j][x]; });
    for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) { var c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
    var escuros = 0; for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (mod[y][x]) escuros++;
    p += Math.floor(Math.abs(escuros * 20 - n * n * 10) / (n * n)) * 10;
    return p;
  }

  /** Retorna { tamanho, modulos } (modulos[y][x] é true para módulo escuro). */
  function matriz(texto) {
    var bytes = bytesUtf8(texto), v = escolherVersao(bytes.length);
    var cw = montarCodewords(bytes, v), melhor = null, melhorP = Infinity;
    for (var m = 0; m < 8; m++) {
      var q = criarMatriz(v, cw);
      aplicar(q, m);
      q.formato(m);
      var p = penalidade(q);
      if (p < melhorP) { melhorP = p; melhor = q; }
    }
    return { tamanho: melhor.n, modulos: melhor.mod, versao: v };
  }

  /** Desenha o QR Code como SVG (preto sobre branco, com a margem de 4 módulos exigida pelo padrão). */
  function svg(texto, px) {
    var m = matriz(texto), margem = 4, total = m.tamanho + 2 * margem, d = '';
    for (var y = 0; y < m.tamanho; y++) for (var x = 0; x < m.tamanho; x++) if (m.modulos[y][x]) d += 'M' + (x + margem) + ' ' + (y + margem) + 'h1v1h-1z';
    var NS = 'http://www.w3.org/2000/svg';
    var el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 ' + total + ' ' + total);
    el.setAttribute('width', String(px || 240)); el.setAttribute('height', String(px || 240));
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'QR Code do Pix'); el.setAttribute('shape-rendering', 'crispEdges');
    var fundo = document.createElementNS(NS, 'rect');
    fundo.setAttribute('width', String(total)); fundo.setAttribute('height', String(total)); fundo.setAttribute('fill', '#fff');
    var caminho = document.createElementNS(NS, 'path');
    caminho.setAttribute('d', d); caminho.setAttribute('fill', '#000');
    el.appendChild(fundo); el.appendChild(caminho);
    return el;
  }

  var api = { matriz: matriz, svg: svg };
  root.BolaoQR = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
