import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * (16/10) "Ver" do Seus próximos passos abre direto o que resolve (a janela da taxa, a do saldo, a conta pra pagar...).
 * Quem chama manda { state: { abrir: "maquininha" } }; a tela chama `pronto(valor)` quando já carregou.
 * O pedido vale uma vez só (voltar pra tela não abre de novo).
 */
export function useAbrirPedido(carregado: boolean, abrir: (pedido: string) => boolean | void) {
  const location = useLocation();
  const navigate = useNavigate();
  const feito = useRef(false);
  useEffect(() => {
    const pedido = (location.state as { abrir?: string } | null)?.abrir;
    if (!carregado || !pedido || feito.current) return;
    feito.current = true;
    abrir(pedido);
    // tira o pedido da entrada do histórico: voltar pra esta tela não abre de novo
    const { abrir: _a, ...resto } = (location.state as Record<string, unknown>) || {};
    navigate(location.pathname + location.search, { replace: true, state: Object.keys(resto).length ? resto : null });
  }, [carregado, location.state]); // eslint-disable-line react-hooks/exhaustive-deps
}
