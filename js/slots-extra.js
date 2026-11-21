/** Espaços de propaganda extras: cabeçalho, menu lateral, meio do conteúdo e coluna da esquerda. */
(function (root) {
  'use strict';
  var h = root.BolaoUI.h;
  var pub = null;
  var IDS = ['cabecalho', 'menu', 'meio', 'lateral_esq'];

  function linkSeguro(l) { return typeof l === 'string' && /^https:\/\//i.test(l); }

  function conteudo(id) {
    var s = pub && pub.slots && pub.slots[id];
    if (!s || !s.tipo) return null;
    if (s.tipo === 'imagem' && s.imagemId) {
      var img = root.BolaoImagens.elemento(s.imagemId, 'Publicidade', 'slot-img');
      return linkSeguro(s.link) ? h('a', { href: s.link, target: '_blank', rel: 'noopener noreferrer sponsored' }, img) : img;
    }
    if (s.tipo === 'codigo' && s.codigo) {
      return h('iframe', { class: 'slot-quadro', sandbox: 'allow-scripts allow-popups', referrerpolicy: 'no-referrer', loading: 'lazy', title: 'Publicidade', srcdoc: s.codigo });
    }
    return null;
  }

  function preencher(el) {
    var c = conteudo(el.getAttribute('data-slot'));
    el.replaceChildren();
    if (c) el.appendChild(c);
    el.hidden = !c;
  }

  /** Cria o espaço já preenchido; é atualizado quando a configuração pública chegar. */
  function criar(id) {
    var el = h('div', { class: 'slot-extra slot-' + id, 'data-slot': id });
    preencher(el);
    return el;
  }

  function lateralEsquerda() {
    var aside = document.getElementById('slot-resultados');
    var layout = document.getElementById('layout-site');
    if (!aside) return;
    var antigo = aside.querySelector('.slot-extra');
    if (antigo) antigo.remove();
    var el = criar('lateral_esq');
    if (el.hidden) { if (!aside.children.length) { aside.hidden = true; if (layout) layout.classList.remove('tem-esq'); } return; }
    aside.appendChild(el);
    aside.hidden = false;
    if (layout) layout.classList.add('tem-esq');
  }

  function aplicar(novo) {
    pub = novo;
    var els = document.querySelectorAll('.slot-extra[data-slot]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].getAttribute('data-slot') !== 'lateral_esq') preencher(els[i]);
    }
    lateralEsquerda();
  }

  // os resultados das loterias chegam depois e reescrevem a coluna: recoloca a propaganda
  var aside = document.getElementById('slot-resultados');
  if (aside && root.MutationObserver) {
    var ocupado = false;
    new MutationObserver(function () {
      if (ocupado || !pub) return;
      ocupado = true;
      if (!aside.querySelector('.slot-extra')) lateralEsquerda();
      ocupado = false;
    }).observe(aside, { childList: true });
  }

  root.BolaoSlotsExtra = { criar: criar, aplicar: aplicar, ids: IDS };
})(window);
