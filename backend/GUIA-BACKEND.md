# Backend da loja (Google Apps Script) – passo a passo

Use uma **conta Google (e-mail) e uma planilha novas**, separadas do bolão.

## 1. Planilha e código
1. Entre com o e-mail da loja em https://sheets.google.com e crie uma planilha em branco ("Loja").
2. **Extensões > Apps Script**. Apague o que vier, cole **todo** o `Codigo.gs` e salve (Ctrl+S).

## 2. Criar as abas
Escolha a função `configurar` e clique em **Executar**. Autorize (Avançado > Acessar projeto (não seguro): é normal em script próprio).
Cria as abas Usuarios, Convites, Sessoes, Config, Banners, Imagens e Produtos.

## 3. Criar os dois administradores (só no editor do Google, nunca no arquivo do PC)
Procure `SETUP_ADMINISTRADORES` (Ctrl+F) e preencha:
```
{ papel: 'admin',       usuario: 'dono',  nome: 'Seu Nome', senha: 'SenhaForte123' },
{ papel: 'publicidade', usuario: 'ads',   nome: 'Nome Ads', senha: 'OutraSenha456' }
```
Usuário: 3 a 30 caracteres, minúsculas. Senha: mínimo 8. Salve, execute `criarAdministradores`.
**Depois apague as senhas do código (deixe `senha: ''`) e salve de novo.**

## 4. Testar e publicar
1. Execute `testeRapido`: deve terminar com "TESTE RÁPIDO: TUDO OK".
2. **Implantar > Nova implantação > App da Web**. Executar como: **Eu**. Quem tem acesso: **Qualquer pessoa**.
3. Copie a URL `/exec`. Abrindo no navegador deve aparecer `{"ok":true,"servico":"loja-api","versao":"L1"}`.
4. Cole a URL no `config.js` do site (troque `COLE_AQUI_A_URL_EXEC_DO_APPS_SCRIPT`).
Sempre que mudar o código: **Implantar > Gerenciar implantações > lápis > Nova versão > Implantar**.

## 5. Quem pode o quê
- `admin`: produtos (nome, preço, texto, fotos, vídeo, link de compra), convites, usuários e também propagandas.
- `publicidade`: banners, relógio de ofertas, banner do topo e espaços de propaganda. Não vê produtos nem usuários.

## 7. Administrador Supremo e recuperação de senha por e-mail (NOVO)

**Depois de colar o novo `Codigo.gs`:**

1. Execute `configurar` de novo (cria as abas `Recuperacoes` e `Registro` e a coluna `email`). Não apaga dados.
2. **Autorizar o envio de e-mail (uma vez):** escolha `autorizarEmail` no editor e clique em **Executar**. O Google pede permissão para enviar e-mails: aceite. Você recebe um e-mail de teste.
3. **Implantar > Gerenciar implantações > lápis > Versão: Nova versão > Implantar.** (Sem isso o site continua usando o código antigo.)

**Criar o Administrador Supremo** (ele edita, bloqueia, muda o papel e exclui qualquer conta):

- Conta nova: em `SETUP_ADMINISTRADORES`, preencha a linha `papel: 'supremo'` (usuário, nome, **e-mail**, senha de 8+ caracteres) e execute `criarAdministradores`. Depois APAGUE a senha do arquivo.
- Conta que já existe: escreva o usuário em `USUARIO_SUPREMO` e execute `tornarSupremo`. Depois apague o texto.

**Ativar o "Esqueci minha senha":** entre como administrador > aba *Usuários* (ou *Contas (Supremo)*) > "Recuperação de senha por e-mail": informe o endereço do site (ex.: `https://brcarregadores.github.io`) e clique em *Salvar endereço*. Use *Enviar e-mail de teste para mim* para conferir. Cada pessoa cadastra o próprio e-mail em *Minha conta*; o administrador pode cadastrar o e-mail de quem ainda não tem.

**Regras:**
- O link vale 30 minutos, funciona uma vez e ao usá-lo todas as sessões da conta são encerradas.
- Até 3 pedidos por hora por conta. Conta Google comum envia cerca de 100 e-mails por dia.
- O administrador comum não altera outro administrador nem o Supremo e só o Supremo convida administradores.
- O Supremo não pode excluir, bloquear nem rebaixar a própria conta (sempre sobra um Supremo). Contas com histórico (ex.: cotas no bolão) devem ser bloqueadas, não excluídas.
- A aba *Contas (Supremo)* tem o registro das últimas 100 alterações.
- Se trocar de domínio, mude o endereço do site no mesmo bloco.
