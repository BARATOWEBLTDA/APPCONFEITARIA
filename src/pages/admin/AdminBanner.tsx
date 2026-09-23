import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Audiencia = "free" | "pro";

interface BannerRow {
  id: string;
  audiencia: Audiencia;
  imagem_url: string | null;
  link_destino: string;
  ativo: boolean;
}

export default function AdminBanner() {
  const [rows, setRows] = useState<Record<Audiencia, BannerRow | null>>({ free: null, pro: null });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<Audiencia | null>(null);
  const [uploadingId, setUploadingId] = useState<Audiencia | null>(null);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const freeRef = useRef<HTMLInputElement>(null);
  const proRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("admin_banner").select("*");
    if (error) {
      setMsg({ text: "Erro ao carregar: " + error.message, kind: "err" });
      setLoading(false);
      return;
    }
    const byAud: Record<Audiencia, BannerRow | null> = { free: null, pro: null };
    (data || []).forEach((r: BannerRow) => { byAud[r.audiencia] = r; });
    setRows(byAud);
    setLoading(false);
  };

  const showMsg = (text: string, kind: "ok" | "err") => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 3500);
  };

  const handleUpload = async (aud: Audiencia, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(aud);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${aud}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("admin-banners")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const { data: publicData } = supabase.storage.from("admin-banners").getPublicUrl(fileName);
      const publicUrl = publicData.publicUrl;

      const row = rows[aud];
      if (!row) throw new Error("Registro não encontrado — rode o SQL de setup.");

      const { error: updErr } = await supabase
        .from("admin_banner")
        .update({ imagem_url: publicUrl, atualizado_em: new Date().toISOString() })
        .eq("id", row.id);
      if (updErr) throw updErr;

      showMsg("Imagem enviada!", "ok");
      await load();
    } catch (err: any) {
      showMsg("Erro no upload: " + (err.message || err), "err");
    } finally {
      setUploadingId(null);
      if (e.target) e.target.value = "";
    }
  };

  const salvar = async (aud: Audiencia, patch: Partial<BannerRow>) => {
    const row = rows[aud];
    if (!row) return;
    setSavingId(aud);
    const { error } = await supabase
      .from("admin_banner")
      .update({ ...patch, atualizado_em: new Date().toISOString() })
      .eq("id", row.id);
    setSavingId(null);
    if (error) { showMsg("Erro ao salvar: " + error.message, "err"); return; }
    showMsg("Salvo!", "ok");
    await load();
  };

  const removerImagem = async (aud: Audiencia) => {
    if (!confirm("Remover a imagem atual?")) return;
    await salvar(aud, { imagem_url: null, ativo: false });
  };

  if (loading) {
    return <div style={{ padding: 24, color: "#6B7280" }}>Carregando…</div>;
  }

  const renderCard = (aud: Audiencia, titulo: string, descricao: string, inputRef: React.RefObject<HTMLInputElement>) => {
    const row = rows[aud];
    if (!row) return (
      <div className="ab-card">
        <div className="ab-warn">Registro <b>{aud}</b> não existe na tabela. Rode o SQL de setup.</div>
      </div>
    );
    const uploading = uploadingId === aud;
    const saving = savingId === aud;
    return (
      <div className="ab-card">
        <div className="ab-head">
          <div>
            <h2 className="ab-title">{titulo}</h2>
            <p className="ab-desc">{descricao}</p>
          </div>
          <label className="ab-toggle">
            <input
              type="checkbox"
              checked={row.ativo}
              onChange={(e) => salvar(aud, { ativo: e.target.checked })}
              disabled={saving || !row.imagem_url}
            />
            <span>{row.ativo ? "Ativo" : "Inativo"}</span>
          </label>
        </div>

        <div className="ab-preview">
          {row.imagem_url ? (
            <img src={row.imagem_url} alt={`Banner ${aud}`} />
          ) : (
            <div className="ab-empty">Nenhuma imagem enviada</div>
          )}
        </div>

        <div className="ab-field">
          <label>URL de destino</label>
          <input
            type="text"
            value={row.link_destino || ""}
            onChange={(e) => setRows((r) => ({ ...r, [aud]: { ...row, link_destino: e.target.value } }))}
            onBlur={() => salvar(aud, { link_destino: row.link_destino || "/assinar" })}
            placeholder="/assinar"
          />
        </div>

        <div className="ab-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => handleUpload(aud, e)}
          />
          <button
            className="ab-btn ab-btn-primary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Enviando…" : row.imagem_url ? "Trocar imagem" : "Enviar imagem"}
          </button>
          {row.imagem_url && (
            <button className="ab-btn ab-btn-ghost" onClick={() => removerImagem(aud)}>
              Remover
            </button>
          )}
        </div>

        <p className="ab-tip">Formato: <b>1200×400 (3:1)</b>. Formatos aceitos: JPG, PNG, WebP.</p>
      </div>
    );
  };

  return (
    <div className="ab-root">
      <div className="ab-header">
        <h1>Banner mobile</h1>
        <p>Configure banners que aparecem no Início do app (mobile) entre o Acesso Rápido e as Últimas Atualizações.</p>
      </div>

      {msg && (
        <div className={`ab-msg ab-msg--${msg.kind}`}>{msg.text}</div>
      )}

      <div className="ab-grid">
        {renderCard("free", "Banner FREE", "Aparece para confeiteiras no plano FREE (ex: promoção do PRO).", freeRef)}
        {renderCard("pro", "Banner PRO (opcional)", "Aparece para quem já é PRO. Se deixar inativo ou sem imagem, PRO não vê banner nenhum.", proRef)}
      </div>

      <style>{`
        .ab-root { padding: 24px; font-family: var(--font-base); max-width: 1100px; }
        .ab-header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 800; color: #2C1219; }
        .ab-header p { margin: 0 0 20px; color: #6B7280; font-size: 13.5px; }

        .ab-msg { padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; font-weight: 600; }
        .ab-msg--ok { background: #DCFCE7; color: #15803D; }
        .ab-msg--err { background: #FEE2E2; color: #B91C1C; }

        .ab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 900px) { .ab-grid { grid-template-columns: 1fr; } }

        .ab-card { background: #fff; border: 1px solid #F0EBED; border-radius: 8px; padding: 20px; }
        .ab-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .ab-title { margin: 0 0 4px; font-size: 15px; font-weight: 800; color: #2C1219; }
        .ab-desc { margin: 0; font-size: 12px; color: #6B7280; line-height: 1.4; max-width: 320px; }

        .ab-toggle { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #2C1219; cursor: pointer; user-select: none; flex-shrink: 0; }
        .ab-toggle input { width: 16px; height: 16px; cursor: pointer; accent-color: #E85A8C; }
        .ab-toggle input:disabled { cursor: not-allowed; opacity: 0.5; }

        .ab-preview { background: #F5F0F2; border-radius: 6px; overflow: hidden; aspect-ratio: 3/1; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .ab-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ab-empty { color: #9CA3AF; font-size: 12px; font-style: italic; }

        .ab-field { margin-bottom: 14px; }
        .ab-field label { display: block; font-size: 11px; font-weight: 700; color: #4B5563; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .ab-field input { width: 100%; padding: 9px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 13px; font-family: inherit; color: #2C1219; background: #fff; }
        .ab-field input:focus { outline: none; border-color: #E85A8C; }

        .ab-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .ab-btn { padding: 9px 14px; border-radius: 6px; font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; transition: opacity 0.15s; }
        .ab-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ab-btn-primary { background: #2C1219; color: #fff; }
        .ab-btn-ghost { background: transparent; color: #B91C1C; border: 1px solid #FCA5A5; }

        .ab-tip { margin: 0; font-size: 11px; color: #9CA3AF; }
        .ab-warn { background: #FEF3C7; color: #78350F; padding: 12px; border-radius: 6px; font-size: 12.5px; }
      `}</style>
    </div>
  );
}
