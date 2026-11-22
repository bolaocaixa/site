/** Painel do administrador: configuração do Pix e pedidos da venda direta (aprovar em até 12 horas, marcar como pago). */
(function (root) {
  'use strict';

  function telaPedidos(ctx) {
    var h = ctx.UI.h, campo = ctx.UI.campo, API = ctx.API, U = ctx.U;
    var dados = { pedidos: [], aguardando: 0, agora: Date.now() };
    var desvio = 0, filtro = 'aguardando', carregado = false, ticker = null, poll = null;
    var listaEl = h('div', { class: 'lista-pedidos' }, h('p', { class: 'carregando' }, 'Carregando pedidos…'));
    var filtrosEl = h('div', { class: 'abas', role: 'tablist' });
    var secao = h('section', {});

    function hhmmss(ms) {
      var s = Math.max(0, Math.floor(ms / 1000)), p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(Math.floor(s / 3600)) + ':' + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60);
    }

    function atualizarBadge() {
      var b = document.querySelector('[data-aba=pedidos]');
      if (b) b.textContent = 'Pedidos' + (dados.aguardando ? ' (' + dados.aguardando + ')' : '');
    }

    function aplicar(r) {
      dados = r; desvio = r.agora - Date.now(); carregado = true;
      ctx.estado.pedidosAguardando = r.aguardando;
      atualizarBadge();
      desenhar();
    }

    function carregar() {
      return API.chamar('admin.pedidos.listar', {}).then(aplicar).catch(function (e) {
        if (!carregado) listaEl.replaceChildren(h('p', { class: 'erro-form' }, 'Não foi possível carregar os pedidos: ' + e.message + ' Confira se a nova versão do Código.gs foi publicada.'));
      });
    }

    var GRUPOS = [['aguardando', 'Aguardando'], ['aprovado', 'Aprovados (esperando pagamento)'], ['historico', 'Histórico']];
    function doGrupo(p) {
      if (filtro === 'historico') return p.status !== 'aguardando' && p.status !== 'aprovado';
      return p.status === filtro;
    }
    var ROTULO_STATUS = { aguardando: 'Aguardando você', aprovado: 'Aprovado', pago: 'Pago', recusado: 'Recusado', expirado: 'Expirado', cancelado: 'Cancelado pelo cliente' };

    function telWhats(tel) {
      var d = String(tel).replace(/\D/g, '');
      if (d.length <= 11) d = '55' + d;
      return 'https://wa.me/' + d;
    }

    function cartaoPedido(p) {
      var caixaMsg = h('div', {});
      var erro = h('p', { class: 'erro-form', role: 'alert' });
      function acao(url, extra, ev, ok) {
        erro.textContent = '';
        ctx.executar(async function () { aplicar(await API.chamar(url, Object.assign({ id: p.id }, extra || {}))); if (ok) ctx.UI.aviso(ok); }, ev.target, function (m) { erro.textContent = m; });
      }
      function decidir(decisao) {
        var inMsg = h('textarea', { rows: 2, maxlength: 300, placeholder: decisao === 'aprovar' ? 'Mensagem para o cliente (ex.: confirmado sábado às 15h na praça)' : 'Motivo (opcional)' });
        caixaMsg.replaceChildren(h('div', { class: 'form' }, inMsg, h('div', { class: 'acoes' },
          h('button', { class: decisao === 'aprovar' ? 'primario' : 'perigo', onclick: function (ev) { acao('admin.pedidos.decidir', { decisao: decisao, mensagem: inMsg.value }, ev, decisao === 'aprovar' ? 'Pedido aprovado. O QR Code já aparece para o cliente.' : 'Pedido recusado.'); } }, decisao === 'aprovar' ? 'Confirmar aprovação' : 'Confirmar recusa'),
          h('button', { onclick: function () { caixaMsg.replaceChildren(); } }, 'Voltar'))));
        inMsg.focus();
      }
      var botoes = [];
      if (p.status === 'aguardando') botoes.push(h('button', { class: 'primario', onclick: function () { decidir('aprovar'); } }, 'Aprovar'), h('button', { class: 'perigo', onclick: function () { decidir('recusar'); } }, 'Recusar'));
      if (p.status === 'aprovado') botoes.push(h('button', { class: 'primario', onclick: function (ev) { if (root.confirm('Confirmar que o pagamento de ' + p.nome + ' foi recebido?')) acao('admin.pedidos.pago', {}, ev, 'Marcado como pago.'); } }, 'Marcar como pago'));
      if (p.status !== 'aguardando' && p.status !== 'aprovado') botoes.push(h('button', { class: 'perigo', onclick: function (ev) { if (root.confirm('Excluir este pedido e os dados do comprador?')) acao('admin.pedidos.excluir', {}, ev, 'Pedido excluído.'); } }, 'Excluir'));
      return h('article', { class: 'cartao pedido-adm' },
        h('div', { class: 'cartao-topo' }, h('h3', {}, p.produto + ' · ' + U.centavosParaReais(p.precoCentavos)),
          h('span', { class: 'selo ' + (p.status === 'aguardando' ? 'rascunho' : (p.status === 'recusado' || p.status === 'expirado' || p.status === 'cancelado' ? 'revogado' : 'aberto')) }, ROTULO_STATUS[p.status] || p.status)),
        p.status === 'aguardando' ? h('p', {}, 'Tempo para responder: ', h('strong', { class: 'cron-adm', 'data-expira': String(p.expiraEm) }, hhmmss(p.expiraEm - (Date.now() + desvio)))) : null,
        h('p', {}, h('strong', {}, p.nome), ' · ', h('a', { href: telWhats(p.telefone), target: '_blank', rel: 'noopener noreferrer' }, p.telefone + ' (WhatsApp)')),
        h('p', { class: 'sub' }, 'Entrega: ' + p.local + (p.horario ? ' · ' + p.horario : '')),
        p.obs ? h('p', { class: 'sub' }, 'Obs.: ' + p.obs) : null,
        p.mensagem ? h('p', { class: 'sub' }, 'Sua mensagem: ' + p.mensagem) : null,
        h('p', { class: 'sub' }, 'Pedido em ' + U.formatarData(p.criadoEm) + (p.pagoEm ? ' · pago em ' + U.formatarData(p.pagoEm) : '')),
        botoes.length ? h('div', { class: 'acoes' }, botoes) : null, caixaMsg, erro);
    }

    function desenhar() {
      filtrosEl.replaceChildren.apply(filtrosEl, GRUPOS.map(function (g) {
        var n = dados.pedidos.filter(function (p) { return g[0] === 'historico' ? (p.status !== 'aguardando' && p.status !== 'aprovado') : p.status === g[0]; }).length;
        return h('button', { role: 'tab', 'aria-selected': String(filtro === g[0]), class: filtro === g[0] ? 'ativa' : '', onclick: function () { filtro = g[0]; desenhar(); } }, g[1] + ' (' + n + ')');
      }));
      var itens = dados.pedidos.filter(doGrupo);
      listaEl.replaceChildren.apply(listaEl, itens.length ? itens.map(cartaoPedido) : [h('p', { class: 'vazio' }, 'Nenhum pedido aqui.')]);
    }

    // ---------------------------------------------------------- Pix e avisos
    function blocoPix() {
      var corpo = h('div', {}, h('p', { class: 'carregando' }, 'Carregando…'));
      var erro = h('p', { class: 'erro-form', role: 'alert' });
      function mostrar(c) {
        var inChave = h('input', { name: 'pixChave', value: c.pixChave, autocapitalize: 'none', autocomplete: 'off', placeholder: 'CPF, CNPJ, e-mail, telefone ou chave aleatória' });
        var inNome = h('input', { name: 'pixNome', value: c.pixNome, maxlength: 25, placeholder: 'Nome como aparece no banco (até 25 letras)' });
        var inCidade = h('input', { name: 'pixCidade', value: c.pixCidade, maxlength: 15, placeholder: 'Cidade (até 15 letras)' });
        var inInstr = h('textarea', { name: 'instrucoes', rows: 3, maxlength: 500, placeholder: 'Ex.: Levar o valor exato. Entrego em mãos com o produto lacrado.' }, c.instrucoes);
        var inEmail = h('input', { name: 'avisoEmail', type: 'email', value: c.avisoEmail, placeholder: 'seu-email@gmail.com' });
        corpo.replaceChildren(h('form', { class: 'form', onsubmit: function (ev) {
          ev.preventDefault(); erro.textContent = '';
          ctx.executar(async function () {
            mostrar(await API.chamar('admin.direto.salvar', { pixChave: inChave.value, pixNome: inNome.value, pixCidade: inCidade.value, instrucoes: inInstr.value, avisoEmail: inEmail.value }));
            ctx.UI.aviso('Configuração salva.');
          }, ev.target.querySelector('button[type=submit]'), function (m) { erro.textContent = m; });
        } },
          c.pixChave ? null : h('div', { class: 'aviso-ok', role: 'status' }, 'Preencha o Pix para ativar a venda direta. Sem isso, o botão "Comprar agora" dos produtos de venda direta fica indisponível.'),
          campo('Chave Pix', inChave, 'Sem espaços. É para essa chave que o QR Code do cliente aponta.'),
          campo('Nome do recebedor', inNome), campo('Cidade do recebedor', inCidade),
          campo('Instruções para o cliente (aparecem depois da aprovação)', inInstr),
          campo('E-mail para avisar de novos pedidos (opcional)', inEmail, 'Recebe um e-mail a cada novo pedido. Requer o envio de e-mail autorizado no Apps Script.'),
          erro, h('button', { class: 'primario', type: 'submit' }, 'Salvar')));
      }
      API.chamar('admin.direto.obter', {}).then(mostrar).catch(function (e) { corpo.replaceChildren(h('p', { class: 'erro-form' }, 'Não foi possível carregar: ' + e.message)); });
      return h('details', { class: 'cartao', open: true }, h('summary', {}, 'Pix e avisos da venda direta'), corpo);
    }

    secao.replaceChildren(
      h('h2', {}, 'Pedidos da venda direta'),
      h('p', { class: 'sub' }, 'Cada pedido tem 12 horas para ser respondido. Ao aprovar, o QR Code do Pix aparece para o cliente. Depois de receber, marque como pago.'),
      blocoPix(), filtrosEl, listaEl);

    carregar();
    ticker = setInterval(function () {
      if (!document.body.contains(secao)) { clearInterval(ticker); clearInterval(poll); return; }
      secao.querySelectorAll('.cron-adm').forEach(function (el) { el.textContent = hhmmss(Number(el.getAttribute('data-expira')) - (Date.now() + desvio)); });
    }, 1000);
    poll = setInterval(function () { if (document.body.contains(secao) && !document.hidden) carregar(); }, 30000);
    return secao;
  }

  root.BolaoAdmin = Object.assign(root.BolaoAdmin || {}, { telaPedidos: telaPedidos });
})(window);
