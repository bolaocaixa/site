/** Painel de propagandas: relógio de ofertas, banner do topo, carrossel de banners e os espaços de propaganda da loja. */
(function (root) {
  'use strict';

  var PADRAO_RELOGIO = { titulo: 'OFERTAS RELÂMPAGO: TERMINA EM', dataLocal: '2026-12-31T23:59' };

  var ESPACOS = [
    { id: 'cabecalho', titulo: 'Cabeçalho', dica: 'Faixa logo abaixo do nome da loja, no alto da página. Sugestão: imagem larga, como 1200 × 120.',
      compressao: { formato: 'jpeg', larguraMax: 1400, alturaMax: 200 } },
    { id: 'navbar', titulo: 'Faixa abaixo do banner do topo', dica: 'Aparece abaixo do banner do topo. Sugestão: imagem larga, como 1200 × 200.',
      compressao: { formato: 'jpeg', larguraMax: 1400, alturaMax: 300 } },
    { id: 'lateral_esq', titulo: 'Lateral esquerda', dica: 'Coluna à esquerda dos produtos em telas grandes (e acima do conteúdo no celular). Sugestão: vertical, como 160 × 600.',
      compressao: { formato: 'jpeg', larguraMax: 400, alturaMax: 1200 } },
    { id: 'lateral', titulo: 'Lateral direita', dica: 'Coluna à direita dos produtos em telas grandes (e abaixo no celular). Sugestão: vertical, como 160 × 600.',
      compressao: { formato: 'jpeg', larguraMax: 400, alturaMax: 1200 } },
    { id: 'menu', titulo: 'Menu (abaixo das categorias)', dica: 'Logo abaixo do menu de categorias. Sugestão: imagem larga, como 1000 × 150.',
      compressao: { formato: 'jpeg', larguraMax: 1200, alturaMax: 250 } },
    { id: 'meio', titulo: 'Meio da página (acima dos produtos)', dica: 'Entre o carrossel e a lista de produtos. Sugestão: imagem larga, como 1200 × 200.',
      compressao: { formato: 'jpeg', larguraMax: 1400, alturaMax: 300 } },
    { id: 'rodape', titulo: 'Rodapé', dica: 'No fim da página. Sugestão: imagem larga, como 1200 × 200.',
      compressao: { formato: 'jpeg', larguraMax: 1400, alturaMax: 300 } }
  ];

  function telaPropagandas(ctx) {
    var h = ctx.UI.h, campo = ctx.UI.campo, API = ctx.API, Img = ctx.Img;
    var cfg = ctx.estado.cfg;

    function aplicar(nova) { ctx.estado.cfg = nova; }
    function salvar(corpo, msg, botao, aoErro) {
      ctx.executar(async function () {
        aplicar(await API.chamar('admin.config.salvar', corpo));
        ctx.UI.aviso(msg);
        ctx.renderPainel();
      }, botao, aoErro);
    }
    function seletorImagem(rotulo, uso, extra, compressao, aoErro) {
      return campo(rotulo, h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', onchange: function (ev) {
        var arquivo = ev.target.files[0], entrada = ev.target;
        if (!arquivo) return;
        ctx.executar(async function () {
          var url = await Img.comprimir(arquivo, compressao);
          aplicar(await API.chamar('admin.imagem.enviar', Object.assign({ uso: uso, dataUrl: url }, typeof extra === 'function' ? extra() : (extra || {}))));
          ctx.UI.aviso('Imagem enviada.');
          ctx.renderPainel();
        }, null, aoErro);
        entrada.value = '';
      } }));
    }
    function removerUso(uso, rotulo) {
      return h('button', { class: 'perigo', onclick: function (ev) {
        ctx.executar(async function () {
          aplicar(await API.chamar('admin.imagem.remover', { uso: uso }));
          ctx.UI.aviso('Imagem removida.');
          ctx.renderPainel();
        }, ev.target);
      } }, rotulo);
    }

    // ----- relógio de ofertas -----
    var inAtivo = h('input', { type: 'checkbox', name: 'contagemAtiva', disabled: true });
    var inTitulo = h('input', { name: 'contagemTitulo', maxlength: 80, disabled: true });
    var inData = h('input', { name: 'contagemData', type: 'datetime-local', disabled: true });
    var erroRel = h('p', { class: 'erro-form', role: 'alert' });
    var botoesRel = [];
    function preencherRelogio(c) {
      inAtivo.checked = c.ativo !== false;
      inTitulo.value = c.titulo || '';
      inData.value = String(c.data || '').substring(0, 16);
      [inAtivo, inTitulo, inData].concat(botoesRel).forEach(function (e) { e.disabled = false; });
    }
    var btnSalvarRel = h('button', { class: 'primario', disabled: true, onclick: function (ev) {
      erroRel.textContent = '';
      ctx.executar(async function () {
        preencherRelogio(await API.chamar('admin.contagem.salvar', { ativo: inAtivo.checked, titulo: inTitulo.value, dataLocal: inData.value }));
        ctx.UI.aviso('Relógio de ofertas atualizado.');
      }, ev.target, function (m) { erroRel.textContent = m; });
    } }, 'Salvar relógio');
    var btnPadraoRel = h('button', { type: 'button', disabled: true, onclick: function () {
      inTitulo.value = PADRAO_RELOGIO.titulo; inData.value = PADRAO_RELOGIO.dataLocal; inAtivo.checked = true;
    } }, 'Usar o texto padrão');
    botoesRel.push(btnSalvarRel, btnPadraoRel);
    API.chamar('publico.contagem', {}).then(preencherRelogio).catch(function (e) { erroRel.textContent = 'Não foi possível carregar o relógio: ' + e.message; });
    var secRelogio = h('section', { class: 'cartao' },
      h('h3', {}, 'Relógio de ofertas'),
      h('p', { class: 'sub' }, 'Aparece no alto da loja, em preto e dourado, contando até o fim da oferta. Quando chega a zero, mostra "A oferta terminou."'),
      h('label', { class: 'marcar' }, inAtivo, ' Mostrar o relógio na loja'),
      campo('Título do relógio', inTitulo, 'Exemplo: OFERTA RELÂMPAGO: TERMINA EM'),
      campo('Data e hora do fim da oferta (horário de Brasília)', inData),
      erroRel,
      h('div', { class: 'acoes' }, btnSalvarRel, btnPadraoRel));

    // ----- banner do topo -----
    var inLinkTopo = h('input', { name: 'linkTopo', placeholder: 'https://', value: cfg.topo.link });
    var erroTopo = h('p', { class: 'erro-form', role: 'alert' });
    var secTopo = h('section', { class: 'cartao' },
      h('h3', {}, 'Banner do topo'),
      h('p', { class: 'sub' }, 'Aparece no alto da loja, abaixo do relógio. Sugestão: imagem larga, por exemplo 1200 × 300.'),
      cfg.topo.imagemId ? h('div', { class: 'previa' }, Img.elemento(cfg.topo.imagemId, 'Banner do topo', 'topo-img')) : h('p', { class: 'vazio' }, 'Nenhum banner no topo.'),
      seletorImagem('Enviar banner do topo', 'topo', {}, { formato: 'jpeg', larguraMax: 1400, alturaMax: 500 }, function (m) { erroTopo.textContent = m; }),
      campo('Link ao clicar no banner (opcional)', inLinkTopo, 'Precisa começar com https://'),
      erroTopo,
      h('div', { class: 'acoes' },
        h('button', { onclick: function (ev) { erroTopo.textContent = ''; salvar({ topo: { link: inLinkTopo.value } }, 'Link salvo.', ev.target, function (m) { erroTopo.textContent = m; }); } }, 'Salvar link'),
        cfg.topo.imagemId ? removerUso('topo', 'Remover banner do topo') : null));

    // ----- carrossel de banners -----
    var inSeg = h('input', { name: 'segundos', type: 'range', min: 2, max: 30, step: 1, value: cfg.carrossel.segundos });
    var rotSeg = h('strong', {}, cfg.carrossel.segundos + ' s');
    inSeg.addEventListener('input', function () { rotSeg.textContent = inSeg.value + ' s'; });
    var tituloNovo = h('input', { name: 'tituloNovo', maxlength: 80 });
    var linkNovo = h('input', { name: 'linkNovo', placeholder: 'https://' });
    var erroBan = h('p', { class: 'erro-form', role: 'alert' });
    var lista = cfg.banners.length === 0 ? h('p', { class: 'vazio' }, 'Nenhum banner adicionado.')
      : h('ul', { class: 'banners' }, cfg.banners.map(function (b, i) {
        var t = h('input', { value: b.titulo, maxlength: 80, 'aria-label': 'Título do banner ' + (i + 1) });
        var l = h('input', { value: b.link, placeholder: 'https://', 'aria-label': 'Link do banner ' + (i + 1) });
        var a = h('input', { type: 'checkbox', checked: b.ativo, 'aria-label': 'Banner ' + (i + 1) + ' ativo' });
        var erro = h('p', { class: 'erro-form', role: 'alert' });
        function acao(nome, corpo, msg, botao) {
          ctx.executar(async function () {
            aplicar(await API.chamar(nome, Object.assign({ id: b.id }, corpo)));
            if (msg) ctx.UI.aviso(msg);
            ctx.renderPainel();
          }, botao, function (m) { erro.textContent = m; });
        }
        return h('li', { class: 'banner-item' },
          h('div', { class: 'miniatura' }, Img.elemento(b.imagemId, b.titulo || 'Banner ' + (i + 1), 'car-img')),
          h('div', { class: 'banner-campos' }, t, l, h('label', { class: 'marcar' }, a, ' Ativo'), erro,
            h('div', { class: 'acoes' },
              h('button', { 'aria-label': 'Subir banner ' + (i + 1), disabled: i === 0, onclick: function (ev) { acao('admin.banners.mover', { direcao: 'cima' }, '', ev.target); } }, '↑'),
              h('button', { 'aria-label': 'Descer banner ' + (i + 1), disabled: i === cfg.banners.length - 1, onclick: function (ev) { acao('admin.banners.mover', { direcao: 'baixo' }, '', ev.target); } }, '↓'),
              h('button', { onclick: function (ev) { erro.textContent = ''; acao('admin.banners.atualizar', { titulo: t.value, link: l.value, ativo: a.checked }, 'Banner salvo.', ev.target); } }, 'Salvar'),
              h('button', { class: 'perigo', onclick: function (ev) { if (root.confirm('Remover este banner?')) acao('admin.banners.remover', {}, 'Banner removido.', ev.target); } }, 'Remover'))));
      }));
    var secCarrossel = h('section', { class: 'cartao' },
      h('h3', {}, 'Carrossel de banners (até 10)'),
      h('p', { class: 'sub' }, 'Os banners passam um por vez no alto da página de produtos. Sugestão: imagem larga, por exemplo 1200 × 400.'),
      campo('Tempo de cada banner (2 a 30 segundos)', inSeg), h('p', {}, 'Cada banner fica ', rotSeg, ' na tela.'),
      h('div', { class: 'acoes' }, h('button', { class: 'primario', onclick: function (ev) { salvar({ carrossel: { segundos: Number(inSeg.value) } }, 'Carrossel atualizado.', ev.target); } }, 'Salvar velocidade')),
      lista,
      h('h4', {}, 'Adicionar banner'),
      campo('Título (opcional)', tituloNovo), campo('Link (opcional)', linkNovo),
      seletorImagem('Escolher imagem do banner', 'banner', function () { return { titulo: tituloNovo.value, link: linkNovo.value }; }, { formato: 'jpeg', larguraMax: 1280, alturaMax: 600 }, function (m) { erroBan.textContent = m; }),
      erroBan);

    // ----- espaços de propaganda -----
    function cartaoEspaco(e) {
      var s = cfg.slots[e.id];
      var selTipo = h('select', { name: 'tipo-' + e.id },
        h('option', { value: '', selected: s.tipo === '' }, 'Desativado (não mostra nada)'),
        h('option', { value: 'imagem', selected: s.tipo === 'imagem' }, 'Imagem com link'),
        h('option', { value: 'codigo', selected: s.tipo === 'codigo' }, 'Código de anúncio (script ou HTML)'));
      var inLink = h('input', { name: 'link-' + e.id, placeholder: 'https://', value: s.link });
      var inCodigo = h('textarea', { name: 'codigo-' + e.id, rows: 6, maxlength: 6000, spellcheck: 'false', class: 'codigo' }, s.codigo);
      var erro = h('p', { class: 'erro-form', role: 'alert' });
      return h('section', { class: 'cartao' },
        h('h3', {}, e.titulo),
        h('p', { class: 'sub' }, e.dica),
        campo('O que mostrar neste espaço', selTipo),
        h('h4', {}, 'Imagem'),
        s.imagemId ? h('div', { class: 'previa' }, Img.elemento(s.imagemId, e.titulo, 'topo-img')) : h('p', { class: 'vazio' }, 'Nenhuma imagem enviada.'),
        campo('Link ao clicar na imagem (opcional)', inLink, 'Precisa começar com https://. Preencha antes de enviar a imagem, ou use "Salvar este espaço" depois.'),
        seletorImagem('Enviar imagem', 'slot_' + e.id, function () { return { link: inLink.value }; }, e.compressao, function (m) { erro.textContent = m; }),
        s.imagemId ? removerUso('slot_' + e.id, 'Remover imagem') : null,
        h('h4', {}, 'Código de anúncio'),
        campo('Cole aqui o código fornecido pela rede de anúncios (até 6000 caracteres)', inCodigo,
          'O código roda isolado, dentro de um quadro seguro: ele não enxerga a página. Alguns provedores de anúncio não funcionam nesse modo.'),
        erro,
        h('div', { class: 'acoes' }, h('button', { class: 'primario', onclick: function (ev) {
          erro.textContent = '';
          var o = {}; o[e.id] = { tipo: selTipo.value, link: inLink.value, codigo: inCodigo.value };
          salvar({ slots: o }, 'Propaganda salva.', ev.target, function (m) { erro.textContent = m; });
        } }, 'Salvar este espaço')));
    }

    return h('section', {},
      h('h2', {}, 'Propagandas e ofertas'),
      h('p', { class: 'sub' }, 'Tudo o que você salvar aparece na loja na hora.'),
      secRelogio, secTopo, secCarrossel, ESPACOS.map(cartaoEspaco));
  }

  root.BolaoAdmin = Object.assign(root.BolaoAdmin || {}, { telaPropagandas: telaPropagandas });
})(window);
