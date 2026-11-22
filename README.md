# BR Carregadores

Site de vendas estático (HTML/CSS/JS) com backend em Google Apps Script + Planilhas.

- `index.html`: vitrine pública (relógio de ofertas, banners, categorias, produtos, detalhes com fotos, vídeo e texto).
- `admin.html`: painel. **Administrador**: produtos, convites, usuários. **Propagandas**: banners, relógio de ofertas e espaços de propaganda.
- A compra é feita no site de pagamento: cada produto tem um botão "Comprar agora" para o link do Mercado Pago, PagSeguro, Shopee ou AliExpress.
- `backend/Codigo.gs` e `backend/GUIA-BACKEND.md`: o backend e como publicá-lo.
- `config.js`: URL do Apps Script (`API_URL`) e nome da loja (`NOME`).

Passo a passo: `backend/GUIA-BACKEND.md`, depois `COMANDOS.md`.

## Venda híbrida (3 tipos por produto)

Cada produto tem um **Tipo de venda** (aba Produtos do painel):

1. **Link (Mercado Livre)** – cole só o link do anúncio e clique em *Buscar informações do anúncio*.
2. **AliExpress (afiliado)** – cole o seu link de afiliado e clique em *Buscar informações*.
3. **Venda direta** – o cliente clica em *Comprar agora*, preenche os dados da entrega em mãos e começa um cronômetro de 12 horas. Na aba **Pedidos** você aprova ou recusa; ao aprovar, o QR Code do Pix aparece para o cliente. Depois de receber, clique em *Marcar como pago*.

### Atenção
- A busca automática é "melhor esforço": Mercado Livre/AliExpress podem bloquear. Se falhar, preencha à mão (o link fica guardado).
- As 12 horas são o prazo para **você** responder. A confirmação do Pix é manual (não há consulta ao banco).
- Configure Pix (chave, nome, cidade) na aba Pedidos; sem isso a venda direta fica desativada.
- Dados dos compradores (nome, telefone, local) são pessoais (LGPD): o cliente concorda por caixa de seleção; exclua pedidos antigos na aba Pedidos.

### Atualizar o Apps Script
1. Cole o novo `backend/Codigo.gs` (versão L3) no editor.
2. Execute `configurar`, depois `autorizarEmail` e `autorizarImportacao` (aceite as permissões).
3. Implantar > Gerenciar implantações > lápis > Versão: **Nova versão** > Implantar.
