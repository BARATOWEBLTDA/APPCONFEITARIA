import { useState, useEffect, useRef } from "react";
import { Broom, CaretRight, Drop, Egg, ForkKnife, Grains, MagnifyingGlass, Package, Plus, Sparkle, Tag, WarningCircle, X } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { explicarErro } from "@/lib/erros";
import QuickAddInsumo, { InsumoQuick, custoNaReceita, descreverCompra, formatarCusto, rotuloCategoria } from "@/components/QuickAddInsumo";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_INGREDIENTES, TOUR_INGREDIENTES } from "@/lib/comoTelas";
import { Botao, TelaVazia, avisar, confirmar } from "@/components/base";
import GavetaFiltro, { BotaoFiltro } from "@/components/base/GavetaFiltro";
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

/** Ícone de cada categoria (quando o ingrediente não tem foto). 10/10: um por tipo — antes quase tudo saía com o ovo */
const sem = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const ICONE_CAT: Record<string, typeof Egg> = { ingredientes: Grains, alimentos: Grains, embalagens: Package, decoracoes: Sparkle, bebidas: Drop, descartaveis: ForkKnife, limpeza: Broom };
// Item salvo como "Ingredientes" mas que pelo nome é embalagem ou decoração
const PARECE_EMBALAGEM = /^(caixa|embalage|saco|saquinho|sacola|forminha|forma de papel|fita|pote|tampa|etiqueta|tag|papel|bandeja|cake ?board|base |filme|celofane|copo|colher|garfo|guardanapo|tubete|blister)/;
const PARECE_DECORACAO = /^(topo|topper|vela|granulado|confeito|glitter|brilho|perol|po para decorar|corante|flor|confete|sprinkle)/;
const Miniatura = ({ i }: { i: Insumo }) => {
  if (i.imagem_url) return <span className="ig-th"><img src={i.imagem_url} alt="" /></span>;
  const cat = sem(i.categoria);
  const nome = sem(i.nome);
  const Ic = (cat === "ingredientes" || !cat) && PARECE_EMBALAGEM.test(nome) ? Package
    : (cat === "ingredientes" || !cat) && PARECE_DECORACAO.test(nome) ? Sparkle
    : ICONE_CAT[cat] || Tag;
  return <span className="ig-th"><Ic size={22} weight="duotone" /></span>;
};

export default function Insumos() {
  const [userId, setUserId] = useState<string | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  // (11/10) a lista não carregou: mostra o erro com "Tentar de novo" em vez de "Nenhum ingrediente ainda"
  const [erroCarga, setErroCarga] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todos");
  const [filtroAberto, setFiltroAberto] = useState(false);

  // Janela de cadastro/edição: "form" fica montado durante a animação de saída
  const [form, setForm] = useState<{ editando: Insumo | null; chave: number } | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const tempoFechar = useRef<number | undefined>(undefined);

  // ── Carrega usuário e ingredientes ──
  const carregar = async () => {
    setLoading(true); setErroCarga("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErroCarga("Tente de novo em instantes."); setLoading(false); return; }
      setUserId(user.id);
      await loadInsumos(user.id, true);
    } catch (e) {
      setErroCarga(explicarErro(e, "Tente de novo em instantes."));
      setLoading(false);
    }
  };
  useEffect(() => {
    void carregar();
    return () => { window.clearTimeout(tempoFechar.current); };
  }, []);

  // (11/10) leitura que falha não vira lista vazia: na primeira carga mostra o erro; depois, a lista da tela continua
  const loadInsumos = async (uid: string, primeira = false) => {
    const { data, error } = await supabase.from("insumos").select("*").eq("user_id", uid).order("nome");
    if (error || !data) {
      if (primeira) setErroCarga(explicarErro(error, "Tente de novo em instantes."));
      else console.error("[Doonly]", error);
    } else setInsumos(data as Insumo[]);
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
    // (11/10) se não der pra saber em quantas fichas ele está, não exclui (antes a pergunta dizia "Ele sai da sua lista"
    // pra ingrediente usado em fichas técnicas)
    const { data: usos, error: erroUsos } = await supabase.from("produto_insumos").select("produto_id").eq("insumo_id", i.id);
    if (erroUsos || !usos) { avisar(explicarErro(erroUsos, "Não deu para conferir as fichas técnicas. Tente de novo."), { tipo: "erro" }); return; }
    const n = new Set(usos.map((r: any) => r.produto_id)).size;
    const ok = await confirmar({
      titulo: `Excluir ${i.nome}?`,
      texto: n > 0
        ? `Ele está em ${n} ${n === 1 ? "ficha técnica" : "fichas técnicas"}. O custo dessas fichas vai mudar.`
        : "Ele sai da sua lista de ingredientes.",
      rotulo: "Excluir", perigo: true, icone: "erro",
    });
    if (!ok) return;
    const { error } = await supabase.from("insumos").delete().eq("id", i.id);
    if (error) {
      // 23503: o banco não deixa apagar ingrediente que ainda está em ficha técnica
      avisar(error.code === "23503"
        ? "Esse ingrediente está em fichas técnicas, por isso não dá para excluir."
        : explicarErro(error, "Não deu para excluir. Tente de novo."), { tipo: "erro" });
      return;
    }
    fecharForm();
    avisar("Ingrediente excluído", { tipo: "ok" });
    if (userId) await loadInsumos(userId);
  };

  const cabecalho = (
    <AppPageHeader voltar="/cadastros"
      title="Ingredientes" infoComo={COMO_INGREDIENTES} infoTour={TOUR_INGREDIENTES}
      subtitle={loading || insumos.length === 0 ? "O que você compra para produzir" : `${insumos.length} ${insumos.length === 1 ? "cadastrado" : "cadastrados"}`}
      infoContent={
        <>
          <p>Aqui fica tudo o que você compra para produzir: ingredientes, embalagens, decorações e descartáveis.</p>
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
        ) : erroCarga ? (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para carregar os ingredientes" texto={erroCarga}
            acao={<Botao onClick={() => void carregar()}>Tentar de novo</Botao>} />
        ) : insumos.length === 0 ? (
          <TelaVazia caixa icone={<Egg size={30} />} titulo="Nenhum ingrediente ainda"
            texto="Cadastre o que você compra (leite condensado, chocolate, caixas…) com o preço pago. A ficha técnica usa isso para calcular o custo de cada produto."
            acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={() => abrirForm(null)}>Cadastrar ingrediente</Botao>} />
        ) : (
          <section className="cl9-card">
            <div className="cl9-barra">
              <label className="cl9-busca">
                <MagnifyingGlass size={20} weight="bold" />
                <input type="search" placeholder="Buscar" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar ingrediente" autoComplete="off" />
                {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")}><X size={18} weight="bold" /></button>}
              </label>
              {/* (24/10) filtro padrão do app: abre na lateral */}
              {chips.length > 1 && <BotaoFiltro className="ig-filtro" ativos={filtroCategoria === "Todos" ? 0 : 1} onClick={() => setFiltroAberto(true)} />}
              <div className="cl9-acoes">
                <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={() => abrirForm(null)}><span className="cl9-g">Novo ingrediente</span><span className="cl9-c">Novo</span></Botao>
              </div>
            </div>
            {filtroAberto && <GavetaFiltro valor={{ cat: filtroCategoria }} padrao={{ cat: "Todos" }}
              grupos={[{ id: "cat", titulo: "Categoria", tipo: "radio", opcoes: ["Todos", ...chips].map(c => ({ k: c, label: c === "Todos" ? "Todas" : rotuloCategoria(c), n: c === "Todos" ? insumos.length : contagem[c] })) }]}
              contar={v => v.cat === "Todos" ? insumos.length : contagem[v.cat] || 0}
              rotulo={n => n === 0 ? "Nenhum ingrediente" : `Ver ${n} ${n === 1 ? "ingrediente" : "ingredientes"}`}
              aoAplicar={v => setFiltroCategoria(v.cat)} aoFechar={() => setFiltroAberto(false)} />}

            {filtrados.length === 0 ? (
              <p className="cl9-semres">{termo ? "Nenhum ingrediente com esse nome ou marca. Confira a busca." : "Nenhum ingrediente nessa categoria."}</p>
            ) : (<>
              <div className="ig-tab-cab" aria-hidden="true"><span>Item</span><span>Compra</span><span>Custo na receita</span><span /></div>
              {filtrados.map(i => {
                const preco = `R$\u00a0${(i.valor_compra || 0).toFixed(2).replace(".", ",")}`;
                const compra = descreverCompra(i.embalagem_tipo, i.qtd_embalagem || 1, i.unidade);
                const c = custoNaReceita(i.custo_unitario || 0, i.unidade, i.qtd_embalagem || 1);
                return (
                  <button key={i.id} type="button" className="ig-l" onClick={() => abrirForm(i)} aria-label={`${i.nome}, ${formatarCusto(c.valor)} ${c.por}. Editar`}>
                    <Miniatura i={i} />
                    <span className="ig-l-tx">
                      <b>{i.nome}</b>
                      <small className="ig-pc">{[i.marca, rotuloCategoria(i.categoria)].filter(Boolean).join(" · ")}</small>
                      <small className="ig-cel">{preco} · {compra.replace(/^.*?\b(de|com)\s+/, "")}</small>{/* (24/10) celular: só a quantidade (cabe numa linha) */}
                    </span>
                    <span className="ig-l-compra"><b>{preco}</b><small>{compra}</small></span>
                    <span className="ig-l-custo"><b>{formatarCusto(c.valor)}</b><small><span className="ig-por-l">{c.por.replace(/ (?=\S+$)/, "\u00a0")}</span><span className="ig-por-c">{/^a cada /i.test(c.por) ? c.por.replace(/^a cada /i, "/").replace(/ (?=\S+$)/, "\u00a0") : c.por === "cada" ? "/un." : c.por}</span></small></span>
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
