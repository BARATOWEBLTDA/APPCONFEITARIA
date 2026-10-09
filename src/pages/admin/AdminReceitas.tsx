import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Botao, Janela, TelaVazia, Titulo, confirmar } from "@/components/base";
import { Cake, CheckCircle, MagnifyingGlass, Trash, X, XCircle } from "@phosphor-icons/react";
import "./adminReceitas.css";

type Status = "pendente" | "aprovada" | "rejeitada";

const FILTROS: [Status | "todas", string][] = [
  ["pendente", "Pendentes"],
  ["aprovada", "Aprovadas"],
  ["rejeitada", "Recusadas"],
  ["todas", "Todas"],
];

const NOME_STATUS: Record<Status, string> = { pendente: "Pendente", aprovada: "Aprovada", rejeitada: "Recusada" };
const VAZIO_STATUS: Record<Status, string> = { pendente: "pendente", aprovada: "aprovada", rejeitada: "recusada" };

export default function AdminReceitas() {
  const [receitas, setReceitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Status | "todas">("pendente");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [aberta, setAberta] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("receitas_comunidade").select("*, profiles(nome, foto_url)").order("created_at", { ascending: false });
    setReceitas(data || []);
    setLoading(false);
  };

  const abrir = (r: any) => { setSelected(r); setAberta(true); };
  const fechar = () => setAberta(false);

  const handleStatus = async (id: string, status: Status) => {
    await supabase.from("receitas_comunidade").update({ status }).eq("id", id);
    fechar();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmar({ titulo: "Excluir esta receita?", texto: "Ela some do app e não dá pra desfazer.", rotulo: "Excluir", perigo: true }))) return;
    await supabase.from("receitas_comunidade").delete().eq("id", id);
    fechar();
    load();
  };

  const filtered = receitas.filter(r => {
    const matchFiltro = filtro === "todas" || r.status === filtro;
    const matchSearch = r.nome?.toLowerCase().includes(search.toLowerCase());
    return matchFiltro && matchSearch;
  });

  const counts = {
    pendente: receitas.filter(r => r.status === "pendente").length,
    aprovada: receitas.filter(r => r.status === "aprovada").length,
    rejeitada: receitas.filter(r => r.status === "rejeitada").length,
  };

  const podeAprovar = selected && selected.status !== "aprovada";
  const podeRecusar = selected && selected.status !== "rejeitada";

  return (
    <div className="arc">
      <Titulo nivel="tela" apoio="Aprove ou recuse as receitas que as confeiteiras enviam.">Receitas da comunidade</Titulo>

      <div className="arc-chips" role="tablist" aria-label="Filtrar por situação">
        {FILTROS.map(([val, lb]) => (
          <button key={val} type="button" role="tab" aria-selected={filtro === val} onClick={() => setFiltro(val)}>
            {lb}
            {val !== "todas" && <i>{counts[val as Status]}</i>}
          </button>
        ))}
      </div>

      <label className="arc-busca">
        <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
        <input placeholder="Buscar receita" value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar receita" />
        {search && (
          <button type="button" aria-label="Limpar busca" onClick={() => setSearch("")}><X size={18} weight="bold" /></button>
        )}
      </label>

      {loading ? <p className="arc-carregando">Carregando…</p> : filtered.length === 0 ? (
        <TelaVazia
          caixa
          icone={<Cake size={30} />}
          titulo={search ? "Nenhuma receita encontrada" : filtro === "todas" ? "Nenhuma receita ainda" : `Nenhuma receita ${VAZIO_STATUS[filtro]}`}
          texto={search ? "Confira o nome ou limpe a busca." : "Quando chegar uma receita, ela aparece aqui."}
        />
      ) : (
        <div className="arc-grade">
          {filtered.map(r => (
            <button key={r.id} type="button" className="arc-card" onClick={() => abrir(r)}>
              <span className="arc-foto">
                {r.foto_url ? <img src={r.foto_url} alt="" /> : <Cake size={36} />}
              </span>
              <span className="arc-corpo">
                <b>{r.nome}</b>
                <small>{r.profiles?.nome || "Anônimo"}{r.categoria ? ` · ${r.categoria}` : ""}</small>
                <small>{new Date(r.created_at).toLocaleDateString("pt-BR")}</small>
              </span>
              <i className={`arc-tag arc-tag--${r.status}`}>{NOME_STATUS[r.status as Status] || r.status}</i>
            </button>
          ))}
        </div>
      )}

      <Janela
        aberta={aberta}
        aoFechar={fechar}
        tipo="conteudo"
        titulo={selected?.nome || "Receita"}
        umaAcao={!(podeAprovar && podeRecusar)}
        acoes={selected ? (
          <>
            {podeRecusar && <Botao variante="secundario" icone={<XCircle size={20} weight="bold" />} onClick={() => handleStatus(selected.id, "rejeitada")}>Recusar</Botao>}
            {podeAprovar && <Botao icone={<CheckCircle size={20} weight="bold" />} onClick={() => handleStatus(selected.id, "aprovada")}>Aprovar</Botao>}
          </>
        ) : undefined}
      >
        {selected && (
          <div className="arc-det">
            {selected.foto_url && <img src={selected.foto_url} alt="" className="arc-det-foto" />}
            <p className="arc-det-meta">
              Por {selected.profiles?.nome || "Anônimo"}{selected.categoria ? ` · ${selected.categoria}` : ""}
              <i className={`arc-tag arc-tag--${selected.status}`}>{NOME_STATUS[selected.status as Status] || selected.status}</i>
            </p>
            <h3>Ingredientes</h3>
            <p>{selected.ingredientes}</p>
            <h3>Modo de preparo</h3>
            <p>{selected.modo_preparo}</p>
            <div className="arc-det-excluir">
              <Botao variante="link" icone={<Trash size={18} weight="bold" />} onClick={() => handleDelete(selected.id)}>Excluir receita</Botao>
            </div>
          </div>
        )}
      </Janela>
    </div>
  );
}
