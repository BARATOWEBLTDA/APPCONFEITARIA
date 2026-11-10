import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Crown, DownloadSimple, Images, MagnifyingGlass, WarningCircle, X } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, BotaoIcone, Janela, TelaVazia, avisar } from "@/components/base";
import { ConvitePro } from "@/components/billing/RecursoPro";
import { usePlano } from "@/hooks/usePlano";
import { baixarArquivo, carregarCategorias, carregarTopos, tamanhoTexto, type ArquivoTopo, type CategoriaTopo, type Topo } from "@/lib/toposBolo";
import "./toposBolo.css";

/**
 * (09/11) Topos de bolo (Ferramentas): busca, filtro por tema e a grade de topos (capa + formatos).
 * Tocar no topo abre a capa grande e os arquivos pra baixar. Todas veem; só a PRO baixa (as outras veem o convite do PRO).
 */
export default function ToposBolo() {
  const { isPro } = usePlano();
  const [params, setParams] = useSearchParams();
  const catId = params.get("cat");
  const [cats, setCats] = useState<CategoriaTopo[] | null>(null);
  const [topos, setTopos] = useState<Topo[]>([]);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState<Topo | null>(null);
  const [convite, setConvite] = useState(false);
  const [baixando, setBaixando] = useState("");

  const carregar = () => {
    setErro(false);
    Promise.all([carregarCategorias(), carregarTopos()]).then(([c, t]) => { setCats(c); setTopos(t); })
      // tabela ainda não criada no banco: mostra "Os topos estão chegando" (não é erro de internet)
      .catch((e: { code?: string }) => { if (/^(42P01|PGRST205|PGRST200)$/.test(String(e?.code || ""))) { setCats([]); setTopos([]); } else setErro(true); });
  };
  useEffect(carregar, []);

  // (09/11) uma tela só: busca + filtro de tema + a grade de todos os topos (sem a tela de temas com imagem grande)
  const [busca, setBusca] = useState("");
  const conta = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of topos) if (t.categoria_id) m.set(t.categoria_id, (m.get(t.categoria_id) || 0) + 1);
    return m;
  }, [topos]);
  const comTopos = (cats || []).filter(c => (conta.get(c.id) || 0) > 0);
  const cat = comTopos.find(c => c.id === catId) || null;
  const semAcento = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const nomeCat = (id: string | null) => (cats || []).find(c => c.id === id)?.nome || "";
  const q = semAcento(busca);
  const lista = topos.filter(t => t.categoria_id && conta.has(t.categoria_id) && (!cat || t.categoria_id === cat.id)
    && (!q || semAcento(`${t.titulo} ${nomeCat(t.categoria_id)}`).includes(q)));

  const escolher = (id: string | null) => setParams(id ? { cat: id } : {}, { replace: true });

  const baixar = async (a: ArquivoTopo) => {
    if (!isPro) { setAberto(null); setConvite(true); return; }
    setBaixando(a.caminho);
    const ok = await baixarArquivo(a);
    setBaixando("");
    if (!ok) avisar("Não deu para baixar agora. Confira a internet e tente de novo.", { tipo: "erro" });
  };

  return (
    <>
      <AppPageHeader title="Topos de bolo" subtitle="Prontos pra imprimir e recortar" voltar="/inicio" />
      <div className="tb">
        {erro ? (
          <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu para carregar os topos" texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={carregar}>Tentar de novo</Botao>} />
        ) : cats === null ? (
          <p className="tb-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Carregando…</p>
        ) : comTopos.length === 0 ? (
          <TelaVazia icone={<Images size={30} />} titulo="Os topos estão chegando" texto="Logo aparecem aqui os topos prontos pra imprimir." />
        ) : (
          <>
            <div className="ui-campo-c tb-busca">
              <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
              <input type="search" inputMode="search" autoComplete="off" aria-label="Buscar topo" placeholder="Buscar topo" value={busca} onChange={e => setBusca(e.target.value)} />
              {busca && <BotaoIcone variante="limpo" tamanho="p" rotulo="Limpar a busca" onClick={() => setBusca("")}><X size={18} weight="bold" /></BotaoIcone>}
            </div>
            <div className="tb-chips" role="tablist" aria-label="Filtrar por tema">
              <button type="button" role="tab" aria-selected={!cat} className={!cat ? "on" : ""} onClick={() => escolher(null)}>Todos</button>
              {comTopos.map(c => <button key={c.id} type="button" role="tab" aria-selected={c.id === cat?.id} className={c.id === cat?.id ? "on" : ""} onClick={() => escolher(c.id)}>{c.nome}</button>)}
            </div>
            {lista.length === 0 ? (
              <p className="tb-nada">Nenhum topo com “{busca.trim()}”{cat ? ` em ${cat.nome}` : ""}.</p>
            ) : (
              <div className="tb-grade">
                {lista.map(t => (
                  <button key={t.id} type="button" className="tb-it" onClick={() => setAberto(t)}>
                    <span className="tb-capa">{t.capa_url ? <img src={t.capa_url} alt="" loading="lazy" /> : <Images size={30} aria-hidden="true" />}</span>
                    <span className="tb-it-t">{t.titulo || "Topo de bolo"}</span>
                    <span className="tb-fmts">{[...new Set(t.arquivos.map(a => a.formato))].map(f => <em key={f}>{f}</em>)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Janela aberta={!!aberto} aoFechar={() => setAberto(null)} tipo="conteudo" titulo={aberto?.titulo || "Topo de bolo"} className="tb-janela">
        {aberto && (
          <div className="tb-det">
            <div className="tb-det-capa">{aberto.capa_url ? <img src={aberto.capa_url} alt={aberto.titulo} /> : <Images size={40} aria-hidden="true" />}</div>
            <div className="tb-det-arqs">
              <p className="tb-det-l">Arquivos</p>
              {aberto.arquivos.length === 0 ? <p className="tb-det-vz">Nenhum arquivo neste topo ainda.</p> : aberto.arquivos.map(a => (
                <div key={a.caminho} className="tb-arq">
                  <em>{a.formato}</em>
                  <span className="tb-arq-tx"><b>{a.nome}</b><small>{tamanhoTexto(a.tamanho)}</small></span>
                  <Botao tamanho="p" className="tb-baixar" variante={isPro ? "principal" : "suave"} carregando={baixando === a.caminho}
                    icone={isPro ? <DownloadSimple size={16} weight="bold" /> : <Crown size={14} weight="fill" />} onClick={() => baixar(a)}>Baixar</Botao>
                </div>
              ))}
              {!isPro && aberto.arquivos.length > 0 && <p className="tb-det-pro"><Crown size={14} weight="fill" aria-hidden="true" />Baixar os topos é um recurso do PRO</p>}
            </div>
          </div>
        )}
      </Janela>
      {convite && <ConvitePro recurso="topos" onClose={() => setConvite(false)} />}
    </>
  );
}
