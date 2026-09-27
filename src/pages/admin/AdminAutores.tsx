import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, PencilSimple, Trash, User, Image as ImageIcon } from "@phosphor-icons/react";

interface Autor {
  id: string;
  nome: string;
  cargo: string | null;
  foto_url: string | null;
  bio: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

export default function AdminAutores() {
  const [autores, setAutores] = useState<Autor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Autor | null>(null);
  const [msg, setMsg] = useState<{ txt: string; tipo: "ok" | "err" } | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [form, setForm] = useState({ nome: "", cargo: "", foto_url: "", bio: "", ativo: true, ordem: 0 });

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_autores").select("*").order("ordem", { ascending: true }).order("created_at", { ascending: false });
    setAutores((data as Autor[]) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const showMsg = (txt: string, tipo: "ok" | "err" = "ok") => {
    setMsg({ txt, tipo });
    setTimeout(() => setMsg(null), 3000);
  };

  const abrirNovo = () => {
    setEditing(null);
    setForm({ nome: "", cargo: "", foto_url: "", bio: "", ativo: true, ordem: 0 });
    setModalOpen(true);
  };

  const abrirEditar = (a: Autor) => {
    setEditing(a);
    setForm({ nome: a.nome, cargo: a.cargo || "", foto_url: a.foto_url || "", bio: a.bio || "", ativo: a.ativo, ordem: a.ordem });
    setModalOpen(true);
  };

  const uploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `autor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("autores-fotos").upload(fileName, file, { cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("autores-fotos").getPublicUrl(fileName);
      setForm(f => ({ ...f, foto_url: data.publicUrl }));
    } catch (err: any) {
      showMsg("Erro upload: " + err.message, "err");
    }
    setUploadingFoto(false);
    e.target.value = "";
  };

  const salvar = async () => {
    if (!form.nome.trim()) return showMsg("Nome é obrigatório", "err");
    const payload = {
      nome: form.nome.trim(),
      cargo: form.cargo.trim() || null,
      foto_url: form.foto_url || null,
      bio: form.bio.trim() || null,
      ativo: form.ativo,
      ordem: form.ordem,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from("admin_autores").update(payload).eq("id", editing.id);
      if (error) return showMsg("Erro: " + error.message, "err");
    } else {
      const { error } = await supabase.from("admin_autores").insert(payload);
      if (error) return showMsg("Erro: " + error.message, "err");
    }
    setModalOpen(false);
    carregar();
    showMsg(editing ? "Atualizado!" : "Autor criado!");
  };

  const excluir = async (a: Autor) => {
    if (!confirm(`Excluir autor "${a.nome}"?\n\nAs notícias criadas por ele ficarão sem autor associado.`)) return;
    const { error } = await supabase.from("admin_autores").delete().eq("id", a.id);
    if (error) return showMsg("Erro: " + error.message, "err");
    carregar();
    showMsg("Autor excluído");
  };

  const toggleAtivo = async (a: Autor) => {
    await supabase.from("admin_autores").update({ ativo: !a.ativo }).eq("id", a.id);
    carregar();
  };

  return (
    <div className="aa-root">
      <div className="aa-header">
        <h1>Autores</h1>
        <button className="aa-btn-novo" onClick={abrirNovo}><Plus size={16} weight="bold" /> Novo autor</button>
      </div>
      <p className="aa-sub">Cadastre autores que podem ser vinculados a notícias.</p>

      {msg && <div className={`aa-msg aa-msg--${msg.tipo}`}>{msg.txt}</div>}

      {loading ? (
        <div className="aa-loading">Carregando...</div>
      ) : autores.length === 0 ? (
        <div className="aa-empty">
          <User size={48} weight="light" />
          <p>Nenhum autor cadastrado ainda</p>
          <button className="aa-btn-novo" onClick={abrirNovo}><Plus size={16} weight="bold" /> Cadastrar primeiro autor</button>
        </div>
      ) : (
        <div className="aa-grid">
          {autores.map(a => (
            <div key={a.id} className={`aa-card ${!a.ativo ? "aa-card--off" : ""}`}>
              <div className="aa-card-foto">
                {a.foto_url ? <img src={a.foto_url} alt={a.nome} /> : <span className="aa-card-inicial">{a.nome.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="aa-card-info">
                <p className="aa-card-nome">{a.nome}</p>
                {a.cargo && <p className="aa-card-cargo">{a.cargo}</p>}
                {a.bio && <p className="aa-card-bio">{a.bio}</p>}
              </div>
              <div className="aa-card-actions">
                <label className="aa-toggle">
                  <input type="checkbox" checked={a.ativo} onChange={() => toggleAtivo(a)} />
                  <span>{a.ativo ? "Ativo" : "Inativo"}</span>
                </label>
                <button className="aa-btn-icon" onClick={() => abrirEditar(a)} title="Editar"><PencilSimple size={14} /></button>
                <button className="aa-btn-icon aa-btn-icon--del" onClick={() => excluir(a)} title="Excluir"><Trash size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="aa-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="aa-modal" onClick={e => e.stopPropagation()}>
            <div className="aa-modal-header">
              <h2>{editing ? "Editar autor" : "Novo autor"}</h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="aa-field">
              <label>Foto</label>
              {form.foto_url ? (
                <div className="aa-foto-preview">
                  <img src={form.foto_url} alt="" />
                  <button className="aa-foto-remove" onClick={() => setForm(f => ({ ...f, foto_url: "" }))}>✕ Remover</button>
                </div>
              ) : (
                <div className="aa-foto-upload" onClick={() => !uploadingFoto && fotoRef.current?.click()}>
                  {uploadingFoto ? <span>Enviando...</span> : (<><ImageIcon size={22} /><span>Enviar foto</span><span className="aa-hint">Quadrada · até 500KB</span></>)}
                </div>
              )}
              <input ref={fotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadFoto} />
            </div>

            <div className="aa-field">
              <label>Nome *</label>
              <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Bruno Eduardo" />
            </div>

            <div className="aa-field">
              <label>Cargo / função</label>
              <input type="text" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Fundador, Editora de conteúdo" />
            </div>

            <div className="aa-field">
              <label>Bio (opcional)</label>
              <textarea rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Uma frase curta sobre o autor" />
            </div>

            <div className="aa-field">
              <label>Ordem de exibição</label>
              <input type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))} />
            </div>

            <label className="aa-check">
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
              <span>Autor ativo (aparece no dropdown das notícias)</span>
            </label>

            <div className="aa-modal-actions">
              <button className="aa-btn-cancelar" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="aa-btn-salvar" onClick={salvar}>{editing ? "Salvar" : "Criar autor"}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .aa-root { padding: 24px 32px; max-width: 1200px; font-family: 'Geist', sans-serif; }
        .aa-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .aa-header h1 { font-size: 24px; font-weight: 900; margin: 0; color: #2C1219; }
        .aa-sub { color: #6B7280; font-size: 13px; margin: 0 0 24px; }
        .aa-btn-novo { display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #E85A8C; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }
        .aa-btn-novo:hover { background: #C33A6E; }
        .aa-msg { padding: 12px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
        .aa-msg--ok { background: #DCFCE7; color: #15803D; }
        .aa-msg--err { background: #FEE2E2; color: #B91C1C; }
        .aa-loading, .aa-empty { text-align: center; padding: 60px 20px; color: #6B7280; }
        .aa-empty p { margin: 12px 0 16px; }
        .aa-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .aa-card { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px; background: #fff; border: 1px solid #F0EBED; border-radius: 12px; }
        .aa-card--off { opacity: 0.5; }
        .aa-card-foto { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, #FCE0E9, #E85A8C); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .aa-card-foto img { width: 100%; height: 100%; object-fit: cover; }
        .aa-card-inicial { font-size: 28px; font-weight: 900; color: #fff; }
        .aa-card-info { flex: 1; }
        .aa-card-nome { font-size: 15px; font-weight: 800; color: #2C1219; margin: 0 0 2px; }
        .aa-card-cargo { font-size: 12px; color: #E85A8C; font-weight: 600; margin: 0 0 8px; }
        .aa-card-bio { font-size: 12px; color: #6B7280; line-height: 1.4; margin: 0; }
        .aa-card-actions { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #F5F0F2; width: 100%; justify-content: center; }
        .aa-toggle { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6B7280; cursor: pointer; }
        .aa-toggle input { cursor: pointer; }
        .aa-btn-icon { padding: 6px 8px; background: #F5F0F2; border: none; border-radius: 6px; cursor: pointer; color: #4B5563; display: flex; align-items: center; }
        .aa-btn-icon:hover { background: #E5DDE0; }
        .aa-btn-icon--del { color: #DC2626; }
        .aa-btn-icon--del:hover { background: #FEE2E2; }

        /* Modal */
        .aa-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
        .aa-modal { background: #fff; border-radius: 16px; padding: 24px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; }
        .aa-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .aa-modal-header h2 { font-size: 20px; font-weight: 900; margin: 0; color: #2C1219; }
        .aa-modal-header button { background: none; border: none; font-size: 22px; color: #6B7280; cursor: pointer; }
        .aa-field { margin-bottom: 16px; }
        .aa-field label { display: block; font-size: 12px; font-weight: 700; color: #4B5563; margin-bottom: 6px; }
        .aa-field input[type="text"], .aa-field input[type="number"], .aa-field textarea { width: 100%; padding: 10px 12px; border: 1px solid #E5DDE0; border-radius: 8px; font-size: 13px; font-family: inherit; }
        .aa-field textarea { resize: vertical; }
        .aa-foto-upload { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #FAFAFA; border: 2px dashed #E5DDE0; border-radius: 10px; color: #6B7280; cursor: pointer; font-size: 12px; font-weight: 600; }
        .aa-foto-upload:hover { background: #F5F0F2; border-color: #E85A8C; color: #C33A6E; }
        .aa-hint { color: #9CA3AF; font-weight: 400; font-size: 11px; }
        .aa-foto-preview { position: relative; display: inline-block; }
        .aa-foto-preview img { width: 100px; height: 100px; object-fit: cover; border-radius: 50%; display: block; border: 1px solid #F0EBED; }
        .aa-foto-remove { position: absolute; top: -6px; right: -6px; padding: 4px 8px; background: #DC2626; color: #fff; border: none; border-radius: 12px; font-size: 10px; font-weight: 700; cursor: pointer; }
        .aa-check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #4B5563; cursor: pointer; margin-bottom: 20px; }
        .aa-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
        .aa-btn-cancelar { padding: 10px 16px; background: #F5F0F2; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; }
        .aa-btn-salvar { padding: 10px 20px; background: #E85A8C; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 13px; }
        .aa-btn-salvar:hover { background: #C33A6E; }
      `}</style>
    </div>
  );
}
