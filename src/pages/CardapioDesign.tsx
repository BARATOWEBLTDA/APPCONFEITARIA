import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { HexColorPicker } from "react-colorful";
import { ImageCropper } from "@/components/ui/ImageCropper";

const SectionLabel = ({ children }: any) => <p className="cd-section-label">{children}</p>;

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

  // Cores
  const [corBorda, setCorBorda] = useState("#ec4899");
  const [corBackground, setCorBackground] = useState("#fef2f2");
  const [corNome, setCorNome] = useState("#1f2937");
  const [corBotao, setCorBotao] = useState("#ec4899");
  const [corNavbar, setCorNavbar] = useState("#ffffff");
  const [corSacola, setCorSacola] = useState("#ec4899");
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
      const { data } = await supabase.from("profiles").select("logo_url, banner_url, banner1_url, banner2_url, banner3_url, cor_borda, cor_background, cor_nome, cor_botao, cor_navbar, cor_sacola").eq("id", user.id).single();
      if (data) {
        setLogoUrl(data.logo_url || "");
        setBannerUrl(data.banner_url || "");
        setBanner1Url(data.banner1_url || "");
        setBanner2Url(data.banner2_url || "");
        setBanner3Url(data.banner3_url || "");
        setCorBorda(data.cor_borda || "#ec4899");
        setCorBackground(data.cor_background || "#fef2f2");
        setCorNome(data.cor_nome || "#1f2937");
        setCorBotao(data.cor_botao || "#ec4899");
        setCorNavbar(data.cor_navbar || "#ffffff");
        setCorSacola(data.cor_sacola || "#ec4899");
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
      <style>{`@keyframes cdspin{to{transform:rotate(360deg)}} .cd-spinner{width:32px;height:32px;border:3px solid #fce7f3;border-top-color:#F583BF;border-radius:50%;animation:cdspin 0.7s linear infinite;display:inline-block;}`}</style>
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

      {/* Logo */}
      <div className="cd-card">
        <SectionLabel>Logotipo</SectionLabel>
        <p className="cd-hint">Aparece no topo do cardápio em formato circular</p>
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
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SectionLabel>Banners</SectionLabel>

        </div>
        <p className="cd-hint">
          {isPro ? "Até 4 banners — aparecem em carrossel no cardápio" : "1 banner disponível. Assine o PRO para até 4 banners em carrossel"}
        </p>

        <div className="cd-banners-grid">
          {(isPro ? [0, 1, 2, 3] : [0]).map(i => (
            <div key={i} className="cd-banner-slot">
              <span className="cd-banner-slot-label">{bannerLabels[i]}</span>
              {bannerValues[i] ? (
                <div className="cd-banner-thumb" style={{ position: 'relative', overflow: 'hidden' }}>
                  {i > 0 && <div className="cd-pro-ribbon">PRO</div>}
                  <img src={bannerValues[i]} alt={bannerLabels[i]} />
                  <button className="cd-remove-btn" onClick={() => handleRemoveBanner(i)}>✕</button>
                </div>
              ) : (
                <div className="cd-upload-box cd-upload-slot" style={{ position: 'relative', overflow: 'hidden' }} onClick={() => !uploading && bannerRefs[i].current?.click()}>
                  {i > 0 && <div className="cd-pro-ribbon">PRO</div>}
                  {uploading === `banner${i}` ? <span className="cd-spinner-sm" /> : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
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
              <img src="/diamante.png" alt="PRO" style={{ width: "24px", height: "24px", marginBottom: "4px" }} />
              <span className="cd-upload-hint" style={{ textAlign: "center", fontSize: "0.7rem" }}>Banners 2, 3 e 4<br/>disponíveis no PRO</span>
            </div>
          )}
        </div>
      </div>

      {/* Cores */}
      <div className="cd-card">
        <SectionLabel>Cores</SectionLabel>
        <p className="cd-hint">Toque para personalizar e veja em tempo real</p>
        <div className="cd-colors-list">

          {/* Cor da borda/topo */}
          <div>
            <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_borda' ? null : 'cor_borda')}>
              <div className="cd-color-info">
                <span className="cd-color-label">Barra do topo e borda da logo</span>
                <span className="cd-color-value">{corBorda}</span>
              </div>
              <div className="cd-color-swatch" style={{ background: corBorda }} />
            </div>
            {activePicker === 'cor_borda' && (
              <div className="cd-picker-wrap">
                {/* Preview logo com borda */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '10px', background: corBackground, borderRadius: '10px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: `4px solid ${corBorda}`, overflow: 'hidden', flexShrink: 0, background: 'white' }}>
                    {logoUrl ? <img src={logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: corBorda, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🧁</div>}
                  </div>
                  <div style={{ height: '20px', width: '80px', borderRadius: '4px', background: corBorda, opacity: 0.8 }} />
                </div>
                <HexColorPicker color={corBorda} onChange={v => handleColorChange('cor_borda', v, setCorBorda)} style={{ width: '100%', height: '160px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  
                  <input type="text" value={corBorda} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange('cor_borda', e.target.value, setCorBorda) }} className="cd-hex-input" />
                  <button className="cd-restore-btn" onClick={() => handleColorChange('cor_borda', '#ec4899', setCorBorda)}>↺</button>
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
                {/* Preview nome */}
                <div style={{ padding: '12px', borderRadius: '10px', background: corBackground, marginBottom: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: corNome, fontFamily: 'Nunito, sans-serif' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="cd-color-label">Botão "Adicionar ao carrinho"</span>
                    <span className="cd-pro-badge">✦ PRO</span>
                  </div>
                  <span className="cd-color-value">{corBotao}</span>
                </div>
                <div className="cd-color-swatch" style={{ background: corBotao }} />
              </div>
              {activePicker === 'cor_botao' && (
                <div className="cd-picker-wrap">
                  <div style={{ padding: '12px', borderRadius: '10px', background: '#f9fafb', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                    <button style={{ padding: '10px 24px', background: corBotao, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '14px', fontFamily: 'inherit' }}>
                      Adicionar · R$ 50,00
                    </button>
                  </div>
                  <HexColorPicker color={corBotao} onChange={v => handleColorChange('cor_botao', v, setCorBotao)} style={{ width: '100%', height: '160px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    
                    <input type="text" value={corBotao} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange('cor_botao', e.target.value, setCorBotao) }} className="cd-hex-input" />
                    <button className="cd-restore-btn" onClick={() => handleColorChange('cor_botao', '#ec4899', setCorBotao)}>↺</button>
                    <button className="cd-picker-close" onClick={() => setActivePicker(null)}>✓ Pronto</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="cd-upgrade-box" style={{ marginTop: '4px' }}>
              <img src="/diamante.png" alt="PRO" style={{ width: '24px', height: '24px' }} />
              <div>
                <p className="cd-upgrade-title">Cor do botão de compra</p>
                <p className="cd-upgrade-sub">Personalize a cor do botão "Adicionar ao carrinho" com o plano PRO</p>
              </div>
            </div>
          )}

          {/* Cor do navbar */}
          <div>
            <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_navbar' ? null : 'cor_navbar')}>
              <div className="cd-color-info">
                <span className="cd-color-label">Fundo da barra de navegação</span>
                <span className="cd-color-value">{corNavbar}</span>
              </div>
              <div className="cd-color-swatch" style={{ background: corNavbar, border: '1px solid #e5e7eb' }} />
            </div>
            {activePicker === 'cor_navbar' && (
              <div className="cd-picker-wrap">
                <div style={{ padding: '12px', borderRadius: '10px', background: corNavbar, marginBottom: '12px', height: '40px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600 }}>Prévia da barra</span>
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

          {/* Cor da sacola */}
          <div>
            <div className="cd-color-row" onClick={() => setActivePicker(activePicker === 'cor_sacola' ? null : 'cor_sacola')}>
              <div className="cd-color-info">
                <span className="cd-color-label">Botão "Sacola" (navbar)</span>
                <span className="cd-color-value">{corSacola}</span>
              </div>
              <div className="cd-color-swatch" style={{ background: corSacola }} />
            </div>
            {activePicker === 'cor_sacola' && (
              <div className="cd-picker-wrap">
                <div style={{ padding: '10px', borderRadius: '10px', background: '#f9fafb', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                  <button style={{ padding: '9px 20px', background: corSacola, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit' }}>🛍 Sacola</button>
                </div>
                <HexColorPicker color={corSacola} onChange={v => handleColorChange('cor_sacola', v, setCorSacola)} style={{ width: '100%', height: '160px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input type="text" value={corSacola} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange('cor_sacola', e.target.value, setCorSacola) }} className="cd-hex-input" />
                  <button className="cd-restore-btn" onClick={() => handleColorChange('cor_sacola', '#ec4899', setCorSacola)}>↺</button>
                  <button className="cd-picker-close" onClick={() => setActivePicker(null)}>✓ Pronto</button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes cdspin { to { transform:rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .cd-root { font-family:'Nunito',sans-serif; max-width:520px; width:100%; box-sizing:border-box; display:flex; flex-direction:column; gap:0.85rem; }
        .cd-page-header { padding-top:1.5rem; text-align:center; margin-bottom:0.15rem; }
        .cd-page-title { font-size:1.25rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.3rem; }
        .cd-page-sub { font-size:0.84rem; color:#4b5563; margin:0; font-style:italic; }
        .cd-autosave { font-size:0.75rem; font-weight:600; color:#22c55e; display:flex; align-items:center; justify-content:center; gap:0.25rem; animation:fadeIn 0.3s ease; margin-top:0.3rem; }
        .cd-section-label { font-size:0.75rem; font-weight:800; color:#F583BF; text-transform:uppercase; letter-spacing:0.12em; margin:0; }
        .cd-hint { font-size:0.78rem; color:var(--text-muted,#9ca3af); margin:0; }
        .cd-card { background:var(--bg-card,white); border-radius:18px; padding:1.15rem; box-shadow:var(--shadow-card,0 2px 12px rgba(0,0,0,0.06)); display:flex; flex-direction:column; gap:0.75rem; width:100%; box-sizing:border-box; }
        .cd-upload-box { border:2px dashed #fce7f3; border-radius:12px; background:#fdf2f8; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; transition:border-color 0.2s; gap:0.3rem; }
        .cd-upload-box:hover { border-color:#F583BF; }
        .cd-upload-logo { width:130px; height:130px; border-radius:50%; }
        .cd-upload-slot { width:100%; aspect-ratio:16/9; }
        .cd-upload-label { font-size:0.88rem; font-weight:700; color:#374151; margin:0; }
        .cd-upload-hint { font-size:0.72rem; color:#9ca3af; margin:0; }
        .cd-logo-area { display:flex; flex-direction:column; align-items:center; gap:0.75rem; }
        .cd-logo-preview { position:relative; width:130px; height:130px; border-radius:50%; overflow:hidden; border:3px solid #fce7f3; flex-shrink:0; }
        .cd-logo-preview img { width:100%; height:100%; object-fit:cover; }
        .cd-banners-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
        .cd-banner-slot { display:flex; flex-direction:column; gap:0.3rem; }
        .cd-banner-slot-label { font-size:0.7rem; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.08em; }
        .cd-banner-thumb { position:relative; width:100%; aspect-ratio:16/9; border-radius:10px; overflow:hidden; }
        .cd-banner-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .cd-slot-locked { align-items:center; justify-content:center; background:#fdf2f8; border:2px dashed #fce7f3; border-radius:12px; aspect-ratio:16/9; padding:0.5rem; }
        .cd-remove-btn { position:absolute; top:0.3rem; right:0.3rem; background:rgba(0,0,0,0.5); border:none; border-radius:50%; width:22px; height:22px; color:white; font-size:0.65rem; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .cd-change-btn { align-self:center; padding:0.45rem 1.25rem; background:var(--bg-subtle,#f3f4f6); border:1.5px solid var(--border,#e5e7eb); border-radius:50px; font-family:'Nunito',sans-serif; font-size:0.82rem; font-weight:700; color:var(--text-secondary,#374151); cursor:pointer; }
        .cd-change-btn:hover { border-color:#F583BF; color:#F583BF; }
        .cd-change-btn-sm { font-size:0.7rem; font-weight:700; color:#F583BF; background:none; border:none; cursor:pointer; padding:0; text-align:center; }
        .cd-change-btn-sm:hover { text-decoration:underline; }
        .cd-pro-badge { background:linear-gradient(135deg,#ec4899,#a855f7); color:white; font-size:0.68rem; font-weight:800; padding:2px 10px; border-radius:50px; letter-spacing:0.1em; }
        .cd-pro-ribbon { position:absolute; top:12px; right:-16px; background:linear-gradient(135deg,#ec4899,#f472b6); color:white; font-size:0.58rem; font-weight:900; letter-spacing:0.1em; padding:3px 24px; transform:rotate(45deg); z-index:10; box-shadow:0 2px 6px rgba(236,72,153,0.4); width:80px; text-align:center; }
        .cd-colors-list { display:flex; flex-direction:column; gap:0.5rem; }
        .cd-color-row { display:flex; align-items:center; justify-content:space-between; padding:0.65rem 0.75rem; background:#fafafa; border-radius:12px; border:1px solid #f3f4f6; cursor:pointer; transition:border-color 0.2s; }
        .cd-color-row:hover { border-color:#F583BF; }
        .cd-color-info { display:flex; flex-direction:column; gap:2px; }
        .cd-color-label { font-size:0.82rem; font-weight:600; color:#374151; }
        .cd-color-value { font-size:0.7rem; color:#9ca3af; font-family:monospace; }
        .cd-color-swatch { width:38px; height:38px; border-radius:10px; border:2px solid rgba(0,0,0,0.08); flex-shrink:0; box-shadow:0 2px 6px rgba(0,0,0,0.12); }
        .cd-picker-wrap { padding:0.75rem; background:#f9fafb; border-radius:12px; border:1px solid #f3f4f6; margin-top:4px; }
        .cd-hex-input { flex:1; min-width:0; padding:6px 8px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:0.78rem; font-family:monospace; color:#374151; outline:none; }
        .cd-hex-input:focus { border-color:#F583BF; }
        .cd-picker-close { padding:6px 10px; background:#ec4899; color:white; border:none; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer; white-space:nowrap; font-family:'Nunito',sans-serif; flex-shrink:0; }
        .cd-restore-btn { padding:6px 8px; background:#f3f4f6; color:#6b7280; border:1.5px solid #e5e7eb; border-radius:8px; font-size:0.82rem; font-weight:700; cursor:pointer; white-space:nowrap; font-family:'Nunito',sans-serif; flex-shrink:0; }
        .cd-restore-btn:hover { border-color:#F583BF; color:#F583BF; }
        .cd-upgrade-box { background:#fdf2f8; border:1.5px dashed #f9a8d4; border-radius:16px; padding:1rem 1.25rem; display:flex; align-items:center; gap:1rem; }
        .cd-upgrade-title { font-size:0.88rem; font-weight:700; color:#374151; margin:0 0 2px; }
        .cd-upgrade-sub { font-size:0.76rem; color:#9ca3af; margin:0; }
        .cd-spinner { width:32px; height:32px; border:3px solid #fce7f3; border-top-color:#F583BF; border-radius:50%; animation:cdspin 0.7s linear infinite; display:inline-block; }
        .cd-spinner-sm { width:16px; height:16px; border:2px solid rgba(245,131,191,0.3); border-top-color:#F583BF; border-radius:50%; animation:cdspin 0.7s linear infinite; display:inline-block; }
      `}</style>
    </div>
    </>
  );
}
