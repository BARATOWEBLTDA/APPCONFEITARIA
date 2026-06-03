import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getCardapioBySlug } from "@/services/cardapio";
import { CartProvider } from "@/context/CartContext";
import { Banner } from "@/components/cardapio/Banner";
import { Logo } from "@/components/cardapio/Logo";
import { CategoryFilter } from "@/components/cardapio/CategoryFilter";
import { ProductList } from "@/components/cardapio/ProductList";
import { NavigationMenu } from "@/components/cardapio/NavigationMenu";
import { EmptyState } from "@/components/cardapio/EmptyState";
import { Footer } from "@/components/cardapio/Footer";

function PreviaContent({ userId }: { userId: string }) {
  const [design, setDesign] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    getCardapioBySlug(userId).then(({ design, config, produtos }) => {
      setDesign(design);
      setConfig(config);
      setProdutos(produtos);
      if (config?.telefone) localStorage.setItem("cardapio_whatsapp", config.telefone);
      if (design?.nome_loja) localStorage.setItem("cardapio_nome", design.nome_loja);
      setLoading(false);
    });
  }, [userId]);

  const toggleFavorite = (id: string) => setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);

  const getCategories = () => {
    const cats = [{ name: "Todos", icon: "/icons/TODOS.png" }];
    const unique = Array.from(new Set(produtos.map((p: any) => p.categoria).filter(Boolean))).sort() as string[];
    unique.forEach(c => cats.push({ name: c, icon: "/icons/1.png" }));
    return cats;
  };

  const filteredProdutos = produtos.filter((p: any) => {
    const s = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const c = !selectedCategory || p.categoria === selectedCategory;
    return s && c;
  });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div style={{ width: "40px", height: "40px", border: "4px solid #fce7f3", borderTopColor: "#ec4899", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!design) return null;

  return (
    <div style={{ backgroundColor: design.cor_background || "#fef2f2", minHeight: "100%", position: "relative" }}>
      <NavigationMenu />
      <Banner borderColor={design.cor_borda || "#ec4899"} bannerGradient={design.banner_gradient} />
      <Logo
        logoUrl={design.logo_url}
        borderColor={design.cor_borda}
        storeName={design.nome_loja}
        storeDescription={design.descricao_loja}
        corNome={design.cor_nome}
        avaliacaoMedia={config?.avaliacao_media}
        configuracoes={config}
        hideStars={design.hide_stars}
      />
      <div style={{ padding: "1rem 1rem 6rem" }}>
        <CategoryFilter
          categories={getCategories()}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
          categoryIcons={design.category_icons || {}}
        />
        {filteredProdutos.length > 0 ? (
          <ProductList
            produtos={filteredProdutos}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            backgroundColor={design.cor_background || "#ffffff"}
            borderColor={design.cor_borda || "#ec4899"}
            selectedCategory={selectedCategory}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        ) : (
          <EmptyState />
        )}
      </div>
      <Footer textoRodape={design.texto_rodape} />
    </div>
  );
}

export default function CardapioPrevia() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Barra topo */}
      <div style={{
        background: "#120706", height: "48px", minHeight: "48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 1rem", flexShrink: 0,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px",
          padding: "0.35rem 0.8rem", color: "white", fontFamily: "Inter,sans-serif",
          fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.35rem",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <span style={{ color: "white", fontFamily: "Inter,sans-serif", fontSize: "0.85rem", fontWeight: 600 }}>Prévia</span>
        <div style={{ width: "70px" }} />
      </div>

      {/* Conteúdo rolável */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {userId && (
          <CartProvider>
            <PreviaContent userId={userId} />
          </CartProvider>
        )}
      </div>
    </div>
  );
}
