/** Contas: recuperação de senha por e-mail, "Minha conta", configuração do envio e painel do Administrador Supremo. */
(function (root) {
  'use strict';
  var UI = root.BolaoUI;
  var h = UI.h, campo = UI.campo;
  var ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var ROTULO_PAPEL = { supremo: 'Administrador Supremo', admin: 'Administrador', publicidade: 'Propagandas', participante: 'Participante' };

  function gerarSenha(tam) {
    var buf = new Uint32Array(tam), s = '';
    root.crypto.getRandomValues(buf);
    for (var i = 0; i < tam; i++) s += ALFABETO.charAt(buf[i] % ALFABETO.length);
    return s;
  }

  function data(ms) { return ms ? new Date(ms).toLocaleString('pt-BR') : ''; }

  // ---------- antes do login ----------
  /** ctx: { API, executar, voltar } */
  function formEsqueci(ctx) {
    var erro = h('p', { class: 'erro-form', role: 'alert' });
    var ok = h('div', {});
    return h('form', { class: 'form', onsubmit: function (ev) {
      ev.preventDefault();
      var f = ev.target;
      erro.textContent = '';
      ok.replaceChildren();
      ctx.executar(async function () {
        await ctx.API.chamar('senha.solicitar', { identificador: f.elements.ident.value });
        ok.replaceChildren(h('div', { class: 'aviso-ok', role: 'status' },
          'Se existir uma conta com esse usuário ou e-mail e ela tiver e-mail cadastrado, enviamos um link para criar uma nova senha. ',
          'Ele vale por 30 minutos e só funciona uma vez. Confira também a caixa de spam.'));
      }, f.querySelector('button[type=submit]'), function (m) { erro.textContent = m; });
    } },
      h('p', { class: 'sub' }, 'Digite o seu usuário ou o e-mail cadastrado. Enviaremos um link para criar uma nova senha.'),
      campo('Usuário ou e-mail', h('input', { name: 'ident', autocomplete: 'username', autocapitalize: 'none', required: true })),
      erro, ok,
      h('button', { class: 'primario', type: 'submit' }, 'Enviar link'),
      h('button', { class: 'link-claro', type: 'button', onclick: ctx.voltar }, 'Voltar ao login'));
  }

  /** ctx: { API, executar, token, concluido } */
  function formRedefinir(ctx) {
    var erro = h('p', { class: 'erro-form', role: 'alert' });
    return h('form', { class: 'form', onsubmit: function (ev) {
      ev.preventDefault();
      var f = ev.target;
      erro.textContent = '';
      if (f.elements.senha.value !== f.elements.senha2.value) { erro.textContent = 'As senhas não conferem.'; return; }
      ctx.executar(async function () {
        var r = await ctx.API.chamar('senha.redefinir', { token: ctx.token, senha: f.elements.senha.value });
        ctx.concluido(r.usuario);
      }, f.querySelector('button[type=submit]'), function (m) { erro.textContent = m; });
    } },
      h('p', { class: 'sub' }, 'Crie a sua nova senha (mínimo de 8 caracteres).'),
      campo('Nova senha', h('input', { name: 'senha', type: 'password', autocomplete: 'new-password', minlength: 8, required: true })),
      campo('Repita a nova senha', h('input', { name: 'senha2', type: 'password', autocomplete: 'new-password', required: true })),
      erro,
      h('button', { class: 'primario', type: 'submit' }, 'Salvar nova senha'));
  }

  // ---------- Minha conta (qualquer usuário logado) ----------
  function telaMinhaConta(ctx) {
    var API = ctx.API, u = ctx.estado.usuario;
    var erroE = h('p', { class: 'erro-form', role: 'alert' }), erroS = h('p', { class: 'erro-form', role: 'alert' });
    var atual = h('p', {}, u.email ? 'E-mail cadastrado: ' : 'Nenhum e-mail cadastrado. ', u.email ? h('strong', {}, u.email) : null);

    var formEmail = h('form', { class: 'form', onsubmit: function (ev) {
      ev.preventDefault();
      var f = ev.target;
      erroE.textContent = '';
      ctx.executar(async function () {
        var r = await API.chamar('conta.email', { email: f.elements.email.value, senhaAtual: f.elements.senhaAtual.value });
        ctx.estado.usuario.email = r.email;
        f.reset();
        ctx.renderPainel();
        UI.aviso('E-mail salvo.');
      }, f.querySelector('button[type=submit]'), function (m) { erroE.textContent = m; });
    } },
      campo('Novo e-mail', h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true }), 'É para este endereço que enviamos o link de "Esqueci minha senha".'),
      campo('Sua senha atual (confirmação)', h('input', { name: 'senhaAtual', type: 'password', autocomplete: 'current-password', required: true })),
      erroE, h('button', { class: 'primario', type: 'submit' }, 'Salvar e-mail'));

    var formSenha = h('form', { class: 'form', onsubmit: function (ev) {
      ev.preventDefault();
      var f = ev.target;
      erroS.textContent = '';
      if (f.elements.novaSenha.value !== f.elements.novaSenha2.value) { erroS.textContent = 'As senhas não conferem.'; return; }
      ctx.executar(async function () {
        await API.chamar('conta.senha', { senhaAtual: f.elements.senhaAtual.value, novaSenha: f.elements.novaSenha.value });
        f.reset();
        UI.aviso('Senha alterada.');
      }, f.querySelector('button[type=submit]'), function (m) { erroS.textContent = m; });
    } },
      campo('Senha atual', h('input', { name: 'senhaAtual', type: 'password', autocomplete: 'current-password', required: true })),
      campo('Nova senha', h('input', { name: 'novaSenha', type: 'password', autocomplete: 'new-password', minlength: 8, required: true }), 'Mínimo de 8 caracteres.'),
      campo('Repita a nova senha', h('input', { name: 'novaSenha2', type: 'password', autocomplete: 'new-password', required: true })),
      erroS, h('button', { class: 'primario', type: 'submit' }, 'Trocar senha'));

    return h('section', {},
      h('h2', {}, 'Minha conta'),
      h('p', { class: 'sub' }, u.nome + ' (@' + u.usuario + ') · ' + (ROTULO_PAPEL[u.papel] || u.papel)),
      !u.email ? h('div', { class: 'aviso-ok', role: 'status' }, 'Cadastre o seu e-mail abaixo. Sem ele, não é possível recuperar a senha se você a esquecer.') : null,
      h('h3', {}, 'E-mail de recuperação'), atual, formEmail,
      h('h3', {}, 'Trocar senha'), formSenha);
  }

  // ---------- configuração do envio (administradores) ----------
  function blocoRecuperacao(ctx) {
    var API = ctx.API;
    var corpo = h('div', {}, h('p', { class: 'carregando' }, 'Carregando…'));
    var erro = h('p', { class: 'erro-form', role: 'alert' });

    function desenhar(e) {
      var inSite = h('input', { name: 'siteUrl', type: 'url', value: e.siteUrl, placeholder: 'https://seusite.com.br', autocapitalize: 'none' });
      corpo.replaceChildren.apply(corpo, [
        h('p', { class: 'sub' }, 'Quem esquecer a senha pede um link em "Esqueci minha senha", na tela de login. O link é enviado ao e-mail cadastrado na conta.'),
        e.siteUrl ? null : h('div', { class: 'aviso-ok', role: 'status' }, 'Informe o endereço do site para ativar o envio.'),
        campo('Endereço do site (usado dentro do e-mail)', inSite, 'Exemplo: https://brcarregadores.github.io. Mude aqui quando trocar de domínio.'),
        h('div', { class: 'acoes' },
          h('button', { class: 'primario', onclick: function (ev) {
            erro.textContent = '';
            ctx.executar(async function () {
              desenhar(await API.chamar('admin.recuperacao.salvar', { siteUrl: inSite.value }));
              UI.aviso('Endereço salvo.');
            }, ev.target, function (m) { erro.textContent = m; });
          } }, 'Salvar endereço'),
          h('button', { onclick: function (ev) {
            erro.textContent = '';
            ctx.executar(async function () {
              var r = await API.chamar('admin.recuperacao.testar', {});
              UI.aviso('E-mail de teste enviado para ' + r.enviadoPara + '.');
            }, ev.target, function (m) { erro.textContent = m; });
          } }, 'Enviar e-mail de teste para mim')),
        erro,
        h('p', { class: 'sub' }, e.semEmail > 0 ? e.semEmail + ' conta(s) ainda sem e-mail cadastrado: elas não conseguem recuperar a senha.' : 'Todas as contas têm e-mail cadastrado.'),
        h('p', { class: 'sub' }, e.emailsRestantes >= 0 ? 'Envios restantes hoje: ' + e.emailsRestantes + '.' : '')].filter(Boolean));
    }

    API.chamar('admin.recuperacao.estado', {}).then(desenhar).catch(function (e) {
      corpo.replaceChildren(h('p', { class: 'erro-form' }, 'Não foi possível carregar: ' + e.message));
    });
    return h('section', { class: 'cartao' }, h('h3', {}, 'Recuperação de senha por e-mail'), corpo);
  }

  // ---------- Administrador Supremo ----------
  function telaContas(ctx) {
    var API = ctx.API;
    var papeis = ctx.papeis || ['supremo', 'admin', 'publicidade'];
    var lista = h('div', { class: 'lista-usuarios' }, h('p', { class: 'carregando' }, 'Carregando…'));
    var erroGeral = h('p', { class: 'erro-form', role: 'alert' });
    var todos = [];
    var inBusca = h('input', { name: 'buscaConta', type: 'search', placeholder: 'Buscar por nome, usuário ou e-mail', oninput: desenhar });
    var areaNova = h('div', {});
    var areaRegistro = h('div', {});

    function selPapel(valor, desativar) {
      return h('select', { disabled: desativar ? true : null }, papeis.map(function (p) {
        return h('option', { value: p, selected: p === valor ? true : null }, ROTULO_PAPEL[p] || p);
      }));
    }

    function recarregar() {
      return API.chamar('supremo.usuarios.listar', {}).then(function (r) { todos = r; desenhar(); });
    }

    function formNova() {
      var erro = h('p', { class: 'erro-form', role: 'alert' });
      var inUsuario = h('input', { maxlength: 30, autocapitalize: 'none', required: true });
      var inNome = h('input', { required: true });
      var inEmail = h('input', { type: 'email', required: true });
      var inSenha = h('input', { type: 'text', minlength: 8, autocomplete: 'off', spellcheck: 'false', value: gerarSenha(10) });
      var sel = selPapel('admin');
      return h('form', { class: 'form cartao', onsubmit: function (ev) {
        ev.preventDefault();
        erro.textContent = '';
        var senha = inSenha.value, usuario = inUsuario.value;
        ctx.executar(async function () {
          await API.chamar('supremo.usuarios.criar', { usuario: usuario, nome: inNome.value, email: inEmail.value, papel: sel.value, senha: senha });
          areaNova.replaceChildren(h('div', { class: 'aviso-ok', role: 'status' }, h('strong', {}, 'Conta criada. '), 'Usuário: ', h('code', {}, usuario.toLowerCase()), ' · Senha provisória: ', h('code', {}, senha), ' ',
            h('button', { type: 'button', onclick: function () { UI.copiar('Usuário: ' + usuario.toLowerCase() + '\nSenha: ' + senha); } }, 'Copiar')));
          await recarregar();
        }, ev.target.querySelector('button[type=submit]'), function (m) { erro.textContent = m; });
      } },
        h('h3', {}, 'Nova conta'),
        campo('Nome', inNome), campo('Usuário (login)', inUsuario), campo('E-mail', inEmail), campo('Papel', sel),
        campo('Senha provisória', inSenha, 'Passe por um canal seguro. A pessoa pode trocá-la em "Minha conta".'),
        erro,
        h('div', { class: 'acoes' }, h('button', { class: 'primario', type: 'submit' }, 'Criar conta'),
          h('button', { type: 'button', onclick: function () { areaNova.replaceChildren(); } }, 'Cancelar')));
    }

    function cartao(u) {
      var eu = ctx.estado.usuario.id === u.id;
      var caixa = h('div', {});
      var resultado = h('div', {});

      function formEditar() {
        var erro = h('p', { class: 'erro-form', role: 'alert' });
        var inNome = h('input', { value: u.nome, required: true });
        var inUsuario = h('input', { value: u.usuario, maxlength: 30, autocapitalize: 'none', required: true });
        var inEmail = h('input', { type: 'email', value: u.email, required: true });
        var sPapel = selPapel(u.papel, eu);
        var sSit = h('select', { disabled: eu ? true : null },
          h('option', { value: 'ativo', selected: u.status === 'ativo' ? true : null }, 'Ativa'),
          h('option', { value: 'bloqueado', selected: u.status !== 'ativo' ? true : null }, 'Bloqueada (não consegue entrar)'));
        var inSenha = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Deixe vazio para manter a senha atual' });
        return h('form', { class: 'form', onsubmit: function (ev) {
          ev.preventDefault();
          erro.textContent = '';
          var corpo = { id: u.id, nome: inNome.value, usuario: inUsuario.value, email: inEmail.value };
          if (!eu) { corpo.papel = sPapel.value; corpo.status = sSit.value; }
          if (inSenha.value) corpo.senha = inSenha.value;
          if (!eu && corpo.papel !== u.papel) {
            var msg = 'Mudar o papel de ' + u.nome + ' para "' + ROTULO_PAPEL[corpo.papel] + '"?';
            if (corpo.papel === 'supremo') msg += '\nATENÇÃO: o Supremo pode alterar e excluir qualquer conta, inclusive a sua.';
            if (!root.confirm(msg)) return;
          }
          var senhaNova = inSenha.value;
          ctx.executar(async function () {
            var r = await API.chamar('supremo.usuarios.editar', corpo);
            caixa.replaceChildren();
            await recarregar();
            if (r.alterado) UI.aviso('Alterado: ' + r.mudou.join(', ') + '.');
            else UI.aviso('Nada foi alterado.');
            if (senhaNova) {
              resultado.replaceChildren(h('div', { class: 'aviso-ok', role: 'status' }, 'Nova senha de ', h('code', {}, corpo.usuario.toLowerCase()), ': ', h('code', {}, senhaNova), ' ',
                h('button', { type: 'button', onclick: function () { UI.copiar(senhaNova); } }, 'Copiar')));
            }
          }, ev.target.querySelector('button[type=submit]'), function (m) { erro.textContent = m; });
        } },
          campo('Nome', inNome), campo('Usuário (login)', inUsuario), campo('E-mail', inEmail),
          campo('Papel', sPapel, eu ? 'Você não pode alterar o papel da própria conta.' : null),
          campo('Situação', sSit),
          campo('Nova senha (opcional)', inSenha, 'Mínimo de 8 caracteres. As sessões abertas da conta são encerradas.'),
          h('div', { class: 'acoes' },
            h('button', { type: 'button', onclick: function () { inSenha.value = gerarSenha(10); } }, 'Gerar senha'),
            h('button', { class: 'primario', type: 'submit' }, 'Salvar'),
            h('button', { type: 'button', onclick: function () { caixa.replaceChildren(); } }, 'Cancelar')),
          erro);
      }

      function formExcluir() {
        var erro = h('p', { class: 'erro-form', role: 'alert' });
        var inConf = h('input', { autocapitalize: 'none', autocomplete: 'off', placeholder: u.usuario });
        return h('div', { class: 'form perigo-zona cartao' },
          h('p', {}, h('strong', {}, 'Excluir a conta de ' + u.nome + '?'), ' Isso não pode ser desfeito. Digite ', h('code', {}, u.usuario), ' para confirmar.'),
          inConf,
          h('div', { class: 'acoes' },
            h('button', { class: 'perigo', onclick: function (ev) {
              erro.textContent = '';
              ctx.executar(async function () {
                await API.chamar('supremo.usuarios.excluir', { id: u.id, confirmar: inConf.value });
                caixa.replaceChildren();
                await recarregar();
                UI.aviso('Conta excluída.');
              }, ev.target, function (m) { erro.textContent = m; });
            } }, 'Excluir definitivamente'),
            h('button', { onclick: function () { caixa.replaceChildren(); } }, 'Cancelar')),
          erro);
      }

      return h('article', { class: 'cartao' },
        h('div', { class: 'cartao-topo' }, h('h3', {}, u.nome + ' (@' + u.usuario + ')'),
          h('span', { class: 'selo ' + (u.status === 'ativo' ? 'aberto' : 'revogado') }, (ROTULO_PAPEL[u.papel] || u.papel) + (u.status === 'ativo' ? '' : ' · bloqueada'))),
        h('p', { class: 'sub' }, (u.email || 'sem e-mail cadastrado') + (eu ? ' · esta é a sua conta' : '')),
        h('div', { class: 'acoes' },
          h('button', { onclick: function () { caixa.replaceChildren(formEditar()); } }, 'Editar'),
          eu ? null : h('button', { class: 'perigo', onclick: function () { caixa.replaceChildren(formExcluir()); } }, 'Excluir')),
        caixa, resultado);
    }

    function desenhar() {
      var q = inBusca.value.trim().toLowerCase();
      var vis = todos.filter(function (u) { return !q || (u.nome + ' ' + u.usuario + ' ' + u.email).toLowerCase().indexOf(q) !== -1; });
      lista.replaceChildren.apply(lista, vis.length ? vis.map(cartao) : [h('p', { class: 'vazio' }, 'Nenhuma conta encontrada.')]);
    }

    recarregar().catch(function (e) {
      lista.replaceChildren();
      erroGeral.textContent = 'Não foi possível carregar as contas: ' + e.message + ' Confira se o Código.gs novo foi colado e se a implantação tem uma nova versão.';
    });

    var detalhes = h('details', { ontoggle: function (ev) {
      if (!ev.target.open) return;
      areaRegistro.replaceChildren(h('p', { class: 'carregando' }, 'Carregando…'));
      API.chamar('supremo.registro', {}).then(function (r) {
        areaRegistro.replaceChildren(r.length ? h('ul', { class: 'lista' }, r.map(function (x) {
          return h('li', {}, h('span', {}, data(x.quando) + ' · ' + x.quem + ' · ' + x.acao + (x.alvo ? ' → ' + x.alvo : '')));
        })) : h('p', { class: 'vazio' }, 'Sem registros ainda.'));
      }).catch(function (e) { areaRegistro.replaceChildren(h('p', { class: 'erro-form' }, e.message)); });
    } }, h('summary', {}, 'Registro das últimas alterações'), areaRegistro);

    return h('section', {},
      h('h2', {}, 'Contas (Administrador Supremo)'),
      h('p', { class: 'sub' }, 'Aqui você edita, bloqueia, muda o papel ou exclui qualquer conta, inclusive de administradores.'),
      h('div', { class: 'acoes' }, h('button', { class: 'primario', onclick: function () { areaNova.replaceChildren(formNova()); } }, 'Nova conta')),
      areaNova,
      blocoRecuperacao(ctx),
      campo('Buscar', inBusca), erroGeral, lista, detalhes);
  }

  root.BolaoConta = { formEsqueci: formEsqueci, formRedefinir: formRedefinir, telaMinhaConta: telaMinhaConta, blocoRecuperacao: blocoRecuperacao, telaContas: telaContas, ROTULO_PAPEL: ROTULO_PAPEL };
})(window);
