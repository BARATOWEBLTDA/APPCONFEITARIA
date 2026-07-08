import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { HexColorPicker } from "react-colorful";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { useIsMobile } from "@/hooks/use-mobile";

const SectionLabel = ({ children, icon, sub }: any) => (
  <div className="cd-section-header">
    {icon && <div className="cd-section-icon">{icon}</div>}
    <div style={{ flex: 1, minWidth: 0 }}>
      <p className="cd-section-label">{children}</p>
      {sub && <p className="cd-section-sub">{sub}</p>}
    </div>
  </div>
);

export default function CardapioDesign() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [banner1Url, setBanner1Url] = useState("");
  const [banner2Url, setBanner2Url] = useState("");
  const [banner3Url, setBanner3Url] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const { isPro } = usePlano();
  const isMobile = useIsMobile();
  const [cardapioModelo, setCardapioModelo] = useState("padrao");
  const [salvandoModelo, setSalvandoModelo] = useState(false);

  const [corBorda, setCorBorda] = useState("#FF6FA9");
  const [corBackground, setCorBackground] = useState("#FFF1F7");
  const [corNome, setCorNome] = useState("#1f2937");
  const [corBotao, setCorBotao] = useState("#FF6FA9");
  const [corNavbar, setCorNavbar] = useState("#ffffff");
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

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("logo_url, banner_url, banner1_url, banner2_url, banner3_url, cor_borda, cor_background, cor_nome, cor_botao, cor_navbar, cor_sacola, cor_rodape, cardapio_modelo").eq("id", user.id).single();
      if (data) {
        setLogoUrl(data.logo_url || "");
        setBannerUrl(data.banner_url || "");
        setBanner1Url(data.banner1_url || "");
        setBanner2Url(data.banner2_url || "");
        setBanner3Url(data.banner3_url || "");
        setCorBorda(data.cor_borda || "#FF6FA9");
        setCorBackground(data.cor_background || "#FFF1F7");
        setCorNome(data.cor_nome || "#1f2937");
        setCorBotao(data.cor_botao || "#FF6FA9");
        setCorNavbar(data.cor_navbar || "#ffffff");
        setCorSacola(data.cor_sacola || "#FF6FA9");
        setCorRodape(data.cor_rodape || "#FF6FA9");
        setCardapioModelo(data.cardapio_modelo || "padrao");
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

  const showSuccess = () => { setSuccess(true); setTimeout(() => setSuccess(false), 2000); };

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
      await supabase.from("profiles").update({ logo_url: url }).eq("id", userId);
      showSuccess();
    }
    setUploading(null);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploading(`banner${index}`);
    const suffix = index === 0 ? "" : `-${index}`;
    const url = await uploadImage(file, `banners/${userId}${suffix}`);
    if (url) {
      const fields = [setBannerUrl, setBanner1Url, setBanner2Url, setBanner3Url];
      const keys = ["banner_url", "banner1_url", "banner2_url", "banner3_url"];
      fields[index](url);
      await supabase.from("profiles").update({ [keys[index]]: url }).eq("id", userId);
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

  const colorSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleColorChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (colorSaveTimer.current) clearTimeout(colorSaveTimer.current);
    colorSaveTimer.current = setTimeout(async () => {
      if (!userId) return;
      await supabase.from("profiles").update({ [field]: value }).eq("id", userId);
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
    <div className="cd-root">
      <div className="cd-page-header">
        <h1 className="cd-page-title">Design do Cardápio</h1>
        <p className="cd-page-sub">Personalize a aparência visual do seu cardápio</p>
        {success && <span className="cd-autosave">✓ Salvo automaticamente</span>}
      </div>

      {/* ── Seletor de Layout ─────────────────────────────── */}
      <div className="cd-card">
        <SectionLabel
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>}
          sub="Escolha como o visitante vai ver seu cardápio"
        >Layout do cardápio</SectionLabel>

        <div className="cd-layout-grid">
          {/* Modelo Padrão (sempre disponível) */}
          <button
            className={`cd-layout-card ${cardapioModelo === 'padrao' ? 'cd-layout-active' : ''}`}
            onClick={async () => {
              if (!userId) return;
              setSalvandoModelo(true);
              setCardapioModelo('padrao');
              await supabase.from("profiles").update({ cardapio_modelo: 'padrao' }).eq("id", userId);
              setSalvandoModelo(false);
              showSuccess();
            }}
            disabled={salvandoModelo}
          >
            <div className="cd-layout-preview cd-layout-preview-padrao">
              <div className="cd-lp-header" style={{ background: corBorda }} />
              <div className="cd-lp-logo-circle" style={{ borderColor: corBorda }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `${corBorda}33` }} />
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
              <span className="cd-layout-tag">Grátis</span>
            </div>
            {cardapioModelo === 'padrao' && <div className="cd-layout-check">✓</div>}
          </button>

          {/* Modelo 1 — Hero Editorial (PRO) */}
          <button
            className={`cd-layout-card ${cardapioModelo === 'modelo1' ? 'cd-layout-active' : ''}`}
            onClick={async () => {
              if (!userId) return;
              setSalvandoModelo(true);
              setCardapioModelo('modelo1');
              await supabase.from("profiles").update({ cardapio_modelo: 'modelo1' }).eq("id", userId);
              setSalvandoModelo(false);
              showSuccess();
            }}
            disabled={salvandoModelo}
          >
            <div className="cd-layout-preview cd-layout-preview-modelo1">
              <div className="cd-lp-hero" style={{ background: `linear-gradient(135deg, ${corBorda}cc, ${corBorda})` }}>
                <div className="cd-lp-hero-overlay" />
              </div>
              <div className="cd-lp-m1-logo" style={{ borderColor: corBorda }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `linear-gradient(135deg, ${corBorda}dd, ${corBorda})` }} />
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
              <span className="cd-layout-tag cd-layout-tag-pro">{isPro ? 'PRO' : '🔒 PRO'}</span>
            </div>
            {cardapioModelo === 'modelo1' && <div className="cd-layout-check">✓</div>}
          </button>
        </div>
      </div>

      {/* Logo */}
      <div className="cd-card">
        <SectionLabel
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
          sub="Aparece no topo do cardápio em formato circular"
        >Logotipo</SectionLabel>
        <div className="cd-logo-area">
          {logoUrl ? (
            <div className="cd-logo-preview">
              <img src={logoUrl} alt="Logo" />
              <button className="cd-remove-btn" onClick={() => { setLogoUrl(""); supabase.from("profiles").update({ logo_url: null }).eq("id", userId!); }}>✕</button>
            </div>
          ) : (
            <div className="cd-upload-box cd-upload-logo" onClick={() => uploading !== "logo" && logoRef.current?.click()}>
              {uploading === "logo" ? <span className="cd-spinner" /> : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p className="cd-upload-label">Enviar logo</p>
                  <span className="cd-upload-hint">PNG ou JPG</span>
                </>
              )}
            </div>
          )}
          <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
          {logoUrl && <button className="cd-change-btn" onClick={() => logoRef.current?.click()}>{uploading === "logo" ? <span className="cd-spinner-sm" /> : "Trocar logo"}</button>}
        </div>
      </div>

      {/* Banners */}
      <div className="cd-card">
        <SectionLabel
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 12h20"/></svg>}
          sub={isPro ? "Até 4 banners — aparecem em carrossel no cardápio" : "1 banner disponível. Assine o PRO para até 4 em carrossel"}
        >Banners</SectionLabel>

        <div className="cd-banners-grid">
          {(isPro ? [0, 1, 2, 3] : [0]).map(i => (
            <div key={i} className="cd-banner-slot">
              <span className="cd-banner-slot-label">{bannerLabels[i]}</span>
              {bannerValues[i] ? (
                <div className="cd-banner-thumb" style={{ position: 'relative', overflow: 'hidden' }}>
                  {i > 0 && <div className="cd-pro-corner"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>PRO</div>}
                  <img src={bannerValues[i]} alt={bannerLabels[i]} />
                  <button className="cd-remove-btn" onClick={() => handleRemoveBanner(i)}>✕</button>
                </div>
              ) : (
                <div className="cd-upload-box cd-upload-slot" style={{ position: 'relative', overflow: 'hidden' }} onClick={() => !uploading && bannerRefs[i].current?.click()}>
                  {i > 0 && <div className="cd-pro-corner"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>PRO</div>}
                  {uploading === `banner${i}` ? <span className="cd-spinner-sm" /> : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <span className="cd-upload-hint">Adicionar</span>
                    </>
                  )}
                </div>
              )}
              <input ref={bannerRefs[i]} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleBannerUpload(e, i)} />
              {bannerValues[i] && (
                <button className="cd-change-btn-sm" onClick={() => bannerRefs[i].current?.click()}>Trocar</button>
              )}
            </div>
          ))}

          {!isPro && (
            <div className="cd-banner-slot cd-slot-locked">
              <div className="cd-lock-icon" style={{ marginBottom: "6px" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
              <span className="cd-upload-hint" style={{ textAlign: "center", fontSize: "0.7rem" }}>Banners 2, 3 e 4<br/>disponíveis no PRO</span>
            </div>
          )}
        </div>
      </div>

      {/* Cores */}
      <div className="cd-card" style={isMobile ? {} : { gridColumn:'2', gridRow:'2/4' }}>
        <SectionLabel
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 0-4 2 2 0 0 1 0-4h2.5a4.5 4.5 0 0 0 4.5-4.5A10 10 0 0 0 12 2z"/></svg>}
          sub="Toque para personalizar e veja em tempo real"
        >Cores</SectionLabel>
        <div className="cd-colors-list">

          {/* Cor da borda */}
          <div>
            <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_borda' ? null : 'cor_borda')}>
              <div className="cd-color-info">
                <span className="cd-color-label">Borda da logo</span>
                <span className="cd-color-value">{corBorda}</span>
              </div>
              <div className="cd-color-swatch" style={{ background: corBorda }} />
            </div>
            {activePicker === 'cor_borda' && (
              <div className="cd-picker-wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '10px', background: corBackground, borderRadius: '10px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: `4px solid ${corBorda}`, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-card)' }}>
                    {logoUrl ? <img src={logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: corBorda, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🧁</div>}
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
                <span className="cd-color-label">Nome da loja</span>
                <span className="cd-color-value">{corNome}</span>
              </div>
              <div className="cd-color-swatch" style={{ background: corNome }} />
            </div>
            {activePicker === 'cor_nome' && (
              <div className="cd-picker-wrap">
                <div style={{ padding: '12px', borderRadius: '10px', background: corBackground, marginBottom: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: corNome, fontFamily: 'inherit' }}>
                    Nome da sua loja
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
                  <div className="cd-color-label-row">
                    <span className="cd-color-label">Botão "Adicionar ao carrinho"</span>
                    <span className="cd-pro-badge">PRO</span>
                  </div>
                  <span className="cd-color-value">{corBotao}</span>
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

          {/* Cor do navbar — PRO */}
          {isPro ? (
            <div>
              <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_navbar' ? null : 'cor_navbar')}>
                <div className="cd-color-info">
                  <div className="cd-color-label-row">
                    <span className="cd-color-label">Fundo da barra de navegação</span>
                    <span className="cd-pro-badge">PRO</span>
                  </div>
                  <span className="cd-color-value">{corNavbar}</span>
                </div>
                <div className="cd-color-swatch" style={{ background: corNavbar, border: '1px solid var(--border)' }} />
              </div>
              {activePicker === 'cor_navbar' && (
                <div className="cd-picker-wrap">
                  <div style={{ padding: '12px', borderRadius: '10px', background: corNavbar, marginBottom: '12px', height: '40px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Prévia da barra</span>
                  </div>
                  <HexColorPicker color={corNavbar} onChange={v => handleColorChange('cor_navbar', v, setCorNavbar)} style={{ width: '100%', height: '160px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <input type="text" value={corNavbar} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange('cor_navbar', e.target.value, setCorNavbar) }} className="cd-hex-input" />
                    <button className="cd-restore-btn" onClick={() => handleColorChange('cor_navbar', '#ffffff', setCorNavbar)}>↺</button>
                    <button className="cd-picker-close" onClick={() => setActivePicker(null)}>✓ Pronto</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="cd-upgrade-box" style={{ marginTop: '4px' }}>
              <div className="cd-lock-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
              <div>
                <p className="cd-upgrade-title">Cor da barra de navegação</p>
                <p className="cd-upgrade-sub">Personalize o fundo da barra de navegação com o plano PRO</p>
              </div>
            </div>
          )}

          {/* Cor do rodapé — PRO */}
          {isPro ? (
            <div>
              <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_rodape' ? null : 'cor_rodape')}>
                <div className="cd-color-info">
                  <div className="cd-color-label-row">
                    <span className="cd-color-label">Rodapé do cardápio</span>
                    <span className="cd-pro-badge">PRO</span>
                  </div>
                  <span className="cd-color-value">{corRodape}</span>
                </div>
                <div className="cd-color-swatch" style={{ background: corRodape }} />
              </div>
              {activePicker === 'cor_rodape' && (
                <div className="cd-picker-wrap">
                  <div style={{ padding: '12px', borderRadius: '10px', background: corRodape, marginBottom: '12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Prévia do rodapé</span>
                  </div>
                  <HexColorPicker color={corRodape} onChange={v => handleColorChange('cor_rodape', v, setCorRodape)} style={{ width: '100%', height: '160px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <input type="text" value={corRodape} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange('cor_rodape', e.target.value, setCorRodape) }} className="cd-hex-input" />
                    <button className="cd-restore-btn" onClick={() => handleColorChange('cor_rodape', '#FF6FA9', setCorRodape)}>↺</button>
                    <button className="cd-picker-close" onClick={() => setActivePicker(null)}>✓ Pronto</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="cd-upgrade-box" style={{ marginTop: '4px' }}>
              <div className="cd-lock-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
              <div>
                <p className="cd-upgrade-title">Cor do rodapé</p>
                <p className="cd-upgrade-sub">Personalize a cor do rodapé do seu cardápio com o plano PRO</p>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes cdspin { to { transform:rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }

        .cd-root { font-family:'Geist', sans-serif; max-width:960px; width:100%; box-sizing:border-box; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:auto auto 1fr; gap:1rem; align-items:start; }
        .cd-page-header { grid-column:1/-1; padding-bottom:0.5rem; }
        @media (max-width: 768px) {
          .cd-root { display:flex; flex-direction:column; max-width:100%; }
          .cd-page-header { grid-column:unset; }
        }
        .cd-page-title { font-size: var(--font-page-title); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 0.3rem; letter-spacing:-0.02em; }
        .cd-page-sub { font-size: var(--font-button); color:var(--text-secondary); margin:0; }
        .cd-autosave { display:inline-flex; align-items:center; gap:0.35rem; font-size: var(--font-helper); font-weight: var(--fw-semibold); color:var(--success); background:#f0fdf4; padding:0.32rem 0.8rem; border-radius: var(--radius-full); border:1px solid #dcfce7; margin-top:0.5rem; animation:fadeIn 0.3s ease; }

        /* ── Card base ── */
        .cd-card {
          background:var(--bg-card); border-radius: var(--radius-xl); padding:1.4rem;
          box-shadow:var(--shadow-card, 0 2px 12px rgba(0,0,0,0.05));
          border:1px solid var(--border);
          display:flex; flex-direction:column; gap:0.85rem;
          width:100%; box-sizing:border-box;
          position:relative; overflow:hidden;
          transition: box-shadow var(--dur-normal) var(--ease-out), border-color 0.2s ease;
        }
        .cd-card::before {
          content:""; position:absolute; top:-60px; right:-60px;
          width:140px; height:140px;
          background:radial-gradient(circle, var(--primary-light) 0%, transparent 70%);
          pointer-events:none; opacity:0.7;
        }
        .cd-card:hover {
          box-shadow:0 4px 24px rgba(255,111,169,0.08), 0 1px 2px rgba(16,24,40,0.04);
          border-color:rgba(255,111,169,0.18);
        }
        .cd-card > * { position:relative; z-index:1; }

        /* ── Section header ── */
        .cd-section-header {
          display:flex; align-items:center; gap:0.7rem;
          padding-bottom:1rem;
          border-bottom:1px solid var(--border);
        }
        .cd-section-icon {
          width:36px; height:36px; flex-shrink:0; border-radius: var(--radius-md);
          background:var(--primary-light);
          color:var(--primary);
          display:flex; align-items:center; justify-content:center;
        }
        .cd-section-label {
          font-size: var(--font-input); font-weight: var(--fw-bold);
          color:var(--text-title); margin:0;
          letter-spacing:-0.01em;
        }
        .cd-section-sub {
          font-size: var(--font-helper); color:var(--text-muted);
          margin:0.1rem 0 0; line-height:1.3;
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
        .cd-banners-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
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

        /* ── Badge PRO (rosa, não amarelo) ── */
        .cd-pro-badge {
          display:inline-flex; align-items:center; gap:3px;
          background:var(--primary-gradient);
          color:white; font-size: var(--font-caption); font-weight: var(--fw-black);
          padding:3px 9px; border-radius: var(--radius-full); letter-spacing:0.06em;
          white-space:nowrap; flex-shrink:0;
          box-shadow:0 2px 6px rgba(255,111,169,0.32);
        }

        /* ── Cantinho PRO no banner (substitui ribbon diagonal) ── */
        .cd-pro-corner {
          position:absolute; top:8px; left:8px; z-index:10;
          display:inline-flex; align-items:center; gap:3px;
          background:var(--primary-gradient);
          color:#fff; font-size: var(--font-caption); font-weight: var(--fw-black); letter-spacing:0.08em;
          padding:3px 8px 3px 6px; border-radius: var(--radius-full);
          box-shadow:0 2px 8px rgba(255,111,169,0.45);
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
        .cd-color-swatch {
          width:42px; height:42px; border-radius: var(--radius-md);
          border:3px solid var(--bg-card);
          flex-shrink:0;
          box-shadow:0 0 0 1.5px rgba(0,0,0,0.08), 0 3px 10px rgba(0,0,0,0.1);
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
        .cd-layout-tag-pro { color: var(--primary); background: var(--primary-light); }
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
      `}</style>
    </div>
    </>
  );
}
