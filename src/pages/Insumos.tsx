import { useState, useEffect, useRef } from "react";
import { CaretRight, Cookie, Drop, Egg, Gift, MagnifyingGlass, Package, Plus, X } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import QuickAddInsumo, { InsumoQuick, custoNaReceita, descreverCompra, formatarCusto } from "@/components/QuickAddInsumo";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, TelaVazia, avisar, confirmar } from "@/components/base";
import "./clientes.css";
import "@/components/ingredientes.css";

interface Insumo {
  id: string;
  nome: string;
  marca: string;
  categoria: string;
  unidade: string;
  embalagem_tipo: string;
  valor_compra: number;
  qtd_embalagem: number;
  custo_unitario: number;
  imagem_url: string;
}

/** Ícone de cada categoria (quando o ingrediente não tem foto) */
const ICONE_CAT: Record<string, typeof Egg> = { Ingredientes: Egg, Embalagens: Package, Decorações: Cookie, Bebidas: Drop, Descartáveis: Package };
const Miniatura = ({ i }: { i: Insumo }) => {
  if (i.imagem_url) return <span className="ig-th"><img src={i.imagem_url} alt="" /></span>;
  const Ic = ICONE_CAT[i.categoria] || Gift;
  return <span className="ig-th"><Ic size={22} weight="duotone" /></span>;
};

export default function Insumos() {
  const [userId, setUserId] = useState<string | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todos");

  // Janela de cadastro/edição: "form" fica montado durante a animação de saída
  const [form, setForm] = useState<{ editando: Insumo | null; chave: number } | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const tempoFechar = useRef<number | undefined>(undefined);

  // ── Carrega usuário e ingredientes ──
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancel) return;
      setUserId(user.id);
      await loadInsumos(user.id);
    })();
    return () => { cancel = true; window.clearTimeout(tempoFechar.current); };
  }, []);

  const loadInsumos = async (uid: string) => {
    const { data } = await supabase.from("insumos").select("*").eq("user_id", uid).order("nome");
    setInsumos((data as Insumo[]) || []);
    setLoading(false);
  };

  // ── Filtros ──
  const termo = busca.trim().toLowerCase();
  const filtrados = insumos.filter(i => {
    const matchBusca = !termo || i.nome.toLowerCase().includes(termo) || (i.marca || "").toLowerCase().includes(termo);
    const matchCat = filtroCategoria === "Todos" || i.categoria === filtroCategoria;
    return matchBusca && matchCat;
  });
  // Chips só das categorias que têm ingrediente (na ordem de quantidade)
  const contagem = insumos.reduce<Record<string, number>>((m, i) => { const c = i.categoria || "Outros"; m[c] = (m[c] || 0) + 1; return m; }, {});
  const chips = Object.entries(contagem).sort((a, b) => b[1] - a[1]).map(([c]) => c);

  // ── Janela ──
  const abrirForm = (editando: Insumo | null) => {
    window.clearTimeout(tempoFechar.current);
    setForm({ editando, chave: Date.now() });
    setFormAberto(true);
  };
  const fecharForm = () => {
    setFormAberto(false);
    tempoFechar.current = window.setTimeout(() => setForm(null), 320);
  };
  const onInsumoSalvo = async (_insumo: InsumoQuick) => {
    const editou = !!form?.editando;
    fecharForm();
    avisar(editou ? "Ingrediente salvo" : "Ingrediente cadastrado", { tipo: "ok" });
    if (userId) await loadInsumos(userId);
  };
  const excluir = async (i: Insumo) => {
    const { data: usos } = await supabase.from("produto_insumos").select("produto_id").eq("insumo_id", i.id);
    const n = new Set((usos || []).map((r: any) => r.produto_id)).size;
    const ok = await confirmar({
      titulo: `Excluir ${i.nome}?`,
      texto: n > 0
        ? `Ele está em ${n} ${n === 1 ? "ficha técnica" : "fichas técnicas"}. O custo dessas fichas vai mudar.`
        : "Ele sai da sua lista de ingredientes.",
      rotulo: "Excluir", perigo: true, icone: "erro",
    });
    if (!ok) return;
    const { error } = await supabase.from("insumos").delete().eq("id", i.id);
    if (error) { console.error(error); avisar("Não deu pra excluir. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    fecharForm();
    avisar("Ingrediente excluído", { tipo: "ok" });
    if (userId) await loadInsumos(userId);
  };

  const cabecalho = (
    <AppPageHeader
      title="Ingredientes"
      subtitle={loading || insumos.length === 0 ? "O que você compra pra produzir" : `${insumos.length} ${insumos.length === 1 ? "cadastrado" : "cadastrados"}`}
      infoContent={
        <>
          <p>Aqui fica tudo o que você compra pra produzir: ingredientes, embalagens, decorações e descartáveis.</p>
          <p>Com o preço de cada um, a ficha técnica calcula quanto custa cada produto e quanto você lucra de verdade.</p>
        </>
      }
      infoTip={<>Coloque <strong>quanto vem</strong> e <strong>quanto pagou</strong>: o Doonly calcula o custo de cada grama.</>}
    />
  );

  return (
    <>
      {cabecalho}
      <div className="cl9">
        {loading ? (
          <div className="cl9-esq" aria-label="Carregando ingredientes">{[0, 1, 2, 3, 4].map(k => <span key={k} />)}</div>
        ) : insumos.length === 0 ? (
          <TelaVazia caixa icone={<Egg size={30} />} titulo="Nenhum ingrediente ainda"
            texto="Cadastre o que você compra (leite condensado, chocolate, caixas…) com o preço pago. A ficha técnica usa isso pra calcular o custo de cada produto."
            acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={() => abrirForm(null)}>Cadastrar ingrediente</Botao>} />
        ) : (
          <section className="cl9-card">
            <div className="cl9-barra">
              <label className="cl9-busca">
                <MagnifyingGlass size={20} weight="bold" />
                <input type="search" placeholder="Buscar por nome ou marca" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar ingrediente" autoComplete="off" />
                {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")}><X size={18} weight="bold" /></button>}
              </label>
              <div className="cl9-acoes">
                <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={() => abrirForm(null)}><span className="cl9-g">Novo ingrediente</span><span className="cl9-c">Novo</span></Botao>
              </div>
            </div>

            {chips.length > 1 && (
              <div className="cl9-chips" role="tablist" aria-label="Filtrar por categoria">
                {["Todos", ...chips].map(c => (
                  <button key={c} type="button" role="tab" aria-selected={filtroCategoria === c} onClick={() => setFiltroCategoria(c)}>
                    {c}<i>{c === "Todos" ? insumos.length : contagem[c]}</i>
                  </button>
                ))}
              </div>
            )}

            {filtrados.length === 0 ? (
              <p className="cl9-semres">{termo ? "Nenhum ingrediente com esse nome ou marca. Confira a busca." : "Nenhum ingrediente nessa categoria."}</p>
            ) : (<>
              <div className="ig-tab-cab" aria-hidden="true"><span>Ingrediente</span><span>Compra</span><span>Custo na receita</span><span /></div>
              {filtrados.map(i => {
                const preco = `R$ ${(i.valor_compra || 0).toFixed(2).replace(".", ",")}`;
                const compra = descreverCompra(i.embalagem_tipo, i.qtd_embalagem || 1, i.unidade);
                const c = custoNaReceita(i.custo_unitario || 0, i.unidade, i.qtd_embalagem || 1);
                return (
                  <button key={i.id} type="button" className="ig-l" onClick={() => abrirForm(i)} aria-label={`${i.nome}, ${formatarCusto(c.valor)} ${c.por}. Editar`}>
                    <Miniatura i={i} />
                    <span className="ig-l-tx">
                      <b>{i.nome}</b>
                      <small className="ig-pc">{[i.marca, i.categoria].filter(Boolean).join(" · ")}</small>
                      <small className="ig-cel">{preco} · {compra}</small>
                    </span>
                    <span className="ig-l-compra"><b>{preco}</b><small>{compra}</small></span>
                    <span className="ig-l-custo"><b>{formatarCusto(c.valor)}</b><small>{c.por}</small></span>
                    <CaretRight size={18} weight="bold" />
                  </button>
                );
              })}
            </>)}
          </section>
        )}
      </div>

      {form && userId && (
        <QuickAddInsumo
          key={form.chave}
          janela
          aberta={formAberto}
          userId={userId}
          editing={form.editando ? {
            id: form.editando.id,
            nome: form.editando.nome,
            marca: form.editando.marca,
            categoria: form.editando.categoria,
            unidade: form.editando.unidade,
            embalagem_tipo: form.editando.embalagem_tipo,
            custo_unitario: form.editando.custo_unitario,
            imagem_url: form.editando.imagem_url,
            valor_compra: form.editando.valor_compra,
            qtd_embalagem: form.editando.qtd_embalagem,
          } : undefined}
          onSaved={onInsumoSalvo}
          onCancel={fecharForm}
          onDelete={form.editando ? () => excluir(form.editando!) : undefined}
        />
      )}
    </>
  );
}
