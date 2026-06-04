import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";

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
  const { isPro } = usePlano();

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
      const { data } = await supabase.from("profiles").select("logo_url, banner_url, banner1_url, banner2_url, banner3_url").eq("id", user.id).single();
      if (data) {
        setLogoUrl(data.logo_url || "");
        setBannerUrl(data.banner_url || "");
        setBanner1Url(data.banner1_url || "");
        setBanner2Url(data.banner2_url || "");
        setBanner3Url(data.banner3_url || "");
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploading("logo");
    const url = await uploadImage(file, `logos/${userId}`);
    if (url) { setLogoUrl(url); await supabase.from("profiles").update({ logo_url: url }).eq("id", userId); showSuccess(); }
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

  const bannerValues = [bannerUrl, banner1Url, banner2Url, banner3Url];
  const bannerLabels = ["Banner 1", "Banner 2", "Banner 3", "Banner 4"];

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}>
      <span className="cd-spinner" />
      <style>{`@keyframes cdspin{to{transform:rotate(360deg)}} .cd-spinner{width:32px;height:32px;border:3px solid #fce7f3;border-top-color:#F583BF;border-radius:50%;animation:cdspin 0.7s linear infinite;display:inline-block;}`}</style>
    </div>
  );

  return (
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
        .cd-spinner { width:32px; height:32px; border:3px solid #fce7f3; border-top-color:#F583BF; border-radius:50%; animation:cdspin 0.7s linear infinite; display:inline-block; }
        .cd-spinner-sm { width:16px; height:16px; border:2px solid rgba(245,131,191,0.3); border-top-color:#F583BF; border-radius:50%; animation:cdspin 0.7s linear infinite; display:inline-block; }
      `}</style>
    </div>
  );
}
