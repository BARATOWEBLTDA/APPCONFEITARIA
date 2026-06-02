import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Carrega tema salvo ao iniciar
  useEffect(() => {
    const load = async () => {
      // Tenta carregar do Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("tema")
          .eq("id", user.id)
          .single();
        if (data?.tema) {
          applyTheme(data.tema as Theme);
          return;
        }
      }
      // Fallback: localStorage
      const saved = localStorage.getItem("tema") as Theme | null;
      if (saved) applyTheme(saved);
    };
    load();
  }, []);

  const applyTheme = (t: Theme) => {
    setThemeState(t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("tema", t);
  };

  const setTheme = async (t: Theme) => {
    applyTheme(t);
    // Salva no Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ tema: t }).eq("id", user.id);
    }
  };

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
