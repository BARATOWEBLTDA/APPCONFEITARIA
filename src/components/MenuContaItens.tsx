import { useNavigate } from "react-router-dom";
import { usePlano } from "@/hooks/usePlano";

/**
 * Itens do menu da foto (celular) — UM lugar só, usado no Início, em Pedidos
 * e no cabeçalho das outras páginas. Ordem aprovada em 30/09.
 * `prefix` mantém as classes de estilo de cada tela (app | ini | ped).
 */
interface Props { prefix: "app" | "ini" | "ped"; onClose: () => void; onSair: () => void }

const I = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const ICONES = {
  notif: I(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  conta: I(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  loja: I(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>),
  assistente: I(<><rect x="3" y="4" width="18" height="15" rx="4" /><circle cx="9" cy="11.5" r="1.2" /><circle cx="15" cy="11.5" r="1.2" /><path d="M12 1.5v2.5" /></>),
  ideia: I(<><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></>),
  problema: I(<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>),
  sair: I(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>),
};

/** Abre o chat do Doo IA (o mesmo do menu de baixo) */
export function abrirDooIA() { window.dispatchEvent(new CustomEvent("doonly:abrir-doo")); }

export default function MenuContaItens({ prefix, onClose, onSair }: Props) {
  const navigate = useNavigate();
  const { isPro } = usePlano();
  const ir = (to: string) => { onClose(); navigate(to); };
  const itens: { k: keyof typeof ICONES; label: string; acao: () => void }[] = [
    { k: "notif", label: "Notificações", acao: () => ir("/notificacoes") },
    { k: "conta", label: "Minha conta", acao: () => ir("/configuracoes") },
    { k: "loja", label: "Minha loja", acao: () => ir("/cardapio-config") },
    { k: "assistente", label: "Assistente virtual", acao: () => { if (isPro) { onClose(); abrirDooIA(); } else ir("/assistente-virtual"); } },
    { k: "ideia", label: "Sugerir uma melhoria", acao: () => ir("/solicitar-recurso") },
    { k: "problema", label: "Relatar um problema", acao: () => ir("/relatar-problema") },
  ];
  return (
    <>
      {itens.map(it => (
        <button key={it.k} className={`${prefix}-menu-novo-item`} onClick={it.acao}>
          <span className={`${prefix}-menu-novo-icon`}>{ICONES[it.k]}</span>
          <span>{it.label}</span>
        </button>
      ))}
      <button className={`${prefix}-menu-novo-item ${prefix}-menu-novo-sair`} onClick={() => { onClose(); onSair(); }}>
        <span className={`${prefix}-menu-novo-icon ${prefix}-menu-novo-icon--sair`}>{ICONES.sair}</span>
        <span>Sair</span>
      </button>
    </>
  );
}
