import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type InsumoQuick = {
  id: string;
  nome: string;
  unidade: string;
  custo_unitario: number;
  imagem_url?: string;
};

interface Props {
  userId: string;
  initialName?: string;
  onSaved: (insumo: InsumoQuick) => void;
  onCancel: () => void;
}

type QuickForm = {
  nome: string;
  unidade: string;
  valor_compra: string;
  qtd_embalagem: string;
  imagem_url: string;
};

const EMPTY: QuickForm = { nome: "", unidade: "g", valor_compra: "", qtd_embalagem: "1", imagem_url: "" };

/**
 * Componente reutilizável para cadastro rápido de insumo.
 * Usado na ficha técnica e (futuramente) em outros pontos do app.
 *
 * Salva direto no Supabase com o mínimo de campos:
 * nome, unidade, valor_compra, qtd_embalagem, imagem_url.
 * Demais campos ficam vazios — a página /insumos pode oferecer
 * enriquecimento posterior via badge "Completar dados".
 */
export default function QuickAddInsumo({ userId, initialName, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<QuickForm>({ ...EMPTY, nome: initialName || "" });
  const [imagens, setImagens] = useState<string[]>([]);
  const [buscandoImg, setBuscandoImg] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-busca de imagem com debounce (800ms) quando nome tem 3+ chars
  useEffect(() => {
    const termo = form.nome.trim();
    if (termo.length < 3) { setImagens([]); return; }
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
  }, [form.nome]);

  const handleSalvar = async () => {
    if (!userId || !form.nome.trim()) { alert("Informe o nome do insumo"); return; }
    const valor = parseFloat(form.valor_compra.replace(",", ".")) || 0;
    const qtdEmb = parseFloat(form.qtd_embalagem.replace(",", ".")) || 1;
    if (valor <= 0) { alert("Informe o valor da compra"); return; }
    const custoUnit = valor / qtdEmb;

    setSaving(true);
    const payload: any = {
      user_id: userId,
      nome: form.nome.trim(),
      categoria: "Ingredientes",
      unidade: form.unidade,
      quantidade_estoque: 0,
      estoque_minimo: 0,
      valor_compra: valor,
      qtd_embalagem: qtdEmb,
      custo_unitario: custoUnit,
      imagem_url: form.imagem_url || "",
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("insumos").insert(payload).select().single();
    setSaving(false);

    if (error || !data) { alert("Erro ao salvar insumo"); return; }
    onSaved({
      id: data.id,
      nome: data.nome,
      unidade: data.unidade,
      custo_unitario: data.custo_unitario,
      imagem_url: data.imagem_url,
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
        <span>⚡ Cadastro rápido de insumo</span>
        <button type="button" className="qai-cancel" onClick={onCancel}>Cancelar</button>
      </div>

      <input
        type="text"
        className="qai-input"
        placeholder="Nome do insumo (ex: Leite condensado Moça)"
        value={form.nome}
        onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
        autoFocus
      />

      {form.nome.trim().length >= 3 && (
        <div className="qai-imgs">
          <div className="qai-imgs-label">
            {buscandoImg ? "🔄 Buscando imagens..." : imagens.length > 0 ? "Escolha uma imagem (opcional):" : "Nenhuma imagem encontrada"}
          </div>
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
        </div>
      )}

      <div className="qai-grid">
        <div className="qai-field">
          <label>Unidade</label>
          <select value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}>
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="L">L</option>
            <option value="un">un</option>
            <option value="dz">dz</option>
          </select>
        </div>
        <div className="qai-field">
          <label>Valor da compra (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={form.valor_compra}
            onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))}
          />
        </div>
        <div className="qai-field">
          <label>Qtd da embalagem</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="1"
            value={form.qtd_embalagem}
            onChange={e => setForm(f => ({ ...f, qtd_embalagem: e.target.value }))}
          />
        </div>
      </div>

      {previewCusto > 0 && (
        <div className="qai-preview">
          Custo unitário: <strong>R$ {previewCusto.toFixed(4)} / {form.unidade}</strong>
        </div>
      )}

      <button type="button" className="qai-save" onClick={handleSalvar} disabled={saving}>
        {saving ? "Salvando..." : "Salvar insumo"}
      </button>

      <style>{`
        .qai-root {
          background:#fff;
          border:1.5px solid var(--primary, #FF6FA9);
          border-radius:14px; padding:0.9rem;
          display:flex; flex-direction:column; gap:0.7rem;
        }
        .qai-head {
          display:flex; justify-content:space-between; align-items:center;
          font-size:0.82rem; font-weight:700; color:var(--primary, #FF6FA9);
        }
        .qai-cancel {
          background:transparent; border:none; cursor:pointer;
          font-size:0.76rem; color:var(--text-muted, #9CA3AF); font-weight:600;
        }
        .qai-cancel:hover { color:var(--text-secondary, #6B7280); }
        .qai-input {
          width:100%; padding:0.65rem 0.85rem;
          border:1.5px solid var(--border, #E5E7EB);
          border-radius:10px; font-size:0.88rem; outline:none;
          box-sizing:border-box;
        }
        .qai-input:focus { border-color:var(--primary, #FF6FA9); }
        .qai-imgs { display:flex; flex-direction:column; gap:0.45rem; }
        .qai-imgs-label {
          font-size:0.72rem; font-weight:600;
          color:var(--text-secondary, #6B7280);
        }
        .qai-imgs-grid {
          display:grid; grid-template-columns:repeat(6, 1fr); gap:0.4rem;
        }
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
        .qai-grid {
          display:grid; grid-template-columns:0.7fr 1fr 1fr; gap:0.5rem;
        }
        .qai-field { display:flex; flex-direction:column; gap:3px; }
        .qai-field label {
          font-size:0.66rem; font-weight:700;
          color:var(--text-muted, #9CA3AF);
          text-transform:uppercase; letter-spacing:0.3px;
        }
        .qai-field input,
        .qai-field select {
          padding:0.5rem 0.6rem;
          border:1.5px solid var(--border, #E5E7EB);
          border-radius:9px; font-size:0.82rem; outline:none;
          background:#fff;
        }
        .qai-field input:focus,
        .qai-field select:focus { border-color:var(--primary, #FF6FA9); }
        .qai-preview {
          padding:0.5rem 0.75rem; background:#FFF5F9;
          border-radius:9px; font-size:0.78rem;
          color:var(--text-secondary, #6B7280);
        }
        .qai-preview strong { color:var(--primary, #FF6FA9); font-weight:800; }
        .qai-save {
          padding:0.75rem; background:var(--primary, #FF6FA9);
          color:#fff; border:none; border-radius:10px;
          font-size:0.88rem; font-weight:700; cursor:pointer;
          transition:opacity 0.15s ease;
        }
        .qai-save:hover:not(:disabled) { opacity:0.9; }
        .qai-save:disabled { opacity:0.6; cursor:not-allowed; }
      `}</style>
    </div>
  );
}
