import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { HexColorPicker } from "react-colorful";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { useIsMobile } from "@/hooks/use-mobile";
import AppPageHeader from "@/components/AppPageHeader";

const SectionLabel = ({ children, sub, icon, acao }: any) => (
  <div className="cd-section-header">
    {icon && <span className="cd-section-icon" aria-hidden="true">{icon}</span>}
    <div style={{ flex: 1, minWidth: 0 }}>
      <p className="cd-section-label">{children}{acao && <span className="cd-section-acao">{acao}</span>}</p>
      {sub && <p className="cd-section-sub">{sub}</p>}
    </div>
  </div>
);

export default function CardapioDesign({ identityCard, avaliacoesCard }: { identityCard?: React.ReactNode; avaliacoesCard?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  // Marca o passo "Escolher design" do passo a passo (ignora erro se a coluna ainda não existir)
  const marcarDesignEscolhido = (uid: string | null | undefined) => {
    if (!uid) return;
    supabase.from("profiles").update({ design_escolhido: true }).eq("id", uid).then(() => {}, () => {});
  };
  // Abrir a Aparência já marca o passo "Escolher design" do passo a passo (01/10): quem gostou do
  // modelo padrão e não mexeu em nada também conclui o passo.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) marcarDesignEscolhido(user.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fotoPerfil, setFotoPerfil] = useState(""); // sem logo, o cardápio usa a foto de perfil
  const [verExemplo, setVerExemplo] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  // Avaliação (veio de Dados da loja em 29/09)
  const [hideStars, setHideStars] = useState(false);
  const [avaliacaoMedia, setAvaliacaoMedia] = useState(5.0);
  const salvarAvaliacao = async (campos: { hide_stars?: boolean; avaliacao_media?: number }) => {
    if (!userId) return;
    await supabase.from("profiles").update(campos).eq("id", userId);
    showSuccess();
  };
  const [nomeLoja, setNomeLoja] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [banner1Url, setBanner1Url] = useState("");
  const [banner2Url, setBanner2Url] = useState("");
  const [banner3Url, setBanner3Url] = useState("");
  const [bannerTopoUrl, setBannerTopoUrl] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const { isPro } = usePlano();
  const modeloAtivoCalc = (m: string) => (m === "padrao" && isPro ? "padrao" : "modelo1");
  const isMobile = useIsMobile();
  const [cardapioModelo, setCardapioModelo] = useState("modelo1");
  // "Padrão" é exclusivo PRO: quem não é PRO usa o Modelo 1 (inclusive contas antigas que estavam no "Padrão")
  const [salvandoModelo, setSalvandoModelo] = useState(false);

  const [corBorda, setCorBorda] = useState("#FF6FA9");
  const [corBackground, setCorBackground] = useState("#FFF1F7");
  const [corNome, setCorNome] = useState("#1f2937");
  const [corBotao, setCorBotao] = useState("#FF6FA9");
  const [corNavbar, setCorNavbar] = useState("#FF6FA9");
  const [corSacola, setCorSacola] = useState("#FF6FA9");
  const [corRodape, setCorRodape] = useState("#FF6FA9");
  const [activePicker, setActivePicker] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const bannerTopoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("logo_url, foto_url, nome_loja, banner_url, banner1_url, banner2_url, banner3_url, banner_topo_url, cor_borda, cor_background, cor_nome, cor_botao, cor_navbar, cor_sacola, cor_rodape, cardapio_modelo, hide_stars, avaliacao_media").eq("id", user.id).single();
      if (data) {
        setLogoUrl(data.logo_url || ""); setFotoPerfil((data as any).foto_url || "");
        setHideStars(!!(data as any).hide_stars);
        setAvaliacaoMedia(Number((data as any).avaliacao_media) || 5.0);
        setNomeLoja(data.nome_loja || "");
        setBannerUrl(data.banner_url || "");
        setBanner1Url(data.banner1_url || "");
        setBanner2Url(data.banner2_url || "");
        setBanner3Url(data.banner3_url || "");
        setBannerTopoUrl(data.banner_topo_url || "");
        setCorBorda(data.cor_borda || "#FF6FA9");
        setCorBackground(data.cor_background || "#FFF1F7");
        setCorNome(data.cor_nome || "#1f2937");
        setCorBotao(data.cor_botao || "#FF6FA9");
        setCorNavbar(data.cor_navbar || "#FF6FA9");
        setCorSacola(data.cor_sacola || "#FF6FA9");
        setCorRodape(data.cor_rodape || "#FF6FA9");
        setCardapioModelo(data.cardapio_modelo || "modelo1");
      }
      setLoading(false);
    };
    load();
  }, []);

  const uploadImage = async (file: File, path: string) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fullPath = `${path}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(fullPath, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("products").getPublicUrl(fullPath);
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const showSuccess = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    // Notifica outros componentes (ex: preview do cardápio no CardapioConfigPage)
    // pra recarregar após save do Design
    window.dispatchEvent(new CustomEvent("cardapio-design-saved"));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleLogoCropDone = async (blob: Blob) => {
    if (!userId) return;
    setCropSrc(null);
    setUploading("logo");
    const path = `logos/${userId}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setLogoUrl(url);
      await supabase.from("profiles").update({ logo_url: url }).eq("id", userId); marcarDesignEscolhido(userId);
      showSuccess();
    } else {
      alert("Não foi possível enviar o logo. Confira a internet e tente de novo.");
    }
    setUploading(null);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploading(`banner${index}`);
    const suffix = index === 0 ? "" : `-${index}`;
    const url = await uploadImage(file, `banners/${userId}${suffix}`);
    if (!url) alert("Não foi possível enviar a imagem. Confira a internet e tente de novo.");
    if (url) {
      const fields = [setBannerUrl, setBanner1Url, setBanner2Url, setBanner3Url];
      const keys = ["banner_url", "banner1_url", "banner2_url", "banner3_url"];
      fields[index](url);
      await supabase.from("profiles").update({ [keys[index]]: url }).eq("id", userId); marcarDesignEscolhido(userId);
      showSuccess();
    }
    setUploading(null);
  };

  const handleRemoveBanner = async (index: number) => {
    if (!userId) return;
    const fields = [setBannerUrl, setBanner1Url, setBanner2Url, setBanner3Url];
    const keys = ["banner_url", "banner1_url", "banner2_url", "banner3_url"];
    fields[index]("");
    await supabase.from("profiles").update({ [keys[index]]: null }).eq("id", userId);
  };

  const handleBannerTopoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploading("banner-topo");
    const url = await uploadImage(file, `banners/${userId}-topo`);
    if (!url) alert("Não foi possível enviar a imagem. Confira a internet e tente de novo.");
    if (url) {
      setBannerTopoUrl(url);
      await supabase.from("profiles").update({ banner_topo_url: url }).eq("id", userId); marcarDesignEscolhido(userId);
      showSuccess();
    }
    setUploading(null);
  };
  const handleRemoveBannerTopo = async () => {
    if (!userId) return;
    setBannerTopoUrl("");
    await supabase.from("profiles").update({ banner_topo_url: null }).eq("id", userId);
  };

  const colorSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleColorChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (colorSaveTimer.current) clearTimeout(colorSaveTimer.current);
    colorSaveTimer.current = setTimeout(async () => {
      if (!userId) return;
      await supabase.from("profiles").update({ [field]: value }).eq("id", userId); marcarDesignEscolhido(userId);
      showSuccess();
    }, 600);
  };

  const bannerValues = [bannerUrl, banner1Url, banner2Url, banner3Url];
  const bannerLabels = ["Banner 1", "Banner 2", "Banner 3", "Banner 4"];

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}>
      <span className="cd-spinner" />
      <style>{`@keyframes cdspin{to{transform:rotate(360deg)}} .cd-spinner{width:32px;height:32px;border:3px solid var(--primary-light);border-top-color:var(--primary);border-radius:50%;animation:cdspin 0.7s linear infinite;display:inline-block;}`}</style>
    </div>
  );

  const modeloAtivo = modeloAtivoCalc(cardapioModelo);
  return (
    <>
    {cropSrc && (
      <ImageCropper
        imageSrc={cropSrc}
        cropShape="round"
        aspect={1}
        onCancel={() => setCropSrc(null)}
        onCropDone={handleLogoCropDone}
      />
    )}
    {/* Aberta sozinha (/cardapio-design): precisa do cabeçalho com voltar (antes a tela ficava sem título) */}
    {!identityCard && (
      <AppPageHeader title="Aparência" subtitle="Logo, banners, modelo e cores" onBack={() => navigate("/cardapio")}
        infoIcon="🎨"
        infoContent={<>
          <p>Aqui você deixa o <strong>cardápio com a cara da sua confeitaria</strong>: o logo, os banners de promoção e o modelo da página.</p>
          <p>Tudo é salvo na hora e já aparece pros seus clientes. Use o <strong>"Ver meu cardápio"</strong> pra conferir como ficou.</p>
        </>}
        infoTip={<>As <strong>cores</strong> e o modelo <strong>"Padrão"</strong> são do plano PRO.</>}
      />
    )}
    <div className="cd-root">

      {/* Logo da loja (veio de Dados da loja em 29/09) */}
      <div className="cd-card" style={isMobile ? {} : { gridColumn: '1 / -1' }}>
        <SectionLabel icon="🧁" sub="Aparece no topo do cardápio">Logo da loja</SectionLabel>
        <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
        <div className="cd-logo-row">
          <button type="button" className="cd-logo-circ" onClick={() => logoRef.current?.click()} aria-label="Trocar logo">
            {(logoUrl || fotoPerfil)
              ? <img src={logoUrl || fotoPerfil} alt="Logo da loja" />
              : <span>{(nomeLoja || "?").trim().charAt(0).toUpperCase()}</span>}
          </button>
          {/* Sem logo próprio, o cardápio já usa a foto de perfil: a tela agora mostra isso (antes parecia vazia) */}
          <div className="cd-logo-txt">
            <b>{logoUrl ? "Seu logo" : fotoPerfil ? "Usando a sua foto de perfil" : "Adicione seu logo"}</b>
            <span>{logoUrl ? "É ele que aparece no topo do seu cardápio." : fotoPerfil ? "Se tiver um logo, envie aqui. Ele aparece no lugar da foto." : "Aparece no topo do seu cardápio, junto do nome da loja."}</span>
            {!logoUrl && fotoPerfil && <em className="cd-logo-ok">✓ Já aparece no seu cardápio</em>}
          </div>
          <button type="button" className="cd-logo-btn" onClick={() => logoRef.current?.click()} disabled={uploading === "logo"}>
            {uploading === "logo" ? "Enviando..." : logoUrl ? "Trocar logo" : "Enviar logo"}
          </button>
        </div>
      </div>

      {/* Banner do topo — só pro Modelo 1 */}
      {modeloAtivo === "modelo1" && (
        <div className="cd-card" style={isMobile ? {} : { gridColumn: '1 / -1' }}>
          <SectionLabel
            icon="🏞️"
            sub="Aparece no topo do seu cardápio como fundo — atrás da logo. Recomendado: fotos horizontais em alta qualidade (1200×400 ideal). Só no Modelo 1."
          >Banner do topo do app</SectionLabel>
          <div className="cd-banner-topo">
            {bannerTopoUrl ? (
              <div className="cd-banner-topo-thumb">
                <img src={bannerTopoUrl} alt="Banner do topo" />
                <div className="cd-banner-topo-overlay-preview" />
                <button className="cd-banner-swap-overlay" onClick={() => bannerTopoRef.current?.click()}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  Trocar
                </button>
                <button className="cd-remove-btn" onClick={handleRemoveBannerTopo}>✕</button>
              </div>
            ) : (
              <div className="cd-upload-box cd-banner-topo-empty" onClick={() => !uploading && bannerTopoRef.current?.click()}>
                {uploading === "banner-topo" ? <span className="cd-spinner-sm" /> : (
                  <>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span className="cd-upload-hint">Adicionar banner do topo</span>
                    <span className="cd-upload-hint-sub">Formato horizontal — 1200×400</span>
                  </>
                )}
              </div>
            )}
            <input ref={bannerTopoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerTopoUpload} />
          </div>
        </div>
      )}

      {/* Banners — ocupa largura total do grid */}
      <div className="cd-card" style={isMobile ? {} : { gridColumn: '1 / -1' }}>
        <SectionLabel
          icon="🖼️"
          acao={<button type="button" className="cd-ex-btn" onClick={() => setVerExemplo(true)}>Ver exemplo</button>}
          sub={(isPro ? "Seus banners rodam em carrossel no cardápio. Use pra destacar promoções e novidades." : "Anuncie sua promoção do mês. Assine PRO pra ter até 4 banners rodando em carrossel.") + " Tamanho ideal: 1200 × 675, na horizontal (use o mesmo tamanho em todos)."}
        >Banners de promoção</SectionLabel>

        <div className="cd-banners-grid">
          {(isPro ? [0, 1, 2, 3] : [0]).map(i => (
            <div key={i} className="cd-banner-slot">
              <span className="cd-banner-slot-label">{bannerLabels[i]}</span>
              {bannerValues[i] ? (
                <div className="cd-banner-thumb" style={{ position: 'relative', overflow: 'hidden' }}>
                  {i > 0 && <div className="cd-pro-corner"><img src="/coroa.png" alt="" className="cd-pro-badge-coroa" />PRO</div>}
                  <img src={bannerValues[i]} alt={bannerLabels[i]} />
                  <button className="cd-banner-swap-overlay" onClick={() => bannerRefs[i].current?.click()}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                    Trocar
                  </button>
                  <button className="cd-remove-btn" onClick={() => handleRemoveBanner(i)}>✕</button>
                </div>
              ) : (
                <div className="cd-upload-box cd-upload-slot" style={{ position: 'relative', overflow: 'hidden' }} onClick={() => !uploading && bannerRefs[i].current?.click()}>
                  {i > 0 && <div className="cd-pro-corner"><img src="/coroa.png" alt="" className="cd-pro-badge-coroa" />PRO</div>}
                  {uploading === `banner${i}` ? <span className="cd-spinner-sm" /> : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <span className="cd-upload-hint">Adicionar</span>
                    </>
                  )}
                </div>
              )}
              <input ref={bannerRefs[i]} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleBannerUpload(e, i)} />
            </div>
          ))}

          {!isPro && [1, 2, 3].map((i) => (
            <div key={i} className="cd-pro-slot" onClick={() => navigate("/assinar")}>
              <div className="cd-pro-shine" aria-hidden="true" />
              <div className="cd-pro-badge">
                <img src="/coroa.png" alt="" className="cd-pro-badge-coroa" />
                PRO
              </div>
              <div className="cd-pro-icon-mini">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2.5"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
              </div>
              <p className="cd-pro-slot-label">Banner {i + 1}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Card Identidade (vindo por prop do CardapioConfigPage) */}
      {identityCard}

      {/* ── Seletor de Layout ─────────────────────────────── */}
      <div className="cd-card">
        <SectionLabel
          variant="amarelo"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>}
          sub="Escolha como o visitante vai ver seu cardápio"
        >Layout do cardápio</SectionLabel>

        <div className="cd-layout-grid">
          {/* Modelo 1 — o padrão de todas as lojas (02/10) */}
          <button
            className={`cd-layout-card ${modeloAtivo === 'modelo1' ? 'cd-layout-active' : ''}`}
            onClick={async () => {
              if (!userId) return;
              setSalvandoModelo(true);
              setCardapioModelo('modelo1');
              await supabase.from("profiles").update({ cardapio_modelo: 'modelo1' }).eq("id", userId); marcarDesignEscolhido(userId);
              setSalvandoModelo(false);
              showSuccess();
            }}
            disabled={salvandoModelo}
          >
            <div className="cd-layout-preview cd-layout-preview-modelo1">
              <div className="cd-lp-hero" style={{ background: 'linear-gradient(135deg, #C7CAD1cc, #C7CAD1)' }}>
                <div className="cd-lp-hero-overlay" />
              </div>
              <div className="cd-lp-m1-logo" style={{ borderColor: '#C7CAD1' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #C7CAD1dd, #C7CAD1)' }} />
              </div>
              <div className="cd-lp-m1-badge" />
              <div className="cd-lp-lines" style={{ marginTop: 18 }}>
                <div style={{ width: '55%', height: 6, borderRadius: 3, background: '#e5e7eb' }} />
                <div style={{ width: '80%', height: 4, borderRadius: 2, background: '#f3f4f6' }} />
              </div>
              <div className="cd-lp-products" style={{ marginTop: 6 }}>
                <div className="cd-lp-product" /><div className="cd-lp-product" /><div className="cd-lp-product" />
              </div>
            </div>
            <div className="cd-layout-info">
              <span className="cd-layout-name">Modelo 1</span>
              <span className="cd-layout-tag">Grátis</span>
            </div>
            {modeloAtivo === 'modelo1' && <div className="cd-layout-check">✓</div>}
          </button>

          {/* Modelo "Padrão" — exclusivo PRO (02/10). No grátis, tocar leva pro PRO */}
          <button
            className={`cd-layout-card ${modeloAtivo === 'padrao' ? 'cd-layout-active' : ''}`}
            onClick={async () => {
              if (!isPro) { navigate("/assinar"); return; }
              if (!userId) return;
              setSalvandoModelo(true);
              setCardapioModelo('padrao');
              await supabase.from("profiles").update({ cardapio_modelo: 'padrao' }).eq("id", userId); marcarDesignEscolhido(userId);
              setSalvandoModelo(false);
              showSuccess();
            }}
            disabled={salvandoModelo}
          >
            <div className="cd-layout-preview cd-layout-preview-padrao">
              <div className="cd-lp-header" style={{ background: '#C7CAD1' }} />
              <div className="cd-lp-logo-circle" style={{ borderColor: '#C7CAD1' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#E5E7EB' }} />
              </div>
              <div className="cd-lp-lines">
                <div style={{ width: '60%', height: 6, borderRadius: 3, background: '#e5e7eb' }} />
                <div style={{ width: '40%', height: 4, borderRadius: 2, background: '#f3f4f6' }} />
              </div>
              <div className="cd-lp-products">
                <div className="cd-lp-product" /><div className="cd-lp-product" /><div className="cd-lp-product" />
              </div>
            </div>
            <div className="cd-layout-info">
              <span className="cd-layout-name">Padrão</span>
              <span className="cd-layout-tag cd-layout-tag--pro"><img src="/coroa.png" alt="" /><span className="cd-pro-grad">Exclusivo PRO</span></span>
            </div>
            {modeloAtivo === 'padrao' && <div className="cd-layout-check">✓</div>}
          </button>

        </div>
      </div>

      {/* Cores */}
      <div className="cd-card" style={isMobile ? {} : { gridColumn: '1 / -1' }}>
        <SectionLabel
          variant="azul"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 0-4 2 2 0 0 1 0-4h2.5a4.5 4.5 0 0 0 4.5-4.5A10 10 0 0 0 12 2z"/></svg>}
          sub={isPro ? "Toque para personalizar e veja em tempo real" : "Botões, bordas e o nome da loja"}
        acao={!isPro ? <span className="cd-layout-tag cd-layout-tag--pro"><img src="/coroa.png" alt="" /><span className="cd-pro-grad">PRO</span></span> : undefined}
        >Cores do cardápio</SectionLabel>
        {!isPro ? (
          /* Cores são PRO (02/10): no grátis o cardápio usa o rosa do Doonly */
          <div className="cd-cores-pro">
            <div className="cd-cores-sw" aria-hidden="true">{["#7C3AED", "#0EA5E9", "#16A34A", "#F59E0B", "#2C1219"].map(c => <span key={c} style={{ background: c }} />)}</div>
            <p>Deixe o cardápio com as cores da sua marca. No plano grátis, ele usa o rosa do Doonly.</p>
            <button type="button" className="cd-cores-cta" onClick={() => navigate("/assinar")}>Conhecer o PRO</button>
          </div>
        ) : (
        <div className="cd-colors-list">

          {/* Cor da borda */}
          <div>
            <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_borda' ? null : 'cor_borda')}>
              <div className="cd-color-info">
                <span className="cd-color-label">Cor da borda do logo</span>
                <span className="cd-color-value">{corBorda}</span>
              </div>
              <div className="cd-color-swatch" style={{ background: corBorda }} />
            </div>
            {activePicker === 'cor_borda' && (
              <div className="cd-picker-wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '10px', background: corBackground, borderRadius: '10px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: `4px solid ${corBorda}`, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-card)' }}>
                    {logoUrl ? (
                      <img src={logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: corBorda, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {(nomeLoja || 'ML').trim().split(/\s+/).slice(0,2).map(p => p[0]).join('') || 'ML'}
                      </div>
                    )}
                  </div>
                  <div style={{ height: '20px', width: '80px', borderRadius: '4px', background: corBorda, opacity: 0.8 }} />
                </div>
                <HexColorPicker color={corBorda} onChange={v => handleColorChange('cor_borda', v, setCorBorda)} style={{ width: '100%', height: '160px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input type="text" value={corBorda} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange('cor_borda', e.target.value, setCorBorda) }} className="cd-hex-input" />
                  <button className="cd-restore-btn" onClick={() => handleColorChange('cor_borda', '#FF6FA9', setCorBorda)}>↺</button>
                  <button className="cd-picker-close" onClick={() => setActivePicker(null)}>✓ Pronto</button>
                </div>
              </div>
            )}
          </div>

          {/* Cor do nome */}
          <div>
            <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_nome' ? null : 'cor_nome')}>
              <div className="cd-color-info">
                <span className="cd-color-label">Cor do nome da confeitaria</span>
                <span className="cd-color-hint">Sem cor escolhida: branco no computador e preto no celular</span>
                <span className="cd-color-value">{corNome}</span>
              </div>
              <div className="cd-color-swatch" style={{ background: corNome }} />
            </div>
            {activePicker === 'cor_nome' && (
              <div className="cd-picker-wrap">
                <div style={{ padding: '12px', borderRadius: '10px', background: corBackground, marginBottom: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: corNome, fontFamily: 'inherit' }}>
                    {nomeLoja || 'Nome da sua loja'}
                  </span>
                </div>
                <HexColorPicker color={corNome} onChange={v => handleColorChange('cor_nome', v, setCorNome)} style={{ width: '100%', height: '160px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input type="text" value={corNome} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange('cor_nome', e.target.value, setCorNome) }} className="cd-hex-input" />
                  <button className="cd-restore-btn" onClick={() => handleColorChange('cor_nome', '#1f2937', setCorNome)}>↺</button>
                  <button className="cd-picker-close" onClick={() => setActivePicker(null)}>✓ Pronto</button>
                </div>
              </div>
            )}
          </div>

          {/* Cor do botão — PRO */}
          {isPro ? (
            <div>
              <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_botao' ? null : 'cor_botao')}>
                <div className="cd-color-info">
                  <span className="cd-color-label">Cor dos botões de comprar</span>
                  <div className="cd-color-meta"><span className="cd-color-value">{corBotao}</span><span className="cd-pro-badge"><img src="/coroa.png" alt="" className="cd-pro-badge-coroa" />PRO</span></div>
                </div>
                <div className="cd-color-swatch" style={{ background: corBotao }} />
              </div>
              {activePicker === 'cor_botao' && (
                <div className="cd-picker-wrap">
                  <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-body)', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                    <button style={{ padding: '10px 24px', background: corBotao, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '14px', fontFamily: 'inherit' }}>
                      Adicionar · R$ 50,00
                    </button>
                  </div>
                  <HexColorPicker color={corBotao} onChange={v => handleColorChange('cor_botao', v, setCorBotao)} style={{ width: '100%', height: '160px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <input type="text" value={corBotao} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange('cor_botao', e.target.value, setCorBotao) }} className="cd-hex-input" />
                    <button className="cd-restore-btn" onClick={() => handleColorChange('cor_botao', '#FF6FA9', setCorBotao)}>↺</button>
                    <button className="cd-picker-close" onClick={() => setActivePicker(null)}>✓ Pronto</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="cd-upgrade-box" style={{ marginTop: '4px' }}>
              <div className="cd-lock-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
              <div>
                <p className="cd-upgrade-title">Cor do botão de compra</p>
                <p className="cd-upgrade-sub">Personalize a cor do botão "Adicionar ao carrinho" com o plano PRO</p>
              </div>
            </div>
          )}

          {/* Cor de background (fica atrás da logo/nome) — PRO */}
          {isPro ? (
            <div>
              <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_navbar' ? null : 'cor_navbar')}>
                <div className="cd-color-info">
                  <span className="cd-color-label">Cor do fundo</span>
                  <div className="cd-color-meta"><span className="cd-color-value">{corNavbar}</span><span className="cd-pro-badge cd-pro-badge--inline"><img src="/coroa.png" alt="" className="cd-pro-badge-coroa" />PRO</span></div>
                </div>
                <div className="cd-color-swatch" style={{ background: corNavbar }} />
              </div>
              {activePicker === 'cor_navbar' && (
                <div className="cd-picker-wrap">
                  <div style={{ padding: '12px', borderRadius: '10px', background: corNavbar, marginBottom: '12px', height: '40px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Pré-visualização (atrás da logo/nome)</span>
                  </div>
                  <HexColorPicker color={corNavbar} onChange={v => handleColorChange('cor_navbar', v, setCorNavbar)} style={{ width: '100%', height: '160px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <input type="text" value={corNavbar} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange('cor_navbar', e.target.value, setCorNavbar) }} className="cd-hex-input" />
                    <button className="cd-restore-btn" onClick={() => handleColorChange('cor_navbar', '#FF6FA9', setCorNavbar)}>↺</button>
                    <button className="cd-picker-close" onClick={() => setActivePicker(null)}>✓ Pronto</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="cd-upgrade-box" style={{ marginTop: '4px' }}>
              <div className="cd-lock-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
              <div>
                <p className="cd-upgrade-title">Cor do fundo</p>
                <p className="cd-upgrade-sub">Personalize o fundo atrás da logo/nome com o plano PRO</p>
              </div>
            </div>
          )}

        </div>
        )}
      </div>

      {/* Avaliações (estrelas) removidas em 02/10 */}



      {verExemplo && (
        <div className="cd-ex-ov" onClick={() => setVerExemplo(false)} role="dialog" aria-modal="true" aria-label="Exemplo de banner">
          <div className="cd-ex-box" onClick={e => e.stopPropagation()}>
            <img src="/exemplo-banner.jpg" alt="Exemplo de banner: Semana do Brigadeiro, 20% OFF em todos os kits" />
            <p><b>Exemplo de banner</b> · 1200 × 675 · deixe o texto no meio da imagem</p>
            <button type="button" onClick={() => setVerExemplo(false)}>Fechar</button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes cdspin { to { transform:rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }

        .cd-root {
          font-family: 'Geist', sans-serif;
          max-width: 960px; width: 100%;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          align-items: stretch;
          padding-top: 24px;
        }
        /* Cards no grid principal esticam pra altura da linha (Identidade usa .ccc-card, resto usa .cd-card) */
        .cd-root > .cd-card,
        .cd-root > .ccc-card { height: 100%; }
        /* Card Identidade (via prop) fica na coluna 1 linha 1 automaticamente (primeiro filho) */
        .cd-page-header { grid-column:1/-1; padding-bottom:0.5rem; }
        @media (max-width: 768px) {
          .cd-root { display:flex; flex-direction:column; max-width:100%; }
          .cd-page-header { grid-column:unset; }
        }
        .cd-page-title { font-size: var(--font-page-title); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 0.3rem; letter-spacing:-0.02em; }
        .cd-page-sub { font-size: var(--font-button); color:var(--text-secondary); margin:0; }
        .cd-autosave { display:inline-flex; align-items:center; gap:0.35rem; font-size: var(--font-helper); font-weight: var(--fw-semibold); color:var(--success); background:#f0fdf4; padding:0.32rem 0.8rem; border-radius: var(--radius-full); border:1px solid #dcfce7; margin-top:0.5rem; animation:fadeIn 0.3s ease; }

        /* ═══ Slot bloqueado PRO (compacto, mesma proporção do banner) ═══ */
        @keyframes cd-pro-glow {
          0%, 100% { box-shadow: 0 0 14px rgba(232,90,140,0.20), inset 0 0 20px rgba(232,90,140,0.04); }
          50% { box-shadow: 0 0 24px rgba(232,90,140,0.40), inset 0 0 20px rgba(232,90,140,0.08); }
        }
        @keyframes cd-pro-shine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .cd-pro-slot {
          background: linear-gradient(135deg, #1F1F23 0%, #2B2B32 60%, #3A3A42 100%);
          color: #fff;
          border-radius: 10px;
          aspect-ratio: 16/9;
          position: relative;
          animation: cd-pro-glow 3s ease-in-out infinite;
          border: 1px solid rgba(232,90,140,0.30);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s ease;
          font-family: 'Geist', sans-serif;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 6px;
          padding: 8px;
        }
        .cd-pro-slot:hover {
          transform: translateY(-2px);
          border-color: rgba(232,90,140,0.55);
        }
        /* Tag PRO — mesmo padrão do sidebar (fundo preto + coroa) */
        .cd-pro-badge {
          position: absolute;
          top: 6px; right: 6px;
          background: #2D1F26;
          color: #fff;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          line-height: 1;
          z-index: 2;
        }
        .cd-pro-badge-coroa {
          width: 10px; height: 10px;
          object-fit: contain;
          display: block;
          flex-shrink: 0;
        }
        .cd-pro-shine {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%);
          background-size: 200% 100%;
          animation: cd-pro-shine 4s linear infinite;
          pointer-events: none;
        }
        .cd-pro-icon-mini {
          width: 36px; height: 36px;
          background: rgba(232,90,140,0.14);
          border: 1.5px solid rgba(232,90,140,0.45);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          position: relative; z-index: 1;
          color: #FF6FA9;
        }
        .cd-pro-slot-label {
          font-size: 11px;
          font-weight: 700;
          color: #C5C5CE;
          margin: 0;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          position: relative; z-index: 1;
        }

        /* ── Card base (V2 moderno) ── */
        .cd-card {
          background: var(--bg-card);
          border-radius: 16px;
          padding: 22px 24px;
          box-shadow: 0 2px 8px rgba(153, 53, 86, 0.04);
          border: 1px solid #F0EBED;
          display: flex; flex-direction: column; gap: 1rem;
          width: 100%; box-sizing: border-box;
          position: relative; overflow: hidden;
          transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
        }
        .cd-card:hover {
          box-shadow: 0 4px 16px rgba(232, 90, 140, 0.08);
          border-color: rgba(232, 90, 140, 0.15);
        }

        /* ── Section header (V2: ícone grande gradient) ── */
        .cd-section-header {
          display: flex; align-items: flex-start; gap: 14px;
          padding-bottom: 0.35rem;
        }
        .cd-section-icon {
          width: 44px; height: 44px; flex-shrink: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #FDF3F7 0%, #FCE0E9 100%);
          color: #993556;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s ease;
        }
        .cd-card:hover .cd-section-icon { transform: scale(1.05); }
        /* Variações de cor por seção */
        .cd-section-icon--azul {
          background: linear-gradient(135deg, #E0F2FE 0%, #7DD3FC 100%);
          color: #075985;
        }
        .cd-section-icon--amarelo {
          background: linear-gradient(135deg, #FEF3C7 0%, #FBBF24 100%);
          color: #78350F;
        }
        .cd-section-icon--verde {
          background: linear-gradient(135deg, #D1FAE5 0%, #34D399 100%);
          color: #065F46;
        }
        .cd-section-icon--roxo {
          background: linear-gradient(135deg, #EDE9FE 0%, #A78BFA 100%);
          color: #4C1D95;
        }
        .cd-section-icon svg { width: 22px; height: 22px; }
        .cd-section-label {
          font-size: 15px; font-weight: 700;
          color: #2D1F26; margin: 0 0 3px;
          letter-spacing: -0.01em;
          line-height: 1.2;
        }
        .cd-section-sub {
          font-size: 12.5px; color: #6B5D64;
          margin: 0; line-height: 1.35;
        }
        .cd-hint { font-size: var(--font-helper); color:var(--text-muted); margin:0; }

        /* ── Upload boxes ── */
        .cd-upload-box {
          border:2px dashed rgba(255,111,169,0.35); border-radius: var(--radius-lg);
          background:var(--primary-light);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          cursor:pointer; transition: all var(--dur-normal); gap:0.35rem;
        }
        .cd-upload-box:hover { border-color:var(--primary); background:#FFE4F0; transform:translateY(-1px); }
        .cd-upload-logo { width:140px; height:140px; border-radius:50%; }
        .cd-upload-slot { width:100%; aspect-ratio:16/9; }
        .cd-upload-label { font-size: var(--font-button); font-weight: var(--fw-bold); color:var(--primary-dark); margin:0; }
        .cd-upload-hint { font-size: var(--font-caption); color:var(--primary); margin:0; font-weight: var(--fw-semibold); }
        .cd-upload-hint-sub { font-size: 10.5px; color: var(--text-muted, #6B7280); margin: 3px 0 0; font-weight: 500; }

        /* Banner do topo */
        .cd-banner-topo { display: flex; flex-direction: column; gap: 6px; }
        .cd-banner-topo-thumb {
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 1;
          border-radius: 10px;
          overflow: hidden;
          background: #F5F0F2;
        }
        .cd-banner-topo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cd-banner-topo-overlay-preview {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 100%);
          pointer-events: none;
        }
        .cd-banner-topo-empty {
          aspect-ratio: 3 / 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
          text-align: center;
        }

        /* ── Card Logo da loja ── */
        .cd-logo-row { display: flex; align-items: center; gap: 12px; }
        .cd-logo-circ { width: 64px; height: 64px; flex-shrink: 0; border-radius: 50%; border: 2px solid #F0EBED; background: #F5F0F2; overflow: hidden; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .cd-logo-circ img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cd-logo-circ span { font-size: 24px; font-weight: 800; color: #9CA3AF; }
        .cd-logo-txt { flex: 1; min-width: 0; }
        .cd-logo-txt b { display: block; font-size: 13.5px; color: #2C1219; }
        .cd-logo-txt span { display: block; font-size: 12px; color: #888780; line-height: 1.4; }
        .cd-logo-ok { display: inline-block; margin-top: 5px; font-style: normal; font-size: 11px; font-weight: 800; color: #15803D; background: #DCFCE7; padding: 3px 8px; border-radius: 999px; }
        /* Computador: o botão fica logo ao lado do texto (antes ia lá pra outra ponta) */
        @media (min-width: 768px) { .cd-logo-txt { flex: 0 1 auto; max-width: 420px; } .cd-logo-btn { margin-left: 8px; } }
        .cd-logo-btn { padding: 8px 14px; border-radius: 9px; border: 1px solid #EAE3E6; background: #fff; font-family: inherit; font-size: 12.5px; font-weight: 700; color: #2C1219; cursor: pointer; }
        .cd-logo-btn:disabled { opacity: .6; cursor: default; }
        /* ── Card Avaliação ── */
        .cd-aval-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .cd-aval-toggle { position: relative; width: 46px; height: 26px; flex-shrink: 0; }
        .cd-aval-toggle input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
        .cd-aval-toggle span { position: absolute; inset: 0; border-radius: 13px; background: #E5DDE0; transition: .2s; }
        .cd-aval-toggle span::before { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.15); transition: .2s; }
        .cd-aval-toggle input:checked + span { background: #2C1219; }
        .cd-aval-toggle input:checked + span::before { transform: translateX(20px); }
        .cd-aval-notas { display: flex; gap: 6px; margin-top: 12px; }
        .cd-aval-notas button { flex: 1; padding: 9px 0; border: none; border-radius: 9px; background: #F5F0F2; font-family: inherit; font-size: 12.5px; font-weight: 800; color: #7C7A8E; cursor: pointer; }
        .cd-aval-notas button.on { background: #2C1219; color: #fff; }
        /* ── Logo area ── */
        .cd-logo-area { display:flex; flex-direction:column; align-items:center; gap:0.85rem; }
        .cd-logo-preview {
          position:relative; width:140px; height:140px; border-radius:50%;
          overflow:hidden;
          border:4px solid var(--bg-card);
          box-shadow:0 0 0 3px var(--primary-light), 0 8px 24px rgba(255,111,169,0.18);
          flex-shrink:0;
        }
        .cd-logo-preview img { width:100%; height:100%; object-fit:cover; }

        /* ── Banners ── */
        .cd-banners-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:0.75rem; align-items: end; }
        @media (max-width: 640px) {
          .cd-banners-grid { grid-template-columns: 1fr 1fr; }
        }
        .cd-banner-slot { display:flex; flex-direction:column; gap:0.35rem; }
        .cd-banner-slot-label { font-size: var(--font-caption); font-weight: var(--fw-bold); color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; }
        .cd-banner-thumb { position:relative; width:100%; aspect-ratio:16/9; border-radius: var(--radius-md); overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
        .cd-banner-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .cd-slot-locked {
          align-items:center; justify-content:center;
          background:var(--primary-light);
          border:2px dashed rgba(255,111,169,0.4);
          border-radius: var(--radius-lg); aspect-ratio:16/9; padding:0.5rem;
        }
        .cd-remove-btn { position:absolute; top:0.4rem; right:0.4rem; background:rgba(0,0,0,0.55); border:none; border-radius:50%; width:24px; height:24px; color:white; font-size: var(--font-caption); cursor:pointer; display:flex; align-items:center; justify-content:center; transition: background var(--dur-fast); }
        .cd-banner-swap-overlay {
          position: absolute;
          bottom: 0.4rem;
          left: 0.4rem;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          background: rgba(0,0,0,0.65);
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Geist', sans-serif;
          transition: background 0.15s;
          backdrop-filter: blur(4px);
        }
        .cd-banner-swap-overlay:hover { background: rgba(0,0,0,0.85); }
        .cd-remove-btn:hover { background:rgba(0,0,0,0.75); }

        /* ── Botões ── */
        .cd-change-btn { align-self:center; padding:0.5rem 1.4rem; background:var(--bg-card); border:1.5px solid var(--border); border-radius: var(--radius-full); font-family:'Geist', sans-serif; font-size: var(--font-helper); font-weight: var(--fw-bold); color:var(--text-primary); cursor:pointer; transition: all var(--dur-fast); }
        .cd-change-btn:hover { border-color:var(--primary); color:var(--primary); background:var(--primary-light); }
        .cd-change-btn-sm { font-size: var(--font-caption); font-weight: var(--fw-bold); color:var(--primary); background:none; border:none; cursor:pointer; padding:0; text-align:center; }
        .cd-change-btn-sm:hover { text-decoration:underline; }

        /* ── Lock icon (substitui diamante) ── */
        .cd-lock-icon {
          width:36px; height:36px; flex-shrink:0; border-radius:50%;
          background:var(--primary-gradient);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 3px 10px rgba(255,111,169,0.35);
        }

        /* ── Cantinho PRO no banner (padrão preto + coroa) ── */
        /* etiqueta PRO dentro da linha da cor (antes flutuava no canto do cartão) */
        .cd-pro-badge--inline { position: static !important; display: inline-flex !important; margin-left: 8px; vertical-align: middle; transform: none !important; }
        .cd-pro-corner {
          position:absolute; top:6px; left:6px; z-index:10;
          display:inline-flex; align-items:center; gap:4px;
          background: #2D1F26;
          color:#fff; font-size: 9px; font-weight: 800; letter-spacing:0.1em; text-transform: uppercase;
          padding:3px 8px; border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          line-height: 1;
        }

        /* ── Cores ── */
        .cd-colors-list { display:flex; flex-direction:column; gap:0.55rem; }
        .cd-color-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:0.7rem 0.85rem;
          background:var(--bg-body);
          border-radius: var(--radius-lg); border:1.5px solid var(--border);
          cursor:pointer; transition: all var(--dur-normal);
        }
        .cd-color-row:hover {
          border-color:var(--primary);
          background:var(--primary-light);
          transform:translateY(-1px);
        }
        .cd-color-info { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
        .cd-color-label-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .cd-color-label { font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-primary); }
        .cd-color-value { font-size: var(--font-caption); color:var(--text-muted); font-family:'Geist Mono', ui-monospace, monospace; }
        .cd-color-meta { display:flex; align-items:center; gap:6px; }
        .cd-color-swatch {
          width:42px; height:42px; border-radius: var(--radius-md);
          border:3px solid var(--bg-card);
          flex-shrink:0;
          box-shadow: 0 0 0 1.5px var(--border), 0 3px 10px rgba(0,0,0,0.1);
        }

        /* ── Color picker wrap ── */
        .cd-picker-wrap {
          padding:0.85rem;
          background:var(--bg-card);
          border-radius: var(--radius-lg);
          border:1.5px solid var(--primary);
          margin-top:6px;
          box-shadow:0 6px 18px rgba(255,111,169,0.12);
        }
        .cd-hex-input { flex:1; min-width:0; padding:8px 10px; border:1.5px solid var(--border); border-radius: var(--radius-md); font-size: var(--font-helper); font-family:'Geist Mono', ui-monospace, monospace; color:var(--text-primary); outline:none; transition: border-color var(--dur-fast); }
        .cd-hex-input:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(255,111,169,0.12); }
        .cd-picker-close { padding:8px 14px; background:var(--primary-gradient); color:#fff; border:none; border-radius: var(--radius-md); font-size: var(--font-helper); font-weight: var(--fw-bold); cursor:pointer; white-space:nowrap; font-family:'Geist', sans-serif; flex-shrink:0; box-shadow:0 2px 8px rgba(255,111,169,0.32); transition: transform var(--dur-fast); }
        .cd-picker-close:hover { transform:translateY(-1px); }
        .cd-restore-btn { padding:8px 11px; background:var(--bg-body); color:var(--text-secondary); border:1.5px solid var(--border); border-radius: var(--radius-md); font-size: var(--font-input); font-weight: var(--fw-bold); cursor:pointer; white-space:nowrap; font-family:'Geist', sans-serif; flex-shrink:0; transition: all var(--dur-fast); }
        .cd-restore-btn:hover { border-color:var(--primary); color:var(--primary); background:var(--primary-light); }

        /* ── Upgrade box ── */
        .cd-upgrade-box {
          background:var(--primary-light);
          border:1.5px dashed var(--primary);
          border-radius: var(--radius-lg); padding:0.95rem 1.1rem;
          display:flex; align-items:center; gap:0.85rem;
        }
        .cd-upgrade-title { font-size: var(--font-button); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 2px; }
        .cd-upgrade-sub { font-size: var(--font-helper); color:var(--text-secondary); margin:0; line-height:1.35; }

        .cd-spinner { width:32px; height:32px; border:3px solid var(--primary-light); border-top-color:var(--primary); border-radius:50%; animation:cdspin 0.7s linear infinite; display:inline-block; }
        .cd-spinner-sm { width:16px; height:16px; border:2px solid rgba(255,111,169,0.3); border-top-color:var(--primary); border-radius:50%; animation:cdspin 0.7s linear infinite; display:inline-block; }

        /* ── Seletor de Layout ─────────────────────────── */
        .cd-layout-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--gap-stack); margin-top: var(--gap-stack); }
        .cd-layout-card {
          position: relative;
          background: var(--bg-card);
          border: 2px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 0;
          cursor: pointer;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
          text-align: left;
          font-family: inherit;
        }
        .cd-layout-card:hover:not(:disabled) { border-color: var(--text-muted); }
        .cd-layout-active { border-color: var(--primary) !important; box-shadow: var(--focus-ring); }
        .cd-layout-locked { opacity: 0.75; cursor: not-allowed; }
        .cd-layout-lock-overlay {
          position: absolute; inset: 0; background: rgba(255,255,255,0.4);
          backdrop-filter: blur(1px); border-radius: var(--radius-md); pointer-events: none;
        }
        .cd-layout-preview {
          width: 100%; height: 120px; background: var(--bg-subtle); position: relative; overflow: hidden;
        }
        .cd-layout-info {
          padding: var(--space-2) var(--space-3); display: flex; align-items: center; justify-content: space-between;
          border-top: 1px solid var(--primary-light);
        }
        .cd-layout-name { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-primary); }
        .cd-layout-tag { font-size: var(--text-xs); font-weight: var(--fw-semibold); color: var(--text-muted); background: var(--bg-subtle); padding: 2px 8px; border-radius: var(--radius-full); }
        .cd-layout-tag-pro {
          background: #2D1F26;
          color: #fff;
          font-weight: 800;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          line-height: 1;
        }
        .cd-layout-check {
          position: absolute; top: var(--space-2); right: var(--space-2); width: 22px; height: 22px;
          border-radius: 50%; background: var(--primary); color: var(--text-inverse);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--font-caption); font-weight: var(--fw-bold); z-index: 2;
        }
        /* Mini-preview: Padrão */
        .cd-layout-preview-padrao .cd-lp-header { height: 40px; border-radius: 0; }
        .cd-layout-preview-padrao .cd-lp-logo-circle {
          width: 32px; height: 32px; border-radius: 50%; border: 2px solid;
          margin: -16px auto 0; background: var(--bg-card); position: relative; z-index: 1;
        }
        .cd-lp-lines { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: var(--space-2); padding: 0 var(--space-3); }
        .cd-lp-products { display: flex; gap: 4px; padding: var(--space-1) var(--space-3) 0; }
        .cd-lp-product { flex: 1; height: 22px; border-radius: var(--radius-sm); background: var(--primary-light); }
        /* Mini-preview: Modelo 1 */
        .cd-layout-preview-modelo1 .cd-lp-hero { height: 60px; position: relative; }
        .cd-layout-preview-modelo1 .cd-lp-hero-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.25) 100%); }
        .cd-lp-m1-logo {
          width: 24px; height: 24px; border-radius: 50%; border: 2px solid;
          position: absolute; top: 48px; right: var(--space-3); background: var(--bg-card); z-index: 2;
        }
        .cd-lp-m1-badge {
          position: absolute; top: 50px; left: var(--space-3);
          width: 20px; height: 8px; border-radius: var(--radius-sm); background: var(--warning);
        }
      
        /* Etiqueta "Exclusivo PRO" (selo escuro + coroa + texto no degradê do Doonly) */
        .cd-layout-tag.cd-layout-tag--pro { display: inline-flex; align-items: center; gap: 4px; background: #2D1F26 !important; color: #fff !important; padding: 3px 9px 3px 6px !important; border-radius: 999px; font-weight: 800; }
        .cd-layout-tag--pro img { width: 13px; height: 13px; object-fit: contain; }
        .cd-pro-grad { background: linear-gradient(90deg, #F9A8D4, #C4B5FD, #93C5FD); -webkit-background-clip: text; background-clip: text; color: transparent; white-space: nowrap; }
        .cd-color-hint { display: block; font-size: 11.5px; color: #9A8E94; margin-top: 2px; }

        /* ── Ajustes da Aparência (02/10) ── */
        .cd-section-header { position: relative; }
        .cd-section-acao { display: inline-flex; vertical-align: middle; margin-left: 8px; position: relative; top: -1px; }
        .cd-ex-btn { border: 1px solid #F7C6D9; background: #FFF1F6; color: #C33A6E; font-family: inherit; font-size: 11.5px; font-weight: 800; padding: 5px 10px; border-radius: 7px; cursor: pointer; white-space: nowrap; }
        .cd-ex-ov { position: fixed; inset: 0; z-index: 3000; background: rgba(45,31,38,.6); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .cd-ex-box { width: 100%; max-width: 560px; background: #fff; border-radius: 18px; padding: 12px; text-align: center; }
        .cd-ex-box img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 12px; display: block; }
        .cd-ex-box p { font-size: 12.5px; color: #6B5D64; margin: 10px 0 0; } .cd-ex-box b { color: #2C1219; }
        .cd-ex-box button { margin-top: 8px; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 800; color: #9A8E94; padding: 8px 16px; cursor: pointer; }
        .cd-logo-ok { border-radius: 6px !important; white-space: nowrap; }
        .cd-layout-info { flex-direction: column; align-items: flex-start !important; justify-content: flex-start !important; gap: 5px; }
        .cd-layout-tag:not(.cd-layout-tag--pro) { background: #DCFCE7 !important; color: #15803D !important; font-weight: 800 !important; border-radius: 6px !important; }
        .cd-layout-tag.cd-layout-tag--pro { border-radius: 6px !important; }
        .cd-cores-pro { text-align: left; }
        .cd-cores-sw { display: flex; gap: 10px; margin-top: 4px; }
        .cd-cores-sw span { width: 32px; height: 32px; border-radius: 50%; box-shadow: 0 0 0 3px #fff, 0 0 0 4px #EDE6E9; }
        .cd-cores-pro p { font-size: 13px; color: #6B5D64; line-height: 1.45; margin: 12px 0 0; }
        .cd-cores-cta { display: block; width: 100%; margin-top: 12px; border: none; border-radius: 12px; padding: 12px; font-family: inherit; font-size: 14px; font-weight: 800; color: #fff; background: #E85A8C; box-shadow: 0 3px 0 #C33A6E; cursor: pointer; }
`}</style>
    </div>
    </>
  );
}
