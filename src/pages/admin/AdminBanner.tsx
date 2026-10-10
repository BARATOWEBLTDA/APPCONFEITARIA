import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Image as ImageIcon, Trash, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { Botao, Campo, Titulo, avisar, confirmar } from "@/components/base";
import "./admin-banner.css";

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
  const [criandoId, setCriandoId] = useState<Audiencia | null>(null);
  const freeRef = useRef<HTMLInputElement>(null);
  const proRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("admin_banner").select("*");
    if (error) {
      avisar("Erro ao carregar: " + error.message, { tipo: "erro" });
      setLoading(false);
      return;
    }
    const byAud: Record<Audiencia, BannerRow | null> = { free: null, pro: null };
    (data || []).forEach((r: BannerRow) => { byAud[r.audiencia] = r; });
    setRows(byAud);
    setLoading(false);
  };

  const showMsg = (text: string, kind: "ok" | "err") => {
    avisar(text, { tipo: kind === "err" ? "erro" : "ok" });
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
      if (!row) throw new Error("Este banner ainda não foi criado no banco.");

      const { error: updErr } = await supabase
        .from("admin_banner")
        .update({ imagem_url: publicUrl, atualizado_em: new Date().toISOString() })
        .eq("id", row.id);
      if (updErr) throw updErr;

      showMsg("Imagem enviada", "ok");
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
    showMsg("Salvo", "ok");
    await load();
  };

  /** Cria o registro padrão do banner (sem imagem, desligado) quando ele ainda não existe no banco */
  const criarRegistro = async (aud: Audiencia) => {
    setCriandoId(aud);
    const { error } = await supabase.from("admin_banner").insert({ audiencia: aud, imagem_url: null, link_destino: "/assinar", ativo: false });
    setCriandoId(null);
    if (error) { showMsg("Não deu pra criar o banner. Peça para rodar o SQL de configuração. (" + error.message + ")", "err"); return; }
    showMsg("Banner criado", "ok");
    await load();
  };

  const removerImagem = async (aud: Audiencia) => {
    if (!(await confirmar({ titulo: "Remover a imagem?", texto: "O banner fica desativado até você enviar outra.", rotulo: "Remover", perigo: true }))) return;
    await salvar(aud, { imagem_url: null, ativo: false });
  };

  if (loading) {
    return <div className="ab-carregando"><span className="ui-gira" aria-label="Carregando" /></div>;
  }

  const renderCard = (aud: Audiencia, titulo: string, descricao: string, inputRef: React.RefObject<HTMLInputElement>) => {
    const row = rows[aud];
    if (!row) return (
      <div className="ab-card">
        <div className="ab-head-tx">
          <h2 className="ab-title">{titulo}</h2>
          <p className="ab-desc">{descricao}</p>
        </div>
        <p className="ab-warn"><WarningCircle size={18} weight="bold" aria-hidden="true" /><span>Este banner ainda não foi criado no banco. Crie agora ou peça para rodar o SQL de configuração.</span></p>
        <div className="ab-actions">
          <Botao tamanho="m" onClick={() => criarRegistro(aud)} carregando={criandoId === aud}>Criar registro</Botao>
        </div>
      </div>
    );
    const uploading = uploadingId === aud;
    const saving = savingId === aud;
    return (
      <div className="ab-card">
        <div className="ab-head">
          <div className="ab-head-tx">
            <h2 className="ab-title">{titulo}</h2>
            <p className="ab-desc">{descricao}</p>
          </div>
          <label className={`ab-toggle${!row.imagem_url ? " ab-toggle--off" : ""}`}>
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
            <div className="ab-empty"><ImageIcon size={24} weight="bold" aria-hidden="true" /><span>Nenhuma imagem enviada</span></div>
          )}
        </div>

        <Campo
          rotulo="Link de destino"
          value={row.link_destino || ""}
          onChange={(e) => setRows((r) => ({ ...r, [aud]: { ...row, link_destino: e.target.value } }))}
          onBlur={() => salvar(aud, { link_destino: row.link_destino || "/assinar" })}
          placeholder="/assinar"
          dica="Salva sozinho quando você sai do campo."
        />

        <div className="ab-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleUpload(aud, e)}
          />
          <Botao tamanho="m" icone={<UploadSimple size={20} weight="bold" />} onClick={() => inputRef.current?.click()} carregando={uploading}>
            {row.imagem_url ? "Trocar imagem" : "Enviar imagem"}
          </Botao>
          {row.imagem_url && (
            <Botao tamanho="m" variante="secundario" icone={<Trash size={20} weight="bold" />} onClick={() => removerImagem(aud)}>
              Remover
            </Botao>
          )}
        </div>

        <p className="ab-tip">Tamanho ideal: 1200×400 (3:1). Aceita JPG, PNG e WebP.</p>
      </div>
    );
  };

  return (
    <div className="ab-root">
      <Titulo nivel="tela" apoio="Aparece no Início do app (celular), entre o Acesso rápido e as Últimas atualizações.">Banner do celular</Titulo>

      <div className="ab-grid">
        {renderCard("free", "Banner do plano grátis", "Aparece pra quem está no plano grátis (ex.: promoção do PRO).", freeRef)}
        {renderCard("pro", "Banner do plano PRO", "Opcional. Aparece pra quem já é PRO. Inativo ou sem imagem, quem é PRO não vê banner.", proRef)}
      </div>
    </div>
  );
}
