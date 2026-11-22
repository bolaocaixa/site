/** Painel do administrador: cadastro dos produtos (nome, preço, texto, fotos por envio ou link, vídeo, link de compra). */
(function (root) {
  'use strict';

  var CATEGORIAS_SUGERIDAS = ['Carregadores', 'Cabos'];
  var ROTULO_TIPO = { link: 'Link de pagamento', mercadolivre: 'Mercado Livre', aliexpress: 'AliExpress (afiliado)', direto: 'Venda direta (Pix)' };

  function linkSeguro(l) { return typeof l === 'string' && /^https:\/\//i.test(l); }

  function telaProdutos(ctx) {
    var h = ctx.UI.h, campo = ctx.UI.campo, API = ctx.API, U = ctx.U, Img = ctx.Img;
    var estado = ctx.estado;

    function aplicar(r) { estado.produtos = r.produtos; }

    /** Miniatura: foto enviada (id) ou link. */
    function miniatura(id, alt) {
      if (!id) return h('div', { class: 'thumb-prod' });
      if (linkSeguro(id)) {
        var el = h('img', { class: 'prod-img carregada', alt: alt || '', src: id, loading: 'lazy', referrerpolicy: 'no-referrer' });
        el.addEventListener('error', function () { el.alt = 'Foto indisponível'; el.style.opacity = '.3'; });
        return h('div', { class: 'thumb-prod' }, el);
      }
      return h('div', { class: 'thumb-prod' }, Img.elemento(id, alt, 'prod-img'));
    }

    // ---------------------------------------------------------------- lista
    function lista() {
      var itens = estado.produtos;
      return h('section', {},
        h('div', { class: 'linha-titulo' }, h('h2', {}, 'Produtos (' + itens.length + ')'),
          h('button', { class: 'primario', onclick: function () { estado.edicaoProduto = { produto: null }; ctx.renderPainel(); } }, 'Novo produto')),
        h('p', { class: 'sub' }, 'Tudo o que estiver como "Visível" aparece na página pública da loja, na ordem desta lista.'),
        itens.length === 0 ? h('p', { class: 'vazio' }, 'Nenhum produto cadastrado ainda. Clique em "Novo produto".')
          : itens.map(function (p, i) {
            return h('article', { class: 'cartao' },
              h('div', { class: 'linha-prod' },
                miniatura(p.fotos[0], p.nome),
                h('div', { class: 'info-prod' },
                  h('h3', {}, p.nome),
                  h('p', { class: 'sub' }, (ROTULO_TIPO[p.tipo] || 'Link de pagamento') + ' · ' + U.centavosParaReais(p.precoCentavos) + (p.categoria ? ' · ' + p.categoria : '') + ' · ' + p.fotos.length + ' foto(s)' + (p.videoId || p.videoUrl ? ' · vídeo' : '')),
                  h('span', { class: 'selo ' + (p.ativo ? 'aberto' : 'rascunho') }, p.ativo ? 'Visível' : 'Oculto'),
                  p.destaque ? h('span', { class: 'selo rascunho', style: 'margin-left:.4rem' }, 'OFERTA') : null)),
              h('div', { class: 'acoes' },
                h('button', { 'aria-label': 'Subir ' + p.nome, disabled: i === 0, onclick: function (ev) { mover(p, 'cima', ev.target); } }, '↑'),
                h('button', { 'aria-label': 'Descer ' + p.nome, disabled: i === itens.length - 1, onclick: function (ev) { mover(p, 'baixo', ev.target); } }, '↓'),
                h('button', { onclick: function () { estado.edicaoProduto = { produto: p }; ctx.renderPainel(); window.scrollTo(0, 0); } }, 'Editar'),
                h('button', { class: 'perigo', onclick: function (ev) { excluir(p, ev.target); } }, 'Excluir')));
          }));
    }

    function mover(p, direcao, botao) {
      ctx.executar(async function () {
        aplicar(await API.chamar('admin.produtos.mover', { id: p.id, direcao: direcao }));
        ctx.renderPainel();
      }, botao);
    }

    function excluir(p, botao) {
      if (!root.confirm('Excluir "' + p.nome + '"? As fotos enviadas também serão apagadas. Não dá para desfazer.')) return;
      ctx.executar(async function () {
        aplicar(await API.chamar('admin.produtos.excluir', { id: p.id }));
        ctx.UI.aviso('Produto excluído.');
        ctx.renderPainel();
      }, botao);
    }

    // ----------------------------------------------------------- formulário
    function formulario() {
      var p = estado.edicaoProduto.produto;
      var erro = h('p', { class: 'erro-form', role: 'alert' });
      var dl = h('datalist', { id: 'lista-categorias' }, CATEGORIAS_SUGERIDAS.concat(estado.produtos.map(function (x) { return x.categoria; }).filter(Boolean))
        .filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (c) { return h('option', { value: c }); }));

      var inNome = h('input', { name: 'nome', maxlength: 100, required: true, value: p ? p.nome : '' });
      var inPreco = h('input', { name: 'preco', inputmode: 'decimal', required: true, placeholder: '129,90', value: p ? U.centavosParaDecimalBR(p.precoCentavos) : '' });
      var inOrig = h('input', { name: 'precoOriginal', inputmode: 'decimal', placeholder: '199,90', value: p && p.precoOriginalCentavos ? U.centavosParaDecimalBR(p.precoOriginalCentavos) : '' });
      var inCat = h('input', { name: 'categoria', maxlength: 40, list: 'lista-categorias', placeholder: 'Carregadores', value: p ? p.categoria : '' });
      var inDesc = h('textarea', { name: 'descricao', maxlength: 3000, rows: 8, placeholder: 'Escreva aqui o texto do produto: potência, compatibilidade, o que acompanha, garantia...' }, p ? p.descricao : '');
      var inLink = h('input', { name: 'linkCompra', placeholder: 'https://', value: p ? p.linkCompra : '' });
      var tipoAtual = p && p.tipo ? p.tipo : 'link';
      var inTipo = h('select', { name: 'tipo', onchange: function () { tipoAtual = inTipo.value; atualizarTipo(); } },
        Object.keys(ROTULO_TIPO).map(function (k) { return h('option', { value: k, selected: k === tipoAtual ? true : null }, ROTULO_TIPO[k]); }));
      var fotosImportadas = [];
      var areaImport = h('div', { class: 'import-area' });
      var botaoImportar = h('button', { type: 'button', onclick: function (ev) {
        erro.textContent = '';
        ctx.executar(async function () {
          var r = await API.chamar('admin.produtos.importar', { url: inLink.value });
          if (r.nome) inNome.value = r.nome;
          if (r.precoCentavos > 0) inPreco.value = U.centavosParaDecimalBR(r.precoCentavos);
          if (r.descricao) inDesc.value = r.descricao;
          fotosImportadas = r.fotos || [];
          areaImport.replaceChildren(
            h('div', { class: 'aviso-ok', role: 'status' }, 'Informações importadas de ' + r.origem + '. Confira os campos abaixo antes de salvar.'),
            r.avisos && r.avisos.length ? h('ul', { class: 'avisos-import' }, r.avisos.map(function (a) { return h('li', {}, a); })) : null,
            fotosImportadas.length ? h('div', { class: 'fotos-admin' }, fotosImportadas.map(function (u, i) { return h('div', { class: 'foto-admin' }, miniatura(u, 'Foto importada ' + (i + 1))); })) : null,
            fotosImportadas.length ? h('p', { class: 'sub' }, fotosImportadas.length + ' foto(s) serão adicionadas ao salvar. As fotos continuam hospedadas no site de origem; se elas sumirem da loja, baixe-as e envie do computador.') : null,
            h('p', { class: 'sub' }, 'O preço importado é o do anúncio. Ajuste o "Preço de venda" se for diferente.'));
        }, ev.target, function (m) { erro.textContent = m; });
      } }, 'Buscar informações do anúncio');
      var blocoLink = campo('Link de compra', inLink, 'Link de pagamento do Mercado Pago ou PagSeguro, ou o link do anúncio na Shopee/AliExpress. Precisa começar com https://. Sem link, o botão aparece como indisponível.');
      var notaDireto = h('p', { class: 'nota' }, 'Venda direta: ao clicar em "Comprar agora", o cliente informa o local e o horário da entrega. Você tem 12 horas para aprovar no painel (aba Pedidos). Depois da aprovação, o QR Code do Pix aparece para ele. Configure a chave Pix na aba Pedidos.');
      var notaImport = h('p', { class: 'sub' });
      function atualizarTipo() {
        var direto = tipoAtual === 'direto', importavel = tipoAtual === 'mercadolivre' || tipoAtual === 'aliexpress';
        blocoLink.style.display = direto ? 'none' : '';
        notaDireto.style.display = direto ? '' : 'none';
        botaoImportar.style.display = importavel ? '' : 'none';
        areaImport.style.display = importavel ? '' : 'none';
        notaImport.textContent = tipoAtual === 'mercadolivre' ? 'Cole o link do anúncio do Mercado Livre (ou o seu link de afiliado meli.la) e clique em "Buscar informações".'
          : (tipoAtual === 'aliexpress' ? 'Cole o link do produto no AliExpress (ou o seu link de afiliado) e clique em "Buscar informações".' : '');
        notaImport.style.display = importavel ? '' : 'none';
        inLink.placeholder = importavel ? 'https://' + (tipoAtual === 'mercadolivre' ? 'produto.mercadolivre.com.br/...' : 'pt.aliexpress.com/item/...') : 'https://';
      }
      var inVideo = h('input', { name: 'video', placeholder: 'https://www.youtube.com/watch?v=... ou https://.../video.mp4', value: p ? (p.videoId ? 'https://www.youtube.com/watch?v=' + p.videoId : p.videoUrl) : '' });
      var inCodigo = h('textarea', { name: 'codigo', rows: 5, maxlength: 6000, spellcheck: 'false', class: 'codigo' }, p ? p.codigo : '');
      var inDestaque = h('input', { type: 'checkbox', name: 'destaque', checked: p ? p.destaque : false });
      var inAtivo = h('input', { type: 'checkbox', name: 'ativo', checked: p ? p.ativo : true });

      function salvar(ev) {
        ev.preventDefault();
        erro.textContent = '';
        var preco = U.reaisParaCentavos(inPreco.value);
        if (Number.isNaN(preco) || preco <= 0) { erro.textContent = 'Preço inválido. Use o formato 129,90.'; return; }
        var orig = 0;
        if (inOrig.value.trim() !== '') {
          orig = U.reaisParaCentavos(inOrig.value);
          if (Number.isNaN(orig) || orig <= 0) { erro.textContent = 'O preço "de" é inválido. Use o formato 199,90 ou deixe vazio.'; return; }
        }
        var corpo = {
          nome: inNome.value, precoCentavos: preco, precoOriginalCentavos: orig, categoria: inCat.value, descricao: inDesc.value,
          tipo: tipoAtual, fotosLinks: fotosImportadas, linkCompra: inLink.value, video: inVideo.value, codigo: inCodigo.value, destaque: inDestaque.checked, ativo: inAtivo.checked
        };
        if (p) corpo.id = p.id;
        ctx.executar(async function () {
          var r = await API.chamar('admin.produtos.salvar', corpo);
          aplicar(r);
          var salvo = r.produtos.filter(function (x) { return x.id === r.id; })[0];
          estado.edicaoProduto = { produto: salvo };
          ctx.UI.aviso(p ? 'Produto salvo.' : 'Produto criado. Confira as fotos abaixo.');
          ctx.renderPainel();
          window.scrollTo(0, 0);
        }, ev.target.querySelector('button[type=submit]'), function (m) { erro.textContent = m; });
      }

      var form = h('form', { class: 'form form-prod', onsubmit: salvar },
        dl,
        campo('Tipo de venda', inTipo, 'Como o cliente compra este produto.'),
        notaDireto, notaImport, blocoLink, botaoImportar, areaImport,
        campo('Nome do produto', inNome),
        campo('Preço de venda (R$)', inPreco),
        campo('Preço "de" (R$), opcional', inOrig, 'Se preencher, aparece riscado com a porcentagem de desconto. Precisa ser maior que o preço de venda.'),
        campo('Categoria', inCat, 'Os clientes filtram a loja por categoria. Escolha uma da lista ou digite uma nova.'),
        campo('Texto do produto (escrito por você)', inDesc, 'As quebras de linha são mantidas. Até 3000 caracteres.'),
        campo('Vídeo (opcional)', inVideo, 'Link do YouTube, ou o link direto de um arquivo de vídeo .mp4 (por exemplo, o vídeo do anúncio no AliExpress). Deixe vazio para não mostrar vídeo.'),
        campo('Código de incorporação (opcional)', inCodigo, 'Para colar um script ou HTML de parceiro (por exemplo, um widget do AliExpress). Aparece na janela de detalhes, dentro de um quadro isolado e seguro. Até 6000 caracteres.'),
        h('label', { class: 'marcar' }, inDestaque, ' Mostrar o selo OFERTA no produto'),
        h('label', { class: 'marcar' }, inAtivo, ' Visível na loja'),
        erro,
        h('div', { class: 'acoes' },
          h('button', { class: 'primario', type: 'submit' }, p ? 'Salvar alterações' : 'Criar produto'),
          h('button', { type: 'button', onclick: function () { estado.edicaoProduto = null; ctx.renderPainel(); } }, 'Voltar à lista')));

      atualizarTipo();
      return h('section', {},
        h('h2', {}, p ? 'Editar produto' : 'Novo produto'),
        h('div', { class: 'cartao' }, form),
        p ? secaoFotos(p) : h('p', { class: 'nota' }, 'Depois de criar o produto, você poderá adicionar as fotos.'));
    }

    // ---------------------------------------------------------------- fotos
    function secaoFotos(p) {
      var erro = h('p', { class: 'erro-form', role: 'alert' });
      var cheio = p.fotos.length >= 6;
      var inUrl = h('input', { name: 'fotoLink', placeholder: 'https://...jpg', disabled: cheio });

      function recarregar(r, msg) {
        aplicar(r);
        estado.edicaoProduto = { produto: r.produtos.filter(function (x) { return x.id === p.id; })[0] || p };
        if (msg) ctx.UI.aviso(msg);
        ctx.renderPainel();
      }

      return h('section', { class: 'cartao' },
        h('h3', {}, 'Fotos (' + p.fotos.length + ' de 6)'),
        h('p', { class: 'sub' }, 'A primeira foto é a capa na loja. Adicione por link (por exemplo, a imagem do anúncio no AliExpress) ou envie do seu computador.'),
        p.fotos.length === 0 ? h('p', { class: 'vazio' }, 'Nenhuma foto ainda.')
          : h('div', { class: 'fotos-admin' }, p.fotos.map(function (id, i) {
            return h('div', { class: 'foto-admin' }, miniatura(id, p.nome + ' foto ' + (i + 1)),
              h('span', { class: 'sub' }, (i === 0 ? 'Capa · ' : '') + (linkSeguro(id) ? 'link' : 'enviada')),
              h('button', { class: 'perigo', onclick: function (ev) {
                ctx.executar(async function () {
                  recarregar(await API.chamar('admin.produtos.fotoRemover', { produtoId: p.id, imagemId: id }), 'Foto removida.');
                }, ev.target);
              } }, 'Remover'));
          })),
        campo('Adicionar foto por link', inUrl, 'Cole o endereço da imagem (começa com https://). Se a imagem não aparecer na loja, o site de origem pode estar bloqueando: nesse caso, baixe a foto e envie do computador.'),
        h('div', { class: 'acoes' }, h('button', { disabled: cheio, onclick: function (ev) {
          erro.textContent = '';
          ctx.executar(async function () {
            recarregar(await API.chamar('admin.produtos.fotoLink', { produtoId: p.id, url: inUrl.value }), 'Foto adicionada.');
          }, ev.target, function (m) { erro.textContent = m; });
        } }, 'Adicionar por link')),
        campo('Ou enviar foto do computador', h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', disabled: cheio, onchange: function (ev) {
          var arq = ev.target.files[0], entrada = ev.target;
          if (!arq) return;
          erro.textContent = '';
          ctx.executar(async function () {
            var url = await Img.comprimir(arq, { formato: 'jpeg', larguraMax: 900, alturaMax: 900 });
            recarregar(await API.chamar('admin.produtos.fotoEnviar', { produtoId: p.id, dataUrl: url }), 'Foto enviada.');
          }, null, function (m) { erro.textContent = m; });
          entrada.value = '';
        } })),
        erro);
    }

    if (estado.produtos === null) {
      var caixa = h('p', { class: 'carregando' }, 'Carregando…');
      API.chamar('admin.produtos.listar', {}).then(function (r) { aplicar(r); ctx.renderPainel(); })
        .catch(function (e) { caixa.textContent = 'Não foi possível carregar os produtos: ' + e.message; });
      return h('section', {}, h('h2', {}, 'Produtos'), caixa);
    }
    return estado.edicaoProduto ? formulario() : lista();
  }

  root.BolaoAdmin = Object.assign(root.BolaoAdmin || {}, { telaProdutos: telaProdutos });
})(window);
