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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingBanner1, setUploadingBanner1] = useState(false);
  const [uploadingBanner2, setUploadingBanner2] = useState(false);
  const [uploadingBanner3, setUploadingBanner3] = useState(false);
  const [success, setSuccess] = useState(false);
  const { isPro } = usePlano();

  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const banner1Ref = useRef<HTMLInputElement>(null);
  const banner2Ref = useRef<HTMLInputElement>(null);
  const banner3Ref = useRef<HTMLInputElement>(null);

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
    setUploadingLogo(true);
    const url = await uploadImage(file, `logos/${userId}`);
    if (url) { setLogoUrl(url); await supabase.from("profiles").update({ logo_url: url }).eq("id", userId); showSuccess(); }
    setUploadingLogo(false);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploadingBanner(true);
    const url = await uploadImage(file, `banners/${userId}`);
    if (url) { setBannerUrl(url); await supabase.from("profiles").update({ banner_url: url }).eq("id", userId); showSuccess(); }
    setUploadingBanner(false);
  };

  const handleBanner1Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploadingBanner1(true);
    const url = await uploadImage(file, `banners/${userId}-1`);
    if (url) { setBanner1Url(url); await supabase.from("profiles").update({ banner1_url: url }).eq("id", userId); showSuccess(); }
    setUploadingBanner1(false);
  };

  const handleBanner2Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploadingBanner2(true);
    const url = await uploadImage(file, `banners/${userId}-2`);
    if (url) { setBanner2Url(url); await supabase.from("profiles").update({ banner2_url: url }).eq("id", userId); showSuccess(); }
    setUploadingBanner2(false);
  };

  const handleBanner3Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploadingBanner3(true);
    const url = await uploadImage(file, `banners/${userId}-3`);
    if (url) { setBanner3Url(url); await supabase.from("profiles").update({ banner3_url: url }).eq("id", userId); showSuccess(); }
    setUploadingBanner3(false);
  };

  const handleRemoveLogo = async () => { if (!userId) return; setLogoUrl(""); await supabase.from("profiles").update({ logo_url: null }).eq("id", userId); };
  const handleRemoveBanner = async () => { if (!userId) return; setBannerUrl(""); await supabase.from("profiles").update({ banner_url: null }).eq("id", userId); };
  const handleRemoveBanner1 = async () => { if (!userId) return; setBanner1Url(""); await supabase.from("profiles").update({ banner1_url: null }).eq("id", userId); };
  const handleRemoveBanner2 = async () => { if (!userId) return; setBanner2Url(""); await supabase.from("profiles").update({ banner2_url: null }).eq("id", userId); };
  const handleRemoveBanner3 = async () => { if (!userId) return; setBanner3Url(""); await supabase.from("profiles").update({ banner3_url: null }).eq("id", userId); };

  const BannerSlot = ({ label, url, uploading, inputRef, onUpload, onRemove }: any) => (
    <div className="cd-card" style={{ marginTop: 0 }}>
      <SectionLabel>{label}</SectionLabel>
      {url ? (
        <div className="cd-banner-preview">
          <img src={url} alt={label} />
          <button className="cd-remove-btn cd-remove-banner" onClick={onRemove}>✕</button>
        </div>
      ) : (
        <div className="cd-upload-box cd-upload-banner" onClick={() => !uploading && inputRef.current?.click()}>
          {uploading ? <span className="cd-spinner" /> : (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <p className="cd-upload-label">Enviar {label.toLowerCase()}</p>
              <span className="cd-upload-hint">PNG ou JPG</span>
            </>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onUpload} />
      {url && (
        <button className="cd-change-btn" onClick={() => inputRef.current?.click()}>
          {uploading ? <span className="cd-spinner-sm" /> : `Trocar ${label.toLowerCase()}`}
        </button>
      )}
    </div>
  );

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

      {/* Banner principal — todos */}
      <BannerSlot label="Banner" url={bannerUrl} uploading={uploadingBanner} inputRef={bannerRef} onUpload={handleBannerUpload} onRemove={handleRemoveBanner} />

      {/* Banners extras — só PRO */}
      {isPro ? (
        <>
          <div className="cd-pro-section">
            <span className="cd-pro-badge">✦ PRO</span>
            <p className="cd-pro-hint">Adicione até 3 banners extras — eles aparecem em carrossel no seu cardápio</p>
          </div>
          <BannerSlot label="Banner 2" url={banner1Url} uploading={uploadingBanner1} inputRef={banner1Ref} onUpload={handleBanner1Upload} onRemove={handleRemoveBanner1} />
          <BannerSlot label="Banner 3" url={banner2Url} uploading={uploadingBanner2} inputRef={banner2Ref} onUpload={handleBanner2Upload} onRemove={handleRemoveBanner2} />
          <BannerSlot label="Banner 4" url={banner3Url} uploading={uploadingBanner3} inputRef={banner3Ref} onUpload={handleBanner3Upload} onRemove={handleRemoveBanner3} />
        </>
      ) : (
        <div className="cd-upgrade-box">
          <img src="/diamante.png" alt="PRO" style={{ width: '28px', height: '28px' }} />
          <div>
            <p className="cd-upgrade-title">Banners em carrossel</p>
            <p className="cd-upgrade-sub">Assine o plano PRO para adicionar até 4 banners em carrossel no seu cardápio</p>
          </div>
        </div>
      )}

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
        .cd-pro-section { display:flex; flex-direction:column; align-items:center; gap:4px; padding:0.5rem 0 0; }
        .cd-pro-badge { background:linear-gradient(135deg,#ec4899,#a855f7); color:white; font-size:0.72rem; font-weight:800; padding:3px 12px; border-radius:50px; letter-spacing:0.1em; }
        .cd-pro-hint { font-size:0.78rem; color:#6b7280; margin:0; text-align:center; }
        .cd-upgrade-box { background:#fdf2f8; border:1.5px dashed #f9a8d4; border-radius:16px; padding:1rem 1.25rem; display:flex; align-items:center; gap:1rem; }
        .cd-upgrade-title { font-size:0.88rem; font-weight:700; color:#374151; margin:0 0 2px; }
        .cd-upgrade-sub { font-size:0.76rem; color:#9ca3af; margin:0; }
      `}</style>
    </div>
  );
}
