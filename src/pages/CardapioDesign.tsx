import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const SectionLabel = ({ children }: any) => <p className="cd-section-label">{children}</p>;

export default function CardapioDesign() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [success, setSuccess] = useState(false);

  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("logo_url, banner_url").eq("id", user.id).single();
      if (data) {
        setLogoUrl(data.logo_url || "");
        setBannerUrl(data.banner_url || "");
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingLogo(true);
    const url = await uploadImage(file, `logos/${userId}`);
    if (url) {
      setLogoUrl(url);
      await supabase.from("profiles").update({ logo_url: url }).eq("id", userId);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }
    setUploadingLogo(false);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingBanner(true);
    const url = await uploadImage(file, `banners/${userId}`);
    if (url) {
      setBannerUrl(url);
      await supabase.from("profiles").update({ banner_url: url }).eq("id", userId);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }
    setUploadingBanner(false);
  };

  const handleRemoveLogo = async () => {
    if (!userId) return;
    setLogoUrl("");
    await supabase.from("profiles").update({ logo_url: null }).eq("id", userId);
  };

  const handleRemoveBanner = async () => {
    if (!userId) return;
    setBannerUrl("");
    await supabase.from("profiles").update({ banner_url: null }).eq("id", userId);
  };

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

      {/* Card — Logo */}
      <div className="cd-card">
        <SectionLabel>Logotipo</SectionLabel>
        <p className="cd-hint">Aparece no topo do cardápio em formato circular</p>
        <div className="cd-logo-area">
          {logoUrl ? (
            <div className="cd-logo-preview">
              <img src={logoUrl} alt="Logo" />
              <button className="cd-remove-btn" onClick={handleRemoveLogo}>✕</button>
            </div>
          ) : (
            <div className="cd-upload-box cd-upload-logo" onClick={() => !uploadingLogo && logoRef.current?.click()}>
              {uploadingLogo ? <span className="cd-spinner" /> : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p className="cd-upload-label">Enviar logo</p>
                  <span className="cd-upload-hint">PNG ou JPG</span>
                </>
              )}
            </div>
          )}
          <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
          {logoUrl && (
            <button className="cd-change-btn" onClick={() => logoRef.current?.click()}>
              {uploadingLogo ? <span className="cd-spinner-sm" /> : "Trocar logo"}
            </button>
          )}
        </div>
      </div>

      {/* Card — Banner */}
      <div className="cd-card">
        <SectionLabel>Banner</SectionLabel>
        <p className="cd-hint">Aparece no topo do cardápio, acima da logo. Pode ser quadrado ou retangular.</p>
        {bannerUrl ? (
          <div className="cd-banner-preview">
            <img src={bannerUrl} alt="Banner" />
            <button className="cd-remove-btn cd-remove-banner" onClick={handleRemoveBanner}>✕</button>
          </div>
        ) : (
          <div className="cd-upload-box cd-upload-banner" onClick={() => !uploadingBanner && bannerRef.current?.click()}>
            {uploadingBanner ? <span className="cd-spinner" /> : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p className="cd-upload-label">Enviar banner</p>
                <span className="cd-upload-hint">Quadrado ou retangular • PNG ou JPG</span>
              </>
            )}
          </div>
        )}
        <input ref={bannerRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerUpload} />
        {bannerUrl && (
          <button className="cd-change-btn" onClick={() => bannerRef.current?.click()}>
            {uploadingBanner ? <span className="cd-spinner-sm" /> : "Trocar banner"}
          </button>
        )}
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
        .cd-upload-box { border:2px dashed #fce7f3; border-radius:16px; background:#fdf2f8; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; transition:border-color 0.2s; gap:0.4rem; }
        .cd-upload-box:hover { border-color:#F583BF; }
        .cd-upload-logo { width:130px; height:130px; border-radius:50%; }
        .cd-upload-banner { width:100%; padding:2.5rem 1rem; box-sizing:border-box; }
        .cd-upload-label { font-size:0.88rem; font-weight:700; color:#374151; margin:0; }
        .cd-upload-hint { font-size:0.72rem; color:#9ca3af; margin:0; }
        .cd-logo-area { display:flex; flex-direction:column; align-items:center; gap:0.75rem; }
        .cd-logo-preview { position:relative; width:130px; height:130px; border-radius:50%; overflow:hidden; border:3px solid #fce7f3; flex-shrink:0; }
        .cd-logo-preview img { width:100%; height:100%; object-fit:cover; }
        .cd-banner-preview { position:relative; width:100%; border-radius:12px; overflow:hidden; }
        .cd-banner-preview img { width:100%; height:auto; display:block; }
        .cd-remove-btn { position:absolute; top:0.35rem; right:0.35rem; background:rgba(0,0,0,0.5); border:none; border-radius:50%; width:24px; height:24px; color:white; font-size:0.7rem; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .cd-remove-banner { top:0.5rem; right:0.5rem; width:28px; height:28px; font-size:0.8rem; }
        .cd-change-btn { align-self:center; padding:0.45rem 1.25rem; background:var(--bg-subtle,#f3f4f6); border:1.5px solid var(--border,#e5e7eb); border-radius:50px; font-family:'Nunito',sans-serif; font-size:0.82rem; font-weight:700; color:var(--text-secondary,#374151); cursor:pointer; display:flex; align-items:center; gap:0.35rem; }
        .cd-change-btn:hover { border-color:#F583BF; color:#F583BF; }
        .cd-spinner { width:32px; height:32px; border:3px solid #fce7f3; border-top-color:#F583BF; border-radius:50%; animation:cdspin 0.7s linear infinite; display:inline-block; }
        .cd-spinner-sm { width:16px; height:16px; border:2px solid rgba(245,131,191,0.3); border-top-color:#F583BF; border-radius:50%; animation:cdspin 0.7s linear infinite; display:inline-block; }
      `}</style>
    </div>
  );
}
