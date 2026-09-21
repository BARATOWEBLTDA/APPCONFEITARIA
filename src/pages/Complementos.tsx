import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { Package, Plus, PencilSimple, Trash, MagnifyingGlass, X } from "@phosphor-icons/react";

type Complemento = {
  id: string;
  nome: string;
  valor: number;
  categorias: string[];
};

const CATEGORIAS_PRODUTO = ["Bolos", "Doces", "Salgados", "Bebidas", "Sobremesas", "Outros"];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePreco(s: string): number {
  const digits = s.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export default function Complementos() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [items, setItems] = useState<Complemento[]>([]);
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Complemento | null>(null);
  const [form, setForm] = useState<{ nome: string; valor: number; categorias: string[] }>({ nome: "", valor: 0, categorias: [] });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Complemento | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { setLoading(false); return; }
      setUserId(uid);
      const { data } = await supabase.from("biblioteca_extras").select("*").eq("user_id", uid).order("nome");
      if (data) setItems(data as Complemento[]);
      setLoading(false);
    })();
  }, []);

  const abrirNovo = () => {
    setEditing(null);
    setForm({ nome: "", valor: 0, categorias: [] });
    setModalOpen(true);
  };
  const abrirEditar = (c: Complemento) => {
    setEditing(c);
    setForm({ nome: c.nome, valor: c.valor, categorias: c.categorias || [] });
    setModalOpen(true);
  };
  const fechar = () => { setModalOpen(false); setEditing(null); };

  const salvar = async () => {
    const nomeLimpo = form.nome.trim();
    if (!nomeLimpo) return alert("Digite o nome do complemento");
    if (form.valor <= 0) return alert("Digite um valor válido");
    setSaving(true);
    try {
      if (editing) {
        const { data, error } = await supabase.from("biblioteca_extras")
          .update({ nome: nomeLimpo, valor: form.valor, categorias: form.categorias })
          .eq("id", editing.id).eq("user_id", userId).select().single();
        if (error) throw error;
        if (data) setItems(prev => prev.map(i => i.id === editing.id ? (data as Complemento) : i).sort((a, b) => a.nome.localeCompare(b.nome)));
      } else {
        const { data, error } = await supabase.from("biblioteca_extras")
          .insert({ user_id: userId, nome: nomeLimpo, valor: form.valor, categorias: form.categorias })
          .select().single();
        if (error) throw error;
        if (data) setItems(prev => [...prev, data as Complemento].sort((a, b) => a.nome.localeCompare(b.nome)));
      }
      fechar();
    } catch (err: any) {
      alert("Erro ao salvar: " + (err.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const excluir = async () => {
    if (!confirmDel) return;
    const id = confirmDel.id;
    setConfirmDel(null);
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from("biblioteca_extras").delete().eq("id", id).eq("user_id", userId);
  };

  const toggleCategoria = (cat: string) => {
    setForm(f => ({ ...f, categorias: f.categorias.includes(cat) ? f.categorias.filter(c => c !== cat) : [...f.categorias, cat] }));
  };

  const itemsFiltrados = items.filter(i => !busca.trim() || i.nome.toLowerCase().includes(busca.toLowerCase()));

  if (loading) {
    return (
      <div className="cpl-root">
        <AppPageHeader title="Complementos" subtitle="Extras que você pode adicionar aos produtos" infoContent={null} />
        <div className="cpl-loading"><div className="cpl-spinner" /></div>
        <style>{stylesLoading}</style>
      </div>
    );
  }

  return (
    <div className="cpl-root">
      <AppPageHeader
        title="Complementos"
        subtitle="Extras que você pode adicionar aos produtos"
        infoContent={
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#4B5563" }}>
            <p style={{ margin: "0 0 8px" }}>Complementos são <b>extras opcionais</b> que o cliente pode escolher ao pedir seu produto — como tag com nome, brigadeiro extra, enfeite personalizado.</p>
            <p style={{ margin: 0 }}>Cadastre <b>uma vez</b> aqui e depois adicione em vários produtos. Se o preço mudar, você atualiza aqui e reflete em todos.</p>
          </div>
        }
      />

      <div className="cpl-content">
        <div className="cpl-topbar">
          <div className="cpl-search">
            <MagnifyingGlass size={16} weight="bold" />
            <input
              type="text"
              placeholder="Buscar complemento..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            {busca && <button className="cpl-search-clear" onClick={() => setBusca("")}><X size={12} weight="bold" /></button>}
          </div>
          <button className="cpl-btn-novo" onClick={abrirNovo}>
            <Plus size={16} weight="bold" /> Novo complemento
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cpl-empty">
            <div className="cpl-empty-ico"><Package size={40} weight="duotone" /></div>
            <p className="cpl-empty-title">Nenhum complemento cadastrado</p>
            <p className="cpl-empty-sub">Cadastre uma vez e reutilize em vários produtos.<br/>Ex: brigadeiro extra, tag de nome, enfeite...</p>
            <button className="cpl-btn-novo cpl-btn-novo--empty" onClick={abrirNovo}>
              <Plus size={16} weight="bold" /> Criar primeiro complemento
            </button>
          </div>
        ) : itemsFiltrados.length === 0 ? (
          <p className="cpl-noresult">Nenhum resultado pra "{busca}"</p>
        ) : (
          <div className="cpl-list">
            {itemsFiltrados.map(item => (
              <div key={item.id} className="cpl-card">
                <div className="cpl-card-main" onClick={() => abrirEditar(item)}>
                  <div className="cpl-card-info">
                    <p className="cpl-card-nome">{item.nome}</p>
                    {(item.categorias || []).length > 0 && (
                      <div className="cpl-card-cats">
                        {item.categorias.map(cat => (
                          <span key={cat} className="cpl-card-cat">{cat}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="cpl-card-valor">R$ {formatBRL(item.valor)}</div>
                </div>
                <div className="cpl-card-actions">
                  <button className="cpl-card-btn" onClick={() => abrirEditar(item)} aria-label="Editar">
                    <PencilSimple size={16} weight="bold" />
                  </button>
                  <button className="cpl-card-btn cpl-card-btn--del" onClick={() => setConfirmDel(item)} aria-label="Excluir">
                    <Trash size={16} weight="bold" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {modalOpen && (
        <div className="cpl-modal-ov" onClick={fechar}>
          <div className="cpl-modal" onClick={e => e.stopPropagation()}>
            <div className="cpl-modal-handle" />
            <div className="cpl-modal-head">
              <h3 className="cpl-modal-title">{editing ? "Editar complemento" : "Novo complemento"}</h3>
              <button className="cpl-modal-close" onClick={fechar}><X size={16} weight="bold" /></button>
            </div>
            <div className="cpl-modal-body">
              <div className="cpl-field">
                <label>Nome do complemento *</label>
                <input
                  type="text"
                  placeholder="Ex: Brigadeiro extra, Tag de nome..."
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  autoFocus={!editing}
                />
              </div>
              <div className="cpl-field">
                <label>Valor *</label>
                <div className="cpl-field-input-wrap">
                  <span className="cpl-field-prefix">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={formatBRL(form.valor)}
                    onChange={e => setForm(f => ({ ...f, valor: parsePreco(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="cpl-field">
                <label>Aparece em quais categorias? <span className="cpl-field-hint">(opcional — deixe vazio pra aparecer em todas)</span></label>
                <div className="cpl-cats-grid">
                  {CATEGORIAS_PRODUTO.map(cat => (
                    <label key={cat} className={`cpl-cat-chip ${form.categorias.includes(cat) ? "cpl-cat-chip--on" : ""}`}>
                      <input type="checkbox" checked={form.categorias.includes(cat)} onChange={() => toggleCategoria(cat)} />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="cpl-modal-foot">
              <button className="cpl-modal-btn cpl-modal-btn--sec" onClick={fechar}>Cancelar</button>
              <button className="cpl-modal-btn cpl-modal-btn--pri" onClick={salvar} disabled={saving}>
                {saving ? "Salvando..." : (editing ? "Salvar" : "Criar complemento")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDel && (
        <div className="cpl-modal-ov" onClick={() => setConfirmDel(null)}>
          <div className="cpl-modal cpl-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="cpl-modal-handle" />
            <div style={{ padding: "18px 20px 22px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#DC2626" }}>Excluir complemento?</h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B7280", lineHeight: 1.4 }}>
                "<b>{confirmDel.nome}</b>" será removido. Produtos que já usam esse complemento não serão alterados.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="cpl-modal-btn cpl-modal-btn--sec" style={{ flex: 1 }} onClick={() => setConfirmDel(null)}>Cancelar</button>
                <button className="cpl-modal-btn" style={{ flex: 1, background: "#DC2626", color: "#fff" }} onClick={excluir}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

const stylesLoading = `
  .cpl-loading { display: flex; justify-content: center; padding: 60px 20px; }
  .cpl-spinner { width: 30px; height: 30px; border: 3px solid #F0EBED; border-top-color: #E85A8C; border-radius: 50%; animation: cplspin 0.7s linear infinite; }
  @keyframes cplspin { to { transform: rotate(360deg); } }
`;

const styles = `
  ${stylesLoading}
  .cpl-root { min-height: 100vh; background: #F5F3EF; font-family: 'Geist', sans-serif; }
  .cpl-content { max-width: 720px; margin: 0 auto; padding: 20px 16px 100px; }

  .cpl-topbar { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; }
  .cpl-search { flex: 1; position: relative; display: flex; align-items: center; gap: 8px; background: #fff; border: 1.5px solid #F0EBED; border-radius: 10px; padding: 10px 12px; color: #6B7280; }
  .cpl-search input { flex: 1; border: none; outline: none; background: transparent; font-size: 13.5px; color: #1F1F23; font-family: inherit; }
  .cpl-search-clear { background: #F3F4F6; border: none; width: 20px; height: 20px; border-radius: 50%; color: #6B7280; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .cpl-btn-novo { display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; background: #E85A8C; color: #fff; border: none; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; box-shadow: 0 4px 12px rgba(232,90,140,0.35); white-space: nowrap; }
  .cpl-btn-novo:hover { background: #d54a7a; }
  .cpl-btn-novo--empty { margin-top: 16px; }

  .cpl-empty { text-align: center; padding: 60px 20px; background: #fff; border-radius: 14px; border: 1.5px solid #F0EBED; }
  .cpl-empty-ico { color: #E85A8C; display: inline-flex; margin-bottom: 12px; padding: 14px; background: #FCE0E9; border-radius: 50%; }
  .cpl-empty-title { margin: 0 0 6px; font-size: 15px; font-weight: 800; color: #1F1F23; }
  .cpl-empty-sub { margin: 0; font-size: 12.5px; color: #6B7280; line-height: 1.5; }
  .cpl-noresult { text-align: center; color: #9CA3AF; font-size: 13px; padding: 40px 20px; margin: 0; }

  .cpl-list { display: flex; flex-direction: column; gap: 8px; }
  .cpl-card { display: flex; align-items: center; background: #fff; border: 1.5px solid #F0EBED; border-radius: 12px; overflow: hidden; transition: border-color 0.15s; }
  .cpl-card:hover { border-color: #E85A8C; }
  .cpl-card-main { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; cursor: pointer; min-width: 0; }
  .cpl-card-info { flex: 1; min-width: 0; }
  .cpl-card-nome { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #1F1F23; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cpl-card-cats { display: flex; flex-wrap: wrap; gap: 4px; }
  .cpl-card-cat { font-size: 10.5px; padding: 2px 8px; background: #F5F3EF; border-radius: 6px; color: #6B7280; font-weight: 600; }
  .cpl-card-valor { font-size: 14px; font-weight: 800; color: #E85A8C; flex-shrink: 0; }
  .cpl-card-actions { display: flex; gap: 2px; padding: 0 10px; flex-shrink: 0; border-left: 1px solid #F0EBED; }
  .cpl-card-btn { background: transparent; border: none; width: 32px; height: 32px; border-radius: 6px; color: #6B7280; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
  .cpl-card-btn:hover { background: #F5F3EF; color: #E85A8C; }
  .cpl-card-btn--del:hover { color: #DC2626; background: #FEE2E2; }

  .cpl-modal-ov { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; animation: cplfade 0.2s; }
  @keyframes cplfade { from { opacity: 0; } to { opacity: 1; } }
  .cpl-modal { background: #fff; width: 100%; max-width: 520px; max-height: 90vh; border-radius: 20px 20px 0 0; display: flex; flex-direction: column; overflow: hidden; animation: cplup 0.28s cubic-bezier(0.32,0.72,0,1); font-family: inherit; }
  .cpl-modal--sm { max-width: 400px; }
  @media (min-width: 720px) { .cpl-modal-ov { align-items: center; padding: 24px; } .cpl-modal { border-radius: 16px; max-height: 82vh; } }
  @keyframes cplup { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .cpl-modal-handle { width: 40px; height: 4px; background: #D1D5DB; border-radius: 2px; margin: 8px auto 4px; }
  .cpl-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 20px 14px; border-bottom: 1px solid #F3F4F6; }
  .cpl-modal-title { margin: 0; font-size: 16px; font-weight: 800; color: #1F1F23; }
  .cpl-modal-close { background: #F3F4F6; border: none; width: 30px; height: 30px; border-radius: 8px; color: #6B7280; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .cpl-modal-body { padding: 18px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; }
  .cpl-modal-foot { padding: 14px 16px; padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #F3F4F6; display: flex; gap: 8px; }
  .cpl-modal-btn { flex: 1; padding: 12px; border: none; border-radius: 10px; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .cpl-modal-btn--sec { background: #F3F4F6; color: #4B5563; }
  .cpl-modal-btn--sec:hover { background: #E5E7EB; }
  .cpl-modal-btn--pri { background: #E85A8C; color: #fff; box-shadow: 0 4px 12px rgba(232,90,140,0.35); font-weight: 800; flex: 2; }
  .cpl-modal-btn--pri:hover:not(:disabled) { background: #d54a7a; }
  .cpl-modal-btn--pri:disabled { background: #E5E7EB; color: #9CA3AF; box-shadow: none; cursor: not-allowed; }

  .cpl-field { display: flex; flex-direction: column; gap: 6px; }
  .cpl-field > label { font-size: 12px; font-weight: 700; color: #1F1F23; }
  .cpl-field-hint { font-weight: 500; color: #9CA3AF; }
  .cpl-field input[type="text"] { padding: 12px 14px; border: 1.5px solid #E5E7EB; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; transition: border 0.15s; }
  .cpl-field input:focus { border-color: #E85A8C; }
  .cpl-field-input-wrap { position: relative; display: flex; align-items: center; }
  .cpl-field-prefix { position: absolute; left: 14px; font-size: 13px; font-weight: 700; color: #6B7280; pointer-events: none; }
  .cpl-field-input-wrap input { padding-left: 40px; width: 100%; box-sizing: border-box; }

  .cpl-cats-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .cpl-cat-chip { display: inline-flex; align-items: center; padding: 7px 12px; background: #F5F3EF; border: 1.5px solid transparent; border-radius: 999px; font-size: 12px; font-weight: 700; color: #6B7280; cursor: pointer; transition: all 0.15s; user-select: none; }
  .cpl-cat-chip input { display: none; }
  .cpl-cat-chip--on { background: #FCE0E9; border-color: #E85A8C; color: #E85A8C; }
`;
