# BR Carregadores

Site de vendas estático (HTML/CSS/JS) com backend em Google Apps Script + Planilhas.

- `index.html`: vitrine pública (relógio de ofertas, banners, categorias, produtos, detalhes com fotos, vídeo e texto).
- `admin.html`: painel. **Administrador**: produtos, convites, usuários. **Propagandas**: banners, relógio de ofertas e espaços de propaganda.
- A compra é feita no site de pagamento: cada produto tem um botão "Comprar agora" para o link do Mercado Pago, PagSeguro, Shopee ou AliExpress.
- `backend/Codigo.gs` e `backend/GUIA-BACKEND.md`: o backend e como publicá-lo.
- `config.js`: URL do Apps Script (`API_URL`) e nome da loja (`NOME`).

Passo a passo: `backend/GUIA-BACKEND.md`, depois `COMANDOS.md`.
