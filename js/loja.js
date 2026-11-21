/** Vitrine pública da loja: carrossel de banners, categorias, produtos e janela de detalhes (fotos, vídeo, texto, comprar). */
(function () {
  'use strict';
  var h = window.BolaoUI.h;
  var U = window.BolaoUtil;
  var API = window.BolaoApi;
  var Img = window.BolaoImagens;
  var Car = window.BolaoCarrossel;
  var CFG = window.BOLAO_CONFIG || {};
  var raiz = document.getElementById('app');
  var estado = { produtos: [], pub: null, cat: '' };

  function linkSeguro(l) { return typeof l === 'string' && /^https:\/\//i.test(l); }

  /** Nome da loja de pagamento, só para avisar o cliente de onde ele vai pagar. */
  function lojaDe(link) {
    var host = '';
    try { host = new URL(link).hostname.toLowerCase(); } catch (e) { return ''; }
    if (/mercadopago|mpago\.la|mercadolivre|mercadolibre/.test(host)) return 'Mercado Pago';
    if (/pagseguro|pagbank|pag\.ae/.test(host)) return 'PagSeguro';
    if (/shopee|shp\.ee/.test(host)) return 'Shopee';
    return '';
  }

  function textoPagamento(link) {
    var l = lojaDe(link);
    return l ? 'Pagamento seguro no ' + l : 'Você será levado ao site de pagamento';
  }

  function desconto(p) {
    if (!(p.precoOriginalCentavos > p.precoCentavos)) return 0;
    return Math.round((1 - p.precoCentavos / p.precoOriginalCentavos) * 100);
  }

  // ---------- cabeçalho ----------
  function cabecalho() {
    var alvo = document.getElementById('cab-loja');
    if (!alvo) return;
    alvo.replaceChildren(
      h('header', { class: 'topo' }, h('strong', {}, CFG.NOME || 'Loja'), h('a', { class: 'link-topo', href: '#produtos' }, 'Produtos')),
      window.BolaoSlotsExtra ? window.BolaoSlotsExtra.criar('cabecalho') : null);
  }

  function topoSite() {
    var alvo = document.getElementById('topo-site');
    if (!alvo) return;
    alvo.replaceChildren();
    var el = estado.pub ? Car.topo(estado.pub.topo) : null;
    if (el) alvo.appendChild(el);
    if (window.BolaoSlots) window.BolaoSlots.aplicar(estado.pub);
    if (window.BolaoSlotsExtra) window.BolaoSlotsExtra.aplicar(estado.pub);
  }

  // ---------- produtos ----------
  /** A foto é uma imagem enviada (id) ou um link https (por exemplo, do AliExpress). */
  function foto(id, alt) {
    if (!id) return h('div', { class: 'prod-sem-foto' }, 'Sem foto');
    if (linkSeguro(id)) {
      var el = h('img', { class: 'prod-img', alt: alt || '', src: id, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
      el.addEventListener('load', function () { el.classList.add('carregada'); });
      el.addEventListener('error', function () { el.replaceWith(h('div', { class: 'prod-sem-foto' }, 'Foto indisponível')); });
      return el;
    }
    return Img.elemento(id, alt, 'prod-img');
  }

  function botaoComprar(p, classeExtra) {
    if (!linkSeguro(p.linkCompra)) return h('span', { class: 'btn-comprar inativo', 'aria-disabled': 'true' }, 'Indisponível no momento');
    return h('a', { class: 'btn-comprar' + (classeExtra ? ' ' + classeExtra : ''), href: p.linkCompra, target: '_blank', rel: 'noopener noreferrer sponsored' }, 'Comprar agora');
  }

  function blocoPreco(p) {
    return h('div', {},
      p.precoOriginalCentavos > p.precoCentavos ? h('div', { class: 'preco-de' }, 'De ' + U.centavosParaReais(p.precoOriginalCentavos)) : null,
      h('div', { class: 'preco' }, U.centavosParaReais(p.precoCentavos)));
  }

  function cartao(p) {
    var d = desconto(p);
    var abrir = function () { abrirDetalhes(p); };
    return h('article', { class: 'prod' },
      p.destaque ? h('span', { class: 'selo-oferta' }, 'OFERTA') : null,
      d > 0 ? h('span', { class: 'selo-desc' }, '-' + d + '%') : null,
      h('button', { class: 'prod-foto', type: 'button', 'aria-label': 'Ver detalhes de ' + p.nome, onclick: abrir }, foto(p.fotos[0], p.nome)),
      h('div', { class: 'prod-corpo' },
        p.categoria ? h('span', { class: 'prod-cat' }, p.categoria) : null,
        h('button', { class: 'prod-nome', type: 'button', onclick: abrir }, p.nome),
        blocoPreco(p),
        h('div', { class: 'prod-acoes' },
          botaoComprar(p),
          linkSeguro(p.linkCompra) ? h('span', { class: 'pagto-info' }, textoPagamento(p.linkCompra)) : null,
          h('button', { class: 'btn-detalhes', type: 'button', onclick: abrir }, 'Ver detalhes'))));
  }

  /** Vídeo do YouTube (incorporado) ou arquivo de vídeo por link (.mp4). */
  function video(p) {
    if (/^[A-Za-z0-9_-]{11}$/.test(p.videoId || '')) {
      return h('div', { class: 'modal-video' }, h('div', { class: 'video-caixa' }, h('iframe', {
        src: 'https://www.youtube-nocookie.com/embed/' + p.videoId, title: 'Vídeo de ' + p.nome, loading: 'lazy',
        allow: 'accelerometer; encrypted-media; picture-in-picture', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin'
      })));
    }
    if (linkSeguro(p.videoUrl)) {
      return h('div', { class: 'modal-video' }, h('div', { class: 'video-caixa' },
        h('video', { src: p.videoUrl, controls: true, preload: 'metadata', playsinline: true, referrerpolicy: 'no-referrer' })));
    }
    return null;
  }

  // ---------- janela de detalhes ----------
  var fecharAtual = null;

  function abrirDetalhes(p) {
    if (fecharAtual) fecharAtual();
    var anterior = document.activeElement;
    var idx = 0;
    var principal = h('div', { class: 'galeria-principal' });
    var minis = h('div', { class: 'miniaturas' });

    function pintarGaleria() {
      principal.replaceChildren(foto(p.fotos[idx], p.nome));
      minis.replaceChildren.apply(minis, p.fotos.length > 1 ? p.fotos.map(function (id, i) {
        return h('button', { type: 'button', class: i === idx ? 'ativa' : '', 'aria-label': 'Foto ' + (i + 1) + ' de ' + p.fotos.length, onclick: function () { idx = i; pintarGaleria(); } }, foto(id, p.nome + ' foto ' + (i + 1)));
      }) : []);
    }
    pintarGaleria();

    var botaoFechar = h('button', { class: 'modal-fechar', type: 'button', onclick: fechar }, 'Fechar');
    var d = desconto(p);
    var modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': p.nome },
      botaoFechar,
      h('div', {}, principal, minis),
      h('div', { class: 'modal-info' },
        p.categoria ? h('span', { class: 'prod-cat' }, p.categoria) : null,
        h('h2', {}, p.nome),
        blocoPreco(p),
        d > 0 ? h('span', { class: 'selo-desc', style: 'position:static;align-self:flex-start' }, 'Economize ' + d + '%') : null,
        p.descricao ? h('p', { class: 'descricao' }, p.descricao) : null,
        botaoComprar(p),
        linkSeguro(p.linkCompra) ? h('span', { class: 'pagto-info' }, textoPagamento(p.linkCompra)) : null),
      video(p),
      p.codigo ? h('div', { class: 'modal-video' }, h('iframe', {
        class: 'quadro-produto', title: 'Informações de ' + p.nome, sandbox: 'allow-scripts allow-popups allow-popups-to-escape-sandbox',
        referrerpolicy: 'no-referrer', loading: 'lazy', srcdoc: '<!doctype html><meta charset="utf-8"><base target="_blank"><body style="margin:0;font-family:sans-serif">' + p.codigo + '</body>'
      })) : null);
    var fundo = h('div', { class: 'modal-fundo', onclick: function (ev) { if (ev.target === fundo) fechar(); } }, modal);

    function tecla(ev) { if (ev.key === 'Escape') fechar(); }
    function fechar() {
      window.removeEventListener('keydown', tecla);
      if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
      document.body.style.overflow = '';
      fecharAtual = null;
      if (anterior && anterior.focus) anterior.focus();
    }
    fecharAtual = fechar;
    window.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(fundo);
    botaoFechar.focus();
  }

  // ---------- página ----------
  function categorias() {
    var vistas = [];
    estado.produtos.forEach(function (p) { if (p.categoria && vistas.indexOf(p.categoria) === -1) vistas.push(p.categoria); });
    return vistas;
  }

  function render() {
    Car.parar();
    var cats = categorias();
    if (estado.cat && cats.indexOf(estado.cat) === -1) estado.cat = '';
    var lista = estado.produtos.filter(function (p) { return !estado.cat || p.categoria === estado.cat; });
    var banners = estado.pub ? estado.pub.banners : [];
    var slotMenu = window.BolaoSlotsExtra ? window.BolaoSlotsExtra.criar('menu') : null;
    var slotMeio = window.BolaoSlotsExtra ? window.BolaoSlotsExtra.criar('meio') : null;

    function chip(rotulo, valor) {
      var ativa = estado.cat === valor;
      return h('button', { type: 'button', class: ativa ? 'ativa' : '', 'aria-pressed': String(ativa), onclick: function () { estado.cat = valor; render(); } }, rotulo);
    }

    raiz.replaceChildren(h('main', { class: 'painel loja' },
      banners.length ? Car.criar({ slides: banners.map(function (bn) { return { el: Car.slideBanner(bn), rotulo: bn.titulo || 'banner' }; }), segundos: estado.pub.carrossel.segundos }) : null,
      cats.length > 1 ? h('nav', { class: 'categorias', 'aria-label': 'Categorias' }, [chip('Todos', '')].concat(cats.map(function (c) { return chip(c, c); }))) : null,
      slotMenu,
      slotMeio,
      h('h2', { class: 'titulo-secao', id: 'produtos' }, estado.cat || 'Produtos'),
      lista.length === 0 ? h('p', { class: 'vazio-loja' }, 'Em breve, novos produtos por aqui.')
        : h('section', { class: 'grade', 'aria-label': 'Produtos' }, lista.map(cartao)),
      h('p', { class: 'aviso-compra' }, 'O pagamento e a entrega são feitos no site de pagamento do vendedor (Mercado Pago, PagSeguro ou Shopee), em ambiente seguro.'),
      h('p', { class: 'rodape-loja' }, h('a', { href: 'admin.html' }, 'Área restrita'))));
    if (window.BolaoSlotsExtra && estado.pub) window.BolaoSlotsExtra.aplicar(estado.pub);
  }

  async function carregar() {
    try {
      var r = await Promise.all([API.chamar('publico.config', {}), API.chamar('publico.produtos', {})]);
      estado.pub = r[0];
      estado.produtos = r[1].produtos;
      cabecalho();
      topoSite();
      render();
    } catch (e) {
      raiz.replaceChildren(h('main', { class: 'central' }, h('h1', {}, 'Não foi possível carregar a loja'), h('p', {}, e.message),
        h('button', { class: 'primario', onclick: carregar }, 'Tentar de novo')));
    }
  }

  if (!CFG.API_URL || /^COLE_AQUI/.test(CFG.API_URL)) {
    raiz.replaceChildren(h('main', { class: 'central' }, h('h1', {}, 'Configuração pendente'), h('p', {}, 'Informe a URL do Apps Script em config.js.')));
  } else {
    carregar();
  }
})();
