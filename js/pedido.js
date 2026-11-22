/** Venda direta: pedido do comprador, cronômetro de 12 horas, resposta do vendedor e QR Code do Pix. */
(function (root) {
  'use strict';
  var UI = root.BolaoUI, U = root.BolaoUtil, API = root.BolaoApi;
  var h = UI.h, campo = UI.campo;
  var CHAVE = 'br_pedidos';
  var fecharAtual = null;

  function guardados() {
    try { var l = JSON.parse(root.localStorage.getItem(CHAVE) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
  }
  function guardar(token, nome) {
    try {
      var l = guardados().filter(function (x) { return x.token !== token; });
      l.unshift({ token: token, produto: nome, em: Date.now() });
      root.localStorage.setItem(CHAVE, JSON.stringify(l.slice(0, 10)));
    } catch (e) { /* sem armazenamento: o link do pedido continua valendo */ }
  }
  function esquecer(token) {
    try { root.localStorage.setItem(CHAVE, JSON.stringify(guardados().filter(function (x) { return x.token !== token; }))); } catch (e) { /* ignora */ }
  }
  function linkDoPedido(token) { return root.location.origin + root.location.pathname + '?pedido=' + token; }

  function hhmmss(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(Math.floor(s / 3600)) + ':' + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60);
  }

  /** Abre a janela (reaproveita o visual da janela de detalhes). Retorna { corpo, fechar }. */
  function janela(titulo) {
    if (fecharAtual) fecharAtual();
    var anterior = document.activeElement;
    var corpo = h('div', { class: 'pedido-corpo' });
    var botaoFechar = h('button', { class: 'modal-fechar', type: 'button', onclick: fechar }, 'Fechar');
    var modal = h('div', { class: 'modal modal-pedido', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo }, botaoFechar, corpo);
    var fundo = h('div', { class: 'modal-fundo', onclick: function (ev) { if (ev.target === fundo) fechar(); } }, modal);
    var aoFechar = [];
    function tecla(ev) { if (ev.key === 'Escape') fechar(); }
    function fechar() {
      root.removeEventListener('keydown', tecla);
      aoFechar.forEach(function (f) { f(); });
      if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
      document.body.style.overflow = '';
      fecharAtual = null;
      if (anterior && anterior.focus) anterior.focus();
    }
    fecharAtual = fechar;
    root.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(fundo);
    botaoFechar.focus();
    return { corpo: corpo, fechar: fechar, aoFechar: function (f) { aoFechar.push(f); } };
  }

  // ---------------------------------------------------------------- formulário
  function abrir(p) {
    var j = janela('Combinar entrega de ' + p.nome);
    var erro = h('p', { class: 'erro-form', role: 'alert' });
    var inNome = h('input', { name: 'nome', autocomplete: 'name', maxlength: 80, required: true });
    var inTel = h('input', { name: 'telefone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '(11) 91234-5678', required: true });
    var inLocal = h('input', { name: 'local', maxlength: 200, required: true, placeholder: 'Bairro ou ponto de encontro' });
    var inHorario = h('input', { name: 'horario', maxlength: 100, placeholder: 'Ex.: sábado, depois das 14h' });
    var inObs = h('textarea', { name: 'obs', rows: 3, maxlength: 300, placeholder: 'Alguma observação para o vendedor (opcional)' });
    var inAceite = h('input', { type: 'checkbox', name: 'aceite', required: true });
    var form = h('form', { class: 'form', onsubmit: function (ev) {
      ev.preventDefault();
      erro.textContent = '';
      var botao = form.querySelector('button[type=submit]');
      botao.disabled = true;
      API.chamar('pedido.criar', {
        produtoId: p.id, nome: inNome.value, telefone: inTel.value, local: inLocal.value, horario: inHorario.value, obs: inObs.value, aceite: inAceite.checked
      }).then(function (r) {
        guardar(r.token, p.nome);
        acompanhar(r.token, j);
      }).catch(function (e) { erro.textContent = e.message || 'Não foi possível enviar o pedido.'; botao.disabled = false; });
    } },
      campo('Seu nome', inNome),
      campo('Telefone / WhatsApp (com DDD)', inTel),
      campo('Onde combinar a entrega em mãos', inLocal),
      campo('Dia e horário preferidos', inHorario),
      campo('Observações', inObs),
      h('label', { class: 'marcar' }, inAceite, ' Autorizo o uso do meu nome, telefone e local apenas para combinar esta entrega.'),
      erro,
      h('button', { class: 'primario', type: 'submit' }, 'Enviar pedido ao vendedor'));
    j.corpo.replaceChildren(
      h('h2', {}, 'Combinar entrega em mãos'),
      h('p', { class: 'resumo-pedido' }, h('strong', {}, p.nome), ' · ', U.centavosParaReais(p.precoCentavos)),
      h('p', { class: 'nota' }, 'O vendedor tem 12 horas para confirmar o encontro. Depois da confirmação, o QR Code do Pix aparece aqui para você pagar.'),
      form);
  }

  // ---------------------------------------------------------------- acompanhamento
  function acompanhar(token, janelaExistente) {
    var j = janelaExistente || janela('Acompanhar pedido');
    var ped = null, desvio = 0, ticker = null, poll = null, fechado = false;
    j.corpo.replaceChildren(h('p', { class: 'carregando' }, 'Carregando o pedido…'));
    j.aoFechar(function () { fechado = true; clearInterval(ticker); clearInterval(poll); });

    function consultar() {
      return API.chamar('pedido.consultar', { token: token }).then(function (r) {
        if (fechado) return;
        var mudou = !ped || ped.status !== r.status;
        ped = r; desvio = r.agora - Date.now();
        if (mudou) desenhar();
      }).catch(function (e) {
        if (fechado) return;
        if (!ped) { esquecer(token); j.corpo.replaceChildren(h('h2', {}, 'Pedido não encontrado'), h('p', {}, e.message || 'Este pedido não existe mais.')); }
      });
    }

    function resumo() {
      return h('div', { class: 'resumo-pedido-caixa' },
        h('p', {}, h('strong', {}, ped.produto.nome), ' · ', U.centavosParaReais(ped.produto.precoCentavos)),
        h('p', { class: 'sub' }, 'Entrega em: ' + ped.local + (ped.horario ? ' · ' + ped.horario : '')));
    }

    function desenhar() {
      clearInterval(ticker);
      var st = ped.status, partes = [];
      if (st === 'aguardando') {
        var relogio = h('div', { class: 'cronometro', role: 'timer', 'aria-live': 'off' }, hhmmss(ped.expiraEm - (Date.now() + desvio)));
        ticker = setInterval(function () {
          var resta = ped.expiraEm - (Date.now() + desvio);
          relogio.textContent = hhmmss(resta);
          if (resta <= 0) { clearInterval(ticker); consultar(); }
        }, 1000);
        partes = [
          h('h2', {}, 'Pedido enviado!'),
          h('p', {}, 'Aguardando a confirmação do vendedor. O tempo restante para ele responder:'),
          relogio,
          resumo(),
          h('p', { class: 'nota' }, 'Você pode fechar esta janela. Para voltar, abra a loja neste mesmo aparelho ou use o link do pedido.'),
          h('div', { class: 'acoes' },
            h('button', { onclick: function () { UI.copiar(linkDoPedido(token)); } }, 'Copiar link do pedido'),
            h('button', { class: 'perigo', onclick: function (ev) { cancelar(ev.target); } }, 'Cancelar pedido'))];
      } else if (st === 'aprovado') {
        var cod = ped.pix ? ped.pix.copiaECola : '';
        var qr = null;
        try { qr = cod ? root.BolaoQR.svg(cod, 248) : null; } catch (e) { qr = null; }
        partes = [
          h('h2', {}, 'Pedido aprovado!'),
          ped.mensagem ? h('div', { class: 'aviso-ok' }, h('strong', {}, 'Mensagem do vendedor: '), ped.mensagem) : null,
          ped.instrucoes ? h('p', { class: 'descricao' }, ped.instrucoes) : null,
          resumo(),
          ped.pix ? h('div', { class: 'pix-caixa' },
            h('p', {}, 'Pague ', h('strong', {}, U.centavosParaReais(ped.pix.valorCentavos)), ' pelo Pix para ', h('strong', {}, ped.pix.favorecido), ':'),
            qr ? h('div', { class: 'qr-caixa' }, qr) : null,
            h('textarea', { class: 'pix-codigo', readonly: true, rows: 3, 'aria-label': 'Pix copia e cola', onfocus: function (ev) { ev.target.select(); } }, cod),
            h('button', { class: 'primario', onclick: function () { UI.copiar(cod); } }, 'Copiar Pix copia e cola'),
            h('p', { class: 'sub' }, 'Depois de pagar, o vendedor confirma o pagamento. Esta janela se atualiza sozinha.')) : null,
          h('div', { class: 'acoes' }, h('button', { class: 'perigo', onclick: function (ev) { cancelar(ev.target); } }, 'Cancelar pedido'))];
      } else {
        var titulos = { pago: 'Pagamento confirmado. Obrigado!', recusado: 'O vendedor não pôde atender este pedido', expirado: 'O prazo de ' + ped.horas + ' horas terminou', cancelado: 'Pedido cancelado' };
        partes = [
          h('h2', {}, titulos[st] || 'Pedido'),
          ped.mensagem ? h('div', { class: 'aviso-ok' }, h('strong', {}, 'Mensagem do vendedor: '), ped.mensagem) : null,
          st === 'pago' && ped.instrucoes ? h('p', { class: 'descricao' }, ped.instrucoes) : null,
          st === 'expirado' ? h('p', {}, 'O vendedor não respondeu a tempo. Você pode fazer um novo pedido.') : null,
          resumo(),
          h('div', { class: 'acoes' }, h('button', { class: 'primario', onclick: function () { esquecer(token); j.fechar(); } }, 'Entendi'))];
      }
      j.corpo.replaceChildren.apply(j.corpo, partes.filter(Boolean));
    }

    function cancelar(botao) {
      if (!root.confirm('Cancelar este pedido?')) return;
      botao.disabled = true;
      API.chamar('pedido.cancelar', { token: token }).then(function (r) { ped = r; desvio = r.agora - Date.now(); desenhar(); })
        .catch(function (e) { botao.disabled = false; UI.aviso(e.message || 'Não foi possível cancelar.', true); });
    }

    consultar().then(function () {
      poll = setInterval(function () { if (ped && ped.status !== 'pago' && ped.status !== 'recusado' && ped.status !== 'expirado' && ped.status !== 'cancelado') consultar(); }, 15000);
    });
  }

  /** Abre o pedido do link (?pedido=...) ou mostra o atalho "Meu pedido" quando há pedido guardado neste aparelho. */
  function iniciar(alvoAtalho) {
    var token = new URLSearchParams(root.location.search).get('pedido');
    if (token && /^[0-9a-f]{32}$/.test(token)) {
      guardar(token, 'Pedido');
      try { root.history.replaceState(null, '', root.location.pathname); } catch (e) { /* ignora */ }
      acompanhar(token);
    }
    var lista = guardados();
    if (alvoAtalho && lista.length) {
      alvoAtalho.replaceChildren(h('button', { class: 'link-topo botao-meu-pedido', type: 'button', onclick: function () { acompanhar(guardados()[0] ? guardados()[0].token : lista[0].token); } }, 'Meu pedido'));
    }
  }

  root.LojaPedido = { abrir: abrir, acompanhar: acompanhar, iniciar: iniciar };
})(window);
