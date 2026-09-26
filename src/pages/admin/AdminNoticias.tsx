import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, PencilSimple, Trash, ArrowUp, ArrowDown, Eye, EyeSlash, X } from "@phosphor-icons/react";

interface Noticia {
  id: string;
  emoji: string;
  titulo: string;
  descricao: string;
  categoria: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const EMOJIS_SUGERIDOS = ["📢", "👋", "💡", "🤖", "🎨", "✨", "🎂", "🍰", "⭐", "🚀", "🔥", "🎁", "📱", "🎉"];
const CATEGORIAS = ["Dica", "Novidade", "Boas-vindas", "Aviso", "Tutorial"];

export default function AdminNoticias() {
  const [rows, setRows] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Noticia | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [form, setForm] = useState({ emoji: "📢", titulo: "", descricao: "", categoria: "", ativo: true });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_noticias")
      .select("*")
      .order("ordem", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      setMsg({ text: "Erro ao carregar: " + error.message, kind: "err" });
    } else {
      setRows(data as Noticia[]);
    }
    setLoading(false);
  };

  const showMsg = (text: string, kind: "ok" | "err") => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 3500);
  };

  const abrirNovo = () => {
    setEditing(null);
    setForm({ emoji: "📢", titulo: "", descricao: "", categoria: "", ativo: true });
    setModalOpen(true);
  };

  const abrirEditar = (n: Noticia) => {
    setEditing(n);
    setForm({
      emoji: n.emoji,
      titulo: n.titulo,
      descricao: n.descricao,
      categoria: n.categoria || "",
      ativo: n.ativo,
    });
    setModalOpen(true);
  };

  const salvar = async () => {
    if (!form.titulo.trim() || !form.descricao.trim()) {
      alert("Preencha título e descrição");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("admin_noticias").update({
          emoji: form.emoji,
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim(),
          categoria: form.categoria.trim() || null,
          ativo: form.ativo,
        }).eq("id", editing.id);
        if (error) throw error;
        showMsg("Notícia atualizada!", "ok");
      } else {
        const maxOrdem = rows.length > 0 ? Math.max(...rows.map(r => r.ordem)) : 0;
        const { error } = await supabase.from("admin_noticias").insert({
          emoji: form.emoji,
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim(),
          categoria: form.categoria.trim() || null,
          ativo: form.ativo,
          ordem: maxOrdem + 10,
        });
        if (error) throw error;
        showMsg("Notícia criada!", "ok");
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      showMsg("Erro: " + err.message, "err");
    }
    setSaving(false);
  };

  const excluir = async (n: Noticia) => {
    if (!confirm(`Excluir "${n.titulo}"?`)) return;
    const { error } = await supabase.from("admin_noticias").delete().eq("id", n.id);
    if (error) {
      showMsg("Erro ao excluir: " + error.message, "err");
    } else {
      showMsg("Excluída!", "ok");
      await load();
    }
  };

  const toggleAtivo = async (n: Noticia) => {
    const { error } = await supabase.from("admin_noticias").update({ ativo: !n.ativo }).eq("id", n.id);
    if (error) {
      showMsg("Erro: " + error.message, "err");
    } else {
      await load();
    }
  };

  const mover = async (n: Noticia, direcao: "up" | "down") => {
    const idx = rows.findIndex(r => r.id === n.id);
    if (idx === -1) return;
    const outroIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (outroIdx < 0 || outroIdx >= rows.length) return;
    const outro = rows[outroIdx];
    // Troca as ordens
    const { error: e1 } = await supabase.from("admin_noticias").update({ ordem: outro.ordem }).eq("id", n.id);
    const { error: e2 } = await supabase.from("admin_noticias").update({ ordem: n.ordem }).eq("id", outro.id);
    if (e1 || e2) {
      showMsg("Erro ao reordenar", "err");
    } else {
      await load();
    }
  };

  if (loading) return <div className="an-loading">Carregando...</div>;

  return (
    <div className="an-root">
      <div className="an-header">
        <div>
          <h1 className="an-title">Notícias da Home</h1>
          <p className="an-sub">Aparecem no card "Notícias" da tela Início pra todos os usuários</p>
        </div>
        <button className="an-btn-new" onClick={abrirNovo}>
          <Plus size={16} weight="bold" /> Nova notícia
        </button>
      </div>

      {msg && (
        <div className={`an-msg an-msg--${msg.kind}`}>{msg.text}</div>
      )}

      {rows.length === 0 ? (
        <div className="an-empty">
          <p>Nenhuma notícia ainda.</p>
          <button className="an-btn-new" onClick={abrirNovo}>
            <Plus size={16} weight="bold" /> Criar primeira notícia
          </button>
        </div>
      ) : (
        <div className="an-list">
          {rows.map((n, idx) => (
            <div key={n.id} className={`an-card ${!n.ativo ? "an-card--off" : ""}`}>
              <div className="an-card-emoji">{n.emoji}</div>
              <div className="an-card-body">
                <div className="an-card-tags">
                  {n.categoria && <span className="an-tag">{n.categoria}</span>}
                  {!n.ativo && <span className="an-tag an-tag--off">Desativada</span>}
                  <span className="an-ordem">ordem: {n.ordem}</span>
                </div>
                <p className="an-card-t">{n.titulo}</p>
                <p className="an-card-d">{n.descricao}</p>
              </div>
              <div className="an-card-actions">
                <button className="an-icbtn" onClick={() => mover(n, "up")} disabled={idx === 0} title="Subir">
                  <ArrowUp size={14} weight="bold" />
                </button>
                <button className="an-icbtn" onClick={() => mover(n, "down")} disabled={idx === rows.length - 1} title="Descer">
                  <ArrowDown size={14} weight="bold" />
                </button>
                <button className="an-icbtn" onClick={() => toggleAtivo(n)} title={n.ativo ? "Desativar" : "Ativar"}>
                  {n.ativo ? <Eye size={14} weight="bold" /> : <EyeSlash size={14} weight="bold" />}
                </button>
                <button className="an-icbtn" onClick={() => abrirEditar(n)} title="Editar">
                  <PencilSimple size={14} weight="bold" />
                </button>
                <button className="an-icbtn an-icbtn--danger" onClick={() => excluir(n)} title="Excluir">
                  <Trash size={14} weight="bold" />
                </button>
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
                  <div className="an-emoji-chips">
                    {EMOJIS_SUGERIDOS.map(e => (
                      <button key={e} className="an-emoji-chip" onClick={() => setForm(f => ({ ...f, emoji: e }))}>{e}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="an-field">
                <label>Título</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Bem-vindo(a) ao Doonly!"
                  maxLength={80}
                />
                <span className="an-hint">{form.titulo.length}/80</span>
              </div>

              <div className="an-field">
                <label>Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Configure seu cardápio digital em 5 passos rápidos..."
                  rows={3}
                  maxLength={200}
                />
                <span className="an-hint">{form.descricao.length}/200</span>
              </div>

              <div className="an-field">
                <label>Categoria (opcional)</label>
                <div className="an-cat-chips">
                  <button
                    className={`an-cat-chip ${!form.categoria ? "on" : ""}`}
                    onClick={() => setForm(f => ({ ...f, categoria: "" }))}
                  >Nenhuma</button>
                  {CATEGORIAS.map(c => (
                    <button
                      key={c}
                      className={`an-cat-chip ${form.categoria === c ? "on" : ""}`}
                      onClick={() => setForm(f => ({ ...f, categoria: c }))}
                    >{c}</button>
                  ))}
                </div>
              </div>

              <div className="an-field">
                <label className="an-toggle-lbl">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                  />
                  <span>Ativa (aparece pra usuários)</span>
                </label>
              </div>

              {/* Preview */}
              <div className="an-preview">
                <p className="an-preview-lbl">Preview</p>
                <div className="an-preview-card">
                  <span className="an-preview-emoji">{form.emoji}</span>
                  <div className="an-preview-body">
                    <p className="an-preview-t">{form.titulo || "Título aqui"}</p>
                    <p className="an-preview-d">{form.descricao || "Descrição aqui"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="an-modal-foot">
              <button className="an-btn-cancel" onClick={() => !saving && setModalOpen(false)}>Cancelar</button>
              <button className="an-btn-save" onClick={salvar} disabled={saving}>
                {saving ? "Salvando..." : (editing ? "Salvar" : "Criar")}
              </button>
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
        .an-btn-new {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 16px;
          background: linear-gradient(135deg, #E85A8C, #C33A6E);
          color: #fff;
          border: none; border-radius: 8px;
          font-size: 13px; font-weight: 700;
          cursor: pointer;
          box-shadow: 0 3px 0 #7A1B47;
          font-family: inherit;
        }
        .an-btn-new:hover { filter: brightness(1.05); }
        .an-msg {
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .an-msg--ok { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }
        .an-msg--err { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }

        .an-empty { text-align: center; padding: 60px 20px; color: #6B7280; }
        .an-empty p { margin: 0 0 16px; }

        .an-list { display: flex; flex-direction: column; gap: 10px; }
        .an-card {
          display: flex; gap: 14px;
          padding: 14px 16px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 10px;
        }
        .an-card--off { opacity: 0.55; }
        .an-card-emoji { font-size: 32px; flex-shrink: 0; }
        .an-card-body { flex: 1; min-width: 0; }
        .an-card-tags { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; flex-wrap: wrap; }
        .an-tag {
          font-size: 9.5px; font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          background: #FCE7F3; color: #C33A6E;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .an-tag--off { background: #F5F0F2; color: #6B7280; }
        .an-ordem { font-size: 10px; color: #9CA3AF; margin-left: auto; }
        .an-card-t { font-size: 14px; font-weight: 800; margin: 0 0 3px; color: #2C1219; }
        .an-card-d { font-size: 12.5px; color: #6B7280; margin: 0; line-height: 1.4; }
        .an-card-actions { display: flex; gap: 4px; flex-shrink: 0; align-items: flex-start; }
        .an-icbtn {
          width: 30px; height: 30px;
          background: #F5F0F2;
          border: none; border-radius: 6px;
          color: #6B7280;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .an-icbtn:hover:not(:disabled) { background: #E5DDE0; color: #2C1219; }
        .an-icbtn:disabled { opacity: 0.3; cursor: not-allowed; }
        .an-icbtn--danger:hover { background: #FEF2F2; color: #B91C1C; }

        /* Modal */
        .an-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(44,18,25,0.5);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          z-index: 100;
        }
        .an-modal {
          background: #fff;
          border-radius: 14px;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow: hidden;
          display: flex; flex-direction: column;
        }
        .an-modal-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #F0EBED;
        }
        .an-modal-head h2 { margin: 0; font-size: 17px; font-weight: 800; color: #2C1219; }
        .an-modal-body { padding: 20px; overflow-y: auto; flex: 1; }
        .an-modal-foot {
          padding: 14px 20px;
          border-top: 1px solid #F0EBED;
          display: flex; gap: 8px; justify-content: flex-end;
        }
        .an-btn-cancel {
          padding: 10px 16px;
          background: transparent;
          color: #6B7280;
          border: 1px solid #F0EBED;
          border-radius: 8px;
          font-size: 13px; font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .an-btn-save {
          padding: 10px 20px;
          background: linear-gradient(135deg, #E85A8C, #C33A6E);
          color: #fff;
          border: none; border-radius: 8px;
          font-size: 13px; font-weight: 800;
          cursor: pointer;
          box-shadow: 0 3px 0 #7A1B47;
          font-family: inherit;
        }
        .an-btn-save:disabled { opacity: 0.5; cursor: wait; }

        .an-field { margin-bottom: 16px; }
        .an-field label { display: block; font-size: 12px; font-weight: 700; color: #2C1219; margin-bottom: 6px; }
        .an-field input[type="text"], .an-field textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1.5px solid #F0EBED;
          border-radius: 8px;
          font-size: 13.5px;
          font-family: inherit;
          resize: vertical;
        }
        .an-field input:focus, .an-field textarea:focus { outline: none; border-color: #E85A8C; }
        .an-hint { display: block; font-size: 10.5px; color: #9CA3AF; margin-top: 3px; text-align: right; }

        .an-emoji-row { display: flex; gap: 8px; align-items: center; }
        .an-emoji-input {
          width: 60px !important;
          text-align: center;
          font-size: 20px !important;
        }
        .an-emoji-chips { display: flex; gap: 4px; flex-wrap: wrap; }
        .an-emoji-chip {
          width: 32px; height: 32px;
          background: #F5F0F2;
          border: none; border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
        }
        .an-emoji-chip:hover { background: #E5DDE0; }

        .an-cat-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .an-cat-chip {
          padding: 6px 12px;
          background: #F5F0F2;
          border: 1.5px solid transparent;
          border-radius: 6px;
          font-size: 12px; font-weight: 700;
          color: #6B7280;
          cursor: pointer;
          font-family: inherit;
        }
        .an-cat-chip.on {
          background: #FCE7F3;
          color: #C33A6E;
          border-color: #E85A8C;
        }

        .an-toggle-lbl { display: flex !important; align-items: center; gap: 8px; cursor: pointer; }
        .an-toggle-lbl input { width: 18px; height: 18px; margin: 0; }

        .an-preview {
          padding-top: 12px;
          border-top: 1px dashed #E5E7EB;
        }
        .an-preview-lbl {
          font-size: 10px; font-weight: 800; color: #6B7280;
          letter-spacing: 0.08em; text-transform: uppercase;
          margin: 0 0 8px;
        }
        .an-preview-card {
          display: flex; gap: 12px;
          padding: 12px 14px;
          background: #FFF5F9;
          border: 1px solid #FBE0EB;
          border-radius: 10px;
        }
        .an-preview-emoji { font-size: 28px; flex-shrink: 0; }
        .an-preview-body { flex: 1; min-width: 0; }
        .an-preview-t { font-size: 13.5px; font-weight: 800; margin: 0 0 3px; color: #2C1219; }
        .an-preview-d { font-size: 12px; color: #6B7280; margin: 0; line-height: 1.4; }
      `}</style>
    </div>
  );
}
