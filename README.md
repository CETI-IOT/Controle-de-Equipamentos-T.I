# Controle de Equipamentos de TI

Aplicação web responsiva para registrar empréstimos e devoluções, manter um catálogo de equipamentos e consultar o histórico de cada item. Pode ser usada em modo local ou conectada a uma planilha Google por meio do Apps Script.

## Arquivos

- `index.html`: interface e lógica da aplicação.
- `google-apps-script.js`: API que lê e atualiza as abas da planilha.
- `manifest.json` e `sw.js`: instalação PWA e cache da aplicação.
- `src/tailwind.css`, `tailwind.config.cjs` e `assets/app.css`: compilação e estilos estáticos da interface.

## Executar localmente

Instale as dependências de desenvolvimento com `pnpm install` e gere os estilos com `pnpm build:css`. Depois, abra `index.html` em um navegador moderno. Para instalação PWA, câmera e Service Worker, publique os arquivos em um servidor HTTPS ou execute um servidor local; abrir o HTML diretamente como `file://` não habilita esses recursos.

Sem a URL de implantação do Apps Script, os registros ficam neste navegador. O armazenamento local não é compartilhado entre dispositivos e pode ser apagado pelo navegador.

## Publicar no GitHub Pages

O repositório inclui um workflow em `.github/workflows/pages.yml` que publica o site automaticamente quando há atualizações na branch `main`.

1. Envie os arquivos do projeto para um repositório GitHub na branch `main`.
2. No GitHub, abra **Settings > Pages** e selecione **GitHub Actions** como fonte de publicação.
3. Acompanhe a execução em **Actions**. Quando ela terminar, o endereço do site aparece no ambiente `github-pages` e em **Settings > Pages**.

O site publicado fica acessível pela internet. A URL pública do Apps Script é configurada como padrão no HTML para conectar automaticamente todos os visitantes. Como o navegador precisa receber essa URL, uma variável de ambiente do GitHub Actions não a tornaria secreta: o valor continuaria visível no HTML publicado. A URL dá acesso às operações expostas pelo Apps Script; mantenha a implantação pública somente se estiver autorizado a compartilhar esses dados e operações com qualquer visitante.

## Conectar ao Google Sheets

1. Crie uma planilha vazia no Google Sheets.
2. Em **Extensões > Apps Script**, cole o conteúdo de `google-apps-script.js` e salve.
3. Execute `setupPlanilhaCompleta` pelo editor para criar as abas e cabeçalhos. Autorize o script quando o Google solicitar.
4. Publique como **App da Web**, executando como sua conta, e defina o acesso conforme a política da sua organização.
5. O site já usa a URL `/exec` configurada como padrão. Se publicar uma implantação diferente, atualize `DEFAULT_GOOGLE_SCRIPT_URL` em `index.html`; a alteração se aplica a visitantes que ainda não tenham substituído a URL nas configurações locais.

> O acesso público ao App da Web pode expor dados da planilha a qualquer pessoa que obtenha a URL. Use apenas se isso for permitido pela política da organização e não armazene dados pessoais ou confidenciais sem controles adequados.

## Uso

Cadastre equipamentos no inventário. Para cada retirada, informe o código do item e o solicitante; para devoluções, use o fluxo de devolução e registre observações quando necessário. O código do item abre seu histórico. A fila local sinaliza movimentações pendentes quando não há conexão.

Leitura pela câmera usa o detector nativo do navegador quando disponível e inicia a câmera traseira antes de carregar a lista de câmeras. A biblioteca da câmera e a biblioteca de etiquetas são carregadas apenas quando seus recursos são usados. São aceitos QR Code e códigos comuns como Code 128, Code 39, EAN e UPC. Um leitor USB ou sem fio Bluetooth que funcione como teclado pode ser usado diretamente: selecione o campo de patrimônio ou solicitante e escaneie. Com o leitor configurado para enviar Enter após a leitura, o foco avança para o próximo campo; o botão de registrar continua manual. A câmera requer permissão do navegador e conexão HTTPS.

A navegação muda para uma barra inferior em celulares e tablets, e as tabelas viram cartões com rótulos em telas menores. Movimentações e inventário são paginados para evitar renderizar listas inteiras a cada busca.

## Verificação rápida

Confira no navegador os fluxos de retirada, devolução, busca, inventário e histórico. Para a integração, teste uma planilha descartável: registre uma movimentação, atualize a página e confirme que ela aparece na planilha e no aplicativo. Teste também leitura de câmera e impressão no dispositivo final.
