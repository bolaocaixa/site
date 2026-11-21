/** Painel da loja: login, convites e abas. O administrador cuida dos produtos; o de propagandas, dos banners e do relógio. */
(function () {
  'use strict';
  var U = window.BolaoUtil;
  var API = window.BolaoApi;
  var h = window.BolaoUI.h;
  var aviso = window.BolaoUI.aviso;
  var campo = window.BolaoUI.campo;
  var Img = window.BolaoImagens;
  var raiz = document.getElementById('app');

  var estado = {
    usuario: null, abaAcesso: 'entrar', codigoConvite: '', aba: 'produtos',
    cfg: null, produtos: null, edicaoProduto: null, convites: [], novoConvite: null
  };

  function montar() {
    raiz.replaceChildren.apply(raiz, Array.prototype.slice.call(arguments));
  }

  async function executar(fn, botao, aoErro) {
    if (botao) botao.disabled = true;
    try {
      return await fn();
    } catch (e) {
      if (e && e.sessaoInvalida) {
        API.guardarToken('');
        estado.usuario = null;
        renderAcesso();
        aviso(e.message, true);
      } else if (aoErro) {
        aoErro(e.message || 'Erro inesperado.');
      } else {
        aviso(e.message || 'Erro inesperado.', true);
      }
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  var ctxAdmin = {
    estado: estado, API: API, U: U, UI: window.BolaoUI, Img: Img,
    executar: function () { return executar.apply(null, arguments); },
    renderPainel: function () { renderPainel(); },
    atualizarTopo: function () { /* o painel não mostra propagandas */ }
  };

  // ---------- acesso ----------
  function renderAcesso() {
    var abaEntrar = estado.abaAcesso === 'entrar';
    var erroEntrar = h('p', { class: 'erro-form', role: 'alert' });
    var erroCad = h('p', { class: 'erro-form', role: 'alert' });
    var formEntrar = h('form', { class: 'form', onsubmit: onEntrar },
      campo('Usuário', h('input', { name: 'usuario', autocomplete: 'username', autocapitalize: 'none', required: true })),
      campo('Senha', h('input', { name: 'senha', type: 'password', autocomplete: 'current-password', required: true })),
      erroEntrar,
      h('button', { class: 'primario', type: 'submit' }, 'Entrar'));
    var formCad = h('form', { class: 'form', onsubmit: onCadastrar },
      campo('Código do convite', h('input', { name: 'convite', value: estado.codigoConvite, autocapitalize: 'characters', required: true })),
      campo('Seu nome', h('input', { name: 'nome', autocomplete: 'name', required: true })),
      campo('Usuário', h('input', { name: 'usuario', autocomplete: 'username', autocapitalize: 'none', required: true }),
        '3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.'),
      campo('Senha', h('input', { name: 'senha', type: 'password', autocomplete: 'new-password', minlength: 8, required: true }), 'Mínimo de 8 caracteres.'),
      campo('Repita a senha', h('input', { name: 'senha2', type: 'password', autocomplete: 'new-password', required: true })),
      erroCad,
      h('button', { class: 'primario', type: 'submit' }, 'Criar conta'));

    montar(h('main', { class: 'central' },
      h('h1', {}, 'Painel da Loja'),
      h('p', { class: 'sub' }, 'Área restrita aos administradores.'),
      h('div', { class: 'abas', role: 'tablist' },
        h('button', { role: 'tab', 'aria-selected': String(abaEntrar), class: abaEntrar ? 'ativa' : '', onclick: function () { estado.abaAcesso = 'entrar'; renderAcesso(); } }, 'Entrar'),
        h('button', { role: 'tab', 'aria-selected': String(!abaEntrar), class: !abaEntrar ? 'ativa' : '', onclick: function () { estado.abaAcesso = 'cadastrar'; renderAcesso(); } }, 'Tenho um convite')),
      abaEntrar ? formEntrar : formCad,
      h('a', { class: 'botao-link largo', href: 'index.html' }, 'Ver a loja')));

    function onEntrar(ev) {
      ev.preventDefault();
      var f = ev.target;
      var mostrarErro = function (m) { erroEntrar.textContent = m; };
      mostrarErro('');
      executar(async function () {
        await abrirPainel(await API.chamar('login', { usuario: f.elements.usuario.value, senha: f.elements.senha.value }));
      }, f.querySelector('button[type=submit]'), mostrarErro);
    }

    function onCadastrar(ev) {
      ev.preventDefault();
      var f = ev.target;
      var mostrarErro = function (m) { erroCad.textContent = m; };
      mostrarErro('');
      if (f.elements.senha.value !== f.elements.senha2.value) return mostrarErro('As senhas não conferem.');
      executar(async function () {
        var r = await API.chamar('cadastrar', {
          codigoConvite: f.elements.convite.value, nome: f.elements.nome.value,
          usuario: f.elements.usuario.value, senha: f.elements.senha.value
        });
        estado.codigoConvite = '';
        await abrirPainel(r);
      }, f.querySelector('button[type=submit]'), mostrarErro);
    }
  }

  // ---------- painel ----------
  function ehAdmin() { return estado.usuario && estado.usuario.papel === 'admin'; }

  async function abrirPainel(r) {
    API.guardarToken(r.token);
    estado.usuario = r.usuario;
    estado.aba = ehAdmin() ? 'produtos' : 'propagandas';
    estado.produtos = null;
    estado.edicaoProduto = null;
    estado.novoConvite = null;
    await carregarDados();
    renderPainel();
  }

  async function carregarDados() {
    estado.cfg = await API.chamar('admin.config.obter', {});
    if (ehAdmin()) estado.convites = await API.chamar('admin.convites.listar', {});
  }

  async function sair() {
    try { await API.chamar('logout', {}); } catch (e) { /* sai localmente mesmo assim */ }
    API.guardarToken('');
    estado.usuario = null;
    estado.cfg = null;
    estado.produtos = null;
    estado.abaAcesso = 'entrar';
    renderAcesso();
  }

  function renderPainel() {
    var admin = ehAdmin();
    var abas = admin
      ? [['produtos', 'Produtos'], ['propagandas', 'Propagandas e ofertas'], ['convites', 'Convites'], ['usuarios', 'Usuários']]
      : [['propagandas', 'Propagandas e ofertas']];
    var A = window.BolaoAdmin;
    var conteudo;
    if (estado.aba === 'produtos' && admin) conteudo = A.telaProdutos(ctxAdmin);
    else if (estado.aba === 'convites' && admin) conteudo = telaConvites();
    else if (estado.aba === 'usuarios' && admin) conteudo = A.telaUsuarios(ctxAdmin);
    else conteudo = A.telaPropagandas(ctxAdmin);

    montar(
      h('header', { class: 'topo' },
        h('strong', {}, 'Painel da Loja'),
        h('span', { class: 'quem' }, estado.usuario.nome + (admin ? ' (administrador)' : ' (propagandas)')),
        h('a', { class: 'link-publico', href: 'index.html', target: '_blank', rel: 'noopener' }, 'Ver a loja'),
        h('button', { class: 'link', onclick: sair }, 'Sair')),
      h('main', { class: 'painel' },
        abas.length > 1 ? h('div', { class: 'abas', role: 'tablist' }, abas.map(function (a) {
          var ativa = estado.aba === a[0];
          return h('button', { role: 'tab', 'aria-selected': String(ativa), class: ativa ? 'ativa' : '',
            onclick: function () { estado.aba = a[0]; estado.edicaoProduto = null; renderPainel(); } }, a[1]);
        })) : null,
        conteudo));
  }

  // ---------- convites ----------
  var ROTULO_CONVITE = { ativo: 'Ativo', usado: 'Usado', revogado: 'Revogado', expirado: 'Expirado' };
  var ROTULO_PAPEL = { admin: 'Administrador (produtos)', publicidade: 'Propagandas (banners e relógio)' };

  function telaConvites() {
    var nc = estado.novoConvite;
    var link = nc ? location.origin + location.pathname + '?convite=' + encodeURIComponent(nc.codigo) : '';
    var selPapel = h('select', { name: 'papel' }, h('option', { value: 'publicidade' }, ROTULO_PAPEL.publicidade), h('option', { value: 'admin' }, ROTULO_PAPEL.admin));
    var inHoras = h('input', { name: 'horas', type: 'number', min: 1, max: 720, step: 1, value: 72, required: true });

    return h('section', {},
      h('h2', {}, 'Convites'),
      h('p', { class: 'sub' }, 'Gere um código de uso único para cada novo administrador. Ele cria o próprio usuário e senha em "Tenho um convite".'),
      h('form', { class: 'form linha', onsubmit: function (ev) {
        ev.preventDefault();
        executar(async function () {
          estado.novoConvite = await API.chamar('admin.convites.criar', { papel: selPapel.value, validadeHoras: Number(inHoras.value) });
          estado.convites = await API.chamar('admin.convites.listar', {});
          renderPainel();
        }, ev.target.querySelector('button'));
      } },
        campo('Quem vai entrar', selPapel), campo('Validade (horas)', inHoras),
        h('button', { class: 'primario', type: 'submit' }, 'Gerar convite')),
      nc ? h('div', { class: 'destaque' },
        h('p', {}, h('strong', {}, 'Convite gerado. Copie agora: o código não será mostrado de novo.')),
        h('input', { class: 'codigo', readonly: true, 'aria-label': 'Código do convite', value: nc.codigo }),
        h('div', { class: 'acoes' },
          h('button', { onclick: function () { window.BolaoUI.copiar(nc.codigo); } }, 'Copiar código'),
          h('button', { onclick: function () { window.BolaoUI.copiar(link); } }, 'Copiar link de cadastro')),
        h('p', { class: 'sub' }, 'Vale até ' + U.formatarData(nc.expiraEm) + ' e só pode ser usado uma vez.')) : null,
      h('h3', {}, 'Convites emitidos'),
      estado.convites.length === 0 ? h('p', { class: 'vazio' }, 'Nenhum convite ainda.')
        : h('ul', { class: 'lista' }, estado.convites.slice().sort(function (a, b) { return b.criadoEm - a.criadoEm; }).map(function (c) {
          return h('li', {},
            h('span', { class: 'selo ' + c.status }, ROTULO_CONVITE[c.status] || c.status),
            h('span', {}, (ROTULO_PAPEL[c.papel] || c.papel) + ' · criado em ' + U.formatarData(c.criadoEm)),
            c.status === 'ativo' ? h('button', { class: 'perigo', onclick: function (ev) {
              executar(async function () {
                await API.chamar('admin.convites.revogar', { id: c.id });
                estado.convites = await API.chamar('admin.convites.listar', {});
                renderPainel();
              }, ev.target);
            } }, 'Revogar') : null);
        })));
  }

  // ---------- início ----------
  async function iniciar() {
    var cfg = window.BOLAO_CONFIG || {};
    if (!cfg.API_URL || /^COLE_AQUI/.test(cfg.API_URL)) {
      montar(h('main', { class: 'central' }, h('h1', {}, 'Configuração pendente'), h('p', {}, 'Edite o arquivo config.js e informe a URL do Apps Script (termina em /exec).')));
      return;
    }
    var conv = new URLSearchParams(location.search).get('convite');
    if (conv) {
      estado.codigoConvite = conv;
      estado.abaAcesso = 'cadastrar';
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignora */ }
    }
    if (API.lerToken()) {
      try {
        estado.usuario = await API.chamar('eu', {});
        estado.aba = ehAdmin() ? 'produtos' : 'propagandas';
        await carregarDados();
        renderPainel();
        return;
      } catch (e) {
        if (e.sessaoInvalida) {
          API.guardarToken('');
        } else {
          montar(h('main', { class: 'central' }, h('h1', {}, 'Sem conexão'), h('p', {}, e.message),
            h('button', { class: 'primario', onclick: function () { location.reload(); } }, 'Tentar de novo')));
          return;
        }
      }
    }
    renderAcesso();
  }

  iniciar();
})();
