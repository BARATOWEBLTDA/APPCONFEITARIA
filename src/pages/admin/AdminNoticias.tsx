import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, PencilSimple, Trash, ArrowUp, ArrowDown, Eye, EyeSlash, X, Image as ImageIcon } from "@phosphor-icons/react";
import RichEditor from "@/components/RichEditor";

interface Noticia {
  id: string;
  emoji: string;
  titulo: string;
  descricao: string;
  conteudo: any;
  imagem_capa: string | null;
  icone_url: string | null;
  slug: string;
  autor: string;
  categoria: string | null;
  cta_texto: string | null;
  cta_url: string | null;
  tempo_leitura: number | null;
  ordem: number;
  ativo: boolean;
  views: number;
  publicado_em: string;
  fixada: boolean;
}

const EMOJIS_SUGERIDOS = ["📢", "👋", "💡", "🤖", "🎨", "✨", "🎂", "🍰", "⭐", "🚀", "🔥", "🎁", "📱", "🎉"];
const CATEGORIAS = ["Dica", "Novidade", "Boas-vindas", "Aviso", "Tutorial"];

function estimarTempoLeitura(conteudo: any): number {
  if (!conteudo) return 1;
  const textoJoin = (nodes: any[]): string => nodes.map((n: any) => n.text || (n.content ? textoJoin(n.content) : "")).join(" ");
  const texto = conteudo.content ? textoJoin(conteudo.content) : "";
  const palavras = texto.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(palavras / 200));
}

export default function AdminNoticias() {
  const [rows, setRows] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Noticia | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const capaRef = useRef<HTMLInputElement>(null);
  const iconeRef = useRef<HTMLInputElement>(null);
  const [uploadingIcone, setUploadingIcone] = useState(false);
  const [form, setForm] = useState({ emoji: "📢", titulo: "", descricao: "", conteudo: null as any, imagem_capa: "", icone_url: "", autor: "Equipe Doonly", categoria: "", cta_texto: "", cta_url: "", ativo: true, fixada: false });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("admin_noticias").select("*").order("fixada", { ascending: false }).order("ordem", { ascending: false }).order("publicado_em", { ascending: false });
    if (error) setMsg({ text: "Erro: " + error.message, kind: "err" });
    else setRows(data as Noticia[]);
    setLoading(false);
  };

  const showMsg = (text: string, kind: "ok" | "err") => { setMsg({ text, kind }); setTimeout(() => setMsg(null), 3500); };

  const abrirNovo = () => {
    setEditing(null);
    setForm({ emoji: "📢", titulo: "", descricao: "", conteudo: null, imagem_capa: "", icone_url: "", autor: "Equipe Doonly", categoria: "", cta_texto: "", cta_url: "", ativo: true, fixada: false });
    setModalOpen(true);
  };

  const abrirEditar = (n: Noticia) => {
    setEditing(n);
    setForm({ emoji: n.emoji, titulo: n.titulo, descricao: n.descricao, conteudo: n.conteudo, imagem_capa: n.imagem_capa || "", icone_url: n.icone_url || "", autor: n.autor || "Equipe Doonly", categoria: n.categoria || "", cta_texto: n.cta_texto || "", cta_url: n.cta_url || "", ativo: n.ativo, fixada: n.fixada || false });
    setModalOpen(true);
  };

  const uploadCapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCapa(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `capa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("noticias-capas").upload(fileName, file, { cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("noticias-capas").getPublicUrl(fileName);
      setForm(f => ({ ...f, imagem_capa: data.publicUrl }));
    } catch (err: any) { showMsg("Erro upload: " + err.message, "err"); }
    setUploadingCapa(false);
    e.target.value = "";
  };

  const uploadIcone = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcone(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `icone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("noticias-capas").upload(fileName, file, { cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("noticias-capas").getPublicUrl(fileName);
      setForm(f => ({ ...f, icone_url: data.publicUrl }));
    } catch (err: any) { showMsg("Erro upload: " + err.message, "err"); }
    setUploadingIcone(false);
    e.target.value = "";
  };

  const salvar = async () => {
    if (!form.titulo.trim()) { alert("Preencha o título"); return; }
    setSaving(true);
    try {
      const payload = {
        emoji: form.emoji,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        conteudo: form.conteudo,
        imagem_capa: form.imagem_capa || null,
        icone_url: form.icone_url || null,
        autor: form.autor.trim() || "Equipe Doonly",
        categoria: form.categoria.trim() || null,
        cta_texto: form.cta_texto.trim() || null,
        cta_url: form.cta_url.trim() || null,
        tempo_leitura: estimarTempoLeitura(form.conteudo),
        ativo: form.ativo,
        fixada: form.fixada,
      };
      if (editing) {
        const { error } = await supabase.from("admin_noticias").update(payload).eq("id", editing.id);
        if (error) throw error;
        showMsg("Atualizada!", "ok");
      } else {
        const maxOrdem = rows.length > 0 ? Math.max(...rows.map(r => r.ordem)) : 0;
        const { error } = await supabase.from("admin_noticias").insert({ ...payload, ordem: maxOrdem + 10 });
        if (error) throw error;
        showMsg("Criada!", "ok");
      }
      setModalOpen(false);
      await load();
    } catch (err: any) { showMsg("Erro: " + err.message, "err"); }
    setSaving(false);
  };

  const excluir = async (n: Noticia) => {
    if (!confirm(`Excluir "${n.titulo}"?`)) return;
    const { error } = await supabase.from("admin_noticias").delete().eq("id", n.id);
    if (error) showMsg("Erro: " + error.message, "err"); else { showMsg("Excluída!", "ok"); await load(); }
  };

  const toggleAtivo = async (n: Noticia) => {
    const { error } = await supabase.from("admin_noticias").update({ ativo: !n.ativo }).eq("id", n.id);
    if (error) showMsg("Erro: " + error.message, "err"); else await load();
  };

  const mover = async (n: Noticia, dir: "up" | "down") => {
    const idx = rows.findIndex(r => r.id === n.id);
    if (idx === -1) return;
    const outroIdx = dir === "up" ? idx - 1 : idx + 1;
    if (outroIdx < 0 || outroIdx >= rows.length) return;
    const outro = rows[outroIdx];
    await supabase.from("admin_noticias").update({ ordem: outro.ordem }).eq("id", n.id);
    await supabase.from("admin_noticias").update({ ordem: n.ordem }).eq("id", outro.id);
    await load();
  };

  if (loading) return <div className="an-loading">Carregando...</div>;

  return (
    <div className="an-root">
      <div className="an-header">
        <div>
          <h1 className="an-title">Notícias da Home</h1>
          <p className="an-sub">Aparecem na Home e em /noticias</p>
        </div>
        <button className="an-btn-new" onClick={abrirNovo}><Plus size={16} weight="bold" /> Nova notícia</button>
      </div>

      {msg && <div className={`an-msg an-msg--${msg.kind}`}>{msg.text}</div>}

      {rows.length === 0 ? (
        <div className="an-empty"><p>Nenhuma notícia ainda.</p><button className="an-btn-new" onClick={abrirNovo}><Plus size={16} weight="bold" /> Criar primeira</button></div>
      ) : (
        <div className="an-list">
          {rows.map((n, idx) => (
            <div key={n.id} className={`an-card ${!n.ativo ? "an-card--off" : ""}`}>
              <div className="an-card-capa">{n.imagem_capa ? <img src={n.imagem_capa} alt="" /> : <span>{n.emoji}</span>}</div>
              <div className="an-card-body">
                <div className="an-card-tags">
                  {n.fixada && <span className="an-tag an-tag--fix">📌 Fixada</span>}
                  {n.categoria && <span className="an-tag">{n.categoria}</span>}
                  {!n.ativo && <span className="an-tag an-tag--off">Desativada</span>}
                  {n.views > 0 && <span className="an-views">{n.views} views</span>}
                  <span className="an-ordem">ordem: {n.ordem}</span>
                </div>
                <p className="an-card-t">{n.titulo}</p>
                <p className="an-card-d">{n.descricao || "(sem descrição)"}</p>
                <p className="an-card-slug">/{n.slug}</p>
              </div>
              <div className="an-card-actions">
                <button className="an-icbtn" onClick={() => mover(n, "up")} disabled={idx === 0} title="Subir"><ArrowUp size={14} weight="bold" /></button>
                <button className="an-icbtn" onClick={() => mover(n, "down")} disabled={idx === rows.length - 1} title="Descer"><ArrowDown size={14} weight="bold" /></button>
                <button className="an-icbtn" onClick={() => toggleAtivo(n)} title={n.ativo ? "Desativar" : "Ativar"}>{n.ativo ? <Eye size={14} weight="bold" /> : <EyeSlash size={14} weight="bold" />}</button>
                <button className="an-icbtn" onClick={() => abrirEditar(n)} title="Editar"><PencilSimple size={14} weight="bold" /></button>
                <button className="an-icbtn an-icbtn--danger" onClick={() => excluir(n)} title="Excluir"><Trash size={14} weight="bold" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="an-modal-overlay" onClick={() => !saving && setModalOpen(false)}>
          <div className="an-modal" onClick={e => e.stopPropagation()}>
            <div className="an-modal-head">
              <h2>{editing ? "Editar notícia" : "Nova notícia"}</h2>
              <button className="an-icbtn" onClick={() => !saving && setModalOpen(false)}><X size={16} weight="bold" /></button>
            </div>
            <div className="an-modal-body">
              <div className="an-field">
                <label>Emoji</label>
                <div className="an-emoji-row">
                  <input type="text" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4} className="an-emoji-input" />
                  <div className="an-emoji-chips">{EMOJIS_SUGERIDOS.map(e => <button key={e} className="an-emoji-chip" onClick={() => setForm(f => ({ ...f, emoji: e }))}>{e}</button>)}</div>
                </div>
              </div>
              <div className="an-field">
                <label>Título</label>
                <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Como fotografar seus bolos" maxLength={120} />
              </div>
              <div className="an-field">
                <label>Imagem de capa</label>
                {form.imagem_capa ? (
                  <div className="an-capa-preview">
                    <img src={form.imagem_capa} alt="" />
                    <button className="an-capa-remove" onClick={() => setForm(f => ({ ...f, imagem_capa: "" }))}>✕ Remover</button>
                  </div>
                ) : (
                  <div className="an-capa-upload" onClick={() => !uploadingCapa && capaRef.current?.click()}>
                    {uploadingCapa ? <span>Enviando...</span> : (<><ImageIcon size={24} weight="regular" /><span>Enviar imagem de capa</span><span className="an-capa-hint">Formato 16:9 · até 2MB</span></>)}
                  </div>
                )}
                <input ref={capaRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadCapa} />
              </div>

              <div className="an-field">
                <label>Ícone pequeno (imagem quadrada) — aparece no card da Home</label>
                {form.icone_url ? (
                  <div className="an-icone-preview">
                    <img src={form.icone_url} alt="" />
                    <button className="an-capa-remove" onClick={() => setForm(f => ({ ...f, icone_url: "" }))}>✕ Remover</button>
                  </div>
                ) : (
                  <div className="an-icone-upload" onClick={() => !uploadingIcone && iconeRef.current?.click()}>
                    {uploadingIcone ? <span>Enviando...</span> : (<><ImageIcon size={22} weight="regular" /><span>Enviar ícone quadrado</span><span className="an-capa-hint">1:1 · até 500KB · Se vazio, usa o emoji</span></>)}
                  </div>
                )}
                <input ref={iconeRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadIcone} />
              </div>
              <div className="an-row">
                <div className="an-field">
                  <label>Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Nenhuma</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="an-field">
                  <label>Autor</label>
                  <input type="text" value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} />
                </div>
              </div>
              <div className="an-field">
                <label>Descrição curta (aparece no card da Home)</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} maxLength={200} />
              </div>
              <div className="an-field">
                <label>Conteúdo completo</label>
                <RichEditor content={form.conteudo} onChange={(json) => setForm(f => ({ ...f, conteudo: json }))} />
              </div>
              <div className="an-row">
                <div className="an-field">
                  <label>Texto do botão CTA (opcional)</label>
                  <input type="text" value={form.cta_texto} onChange={e => setForm(f => ({ ...f, cta_texto: e.target.value }))} />
                </div>
                <div className="an-field">
                  <label>Link do botão</label>
                  <input type="text" value={form.cta_url} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))} />
                </div>
              </div>
              <div className="an-field">
                <label className="an-toggle-lbl">
                  <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                  <span>Ativa (aparece pra usuários)</span>
                </label>
              </div>

              <div className="an-field">
                <label className="an-toggle-lbl">
                  <input type="checkbox" checked={form.fixada} onChange={e => setForm(f => ({ ...f, fixada: e.target.checked }))} />
                  <span>📌 <b>Fixar no topo</b> (sempre visível na Home)</span>
                </label>
                {form.fixada && (
                  <p className="an-fix-hint">
                    ⚠️ Só pode ter <b>1 notícia fixada</b>. Se já existir outra, ela vai ser desafixada automaticamente ao salvar.
                  </p>
                )}
              </div>
            </div>
            <div className="an-modal-foot">
              <button className="an-btn-cancel" onClick={() => !saving && setModalOpen(false)}>Cancelar</button>
              <button className="an-btn-save" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : (editing ? "Salvar" : "Criar")}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .an-root { padding: 24px; max-width: 900px; margin: 0 auto; font-family: 'Geist', sans-serif; }
        .an-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .an-title { font-size: 22px; font-weight: 900; margin: 0 0 4px; color: #2C1219; }
        .an-sub { font-size: 13px; color: #6B7280; margin: 0; }
        .an-loading { padding: 40px; text-align: center; color: #6B7280; }
        .an-btn-new { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; background: linear-gradient(135deg, #E85A8C, #C33A6E); color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 #7A1B47; font-family: inherit; }
        .an-msg { padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
        .an-msg--ok { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }
        .an-msg--err { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
        .an-empty { text-align: center; padding: 60px 20px; color: #6B7280; }
        .an-list { display: flex; flex-direction: column; gap: 10px; }
        .an-card { display: flex; gap: 14px; padding: 14px 16px; background: #fff; border: 1px solid #F0EBED; border-radius: 10px; }
        .an-card--off { opacity: 0.55; }
        .an-card-capa { width: 60px; height: 60px; border-radius: 8px; background: #F5F0F2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .an-card-capa img { width: 100%; height: 100%; object-fit: cover; }
        .an-card-capa span { font-size: 28px; }
        .an-card-body { flex: 1; min-width: 0; }
        .an-card-tags { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; flex-wrap: wrap; }
        .an-tag { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 2px; background: #F5F0F2; color: #4B5563; letter-spacing: 0.02em; }
        .an-tag--off { background: #F5F0F2; color: #6B7280; }
        .an-tag--fix { background: #FEF3C7; color: #B45309; font-weight: 800; }
        .an-fix-hint { margin: 6px 0 0; font-size: 11px; color: #B45309; background: #FEF3C7; padding: 8px 10px; border-radius: 6px; }
        .an-views { font-size: 10px; color: #6B7280; }
        .an-ordem { font-size: 10px; color: #9CA3AF; margin-left: auto; }
        .an-card-t { font-size: 14px; font-weight: 800; margin: 0 0 3px; color: #2C1219; }
        .an-card-d { font-size: 12.5px; color: #6B7280; margin: 0 0 3px; line-height: 1.4; }
        .an-card-slug { font-size: 10.5px; color: #9CA3AF; margin: 0; font-family: monospace; }
        .an-card-actions { display: flex; gap: 4px; flex-shrink: 0; align-items: flex-start; }
        .an-icbtn { width: 30px; height: 30px; background: #F5F0F2; border: none; border-radius: 6px; color: #6B7280; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .an-icbtn:hover:not(:disabled) { background: #E5DDE0; color: #2C1219; }
        .an-icbtn:disabled { opacity: 0.3; cursor: not-allowed; }
        .an-icbtn--danger:hover { background: #FEF2F2; color: #B91C1C; }
        .an-modal-overlay { position: fixed; inset: 0; background: rgba(44,18,25,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100; }
        .an-modal { background: #fff; border-radius: 14px; width: 100%; max-width: 720px; max-height: 92vh; overflow: hidden; display: flex; flex-direction: column; }
        .an-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #F0EBED; }
        .an-modal-head h2 { margin: 0; font-size: 17px; font-weight: 800; color: #2C1219; }
        .an-modal-body { padding: 20px; overflow-y: auto; flex: 1; }
        .an-modal-foot { padding: 14px 20px; border-top: 1px solid #F0EBED; display: flex; gap: 8px; justify-content: flex-end; }
        .an-btn-cancel { padding: 10px 16px; background: transparent; color: #6B7280; border: 1px solid #F0EBED; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .an-btn-save { padding: 10px 20px; background: linear-gradient(135deg, #E85A8C, #C33A6E); color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 #7A1B47; font-family: inherit; }
        .an-btn-save:disabled { opacity: 0.5; cursor: wait; }
        .an-field { margin-bottom: 16px; }
        .an-field label { display: block; font-size: 12px; font-weight: 700; color: #2C1219; margin-bottom: 6px; }
        .an-field input[type="text"], .an-field textarea, .an-field select { width: 100%; padding: 10px 12px; border: 1.5px solid #F0EBED; border-radius: 8px; font-size: 13.5px; font-family: inherit; resize: vertical; }
        .an-field input:focus, .an-field textarea:focus, .an-field select:focus { outline: none; border-color: #E85A8C; }
        .an-row { display: flex; gap: 10px; }
        .an-row .an-field { flex: 1; }
        .an-emoji-row { display: flex; gap: 8px; align-items: center; }
        .an-emoji-input { width: 60px !important; text-align: center; font-size: 20px !important; }
        .an-emoji-chips { display: flex; gap: 4px; flex-wrap: wrap; }
        .an-emoji-chip { width: 32px; height: 32px; background: #F5F0F2; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; }
        .an-emoji-chip:hover { background: #E5DDE0; }
        .an-toggle-lbl { display: flex !important; align-items: center; gap: 8px; cursor: pointer; }
        .an-toggle-lbl input { width: 18px; height: 18px; margin: 0; }
        .an-capa-upload { width: 100%; aspect-ratio: 16/9; background: #FAFAFA; border: 2px dashed #E5DDE0; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #6B7280; gap: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }
        .an-capa-upload:hover { background: #F5F0F2; border-color: #E85A8C; color: #C33A6E; }
        .an-capa-hint { font-size: 10px; color: #9CA3AF; }
        .an-capa-preview { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: 10px; overflow: hidden; }
        .an-capa-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .an-capa-remove { position: absolute; top: 8px; right: 8px; padding: 6px 10px; background: rgba(0,0,0,0.65); color: #fff; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; backdrop-filter: blur(6px); }
        .an-icone-upload { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #FAFAFA; border: 2px dashed #E5DDE0; border-radius: 10px; color: #6B7280; cursor: pointer; font-size: 12px; font-weight: 600; }
        .an-icone-upload:hover { background: #F5F0F2; border-color: #E85A8C; color: #C33A6E; }
        .an-icone-preview { position: relative; display: inline-block; }
        .an-icone-preview img { width: 84px; height: 84px; object-fit: cover; border-radius: 10px; display: block; border: 1px solid #F0EBED; }
      `}</style>
    </div>
  );
}
