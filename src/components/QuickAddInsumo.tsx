import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export type InsumoQuick = {
  id: string;
  nome: string;
  marca?: string;
  categoria?: string;
  unidade: string;
  unidade_base?: string;
  embalagem_tipo?: string;
  custo_unitario: number;
  imagem_url?: string;
  valor_compra?: number;
  qtd_embalagem?: number;
};

/** Deriva a unidade base a partir da unidade de compra */
function deriveUnidadeBase(unidade: string): string {
  if (unidade === "kg" || unidade === "g") return "kg";
  if (unidade === "L" || unidade === "ml") return "L";
  if (unidade === "un") return "un";
  return unidade; // pct, cx, Lata, etc.
}

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
  embalagem_tipo: string;
  valor_compra: string;
  qtd_embalagem: string;
  imagem_url: string;
};

const CATEGORIAS_DEFAULT = ["Ingredientes", "Embalagens", "Decorações", "Bebidas", "Limpeza", "Descartáveis", "Outros"];

const UNIDADES_MEDIDA = [
  { sigla: "un", nome: "Unidade" },
  { sigla: "kg", nome: "Quilograma" },
  { sigla: "g", nome: "Grama" },
  { sigla: "L", nome: "Litro" },
  { sigla: "ml", nome: "Mililitro" },
];

const EMBALAGENS = [
  { sigla: "Avulso", nome: "Avulso (sem embalagem)" },
  { sigla: "Bandeja", nome: "Bandeja" },
  { sigla: "Caixa", nome: "Caixa" },
  { sigla: "Pacote", nome: "Pacote" },
  { sigla: "Saco", nome: "Saco" },
  { sigla: "Lata", nome: "Lata" },
  { sigla: "Garrafa", nome: "Garrafa" },
  { sigla: "Pote", nome: "Pote" },
  { sigla: "Bisnaga", nome: "Bisnaga" },
  { sigla: "Rolo", nome: "Rolo" },
];

/**
 * Cadastro rápido e edição de insumo.
 * Reutilizado em /insumos e na ficha técnica.
 */
export default function QuickAddInsumo({ userId, initialName, editing, onSaved, onCancel }: Props) {
  const isEditing = !!editing;

  const [form, setForm] = useState<Form>(() => {
    if (editing) {
      // Detecta se a unidade antiga era uma embalagem (dados pré-migração)
      const oldPkgUnits = ["pct", "cx", "Lata", "Garrafa", "Pote", "Bandeja", "Saco", "Bisnaga", "Rolo"];
      const isOldPkg = oldPkgUnits.includes(editing.unidade);
      return {
        nome: editing.nome || "",
        marca: editing.marca || "",
        categoria: editing.categoria || "Ingredientes",
        unidade: isOldPkg ? "un" : (editing.unidade || "g"),
        embalagem_tipo: isOldPkg ? editing.unidade : (editing.embalagem_tipo || "Avulso"),
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
      embalagem_tipo: "Avulso",
      valor_compra: "",
      qtd_embalagem: "1",
      imagem_url: "",
    };
  });

  const [imagens, setImagens] = useState<string[]>([]);
  const [buscandoImg, setBuscandoImg] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_DEFAULT);

  const galleryRef = useRef<HTMLInputElement>(null);

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

  const handleBuscarImagem = async () => {
    const termo = `${form.nome} ${form.marca}`.trim();
    if (form.nome.trim().length < 3) { alert("Digite o nome do insumo primeiro"); return; }
    setBuscandoImg(true);
    setImagens([]);
    try {
      const res = await fetch(`/api/buscar-imagem?q=${encodeURIComponent(termo)}`);
      const data = await res.json();
      if (data.images) setImagens(data.images.slice(0, 3));
    } catch (e) { console.error(e); }
    setBuscandoImg(false);
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingImg(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `insumos/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (error) {
      alert("Erro ao enviar imagem");
      console.error(error);
    } else {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, imagem_url: data.publicUrl }));
      setImagens([]); // limpa resultados de busca se havia
    }
    setUploadingImg(false);
    e.target.value = ""; // reseta input pra permitir mesmo arquivo de novo
  };

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
      unidade_base: deriveUnidadeBase(form.unidade),
      embalagem_tipo: form.embalagem_tipo,
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
      unidade_base: data.unidade_base,
      embalagem_tipo: data.embalagem_tipo,
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
        <div className="qai-imgs-label">Imagem do produto</div>

        <input ref={galleryRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUploadFile} />

        {/* Área da imagem (3 slots, resultado da busca, upload, ou mensagem do Doo) */}
        <div className="qai-imgs-area">
          {buscandoImg && (
            <div className="qai-imgs-doo">
              <div className="qai-imgs-doo-spinner" />
              <p>🔍 <strong>Doo</strong> está procurando<span className="qai-dots"><span>.</span><span>.</span><span>.</span></span></p>
            </div>
          )}

          {uploadingImg && (
            <div className="qai-imgs-doo">
              <div className="qai-imgs-doo-spinner" />
              <p>📤 <strong>Doo</strong> está enviando<span className="qai-dots"><span>.</span><span>.</span><span>.</span></span></p>
            </div>
          )}

          {/* Imagem única do upload */}
          {!buscandoImg && !uploadingImg && form.imagem_url && imagens.length === 0 && (
            <div className="qai-imgs-selected">
              <img src={form.imagem_url} alt="Imagem selecionada" />
              <button type="button" className="qai-img-remove" onClick={() => setForm(f => ({ ...f, imagem_url: "" }))}>
                ✕ Remover
              </button>
            </div>
          )}

          {/* 3 resultados da busca */}
          {!buscandoImg && !uploadingImg && imagens.length > 0 && (
            <div className="qai-imgs-grid">
              {imagens.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`qai-img-big ${form.imagem_url === url ? "qai-img-big--selected" : ""}`}
                  onClick={() => setForm(f => ({ ...f, imagem_url: f.imagem_url === url ? "" : url }))}
                >
                  <img src={url} alt="" />
                  {form.imagem_url === url && <span className="qai-img-check">✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Estado inicial: 3 placeholders */}
          {!buscandoImg && !uploadingImg && !form.imagem_url && imagens.length === 0 && (
            <div className="qai-imgs-grid">
              <div className="qai-img-big qai-img-big--placeholder"><span>🖼️</span></div>
              <div className="qai-img-big qai-img-big--placeholder"><span>🖼️</span></div>
              <div className="qai-img-big qai-img-big--placeholder"><span>🖼️</span></div>
            </div>
          )}
        </div>

        {/* 2 botões embaixo */}
        <div className="qai-imgs-actions">
          <button type="button" className="qai-img-action" onClick={handleBuscarImagem} disabled={buscandoImg || uploadingImg || form.nome.trim().length < 3}>
            🔍 Buscar Automaticamente
          </button>
          <button type="button" className="qai-img-action" onClick={() => galleryRef.current?.click()} disabled={uploadingImg || buscandoImg}>
            📤 Upload manual
          </button>
        </div>
      </div>

      <div className="qai-row-2">
        <div className="qai-field">
          <label>Quanto pagou *</label>
          <div className="qai-input-prefix">
            <span>R$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={form.valor_compra}
              onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))}
            />
          </div>
        </div>
        <div className="qai-field">
          <label>Embalagem</label>
          <select
            className="qai-input"
            value={form.embalagem_tipo}
            onChange={e => setForm(f => ({ ...f, embalagem_tipo: e.target.value }))}
          >
            {EMBALAGENS.map(e => <option key={e.sigla} value={e.sigla}>{e.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="qai-row-3">
        <div className="qai-field">
          <label>Quantidade *</label>
          <input
            type="text"
            inputMode="decimal"
            className="qai-input"
            placeholder="12"
            value={form.qtd_embalagem}
            onChange={e => setForm(f => ({ ...f, qtd_embalagem: e.target.value }))}
          />
        </div>
        <div className="qai-field">
          <label>Medida *</label>
          <select
            className="qai-input"
            value={form.unidade}
            onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
          >
            {UNIDADES_MEDIDA.map(u => <option key={u.sigla} value={u.sigla}>{u.nome}</option>)}
          </select>
        </div>
      </div>

      {previewCusto > 0 && (
        <div className="qai-preview">
          Custo unitário: <strong>R$ {previewCusto.toFixed(2).replace(".", ",")} / {form.unidade}</strong>
          {form.embalagem_tipo !== "Avulso" && (
            <span style={{ display: "block", marginTop: 2, fontSize: "0.75rem", opacity: 0.75 }}>
              Comprado em {form.embalagem_tipo.toLowerCase()} com {form.qtd_embalagem} {form.unidade}
            </span>
          )}
        </div>
      )}

      <button type="button" className="qai-save" onClick={handleSalvar} disabled={saving}>
        {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar insumo"}
      </button>

      <style>{`
        /* ─────────────────────────────────────────
           QuickAddInsumo — Modal de cadastro/edição
           100% via design tokens (themes.css):
           Tipografia · Spacing · Radius · Motion
           Esse componente NÃO define valores próprios.
           ───────────────────────────────────────── */

        .qai-root {
          background: var(--bg-card, #fff);
          border-radius: var(--radius-lg);
          display: flex; flex-direction: column;
          gap: var(--gap-stack);
        }

        /* Header do modal */
        .qai-head {
          display: flex; justify-content: space-between; align-items: center;
          font-size: var(--font-modal-title);
          font-weight: var(--fw-bold);
          line-height: var(--lh-tight);
          color: var(--primary);
          padding-bottom: var(--space-1);
          border-bottom: 1px solid var(--border);
        }
        .qai-cancel {
          background: transparent; border: none; cursor: pointer;
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          line-height: var(--lh-normal);
          color: var(--text-muted);
          transition: color var(--dur-fast) var(--ease-out);
        }
        .qai-cancel:hover { color: var(--text-secondary); }

        /* Campos */
        .qai-field { display: flex; flex-direction: column; gap: var(--space-2); }
        .qai-field label {
          font-size: var(--font-field-label);
          font-weight: var(--fw-semibold);
          line-height: var(--lh-normal);
          color: var(--text-secondary);
        }
        .qai-input {
          width: 100%;
          padding: var(--pad-input);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          font-size: var(--font-input);
          font-weight: var(--fw-medium);
          line-height: var(--lh-normal);
          color: var(--text-title);
          outline: none;
          background: var(--bg-input);
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .qai-input:focus { border-color: var(--primary); }
        .qai-input-prefix {
          display: flex; align-items: center;
          border: 1.5px solid var(--border); border-radius: var(--radius-md);
          background: var(--bg-input); overflow: hidden;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .qai-input-prefix:focus-within { border-color: var(--primary); }
        .qai-input-prefix span {
          padding: 0 0 0 0.6rem;
          font-size: var(--font-input); font-weight: var(--fw-semibold);
          color: var(--text-muted); white-space: nowrap; user-select: none;
        }
        .qai-input-prefix input {
          flex: 1; min-width: 0; border: none; outline: none; background: transparent;
          padding: var(--pad-input); padding-left: 0.3rem;
          font-size: var(--font-input); font-weight: var(--fw-medium);
          color: var(--text-title); font-family: inherit; box-sizing: border-box;
        }
        select.qai-input { cursor: pointer; }

        .qai-row-2 {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--gap-tight);
        }
        .qai-row-3 {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--gap-tight);
        }

        /* Bloco de imagens */
        .qai-imgs {
          display: flex; flex-direction: column;
          gap: var(--gap-tight);
        }
        .qai-imgs-label {
          font-size: var(--font-field-label);
          font-weight: var(--fw-semibold);
          line-height: var(--lh-normal);
          color: var(--text-secondary);
        }

        .qai-imgs-area {
          min-height: 110px;
          display: flex; flex-direction: column;
        }

        /* Mensagem do Doo (procurando / enviando) */
        .qai-imgs-doo {
          flex: 1; min-height: 110px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--space-2);
          background: var(--primary-light);
          border: 1.5px dashed var(--primary);
          border-radius: var(--radius-md);
          padding: var(--space-4);
        }
        .qai-imgs-doo p {
          margin: 0;
          font-size: var(--font-body);
          font-weight: var(--fw-semibold);
          line-height: var(--lh-normal);
          color: var(--primary);
        }
        .qai-imgs-doo strong { font-weight: var(--fw-black); }
        .qai-imgs-doo-spinner {
          width: 28px; height: 28px;
          border: 3px solid rgba(var(--primary-rgb), 0.25);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: qaiSpin 0.7s linear infinite;
        }
        @keyframes qaiSpin { to { transform: rotate(360deg); } }
        .qai-dots span {
          display: inline-block; opacity: 0;
          animation: qaiDots 1.2s infinite;
        }
        .qai-dots span:nth-child(1) { animation-delay: 0s; }
        .qai-dots span:nth-child(2) { animation-delay: 0.2s; }
        .qai-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes qaiDots {
          0%, 60%, 100% { opacity: 0; }
          30% { opacity: 1; }
        }

        .qai-imgs-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: var(--gap-tight);
          flex: 1;
        }
        .qai-img-big {
          position: relative;
          aspect-ratio: 1;
          border: 2px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0; overflow: hidden;
          background: var(--bg-card);
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .qai-img-big img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .qai-img-big:hover { border-color: var(--primary); }
        .qai-img-big--selected {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.25);
        }
        .qai-img-check {
          position: absolute; top: 6px; right: 6px;
          width: 24px; height: 24px;
          background: var(--primary); color: var(--text-inverse);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .qai-img-big--placeholder {
          border-style: dashed; cursor: default;
          background: var(--bg-body);
          display: flex; align-items: center; justify-content: center;
        }
        .qai-img-big--placeholder span {
          font-size: 1.8rem; opacity: 0.35;
        }
        .qai-img-big--placeholder:hover { border-color: var(--border); }

        .qai-imgs-selected {
          position: relative;
          width: 100%; max-width: 240px;
          margin: 0 auto;
          aspect-ratio: 1;
          border: 2px solid var(--primary);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.2);
        }
        .qai-imgs-selected img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .qai-img-remove {
          position: absolute; bottom: 8px; right: 8px;
          padding: var(--space-1) var(--space-2);
          background: rgba(0,0,0,0.7); color: #fff;
          border: none;
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          line-height: var(--lh-normal);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .qai-img-remove:hover { background: rgba(0,0,0,0.85); }

        /* Botões de ação embaixo da imagem (Buscar / Upload) */
        .qai-imgs-actions {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--gap-tight);
        }
        .qai-img-action {
          padding: var(--space-3);
          background: var(--bg-body);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          line-height: var(--lh-normal);
          color: var(--text-title);
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
          white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .qai-img-action:hover:not(:disabled) {
          border-color: var(--primary);
          background: var(--primary-light);
          color: var(--primary);
        }
        .qai-img-action:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Preview de custo unitário */
        .qai-preview {
          padding: var(--pad-input);
          background: var(--primary-light);
          border-radius: var(--radius-md);
          font-size: var(--font-helper);
          font-weight: var(--fw-regular);
          line-height: var(--lh-normal);
          color: var(--text-secondary);
        }
        .qai-preview strong {
          color: var(--primary);
          font-weight: var(--fw-black);
        }

        /* Botão salvar (CTA principal) */
        .qai-save {
          padding: var(--space-3);
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          line-height: var(--lh-normal);
          cursor: pointer;
          transition: opacity var(--dur-fast) var(--ease-out);
        }
        .qai-save:hover:not(:disabled) { opacity: 0.9; }
        .qai-save:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 480px) {
          .qai-row-3 { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
