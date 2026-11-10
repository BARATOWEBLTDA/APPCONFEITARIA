import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowSquareOut, ShareNetwork, CaretLeft, CaretRight, Crown, SquaresFour, DownloadSimple, Images, MagnifyingGlass, WarningCircle, X } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, BotaoIcone, Janela, TelaVazia, avisar } from "@/components/base";
import { ConvitePro } from "@/components/billing/RecursoPro";
import { usePlano } from "@/hooks/usePlano";
import { baixarArquivo, infoFormato, carregarCategorias, carregarTopos, tamanhoTexto, type ArquivoTopo, type CategoriaTopo, type Topo } from "@/lib/toposBolo";
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
    && (!q || semAcento(`${t.titulo} ${nomeCat(t.categoria_id)} ${(t.tags || []).join(' ')}`).includes(q)));

  // (09/11) 24 topos por página (2, 3 ou 4 por linha fecham certinho); trocar filtro ou busca volta pra 1ª
  const POR_PAGINA = 24;
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const pag = Math.min(pagina, totalPaginas);
  const daPagina = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  useEffect(() => { setPagina(1); }, [catId, busca]);
  const irPagina = (n: number) => { setPagina(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const escolher = (id: string | null) => setParams(id ? { cat: id } : {}, { replace: true });
  // (09/11) veio do link compartilhado (/topo/:id → ?topo=): já abre esse topo
  const topoParam = params.get("topo");
  useEffect(() => {
    if (!topoParam || !topos.length) return;
    const t = topos.find(x => x.id === topoParam);
    if (t) setAberto(t);
    setParams(p => { const n = new URLSearchParams(p); n.delete("topo"); return n; }, { replace: true });
  }, [topoParam, topos.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // (09/11) compartilhar: manda o link do topo (a página aberta mostra só a capa e convida pro Doonly; o arquivo não vai)
  const compartilhar = async (t: Topo) => {
    const url = `${window.location.origin}/topo/${t.id}`;
    const texto = `Olha só esse topo de bolo que achei no Doonly: ${t.titulo || "topo de bolo"}`;
    try { if (navigator.share) { await navigator.share({ title: t.titulo || "Topo de bolo", text: texto, url }); return; } } catch (e) { if ((e as Error)?.name === "AbortError") return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`, "_blank", "noopener");
  };

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
            {/* (09/11) temas em bolinhas, estilo destaques do Instagram: passa de lado; o tema marcado ganha o anel */}
            <div className="tb-dest" role="tablist" aria-label="Temas">
              <button type="button" role="tab" aria-selected={!cat} className={`tb-dest-it${!cat ? " on" : ""}`} onClick={() => escolher(null)}>
                <span className="tb-dest-c"><span className="tb-dest-todos"><SquaresFour size={26} weight="regular" /></span></span><span className="tb-dest-n">Todos</span>
              </button>
              {comTopos.map(c => {
                const capaTema = topos.find(t => t.categoria_id === c.id && t.capa_url);
                const img = c.imagem_mini_url || c.imagem_url || capaTema?.capa_mini_url || capaTema?.capa_url || null;
                return (
                  <button key={c.id} type="button" role="tab" aria-selected={c.id === cat?.id} className={`tb-dest-it${c.id === cat?.id ? " on" : ""}`} onClick={() => escolher(c.id)}>
                    <span className="tb-dest-c">{img ? <img src={img} alt="" loading="lazy" /> : <span className="tb-dest-todos"><Images size={24} /></span>}</span>
                    <span className="tb-dest-n">{c.nome}</span>
                  </button>
                );
              })}
            </div>
            {lista.length === 0 ? (
              <p className="tb-nada">Nenhum topo com “{busca.trim()}”{cat ? ` em ${cat.nome}` : ""}.</p>
            ) : (
              <div className="tb-grade">
                {daPagina.map(t => (
                  <button key={t.id} type="button" className="tb-it" onClick={() => setAberto(t)}>
                    <span className="tb-capa">{t.capa_url ? <img src={t.capa_mini_url || t.capa_url} alt="" loading="lazy" decoding="async" /> : <Images size={30} aria-hidden="true" />}</span>
                    <span className="tb-it-t">{t.titulo || "Topo de bolo"}</span>
                    <span className="tb-fmts">{[...new Set(t.arquivos.map(a => a.formato))].sort((x, y) => infoFormato(x).ordem - infoFormato(y).ordem).map(f => <em key={f}>{f}</em>)}{t.canva_url && <em>CANVA</em>}</span>
                  </button>
                ))}
              </div>
            )}
            {totalPaginas > 1 && (
              <nav className="tb-pags" aria-label="Páginas">
                <button type="button" disabled={pag === 1} onClick={() => irPagina(pag - 1)} aria-label="Página anterior"><CaretLeft size={16} weight="bold" /></button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPaginas || Math.abs(n - pag) <= 1)
                  .map((n, i, arr) => (
                    <span key={n} className="tb-pag-g">
                      {i > 0 && n - arr[i - 1] > 1 && <span className="tb-pag-r" aria-hidden="true">…</span>}
                      <button type="button" className={n === pag ? "on" : ""} aria-current={n === pag ? "page" : undefined} onClick={() => irPagina(n)}>{n}</button>
                    </span>
                  ))}
                <button type="button" disabled={pag === totalPaginas} onClick={() => irPagina(pag + 1)} aria-label="Próxima página"><CaretRight size={16} weight="bold" /></button>
              </nav>
            )}
          </>
        )}
      </div>

      <Janela aberta={!!aberto} aoFechar={() => setAberto(null)} tipo="conteudo" titulo={aberto?.titulo || "Topo de bolo"} className="tb-janela">
        {aberto && (
          <div className="tb-det">
            <div className="tb-det-capa">{aberto.capa_url ? <img src={aberto.capa_url} alt={aberto.titulo} /> : <Images size={40} aria-hidden="true" />}</div>
            <div className="tb-det-arqs">
              {/* (09/11) "Downloads disponíveis": PDF, PNG, Studio e, se tiver, o Canva (abre o modelo; só PRO) */}
              <p className="tb-det-l">Downloads disponíveis</p>
              {aberto.arquivos.length === 0 && !aberto.canva_url ? <p className="tb-det-vz">Nenhum arquivo neste topo ainda.</p> : (
                <>
                  {[...aberto.arquivos].sort((x, y) => infoFormato(x.formato).ordem - infoFormato(y.formato).ordem).map(a => {
                    const f = infoFormato(a.formato);
                    return (
                      <div key={a.caminho} className="tb-dl">
                        <span className="tb-dl-ic" style={{ background: f.cor }}>{a.formato === "STUDIO" ? "STUDIO" : a.formato}</span>
                        <span className="tb-dl-tx"><b>{f.nome}</b><small>{f.frase}<span className="tb-dl-kb"> · {tamanhoTexto(a.tamanho)}</span></small></span>
                        <Botao tamanho="p" className="tb-baixar" variante={isPro ? "principal" : "suave"} carregando={baixando === a.caminho}
                          icone={isPro ? <DownloadSimple size={16} weight="bold" /> : <Crown size={14} weight="fill" />} onClick={() => baixar(a)}>Baixar</Botao>
                      </div>
                    );
                  })}
                  {aberto.canva_url && (
                    <div className="tb-dl">
                      <span className="tb-dl-ic tb-dl-ic--canva">Canva</span>
                      <span className="tb-dl-tx"><b>Editar no Canva</b><small>Troque nome e idade</small></span>
                      <Botao tamanho="p" className="tb-baixar tb-abrir" variante={isPro ? "secundario" : "suave"}
                        icone={isPro ? undefined : <Crown size={14} weight="fill" />} iconeDepois={isPro ? <ArrowSquareOut size={15} weight="bold" /> : undefined}
                        onClick={() => { if (!isPro) { setAberto(null); setConvite(true); return; } window.open(aberto.canva_url!, "_blank", "noopener"); }}>Abrir</Botao>
                    </div>
                  )}
                </>
              )}
              <button type="button" className="tb-compart" onClick={() => compartilhar(aberto)}><ShareNetwork size={18} weight="regular" />Compartilhar</button>
              {!isPro && (aberto.arquivos.length > 0 || aberto.canva_url) && <p className="tb-det-pro"><Crown size={14} weight="fill" aria-hidden="true" />Baixar os topos é um recurso do PRO</p>}
            </div>
          </div>
        )}
      </Janela>
      {convite && <ConvitePro recurso="topos" onClose={() => setConvite(false)} />}
    </>
  );
}
