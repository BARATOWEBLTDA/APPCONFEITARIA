/**
 * (25/10) Central de Ajuda: os assuntos e os artigos (um tutorial por tela, no formato do "Como funciona").
 * Texto com **negrito** entre dois asteriscos. Piloto: só o artigo de Pedidos; os outros entram depois de aprovado.
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
export type ArtigoAjuda = {
  slug: string
  tema: TemaId
  titulo: string
  resumo: string
  minutos: number
  abrir?: { rota: string; rotulo: string }
  secoes: SecaoAjuda[]
  relacionadas?: { rota: string; rotulo: string; apoio: string }[]
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
]

export const artigoPorSlug = (slug?: string) => ARTIGOS.find(a => a.slug === slug)
export const artigosDoTema = (tema: TemaId) => ARTIGOS.filter(a => a.tema === tema)
export const semAcentoAjuda = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
