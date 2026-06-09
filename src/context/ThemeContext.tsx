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
  // Sempre inicia em light — dark mode removido
  const [theme, setThemeState] = useState<Theme>("light");

  // Garante que a classe dark nunca fique aplicada
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("tema", "light");
    localStorage.setItem("theme", "light");
  }, []);

  const applyTheme = (t: Theme) => {
    // Força sempre light, ignora tentativa de dark
    setThemeState("light");
    document.documentElement.classList.remove("dark");
    localStorage.setItem("tema", "light");
    localStorage.setItem("theme", "light");
  };

  const setTheme = async (t: Theme) => {
    applyTheme(t);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ tema: "light" }).eq("id", user.id);
    }
  };

  const toggleTheme = () => applyTheme("light");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
