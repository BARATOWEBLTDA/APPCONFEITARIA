/**
 * (25/10) Central de Ajuda: os assuntos e os artigos (um tutorial por tela, no formato do "Como funciona").
 * Texto com **negrito** entre dois asteriscos. (27/10) Todas as telas, no formato do piloto de Pedidos:
 * prints em public/ajuda (1170 px, anéis rosa numerados na ordem das "marcas").
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
  { id: 'orcamentos', nome: 'Orçamentos', apoio: 'Propostas que a cliente aprova' },
  { id: 'conta', nome: 'Conta e PRO', apoio: 'Plano, avisos e suporte' },
]

export const ARTIGOS: ArtigoAjuda[] = [
  {
    slug: 'primeiros-passos',
    tema: 'primeiros',
    titulo: 'Deixar a loja pronta',
    resumo: 'Os 7 passos para o cardápio abrir.',
    minutos: 3,
    abrir: { rota: '/inicio', rotulo: 'Abrir o Início' },
    intro: 'Antes de vender pelo cardápio, a loja precisa de 7 informações básicas: a logo, uma frase sobre você, o endereço, o horário, como a cliente paga, o saldo do caixa e o primeiro produto. O cartão dos passos fica no Início e mostra sempre o próximo que falta.',
    pontos: [
      'Cada passo é salvo na hora',
      'Dá para pular e voltar depois',
      'Pronto, o cartão sai do Início',
    ],
    esquema: {
      tela: 'Início',
      rota: '/inicio',
      blocos: [
        { n: 1, titulo: 'Seu cardápio quase no ar', linhas: [{ t: '4 de 7 prontos', tipo: 'nota' }, { t: '', tipo: 'barra' }] },
        { n: 2, linhas: [{ t: 'Sobre a confeitaria', tipo: 'linha' }, { t: 'Fazer agora', tipo: 'botao' }] },
        { n: 3, linhas: [{ t: 'Logo da loja', tipo: 'check' }, { t: 'Endereço', tipo: 'linha' }, { t: 'Horário', tipo: 'linha' }, { t: 'Ver todos os 7 passos', tipo: 'nota' }] },
      ],
      partes: [
        { titulo: 'Quanto falta', texto: 'A barra mostra quantos dos 7 passos já estão prontos. Ela enche a cada passo salvo.', el: '.pp--banner .ppb-topo' },
        { titulo: 'O próximo passo', texto: 'O app mostra sempre o passo que falta. Fazer agora abre uma janela só com ele, sem sair do Início.', el: '.ppb-at' },
        { titulo: 'Todos os passos', texto: 'Mostra a lista completa. Os prontos ficam com visto verde. Toque num que falta para fazer na hora.', el: '.ppb-ver' },
      ],
    },
    textos: [
      {
        titulo: 'Os 7 passos',
        lista: [
          '**Logo da loja:** aparece no topo do cardápio.',
          '**Sobre a confeitaria:** uma frase curta embaixo do nome. A Doo IA pode escrever para você.',
          '**Endereço:** a cliente vê onde retirar, e o app usa para calcular a entrega.',
          '**Horário:** fora dele, o cardápio aparece fechado.',
          '**Pagamento e entrega:** Pix, dinheiro, cartão, retirada ou entrega.',
          '**Saldo do caixa:** quanto dinheiro você tem hoje, para o Financeiro começar certo.',
          '**Primeiro produto:** abre a tela Produtos para cadastrar.',
        ],
      },
      {
        titulo: 'Salvar e continuar',
        texto: [
          'Cada janela tem o botão **Salvar e continuar**. Ao salvar, o passo ganha o visto verde e a janela do próximo já abre, na ordem.',
          'Sem tempo agora? Toque em **Agora não**. O app pula para o próximo, e o que ficou para trás continua na lista.',
        ],
      },
      {
        titulo: 'Quando termina',
        texto: [
          'Com os 7 prontos, o cartão vira **Seu cardápio está no ar!**, com os botões para compartilhar o link e ver o cardápio. Depois, é só fechar no X.',
          'Tudo o que você preencheu continua em **Minha loja**, para mudar quando quiser.',
        ],
      },
    ],
    duvidas: [
      { p: 'Fechei a janela sem querer.', r: 'Nada se perde. Toque de novo em Fazer agora ou no passo, na lista.' },
      { p: 'Posso mudar depois?', r: 'Pode. Logo, descrição, endereço, horário e pagamento ficam em Minha loja, no menu de baixo.' },
      { p: 'O cartão sumiu do Início.', r: 'Ele sai quando os 7 passos ficam prontos. Para conferir a loja, abra Minha loja.' },
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
        { titulo: 'Avisos', texto: 'Pedidos novos para aceitar e entregas que já passaram da hora. Ver abre a lista certa em Pedidos.', el: '.ini-section--novos' },
        { titulo: 'Buscar', texto: 'Digite o que procura, como pix, cupom ou horário, e vá direto para a tela.', el: '.ini-busca' },
        { titulo: 'Acesso rápido', texto: 'As 6 telas mais usadas no dia a dia. As outras ficam no Menu, no menu de baixo.', el: '.ini-section--nav' },
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
          'Em **Menu** ficam todas as outras telas: Financeiro, Produtos, Clientes, Configurações e o resto.',
        ],
      },
    ],
    duvidas: [
      { p: 'O Início está quase vazio.', r: 'Sem pedidos e sem pendências, ele mostra só o essencial. Os avisos aparecem quando chega pedido.' },
      { p: 'Onde fica o Financeiro?', r: 'No Acesso rápido do Início e no Menu, no menu de baixo.' },
      { p: 'No computador é diferente?', r: 'É. No computador, o Início mostra os números do mês e o menu fica na lateral.' },
    ],
    secoes: [],
    relacionadas: [
      { rota: '/ajuda/primeiros-passos', rotulo: 'Deixar a loja pronta', apoio: 'Os 7 passos' },
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
        { n: 1, titulo: 'App', linhas: [{ t: 'Instalar o app', tipo: 'linha' }] },
        { n: 2, linhas: [{ t: 'Notificações e sons', tipo: 'linha' }] },
      ],
      partes: [
        { titulo: 'Instalar o app', texto: 'Abre o passo a passo certo para o seu aparelho: iPhone, Android ou computador.', el: '.cf9-item[data-nome="Instalar o app"]' },
        { titulo: 'Notificações e sons', texto: 'Depois de instalar, ligue aqui o aviso de pedido novo.', el: '.cf9-item[data-nome="Notificações e sons"]' },
      ],
    },
    textos: [
      {
        titulo: 'No iPhone',
        texto: ['Abra o Doonly no **Safari**. Aberto pelo Instagram ou pelo WhatsApp, a Apple não deixa instalar: copie o link e cole no Safari.'],
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
        dica: 'Sem botão? Menu **⋮** do Chrome.',
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
        exemplo: 'A Daniela pediu salgados.',
        imagens: [{ src: '/ajuda/pedidos-aceitar.webp', alt: 'Aba Para aceitar com o pedido da Daniela', marcas: [
          'Abra **Para aceitar**.',
          'Toque em **Aceitar**.',
          'Ou aceite **todos** de uma vez.',
        ] }],
        dica: 'Aceito, ele vai para **Agendados**.',
      },
      {
        id: 'produzir',
        titulo: 'Começar a fazer',
        imagens: [{ src: '/ajuda/pedidos-produzir.webp', alt: 'Pedido da Daniela em Agendados com o botão Produzir', marcas: [
          'Começou? Toque em **Produzir**.',
        ] }],
        dica: 'Em laranja: o que **falta receber**.',
      },
      {
        id: 'pronto',
        titulo: 'Marcar como pronto',
        imagens: [{ src: '/ajuda/pedidos-pronto.webp', alt: 'Pedido da Daniela com o botão Pronto', marcas: [
          'Terminou? Toque em **Pronto**.',
        ] }],
      },
      {
        id: 'entregar',
        titulo: 'Entregar',
        imagens: [{ src: '/ajuda/pedidos-entregar.webp', alt: 'Aba Prontos com o botão Retirado', marcas: [
          'Ele vai para a aba **Prontos**.',
          'Buscou? Toque em **Retirado**.',
        ] }],
        dica: 'Na entrega: **Saiu para entrega**.',
      },
      {
        id: 'achar',
        titulo: 'Achar um pedido',
        imagens: [
          { src: '/ajuda/pedidos-buscar.webp', alt: 'Busca e botão de filtro', marcas: [
            'Busque por **nome** ou **número**.',
            'Abra o **filtro**.',
          ] },
          { src: '/ajuda/pedidos-filtro.webp', alt: 'Filtro aberto na lateral', alta: true, marcas: [
            'Escolha as **situações**.',
            'Escolha a **data**.',
            'Toque em **Ver pedidos**.',
          ] },
        ],
      },
      {
        id: 'dentro',
        titulo: 'Dentro do pedido',
        exemplo: 'Toque no pedido para abrir.',
        imagens: [{ src: '/ajuda/pedidos-dentro.webp', alt: 'Pedido aberto', marcas: [
          'Leva para a **próxima etapa**.',
          '**Mais ações**: PDF, cancelar…',
        ] }],
      },
      {
        id: 'nova',
        titulo: 'Pedido do balcão',
        exemplo: 'Veio pelo WhatsApp?',
        imagens: [{ src: '/ajuda/pedidos-nova-venda.webp', alt: 'Botão mais no menu de baixo', marcas: [
          'Toque no **+**: **Nova venda**.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/agenda', rotulo: 'Agenda', apoio: 'Os pedidos no calendário' },
      { rota: '/vendas/novo', rotulo: 'Nova venda', apoio: 'Registrar um pedido à mão' },
      { rota: '/financeiro/a-receber', rotulo: 'A receber', apoio: 'O que falta a cliente pagar' },
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
        exemplo: 'O bolo da Beatriz já está agendado.',
        imagens: [{ src: '/ajuda/pedido-etapas.webp', alt: 'Situação do pedido com as 5 etapas e o botão Produzir', marcas: [
          'As **5 etapas** do pedido.',
          'Leva para a **próxima etapa**.',
          '**Mais ações**: PDF, cancelar…',
        ] }],
      },
      {
        id: 'itens',
        titulo: 'Cliente e itens',
        imagens: [{ src: '/ajuda/pedido-itens.webp', alt: 'Cartão da cliente e itens do pedido', marcas: [
          '**Trocar** a cliente.',
          'Chame no **WhatsApp** ou ligue.',
          '**Adicionar item** ao pedido.',
          'Altere ou remova o **item**.',
        ] }],
      },
      {
        id: 'entrega',
        titulo: 'Entrega',
        texto: ['Toque na aba **Entrega**.'],
        imagens: [{ src: '/ajuda/pedido-entrega.webp', alt: 'Aba Entrega com data, horário e endereço', marcas: [
          '**Entrega** ou **Retirada**.',
          'Mude a **data** e o **horário**.',
          'Abra o endereço no **mapa**.',
          'Mande para o **entregador**.',
        ] }],
      },
      {
        id: 'pagamento',
        titulo: 'Receber o pagamento',
        exemplo: 'A Beatriz pagou o resto.',
        texto: ['Toque na aba **Pagamento**.'],
        imagens: [{ src: '/ajuda/pedido-pagamento.webp', alt: 'Aba Pagamento com o valor recebido e o que falta', marcas: [
          '**Desconto** ou valor a mais.',
          'Quanto **entrou** e quanto **falta**.',
          '**Registrar recebimento**.',
          'Data **combinada** para o resto.',
        ] }],
        dica: 'Entra no **Financeiro** na hora.',
      },
      {
        id: 'mais',
        titulo: 'Mais ações',
        texto: ['Toque nos **três pontinhos** do topo.'],
        imagens: [{ src: '/ajuda/pedido-mais.webp', alt: 'Menu de mais ações do pedido', marcas: [
          '**Imprimir** ou baixar o **PDF**.',
          'Voltar ou pular uma **etapa**.',
          '**Cancelar** o pedido.',
        ] }],
        dica: '**Acompanhar**: o que a cliente vê.',
      },
    ],
    relacionadas: [
      { rota: '/pedidos', rotulo: 'Pedidos', apoio: 'Aceitar, produzir e entregar' },
      { rota: '/financeiro/a-receber', rotulo: 'A receber', apoio: 'O que falta a cliente pagar' },
      { rota: '/configuracoes/mensagens', rotulo: 'Mensagens do WhatsApp', apoio: 'Textos prontos para a cliente' },
    ],
  },
  {
    slug: 'nova-venda',
    tema: 'vendas',
    titulo: 'Registrar uma venda',
    resumo: 'Pedido do WhatsApp ou balcão.',
    minutos: 2,
    abrir: { rota: '/vendas/novo', rotulo: 'Abrir Nova venda' },
    secoes: [
      {
        id: 'produtos',
        titulo: 'O que ela pediu',
        exemplo: 'A Natália pediu no WhatsApp.',
        texto: ['Toque no **+** do menu de baixo.'],
        imagens: [{ src: '/ajuda/nova-venda-produtos.webp', alt: 'Passo 1 com o tipo de venda e o Bolo Brigadeiro adicionado', marcas: [
          '**Encomenda** ou **Pronta entrega**.',
          'Mude a **quantidade**.',
          'Adicione **outro produto**.',
        ] }],
        dica: 'Depois, toque em **Continuar**.',
      },
      {
        id: 'cliente',
        titulo: 'Para quem é',
        imagens: [{ src: '/ajuda/nova-venda-cliente.webp', alt: 'Passo 2 com a busca e a lista de clientes', marcas: [
          'Busque pelo **nome** ou **telefone**.',
          'Cliente nova? **Cadastre** aqui.',
          '**Sem cliente**: venda avulsa.',
          'Ou toque em uma **cliente**.',
        ] }],
      },
      {
        id: 'entrega',
        titulo: 'Retirada ou entrega',
        imagens: [{ src: '/ajuda/nova-venda-entrega.webp', alt: 'Passo 3 com retirada, data e horário', marcas: [
          'Ela vem **buscar**.',
          'Ou você **entrega**.',
          'Escolha a **data**.',
          'E o **horário**, se quiser.',
        ] }],
      },
      {
        id: 'pagamento',
        titulo: 'Quanto já entrou',
        exemplo: 'Ela mandou R$ 50,00 de sinal no Pix.',
        imagens: [{ src: '/ajuda/nova-venda-pagamento.webp', alt: 'Passo 4 com o sinal de 50 reais no Pix', marcas: [
          'Escolha **Só uma parte (sinal)**.',
          'Escreva **quanto ela pagou**.',
          'Escolha **como ela pagou**.',
        ] }],
        dica: 'O que falta vai para **A receber**.',
      },
      {
        id: 'revisar',
        titulo: 'Conferir e registrar',
        imagens: [{ src: '/ajuda/nova-venda-revisar.webp', alt: 'Passo 5 com a situação do pedido e o resumo', marcas: [
          'Em que **situação** o pedido entra.',
          'Algo errado? **Editar**.',
        ] }],
        dica: 'Tudo certo? **Registrar venda**.',
      },
    ],
    relacionadas: [
      { rota: '/pedidos', rotulo: 'Pedidos', apoio: 'Aceitar, produzir e entregar' },
      { rota: '/agenda', rotulo: 'Agenda', apoio: 'Os pedidos no calendário' },
      { rota: '/clientes', rotulo: 'Clientes', apoio: 'Quem compra de você' },
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
        exemplo: 'Cada bolinha é um pedido.',
        imagens: [{ src: '/ajuda/agenda-mes.webp', alt: 'Calendário do mês com bolinhas coloridas nos dias', marcas: [
          'Troque o **mês**.',
          'Toque no **dia**.',
          'Cada **cor** é uma situação.',
        ] }],
        dica: '**Vermelho** é pedido atrasado.',
      },
      {
        id: 'dia',
        titulo: 'Os pedidos do dia',
        exemplo: 'Toque no dia 28.',
        imagens: [{ src: '/ajuda/agenda-dia.webp', alt: 'Dia 28 escolhido com o primeiro pedido do dia', marcas: [
          'O dia e quanto **falta receber**.',
          '**Imprimir o dia** para a produção.',
          'Toque no nome para **abrir**.',
          'Chame a cliente no **WhatsApp**.',
        ] }],
      },
      {
        id: 'atencao',
        titulo: 'Precisa de atenção',
        imagens: [{ src: '/ajuda/agenda-atencao.webp', alt: 'Pedidos atrasados no topo da Agenda', marcas: [
          'Os **atrasados** ficam no topo.',
          'Leva para a **próxima etapa**.',
        ] }],
        dica: 'Dia vazio? Veja os **próximos**.',
      },
      {
        id: 'buscar',
        titulo: 'Achar um pedido',
        imagens: [{ src: '/ajuda/agenda-buscar.webp', alt: 'Busca e botão de filtro da Agenda', marcas: [
          'Busque por **nome** ou **número**.',
          'O **filtro** escolhe as situações.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/pedidos', rotulo: 'Pedidos', apoio: 'Aceitar, produzir e entregar' },
      { rota: '/vendas/novo', rotulo: 'Nova venda', apoio: 'Registrar um pedido à mão' },
      { rota: '/financeiro/a-receber', rotulo: 'A receber', apoio: 'O que falta a cliente pagar' },
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
        exemplo: 'Mande o cardápio no status.',
        texto: ['Toque em **Minha loja**, embaixo.'],
        imagens: [{ src: '/ajuda/loja-link.webp', alt: 'Cartão da loja com a chave e os botões do link', marcas: [
          '**Pausar** os pedidos na hora.',
          '**Enviar** pelo WhatsApp.',
          '**Copiar** o link.',
          '**Ver** como a cliente vê.',
          '**QR Code** para imprimir.',
        ] }],
        dica: 'Pausar não muda o seu **horário**.',
      },
      {
        id: 'cliente',
        titulo: 'O que a cliente vê',
        imagens: [{ src: '/ajuda/loja-cliente.webp', alt: 'Lista A loja para o cliente', marcas: [
          'Toque para trocar a **logo**.',
          'Nome, WhatsApp e **descrição**.',
          'Cores, foto do topo e **banners**.',
          '**Instagram** e **Facebook**.',
        ] }],
        dica: 'A linha mostra **como está**.',
      },
      {
        id: 'sobre',
        titulo: 'Nome e descrição',
        texto: ['Toque em **Sobre a loja**.'],
        imagens: [{ src: '/ajuda/loja-sobre.webp', alt: 'Janela Sobre a loja com nome, WhatsApp e descrição', marcas: [
          'O **nome** da loja.',
          'O **WhatsApp** dos pedidos.',
          'Uma **descrição** curta.',
          'Sem ideia? **Escrever com IA**.',
        ] }],
        dica: 'Tudo é **salvo na hora**.',
      },
    ],
    relacionadas: [
      { rota: '/cardapio-design', rotulo: 'Aparência', apoio: 'Cores, topo e banners' },
      { rota: '/ajuda/horario-entrega-pagamento', rotulo: 'Horário e entrega', apoio: 'Como você vende' },
      { rota: '/produtos', rotulo: 'Produtos', apoio: 'O que aparece no cardápio' },
    ],
  },
  {
    slug: 'horario-entrega-pagamento',
    tema: 'cardapio',
    titulo: 'Horário e entrega',
    resumo: 'Quando atende e como recebe.',
    minutos: 3,
    abrir: { rota: '/cardapio', rotulo: 'Abrir Minha loja' },
    secoes: [
      {
        id: 'horario',
        titulo: 'Horário',
        texto: ['Em **Minha loja**, toque em **Horário**.'],
        imagens: [{ src: '/ajuda/loja-horario.webp', alt: 'Janela Horário com os dias e as horas', marcas: [
          'Ligue os **dias** que você atende.',
          'Toque no dia para tirar ou pôr.',
          'Mude a hora que **abre** e **fecha**.',
        ] }],
        dica: 'Fora dele, o cardápio **fecha**.',
      },
      {
        id: 'entrega',
        titulo: 'Entrega',
        exemplo: 'Você entrega no Centro por R$ 8,00.',
        texto: ['Toque em **Entrega**.'],
        imagens: [{ src: '/ajuda/loja-entrega.webp', alt: 'Janela Entrega com retirada, entrega própria e taxa por bairro', marcas: [
          'A cliente **busca** com você.',
          'Você **leva** até ela.',
          'Taxa **única** ou **por bairro**.',
          '**Adicionar bairro** e a taxa.',
        ] }],
        dica: 'Taxa **0** é entrega grátis.',
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
        exemplo: 'A cliente paga o sinal no Pix ao pedir.',
        texto: ['Toque em **Pix pelo cardápio**.'],
        imagens: [{ src: '/ajuda/loja-pix.webp', alt: 'Janela Pix pelo cardápio ligada com a chave e o sinal', marcas: [
          'Ligue o **Pix pelo cardápio**.',
          'O **tipo da chave** e a chave.',
          'Sinal, total ou **ela escolhe**.',
          'Quanto é o **sinal**.',
        ] }],
        dica: 'Você confere o Pix em **Pedidos**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/minha-loja', rotulo: 'Minha loja', apoio: 'O link e o que a cliente vê' },
      { rota: '/pedidos', rotulo: 'Pedidos', apoio: 'Aceitar e conferir o Pix' },
    ],
  },
  {
    slug: 'aparencia',
    tema: 'cardapio',
    titulo: 'Aparência do cardápio',
    resumo: 'Foto, banners e cores.',
    minutos: 2,
    abrir: { rota: '/cardapio-design', rotulo: 'Abrir Aparência' },
    secoes: [
      {
        id: 'tema',
        titulo: 'Tema',
        texto: ['Em **Minha loja**, toque em **Aparência**.'],
        imagens: [{ src: '/ajuda/aparencia-tema.webp', alt: 'Tema do cardápio Normal e Natal', marcas: [
          '**Natal** enfeita o cardápio.',
        ] }],
        dica: 'Tudo é **salvo na hora**.',
      },
      {
        id: 'topo',
        titulo: 'Foto do topo e logo',
        imagens: [{ src: '/ajuda/aparencia-topo.webp', alt: 'Prévia do topo do cardápio com os botões de trocar', marcas: [
          '**Trocar foto** do topo.',
          '**Trocar logo**.',
        ] }],
        dica: 'Use uma foto **clara** dos doces.',
      },
      {
        id: 'banners',
        titulo: 'Banners de promoção',
        exemplo: 'Frete grátis nesta semana.',
        imagens: [{ src: '/ajuda/aparencia-banners.webp', alt: 'Quatro espaços de banner, um preenchido', marcas: [
          'O banner que está no **cardápio**.',
          '**Adicionar** a sua imagem.',
          'Ou **use um banner pronto**.',
        ] }],
        dica: 'Imagem **deitada**: 1200 × 675.',
      },
      {
        id: 'link',
        titulo: 'Nome no link',
        imagens: [{ src: '/ajuda/aparencia-link.webp', alt: 'Nome da loja no link do cardápio', marcas: [
          'Escreva o **nome** da loja.',
          'Assim fica o **link**.',
        ] }],
        dica: 'Recurso do plano **PRO**.',
      },
      {
        id: 'cores',
        titulo: 'Cores',
        texto: ['A prévia mostra **onde fica**.'],
        imagens: [{ src: '/ajuda/aparencia-cores.webp', alt: 'Cores do topo com a prévia numerada', marcas: [
          'Toque em uma **cor**.',
          '**+** escolhe qualquer cor.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/minha-loja', rotulo: 'Minha loja', apoio: 'O link e o que a cliente vê' },
      { rota: '/ajuda/destaques', rotulo: 'Destaques', apoio: 'Os produtos no topo do cardápio' },
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
        texto: ['No **Menu**, toque em **Marketing**.'],
        imagens: [{ src: '/ajuda/cupons-lista.webp', alt: 'Lista de cupons com a situação e o botão Compartilhar', marcas: [
          '**Ativo** ou **Pausado**.',
          '**Compartilhar** o cupom.',
          'Criar um **Novo cupom**.',
        ] }],
        dica: 'Os **2 mais novos** ficam no topo.',
      },
      {
        id: 'novo',
        titulo: 'Criar um cupom',
        exemplo: '10% no primeiro pedido.',
        imagens: [{ src: '/ajuda/cupons-novo.webp', alt: 'Janela Novo cupom preenchida com BEMVINDO10', marcas: [
          'O **código** que a cliente digita.',
          'Quanto de **desconto**.',
          'Para **todas** ou só **cliente nova**.',
          'Se quiser, **datas**, limite e mínimo.',
          'Toque em **Criar cupom**.',
        ] }],
        dica: '**1 cupom** por pedido.',
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
      { rota: '/ajuda/destaques', rotulo: 'Destaques', apoio: 'Os produtos no topo do cardápio' },
      { rota: '/cardapio', rotulo: 'Minha loja', apoio: 'Divulgar o link' },
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
        texto: ['Em **Produtos**, toque no produto.'],
        imagens: [{ src: '/ajuda/destaques-mais.webp', alt: 'Menu Mais do produto com Destacar no cardápio', marcas: [
          'Toque em **Mais**.',
          'Toque em **Destacar no cardápio**.',
        ] }],
        dica: 'Até **6** produtos em destaque.',
      },
      {
        id: 'lista',
        titulo: 'Na sua lista',
        imagens: [{ src: '/ajuda/destaques-lista.webp', alt: 'Lista de produtos com estrela nos destacados', marcas: [
          'A **estrela** mostra o destaque.',
        ] }],
        dica: 'Ou em **Editar produto**.',
      },
      {
        id: 'cardapio',
        titulo: 'No cardápio',
        imagens: [{ src: '/ajuda/destaques-cardapio.webp', alt: 'Seção Destaques no topo do cardápio', marcas: [
          '**Destaques** é a primeira parte.',
          'Com fotos **grandes**.',
        ] }],
        dica: 'Saiu do cardápio? Sai daqui.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/produtos', rotulo: 'Produtos', apoio: 'Cadastrar e editar' },
      { rota: '/ajuda/cupons', rotulo: 'Cupons', apoio: 'Desconto para vender mais' },
    ],
  },
  {
    slug: 'produtos',
    tema: 'cadastros',
    titulo: 'Cadastrar um produto',
    resumo: 'Nome, fotos e preço.',
    minutos: 3,
    abrir: { rota: '/produtos', rotulo: 'Abrir Produtos' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Seus produtos',
        imagens: [{ src: '/ajuda/produto-lista.webp', alt: 'Lista de produtos com a chave e o lucro estimado', marcas: [
          'Toque em **Novo**.',
          'A **chave** tira do cardápio.',
          'O **lucro** de cada venda.',
        ] }],
        dica: 'Sem ficha? **Criar ficha técnica**.',
      },
      {
        id: 'sobre',
        titulo: 'Sobre o produto',
        exemplo: 'Um bolo de paçoca.',
        imagens: [{ src: '/ajuda/produto-sobre.webp', alt: 'Passo 1 com nome, descrição e categoria', marcas: [
          'O **nome** do produto.',
          'A descrição. A IA **melhora** o texto.',
          'A **categoria**, como Bolos.',
        ] }],
      },
      {
        id: 'escolhas',
        titulo: 'O que a cliente escolhe',
        imagens: [{ src: '/ajuda/produto-escolhas.webp', alt: 'Passo 2 com tamanho, massa e recheio', marcas: [
          'Marque **Tamanho** se tiver.',
          'E **Recheio**, Sabor…',
        ] }],
        dica: 'Sem opções? Só **continue**.',
      },
      {
        id: 'fotos',
        titulo: 'Fotos',
        imagens: [{ src: '/ajuda/produto-fotos.webp', alt: 'Passo 3 com a foto principal e espaço para mais 3', marcas: [
          'A foto do **cardápio**.',
          'Até **3 fotos** a mais.',
          '**Dicas** para a foto vender.',
        ] }],
      },
      {
        id: 'preco',
        titulo: 'Preço',
        imagens: [{ src: '/ajuda/produto-preco.webp', alt: 'Passo 4 com preço, unidade, promoção e tipo de entrega', marcas: [
          'O **preço**.',
          'Por **quilo**, unidade ou cento.',
          'Se quiser, uma **promoção**.',
          'Pronta ou **sob encomenda**.',
        ] }],
        dica: 'Aqui também tem o **Destacar**.',
      },
      {
        id: 'publicar',
        titulo: 'Conferir e publicar',
        imagens: [{ src: '/ajuda/produto-revisar.webp', alt: 'Passo 5 com a prévia e o botão Publicar produto', marcas: [
          'Assim fica no **cardápio**.',
          'Toque em **Publicar produto**.',
        ] }],
        dica: 'Depois, monte a **ficha técnica**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Custo e lucro do produto' },
      { rota: '/ajuda/categorias', rotulo: 'Categorias', apoio: 'Organizar o cardápio' },
      { rota: '/ajuda/destaques', rotulo: 'Destaques', apoio: 'Os produtos no topo do cardápio' },
    ],
  },
  {
    slug: 'categorias',
    tema: 'cadastros',
    titulo: 'Categorias do cardápio',
    resumo: 'Organize o cardápio.',
    minutos: 1,
    abrir: { rota: '/categorias', rotulo: 'Abrir Categorias' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Suas categorias',
        imagens: [{ src: '/ajuda/categorias-lista.webp', alt: 'Lista de categorias com Bolos, Doces e Especiais', marcas: [
          'Criar uma **Nova**.',
          'Toque para **editar**.',
          'Mais **opções**.',
        ] }],
        dica: 'O cardápio segue **esta ordem**.',
      },
      {
        id: 'nova',
        titulo: 'Criar uma categoria',
        exemplo: 'Uma categoria para os salgados.',
        imagens: [{ src: '/ajuda/categorias-nova.webp', alt: 'Janela Nova categoria com o nome Salgados', marcas: [
          'Escreva o **nome**.',
          'A **foto** pode ser automática.',
          'Toque em **Criar categoria**.',
        ] }],
        dica: 'O produto escolhe no **cadastro**.',
      },
      {
        id: 'ordem',
        titulo: 'Mudar a ordem',
        texto: ['Toque nos **três pontinhos**.'],
        imagens: [{ src: '/ajuda/categorias-opcoes.webp', alt: 'Opções da categoria Doces', marcas: [
          '**Editar** o nome e a foto.',
          '**Subir** ou descer na ordem.',
          '**Excluir** a categoria.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/produtos', rotulo: 'Produtos', apoio: 'Cadastrar e editar' },
      { rota: '/ajuda/complementos', rotulo: 'Complementos', apoio: 'Extras que a cliente escolhe' },
    ],
  },
  {
    slug: 'complementos',
    tema: 'cadastros',
    titulo: 'Complementos',
    resumo: 'Topo de bolo, vela, escrita.',
    minutos: 2,
    abrir: { rota: '/complementos', rotulo: 'Abrir Complementos' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Seus complementos',
        imagens: [{ src: '/ajuda/complementos-lista.webp', alt: 'Lista de complementos e a prévia do cardápio', marcas: [
          'Criar um **Novo**.',
          'Toque para **editar**.',
          'Assim a **cliente vê**.',
        ] }],
      },
      {
        id: 'novo',
        titulo: 'Criar um complemento',
        exemplo: 'Topo de bolo por R$ 15,00.',
        imagens: [{ src: '/ajuda/complementos-novo.webp', alt: 'Janela Novo complemento preenchida com Topo de bolo', marcas: [
          'O **nome** do extra.',
          'Quanto **soma** no pedido.',
          'Peça uma **foto** de referência.',
          'Em quais **produtos** aparece.',
          'Toque em **Criar**.',
        ] }],
        dica: 'O preço muda em **todos**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/produtos', rotulo: 'Produtos', apoio: 'Cadastrar e editar' },
      { rota: '/ajuda/categorias', rotulo: 'Categorias', apoio: 'Organizar o cardápio' },
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
        imagens: [{ src: '/ajuda/clientes-lista.webp', alt: 'Números dos clientes e a lista com o botão do WhatsApp', marcas: [
          'Seus **números**.',
          'Cadastrar um **Novo**.',
          'Toque para ver a **cliente**.',
          'Abre o **WhatsApp** dela.',
        ] }],
        dica: 'Pelo cardápio, entra **sozinha**.',
      },
      {
        id: 'novo',
        titulo: 'Cadastrar uma cliente',
        exemplo: 'A Ana Beatriz pediu pelo WhatsApp.',
        imagens: [{ src: '/ajuda/clientes-novo.webp', alt: 'Janela Novo cliente com nome e WhatsApp', marcas: [
          'O **nome**.',
          'O **WhatsApp**.',
          'O **aniversário**, se souber.',
          'Toque em **Cadastrar cliente**.',
        ] }],
        dica: 'O app **lembra** os parabéns.',
      },
      {
        id: 'perfil',
        titulo: 'Tudo da cliente',
        imagens: [{ src: '/ajuda/clientes-perfil.webp', alt: 'Perfil da Daniela com os números e os pedidos', marcas: [
          'Fale no **WhatsApp**.',
          '**Nova venda** já com ela.',
          'Quanto ela **já comprou**.',
          'Os **pedidos** dela.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/nova-venda', rotulo: 'Nova venda', apoio: 'Registrar um pedido à mão' },
      { rota: '/configuracoes/mensagens', rotulo: 'Mensagens do WhatsApp', apoio: 'Textos prontos para a cliente' },
    ],
  },
  {
    slug: 'ingredientes',
    tema: 'cadastros',
    titulo: 'Ingredientes',
    resumo: 'O que você compra.',
    minutos: 2,
    abrir: { rota: '/insumos', rotulo: 'Abrir Ingredientes' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Sua lista',
        imagens: [{ src: '/ajuda/ingredientes-lista.webp', alt: 'Lista de ingredientes com o custo de cada um', marcas: [
          'Cadastrar um **Novo**.',
          '**Filtro**: ingredientes, embalagens…',
          'Toque para **editar**.',
          'Quanto custa **na receita**.',
        ] }],
      },
      {
        id: 'preco',
        titulo: 'Quanto você pagou',
        exemplo: 'Leite condensado: 395 g por R$ 7,49.',
        imagens: [{ src: '/ajuda/ingredientes-editar.webp', alt: 'Janela do leite condensado com medida, quantidade e preço', marcas: [
          'A **medida**: g, kg, ml…',
          '**Quanto vem** na embalagem.',
          '**Quanto pagou**.',
          'O app calcula o **custo na receita**.',
          'Toque em **Salvar**.',
        ] }],
        dica: 'As **fichas** se atualizam sozinhas.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Custo e lucro do produto' },
      { rota: '/ajuda/custos', rotulo: 'Custos', apoio: 'Fixos, mão de obra e invisíveis' },
    ],
  },
  {
    slug: 'ficha-tecnica',
    tema: 'preco',
    titulo: 'Ficha técnica',
    resumo: 'Custo e lucro de cada produto.',
    minutos: 2,
    abrir: { rota: '/ficha-tecnica', rotulo: 'Abrir Ficha técnica' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Seus produtos',
        imagens: [{ src: '/ajuda/ficha-lista.webp', alt: 'Quantos produtos têm ficha e a lista com o lucro', marcas: [
          'Quantos já têm **ficha**.',
          '**Montar a próxima** que falta.',
          'Toque para ver a **ficha**.',
        ] }],
        dica: '**Vermelho** é prejuízo.',
      },
      {
        id: 'resumo',
        titulo: 'Lucro e custo',
        exemplo: 'Bolo Brigadeiro de 2 kg.',
        imagens: [{ src: '/ajuda/ficha-resumo.webp', alt: 'Resumo da ficha com lucro, custos e preço de venda', marcas: [
          'O **lucro** de cada venda.',
          'Tudo o que **custa** para fazer.',
          'O **preço** que você cobra.',
        ] }],
      },
      {
        id: 'ingredientes',
        titulo: 'Os ingredientes',
        imagens: [{ src: '/ajuda/ficha-ingredientes.webp', alt: 'Ingredientes da ficha com a quantidade', marcas: [
          '**Quanto vai** na receita.',
          'Tirar da ficha.',
        ] }],
      },
      {
        id: 'mais',
        titulo: 'Completar a ficha',
        imagens: [{ src: '/ajuda/ficha-mais.webp', alt: 'Adicionar ingrediente, custos invisíveis e mão de obra', marcas: [
          '**Adicionar ingrediente**.',
          'Não tem? **Cadastrar novo**.',
          'Mude os **custos invisíveis**.',
          'Ligue a **mão de obra**.',
        ] }],
        dica: 'No fim, toque em **Salvar ficha**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ingredientes', rotulo: 'Ingredientes', apoio: 'O que você compra' },
      { rota: '/ajuda/custos', rotulo: 'Custos', apoio: 'Fixos, mão de obra e invisíveis' },
      { rota: '/ajuda/lucratividade', rotulo: 'Lucratividade', apoio: 'O lucro de verdade do mês' },
    ],
  },
  {
    slug: 'custos',
    tema: 'preco',
    titulo: 'Custos da confeitaria',
    resumo: 'Tudo o que a loja gasta.',
    minutos: 2,
    abrir: { rota: '/custos', rotulo: 'Abrir Custos' },
    secoes: [
      {
        id: 'resumo',
        titulo: 'O resumo',
        imagens: [{ src: '/ajuda/custos-resumo.webp', alt: 'Resumo com custos fixos, salário, custo da hora e por pedido', marcas: [
          'Os **fixos** do mês.',
          'O seu **salário**.',
          'Quanto vale a **sua hora**.',
          'O que sai **por pedido**.',
        ] }],
      },
      {
        id: 'fixos',
        titulo: 'Custos fixos',
        exemplo: 'Aluguel de R$ 1.200,00, todo dia 5.',
        imagens: [{ src: '/ajuda/custos-fixos.webp', alt: 'Lista de custos fixos com o aluguel', marcas: [
          '**Adicionar** um custo.',
          'Toque para **editar**.',
        ] }],
      },
      {
        id: 'editar',
        titulo: 'Valor e vencimento',
        imagens: [{ src: '/ajuda/custos-fixo-editar.webp', alt: 'Janela do aluguel com valor, vencimento e chave Ativo', marcas: [
          'O **valor** por mês.',
          'O **dia** que vence.',
          'Desligue se **parou** de pagar.',
          'Toque em **Salvar**.',
        ] }],
        dica: 'Vira conta em **A pagar**.',
      },
      {
        id: 'mao',
        titulo: 'Sua mão de obra',
        imagens: [{ src: '/ajuda/custos-mao-obra.webp', alt: 'Mão de obra com salário e jornada', marcas: [
          'Coloque o **salário** e a **jornada**.',
          'O app calcula a **sua hora**.',
        ] }],
      },
      {
        id: 'variaveis',
        titulo: 'Variáveis e invisíveis',
        imagens: [{ src: '/ajuda/custos-variaveis.webp', alt: 'Custos variáveis e custos invisíveis', marcas: [
          '**Adicionar** um custo por venda.',
          'Ex.: a taxa da **maquininha**.',
          'Gás, perdas e descartáveis: **%**.',
        ] }],
        dica: 'Entram em **todas as fichas**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Custo e lucro do produto' },
      { rota: '/ajuda/a-pagar', rotulo: 'A pagar', apoio: 'As contas do mês' },
    ],
  },
  {
    slug: 'lucratividade',
    tema: 'preco',
    titulo: 'Lucratividade',
    resumo: 'O seu lucro de verdade.',
    minutos: 2,
    abrir: { rota: '/lucratividade', rotulo: 'Abrir Lucratividade' },
    secoes: [
      {
        id: 'periodo',
        titulo: 'Escolha o período',
        imagens: [{ src: '/ajuda/lucro-periodo.webp', alt: 'Botões de período e o mês escolhido', marcas: [
          'Hoje, 7 dias, 30 dias ou **mês**.',
          'Troque o **mês**.',
        ] }],
        dica: 'Recurso do plano **PRO**.',
      },
      {
        id: 'conta',
        titulo: 'A conta',
        exemplo: 'Outubro: vendeu R$ 2.464,33.',
        imagens: [{ src: '/ajuda/lucro-conta.webp', alt: 'Vendido, ingredientes, taxas, despesas e lucro do mês', marcas: [
          'O que você **vendeu**.',
          'O custo dos **ingredientes**.',
          'As **despesas** pagas.',
          'O que **sobrou** de verdade.',
        ] }],
        dica: 'Conta só os pedidos **entregues**.',
      },
      {
        id: 'produtos',
        titulo: 'Lucro por produto',
        imagens: [{ src: '/ajuda/lucro-produtos.webp', alt: 'Lista de lucro por produto', marcas: [
          'Quanto **cada produto** deu.',
        ] }],
        dica: 'Sem **ficha**, o lucro engana.',
      },
      {
        id: 'equilibrio',
        titulo: 'Ponto de equilíbrio',
        imagens: [{ src: '/ajuda/lucro-equilibrio.webp', alt: 'Ponto de equilíbrio do mês', marcas: [
          'Quanto vender para **pagar tudo**.',
          'Quanto **falta** neste mês.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Custo e lucro do produto' },
      { rota: '/ajuda/financeiro', rotulo: 'Financeiro', apoio: 'O que entrou e saiu' },
    ],
  },
  {
    slug: 'financeiro',
    tema: 'financeiro',
    titulo: 'Como usar o Financeiro',
    resumo: 'Entrou, saiu e sobrou.',
    minutos: 2,
    abrir: { rota: '/financeiro', rotulo: 'Abrir o Financeiro' },
    secoes: [
      {
        id: 'sobrou',
        titulo: 'Quanto sobrou',
        exemplo: 'Como foi outubro?',
        imagens: [{ src: '/ajuda/fin-sobrou.webp', alt: 'Período Mês e o valor que sobrou em outubro', marcas: [
          'Escolha o **período**.',
          'O que **sobrou** no período.',
          'O que **entrou**.',
          'O que **saiu**.',
        ] }],
      },
      {
        id: 'caixa',
        titulo: 'Caixa, a receber e a pagar',
        imagens: [{ src: '/ajuda/fin-caixa.webp', alt: 'Em caixa, A receber e A pagar', marcas: [
          'Informe o **caixa** uma vez.',
          'O que ainda **vai entrar**.',
          'As **contas** a pagar.',
        ] }],
        dica: 'Depois, ele se atualiza **sozinho**.',
      },
      {
        id: 'lancar',
        titulo: 'Lançar entrada ou saída',
        imagens: [{ src: '/ajuda/fin-botoes.webp', alt: 'Botões Entrou, Saiu e Receber', marcas: [
          'Entrou dinheiro.',
          'Saiu dinheiro.',
          '**Receber** de um pedido.',
        ] }],
      },
      {
        id: 'saida',
        titulo: 'Uma compra',
        exemplo: 'R$ 85,00 de embalagens.',
        imagens: [{ src: '/ajuda/fin-saida.webp', alt: 'Janela Nova saída preenchida com embalagens', marcas: [
          '**Quanto** foi.',
          '**Já paguei** ou **Vou pagar**.',
          '**Com o quê**.',
          'Toque em **Lançar saída**.',
        ] }],
        dica: '**Vou pagar** vai para **A pagar**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/a-receber', rotulo: 'A receber', apoio: 'O que falta a cliente pagar' },
      { rota: '/ajuda/a-pagar', rotulo: 'A pagar', apoio: 'As contas do mês' },
      { rota: '/ajuda/transacoes', rotulo: 'Transações', apoio: 'O extrato dia a dia' },
    ],
  },
  {
    slug: 'a-receber',
    tema: 'financeiro',
    titulo: 'A receber',
    resumo: 'O que falta a cliente pagar.',
    minutos: 2,
    abrir: { rota: '/financeiro/a-receber', rotulo: 'Abrir A receber' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Quem falta pagar',
        imagens: [{ src: '/ajuda/receber-lista.webp', alt: 'Resumo dos valores a receber e um pedido atrasado', marcas: [
          '**Atrasados**, em 7 dias e depois.',
          'Busque e **filtre**.',
          'Quanto **falta** neste pedido.',
          '**Abrir** o pedido.',
          'Toque em **Receber**.',
        ] }],
        dica: 'Os **atrasados** ficam no topo.',
      },
      {
        id: 'receber',
        titulo: 'Registrar o pagamento',
        exemplo: 'O Rafael pagou tudo no Pix hoje.',
        imagens: [{ src: '/ajuda/receber-janela.webp', alt: 'Janela Receber com valor, forma e data', marcas: [
          '**Quanto** ela pagou agora.',
          '**Como** pagou.',
          '**Quando** pagou.',
          '**Confirmar recebimento**.',
        ] }],
        dica: 'Pagou parte? O resto **fica aqui**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/pedido-aberto', rotulo: 'Dentro do pedido', apoio: 'Itens, entrega e pagamento' },
      { rota: '/ajuda/financeiro', rotulo: 'Financeiro', apoio: 'O que entrou e saiu' },
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
        imagens: [{ src: '/ajuda/pagar-lista.webp', alt: 'Botão Nova conta e a conta de internet atrasada', marcas: [
          'Lançar uma **Nova conta**.',
          'Vencimento, nome e **valor**.',
          'Pagou? Toque em **Pagar**.',
          'Lançou errado? O **X** cancela.',
        ] }],
        dica: 'Só sai do caixa no **Pagar**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/custos', rotulo: 'Custos fixos', apoio: 'Viram conta todo mês' },
      { rota: '/ajuda/financeiro', rotulo: 'Financeiro', apoio: 'O que entrou e saiu' },
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
        imagens: [{ src: '/ajuda/transacoes-extrato.webp', alt: 'Saldo do mês, busca e lançamentos do dia', marcas: [
          'O **saldo** do mês.',
          'Troque o **mês**.',
          'Busque um **lançamento**.',
          'Cada **dia**, com o saldo dele.',
        ] }],
        dica: 'O **filtro** baixa a planilha.',
      },
      {
        id: 'estornar',
        titulo: 'Lançou errado?',
        passos: [
          'Toque no **lançamento**.',
          'Toque em **Estornar**.',
        ],
        dica: 'Ele **fica no histórico**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/financeiro', rotulo: 'Financeiro', apoio: 'O que entrou e saiu' },
    ],
  },
  {
    slug: 'orcamentos',
    tema: 'orcamentos',
    titulo: 'Orçamentos',
    resumo: 'Propostas que a cliente aprova.',
    minutos: 3,
    abrir: { rota: '/orcamentos', rotulo: 'Abrir Orçamentos' },
    secoes: [
      {
        id: 'lista',
        titulo: 'Seus orçamentos',
        imagens: [{ src: '/ajuda/orc-lista.webp', alt: 'Link de orçamento, botão Novo orçamento e a lista', marcas: [
          'Mande o **seu link** de orçamento.',
          'Ou monte um **Novo orçamento**.',
          '**Novos**, enviados, aprovados…',
          'Toque para **abrir**.',
        ] }],
        dica: 'Pedido pelo link **avisa** você.',
      },
      {
        id: 'proposta',
        titulo: '1. A proposta',
        exemplo: 'A Carla quer um Bolo Floresta Negra.',
        imagens: [{ src: '/ajuda/orc-proposta.webp', alt: 'Itens do orçamento com o total e o lucro estimado', marcas: [
          'O **item**, a quantidade e o valor.',
          'Do **cardápio** ou **personalizado**.',
          '**Desconto**, acréscimo ou **entrega**.',
          'O **total** e o lucro estimado.',
        ] }],
      },
      {
        id: 'condicoes',
        titulo: '2. As condições',
        imagens: [{ src: '/ajuda/orc-condicoes.webp', alt: 'Validade, sinal e forma de pagamento do orçamento', marcas: [
          'Até quando **vale**.',
          'Quanto de **sinal**.',
          'Como ela **paga**.',
          'Um **recado** pronto, se quiser.',
        ] }],
      },
      {
        id: 'enviar',
        titulo: '3. Enviar',
        imagens: [{ src: '/ajuda/orc-enviar.webp', alt: 'Prévia do orçamento e os botões de envio', marcas: [
          'Assim **ela vê**.',
          '**Enviar no WhatsApp**.',
          'Ou **copiar o link**.',
          'Ou **baixar o PDF**.',
        ] }],
        dica: 'Aprovou? Vira **pedido**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/agenda', rotulo: 'Agenda', apoio: 'Os pedidos no calendário' },
      { rota: '/ajuda/ficha-tecnica', rotulo: 'Ficha técnica', apoio: 'Para ver o lucro do orçamento' },
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
        texto: ['Abra **Notificações e sons**.'],
        imagens: [{ src: '/ajuda/notificacoes.webp', alt: 'Notificações bloqueadas com o passo a passo e a chave de sons', marcas: [
          'Siga o **passo a passo**.',
          'Liga os **sons** do app.',
        ] }],
        dica: 'Vale **só neste aparelho**.',
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
        imagens: [{ src: '/ajuda/mensagens-lista.webp', alt: 'Lista das mensagens prontas', marcas: [
          'Toque para **trocar** o texto.',
          '**Padrão** ou do seu jeito.',
        ] }],
      },
      {
        id: 'editar',
        titulo: 'Trocar o texto',
        exemplo: 'Quer chamar a cliente pelo nome?',
        imagens: [{ src: '/ajuda/mensagens-editar.webp', alt: 'Janela da mensagem com o texto e a prévia', marcas: [
          'Escreva do **seu jeito**.',
          'Põe o **nome da cliente**.',
          'Assim fica **no WhatsApp**.',
          'Toque em **Salvar**.',
        ] }],
        dica: 'Entre asteriscos: **negrito**.',
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
        imagens: [{ src: '/ajuda/doo-inicio.webp', alt: 'Tela da Doo IA com os atalhos', marcas: [
          'A **Doo**, sua assistente.',
          'Calcula o **preço**.',
          'Monta o **pedido** pelo print.',
        ] }],
        dica: 'Confira os **valores**.',
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
        titulo: 'Seu plano',
        imagens: [{ src: '/ajuda/assinatura.webp', alt: 'Minha assinatura com o valor e o que está liberado', marcas: [
          'Valor e **próxima cobrança**.',
          'Tudo o que o **PRO libera**.',
          'Dúvida ou **cancelamento**.',
        ] }],
        dica: 'Mensal e **sem fidelidade**.',
      },
    ],
    relacionadas: [
      { rota: '/ajuda/conta', rotulo: 'Minha conta', apoio: 'Nome, logo e senha' },
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
        texto: ['Em **Menu**, abra **Configurações**.'],
        imagens: [{ src: '/ajuda/configuracoes.webp', alt: 'Configurações com a busca e os itens da conta', marcas: [
          '**Busque** pelo nome: pix, senha…',
          '**Minha conta**.',
          '**Notificações** e sons.',
          '**Instalar** o app.',
        ] }],
      },
      {
        id: 'perfil',
        titulo: 'Nome, logo e senha',
        imagens: [{ src: '/ajuda/minha-conta.webp', alt: 'Janela Editar perfil', marcas: [
          'Trocar a **logo**.',
          'O seu **nome**.',
          'O seu **WhatsApp**.',
          'Trocar a **senha**.',
        ] }],
        dica: 'E-mail: fale com o **suporte**.',
      },
      {
        id: 'ajuda',
        titulo: 'Precisa de ajuda?',
        imagens: [{ src: '/ajuda/configuracoes-ajuda.webp', alt: 'Itens de ajuda nas configurações', marcas: [
          'Os **tutoriais** de cada tela.',
          'Fale com a gente no **WhatsApp**.',
          'Algo não funcionou? **Conte**.',
        ] }],
      },
    ],
    relacionadas: [
      { rota: '/ajuda/assinatura', rotulo: 'Plano PRO', apoio: 'O que libera' },
      { rota: '/ajuda/notificacoes', rotulo: 'Notificações', apoio: 'Ser avisada de pedido novo' },
    ],
  },
]

export const artigoPorSlug = (slug?: string) => ARTIGOS.find(a => a.slug === slug)
export const artigosDoTema = (tema: TemaId) => ARTIGOS.filter(a => a.tema === tema)
export const semAcentoAjuda = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
