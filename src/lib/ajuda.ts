/**
 * (25/10) Central de Ajuda: os assuntos e os artigos (um tutorial por tela, no formato do "Como funciona").
 * Texto com **negrito** entre dois asteriscos. (27/10) Todas as telas, no formato do piloto de Pedidos:
 * prints em public/ajuda (1170 px, anéis rosa numerados na ordem das "marcas").
 * (31/10 · 5.83) Refeita: prints limpos de 360 px (dados de exemplo da Doce Formiga), as marcas desenhadas pelo app
 * (src/lib/ajudaPontos.ts), "o cliente" em tudo, PRO sinalizado e linhas para o computador.
 */
/** print da tela com anéis numerados; "marcas" explica cada número, na mesma ordem */
export type ImagemAjuda = { src: string; alt: string; marcas?: string[]; /** print da tela inteira (mais estreito) */ alta?: boolean }
export type SecaoAjuda = {
  id: string
  titulo: string
  /** cena de exemplo, em uma linha (ex.: "A Daniela pediu um cento de salgados pelo cardápio.") */
  exemplo?: string
  texto?: string[]
  passos?: string[]
  imagens?: ImagemAjuda[]
  dica?: string
}
/**
 * (27/10) Formato novo (aprovado com Primeiros passos): no lugar do print, um esquema da tela desenhado
 * (caixas cinza com o nome das partes e números discretos). Tocar num número explica a parte, e
 * "Mostrar na tela" abre a tela de verdade com essa parte acesa.
 */
export type LinhaEsquema = {
  t: string
  /** campo: caixa de texto · linha: nome e um traço · check: com visto · botao / botao2: principal e secundário ·
   *  barra: barra de progresso · dias: fileira de dias · grade: atalhos em 3 colunas · nota: texto pequeno ·
   *  nav: o menu de baixo. Em dias, grade e nav, t traz os nomes separados por vírgula */
  tipo?: 'campo' | 'linha' | 'check' | 'botao' | 'botao2' | 'barra' | 'dias' | 'grade' | 'nota' | 'nav'
}
export type BlocoEsquema = { n?: number; titulo?: string; linhas: LinhaEsquema[]; escuro?: boolean }
export type ParteEsquema = {
  titulo: string
  texto: string
  /** onde fica na tela de verdade (seletor do tour); sem ele, "Mostrar na tela" só abre a tela */
  el?: string
}
export type EsquemaTela = { tela: string; rota: string; blocos: BlocoEsquema[]; partes: ParteEsquema[] }
export type TextoAjuda = { titulo: string; texto?: string[]; lista?: string[]; passos?: string[]; dica?: string }

export type ArtigoAjuda = {
  slug: string
  tema: TemaId
  titulo: string
  resumo: string
  minutos: number
  abrir?: { rota: string; rotulo: string }
  secoes: SecaoAjuda[]
  relacionadas?: { rota: string; rotulo: string; apoio: string }[]
  /** (27/10) formato novo: texto do topo, "Em resumo", esquema, explicação e dúvidas */
  intro?: string
  pontos?: string[]
  esquema?: EsquemaTela
  textos?: TextoAjuda[]
  duvidas?: { p: string; r: string }[]
}
export type TemaId = 'primeiros' | 'vendas' | 'cardapio' | 'cadastros' | 'preco' | 'financeiro' | 'orcamentos' | 'conta'
export const TEMAS: { id: TemaId; nome: string; apoio: string }[] = [
  { id: 'primeiros', nome: 'Primeiros passos', apoio: 'Deixar a loja pronta para vender' },
  { id: 'vendas', nome: 'Pedidos e agenda', apoio: 'Do pedido novo à entrega' },
  { id: 'cardapio', nome: 'Cardápio online', apoio: 'Link, aparência e entrega' },
  { id: 'cadastros', nome: 'Cadastros', apoio: 'Produtos, clientes e ingredientes' },
  { id: 'preco', nome: 'Preço e custos', apoio: 'Ficha técnica e lucro' },
  { id: 'financeiro', nome: 'Financeiro', apoio: 'Entradas, saídas e contas' },
  { id: 'orcamentos', nome: 'Orçamentos', apoio: 'Propostas que o cliente aprova' },
  { id: 'conta', nome: 'Conta e PRO', apoio: 'Plano, avisos e suporte' },
]

export const ARTIGOS: ArtigoAjuda[] = [
  {
    slug: 'primeiros-passos',
    tema: 'primeiros',
    titulo: 'Deixar a loja pronta',
    resumo: 'Os 8 passos para o cardápio abrir.',
    minutos: 3,
    abrir: { rota: '/inicio', rotulo: 'Abrir o Início' },
    intro: 'Antes de vender pelo cardápio, a loja precisa de 8 informações básicas. O cartão dos passos fica no Início e mostra sempre o próximo que falta. No computador, ele fica no topo do Início.',
    pontos: [
      'Cada passo é salvo ao tocar em Salvar',
      'Dá para pular e voltar depois',
      'Com os 8 prontos, o cardápio está no ar',
    ],
    esquema: {
      tela: 'Início',
      rota: '/inicio',
      blocos: [
        { n: 1, titulo: 'Seu cardápio quase no ar', linhas: [{ t: '4 de 8 prontos', tipo: 'nota' }, { t: '', tipo: 'barra' }] },
        { n: 2, linhas: [{ t: 'Sobre a confeitaria', tipo: 'linha' }, { t: 'Fazer agora', tipo: 'botao' }] },
        { n: 3, linhas: [{ t: 'Logo da loja', tipo: 'check' }, { t: 'Endereço', tipo: 'linha' }, { t: 'Horário', tipo: 'linha' }, { t: 'Ver todos os 8 passos', tipo: 'nota' }] },
      ],
      partes: [
        { titulo: 'Quanto falta', texto: 'A barra mostra quantos dos 8 passos já estão prontos. Ela enche a cada passo salvo.', el: '.pp--banner .ppb-topo' },
        { titulo: 'O próximo passo', texto: 'O app mostra sempre o passo que falta. Fazer agora abre uma janela só com ele, sem sair do Início.', el: '.ppb-at' },
        { titulo: 'Todos os passos', texto: 'Mostra a lista completa. Os prontos ficam com visto verde. Toque num que falta para fazer na hora.', el: '.ppb-ver' },
      ],
    },
    textos: [
      {
        titulo: 'Os 8 passos',
        lista: [
          '**Logo da loja:** aparece no topo do cardápio.',
          '**Sobre a confeitaria:** uma frase curta embaixo do nome. O botão **Gerar com IA** escreve para você.',
          '**Endereço:** o cliente vê onde retirar, e o app usa para calcular a entrega.',
          '**Horário:** fora dele, o cardápio aparece fechado.',
          '**Pagamento:** as formas que você aceita: Pix, dinheiro ou cartão.',
          '**Entrega:** se o cliente busca, se você leva e a taxa.',
          '**Saldo do caixa:** quanto dinheiro você tem hoje, para o Financeiro começar certo.',
          '**Primeiro produto:** abre a tela Produtos para cadastrar.',
        ],
      },
      {
        titulo: 'Salvar e continuar',
        texto: [
          'No celular, cada janela tem o botão **Salvar e continuar**: o passo ganha o visto verde e a janela do próximo já abre, na ordem. No computador, o botão é **Salvar**, e você escolhe o próximo no cartão.',
          'Sem tempo agora? Toque em **Agora não**. No celular, o app pula para o próximo; no computador, a janela fecha. O que ficou para trás continua na lista.',
        ],
      },
      {
        titulo: 'Quando termina',
        texto: [
          'Com os 8 prontos, no celular o cartão vira **Seu cardápio está no ar!**, com os botões para compartilhar o link e ver o cardápio. Depois, é só fechar no X. No computador, o cartão sai do Início.',
          'Para mudar depois: os dados da loja ficam em **Minha loja**, o saldo do caixa no **Financeiro** e os produtos em **Produtos**.',
        ],
      },
    ],
    duvidas: [
      { p: 'Fechei a janela sem querer.', r: 'Os passos já salvos continuam prontos. O que foi digitado e não salvo se perde: toque de novo em Fazer agora.' },
      { p: 'Posso mudar depois?', r: 'Pode. Logo, descrição, endereço, horário e pagamento ficam em Minha loja, no menu de baixo. No computador, em Cardápio digital › Dados da loja.' },
      { p: 'O cartão sumiu do Início.', r: 'Ele sai quando os 8 passos ficam prontos e você fecha o aviso. Para conferir a loja, abra Minha loja.' },
    ],
    secoes: [],
    relacionadas: [
      { rota: '/ajuda/produtos', rotulo: 'Cadastrar um produto', apoio: 'O primeiro produto do cardápio' },
      { rota: '/ajuda/minha-loja', rotulo: 'Minha loja', apoio: 'Divulgar o link' },
    ],
  },
  {
    slug: 'inicio',
    tema: 'primeiros',
    titulo: 'A tela de Início',
    resumo: 'O seu dia em uma tela.',
    minutos: 3,
    abrir: { rota: '/inicio', rotulo: 'Abrir o Início' },
    intro: 'O Início é a primeira tela do app. Ele junta o que precisa da sua atenção hoje: pedidos para aceitar, as próximas entregas e o que falta resolver na loja. Daqui você chega em qualquer tela com um ou dois toques.',
    pontos: [
      'O urgente aparece primeiro',
      'A busca leva direto à tela',
      'O + registra uma venda',
    ],
    esquema: {
      tela: 'Início',
      rota: '/inicio',
      blocos: [
        { n: 1, titulo: 'Avisos', linhas: [{ t: '12 pedidos para aceitar', tipo: 'linha' }, { t: '2 pedidos atrasados', tipo: 'linha' }] },
        { n: 2, linhas: [{ t: 'Buscar no app', tipo: 'campo' }] },
        { n: 3, titulo: 'Acesso rápido', linhas: [{ t: 'Agenda,A receber,Clientes,Financeiro,Ficha técnica,Lucratividade', tipo: 'grade' }] },
        { n: 4, titulo: 'Próximas entregas', linhas: [{ t: 'Hoje,Qua,Qui,Sex', tipo: 'dias' }, { t: 'Beatriz · 14:00', tipo: 'linha' }] },
        { n: 5, titulo: 'Seus próximos passos', linhas: [{ t: 'Conta vencida', tipo: 'linha' }, { t: 'Avisos bloqueados', tipo: 'linha' }] },
        { n: 6, escuro: true, linhas: [{ t: 'Início,Pedidos,+,Minha loja,Menu', tipo: 'nav' }] },
      ],
      partes: [
        { titulo: 'Avisos', texto: 'Pedidos novos para aceitar e entregas que já passaram da hora. Com um pedido só, dá para aceitar ali mesmo; com vários, Ver abre a lista em Pedidos.', el: '.ini-section--novos' },
        { titulo: 'Buscar', texto: 'Digite o que procura, como pix, cupom ou horário, e vá direto para a tela.', el: '.ini-busca' },
        { titulo: 'Acesso rápido', texto: 'As 6 telas mais usadas no dia a dia. As outras ficam em Menu, no menu de baixo.', el: '.ini-section--nav' },
        { titulo: 'Próximas entregas', texto: 'Os próximos dias e as entregas de cada um. Toque num dia para ver só os pedidos dele.', el: '.ini-section--dia' },
        { titulo: 'Seus próximos passos', texto: 'Pendências da loja, como uma conta vencida, com o botão para resolver na hora.', el: '.ini-falta .pf' },
        { titulo: 'Menu de baixo', texto: 'Aparece em todas as telas. O + do meio registra uma venda.', el: '.bottom-nav-pill' },
      ],
    },
    textos: [
      {
        titulo: 'Avisos do dia',
        texto: [
          'Os avisos ficam no topo porque são o que não pode esperar. **Para aceitar** são pedidos do cardápio que você ainda não aceitou. **Atrasados** são pedidos com a data de entrega já passada.',
          'Quando não há nada urgente, os avisos somem e o topo fica livre.',
        ],
      },
      {
        titulo: 'Seus próximos passos',
        texto: [
          'O app olha a sua loja e lista o que vale resolver: uma conta vencida, os avisos do celular bloqueados, uma queda nas vendas. Cada item tem o botão para resolver na hora.',
          'Não quer resolver agora? Toque em **Agora não** e escolha: lembrar amanhã, em 7 dias ou não lembrar mais.',
        ],
      },
      {
        titulo: 'Menu de baixo',
        texto: [
          'O **+** do meio abre a Nova venda, para registrar um pedido do WhatsApp ou do balcão. Ele aparece em todas as telas.',
          'Em **Menu** ficam as outras telas: Financeiro, Agenda, Orçamentos, Cadastros, Marketing, Novidades, Configurações e Assinatura.',
        ],
      },
    ],
    duvidas: [
      { p: 'O Início está quase vazio.', r: 'Sem pedidos e sem pendências, ele mostra só o essencial. Os avisos aparecem quando chega pedido.' },
      { p: 'Onde fica o Financeiro?', r: 'No Acesso rápido do Início e em Menu, no menu de baixo.' },
      { p: 'No computador é diferente?', r: 'É. No computador, o Início mostra os números do mês e o menu fica na lateral.' },
    ],
    secoes: [],
    relacionadas: [
      { rota: '/ajuda/primeiros-passos', rotulo: 'Deixar a loja pronta', apoio: 'Os 8 passos' },
      { rota: '/ajuda/pedidos', rotulo: 'Pedidos', apoio: 'Aceitar, produzir e entregar' },
    ],
  },
  {
    slug: 'instalar-app',
    tema: 'primeiros',
    titulo: 'Instalar o app',
    resumo: 'Abra com um toque.',
    minutos: 2,
    abrir: { rota: '/configuracoes', rotulo: 'Abrir Configurações' },
    intro: 'Instalado, o Doonly abre com um toque direto da tela do celular, sem a barra do navegador, como um aplicativo. Não precisa da loja de aplicativos. No iPhone, instalar é o que faz o aviso de pedido novo chegar.',
    pontos: [
      'Sem loja de aplicativos',
      'No iPhone, pelo Safari',
      'Depois, ligue os avisos',
    ],
    esquema: {
      tela: 'Configurações',
      rota: '/configuracoes',
      blocos: [
        { titulo: 'Conta', linhas: [{ t: 'Minha conta', tipo: 'linha' }, { t: 'Minha assinatura', tipo: 'linha' }] },
        { n: 1, titulo: 'App', linhas: [{ t: 'Notificações e sons', tipo: 'linha' }] },
        { n: 2, linhas: [{ t: 'Instalar o app', tipo: 'linha' }] },
      ],
      partes: [
        { titulo: 'Notificações e sons', texto: 'Depois de instalar, ligue aqui o aviso de pedido novo.', el: '.cf9-item[data-nome="Notificações e sons"]' },
        { titulo: 'Instalar o app', texto: 'Abre o passo a passo certo para o seu aparelho: iPhone, Android ou computador.', el: '.cf9-item[data-nome="Instalar o app"]' },
      ],
    },
    textos: [
      {
        titulo: 'No iPhone',
        texto: ['Abra o Doonly no **Safari**. Aberto pelo Instagram ou pelo WhatsApp, a Apple não deixa instalar: toque em **Copiar link para colar no Safari** e cole no Safari.'],
        passos: [
          'Toque em **Compartilhar**, o quadrado com a seta para cima.',
          'Escolha **Adicionar à Tela de Início**.',
          'Toque em **Adicionar**.',
        ],
        dica: 'Depois, ligue os **avisos**.',
      },
      {
        titulo: 'No Android',
        passos: [
          'Em **Menu**, abra **Configurações**.',
          'Toque em **Instalar o app**.',
          'Toque em **Instalar app** e confirme.',
        ],
        dica: 'Sem o botão? No Chrome, toque nos **3 pontinhos ⋮** e em **Instalar app**.',
      },
      {
        titulo: 'No computador',
        passos: [
          'Abra o Doonly no **Chrome** ou no **Edge**.',
          'Clique no ícone de instalar, à direita na barra de endereço.',
          'Clique em **Instalar**.',
        ],
      },
    ],
    duvidas: [
      { p: 'Não acho Instalar o app.', r: 'Aberto pelo app já instalado, o item some das Configurações, porque não precisa mais.' },
      { p: 'Ocupa espaço no celular?', r: 'Quase nada. É o mesmo Doonly do navegador, com o atalho na tela.' },
      { p: 'Instalei e o aviso não toca.', r: 'Abra Configurações, Notificações e sons, e ligue os avisos neste aparelho.' },
    ],
    secoes: [],
    relacionadas: [
      { rota: '/ajuda/notificacoes', rotulo: 'Notificações', apoio: 'Ser avisada de pedido novo' },
    ],
  },
  {
    slug: 'pedidos',
    tema: 'vendas',
    titulo: 'Como usar os Pedidos',
    resumo: 'Do pedido novo à entrega.',
    minutos: 2,
    abrir: { rota: '/pedidos', rotulo: 'Abrir Pedidos' },
    secoes: [
      {
        id: 'aceitar',
        titulo: 'Aceitar o pedido',
        exemplo: 'O Rafael pediu um bolo.',
        imagens: [{ src: '/ajuda/pedidos-aceitar.webp', alt: 'Aba Novos com o pedido do Rafael', marcas: [
          'Abra a aba **Novos**.',
          'Toque em **Aceitar**.',
          'Ou aceite **todos** de uma vez.',
        ] }],
        dica: 'Aceito, ele vai para **Agendados**.',
      },
      {
        id: 'produzir',
        titulo: 'Começar a fazer',
        imagens: [{ src: '/ajuda/pedidos-produzir.webp', alt: 'Pedido da Beatriz em Agendados com o botão Produzir', marcas: [
          'Começou? Toque em **Produzir**.',
          'Em laranja: o que **falta receber**.',
        ] }],
      },
      {
        id: 'pronto',
        titulo: 'Marcar como pronto',
        imagens: [{ src: '/ajuda/pedidos-pronto.webp', alt: 'Pedido da Ana Paula em produção com o botão Pronto', marcas: [
          'Terminou? Toque em **Pronto**.',
        ] }],
      },
      {
        id: 'entregar',
        titulo: 'Entregar',
        imagens: [{ src: '/ajuda/pedidos-entregar.webp', alt: 'Aba Prontos com os botões Retirado e Saiu para entrega', marcas: [
          'Os pedidos ficam em **Prontos**.',
          'O cliente buscou? **Retirado**.',
          'Vai levar? **Saiu para entrega**.',
        ] }],
      },
      {
        id: 'achar',
        titulo: 'Achar um pedido',
        imagens: [
          { src: '/ajuda/pedidos-buscar.webp', alt: 'Busca e botão de filtro', marcas: [
            'Busque por **nome** ou **número**.',
            'Abra o **filtro**.',
          ] },
          { src: '/ajuda/pedidos-filtro.webp', alt: 'Filtro aberto com as situações e as datas', marcas: [
            'Escolha as **situações**.',
            'Escolha a **data**.',
            'Toque em **Ver pedidos**.',
          ] },
        ],
      },
      {
        id: 'dentro',
        titulo: 'Dentro do pedido',
        texto: ['Toque no pedido para abrir. Lá você muda os itens, a data, o pagamento e a etapa.'],
        dica: 'Veja o artigo **Dentro do pedido**.',
      },
      {
        id: 'nova',
        titulo: 'Pedido do WhatsApp ou do balcão',
        imagens: [{ src: '/ajuda/pedidos-nova-venda.webp', alt: 'Botão + no menu de baixo', marcas: [
          'Toque no **+** para registrar a venda.',
        ] }],
        dica: 'No computador: **Nova venda**, na lateral.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/pedido-aberto', rotulo: 'Dentro do pedido', apoio: 'Etapas, itens e pagamento' },
      { rota: '/ajuda/nova-venda', rotulo: 'Registrar uma venda', apoio: 'Pedido do WhatsApp ou do balcão' },
      { rota: '/ajuda/agenda', rotulo: 'Agenda', apoio: 'Os pedidos no calendário' },
    ],
  },
  {
    slug: 'pedido-aberto',
    tema: 'vendas',
    titulo: 'Dentro do pedido',
    resumo: 'Etapas, itens e pagamento.',
    minutos: 2,
    abrir: { rota: '/pedidos', rotulo: 'Abrir Pedidos' },
    secoes: [
      {
        id: 'etapas',
        titulo: 'Em que etapa está',
        exemplo: 'O bolo da Natália já está agendado.',
        imagens: [{ src: '/ajuda/pedido-etapas.webp', alt: 'As 5 etapas do pedido e o botão Produzir', marcas: [
          'As **5 etapas** do pedido.',
          'Leva para a **próxima etapa**.',
          '**Mais ações** do pedido.',
        ] }],
      },
      {
        id: 'itens',
        titulo: 'Cliente e itens',
        imagens: [{ src: '/ajuda/pedido-itens.webp', alt: 'Cartão do cliente e itens do pedido', marcas: [
          '**Trocar** o cliente.',
          'Chame no **WhatsApp** ou ligue.',
          '**Adicionar** outro item.',
          'Mude ou tire o **item**.',
        ] }],
      },
      {
        id: 'entrega',
        titulo: 'Retirada ou entrega',
        texto: ['Toque na aba **Retirada** (ou **Entrega**).'],
        imagens: [{ src: '/ajuda/pedido-entrega.webp', alt: 'Aba Retirada com as opções, a data e o horário', marcas: [
          'O cliente **busca** ou você **leva**.',
          'A **data**.',
          'O **horário**.',
        ] }],
        dica: 'Na entrega, aparece o **endereço** com o mapa.',
      },
      {
        id: 'pagamento',
        titulo: 'Receber o pagamento',
        exemplo: 'A Carla ainda não pagou nada.',
        texto: ['Toque na aba **Pagamento**.'],
        imagens: [{ src: '/ajuda/pedido-pagamento.webp', alt: 'Aba Pagamento com o total e o botão Registrar recebimento', marcas: [
          '**Desconto** ou valor a mais.',
          'O **total** do pedido.',
          '**Registrar recebimento**.',
        ] }],
        dica: 'Entra no **Financeiro** na hora.',
      },
      {
        id: 'mais',
        titulo: 'Mais ações',
        texto: ['Toque nos **3 pontinhos** do topo.'],
        imagens: [{ src: '/ajuda/pedido-mais.webp', alt: 'Menu com Acompanhar, PDF, Mudar a etapa, Cancelar e Excluir', marcas: [
          '**Acompanhar**: o histórico do pedido.',
          '**Imprimir** ou baixar o **PDF**.',
          '**Mudar a etapa**: voltar ou pular.',
          '**Cancelar** ou **excluir**.',
        ] }],
        dica: 'Cancelado, ele fica guardado. **Excluir** apaga de vez.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/pedidos', rotulo: 'Como usar os Pedidos', apoio: 'Aceitar, produzir e entregar' },
      { rota: '/ajuda/a-receber', rotulo: 'A receber', apoio: 'O que falta o cliente pagar' },
      { rota: '/ajuda/mensagens', rotulo: 'Mensagens do WhatsApp', apoio: 'Textos prontos para o cliente' },
    ],
  },
  {
    slug: 'nova-venda',
    tema: 'vendas',
    titulo: 'Registrar uma venda',
    resumo: 'Pedido do WhatsApp ou do balcão.',
    minutos: 2,
    abrir: { rota: '/vendas/novo', rotulo: 'Abrir Nova venda' },
    secoes: [
      {
        id: 'produtos',
        titulo: 'O que ele pediu',
        exemplo: 'A Natália pediu um pudim no WhatsApp.',
        texto: ['Toque no **+** do menu de baixo. No computador: **Nova venda**, no menu da lateral.'],
        imagens: [{ src: '/ajuda/nova-venda-produtos.webp', alt: 'Tipo de venda e o Pudim de leite adicionado', marcas: [
          '**Encomenda** ou **Pronta entrega**.',
          'A **quantidade**. Com 1, a lixeira tira o item.',
          '**+ Recado**: um pedido especial do item.',
          '**Adicionar produto**.',
        ] }],
        dica: 'Depois, toque em **Continuar**.',
      },
      {
        id: 'cliente',
        titulo: 'Para quem é',
        imagens: [{ src: '/ajuda/nova-venda-cliente.webp', alt: 'Busca de clientes e a lista dos últimos', marcas: [
          'Busque pelo **nome** ou **telefone**.',
          'Cliente novo? **Cadastrar novo cliente**.',
          '**Sem cliente**: venda avulsa.',
          'Ou toque em um **cliente**.',
        ] }],
      },
      {
        id: 'entrega',
        titulo: 'Retirada ou entrega',
        imagens: [{ src: '/ajuda/nova-venda-entrega.webp', alt: 'Retirada ou entrega, com a data e o horário', marcas: [
          'Ele vem **buscar**.',
          'Ou você **entrega**.',
          'Escolha a **data**.',
          'E o **horário**, se quiser.',
        ] }],
        dica: 'Na **Pronta entrega**: Já levou ou Vem buscar.',
      },
      {
        id: 'pagamento',
        titulo: 'Quanto já entrou',
        exemplo: 'Ela mandou R$ 20,00 de sinal no Pix.',
        imagens: [{ src: '/ajuda/nova-venda-pagamento.webp', alt: 'Sinal de 20 reais no Pix', marcas: [
          'Toque em **Só uma parte (sinal)**.',
          'Quanto ele **já pagou**.',
          '**Como** ele pagou.',
          '**Vai pagar depois**: você escolhe a data.',
        ] }],
        dica: 'O que falta vai para **A receber**.',
      },
      {
        id: 'revisar',
        titulo: 'Conferir e registrar',
        imagens: [{ src: '/ajuda/nova-venda-revisar.webp', alt: 'Situação do pedido e o resumo da venda', marcas: [
          'Em que **situação** o pedido entra.',
          'Algo errado? **Editar**.',
        ] }],
        dica: 'Tudo certo? Toque em **Registrar venda**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/pedidos', rotulo: 'Como usar os Pedidos', apoio: 'Aceitar, produzir e entregar' },
      { rota: '/ajuda/clientes', rotulo: 'Clientes', apoio: 'Quem compra de você' },
      { rota: '/ajuda/a-receber', rotulo: 'A receber', apoio: 'O que falta o cliente pagar' },
    ],
  },
  {
    slug: 'agenda',
    tema: 'vendas',
    titulo: 'Como usar a Agenda',
    resumo: 'Os pedidos no calendário.',
    minutos: 2,
    abrir: { rota: '/agenda', rotulo: 'Abrir a Agenda' },
    secoes: [
      {
        id: 'mes',
        titulo: 'Ver o mês',
        texto: ['Em **Menu**, toque em **Agenda**. Ela também fica no Acesso rápido do Início.'],
        imagens: [{ src: '/ajuda/agenda-mes.webp', alt: 'Calendário do mês com bolinhas nos dias com pedido', marcas: [
          'Troque o **mês**.',
          'A bolinha: dia com **pedido**.',
          'O dia **escolhido**.',
          'Cada **cor** é uma situação.',
        ] }],
        dica: '**Vermelho** é pedido atrasado.',
      },
      {
        id: 'dia',
        titulo: 'Os pedidos do dia',
        exemplo: 'Toque no dia 31.',
        imagens: [{ src: '/ajuda/agenda-dia.webp', alt: 'Dia 31 com o total a receber e o primeiro pedido', marcas: [
          'O dia e quanto **falta receber**.',
          '**Imprimir o dia** para a produção (PRO).',
          'Toque no nome para **abrir**.',
          'Chame o cliente no **WhatsApp**.',
        ] }],
      },
      {
        id: 'buscar',
        titulo: 'Achar um pedido',
        imagens: [{ src: '/ajuda/agenda-buscar.webp', alt: 'Busca e filtro da Agenda', marcas: [
          'Busque por **nome** ou **número**.',
          'O **filtro** escolhe as situações.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/pedidos', rotulo: 'Como usar os Pedidos', apoio: 'Aceitar, produzir e entregar' },
      { rota: '/ajuda/nova-venda', rotulo: 'Registrar uma venda', apoio: 'Pedido do WhatsApp ou do balcão' },
    ],
  },
  {
    slug: 'minha-loja',
    tema: 'cardapio',
    titulo: 'Minha loja e o link',
    resumo: 'Divulgar e pausar o cardápio.',
    minutos: 2,
    abrir: { rota: '/cardapio', rotulo: 'Abrir Minha loja' },
    secoes: [
      {
        id: 'link',
        titulo: 'Divulgar o link',
        exemplo: 'Mande o cardápio no status do WhatsApp.',
        texto: ['Toque em **Minha loja**, no menu de baixo. No computador: **Cardápio digital**, no menu da lateral.'],
        imagens: [{ src: '/ajuda/loja-link.webp', alt: 'Cartão da loja com a chave e os botões do link', marcas: [
          '**Pausar** os pedidos na hora.',
          '**Enviar**: abre o compartilhar do celular.',
          '**Copiar** o link.',
          '**Ver** como o cliente vê.',
          '**QR Code** para imprimir.',
        ] }],
        dica: 'Pausar não muda o seu **horário**.',
      },
      {
        id: 'cliente',
        titulo: 'O que o cliente vê',
        imagens: [{ src: '/ajuda/loja-cliente.webp', alt: 'Lista A loja para o cliente', marcas: [
          'Toque para trocar a **logo**.',
          'Nome, WhatsApp e **descrição**.',
          'Cores, foto do topo e **banners**.',
          '**Instagram** e **Facebook**.',
        ] }],
        dica: 'Cada linha mostra **como está** agora.',
      },
      {
        id: 'sobre',
        titulo: 'Nome e descrição',
        texto: ['Toque em **Sobre a loja**. No computador: **Dados da loja › Sua loja**.'],
        imagens: [{ src: '/ajuda/loja-sobre.webp', alt: 'Janela Sua loja com nome, WhatsApp e descrição', marcas: [
          'O **nome** da loja.',
          'O **WhatsApp** dos pedidos.',
          'Uma **descrição** curta.',
          'Sem ideia? **Gerar com IA**.',
        ] }],
        dica: 'Salva **sozinho** ao fechar a janela.',
      },
      {
        id: 'redes',
        titulo: 'Redes sociais',
        texto: ['Toque em **Redes sociais**.'],
        imagens: [{ src: '/ajuda/loja-redes.webp', alt: 'Janela Redes sociais com Instagram e Facebook', marcas: [
          'Ligue o **Instagram**.',
          'Escreva o **@** da loja.',
          'Ligue o **Facebook**, se tiver.',
        ] }],
        dica: 'Elas aparecem em **Sobre a loja**, no cardápio.',
      },
      {
        id: 'computador',
        titulo: 'No computador',
        texto: ['Em **Cardápio digital**, no menu da lateral: **Visão geral** tem o link e o resumo do cardápio. **Dados da loja** e **Aparência** têm o mesmo que você vê aqui.'],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/horario-entrega-pagamento', rotulo: 'Horário, entrega e pagamento', apoio: 'Como você vende' },
      { rota: '/ajuda/aparencia', rotulo: 'Aparência do cardápio', apoio: 'Logo, banners e cores' },
      { rota: '/ajuda/produtos', rotulo: 'Cadastrar um produto', apoio: 'O que aparece no cardápio' },
    ],
  },
  {
    slug: 'horario-entrega-pagamento',
    tema: 'cardapio',
    titulo: 'Horário, entrega e pagamento',
    resumo: 'Onde, quando e como você vende.',
    minutos: 3,
    abrir: { rota: '/cardapio', rotulo: 'Abrir Minha loja' },
    secoes: [
      {
        id: 'endereco',
        titulo: 'Endereço',
        texto: ['Em **Minha loja**, toque em **Endereço**. No computador: **Cardápio digital › Dados da loja**.'],
        imagens: [{ src: '/ajuda/loja-endereco.webp', alt: 'Janela Endereço com o CEP, a rua e o que aparece no cardápio', marcas: [
          'O **CEP** acha a rua sozinho.',
          'O **número**.',
          'O que o **cliente vê**: tudo, só a cidade ou nada.',
        ] }],
        dica: 'Atende em casa? Mostre **só a cidade**.',
      },
      {
        id: 'horario',
        titulo: 'Horário',
        texto: ['Toque em **Horário**.'],
        imagens: [{ src: '/ajuda/loja-horario.webp', alt: 'Janela Horário com os dias e as horas', marcas: [
          'Ligue os **dias** que você atende.',
          'Toque no dia para tirar ou pôr.',
          'Que horas **abre** e **fecha**.',
          'Como está **agora** no cardápio.',
        ] }],
        dica: 'Fora do horário, o cardápio **fecha**.',
      },
      {
        id: 'entrega',
        titulo: 'Entrega',
        exemplo: 'Você entrega no Centro por R$ 8,00.',
        texto: ['Toque em **Entrega**. Escolha como cobrar:'],
        imagens: [{ src: '/ajuda/loja-entrega.webp', alt: 'Os 4 jeitos de cobrar a entrega', marcas: [
          '**Taxa única**: o mesmo valor.',
          '**Por bairro**: um valor por bairro.',
          '**Por raio**: pela distância.',
          '**Por cidade**: um valor por cidade.',
        ] }],
        dica: 'Entrega sem custo? Marque **Grátis** no valor.',
      },
      {
        id: 'pagamento',
        titulo: 'Formas de pagamento',
        texto: ['Toque em **Pagamento**.'],
        imagens: [{ src: '/ajuda/loja-pagamento.webp', alt: 'Janela Pagamento com Pix, dinheiro e cartões', marcas: [
          'Ligue as formas que **você aceita**.',
          'Pergunta o **troco** no dinheiro.',
        ] }],
      },
      {
        id: 'pix',
        titulo: 'Pix pelo cardápio',
        exemplo: 'O cliente paga o sinal no Pix ao pedir.',
        texto: ['Toque em **Pix pelo cardápio**.'],
        imagens: [{ src: '/ajuda/loja-pix.webp', alt: 'Janela Pix pelo cardápio com a chave e o sinal', marcas: [
          'Ligue o **Pix pelo cardápio**.',
          'O **tipo da chave**.',
          'A **chave Pix**.',
          'Sinal, total ou **o cliente escolhe**.',
        ] }],
        dica: 'Você confere o Pix em **Pedidos**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/minha-loja', rotulo: 'Minha loja e o link', apoio: 'O link e o que o cliente vê' },
      { rota: '/ajuda/pedidos', rotulo: 'Como usar os Pedidos', apoio: 'Aceitar e conferir o Pix' },
    ],
  },
  {
    slug: 'aparencia',
    tema: 'cardapio',
    titulo: 'Aparência do cardápio',
    resumo: 'Logo, foto, banners e cores.',
    minutos: 2,
    abrir: { rota: '/cardapio-design', rotulo: 'Abrir Aparência' },
    secoes: [
      {
        id: 'topo',
        titulo: 'Logo e foto do topo',
        texto: ['Em **Minha loja**, toque em **Aparência**. No computador: **Cardápio digital › Aparência**.'],
        imagens: [{ src: '/ajuda/aparencia-topo.webp', alt: 'Cartões Logo e Foto do topo', marcas: [
          '**Trocar** a logo.',
          '**Ver como fica** no cardápio.',
          '**Trocar** a foto do topo.',
        ] }],
        dica: 'Sem foto, o topo usa a **cor da faixa**.',
      },
      {
        id: 'banners',
        titulo: 'Banners de promoção',
        exemplo: 'Frete grátis nesta semana.',
        imagens: [{ src: '/ajuda/aparencia-banners.webp', alt: 'Banner 1 preenchido e o espaço do banner 2', marcas: [
          'O banner que está no **cardápio**.',
          '**Adicionar** outro (banners 2 a 4: PRO).',
          'Ou **use um banner pronto**.',
        ] }],
        dica: 'Imagem **deitada**: 1200 × 675.',
      },
      {
        id: 'cores',
        titulo: 'Cores',
        imagens: [{ src: '/ajuda/aparencia-cores.webp', alt: 'Cores da faixa do topo, da borda da logo e do nome', marcas: [
          'A **faixa do topo**.',
          'A **borda** da logo.',
          'O **nome** da loja.',
        ] }],
        dica: 'A 1ª fileira é grátis. As outras e o **+** são do PRO.',
      },
      {
        id: 'link',
        titulo: 'Nome no link (PRO)',
        imagens: [{ src: '/ajuda/aparencia-link.webp', alt: 'Nome da loja no link do cardápio', marcas: [
          'Escreva o **nome** da loja.',
          '**Copiar** o link.',
        ] }],
        dica: 'Mudou? O link antigo **continua** funcionando.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/minha-loja', rotulo: 'Minha loja e o link', apoio: 'O link e o que o cliente vê' },
      { rota: '/ajuda/destaques', rotulo: 'Produtos em destaque', apoio: 'Os primeiros do cardápio' },
    ],
  },
  {
    slug: 'cupons',
    tema: 'cardapio',
    titulo: 'Cupons de desconto',
    resumo: 'Desconto para vender mais.',
    minutos: 2,
    abrir: { rota: '/marketing', rotulo: 'Abrir Marketing' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Seus cupons',
        texto: ['Em **Menu**, toque em **Marketing**.'],
        imagens: [{ src: '/ajuda/cupons-lista.webp', alt: 'Lista de cupons com a situação e o botão Compartilhar', marcas: [
          '**Ativo**: vale no cardápio.',
          '**Compartilhar** o cupom.',
          '**Pausado**: guardado, sem valer.',
          'Criar um **Novo cupom**.',
        ] }],
        dica: 'Os **2 mais novos** aparecem no topo do cardápio (PRO).',
      },
      {
        id: 'novo',
        titulo: 'Criar um cupom',
        exemplo: '10% no primeiro pedido.',
        imagens: [{ src: '/ajuda/cupons-novo.webp', alt: 'Janela Novo cupom com o código BEMVINDO10', marcas: [
          'O **código** que o cliente digita.',
          'Desconto em **%** ou em **R$**.',
          'Para **todos** ou só **cliente novo**.',
          'Se quiser, **datas**, limite e mínimo.',
          'Toque em **Criar cupom**.',
        ] }],
        dica: '**1 cupom** por pedido. Passou da data? Fica **Vencido**.',
      },
      {
        id: 'pixel',
        titulo: 'Pixel do Facebook',
        exemplo: 'Para anunciar no Instagram.',
        imagens: [{ src: '/ajuda/cupons-pixel.webp', alt: 'Aba Pixel do Facebook com o campo do ID', marcas: [
          'Abra **Pixel do Facebook**.',
          'Cole o **ID do pixel**.',
          'Toque em **Salvar**.',
        ] }],
        dica: 'Anúncios mais **certeiros**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/destaques', rotulo: 'Produtos em destaque', apoio: 'Os primeiros do cardápio' },
      { rota: '/ajuda/minha-loja', rotulo: 'Minha loja e o link', apoio: 'Divulgar o link' },
    ],
  },
  {
    slug: 'destaques',
    tema: 'cardapio',
    titulo: 'Produtos em destaque',
    resumo: 'Os primeiros do cardápio.',
    minutos: 1,
    abrir: { rota: '/produtos', rotulo: 'Abrir Produtos' },
    secoes: [
      {
        id: 'destacar',
        titulo: 'Destacar um produto',
        exemplo: 'O bolo mais vendido da semana.',
        texto: ['Em **Produtos**, toque no produto e em **Mais**.'],
        imagens: [{ src: '/ajuda/destaques-mais.webp', alt: 'Menu Mais do produto com Tirar do destaque', marcas: [
          '**Destacar** ou **tirar do destaque**.',
          '**Tirar do cardápio**, sem apagar.',
        ] }],
      },
      {
        id: 'lista',
        titulo: 'Na sua lista',
        imagens: [{ src: '/ajuda/destaques-lista.webp', alt: 'Lista de produtos com a estrela nos destacados', marcas: [
          'A **estrela** mostra o destaque.',
          'A chave mostra ou tira do **cardápio**.',
        ] }],
        dica: 'Produto fora do cardápio **sai dos destaques**.',
      },
      {
        id: 'cardapio',
        titulo: 'No cardápio',
        texto: ['Os destaques são a **primeira parte** do cardápio, com fotos grandes. Toque em **Ver**, em Minha loja, para conferir.'],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/produtos', rotulo: 'Cadastrar um produto', apoio: 'Nome, fotos e preço' },
      { rota: '/ajuda/cupons', rotulo: 'Cupons de desconto', apoio: 'Desconto para vender mais' },
    ],
  },
  {
    slug: 'cadastros',
    tema: 'cadastros',
    titulo: 'A tela Cadastros',
    resumo: 'Produtos, ingredientes e clientes num lugar só.',
    minutos: 1,
    abrir: { rota: '/cadastros', rotulo: 'Abrir Cadastros' },
    secoes: [
      {
        id: 'tela',
        titulo: 'Tudo o que você cadastra',
        texto: ['Em **Menu**, toque em **Cadastros**.'],
        imagens: [{ src: '/ajuda/cadastros.webp', alt: 'Cadastros com o aviso e as listas', marcas: [
          '**Precisa de atenção**: o que falta arrumar.',
          'O que você **vende**: produtos, categorias, complementos.',
          'Do que é **feito**: ingredientes e ficha técnica.',
          'Quem **compra**: clientes e mensagens.',
        ] }],
        dica: 'O número à direita é **quantos** você tem.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/produtos', rotulo: 'Cadastrar um produto', apoio: 'Nome, fotos e preço' },
      { rota: '/ajuda/ingredientes', rotulo: 'Ingredientes', apoio: 'O que você compra' },
      { rota: '/ajuda/clientes', rotulo: 'Clientes', apoio: 'Quem compra de você' },
    ],
  },
  {
    slug: 'produtos',
    tema: 'cadastros',
    titulo: 'Cadastrar um produto',
    resumo: 'Nome, escolhas, fotos e preço.',
    minutos: 3,
    abrir: { rota: '/produtos', rotulo: 'Abrir Produtos' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Seus produtos',
        texto: ['Em **Menu**, abra **Cadastros** e toque em **Produtos**.'],
        imagens: [{ src: '/ajuda/produto-lista.webp', alt: 'Lista de produtos com a chave do cardápio', marcas: [
          'Cadastrar um **Novo** produto.',
          'A chave mostra ou tira do **cardápio**.',
          '**Criar ficha técnica** para ver o lucro.',
        ] }],
      },
      {
        id: 'sobre',
        titulo: 'Sobre o produto',
        exemplo: 'Um Bolo de Ninho com Morango.',
        imagens: [{ src: '/ajuda/produto-sobre.webp', alt: 'Nome, descrição e categoria do produto', marcas: [
          'O **nome** do produto.',
          'Uma **descrição** curta.',
          'Sem ideia? **Gerar com IA**.',
          'A **categoria** do cardápio.',
        ] }],
        dica: 'Depois, toque em **Continuar**.',
      },
      {
        id: 'escolhas',
        titulo: 'O que o cliente escolhe',
        imagens: [{ src: '/ajuda/produto-escolhas.webp', alt: 'Lista de escolhas com Tamanho e Sabor marcados', marcas: [
          '**Tamanho**: cada um com o seu preço.',
          '**Sabor**, massa, recheio ou cobertura.',
        ] }],
        dica: 'Sem marcar, o cliente só diz **quantos quer**.',
      },
      {
        id: 'fotos',
        titulo: 'Fotos',
        imagens: [{ src: '/ajuda/produto-fotos.webp', alt: 'Foto principal e as fotos 2 a 4', marcas: [
          'A **foto principal**: tire ou escolha da galeria.',
          'Fotos **2 a 4** do mesmo produto (PRO).',
        ] }],
        dica: 'Logo abaixo, **dicas** para a foto que vende.',
      },
      {
        id: 'preco',
        titulo: 'Preço',
        imagens: [{ src: '/ajuda/produto-preco.webp', alt: 'Preço cheio, vendido por e promoção', marcas: [
          'O **preço cheio**.',
          '**Vendido por**: unidade, quilo…',
          '**Promoção**: o preço antigo aparece riscado.',
        ] }],
      },
      {
        id: 'revisar',
        titulo: 'Conferir e publicar',
        imagens: [{ src: '/ajuda/produto-revisar.webp', alt: 'Revisão do produto antes de publicar', marcas: [
          'Assim ele aparece no **cardápio**.',
          'Confira as **informações**.',
          '**Antes de publicar**: o que ainda vale ajustar.',
        ] }],
        dica: 'Tudo certo? Toque em **Publicar produto**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/categorias', rotulo: 'Categorias do cardápio', apoio: 'A ordem do cardápio' },
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Custo e lucro do produto' },
      { rota: '/ajuda/destaques', rotulo: 'Produtos em destaque', apoio: 'Os primeiros do cardápio' },
    ],
  },
  {
    slug: 'categorias',
    tema: 'cadastros',
    titulo: 'Categorias do cardápio',
    resumo: 'Bolos, doces, salgados.',
    minutos: 1,
    abrir: { rota: '/categorias', rotulo: 'Abrir Categorias' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Suas categorias',
        texto: ['Em **Cadastros**, toque em **Categorias**.'],
        imagens: [{ src: '/ajuda/categorias-lista.webp', alt: 'Lista de categorias na ordem do cardápio', marcas: [
          'Criar uma **Nova** categoria.',
          'A categoria e **quantos produtos** tem.',
          'Os **3 pontinhos**: editar, mudar a ordem, excluir.',
        ] }],
        dica: 'A ordem daqui é a **ordem do cardápio**.',
      },
      {
        id: 'nova',
        titulo: 'Criar uma categoria',
        exemplo: 'Kits de festa.',
        imagens: [{ src: '/ajuda/categorias-nova.webp', alt: 'Janela Nova categoria com o nome e a foto', marcas: [
          'O **nome** da categoria.',
          '**Automática**: usa a foto do primeiro produto.',
          'Ou **envie uma foto**.',
          'Toque em **Criar categoria**.',
        ] }],
      },
      {
        id: 'ordem',
        titulo: 'Mudar a ordem',
        imagens: [{ src: '/ajuda/categorias-opcoes.webp', alt: 'Menu da categoria com Editar, Subir, Descer e Excluir', marcas: [
          '**Editar** o nome e a foto.',
          '**Subir** ou **descer** no cardápio.',
          '**Excluir**: só sem produtos dentro.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/produtos', rotulo: 'Cadastrar um produto', apoio: 'Nome, fotos e preço' },
    ],
  },
  {
    slug: 'complementos',
    tema: 'cadastros',
    titulo: 'Complementos (PRO)',
    resumo: 'Topo, velas e outros extras.',
    minutos: 2,
    abrir: { rota: '/complementos', rotulo: 'Abrir Complementos' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Seus complementos',
        exemplo: 'Topo de bolo por R$ 15,00.',
        texto: ['Em **Cadastros**, toque em **Complementos**. É um recurso do plano **PRO**.'],
        imagens: [{ src: '/ajuda/complementos-lista.webp', alt: 'Lista de complementos com o valor', marcas: [
          'Criar um **Novo** complemento.',
          'Toque para **editar**.',
          '**Pede foto**: o cliente manda uma referência.',
        ] }],
        dica: 'No cardápio, aparecem **no produto**, para marcar.',
      },
      {
        id: 'novo',
        titulo: 'Criar um complemento',
        imagens: [{ src: '/ajuda/complementos-novo.webp', alt: 'Janela Novo complemento', marcas: [
          'O **nome**, como Topo de bolo.',
          '**Quanto soma** no pedido, ou Grátis.',
          'O cliente manda **uma foto de referência** ou **uma frase**?',
        ] }],
        dica: 'Toque em **Criar**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/produtos', rotulo: 'Cadastrar um produto', apoio: 'Nome, fotos e preço' },
      { rota: '/ajuda/assinatura', rotulo: 'Plano PRO', apoio: 'O que o PRO libera' },
    ],
  },
  {
    slug: 'clientes',
    tema: 'cadastros',
    titulo: 'Clientes',
    resumo: 'Quem compra de você.',
    minutos: 2,
    abrir: { rota: '/clientes', rotulo: 'Abrir Clientes' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Sua lista',
        texto: ['Em **Cadastros**, toque em **Clientes**. Também fica no Acesso rápido do Início.'],
        imagens: [{ src: '/ajuda/clientes-lista.webp', alt: 'Aniversários do mês e a lista de clientes', marcas: [
          '**Aniversários** dos próximos 30 dias.',
          'Cadastrar um **Novo** cliente.',
          'Chamar no **WhatsApp**.',
        ] }],
        dica: 'Quem pede pelo cardápio entra **sozinho**.',
      },
      {
        id: 'novo',
        titulo: 'Cadastrar um cliente',
        imagens: [{ src: '/ajuda/clientes-novo.webp', alt: 'Janela Novo cliente', marcas: [
          'Uma **foto**, se quiser.',
          'O **nome**.',
          'O **WhatsApp**.',
          'O **aniversário**: o app avisa antes.',
          '**Mais detalhes**: endereço, e-mail, CPF.',
        ] }],
      },
      {
        id: 'perfil',
        titulo: 'Tudo sobre o cliente',
        exemplo: 'A Daniela faz aniversário em 3 dias.',
        imagens: [{ src: '/ajuda/clientes-perfil.webp', alt: 'Perfil da Daniela com os números das compras', marcas: [
          'O **aniversário** chegando.',
          'Chamar no **WhatsApp**.',
          'Uma **Nova venda** para ele.',
          'Quanto ele **compra** com você.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/mensagens', rotulo: 'Mensagens do WhatsApp', apoio: 'Parabéns e avisos prontos' },
      { rota: '/ajuda/nova-venda', rotulo: 'Registrar uma venda', apoio: 'Pedido do WhatsApp ou do balcão' },
    ],
  },
  {
    slug: 'ingredientes',
    tema: 'cadastros',
    titulo: 'Ingredientes',
    resumo: 'O que você compra e quanto custa.',
    minutos: 2,
    abrir: { rota: '/insumos', rotulo: 'Abrir Ingredientes' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Sua lista',
        texto: ['Em **Cadastros**, toque em **Ingredientes**.'],
        imagens: [{ src: '/ajuda/ingredientes-lista.webp', alt: 'Lista de ingredientes com o custo de cada 100 g', marcas: [
          'Cadastrar um **Novo** ingrediente.',
          'Quanto custa **cada 100 g** (ou unidade).',
        ] }],
      },
      {
        id: 'editar',
        titulo: 'Quanto você pagou',
        exemplo: 'A lata de leite condensado custou R$ 7,49.',
        imagens: [{ src: '/ajuda/ingredientes-editar.webp', alt: 'Janela Editar ingrediente com o custo na receita', marcas: [
          '**Achar foto com IA**.',
          'A **medida**: g, kg, ml, L ou unidade.',
          'Quanto **vem** e quanto você **pagou**.',
          'O app calcula o **custo na receita**.',
        ] }],
        dica: 'O preço mudou? Troque aqui: as **fichas** se atualizam.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Custo e lucro do produto' },
    ],
  },
  {
    slug: 'ficha-tecnica',
    tema: 'preco',
    titulo: 'Ficha técnica',
    resumo: 'Quanto custa e quanto sobra.',
    minutos: 3,
    abrir: { rota: '/ficha-tecnica', rotulo: 'Abrir Ficha técnica' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Seus produtos',
        texto: ['Em **Cadastros**, toque em **Ficha técnica**.'],
        imagens: [{ src: '/ajuda/ficha-lista.webp', alt: 'Produtos com e sem ficha técnica', marcas: [
          '**Montar a próxima** ficha que falta.',
          'Com ficha: o **lucro** de cada um.',
          'Sem ficha: **Montar ficha**.',
        ] }],
        dica: 'Sem ficha, o lucro aparece **maior** do que é.',
      },
      {
        id: 'resumo',
        titulo: 'Lucro e custo',
        exemplo: 'O Bolo Brigadeiro custa R$ 25,49 e vende por R$ 47,61.',
        imagens: [{ src: '/ajuda/ficha-resumo.webp', alt: 'Lucro, barra de cores e custo total do Bolo Brigadeiro', marcas: [
          '**Seu lucro** e a margem.',
          'Para onde vai o **preço**.',
          'O **custo total** do produto.',
        ] }],
      },
      {
        id: 'ingredientes',
        titulo: 'Os ingredientes',
        imagens: [{ src: '/ajuda/ficha-ingredientes.webp', alt: 'Ingredientes da receita com a quantidade', marcas: [
          'Quanto vai na **receita**.',
          'A **medida**.',
          '**Tirar** o ingrediente.',
        ] }],
      },
      {
        id: 'mais',
        titulo: 'Completar a ficha',
        imagens: [{ src: '/ajuda/ficha-mais.webp', alt: 'Adicionar ingrediente, custos invisíveis, mão de obra e informações', marcas: [
          '**Adicionar ingrediente**.',
          '**Custos invisíveis**: gás, perdas e descartáveis.',
          '**Mão de obra**: ligue para somar o seu tempo.',
          '**Informações**: rendimento, validade…',
        ] }],
        dica: 'Toque em **Salvar ficha**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ingredientes', rotulo: 'Ingredientes', apoio: 'O que você compra' },
      { rota: '/ajuda/custos', rotulo: 'Custos da confeitaria', apoio: 'Fixos, mão de obra e taxas' },
      { rota: '/ajuda/lucratividade', rotulo: 'Lucratividade', apoio: 'O lucro do mês' },
    ],
  },
  {
    slug: 'custos',
    tema: 'preco',
    titulo: 'Custos da confeitaria',
    resumo: 'Fixos, mão de obra e taxas.',
    minutos: 3,
    abrir: { rota: '/custos', rotulo: 'Abrir Custos' },
    secoes: [
      {
        id: 'resumo',
        titulo: 'O resumo',
        texto: ['Em **Menu**, abra **Financeiro** e toque em **Custos**.'],
        imagens: [{ src: '/ajuda/custos-resumo.webp', alt: 'Os 4 números do topo de Custos', marcas: [
          'Os **custos fixos** do mês.',
          'O **salário** que você quer tirar.',
          'Quanto custa **a sua hora**.',
          'Quanto vai em cada **pedido**.',
        ] }],
      },
      {
        id: 'fixos',
        titulo: 'Custos fixos',
        exemplo: 'Aluguel, gás e internet.',
        imagens: [{ src: '/ajuda/custos-fixos.webp', alt: 'Lista de custos fixos', marcas: [
          '**Adicionar** um custo.',
          'Toque para **editar**.',
        ] }],
      },
      {
        id: 'editar',
        titulo: 'Valor e vencimento',
        imagens: [{ src: '/ajuda/custos-fixo-editar.webp', alt: 'Janela Editar custo fixo', marcas: [
          'O **valor** por mês.',
          'O **dia** que vence.',
          '**Ativo**: entra no custo da hora.',
        ] }],
        dica: 'Com vencimento, vira conta em **A pagar** todo mês.',
      },
      {
        id: 'mao',
        titulo: 'Sua mão de obra',
        imagens: [{ src: '/ajuda/custos-mao-obra.webp', alt: 'Janela Mão de obra', marcas: [
          'O **salário** que você quer.',
          'Quantas **horas** por dia.',
          'Os **dias** em que você produz.',
          'O app calcula a **sua hora**.',
        ] }],
      },
      {
        id: 'variaveis',
        titulo: 'Variáveis e invisíveis',
        imagens: [{ src: '/ajuda/custos-variaveis.webp', alt: 'Taxas da maquininha e custos invisíveis', marcas: [
          '**Variáveis**: a taxa da maquininha, em %.',
          '**Invisíveis**: gás, perdas e descartáveis, em %.',
          '**Editar** a porcentagem.',
        ] }],
        dica: 'A maioria usa entre **20% e 30%** de invisíveis.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Custo de cada produto' },
      { rota: '/ajuda/lucratividade', rotulo: 'Lucratividade', apoio: 'O lucro do mês' },
    ],
  },
  {
    slug: 'lucratividade',
    tema: 'preco',
    titulo: 'Lucratividade',
    resumo: 'Quanto sobrou de verdade.',
    minutos: 2,
    abrir: { rota: '/lucratividade', rotulo: 'Abrir Lucratividade' },
    secoes: [
      {
        id: 'periodo',
        titulo: 'Escolha o período',
        texto: ['Em **Menu**, abra **Financeiro** e toque em **Lucratividade**.'],
        imagens: [{ src: '/ajuda/lucro-periodo.webp', alt: 'Período e o mês escolhido', marcas: [
          'Hoje, 7 dias, 30 dias, mês ou **Escolher**.',
          'Troque o **mês**.',
        ] }],
      },
      {
        id: 'conta',
        titulo: 'A conta',
        imagens: [{ src: '/ajuda/lucro-conta.webp', alt: 'Vendido, ingredientes, taxas, despesas e lucro', marcas: [
          'Quanto você **vendeu**.',
          'O custo dos **ingredientes**, pela ficha.',
          '**Taxas**: maquininha e Pix pelo cardápio.',
          '**Despesas** lançadas no Financeiro.',
          'O **lucro** e a margem.',
        ] }],
        dica: 'Sem ficha técnica, o ingrediente **não entra** na conta.',
      },
      {
        id: 'produtos',
        titulo: 'Lucro por produto',
        imagens: [{ src: '/ajuda/lucro-produtos.webp', alt: 'Lucro por produto', marcas: [
          'Quanto cada produto **deu de lucro**.',
        ] }],
      },
      {
        id: 'equilibrio',
        titulo: 'Ponto de equilíbrio',
        imagens: [{ src: '/ajuda/lucro-equilibrio.webp', alt: 'Quanto vender no mês para pagar tudo', marcas: [
          'Quanto **vender no mês** para pagar tudo.',
          'Quanto **falta**.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Custo de cada produto' },
      { rota: '/ajuda/custos', rotulo: 'Custos da confeitaria', apoio: 'Fixos, mão de obra e taxas' },
    ],
  },
  {
    slug: 'financeiro',
    tema: 'financeiro',
    titulo: 'Como usar o Financeiro',
    resumo: 'O que entrou, saiu e sobrou.',
    minutos: 2,
    abrir: { rota: '/financeiro', rotulo: 'Abrir o Financeiro' },
    secoes: [
      {
        id: 'sobrou',
        titulo: 'Quanto sobrou',
        texto: ['Em **Menu**, toque em **Financeiro**. Também fica no Acesso rápido do Início.'],
        imagens: [{ src: '/ajuda/fin-sobrou.webp', alt: 'Período, quanto sobrou e o que entrou e saiu', marcas: [
          'Escolha o **período**.',
          'Quanto **sobrou** no período.',
          'O que **entrou** e o que **saiu**.',
        ] }],
      },
      {
        id: 'caixa',
        titulo: 'Caixa, a receber e a pagar',
        imagens: [{ src: '/ajuda/fin-caixa.webp', alt: 'Em caixa, A receber e A pagar', marcas: [
          '**Em caixa**: dinheiro e banco hoje.',
          '**A receber**: o que os clientes devem.',
          '**A pagar**: as contas que vão vencer.',
        ] }],
        dica: 'Toque em cada um para **ver a lista**.',
      },
      {
        id: 'lancar',
        titulo: 'Lançar entrada ou saída',
        imagens: [{ src: '/ajuda/fin-botoes.webp', alt: 'Botões Entrou, Saiu e Receber', marcas: [
          '**Entrou**: um dinheiro que chegou.',
          '**Saiu**: uma compra ou despesa.',
          '**Receber**: o pagamento de um pedido.',
        ] }],
        dica: 'No computador: **Receber pedido**, **Entrada** e **Saída**, no topo.',
      },
      {
        id: 'saida',
        titulo: 'Uma compra',
        exemplo: 'Você comprou R$ 186,40 de ingredientes.',
        imagens: [{ src: '/ajuda/fin-saida.webp', alt: 'Janela Nova saída', marcas: [
          '**Quanto** foi.',
          '**Já paguei** ou **Vou pagar** depois.',
          'Com o **quê**.',
          'Toque em **Lançar saída**.',
        ] }],
        dica: '**Vou pagar** vira conta em **A pagar**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/a-receber', rotulo: 'A receber', apoio: 'O que falta o cliente pagar' },
      { rota: '/ajuda/a-pagar', rotulo: 'A pagar', apoio: 'As contas que vão vencer' },
      { rota: '/ajuda/transacoes', rotulo: 'Transações', apoio: 'O extrato dia a dia' },
    ],
  },
  {
    slug: 'a-receber',
    tema: 'financeiro',
    titulo: 'A receber',
    resumo: 'O que falta o cliente pagar.',
    minutos: 1,
    abrir: { rota: '/financeiro/a-receber', rotulo: 'Abrir A receber' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Quem falta pagar',
        texto: ['No **Financeiro**, toque em **A receber**.'],
        imagens: [{ src: '/ajuda/receber-lista.webp', alt: 'Atrasados e o pedido da Beatriz com o botão Receber', marcas: [
          '**Atrasados**, em 7 dias e depois.',
          'Quanto **falta** em cada pedido.',
          'Pagou? Toque em **Receber**.',
        ] }],
      },
      {
        id: 'receber',
        titulo: 'Registrar o pagamento',
        exemplo: 'A Beatriz pagou o resto no Pix.',
        imagens: [{ src: '/ajuda/receber-janela.webp', alt: 'Janela Receber com o valor e a forma de pagamento', marcas: [
          'Quanto **entrou agora**.',
          '**Como** ele pagou.',
          '**Quando** recebeu.',
          'Toque em **Confirmar recebimento**.',
        ] }],
        dica: 'Pagou tudo? O pedido fica **quitado**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/financeiro', rotulo: 'Como usar o Financeiro', apoio: 'O que entrou e saiu' },
      { rota: '/ajuda/pedido-aberto', rotulo: 'Dentro do pedido', apoio: 'Receber pela aba Pagamento' },
    ],
  },
  {
    slug: 'a-pagar',
    tema: 'financeiro',
    titulo: 'A pagar',
    resumo: 'As contas que vão vencer.',
    minutos: 1,
    abrir: { rota: '/financeiro/a-pagar', rotulo: 'Abrir A pagar' },
    secoes: [
      {
        id: 'contas',
        titulo: 'Suas contas',
        exemplo: 'A internet venceu ontem.',
        texto: ['No **Financeiro**, toque em **A pagar**.'],
        imagens: [{ src: '/ajuda/pagar-lista.webp', alt: 'Botão Nova conta e a conta de internet vencida', marcas: [
          'Lançar uma **Nova conta**.',
          'Mostra até o fim do mês. **Ver todas**.',
          'Pagou? Toque em **Pagar**.',
        ] }],
        dica: 'Só sai do caixa quando você toca em **Pagar**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/custos', rotulo: 'Custos fixos', apoio: 'Viram conta todo mês' },
      { rota: '/ajuda/financeiro', rotulo: 'Como usar o Financeiro', apoio: 'O que entrou e saiu' },
    ],
  },
  {
    slug: 'transacoes',
    tema: 'financeiro',
    titulo: 'Transações',
    resumo: 'O extrato dia a dia.',
    minutos: 1,
    abrir: { rota: '/financeiro/transacoes', rotulo: 'Abrir Transações' },
    secoes: [
      {
        id: 'extrato',
        titulo: 'O extrato',
        texto: ['No **Financeiro**, toque em **Ver tudo**, em Últimas movimentações.'],
        imagens: [{ src: '/ajuda/transacoes-extrato.webp', alt: 'Mês, busca e os lançamentos do dia', marcas: [
          'Troque o **mês**.',
          'Busque um **lançamento**.',
          'Toque para ver ou **estornar**.',
        ] }],
        dica: 'Estornado, ele fica **riscado** no extrato.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/financeiro', rotulo: 'Como usar o Financeiro', apoio: 'O que entrou e saiu' },
    ],
  },
  {
    slug: 'orcamentos',
    tema: 'orcamentos',
    titulo: 'Orçamentos (PRO)',
    resumo: 'Propostas que o cliente aprova.',
    minutos: 3,
    abrir: { rota: '/orcamentos', rotulo: 'Abrir Orçamentos' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Seus orçamentos',
        texto: ['Em **Menu**, toque em **Orçamentos**. É um recurso do plano **PRO**.'],
        imagens: [{ src: '/ajuda/orc-lista.webp', alt: 'Link de orçamento, botão Novo orçamento e a lista', marcas: [
          '**Copie** ou **compartilhe** o seu link.',
          'Ou monte um **Novo orçamento**.',
          '**Novos**, enviados, aprovados…',
          'Toque para **abrir**.',
        ] }],
        dica: 'Pedido pelo link **avisa** você.',
      },
      {
        id: 'proposta',
        titulo: 'A proposta',
        exemplo: 'A Beatriz quer bolo e salgados para 100 pessoas.',
        imagens: [{ src: '/ajuda/orc-proposta.webp', alt: 'Cliente, evento e itens do orçamento', marcas: [
          'A etapa **Proposta**.',
          'A **data**, o nome e o local do evento.',
          'Item **do cardápio**.',
          'Ou **personalizado**.',
        ] }],
        dica: 'Depois, toque em **Continuar**.',
      },
      {
        id: 'condicoes',
        titulo: 'As condições',
        imagens: [{ src: '/ajuda/orc-condicoes.webp', alt: 'Validade, sinal e forma de pagamento', marcas: [
          'Até quando **vale**.',
          'Quanto de **sinal** para reservar a data.',
          'Como ele **paga**.',
        ] }],
      },
      {
        id: 'enviar',
        titulo: 'Enviar',
        imagens: [{ src: '/ajuda/orc-enviar.webp', alt: 'Prévia do orçamento e os botões de envio', marcas: [
          'Assim **o cliente vê**.',
          '**Enviar no WhatsApp**.',
          '**Copiar link** ou **Baixar PDF**.',
        ] }],
        dica: 'Aprovou? Vira **pedido**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Para ver o lucro do orçamento' },
      { rota: '/ajuda/assinatura', rotulo: 'Plano PRO', apoio: 'O que o PRO libera' },
    ],
  },
  {
    slug: 'notificacoes',
    tema: 'conta',
    titulo: 'Avisos de pedido novo',
    resumo: 'O celular toca no pedido.',
    minutos: 1,
    abrir: { rota: '/configuracoes/notificacoes', rotulo: 'Abrir Notificações' },
    secoes: [
      {
        id: 'ligar',
        titulo: 'Ligar os avisos',
        texto: ['Em **Menu**, abra **Configurações** e toque em **Notificações e sons**.'],
        imagens: [{ src: '/ajuda/notificacoes.webp', alt: 'Som de pedido novo, toques e notificações no celular', marcas: [
          'Ligue o **som** de pedido novo.',
          'Escolha o **toque**.',
          '**Testar som**.',
          'Ligue as **notificações** no celular.',
        ] }],
        dica: 'Vale **só neste aparelho**. No iPhone, instale o app antes.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/instalar-app', rotulo: 'Instalar o app', apoio: 'No iPhone, precisa para os avisos' },
    ],
  },
  {
    slug: 'mensagens',
    tema: 'conta',
    titulo: 'Mensagens do WhatsApp',
    resumo: 'Os textos prontos do app.',
    minutos: 1,
    abrir: { rota: '/configuracoes/mensagens', rotulo: 'Abrir Mensagens' },
    secoes: [
      {
        id: 'lista',
        titulo: 'As mensagens',
        texto: ['Em **Cadastros**, toque em **Mensagens do WhatsApp**.'],
        imagens: [{ src: '/ajuda/mensagens-lista.webp', alt: 'Lista das mensagens prontas', marcas: [
          '**Pedido pelo cardápio**: o cliente manda.',
          '**Sobre o pedido**: você manda.',
          '**Parabéns** de aniversário.',
        ] }],
      },
      {
        id: 'editar',
        titulo: 'Trocar o texto',
        exemplo: 'Quer chamar o cliente pelo nome?',
        imagens: [{ src: '/ajuda/mensagens-editar.webp', alt: 'Janela da mensagem com o texto e a prévia', marcas: [
          'Escreva do **seu jeito**.',
          '**Colocar informação**: nome, número, data…',
          'Assim fica **no WhatsApp**.',
        ] }],
        dica: 'Entre asteriscos, o texto fica em **negrito** no WhatsApp.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/clientes', rotulo: 'Clientes', apoio: 'Quem compra de você' },
    ],
  },
  {
    slug: 'doo-ia',
    tema: 'conta',
    titulo: 'Doo IA, sua assistente',
    resumo: 'Preço, receita, pedido e textos.',
    minutos: 1,
    abrir: { rota: '/assistente-virtual', rotulo: 'Abrir a Doo IA' },
    secoes: [
      {
        id: 'pedir',
        titulo: 'O que pedir',
        exemplo: 'Quanto cobrar num bolo de 2 kg?',
        texto: ['No celular, a Doo fica no **topo do Início**. No computador, no **menu da lateral**.'],
        imagens: [{ src: '/ajuda/doo-inicio.webp', alt: 'Tela da Doo IA com os atalhos', marcas: [
          '**Calcular preço** de um bolo ou doce.',
          '**Novo pedido** pela conversa.',
          '**Criar receita** com as quantidades.',
        ] }],
        dica: 'No grátis: **10 mensagens por mês**. No PRO: 150 por dia.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Custo e lucro do produto' },
    ],
  },
  {
    slug: 'assinatura',
    tema: 'conta',
    titulo: 'Plano PRO',
    resumo: 'O que o PRO libera.',
    minutos: 1,
    abrir: { rota: '/minha-assinatura', rotulo: 'Abrir Minha assinatura' },
    secoes: [
      {
        id: 'plano',
        titulo: 'Minha assinatura',
        texto: ['Em **Menu**, toque em **Assinatura**. No plano grátis, ela mostra o que o PRO libera e o botão para assinar.'],
        imagens: [{ src: '/ajuda/assinatura.webp', alt: 'Plano PRO ativo com a próxima cobrança', marcas: [
          'A **próxima cobrança**.',
          'O que está **liberado**.',
          'Ver **todos os recursos**.',
        ] }],
        dica: 'Cancelar ou trocar o cartão: **Precisa de algo?**, logo abaixo.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/conta', rotulo: 'Configurações e conta', apoio: 'Nome, logo e senha' },
    ],
  },
  {
    slug: 'conta',
    tema: 'conta',
    titulo: 'Configurações e conta',
    resumo: 'Seus dados, senha e suporte.',
    minutos: 1,
    abrir: { rota: '/configuracoes', rotulo: 'Abrir Configurações' },
    secoes: [
      {
        id: 'ajustes',
        titulo: 'Os ajustes',
        texto: ['Em **Menu**, toque em **Configurações**.'],
        imagens: [{ src: '/ajuda/configuracoes.webp', alt: 'Configurações com a busca e os itens', marcas: [
          '**Busque** pelo nome: pix, senha…',
          '**Minha conta**: nome, logo e senha.',
          '**Atualizar app**: puxa a versão nova.',
          '**Avançado**: excluir a conta.',
        ] }],
      },
      {
        id: 'perfil',
        titulo: 'Nome, logo e senha',
        imagens: [{ src: '/ajuda/minha-conta.webp', alt: 'Janela Editar perfil', marcas: [
          'Trocar a **logo**.',
          'O seu **nome**.',
          'Trocar a **senha**.',
        ] }],
        dica: 'Para trocar o **e-mail**, fale com o suporte.',
      },
      {
        id: 'ajuda',
        titulo: 'Precisa de ajuda?',
        imagens: [{ src: '/ajuda/configuracoes-ajuda.webp', alt: 'Itens de ajuda nas configurações', marcas: [
          'Os **tutoriais** de cada tela.',
          'Fale com a gente no **WhatsApp**.',
          '**Relatar** um problema ou **sugerir** uma melhoria.',
        ] }],
        dica: 'Embaixo ficam os **Termos** e o **Sair da conta**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/assinatura', rotulo: 'Plano PRO', apoio: 'O que o PRO libera' },
      { rota: '/ajuda/relatar-sugerir', rotulo: 'Relatar ou sugerir', apoio: 'Fale com a equipe' },
    ],
  },
  {
    slug: 'busca-rapida',
    tema: 'primeiros',
    titulo: 'Busca rápida',
    resumo: 'Ache qualquer tela digitando.',
    minutos: 1,
    abrir: { rota: '/inicio', rotulo: 'Abrir o Início' },
    secoes: [
      {
        id: 'buscar',
        titulo: 'Achar uma tela',
        exemplo: 'Onde troco a chave Pix?',
        texto: [
          'No celular, use o campo **Buscar** do Início. No computador, o campo do topo ou as teclas **Ctrl + K** (no Mac, **⌘ + K**).',
          'Digite o que quer fazer, como **pix**, **cupom** ou **horário**, e toque no resultado para ir direto.',
        ],
        dica: 'Em **Configurações**, a busca do topo acha os ajustes.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/inicio', rotulo: 'A tela de Início', apoio: 'O seu dia em uma tela' },
    ],
  },
  {
    slug: 'novidades',
    tema: 'conta',
    titulo: 'Novidades',
    resumo: 'O que mudou no app.',
    minutos: 1,
    abrir: { rota: '/noticias', rotulo: 'Abrir Novidades' },
    secoes: [
      {
        id: 'lista',
        titulo: 'As novidades',
        texto: ['Em **Menu**, toque em **Novidades**. No computador, no **sino** do topo do menu.'],
        imagens: [{ src: '/ajuda/novidades.webp', alt: 'Lista de novidades do Doonly', marcas: [
          'Toque para **ler** a novidade.',
        ] }],
        dica: 'Tem novidade? O **sino** fica marcado.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/conta', rotulo: 'Configurações e conta', apoio: 'Seus dados e suporte' },
    ],
  },
  {
    slug: 'relatar-sugerir',
    tema: 'conta',
    titulo: 'Relatar ou sugerir',
    resumo: 'Fale com a equipe do Doonly.',
    minutos: 1,
    abrir: { rota: '/configuracoes', rotulo: 'Abrir Configurações' },
    secoes: [
      {
        id: 'relatar',
        titulo: 'Algo não funcionou',
        texto: [
          'Em **Configurações**, toque em **Relatar um problema**. Conte o que fez e o que aconteceu. Um print ajuda muito.',
          'Quer algo novo no app? Toque em **Sugerir uma melhoria** e conte o que falta.',
        ],
        dica: 'Com pressa? **Fale com o suporte** no WhatsApp.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/conta', rotulo: 'Configurações e conta', apoio: 'Seus dados e suporte' },
    ],
  },
]

export const artigoPorSlug = (slug?: string) => ARTIGOS.find(a => a.slug === slug)
export const artigosDoTema = (tema: TemaId) => ARTIGOS.filter(a => a.tema === tema)
export const semAcentoAjuda = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** (31/10 · 5.83) todo o texto do artigo, para a busca da Central */
export const textoDoArtigo = (a: ArtigoAjuda) => [
  a.titulo, a.resumo, a.intro || '', ...(a.pontos || []),
  ...(a.textos || []).flatMap(x => [x.titulo, ...(x.texto || []), ...(x.lista || []), ...(x.passos || []), x.dica || '']),
  ...(a.duvidas || []).flatMap(d => [d.p, d.r]),
  ...(a.esquema?.partes || []).flatMap(p => [p.titulo, p.texto]),
  ...a.secoes.flatMap(s => [s.titulo, s.exemplo || '', s.dica || '', ...(s.texto || []), ...(s.passos || []), ...(s.imagens || []).flatMap(im => [im.alt, ...(im.marcas || [])])]),
].join(' ').replace(/\*\*/g, '')
