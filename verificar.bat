@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
set FALTA=0
for %%F in (index.html admin.html config.js netlify.toml backend\Codigo.gs css\estilo.css css\slots.css css\contagem.css css\loja.css js\util.js js\api.js js\ui.js js\imagens.js js\carrossel.js js\slots.js js\slots-extra.js js\contagem.js js\loja.js js\admin.js js\admin-produtos.js js\admin-propagandas.js js\admin-usuarios.js) do (
  if exist "%%F" ( echo OK     %%F ) else ( echo FALTA  %%F & set FALTA=1 )
)
echo.
findstr /c:"COLE_AQUI" config.js >nul && echo AVISO: config.js ainda tem COLE_AQUI. Troque pela URL /exec do Apps Script.
if "%FALTA%"=="0" ( echo ESTRUTURA OK ) else ( echo Ha arquivos faltando: copie-os para as pastas indicadas. )
pause
