import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { contarNovidadesNaoLidas, marcarLidas } from "@/lib/notificacoesUsuario";

interface Notification {
  id: string;
  titulo?: string;
  title?: string;
  mensagem?: string;
  body?: string;
  imagem_url?: string;
  created_at: string;
}

interface NotificationContextType {
  notifCount: number;
  notifOpen: boolean;
  notificacoes: Notification[];
  notifRef: React.RefObject<HTMLDivElement>;
  openNotif: () => void;
  closeNotif: () => void;
  toggleNotif: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);
/** "Estou usando as notificações": devolve a função que avisa que parou de usar. */
const UsarContext = createContext<(() => () => void) | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notificacoes] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  // (11/10) Só busca enquanto alguma tela estiver usando useNotifications(). Hoje nenhuma usa, e este provider envolve o
  // app inteiro (até o cardápio público): eram 3 requisições por minuto, pra sempre, por um resultado que ninguém lia.
  const [telasUsando, setTelasUsando] = useState(0);
  const usar = useCallback(() => { setTelasUsando(n => n + 1); return () => setTelasUsando(n => Math.max(0, n - 1)); }, []);

  useEffect(() => {
    if (telasUsando === 0) return;
    // Conta as não lidas (guardado na conta, não só no aparelho) e atualiza quando algo muda
    // (23/10) a tela Notificações saiu: o sino conta as novidades que ela ainda não leu
    const load = async () => { setNotifCount(await contarNovidadesNaoLidas()); };
    load();
    window.addEventListener("doonly:notif-mudou", load);
    const t = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    return () => { window.removeEventListener("doonly:notif-mudou", load); window.clearInterval(t); };
  }, [telasUsando === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Abrir o sininho marca as que estão aparecendo como lidas
  const markAsSeen = () => {
    const ids = (notificacoes as any[]).filter(n => !n.lida).map(n => n.id);
    if (ids.length) marcarLidas(ids);
  };

  const openNotif = () => { setNotifOpen(true); markAsSeen(); };
  const closeNotif = () => setNotifOpen(false);
  const toggleNotif = () => { if (!notifOpen) markAsSeen(); setNotifOpen(o => !o); };

  return (
    <NotificationContext.Provider value={{ notifCount, notifOpen, notificacoes, notifRef, openNotif, closeNotif, toggleNotif }}>
      <UsarContext.Provider value={usar}>{children}</UsarContext.Provider>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  const usar = useContext(UsarContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  // a busca das notificações liga quando a primeira tela usa este hook e desliga quando a última sai
  useEffect(() => usar?.(), [usar]);
  return ctx;
}
