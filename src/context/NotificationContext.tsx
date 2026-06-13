import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

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
    const load = async () => {
      const { data } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!data) return;
      setNotificacoes(data);
      const lastSeen = localStorage.getItem("notif_last_seen");
      if (!lastSeen) {
        setNotifCount(data.length);
      } else {
        const unseen = data.filter((n: Notification) => new Date(n.created_at) > new Date(lastSeen));
        setNotifCount(unseen.length);
      }
    };
    load();
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

  const markAsSeen = () => {
    localStorage.setItem("notif_last_seen", new Date().toISOString());
    setNotifCount(0);
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
