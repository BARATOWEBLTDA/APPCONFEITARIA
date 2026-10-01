import { createContext, useContext, useEffect, useRef, useState } from "react";
import { carregarNotificacoes, marcarLidas } from "@/lib/notificacoesUsuario";

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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Conta as não lidas (guardado na conta, não só no aparelho) e atualiza quando algo muda
    const load = async () => {
      const lista = await carregarNotificacoes(30);
      setNotificacoes(lista.slice(0, 10) as any);
      setNotifCount(lista.filter(n => !n.lida).length);
    };
    load();
    window.addEventListener("doonly:notif-mudou", load);
    const t = window.setInterval(load, 60000);
    return () => { window.removeEventListener("doonly:notif-mudou", load); window.clearInterval(t); };
  }, []);

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
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
