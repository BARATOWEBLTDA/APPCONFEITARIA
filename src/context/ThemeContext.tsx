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
  const [theme, setThemeState] = useState<Theme>(() => {
    // Inicializa imediatamente do localStorage
    const saved = localStorage.getItem("tema") || localStorage.getItem("theme");
    return (saved === "dark" ? "dark" : "light") as Theme;
  });

  // Aplica classe no html na inicialização
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  const applyTheme = (t: Theme) => {
    setThemeState(t);
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("tema", t);
    localStorage.setItem("theme", t);
  };

  const setTheme = async (t: Theme) => {
    applyTheme(t);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ tema: t }).eq("id", user.id);
    }
  };

  const toggleTheme = () => applyTheme(theme === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
