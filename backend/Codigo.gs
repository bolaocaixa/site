// Backend da Loja. Versão L1: produtos (fotos, vídeo do YouTube, texto, link de compra), propagandas, relógio de ofertas.
// Base: o sistema de login, imagens, banners e propagandas do Bolão da Sorte, sem nada de bolão.

// ======================= backend/src/01_base.js =======================
// ===== Base: configuração, erros, utilitários =====
var CFG = {
  ABAS: {
    Usuarios: ['id', 'usuario', 'nome', 'hashSenha', 'papel', 'status', 'tentativas', 'bloqueadoAte', 'criadoEm', 'conviteId'],
    Convites: ['id', 'codigoHash', 'papel', 'criadoPor', 'criadoEm', 'expiraEm', 'status', 'usadoPor', 'usadoEm'],
    Sessoes: ['tokenHash', 'userId', 'criadoEm', 'expiraEm'],
    Config: ['chave', 'valor'],
    Banners: ['id', 'imagemId', 'titulo', 'link', 'ativo', 'ordem', 'criadoEm'],
    Imagens: ['id', 'parte', 'tipo', 'dados', 'criadoEm'],
    Produtos: ['id', 'nome', 'precoCentavos', 'precoOriginalCentavos', 'descricao', 'categoria', 'fotos', 'video', 'codigo', 'linkCompra', 'destaque', 'ativo', 'ordem', 'criadoEm', 'atualizadoEm']
  },
  COLUNAS_NUM: ['tentativas', 'bloqueadoAte', 'criadoEm', 'expiraEm', 'usadoEm', 'atualizadoEm',
    'parte', 'ordem', 'ativo', 'precoCentavos', 'precoOriginalCentavos', 'destaque'],
  SESSAO_MS: 7 * 24 * 3600 * 1000,
  MAX_TENTATIVAS: 5,
  BLOQUEIO_MS: 10 * 60 * 1000,
  HASH_ITER_PADRAO: 1500,
  CONVITE_HORAS_PADRAO: 72,
  IMG_MAX_B64: 300000,  // tamanho máximo da imagem em base64 (cerca de 225 KB)
  IMG_PARTE: 30000,     // cada célula guarda no máximo 30 mil caracteres
  MAX_BANNERS: 10,
  MAX_PRODUTOS: 100,
  MAX_FOTOS: 6
};

var RELOGIO = { agora: function () { return Date.now(); } };

function erroNegocio(msg) {
  var e = new Error(msg);
  e.negocio = true;
  return e;
}

function props() {
  return PropertiesService.getScriptProperties();
}

function novoId() {
  return Utilities.getUuid();
}

function aleatorioHex(n) {
  var s = '';
  while (s.length < n) s += Utilities.getUuid().replace(/-/g, '');
  return s.substring(0, n);
}

function bytesParaHex(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    if (h.length < 2) h = '0' + h;
    s += h;
  }
  return s;
}

function sha256Hex(texto) {
  return bytesParaHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8));
}

/** Remove caracteres de controle e prefixos que viram fórmula na planilha. */
function limparTexto(t, max) {
  return String(t === undefined || t === null ? '' : t)
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/^[=+\-@\s]+/, '')
    .trim()
    .substring(0, max);
}

/** Script Lock não é reentrante aqui: nunca chamar comLock dentro de comLock. */
function comLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}



// ======================= backend/src/02_dados.js =======================
// ===== Acesso à planilha =====
var PLANILHA_EM_CACHE = null; // vale só durante uma execução (cada chamada à API reinicia as variáveis globais)

function planilha() {
  if (PLANILHA_EM_CACHE) return PLANILHA_EM_CACHE;
  var id = props().getProperty('PLANILHA_ID');
  if (!id) throw new Error('Execute configurar() primeiro.');
  PLANILHA_EM_CACHE = SpreadsheetApp.openById(id);
  return PLANILHA_EM_CACHE;
}

/** Devolve a aba; se ela ainda não existe (versão nova do sistema), cria com o cabeçalho. */
function aba(nome) {
  var ss = planilha();
  var s = ss.getSheetByName(nome);
  if (!s) {
    var cols = CFG.ABAS[nome];
    if (!cols) throw new Error('Aba desconhecida: ' + nome);
    try {
      s = ss.insertSheet(nome);
    } catch (e) {
      s = ss.getSheetByName(nome); // outra execução criou ao mesmo tempo
      if (!s) throw e;
    }
    s.getRange(1, 1, 1, cols.length).setValues([cols]);
    s.setFrozenRows(1);
  }
  return s;
}

function ehNumerica(col) {
  return CFG.COLUNAS_NUM.indexOf(col) !== -1;
}

/**
 * O Planilhas converte texto parecido com número, data ou fórmula ("12e4", "0123", "1-2-3", "TRUE").
 * Para isso nunca acontecer, todo texto é gravado com o prefixo "~" e o prefixo é removido na leitura.
 */
function codificarTexto(v) {
  var s = String(v === undefined || v === null ? '' : v);
  return s === '' ? '' : '~' + s;
}

function decodificarTexto(v) {
  var s = String(v === undefined || v === null ? '' : v);
  return s.charAt(0) === '~' ? s.substring(1) : s;
}

/** Lê a aba como lista de objetos (com _linha). Textos ficam texto, números ficam número. */
function lerTabela(nome) {
  var cols = CFG.ABAS[nome];
  var vals = aba(nome).getDataRange().getValues();
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    if (vals[r][0] === '' || vals[r][0] === null || vals[r][0] === undefined) continue;
    var obj = { _linha: r + 1 };
    for (var c = 0; c < cols.length; c++) {
      var v = vals[r][c];
      if (v === undefined || v === null) v = '';
      if (ehNumerica(cols[c])) obj[cols[c]] = (v === '' ? '' : Number(v));
      else obj[cols[c]] = decodificarTexto(v);
    }
    out.push(obj);
  }
  return out;
}

function linhaDe(nome, obj) {
  var cols = CFG.ABAS[nome];
  var linha = [];
  for (var c = 0; c < cols.length; c++) {
    var v = obj[cols[c]] === undefined ? '' : obj[cols[c]];
    linha.push(ehNumerica(cols[c]) ? v : codificarTexto(v));
  }
  return linha;
}

function inserir(nome, obj) {
  aba(nome).appendRow(linhaDe(nome, obj));
}

function atualizar(nome, linha, obj) {
  var cols = CFG.ABAS[nome];
  aba(nome).getRange(linha, 1, 1, cols.length).setValues([linhaDe(nome, obj)]);
}

function removerLinha(nome, linha) {
  aba(nome).deleteRow(linha);
}



// ======================= backend/src/03_auth.js =======================
// ===== Autenticação: senha, convite, cadastro, login, sessão =====
function iteracoesHash() {
  var v = parseInt(props().getProperty('HASH_ITER'), 10);
  return (v > 0) ? v : CFG.HASH_ITER_PADRAO;
}

/** Formato: v1$iteracoes$salt$hash (SHA-256 iterado com salt individual). */
function hashSenha(senha, iter) {
  var salt = aleatorioHex(32);
  var h = sha256Hex(salt + '|' + senha);
  for (var i = 0; i < iter; i++) h = sha256Hex(h + '|' + salt + '|' + senha);
  return 'v1$' + iter + '$' + salt + '$' + h;
}

function comparaConstante(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function verificarSenha(senha, registro) {
  var p = String(registro).split('$');
  if (p.length !== 4 || p[0] !== 'v1') return false;
  var iter = parseInt(p[1], 10);
  if (!(iter > 0)) return false;
  var h = sha256Hex(p[2] + '|' + senha);
  for (var i = 0; i < iter; i++) h = sha256Hex(h + '|' + p[2] + '|' + senha);
  return comparaConstante(h, p[3]);
}

/** Quantas iterações o hash guardado usa (formato v1$iteracoes$salt$hash); 0 se o formato for desconhecido. */
function iteracaoDoHash(registro) {
  var p = String(registro).split('$');
  return (p.length === 4 && p[0] === 'v1') ? (parseInt(p[1], 10) || 0) : 0;
}

function normalizarUsuario(u) {
  return String(u === undefined || u === null ? '' : u).trim().toLowerCase();
}

function validarUsuario(u) {
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) {
    throw erroNegocio('Usuário deve ter de 3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.');
  }
}

function validarSenha(senha, usuario) {
  if (typeof senha !== 'string' || senha.length < 8) throw erroNegocio('A senha deve ter pelo menos 8 caracteres.');
  if (senha.length > 100) throw erroNegocio('A senha deve ter no máximo 100 caracteres.');
  if (senha.toLowerCase() === usuario) throw erroNegocio('A senha não pode ser igual ao usuário.');
}

// ----- convites -----
function normalizarCodigo(c) {
  return String(c === undefined || c === null ? '' : c).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashCodigo(codigoNormalizado) {
  return sha256Hex('convite|' + codigoNormalizado);
}

function gerarCodigoConvite() {
  var h = aleatorioHex(20).toUpperCase();
  return h.substring(0, 5) + '-' + h.substring(5, 10) + '-' + h.substring(10, 15) + '-' + h.substring(15, 20);
}

/** Cria o convite e devolve o código em texto puro uma única vez (só o hash é guardado). */
function criarConviteInterno(papel, criadoPor, horas) {
  if (['admin', 'publicidade'].indexOf(papel) === -1) throw erroNegocio('Papel inválido.');
  var h = (horas === undefined || horas === null) ? CFG.CONVITE_HORAS_PADRAO : horas;
  if (!Number.isInteger(h) || h < 1 || h > 24 * 30) throw erroNegocio('Validade deve ser de 1 a 720 horas.');
  var agora = RELOGIO.agora();
  var codigo = gerarCodigoConvite();
  var id = novoId();
  inserir('Convites', {
    id: id, codigoHash: hashCodigo(normalizarCodigo(codigo)), papel: papel, criadoPor: criadoPor,
    criadoEm: agora, expiraEm: agora + h * 3600 * 1000, status: 'ativo', usadoPor: '', usadoEm: ''
  });
  return { id: id, codigo: codigo, papel: papel, expiraEm: agora + h * 3600 * 1000 };
}

function criarConvite(admin, d) {
  return comLock(function () {
    return criarConviteInterno(d.papel || 'admin', admin.id, d.validadeHoras);
  });
}

function listarConvites() {
  var agora = RELOGIO.agora();
  return lerTabela('Convites').map(function (c) {
    var st = c.status;
    if (st === 'ativo' && c.expiraEm < agora) st = 'expirado';
    return { id: c.id, papel: c.papel, criadoEm: c.criadoEm, expiraEm: c.expiraEm, status: st, usadoPor: c.usadoPor, usadoEm: c.usadoEm };
  });
}

function revogarConvite(d) {
  return comLock(function () {
    var c = lerTabela('Convites').filter(function (x) { return x.id === d.id; })[0];
    if (!c) throw erroNegocio('Convite não encontrado.');
    if (c.status !== 'ativo') throw erroNegocio('Só convites ativos podem ser revogados.');
    c.status = 'revogado';
    atualizar('Convites', c._linha, c);
    return { id: c.id, status: 'revogado' };
  });
}

// ----- sessões -----
function limparSessoesExpiradas(agora) {
  var t = lerTabela('Sessoes');
  for (var i = t.length - 1; i >= 0; i--) {
    if (t[i].expiraEm < agora) removerLinha('Sessoes', t[i]._linha);
  }
}

/** Chamar somente dentro de comLock. Devolve o token em texto puro (só o hash é guardado). */
function criarSessaoInterna(userId, agora) {
  var token = aleatorioHex(64);
  inserir('Sessoes', { tokenHash: sha256Hex('sessao|' + token), userId: userId, criadoEm: agora, expiraEm: agora + CFG.SESSAO_MS });
  return token;
}

function usuarioPublico(u) {
  return { id: u.id, usuario: u.usuario, nome: u.nome, papel: u.papel };
}

function autenticar(token) {
  var invalida = erroNegocio('Sessão inválida ou expirada. Entre novamente.');
  if (typeof token !== 'string' || token.length < 32) throw invalida;
  var th = sha256Hex('sessao|' + token);
  var agora = RELOGIO.agora();
  var s = lerTabela('Sessoes').filter(function (x) { return x.tokenHash === th; })[0];
  if (!s || s.expiraEm < agora) throw invalida;
  var u = lerTabela('Usuarios').filter(function (x) { return x.id === s.userId; })[0];
  if (!u || u.status !== 'ativo') throw invalida;
  return u;
}

function exigirAdmin(token) {
  var u = autenticar(token);
  if (u.papel !== 'admin') throw erroNegocio('Acesso restrito ao administrador.');
  return u;
}

/** Administrador principal OU administrador de propagandas (papel 'publicidade'). */
function exigirAdminOuPublicidade(token) {
  var u = autenticar(token);
  if (u.papel !== 'admin' && u.papel !== 'publicidade') throw erroNegocio('Acesso restrito aos administradores.');
  return u;
}

// ----- cadastro e login -----
function cadastrar(d) {
  var usuario = normalizarUsuario(d.usuario);
  validarUsuario(usuario);
  var nome = limparTexto(d.nome, 60);
  if (nome.length < 2) throw erroNegocio('Informe seu nome (mínimo 2 caracteres).');
  validarSenha(d.senha, usuario);

  var cod = normalizarCodigo(d.codigoConvite);
  var conviteInvalido = erroNegocio('Convite inválido ou expirado.');
  if (cod.length !== 20) throw conviteInvalido;
  var ch = hashCodigo(cod);
  var achar = function () { return lerTabela('Convites').filter(function (c) { return c.codigoHash === ch; })[0]; };
  var pre = achar();
  if (!pre || pre.status !== 'ativo' || pre.expiraEm < RELOGIO.agora()) throw conviteInvalido;

  var registro = hashSenha(d.senha, iteracoesHash()); // custo alto: fora do lock

  return comLock(function () {
    var agora = RELOGIO.agora();
    var conv = achar();
    if (!conv || conv.status !== 'ativo' || conv.expiraEm < agora) throw conviteInvalido;
    var existe = lerTabela('Usuarios').some(function (u) { return u.usuario === usuario; });
    if (existe) throw erroNegocio('Este nome de usuário já está em uso.');
    var id = novoId();
    inserir('Usuarios', {
      id: id, usuario: usuario, nome: nome, hashSenha: registro, papel: conv.papel, status: 'ativo',
      tentativas: 0, bloqueadoAte: 0, criadoEm: agora, conviteId: conv.id
    });
    conv.status = 'usado';
    conv.usadoPor = id;
    conv.usadoEm = agora;
    atualizar('Convites', conv._linha, conv);
    var token = criarSessaoInterna(id, agora);
    return { token: token, usuario: { id: id, usuario: usuario, nome: nome, papel: conv.papel } };
  });
}

function login(d) {
  var generico = erroNegocio('Usuário ou senha inválidos.');
  var usuario = normalizarUsuario(d.usuario);
  var senha = (typeof d.senha === 'string') ? d.senha : '';
  var u = lerTabela('Usuarios').filter(function (x) { return x.usuario === usuario; })[0];

  if (!u) {
    hashSenha(senha, iteracoesHash()); // equaliza o tempo de resposta
    throw generico;
  }
  if (u.status !== 'ativo') throw generico;
  if (u.bloqueadoAte > RELOGIO.agora()) {
    throw erroNegocio('Muitas tentativas. Tente novamente em alguns minutos.');
  }

  var ok = verificarSenha(senha, u.hashSenha); // fora do lock
  // Contas criadas com outra quantidade de iterações são atualizadas no primeiro login certo.
  var novoHash = (ok && iteracaoDoHash(u.hashSenha) !== iteracoesHash()) ? hashSenha(senha, iteracoesHash()) : null;

  return comLock(function () {
    var agora = RELOGIO.agora();
    var atual = lerTabela('Usuarios').filter(function (x) { return x.id === u.id; })[0];
    if (!atual) throw generico;
    if (!ok) {
      atual.tentativas = (atual.tentativas || 0) + 1;
      if (atual.tentativas >= CFG.MAX_TENTATIVAS) {
        atual.bloqueadoAte = agora + CFG.BLOQUEIO_MS;
        atual.tentativas = 0;
      }
      atualizar('Usuarios', atual._linha, atual);
      throw generico;
    }
    atual.tentativas = 0;
    atual.bloqueadoAte = 0;
    if (novoHash && atual.hashSenha === u.hashSenha) atual.hashSenha = novoHash;
    atualizar('Usuarios', atual._linha, atual);
    limparSessoesExpiradas(agora);
    var token = criarSessaoInterna(atual.id, agora);
    return { token: token, usuario: usuarioPublico(atual) };
  });
}

function logout(d) {
  if (typeof d.token !== 'string') return { saiu: true };
  var th = sha256Hex('sessao|' + d.token);
  return comLock(function () {
    var s = lerTabela('Sessoes').filter(function (x) { return x.tokenHash === th; })[0];
    if (s) removerLinha('Sessoes', s._linha);
    return { saiu: true };
  });
}



// ======================= backend/src/05_api.js =======================
// ===== API HTTP (doGet/doPost) =====
var ACOES = {
  'cadastrar':             { nivel: 'publico', fn: function (d) { return cadastrar(d); } },
  'login':                 { nivel: 'publico', fn: function (d) { return login(d); } },
  'logout':                { nivel: 'publico', fn: function (d) { return logout(d); } },
  'publico.config':        { nivel: 'publico', fn: function () { return configPublica(); } },
  'publico.contagem':      { nivel: 'publico', fn: function () { return lerContagem(); } },
  'publico.produtos':      { nivel: 'publico', fn: function () { return produtosPublicos(); } },
  'imagem.obter':          { nivel: 'publico', fn: function (d) { return obterImagem(d); } },
  // nivel 'ads' = administrador principal ou administrador de propagandas
  'eu':                    { nivel: 'ads',     fn: function (d, u) { return usuarioPublico(u); } },
  'admin.config.obter':    { nivel: 'ads',     fn: function () { return configParaAdmin(); } },
  'admin.config.salvar':   { nivel: 'ads',     fn: function (d) { return salvarConfig(d); } },
  'admin.imagem.enviar':   { nivel: 'ads',     fn: function (d, u) { exigirUsoSlot(u, d.uso); return enviarImagem(d); } },
  'admin.imagem.remover':  { nivel: 'ads',     fn: function (d, u) { exigirUsoSlot(u, d.uso); return removerImagemUso(d); } },
  'admin.contagem.salvar': { nivel: 'ads',     fn: function (d) { return salvarContagem(d); } },
  'admin.banners.atualizar': { nivel: 'ads',   fn: function (d) { return atualizarBanner(d); } },
  'admin.banners.mover':   { nivel: 'ads',     fn: function (d) { return moverBanner(d); } },
  'admin.banners.remover': { nivel: 'ads',     fn: function (d) { return removerBanner(d); } },
  // apenas o administrador principal
  'admin.produtos.listar': { nivel: 'admin',   fn: function () { return listarProdutosAdmin(); } },
  'admin.produtos.salvar': { nivel: 'admin',   fn: function (d) { return salvarProduto(d); } },
  'admin.produtos.excluir': { nivel: 'admin',  fn: function (d) { return excluirProduto(d); } },
  'admin.produtos.mover':  { nivel: 'admin',   fn: function (d) { return moverProduto(d); } },
  'admin.produtos.fotoEnviar': { nivel: 'admin', fn: function (d) { return enviarFotoProduto(d); } },
  'admin.produtos.fotoLink': { nivel: 'admin', fn: function (d) { return adicionarFotoLinkProduto(d); } },
  'admin.produtos.fotoRemover': { nivel: 'admin', fn: function (d) { return removerFotoProduto(d); } },
  'admin.usuarios.listar': { nivel: 'admin',   fn: function () { return listarUsuarios(); } },
  'admin.usuarios.redefinir': { nivel: 'admin', fn: function (d, u) { return redefinirUsuario(u, d); } },
  'admin.convites.criar':  { nivel: 'admin',   fn: function (d, u) { return criarConvite(u, d); } },
  'admin.convites.listar': { nivel: 'admin',   fn: function () { return listarConvites(); } },
  'admin.convites.revogar': { nivel: 'admin',  fn: function (d) { return revogarConvite(d); } }
};

function despachar(corpo) {
  try {
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw erroNegocio('Requisição inválida.');
    var def = Object.prototype.hasOwnProperty.call(ACOES, corpo.acao) ? ACOES[corpo.acao] : null;
    if (!def) throw erroNegocio('Ação desconhecida.');
    var usuario = null;
    if (def.nivel === 'usuario') usuario = autenticar(corpo.token);
    if (def.nivel === 'admin') usuario = exigirAdmin(corpo.token);
    if (def.nivel === 'ads') usuario = exigirAdminOuPublicidade(corpo.token);
    return { ok: true, dados: def.fn(corpo, usuario), agora: RELOGIO.agora() };
  } catch (err) {
    if (err && err.negocio) return { ok: false, erro: err.message };
    console.error('Erro interno: ' + (err && err.stack ? err.stack : err));
    return { ok: false, erro: 'Erro interno. Tente novamente.' };
  }
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var corpo = null;
  try {
    corpo = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder({ ok: false, erro: 'Requisição inválida.' });
  }
  return responder(despachar(corpo));
}

var VERSAO_API = 'L1';

/** Abrir a URL /exec no navegador mostra a versão do código que está realmente publicada. */
function doGet() {
  return responder({ ok: true, servico: 'loja-api', versao: VERSAO_API });
}



// ======================= backend/src/06_setup.js =======================
// ===== Funções para rodar manualmente no editor do Apps Script =====

/** Passo 1: cria as abas e guarda o ID da planilha. Pode ser executada de novo sem perder dados. */
function configurar() {
  var ss = SpreadsheetApp.getActive();
  props().setProperty('PLANILHA_ID', ss.getId());
  var nomes = Object.keys(CFG.ABAS);
  for (var i = 0; i < nomes.length; i++) {
    var nome = nomes[i];
    var cols = CFG.ABAS[nome];
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  Logger.log('Configuração concluída. Abas: ' + nomes.join(', '));
}

/** Alternativa por convite: gera o código do primeiro administrador (aparece no registro de execução). */
function primeiroAdmin() {
  var admins = lerTabela('Usuarios').filter(function (u) { return u.papel === 'admin'; });
  if (admins.length > 0) {
    Logger.log('Já existe um administrador cadastrado. Nada foi criado.');
    return;
  }
  var conv = comLock(function () { return criarConviteInterno('admin', 'sistema', CFG.CONVITE_HORAS_PADRAO); });
  Logger.log('CÓDIGO DO PRIMEIRO ADMINISTRADOR (uso único, válido por ' + CFG.CONVITE_HORAS_PADRAO + 'h): ' + conv.codigo);
}

/** Passo 3: confere no seu ambiente real o que a simulação local não consegue provar. */
function testeRapido() {
  var falhas = [];
  var ss = planilha();

  // 1) Textos que o Planilhas costuma converter precisam voltar iguais (usa a mesma codificação do sistema).
  var amostras = ['12e4', '0123', '1-2-3', 'TRUE', '1,5', '12:30', '31/12/2026', '1/2', '=1+1', '2003', 'Maria Silva'];
  var tmp = ss.getSheetByName('_teste') || ss.insertSheet('_teste');
  try {
    tmp.clear();
    var linhaA = amostras.map(codificarTexto);
    linhaA.push(1700000000000);
    tmp.appendRow(linhaA);                                              // gravação por appendRow
    tmp.getRange(2, 1, 1, linhaA.length).setValues([linhaA]);           // gravação por setValues
    var lidas = tmp.getRange(1, 1, 2, linhaA.length).getValues();
    for (var r = 0; r < 2; r++) {
      for (var i = 0; i < amostras.length; i++) {
        var volta = decodificarTexto(lidas[r][i]);
        if (volta !== amostras[i]) falhas.push('linha ' + (r + 1) + ': "' + amostras[i] + '" voltou como "' + volta + '"');
      }
      if (Number(lidas[r][amostras.length]) !== 1700000000000) falhas.push('número grande voltou como ' + lidas[r][amostras.length]);
    }
  } finally {
    ss.deleteSheet(tmp);
  }

  // 1b) Células grandes (as imagens ficam na planilha em partes de 30 mil caracteres) precisam voltar inteiras.
  var tmp2 = ss.getSheetByName('_teste2') || ss.insertSheet('_teste2');
  try {
    tmp2.clear();
    var parte = 'iVBORw0KGgo' + new Array(CFG.IMG_PARTE - 10).join('A');
    var celula = codificarTexto(parte);
    tmp2.getRange(1, 1, 3, 2).setValues([[celula, 1], [celula, 2], [celula, 3]]);
    var volta2 = tmp2.getRange(1, 1, 3, 2).getValues();
    for (var q = 0; q < 3; q++) {
      if (decodificarTexto(volta2[q][0]) !== parte) falhas.push('célula grande voltou diferente (' + String(volta2[q][0]).length + ' caracteres)');
      if (Number(volta2[q][1]) !== q + 1) falhas.push('número ao lado da célula grande voltou como ' + volta2[q][1]);
    }
  } finally {
    ss.deleteSheet(tmp2);
  }

  // 2) Velocidade do hash de senha.
  var iter = iteracoesHash();
  var t0 = Date.now();
  var reg = hashSenha('senha-de-teste', iter);
  var ms = Date.now() - t0;
  if (!verificarSenha('senha-de-teste', reg)) falhas.push('verificação de senha falhou');
  if (verificarSenha('outra-senha', reg)) falhas.push('senha errada foi aceita');
  Logger.log('Hash de senha: ' + iter + ' iterações em ' + ms + ' ms.');
  if (ms > 3000) falhas.push('hash lento demais (' + ms + ' ms): reduza HASH_ITER nas Propriedades do Script');

  // 3) Lock.
  try {
    comLock(function () { return true; });
  } catch (e) {
    falhas.push('LockService: ' + e);
  }

  if (falhas.length === 0) Logger.log('TESTE RÁPIDO: TUDO OK.');
  else Logger.log('TESTE RÁPIDO: FALHOU -> ' + falhas.join(' | '));
}



// ======================= backend/src/08_config.js =======================
// ===== Configurações: banner do topo, carrossel e espaços de propaganda =====
function lerConfig() {
  var o = {};
  lerTabela('Config').forEach(function (r) { o[r.chave] = r.valor; });
  return o;
}

/** Chamar dentro de comLock. */
function gravarConfig(pares) {
  var t = lerTabela('Config');
  Object.keys(pares).forEach(function (k) {
    var ex = t.filter(function (r) { return r.chave === k; })[0];
    if (ex) { ex.valor = String(pares[k]); atualizar('Config', ex._linha, ex); }
    else inserir('Config', { chave: k, valor: String(pares[k]) });
  });
}

function segundosCarrossel(c) {
  var n = Number(c['carrossel.segundos']);
  return (n >= 2 && n <= 30) ? n : 6;
}

function validarLink(l) {
  l = String(l === undefined || l === null ? '' : l).trim();
  if (l === '') return '';
  if (!/^https:\/\/[^\s]+$/i.test(l) || l.length > 300) throw erroNegocio('O link deve começar com https:// e não ter espaços.');
  return l;
}

// Espaços de propaganda do site (o banner do topo e o carrossel têm telas próprias).
var SLOT_NOMES = ['navbar', 'lateral', 'rodape', 'cabecalho', 'menu', 'meio', 'lateral_esq'];
var SLOT_TIPOS = ['', 'imagem', 'codigo'];
var SLOT_CODIGO_MAX = 6000;

function lerSlots(c, publico) {
  var out = {};
  SLOT_NOMES.forEach(function (n) {
    var p = 'slot.' + n + '.';
    var tipo = SLOT_TIPOS.indexOf(c[p + 'tipo']) === -1 ? '' : (c[p + 'tipo'] || '');
    var s = { tipo: tipo, imagemId: c[p + 'imagemId'] || '', link: c[p + 'link'] || '', codigo: c[p + 'codigo'] || '' };
    if (publico) {
      // o público só recebe o que está em uso
      s = { tipo: tipo, imagemId: tipo === 'imagem' ? s.imagemId : '', link: tipo === 'imagem' ? s.link : '', codigo: tipo === 'codigo' ? s.codigo : '' };
    }
    out[n] = s;
  });
  return out;
}

function listarBanners(soAtivos) {
  return lerTabela('Banners')
    .filter(function (b) { return !soAtivos || b.ativo === 1; })
    .sort(function (a, b) { return a.ordem - b.ordem; })
    .map(function (b) { return { id: b.id, imagemId: b.imagemId, titulo: b.titulo, link: b.link, ativo: b.ativo === 1, ordem: b.ordem }; });
}

function configParaAdmin() {
  var c = lerConfig();
  return {
    topo: { imagemId: c['topo.imagemId'] || '', link: c['topo.link'] || '' },
    carrossel: { segundos: segundosCarrossel(c) },
    slots: lerSlots(c, false),
    banners: listarBanners(false)
  };
}

/** Só o que o público pode ver. */
function configPublica() {
  var c = lerConfig();
  return {
    topo: { imagemId: c['topo.imagemId'] || '', link: c['topo.link'] || '' },
    carrossel: { segundos: segundosCarrossel(c) },
    slots: lerSlots(c, true),
    banners: listarBanners(true).map(function (b) { return { id: b.id, imagemId: b.imagemId, titulo: b.titulo, link: b.link }; })
  };
}

function salvarConfig(d) {
  return comLock(function () {
    var pares = {};
    if (d.topo !== undefined) pares['topo.link'] = validarLink((d.topo || {}).link);
    if (d.carrossel !== undefined) {
      var cr = d.carrossel || {};
      if (cr.segundos !== undefined) {
        if (!Number.isInteger(cr.segundos) || cr.segundos < 2 || cr.segundos > 30) throw erroNegocio('A velocidade deve ser de 2 a 30 segundos por banner.');
        pares['carrossel.segundos'] = cr.segundos;
      }
    }
    if (d.slots !== undefined) {
      var sl = d.slots || {};
      SLOT_NOMES.forEach(function (n) {
        if (sl[n] === undefined) return;
        var s = sl[n] || {};
        var p = 'slot.' + n + '.';
        if (s.tipo !== undefined) {
          if (SLOT_TIPOS.indexOf(s.tipo) === -1) throw erroNegocio('Tipo de propaganda inválido.');
          pares[p + 'tipo'] = s.tipo;
        }
        if (s.link !== undefined) pares[p + 'link'] = validarLink(s.link);
        if (s.codigo !== undefined) {
          var cod = String(s.codigo === null ? '' : s.codigo).replace(/\r\n/g, '\n');
          if (cod.length > SLOT_CODIGO_MAX) throw erroNegocio('O código da propaganda passa de ' + SLOT_CODIGO_MAX + ' caracteres.');
          pares[p + 'codigo'] = cod;
        }
      });
    }
    gravarConfig(pares);
    return configParaAdmin();
  });
}



// ======================= backend/src/09_imagens.js =======================
// ===== Imagens (guardadas na planilha, em partes) e banners =====
var ASSINATURAS_IMG = { 'image/png': 'iVBORw0KGgo', 'image/jpeg': '/9j/', 'image/webp': 'UklGR' };

function validarDataUrl(dataUrl) {
  var m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+\/]+={0,2})$/.exec(String(dataUrl === undefined || dataUrl === null ? '' : dataUrl));
  if (!m) throw erroNegocio('Imagem inválida. Envie PNG, JPEG ou WEBP.');
  if (m[2].length > CFG.IMG_MAX_B64) throw erroNegocio('Imagem grande demais. Use uma imagem menor.');
  if (m[2].indexOf(ASSINATURAS_IMG[m[1]]) !== 0) throw erroNegocio('O arquivo não parece ser uma imagem válida.');
  return { tipo: m[1], b64: m[2] };
}

/** Chamar dentro de comLock. Grava a imagem em linhas consecutivas e devolve o id. */
function salvarImagemInterna(v, agora) {
  var id = novoId();
  var linhas = [];
  for (var i = 0, parte = 0; i < v.b64.length; i += CFG.IMG_PARTE, parte++) {
    linhas.push(linhaDe('Imagens', { id: id, parte: parte, tipo: v.tipo, dados: v.b64.substring(i, i + CFG.IMG_PARTE), criadoEm: agora }));
  }
  var sh = aba('Imagens');
  sh.getRange(sh.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
  return id;
}

/** Linhas (números) onde a imagem está, lendo só a coluna do id. */
function linhasDaImagem(id) {
  var sh = aba('Imagens');
  var ult = sh.getLastRow();
  var out = [];
  if (ult < 2) return out;
  var ids = sh.getRange(2, 1, ult - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (decodificarTexto(ids[i][0]) === id) out.push(i + 2);
  return out;
}

function lerImagemDataUrl(id) {
  var linhas = linhasDaImagem(id);
  if (linhas.length === 0) return null;
  var sh = aba('Imagens');
  var ini = linhas[0];
  var fim = linhas[linhas.length - 1];
  var vals = sh.getRange(ini, 1, fim - ini + 1, CFG.ABAS.Imagens.length).getValues()
    .filter(function (r) { return decodificarTexto(r[0]) === id; })
    .sort(function (a, b) { return Number(a[1]) - Number(b[1]); });
  var tipo = decodificarTexto(vals[0][2]);
  var b64 = vals.map(function (r) { return decodificarTexto(r[3]); }).join('');
  return 'data:' + tipo + ';base64,' + b64;
}

function removerImagemInterna(id) {
  if (!id) return;
  var linhas = linhasDaImagem(id);
  for (var i = linhas.length - 1; i >= 0; i--) removerLinha('Imagens', linhas[i]);
}

// Onde cada "uso" de imagem fica guardado na Config.
var USOS_IMG_CONFIG = { topo: 'topo.imagemId' };
SLOT_NOMES.forEach(function (n) { USOS_IMG_CONFIG['slot_' + n] = 'slot.' + n + '.imagemId'; });

function idsImagensPermitidas() {
  var c = lerConfig();
  var ids = [c['topo.imagemId']];
  SLOT_NOMES.forEach(function (n) { ids.push(c['slot.' + n + '.imagemId']); });
  lerTabela('Banners').forEach(function (b) { ids.push(b.imagemId); });
  lerTabela('Produtos').forEach(function (p) { fotosEnviadas(p).forEach(function (f) { ids.push(f); }); });
  return ids.filter(function (x) { return !!x; });
}

/** Todas as imagens do site são públicas (banners, propagandas e fotos dos produtos). */
function obterImagem(d) {
  var naoAchou = erroNegocio('Imagem não encontrada.');
  if (typeof d.id !== 'string' || d.id.length > 60) throw naoAchou;
  if (idsImagensPermitidas().indexOf(d.id) === -1) throw naoAchou;
  var url = lerImagemDataUrl(d.id);
  if (!url) throw naoAchou;
  return { dataUrl: url };
}

function enviarImagem(d) {
  return comLock(function () {
    var agora = RELOGIO.agora();
    var uso = d.uso;
    if (uso !== 'banner' && !Object.prototype.hasOwnProperty.call(USOS_IMG_CONFIG, uso)) throw erroNegocio('Uso da imagem inválido.');
    var titulo = limparTexto(d.titulo, 80);
    var link = validarLink(d.link);
    var banners = lerTabela('Banners');
    if (uso === 'banner' && banners.length >= CFG.MAX_BANNERS) throw erroNegocio('Limite de ' + CFG.MAX_BANNERS + ' banners. Remova algum antes de adicionar.');
    var v = validarDataUrl(d.dataUrl);
    var id = salvarImagemInterna(v, agora);
    var c = lerConfig();

    if (uso !== 'banner') {
      var chave = USOS_IMG_CONFIG[uso];
      var antiga = c[chave];
      var pares = {};
      pares[chave] = id;
      if (uso.indexOf('slot_') === 0) { // enviar a imagem liga o espaço em modo imagem e guarda o link
        pares['slot.' + uso.substring(5) + '.tipo'] = 'imagem';
        if (d.link !== undefined) pares['slot.' + uso.substring(5) + '.link'] = link;
      }
      gravarConfig(pares);
      if (antiga) removerImagemInterna(antiga);
      return configParaAdmin();
    }
    var ordem = banners.reduce(function (m, b) { return Math.max(m, b.ordem || 0); }, 0) + 1;
    inserir('Banners', { id: novoId(), imagemId: id, titulo: titulo, link: link, ativo: 1, ordem: ordem, criadoEm: agora });
    return configParaAdmin();
  });
}

function removerImagemUso(d) {
  return comLock(function () {
    if (!Object.prototype.hasOwnProperty.call(USOS_IMG_CONFIG, d.uso)) throw erroNegocio('Uso da imagem inválido.');
    var chave = USOS_IMG_CONFIG[d.uso];
    var antiga = lerConfig()[chave];
    var pares = {};
    pares[chave] = '';
    gravarConfig(pares);
    removerImagemInterna(antiga);
    return configParaAdmin();
  });
}

function achaBanner(id) {
  var b = lerTabela('Banners').filter(function (x) { return x.id === id; })[0];
  if (!b) throw erroNegocio('Banner não encontrado.');
  return b;
}

function atualizarBanner(d) {
  return comLock(function () {
    var b = achaBanner(d.id);
    if (d.titulo !== undefined) b.titulo = limparTexto(d.titulo, 80);
    if (d.link !== undefined) b.link = validarLink(d.link);
    if (d.ativo !== undefined) b.ativo = d.ativo ? 1 : 0;
    atualizar('Banners', b._linha, b);
    return configParaAdmin();
  });
}

function moverBanner(d) {
  return comLock(function () {
    if (d.direcao !== 'cima' && d.direcao !== 'baixo') throw erroNegocio('Direção inválida.');
    var todos = lerTabela('Banners').sort(function (a, b) { return a.ordem - b.ordem; });
    var i = todos.map(function (x) { return x.id; }).indexOf(d.id);
    if (i === -1) throw erroNegocio('Banner não encontrado.');
    var j = d.direcao === 'cima' ? i - 1 : i + 1;
    if (j >= 0 && j < todos.length) {
      var oi = todos[i].ordem;
      todos[i].ordem = todos[j].ordem;
      todos[j].ordem = oi;
      atualizar('Banners', todos[i]._linha, todos[i]);
      atualizar('Banners', todos[j]._linha, todos[j]);
    }
    return configParaAdmin();
  });
}

function removerBanner(d) {
  return comLock(function () {
    var b = achaBanner(d.id);
    removerLinha('Banners', b._linha);
    removerImagemInterna(b.imagemId);
    return configParaAdmin();
  });
}



// ======================= Produtos da loja =======================
// ===== Produtos: nome, preço, texto, fotos (envio ou link), vídeo (YouTube ou link .mp4), código de incorporação e link de compra =====
// Cada foto é o id de uma imagem enviada OU um link https (por exemplo, de uma imagem do AliExpress). Ficam separadas por quebra de linha.

function fotosDe(p) {
  return String(p.fotos || '').split(/\s+/).filter(function (x) { return !!x; });
}

function ehLinkFoto(f) { return /^https:\/\//i.test(f); }

/** Só as fotos que estão guardadas na planilha (as de link não ocupam espaço aqui). */
function fotosEnviadas(p) { return fotosDe(p).filter(function (f) { return !ehLinkFoto(f); }); }

function produtoParaSaida(p) {
  return {
    id: p.id, nome: p.nome, precoCentavos: p.precoCentavos, precoOriginalCentavos: p.precoOriginalCentavos === '' ? 0 : p.precoOriginalCentavos,
    descricao: p.descricao, categoria: p.categoria, fotos: fotosDe(p), video: p.video, videoId: videoIdDe(p.video), videoUrl: videoArquivoDe(p.video),
    codigo: p.codigo, linkCompra: p.linkCompra,
    destaque: p.destaque === 1, ativo: p.ativo === 1, ordem: p.ordem
  };
}

function produtosOrdenados() {
  return lerTabela('Produtos').sort(function (a, b) { return a.ordem - b.ordem; });
}

function listarProdutosAdmin() {
  return { produtos: produtosOrdenados().map(produtoParaSaida) };
}

/** O que a vitrine mostra: só produtos visíveis, sem nenhum dado interno. */
function produtosPublicos() {
  var lista = produtosOrdenados().filter(function (p) { return p.ativo === 1; }).map(function (p) {
    var s = produtoParaSaida(p);
    return { id: s.id, nome: s.nome, precoCentavos: s.precoCentavos, precoOriginalCentavos: s.precoOriginalCentavos, descricao: s.descricao,
      categoria: s.categoria, fotos: s.fotos, videoId: s.videoId, videoUrl: s.videoUrl, codigo: s.codigo, linkCompra: s.linkCompra, destaque: s.destaque };
  });
  return { produtos: lista };
}

/**
 * Aceita um link do YouTube (watch, youtu.be, shorts, embed) ou o link direto de um arquivo de vídeo (.mp4, .webm, .ogg),
 * como os vídeos do AliExpress. Guarda o código do YouTube ou o link do arquivo. Vazio apaga o vídeo.
 */
function normalizarVideo(v) {
  var t = String(v === undefined || v === null ? '' : v).trim();
  if (t === '') return '';
  var m = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#\/][^\s]*)?$/i.exec(t);
  if (m) return m[1];
  if (t.length <= 600 && /^https:\/\/[^\s\/]+\/[^\s?#]*\.(?:mp4|webm|ogg)(?:[?#][^\s]*)?$/i.test(t)) return t;
  throw erroNegocio('Vídeo inválido. Use um link do YouTube ou o link direto de um arquivo .mp4 (começa com https://).');
}

function videoIdDe(v) { return /^[A-Za-z0-9_-]{11}$/.test(String(v || '')) ? v : ''; }
function videoArquivoDe(v) { return /^https:\/\//i.test(String(v || '')) ? v : ''; }

/** Código de incorporação (script ou HTML) de um parceiro, como um widget do AliExpress. Roda isolado no navegador. */
function limparCodigoProduto(t) {
  var c = String(t === undefined || t === null ? '' : t).replace(/\r\n/g, '\n');
  if (c.length > SLOT_CODIGO_MAX) throw erroNegocio('O código passa de ' + SLOT_CODIGO_MAX + ' caracteres.');
  return c.trim();
}

function validarLinkFoto(u) {
  var t = String(u === undefined || u === null ? '' : u).trim();
  if (!/^https:\/\/[^\s]+$/i.test(t) || t.length > 500) throw erroNegocio('O link da foto deve começar com https:// e não ter espaços (máximo de 500 caracteres).');
  return t;
}

/** Texto livre escrito pelo administrador: mantém as quebras de linha, tira caracteres de controle. */
function limparDescricao(t) {
  return String(t === undefined || t === null ? '' : t)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 3000);
}

function inteiroOuErro(v, msg, min, max) {
  var n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw erroNegocio(msg);
  return n;
}

function achaProduto(id) {
  var p = lerTabela('Produtos').filter(function (x) { return x.id === id; })[0];
  if (!p) throw erroNegocio('Produto não encontrado.');
  return p;
}

/** Cria (sem id) ou edita (com id) um produto. O formulário manda todos os campos de uma vez. */
function salvarProduto(d) {
  var nome = limparTexto(d.nome, 100);
  if (nome.length < 2) throw erroNegocio('Informe o nome do produto (mínimo 2 caracteres).');
  var preco = inteiroOuErro(d.precoCentavos, 'Informe um preço válido.', 1, 99999999);
  var original = 0;
  if (d.precoOriginalCentavos !== undefined && d.precoOriginalCentavos !== null && d.precoOriginalCentavos !== '' && Number(d.precoOriginalCentavos) !== 0) {
    original = inteiroOuErro(d.precoOriginalCentavos, 'O preço "de" é inválido.', 1, 99999999);
    if (original <= preco) throw erroNegocio('O preço "de" precisa ser maior que o preço de venda.');
  }
  var categoria = limparTexto(d.categoria, 40);
  var descricao = limparDescricao(d.descricao);
  var link = validarLink(d.linkCompra);
  var video = normalizarVideo(d.video);
  var codigo = limparCodigoProduto(d.codigo);
  var destaque = d.destaque ? 1 : 0;
  var ativo = d.ativo === false ? 0 : 1;

  return comLock(function () {
    var agora = RELOGIO.agora();
    var todos = lerTabela('Produtos');
    var id;
    if (d.id) {
      var p = todos.filter(function (x) { return x.id === d.id; })[0];
      if (!p) throw erroNegocio('Produto não encontrado.');
      p.nome = nome; p.precoCentavos = preco; p.precoOriginalCentavos = original; p.descricao = descricao; p.categoria = categoria;
      p.video = video; p.codigo = codigo; p.linkCompra = link; p.destaque = destaque; p.ativo = ativo; p.atualizadoEm = agora;
      atualizar('Produtos', p._linha, p);
      id = p.id;
    } else {
      if (todos.length >= CFG.MAX_PRODUTOS) throw erroNegocio('Limite de ' + CFG.MAX_PRODUTOS + ' produtos. Exclua algum antes de adicionar.');
      id = novoId();
      var ordem = todos.reduce(function (m, x) { return Math.max(m, x.ordem || 0); }, 0) + 1;
      inserir('Produtos', {
        id: id, nome: nome, precoCentavos: preco, precoOriginalCentavos: original, descricao: descricao, categoria: categoria, fotos: '',
        video: video, codigo: codigo, linkCompra: link, destaque: destaque, ativo: ativo, ordem: ordem, criadoEm: agora, atualizadoEm: agora
      });
    }
    var saida = listarProdutosAdmin();
    saida.id = id;
    return saida;
  });
}

function excluirProduto(d) {
  return comLock(function () {
    var p = achaProduto(d.id);
    fotosEnviadas(p).forEach(function (f) { removerImagemInterna(f); });
    removerLinha('Produtos', p._linha);
    return listarProdutosAdmin();
  });
}

function moverProduto(d) {
  return comLock(function () {
    if (d.direcao !== 'cima' && d.direcao !== 'baixo') throw erroNegocio('Direção inválida.');
    var todos = produtosOrdenados();
    var i = todos.map(function (x) { return x.id; }).indexOf(d.id);
    if (i === -1) throw erroNegocio('Produto não encontrado.');
    var j = d.direcao === 'cima' ? i - 1 : i + 1;
    if (j >= 0 && j < todos.length) {
      var oi = todos[i].ordem;
      todos[i].ordem = todos[j].ordem;
      todos[j].ordem = oi;
      atualizar('Produtos', todos[i]._linha, todos[i]);
      atualizar('Produtos', todos[j]._linha, todos[j]);
    }
    return listarProdutosAdmin();
  });
}

function enviarFotoProduto(d) {
  return comLock(function () {
    var p = achaProduto(d.produtoId);
    var fotos = fotosDe(p);
    if (fotos.length >= CFG.MAX_FOTOS) throw erroNegocio('Cada produto aceita até ' + CFG.MAX_FOTOS + ' fotos. Remova uma antes de adicionar outra.');
    var v = validarDataUrl(d.dataUrl);
    var id = salvarImagemInterna(v, RELOGIO.agora());
    fotos.push(id);
    p.fotos = fotos.join('\n');
    p.atualizadoEm = RELOGIO.agora();
    atualizar('Produtos', p._linha, p);
    return listarProdutosAdmin();
  });
}

/** Foto por link (por exemplo, a imagem do anúncio no AliExpress): nada é guardado na planilha, só o endereço. */
function adicionarFotoLinkProduto(d) {
  var url = validarLinkFoto(d.url);
  return comLock(function () {
    var p = achaProduto(d.produtoId);
    var fotos = fotosDe(p);
    if (fotos.length >= CFG.MAX_FOTOS) throw erroNegocio('Cada produto aceita até ' + CFG.MAX_FOTOS + ' fotos. Remova uma antes de adicionar outra.');
    if (fotos.indexOf(url) !== -1) throw erroNegocio('Esta foto já está no produto.');
    fotos.push(url);
    p.fotos = fotos.join('\n');
    p.atualizadoEm = RELOGIO.agora();
    atualizar('Produtos', p._linha, p);
    return listarProdutosAdmin();
  });
}

/** Remove uma foto: pelo id (enviada) ou pelo endereço (link). */
function removerFotoProduto(d) {
  return comLock(function () {
    var p = achaProduto(d.produtoId);
    var fotos = fotosDe(p);
    var i = fotos.indexOf(d.imagemId);
    if (i === -1) throw erroNegocio('Foto não encontrada neste produto.');
    fotos.splice(i, 1);
    p.fotos = fotos.join('\n');
    p.atualizadoEm = RELOGIO.agora();
    atualizar('Produtos', p._linha, p);
    if (!ehLinkFoto(d.imagemId)) removerImagemInterna(d.imagemId);
    return listarProdutosAdmin();
  });
}


// ======================= backend/src/14_publicidade_contagem_usuarios.js =======================
// ===== Relógio de ofertas, usuários e preparação da planilha =====

function exigirUsoSlot(u, uso) {
  if (u && u.papel === 'publicidade' && !/^(slot_[a-z_]+|topo|banner)$/.test(String(uso))) {
    throw erroNegocio('Sem permissão para este tipo de imagem.');
  }
}

// ----- relógio de contagem regressiva -----
var CONTAGEM_PADRAO = { titulo: 'OFERTAS RELÂMPAGO: TERMINA EM', data: '2026-12-31T23:59:00-03:00' };

function lerContagem() {
  var c = lerConfig();
  var configurado = !!c['contagem.data'];
  return {
    configurado: configurado,
    ativo: c['contagem.ativo'] !== '0',
    titulo: configurado ? (c['contagem.titulo'] || CONTAGEM_PADRAO.titulo) : CONTAGEM_PADRAO.titulo,
    data: configurado ? c['contagem.data'] : CONTAGEM_PADRAO.data
  };
}

/** A data é sempre gravada no horário de Brasília (-03:00). */
function salvarContagem(d) {
  return comLock(function () {
    var titulo = limparTexto(d.titulo, 80);
    if (!titulo) throw erroNegocio('Informe o título do relógio.');
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(d.dataLocal === undefined || d.dataLocal === null ? '' : d.dataLocal));
    if (!m) throw erroNegocio('Informe a data e a hora do sorteio.');
    var ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]), hora = Number(m[4]), min = Number(m[5]);
    var t = new Date(Date.UTC(ano, mes - 1, dia, hora, min));
    if (t.getUTCFullYear() !== ano || t.getUTCMonth() !== mes - 1 || t.getUTCDate() !== dia || hora > 23 || min > 59) {
      throw erroNegocio('Data ou hora inválida.');
    }
    gravarConfig({ 'contagem.ativo': d.ativo === false ? '0' : '1', 'contagem.titulo': titulo, 'contagem.data': m[0] + ':00-03:00' });
    return lerContagem();
  });
}

// ----- aba Usuários (administrador principal) -----
function listarUsuarios() {
  return lerTabela('Usuarios').map(function (u) {
    return { id: u.id, usuario: u.usuario, nome: u.nome, papel: u.papel, status: u.status };
  });
}

function redefinirUsuario(admin, d) {
  var usuario = normalizarUsuario(d.usuario);
  validarUsuario(usuario);
  validarSenha(d.senha, usuario);
  var registro = hashSenha(d.senha, iteracoesHash()); // custo alto: fora do lock
  return comLock(function () {
    var todos = lerTabela('Usuarios');
    var alvo = todos.filter(function (x) { return x.id === d.id; })[0];
    if (!alvo) throw erroNegocio('Conta não encontrada.');
    if (alvo.id === admin.id) throw erroNegocio('Para a sua própria conta, peça a outro administrador.');
    if (todos.some(function (x) { return x.usuario === usuario && x.id !== alvo.id; })) throw erroNegocio('Este nome de usuário já está em uso.');
    alvo.usuario = usuario;
    alvo.hashSenha = registro;
    alvo.tentativas = 0;
    alvo.bloqueadoAte = 0;
    atualizar('Usuarios', alvo._linha, alvo);
    lerTabela('Sessoes').filter(function (s) { return s.userId === alvo.id; })
      .sort(function (a, b) { return b._linha - a._linha; })
      .forEach(function (s) { removerLinha('Sessoes', s._linha); });
    return { id: alvo.id, usuario: alvo.usuario };
  });
}

// ======================= Preparação da NOVA planilha e dos administradores =======================
// Rode estas funções manualmente, no editor do Apps Script, da conta Google (e-mail) que será a dona do sistema novo.

/**
 * Use SOMENTE se o script NÃO foi criado por Extensões > Apps Script dentro da planilha nova
 * (script avulso). Cole o ID da planilha (o trecho entre /d/ e /edit na URL) e execute.
 */
function configurarPlanilhaPorId() {
  var ID_DA_PLANILHA = 'COLE_AQUI_O_ID_DA_PLANILHA';
  if (ID_DA_PLANILHA.indexOf('COLE_AQUI') === 0) throw new Error('Edite ID_DA_PLANILHA antes de executar.');
  var ss = SpreadsheetApp.openById(ID_DA_PLANILHA);
  props().setProperty('PLANILHA_ID', ss.getId());
  PLANILHA_EM_CACHE = null;
  var nomes = Object.keys(CFG.ABAS);
  for (var i = 0; i < nomes.length; i++) {
    var cols = CFG.ABAS[nomes[i]];
    var sh = ss.getSheetByName(nomes[i]) || ss.insertSheet(nomes[i]);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  Logger.log('Planilha configurada: ' + ss.getName() + '. Abas: ' + nomes.join(', '));
}

/**
 * Cria os logins dos administradores direto na planilha (sem convite).
 * 1) Preencha usuario, nome e senha abaixo (a senha precisa de 8+ caracteres).
 * 2) Execute criarAdministradores().
 * 3) DEPOIS APAGUE AS SENHAS deste arquivo e salve de novo.
 * Quem já existe (mesmo usuário) é ignorado.
 */
var SETUP_ADMINISTRADORES = [
  { papel: 'admin',       usuario: '', nome: '', senha: '' },  // produtos, convites e usuários
  { papel: 'publicidade', usuario: '', nome: '', senha: '' }   // propagandas, banners e relógio de ofertas
];

function criarAdministradores() {
  var criados = [];
  SETUP_ADMINISTRADORES.forEach(function (a) {
    if (!a.usuario && !a.senha) return; // linha em branco: pula
    var usuario = normalizarUsuario(a.usuario);
    validarUsuario(usuario);
    var nome = limparTexto(a.nome, 60);
    if (nome.length < 2) throw erroNegocio('Informe o nome de ' + usuario + ' (mínimo 2 caracteres).');
    validarSenha(a.senha, usuario);
    var registro = hashSenha(a.senha, iteracoesHash());
    comLock(function () {
      if (lerTabela('Usuarios').some(function (u) { return u.usuario === usuario; })) {
        Logger.log('Já existe o usuário "' + usuario + '". Ignorado.');
        return;
      }
      inserir('Usuarios', {
        id: novoId(), usuario: usuario, nome: nome, hashSenha: registro, papel: a.papel, status: 'ativo',
        tentativas: 0, bloqueadoAte: 0, criadoEm: RELOGIO.agora(), conviteId: ''
      });
      criados.push(usuario + ' (' + a.papel + ')');
    });
  });
  Logger.log(criados.length ? 'Criados: ' + criados.join(', ') + '. AGORA APAGUE AS SENHAS DE SETUP_ADMINISTRADORES.' : 'Nenhum usuário novo criado.');
}

/** Alternativa por convite: gera o código de uso único do administrador de propagandas (aparece no registro de execução). */
function convitePropagandas() {
  var conv = comLock(function () { return criarConviteInterno('publicidade', 'sistema', CFG.CONVITE_HORAS_PADRAO); });
  Logger.log('CÓDIGO DO ADMINISTRADOR DE PROPAGANDAS (uso único, válido por ' + CFG.CONVITE_HORAS_PADRAO + 'h): ' + conv.codigo);
}

