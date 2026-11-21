# Comandos (CMD do Windows) – um por vez

## Enviar para o GitHub (repositório novo e vazio, sem README)
```
cd /d "CAMINHO\DA\PASTA\loja-pacote"
git init
git branch -M main
git add .
git commit -m "Loja: site completo"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```
Se der erro 403, o Windows guardou o login de outra conta do GitHub:
```
cmdkey /delete:git:https://github.com
git push -u origin main
```

## Atualizar depois de qualquer mudança
```
git add .
git commit -m "Atualizacao"
git push
```

## Netlify
app.netlify.com > Add new site > Import an existing project > GitHub > escolha o repositório.
Build command: vazio. Publish directory: `.` > Deploy.
Cada `git push` publica de novo sozinho.

## Endereços do site
- Loja (pública): `https://SEU-SITE.netlify.app/`
- Painel dos administradores: `https://SEU-SITE.netlify.app/admin.html`
