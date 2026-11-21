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
