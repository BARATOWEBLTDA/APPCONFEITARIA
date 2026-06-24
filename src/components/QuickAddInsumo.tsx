import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type InsumoQuick = {
  id: string;
  nome: string;
  marca?: string;
  categoria?: string;
  unidade: string;
  custo_unitario: number;
  imagem_url?: string;
  valor_compra?: number;
  qtd_embalagem?: number;
};

interface Props {
  userId: string;
  initialName?: string;
  /** Quando passado, o componente entra em modo EDIÇÃO (UPDATE em vez de INSERT). */
  editing?: InsumoQuick;
  onSaved: (insumo: InsumoQuick) => void;
  onCancel: () => void;
}

type Form = {
  nome: string;
  marca: string;
  categoria: string;
  unidade: string;
  valor_compra: string;
  qtd_embalagem: string;
  imagem_url: string;
};

const CATEGORIAS_DEFAULT = ["Ingredientes", "Embalagens", "Decorações", "Bebidas", "Limpeza", "Descartáveis", "Outros"];
const UNIDADES = [
  { sigla: "g", nome: "Grama" },
  { sigla: "kg", nome: "Quilo" },
  { sigla: "ml", nome: "Mililitro" },
  { sigla: "L", nome: "Litro" },
  { sigla: "un", nome: "Unidade" },
  { sigla: "dz", nome: "Dúzia" },
];

/**
 * Cadastro rápido e edição de insumo.
 * Reutilizado em /insumos e na ficha técnica.
 */
export default function QuickAddInsumo({ userId, initialName, editing, onSaved, onCancel }: Props) {
  const isEditing = !!editing;

  const [form, setForm] = useState<Form>(() => {
    if (editing) {
      return {
        nome: editing.nome || "",
        marca: editing.marca || "",
        categoria: editing.categoria || "Ingredientes",
        unidade: editing.unidade || "g",
        valor_compra: editing.valor_compra ? String(editing.valor_compra).replace(".", ",") : "",
        qtd_embalagem: editing.qtd_embalagem ? String(editing.qtd_embalagem).replace(".", ",") : "1",
        imagem_url: editing.imagem_url || "",
      };
    }
    return {
      nome: initialName || "",
      marca: "",
      categoria: "Ingredientes",
      unidade: "g",
      valor_compra: "",
      qtd_embalagem: "1",
      imagem_url: "",
    };
  });

  const [imagens, setImagens] = useState<string[]>([]);
  const [buscandoImg, setBuscandoImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_DEFAULT);

  // Carrega categorias customizadas do usuário
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.from("insumo_categorias").select("nome").or(`is_default.eq.true,user_id.eq.${userId}`).order("nome");
      if (!cancel && data && data.length > 0) {
        setCategorias([...new Set([...CATEGORIAS_DEFAULT, ...data.map((c: any) => c.nome)])]);
      }
    })();
    return () => { cancel = true; };
  }, [userId]);

  // Auto-busca de imagem com debounce (800ms) quando nome tem 3+ chars
  useEffect(() => {
    const termo = `${form.nome} ${form.marca}`.trim();
    if (form.nome.trim().length < 3) { setImagens([]); return; }
    // Em modo edição, só busca se o usuário mudou o nome
    if (isEditing && form.imagem_url && editing?.nome === form.nome) return;
    const t = setTimeout(async () => {
      setBuscandoImg(true);
      try {
        const res = await fetch(`/api/buscar-imagem?q=${encodeURIComponent(termo)}`);
        const data = await res.json();
        if (data.images) setImagens(data.images.slice(0, 6));
      } catch (e) { console.error(e); }
      setBuscandoImg(false);
    }, 800);
    return () => clearTimeout(t);
  }, [form.nome, form.marca, isEditing, editing?.nome, form.imagem_url]);

  const handleSalvar = async () => {
    if (!userId || !form.nome.trim()) { alert("Informe o nome do insumo"); return; }
    const valor = parseFloat(form.valor_compra.replace(",", ".")) || 0;
    const qtdEmb = parseFloat(form.qtd_embalagem.replace(",", ".")) || 1;
    if (valor <= 0) { alert("Informe quanto pagou"); return; }
    if (qtdEmb <= 0) { alert("Informe quanto veio na embalagem"); return; }
    const custoUnit = valor / qtdEmb;

    setSaving(true);
    const payload: any = {
      nome: form.nome.trim(),
      marca: form.marca.trim(),
      categoria: form.categoria,
      unidade: form.unidade,
      valor_compra: valor,
      qtd_embalagem: qtdEmb,
      custo_unitario: custoUnit,
      imagem_url: form.imagem_url || "",
      updated_at: new Date().toISOString(),
    };

    let data: any, error: any;
    if (isEditing && editing) {
      ({ data, error } = await supabase.from("insumos").update(payload).eq("id", editing.id).select().single());
    } else {
      payload.user_id = userId;
      payload.quantidade_estoque = 0;
      payload.estoque_minimo = 0;
      ({ data, error } = await supabase.from("insumos").insert(payload).select().single());
    }
    setSaving(false);

    if (error || !data) { alert("Erro ao salvar insumo"); console.error(error); return; }
    onSaved({
      id: data.id,
      nome: data.nome,
      marca: data.marca,
      categoria: data.categoria,
      unidade: data.unidade,
      custo_unitario: data.custo_unitario,
      imagem_url: data.imagem_url,
      valor_compra: data.valor_compra,
      qtd_embalagem: data.qtd_embalagem,
    });
  };

  const previewCusto = (() => {
    const v = parseFloat(form.valor_compra.replace(",", ".")) || 0;
    const q = parseFloat(form.qtd_embalagem.replace(",", ".")) || 1;
    return v > 0 ? v / q : 0;
  })();

  return (
    <div className="qai-root">
      <div className="qai-head">
        <span>{isEditing ? "✏️ Editar insumo" : "⚡ Cadastrar insumo"}</span>
        <button type="button" className="qai-cancel" onClick={onCancel}>Cancelar</button>
      </div>

      <div className="qai-field">
        <label>Nome do insumo *</label>
        <input
          type="text"
          className="qai-input"
          placeholder="ex: Leite condensado"
          value={form.nome}
          onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
        />
      </div>

      <div className="qai-row-2">
        <div className="qai-field">
          <label>Marca</label>
          <input
            type="text"
            className="qai-input"
            placeholder="ex: Moça"
            value={form.marca}
            onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
          />
        </div>
        <div className="qai-field">
          <label>Categoria *</label>
          <select
            className="qai-input"
            value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
          >
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="qai-imgs">
        <div className="qai-imgs-label">
          {form.nome.trim().length < 3
            ? "Imagem (digite o nome para buscar automaticamente)"
            : buscandoImg
            ? "🔄 Buscando imagens..."
            : imagens.length > 0
            ? "Escolha uma imagem (opcional):"
            : form.imagem_url
            ? "Imagem atual:"
            : "Nenhuma imagem encontrada — pode salvar sem imagem"}
        </div>
        {form.imagem_url && imagens.length === 0 && (
          <div className="qai-imgs-grid">
            <div className="qai-img qai-img--selected"><img src={form.imagem_url} alt="" /></div>
          </div>
        )}
        {imagens.length > 0 && (
          <div className="qai-imgs-grid">
            {imagens.map((url, idx) => (
              <button
                key={idx}
                type="button"
                className={`qai-img ${form.imagem_url === url ? "qai-img--selected" : ""}`}
                onClick={() => setForm(f => ({ ...f, imagem_url: f.imagem_url === url ? "" : url }))}
              >
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        )}
        {form.nome.trim().length < 3 && !form.imagem_url && (
          <div className="qai-imgs-grid">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="qai-img qai-img--placeholder" />
            ))}
          </div>
        )}
      </div>

      <div className="qai-row-3">
        <div className="qai-field">
          <label>Quanto pagou *</label>
          <input
            type="text"
            inputMode="decimal"
            className="qai-input"
            placeholder="R$ 0,00"
            value={form.valor_compra}
            onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))}
          />
        </div>
        <div className="qai-field">
          <label>Quanto veio *</label>
          <input
            type="text"
            inputMode="decimal"
            className="qai-input"
            placeholder="1"
            value={form.qtd_embalagem}
            onChange={e => setForm(f => ({ ...f, qtd_embalagem: e.target.value }))}
          />
        </div>
        <div className="qai-field">
          <label>Unidade *</label>
          <select
            className="qai-input"
            value={form.unidade}
            onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
          >
            {UNIDADES.map(u => <option key={u.sigla} value={u.sigla}>{u.sigla}</option>)}
          </select>
        </div>
      </div>

      {previewCusto > 0 && (
        <div className="qai-preview">
          Custo unitário: <strong>R$ {previewCusto.toFixed(4)} / {form.unidade}</strong>
        </div>
      )}

      <button type="button" className="qai-save" onClick={handleSalvar} disabled={saving}>
        {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar insumo"}
      </button>

      <style>{`
        .qai-root {
          background:#fff;
          border-radius:14px;
          display:flex; flex-direction:column; gap:0.7rem;
        }
        .qai-head {
          display:flex; justify-content:space-between; align-items:center;
          font-size:0.85rem; font-weight:700; color:var(--primary, #FF6FA9);
          padding-bottom:0.25rem;
          border-bottom:1px solid var(--border, #E5E7EB);
        }
        .qai-cancel {
          background:transparent; border:none; cursor:pointer;
          font-size:0.76rem; color:var(--text-muted, #9CA3AF); font-weight:600;
        }
        .qai-cancel:hover { color:var(--text-secondary, #6B7280); }

        .qai-field { display:flex; flex-direction:column; gap:4px; }
        .qai-field label {
          font-size:0.7rem; font-weight:700;
          color:var(--text-secondary, #6B7280);
          letter-spacing:0.2px;
        }
        .qai-input {
          width:100%; padding:0.6rem 0.75rem;
          border:1.5px solid var(--border, #E5E7EB);
          border-radius:10px; font-size:0.88rem; outline:none;
          background:#fff;
          font-family:inherit;
          box-sizing:border-box;
        }
        .qai-input:focus { border-color:var(--primary, #FF6FA9); }
        select.qai-input { cursor:pointer; }

        .qai-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:0.55rem; }
        .qai-row-3 { display:grid; grid-template-columns:1.1fr 1fr 0.7fr; gap:0.5rem; }

        .qai-imgs { display:flex; flex-direction:column; gap:0.4rem; }
        .qai-imgs-label {
          font-size:0.72rem; font-weight:600;
          color:var(--text-secondary, #6B7280);
        }
        .qai-imgs-grid { display:grid; grid-template-columns:repeat(6, 1fr); gap:0.4rem; }
        .qai-img {
          aspect-ratio:1; border:2px solid var(--border, #E5E7EB);
          border-radius:8px; padding:0; overflow:hidden;
          background:#fff; cursor:pointer; transition:all 0.15s ease;
        }
        .qai-img img { width:100%; height:100%; object-fit:cover; display:block; }
        .qai-img:hover { border-color:var(--primary, #FF6FA9); }
        .qai-img--selected {
          border-color:var(--primary, #FF6FA9);
          box-shadow:0 0 0 2px rgba(255, 111, 169, 0.2);
        }
        .qai-img--placeholder {
          border-style:dashed;
          background:var(--bg-body, #F7F7F8);
          cursor:default;
        }
        .qai-img--placeholder:hover { border-color:var(--border, #E5E7EB); }

        .qai-preview {
          padding:0.55rem 0.8rem; background:#FFF5F9;
          border-radius:9px; font-size:0.8rem;
          color:var(--text-secondary, #6B7280);
        }
        .qai-preview strong { color:var(--primary, #FF6FA9); font-weight:800; }

        .qai-save {
          padding:0.8rem; background:var(--primary, #FF6FA9);
          color:#fff; border:none; border-radius:10px;
          font-size:0.9rem; font-weight:700; cursor:pointer;
          transition:opacity 0.15s ease;
          font-family:inherit;
        }
        .qai-save:hover:not(:disabled) { opacity:0.9; }
        .qai-save:disabled { opacity:0.6; cursor:not-allowed; }

        @media (max-width:480px) {
          .qai-row-3 { grid-template-columns:1fr 1fr; }
          .qai-row-3 .qai-field:last-child { grid-column:1 / -1; }
        }
      `}</style>
    </div>
  );
}
