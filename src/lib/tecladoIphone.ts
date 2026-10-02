/**
 * Altura do teclado no iPhone (02/10).
 * No iPhone, quando o teclado abre, a tela "de verdade" não encolhe: o que fica preso no rodapé
 * (a barra "Salvar" da edição do pedido, o "Avançar" do cadastro de produto) fica ESCONDIDO atrás
 * do teclado. Aqui medimos o teclado e guardamos em --teclado; as barras usam essa medida pra subir.
 * No Android a tela já encolhe sozinha, então a medida fica 0.
 */
export function iniciarMedidaDoTeclado(): void {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv) return;
  const atualizar = () => {
    const teclado = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    // abaixo de 80px é só a barra do Safari mudando de tamanho, não o teclado
    document.documentElement.style.setProperty("--teclado", teclado > 80 ? `${Math.round(teclado)}px` : "0px");
    document.documentElement.classList.toggle("teclado-aberto", teclado > 80);
  };
  vv.addEventListener("resize", atualizar);
  vv.addEventListener("scroll", atualizar);
  atualizar();
}
