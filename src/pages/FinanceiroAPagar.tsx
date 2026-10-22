import CampoData from '@/components/CampoData'
import { useAbrirPedido } from "@/hooks/useAbrirPedido";
import { useTravarRolagem } from "@/hooks/useTravarRolagem";
import { useAoVoltar, useDiaAtual } from "@/hooks/useAoVoltar";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import Folha from "@/components/financeiro/Folha";
import { useNavigate } from "react-router-dom";
import { CalendarBlank, CheckCircle, Plus, Receipt, WarningCircle, X } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { supabase } from "@/lib/supabase";
import { buscarTudo } from "@/lib/buscarTudo";
import { erroDeConexao } from "@/lib/erros";
import { faltaNoBanco } from "@/lib/pagamentos";
import { Botao, BotaoIcone, TelaVazia, confirmar, avisar as avisarBase } from "@/components/base";

/**
 * Financeiro · Passo 5 (03/10) — Contas a pagar.
 * A conta não mexe no caixa até usar "Pagar": aí a função do banco contas_pagar_pagar()
 * lança a saída no financeiro e marca a conta como paga, tudo junto.
 * Custos fixos com dia de vencimento viram uma conta por mês (este mês e o próximo).
 */
export type Conta = {
  id: string; descricao: string; categoria: string | null; valor: number; vencimento: string;
  status: "pendente" | "paga" | "cancelada"; pago_em: string | null; valor_pago: number | null; custo_fixo_id: string | null;
};

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isoDia = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const competencia = (mais = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + mais); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const diasAte = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); const h = new Date(); return Math.round((new Date(y, m - 1, d).getTime() - new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime()) / 86400000); };
const dataCurta = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", ""); };
const quando = (d: number) => d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : d > 1 ? `em ${d} dias` : d === -1 ? "venceu ontem" : `venceu há ${-d} dias`;
const num = (s: string) => Math.round((parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;
/** A função do banco ainda não existe (SQL do Passo 5 não rodado)? Aí não é falha: a tela já avisa que falta o SQL. */
const funcaoNaoExiste = (e: unknown) => ["PGRST202", "42883"].includes(String((e as { code?: unknown } | null)?.code || "")) || faltaNoBanco(e);
const FORMAS = [{ k: "pix", l: "Pix" }, { k: "dinheiro", l: "Dinheiro" }, { k: "credito", l: "Crédito" }, { k: "debito", l: "Débito" }, { k: "boleto", l: "Boleto" }];
type Filtro = "atrasadas" | "semana" | "mes" | "todas";
const FILTROS: [Filtro, string, string][] = [["atrasadas", "Atrasadas", "Atrasadas"], ["semana", "Esta semana", "Semana"], ["mes", "Este mês", "Mês"], ["todas", "Todas", "Todas"]];
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const CATEGORIAS = ["Insumos", "Embalagens", "Aluguel", "Energia e água", "Internet", "Gás", "Transporte", "Marketing", "Equipamentos", "Outros"];

export default function FinanceiroAPagar() {
  const navigate = useNavigate();
  const [contas, setContas] = useState<Conta[]>([]);
  const [pagasMes, setPagasMes] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [precisaSql, setPrecisaSql] = useState(false);
  const [erro, setErro] = useState(false); // não deu pra carregar (10/10)
  const [pagar, setPagar] = useState<Conta | null>(null);
  // (16/10) veio do "Ver"/"Pagar" do Seus próximos passos: abre a janela de pagar aquela conta
  useAbrirPedido(!carregando && contas.length > 0, p => { const id = p.startsWith("pagar:") ? p.slice(6) : ""; const c = contas.find(x => x.id === id); if (c) setPagar(c); });
  const [nova, setNova] = useState(false);

  const numBusca = useRef(0); // 10/10: só vale a resposta da última busca
  const avisouGerar = useRef(false);
  const carregouBem = useRef(false);
  const carregar = useCallback(async (semPiscar?: unknown) => {
    const n = ++numBusca.current;
    // (11/10) atualização por trás (ao voltar pro app) que falha mantém a lista que já está na tela
    const quieto = semPiscar === true && carregouBem.current;
    try {
      const { data: { user }, error: eUser } = await supabase.auth.getUser();
      if (n !== numBusca.current) return;
      if (!user) { if (erroDeConexao(eUser) && !quieto) { setErro(true); setCarregando(false); } return; }
      // contas do mês (e do próximo) a partir dos custos fixos — não duplica
      // 11/10: o rpc não lança, devolve { error } (o .catch de antes nunca disparava e a falha passava calada)
      const geradas = await Promise.all([supabase.rpc("contas_pagar_gerar_mes", { p_competencia: competencia(0) }), supabase.rpc("contas_pagar_gerar_mes", { p_competencia: competencia(1) })])
        .catch(e => [{ error: e }]);
      const eGerar = geradas.map(r => r.error).find(e => e && !funcaoNaoExiste(e));
      // 10/10: só as contas dela (antes dependia só da regra de segurança do banco) e de 1.000 em 1.000
      // (o Supabase corta em 1.000 linhas sem avisar; pela ordem do vencimento, as cortadas seriam as mais novas)
      const { data, error } = await buscarTudo<Conta>((de, ate) => supabase.from("contas_pagar")
        .select("id, descricao, categoria, valor, vencimento, status, pago_em, valor_pago, custo_fixo_id")
        .eq("user_id", user.id).in("status", ["pendente", "paga"]).order("vencimento", { ascending: true }).order("id").range(de, ate));
      if (n !== numBusca.current) return;
      // 10/10: "falta o SQL" só quando a tabela não existe mesmo; internet ou outro erro vira "Não deu pra carregar"
      if (error) { if (quieto) return; if (faltaNoBanco(error)) setPrecisaSql(true); else setErro(true); setCarregando(false); return; }
      carregouBem.current = true;
      const ini = `${competencia(0)}-01`;
      setErro(false);
      // (13/10) conta fixa aparece uma vez só: a próxima que vence (antes a do mês que vem aparecia junto, parecendo repetida)
      const pend = data.filter(c => c.status === "pendente");
      const vistas = new Set<string>();
      setContas(pend.filter(c => { if (!c.custo_fixo_id) return true; if (vistas.has(c.custo_fixo_id)) return false; vistas.add(c.custo_fixo_id); return true; }));
      setPagasMes(data.filter(c => c.status === "paga" && (c.pago_em || "") >= ini).sort((a, b) => (b.pago_em || "").localeCompare(a.pago_em || "")));
      // a lista carregou, mas a geração das contas dos custos fixos falhou: avisa (uma vez por visita à tela)
      if (eGerar && !avisouGerar.current) {
        avisouGerar.current = true;
        console.error("[a pagar] não gerei as contas fixas do mês:", eGerar);
        avisarBase("As contas fixas deste mês podem não ter sido criadas. Abra a tela de novo daqui a pouco.", { tipo: "info", duracao: 6000 });
      }
    } catch (e) {
      console.error("[a pagar] não consegui carregar:", e);
      if (n !== numBusca.current || quieto) return;
      setErro(true);
    }
    setCarregando(false);
  }, []);
  // 11/10: app aberto de um dia pro outro. Virou o dia ou a pessoa voltou pro app: busca de novo
  // (gera as contas do mês novo) e refaz "vencidas / próximos 7 dias" com o dia de agora.
  const hoje = useDiaAtual();
  useEffect(() => { carregar(); }, [carregar, hoje]);
  useAoVoltar(() => { carregar(true); });
  const tentarDeNovo = () => { setCarregando(true); setErro(false); carregar(); };

  // (13/10) filtro por dias: Atrasadas, Esta semana, Este mês e Todas
  const [filtro, setFiltro] = useState<Filtro>("mes");
  const fimMes = useMemo(() => { const d = new Date(); return `${competencia(0)}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, "0")}`; }, [hoje]); // eslint-disable-line react-hooks/exhaustive-deps
  const doFiltro = useCallback((f: Filtro) => contas.filter(c =>
    f === "atrasadas" ? c.vencimento < hoje : f === "semana" ? c.vencimento <= isoDia(6) : f === "mes" ? c.vencimento <= fimMes : true), [contas, hoje, fimMes]);
  const visiveis = doFiltro(filtro);
  const grupos = useMemo(() => ({
    vencidas: visiveis.filter(c => c.vencimento < hoje),
    aVencer: visiveis.filter(c => c.vencimento >= hoje),
  }), [visiveis, hoje]);
  const soma = (l: Conta[]) => l.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const total = soma(contas);
  const avisar = (m: string) => avisarBase(m, { tipo: /^Não /.test(m) ? "erro" : "ok" });

  const cancelar = async (c: Conta) => {
    if (!(await confirmar({ titulo: `Cancelar a conta "${c.descricao}"?`, texto: "Ela sai da lista e não entra no financeiro.", rotulo: "Cancelar a conta", rotuloVoltar: "Voltar", perigo: true, icone: "alerta" }))) return;
    const { error } = await supabase.from("contas_pagar").update({ status: "cancelada" }).eq("id", c.id);
    if (error) { avisar("Não foi possível cancelar agora."); return; }
    avisar("Conta cancelada."); carregar();
  };

  return (
    <div className="fap-root">
      <AppPageHeader
        title="A pagar"
        subtitle={carregando ? "Carregando…" : erro ? "Não deu pra carregar" : contas.length ? `${brl(total)} em ${contas.length} ${contas.length === 1 ? "conta" : "contas"}` : "Nenhuma conta pendente"}
        onBack={() => navigate("/financeiro")}
        infoIcon="🧾"
        infoContent={<>
          <p>Aqui ficam as <strong>contas que você ainda vai pagar</strong>, com o vencimento. Elas <strong>não saem do caixa</strong> até você usar <strong>Pagar</strong>.</p>
          <p>Os <strong>custos fixos com dia de vencimento</strong> (aluguel, internet…) viram uma conta aqui todo mês, sozinhos.</p>
        </>}
      />
      <EstiloFinanceiro />

      <div className="fap-wrap">
        {precisaSql ? (
          <div className="fap-vazio"><b>Falta um ajuste no banco</b><p>Rode o SQL do Passo 5 (contas a pagar) no Supabase pra ativar esta tela.</p></div>
        ) : erro && !carregando ? (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu pra carregar as contas" texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={tentarDeNovo}>Tentar de novo</Botao>} />
        ) : (<>
          <div className="fap-topo">
            <div className="tx-seg fap-seg" role="tablist" aria-label="Mostrar contas">
              {FILTROS.map(([k, l, c]) => {
                const n = doFiltro(k).length;
                return (
                  <button key={k} type="button" role="tab" aria-selected={filtro === k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>
                    <span className="fap-l-g">{l}</span><span className="fap-l-c">{c}</span>{n > 0 && <i className={k === "atrasadas" ? "atr" : ""}>{n}</i>}
                  </button>
                );
              })}
            </div>
            <Botao icone={<Plus size={18} weight="bold" />} onClick={() => setNova(true)} className="fap-nova-bt">Nova conta</Botao>
          </div>

          {carregando && <p className="fap-carregando">Carregando…</p>}
          {!carregando && contas.length === 0 && (
            <div className="fap-vazio">
              <span className="fap-vazio-ic"><CheckCircle size={34} weight="duotone" /></span>
              <b>Nenhuma conta a pagar</b>
              <p>Cadastre as contas com vencimento. As que se repetem todo mês aparecem aqui sozinhas.</p>
            </div>
          )}
          {!carregando && contas.length > 0 && visiveis.length === 0 && (
            <div className="fap-vazio fap-vazio--p">
              <b>{filtro === "atrasadas" ? "Nenhuma conta atrasada" : filtro === "semana" ? "Nada vence esta semana" : "Nada vence este mês"}</b>
              <p><button type="button" className="fap-link" onClick={() => setFiltro("todas")}>Ver todas as contas</button></p>
            </div>
          )}

          {([["Atrasadas", grupos.vencidas], ["A vencer", grupos.aVencer]] as [string, Conta[]][])
            .filter(([, l]) => l.length > 0)
            .map(([titulo, lista]) => (
              <section key={titulo}>
                <p className="fap-gt">{titulo} <span>· {brl(soma(lista))}</span></p>
                <div className="fap-lista">
                  {lista.map(c => { const d = diasAte(c.vencimento); return (
                    <div key={c.id} className={`fap-it${d < 0 ? " fap-it--atr" : ""}`}>
                      <div className="fap-it-d" aria-hidden="true"><b>{c.vencimento.slice(8, 10)}</b><small>{MES_CURTO[Number(c.vencimento.slice(5, 7)) - 1]}</small></div>
                      <div className="fap-it-m">
                        <b>{c.descricao}</b>
                        <small><span className={d < 0 ? "atr" : d <= 1 ? "logo" : ""}>{quando(d)}</span> · {c.custo_fixo_id ? "todo mês" : (c.categoria === "Insumos" ? "Ingredientes" : (c.categoria || "Conta"))}</small>
                      </div>
                      <b className="fap-it-v">{brl(c.valor)}</b>
                      <div className="fap-bts">
                        <BotaoIcone rotulo="Cancelar conta" tamanho="p" onClick={() => cancelar(c)}><X size={16} weight="bold" /></BotaoIcone>
                        <Botao tamanho="p" onClick={() => setPagar(c)}>Pagar</Botao>
                      </div>
                    </div>
                  ); })}
                </div>
              </section>
            ))}

          {pagasMes.length > 0 && (
            <section>
              <p className="fap-gt">Pagas este mês <span>· {brl(pagasMes.reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor) || 0), 0))}</span></p>
              <div className="fap-pagas">
                {pagasMes.map(c => (
                  <div key={c.id} className="fap-pg"><Receipt size={16} /><span>{c.descricao}</span><em>{c.pago_em ? dataCurta(c.pago_em) : ""}</em><b>{brl(Number(c.valor_pago) || c.valor)}</b></div>
                ))}
              </div>
            </section>
          )}
        </>)}
      </div>

      {pagar && <PagarSheet conta={pagar} onClose={() => setPagar(null)} onFeito={(doCaixa) => { setPagar(null); avisar(doCaixa ? "Conta paga. A saída entrou no financeiro." : "Conta marcada como paga. O caixa não mudou."); carregar(); }} />}
      {nova && <NovaContaSheet onClose={() => setNova(false)} onFeito={(fixa) => { setNova(false); avisar(fixa ? "Conta fixa cadastrada. Ela aparece aqui todo mês." : "Conta cadastrada."); carregar(); }} />}
      <style>{CSS}</style>
    </div>
  );
}

export function PagarSheet({ conta, onClose, onFeito }: { conta: Conta; onClose: () => void; onFeito: (doCaixa: boolean) => void }) {
  const [valor, setValor] = useState(textoBRL(conta.valor));
  // (13/10) o dinheiro pode não ter saído do caixa da loja (outra pessoa pagou): aí só marca a conta como paga
  const [doCaixa, setDoCaixa] = useState(true);
  const [forma, setForma] = useState("pix");
  const [quandoPg, setQuandoPg] = useState<"hoje" | "ontem" | "outra">("hoje");
  const [outra, setOutra] = useState(isoDia());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const confirmar = async () => {
    const v = num(valor);
    if (v <= 0) { setErro("Digite quanto você pagou"); return; }
    const data = quandoPg === "hoje" ? isoDia() : quandoPg === "ontem" ? isoDia(-1) : outra;
    if (!data || data > isoDia()) { setErro("Escolha uma data até hoje"); return; }
    setSalvando(true); setErro("");
    if (!doCaixa) {
      const { data: feita, error } = await supabase.from("contas_pagar").update({ status: "paga", pago_em: data, valor_pago: v })
        .eq("id", conta.id).eq("status", "pendente").select("id");
      setSalvando(false);
      if (error) { setErro("Não foi possível marcar agora. Confira a internet e tente de novo."); return; }
      if (!feita?.length) { setErro("Essa conta já foi paga."); return; }
      onFeito(false); return;
    }
    const { error } = await supabase.rpc("contas_pagar_pagar", { p_id: conta.id, p_valor: v, p_data: data, p_forma: forma });
    setSalvando(false);
    if (error) { setErro(/não está mais a pagar/i.test(error.message) ? "Essa conta já foi paga." : "Não foi possível pagar agora. Confira a internet e tente de novo."); return; }
    onFeito(true);
  };
  return (
    <Folha titulo={`Pagar · ${conta.descricao}`} sub={`Vence ${dataCurta(conta.vencimento)} · ${brl(conta.valor)}`} onClose={onClose} umaAcao
      acoes={<Botao cheio carregando={salvando} onClick={confirmar}>{doCaixa ? "Confirmar pagamento" : "Marcar como paga"}</Botao>}>
      <p className="fo-lb">De onde saiu o dinheiro?</p>
      <div className="fo-seg"><button type="button" className={doCaixa ? "on" : ""} onClick={() => setDoCaixa(true)}>Do caixa da loja</button><button type="button" className={!doCaixa ? "on" : ""} onClick={() => setDoCaixa(false)}>Outra pessoa pagou</button></div>
      <label className="fo-lb" htmlFor="fap-v">Quanto foi pago?</label>
      <div className="fo-in"><span>R$</span><input id="fap-v" inputMode="numeric" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div>
      {doCaixa && <p className="fo-lb">Forma de pagamento</p>}
      {doCaixa && <div className="fo-chips">{FORMAS.map(f => <button type="button" key={f.k} className={forma === f.k ? "on" : ""} onClick={() => setForma(f.k)}>{f.l}</button>)}</div>}
      <p className="fo-lb">Quando pagou?</p>
      <div className="fo-chips">{(["hoje", "ontem", "outra"] as const).map(q => <button type="button" key={q} className={quandoPg === q ? "on" : ""} onClick={() => setQuandoPg(q)}>{q === "hoje" ? "Hoje" : q === "ontem" ? "Ontem" : "Outra data"}</button>)}</div>
      {quandoPg === "outra" && <div style={{ marginTop: 8 }}><CampoData valor={outra} onChange={setOutra} max={isoDia()} titulo="Data do pagamento" /></div>}
      {doCaixa
        ? <div className="fap-prev"><b>Sai do caixa: {brl(num(valor))}</b><small>A saída entra no financeiro na data do pagamento.</small></div>
        : <div className="fap-prev fap-prev--neutro"><b>O caixa não muda</b><small>A conta fica como paga e não entra saída no financeiro.</small></div>}
      {erro && <p className="fo-erro">{erro}</p>}
    </Folha>
  );
}

function NovaContaSheet({ onClose, onFeito }: { onClose: () => void; onFeito: (fixa: boolean) => void }) {
  // (13/10) conta fixa (todo mês) vira um custo fixo da conta, com o dia de vencimento: aparece aqui sozinha todo mês
  const [fixa, setFixa] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Insumos");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(isoDia(7));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const salvar = async () => {
    const v = num(valor);
    if (!descricao.trim()) { setErro("Dê um nome pra conta (ex.: Fornecedor de chocolate)"); return; }
    if (v <= 0) { setErro("Digite o valor"); return; }
    if (!vencimento) { setErro("Escolha o vencimento"); return; }
    setSalvando(true); setErro("");
    const { data: { user } } = await supabase.auth.getUser();
    if (fixa) {
      const dia = Number(vencimento.slice(8, 10));
      const { error } = await supabase.from("custos_fixos").insert({ user_id: user?.id, nome: descricao.trim(), valor: v, ativo: true, dia_vencimento: dia });
      setSalvando(false);
      if (error) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
      onFeito(true); return;
    }
    const { error } = await supabase.from("contas_pagar").insert({ user_id: user?.id, descricao: descricao.trim(), categoria, valor: v, vencimento });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onFeito(false);
  };
  return (
    <Folha titulo="Nova conta a pagar" sub="Ela só sai do caixa quando você pagar" onClose={onClose} umaAcao
      acoes={<Botao cheio carregando={salvando} onClick={salvar}>{fixa ? "Cadastrar conta fixa" : "Cadastrar conta"}</Botao>}>
      <p className="fo-lb">Essa conta se repete todo mês?</p>
      <div className="fo-seg"><button type="button" className={!fixa ? "on" : ""} onClick={() => setFixa(false)}>Só esta vez</button><button type="button" className={fixa ? "on" : ""} onClick={() => setFixa(true)}>Todo mês</button></div>
      {fixa && <div className="fo-dica">Ela fica nos seus custos fixos e aparece aqui todo mês, no mesmo dia.</div>}
      <label className="fo-lb" htmlFor="fap-d">Conta</label>
      <input id="fap-d" className="fo-txt" placeholder="Ex.: Fornecedor de chocolate" value={descricao} onChange={e => { setDescricao(e.target.value); setErro(""); }} />
      {!fixa && <p className="fo-lb">Categoria</p>}
      {!fixa && <div className="fo-chips">{CATEGORIAS.map(c => <button type="button" key={c} className={categoria === c ? "on" : ""} onClick={() => setCategoria(c)}>{c === "Insumos" ? "Ingredientes" : c}</button>)}</div>}
      <div className="fo-row">
        <div><label className="fo-lb" htmlFor="fap-nv">Valor</label><div className="fo-in sm"><span>R$</span><input id="fap-nv" inputMode="numeric" placeholder="0,00" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div></div>
        <div><label className="fo-lb" htmlFor="fap-venc">{fixa ? "Próximo vencimento" : "Vencimento"}</label><CampoData id="fap-venc" valor={vencimento} onChange={setVencimento} titulo="Vencimento" curto /></div>
      </div>
      {erro && <p className="fo-erro">{erro}</p>}
    </Folha>
  );
}

const CSS = `
  .fap-root { font-family: var(--font-base); }
  /* (13/10) topo: filtro por dias + nova conta */
  .fap-topo { display: flex; flex-direction: column; gap: 10px; }
  @media (min-width: 900px) { .fap-topo { flex-direction: row; align-items: center; justify-content: space-between; } .fap-seg { flex: 0 1 560px; } }
  .tx-seg { display: flex; background: #EFE9EC; border-radius: var(--ui-raio); padding: 3px; }
  .tx-seg button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; min-height: 44px; border: none; background: none; border-radius: var(--ui-raio-p); padding: 8px 6px; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); cursor: pointer; white-space: nowrap; }
  .tx-seg button.on { background: var(--ui-branco); color: var(--ui-texto); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .fap-seg i { font-style: normal; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #E3D9DE; color: var(--ui-texto-2); font-size: 11px; font-weight: 700; line-height: 18px; }
  .fap-seg i.atr { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); }
  .fap-l-c { display: none; }
  @media (max-width: 599px) { .fap-l-g { display: none; } .fap-l-c { display: inline; } }
  .fap-nova-bt { flex: none; }
  @media (max-width: 899px) { .fap-nova-bt { width: 100%; } }
  .fap-vazio--p { padding: 22px 16px; } .fap-vazio--p b { margin-top: 0; }
  .fap-it { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: "d m v" "d m b"; align-items: center; column-gap: 12px; row-gap: 8px; }
  .fap-it-d { grid-area: d; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 52px; height: 56px; border-radius: var(--ui-raio); background: var(--ui-cinza); }
  .fap-it-d b { font-size: 19px; font-weight: 700; line-height: 1; color: var(--ui-texto); } .fap-it-d small { font-size: 12px; color: var(--ui-texto-2); margin-top: 3px; }
  .fap-it--atr .fap-it-d { background: var(--ui-vermelho-fundo); } .fap-it--atr .fap-it-d b, .fap-it--atr .fap-it-d small { color: var(--ui-vermelho); }
  .fap-it-m { grid-area: m; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .fap-it-m b { font-size: 15px; font-weight: 600; color: var(--ui-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fap-it-m small { font-size: 13px; color: var(--ui-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fap-it-m small .atr { color: var(--ui-vermelho); font-weight: 600; } .fap-it-m small .logo { color: #B45309; font-weight: 600; }
  .fap-it > .fap-it-v { grid-area: v; justify-self: end; font-size: 15.5px; font-weight: 700; color: var(--ui-texto); white-space: nowrap; }
  .fap-it > .fap-bts { grid-area: b; justify-self: end; display: flex; align-items: center; gap: 6px; }
  .fap-prev.fap-prev--neutro { background: var(--ui-cinza); border-color: var(--ui-borda); } .fap-prev.fap-prev--neutro b, .fap-prev.fap-prev--neutro small { color: var(--ui-texto-2); }
  /* 10/10: mesma largura de conteúdo de Transações (antes 760px, numa coluna estreita no PC) */
  .fap-wrap { max-width: 980px; margin: 0 auto; padding: 22px 0 96px; display: flex; flex-direction: column; gap: 20px; }
  .fap-nova { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; border: 1.5px dashed #F3C9DA; background: #FFF6F9; color: var(--ui-rosa-escuro); border-radius: var(--ui-raio); padding: 11px 14px; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
  .fap-resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .fap-k { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 12px 10px; min-width: 0; container-type: inline-size; }
  .fap-k small { display: block; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .fap-k b { display: block; font-size: clamp(13.5px, 3.9vw, 17px); letter-spacing: -.02em; font-weight: 700; color: var(--ui-texto); margin: 3px 0 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* 11/10: o valor cabe inteiro, igual em A receber (a letra encolhe até o maior dos 3 valores caber no cartão) */
  .fap-k b { font-size: max(10px, min(clamp(13.5px, 3.9vw, 17px), calc(100cqi / (var(--fap-n, 11) * .57)))); }
  .fap-k i { font-style: normal; font-size: 13px; color: #888780; }
  .fap-k--atr { border-color: #FECACA; background: #FFF7F7; } .fap-k--atr b { color: var(--ui-vermelho); }
  .fap-k--zero b { color: var(--ui-texto-3); }
  .fap-carregando { text-align: center; color: var(--ui-texto-3); font-size: 14px; padding: 30px 0; }
  .fap-vazio { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 28px 20px; text-align: center; }
  .fap-vazio-ic { width: 64px; height: 64px; border-radius: 20px; background: #F0FDF4; color: #16A34A; display: inline-flex; align-items: center; justify-content: center; }
  .fap-vazio b { display: block; font-size: 17px; font-weight: 700; color: var(--ui-texto); margin-top: 12px; }
  .fap-vazio p { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 6px auto 0; max-width: 380px; text-wrap: balance; }
  .fap-link { border: none; background: none; padding: 0; font: inherit; color: var(--ui-rosa-escuro); font-weight: 700; cursor: pointer; text-decoration: underline; }
  .fap-gt { margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); } .fap-gt span { color: var(--ui-texto-2); }
  .fap-lista { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; }
  @media (min-width: 900px) { .fap-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .fap-it { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 14px; }
  .fap-it-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .fap-it-h b { font-size: 14.5px; font-weight: 700; color: var(--ui-texto); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fap-tg { flex-shrink: 0; font-size: 12px; font-weight: 700; color: #92400E; background: var(--ui-laranja-fundo); padding: 3px 8px; border-radius: 7px; }
  .fap-tg--atr { color: var(--ui-vermelho-escuro); background: var(--ui-vermelho-fundo); }
  .fap-it-v { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 6px; }
  .fap-it-v small { font-size: 12.5px; color: #888780; } .fap-it-v b { font-size: 15.5px; font-weight: 700; color: var(--ui-vermelho); white-space: nowrap; }
  .fap-it-a { display: flex; justify-content: space-between; align-items: center; margin-top: 11px; gap: 8px; }
  .fap-it-a > span { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--ui-texto-2); }
  .fap-bts { display: flex; gap: 6px; }
  .fap-canc { width: 44px; height: 44px; flex-shrink: 0; border-radius: var(--ui-raio-p); border: 1.5px solid var(--ui-borda-campo); background: var(--ui-branco); color: var(--ui-texto-3); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .fap-pag { border: none; border-radius: var(--ui-raio-p); padding: 0 16px; height: 44px; background: var(--ui-vinho-escuro); color: var(--ui-branco); font-family: inherit; font-weight: 700; font-size: 13.5px; cursor: pointer; }
  .fap-pagas { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 4px 14px; }
  .fap-pg { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-top: 1px solid var(--ui-linha); font-size: 13.5px; color: var(--ui-cinza-texto); }
  .fap-pg:first-child { border-top: none; } .fap-pg svg { color: var(--ui-verde); flex-shrink: 0; }
  .fap-pg span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .fap-pg em { font-style: normal; font-size: 12px; color: var(--ui-texto-3); } .fap-pg b { font-weight: 700; color: var(--ui-texto); }
  .fap-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
  @media (min-width: 768px) { .fap-ov { align-items: center; } }
  .fap-sh { width: 100%; max-width: 460px; background: var(--ui-branco); border-radius: var(--ui-raio-janela) var(--ui-raio-janela) 0 0; padding: 10px 18px calc(20px + env(safe-area-inset-bottom, 0px)); max-height: 92dvh; overflow-y: auto; color: var(--ui-texto); }
  @media (min-width: 768px) { .fap-sh { border-radius: 22px; } }
  .fap-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
  .fap-sh-t { display: block; font-size: 19px; font-weight: 700; } .fap-sh-s { display: block; font-size: 13px; color: var(--ui-texto-2); margin-top: 2px; }
  .fap-lb { display: block; font-size: 13px; font-weight: 700; color: var(--ui-cinza-texto); margin: 14px 0 6px; }
  .fap-in { display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--ui-rosa); border-radius: var(--ui-raio); padding: 0 12px; height: 52px; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .fap-in.sm { height: 46px; border-color: var(--ui-borda-campo); box-shadow: none; }
  .fap-in span { font-size: 17px; color: var(--ui-texto-2); font-weight: 700; }
  .fap-in input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 21px; font-weight: 700; color: var(--ui-texto); background: none; } .fap-in.sm input { font-size: 17px; }
  .fap-txt { width: 100%; box-sizing: border-box; height: 48px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 0 12px; font-family: inherit; font-size: 16px; color: var(--ui-texto); }
  .fap-txt:focus { outline: none; border-color: var(--ui-rosa); }
  .fap-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .fap-chips button { border: 1.5px solid var(--ui-borda-campo); background: var(--ui-branco); border-radius: var(--ui-raio-p); padding: 8px 12px; font-family: inherit; font-size: 13px; font-weight: 700; color: var(--ui-texto); cursor: pointer; }
  .fap-chips button.on { border-color: var(--ui-rosa); background: #FFF1F6; color: var(--ui-rosa-escuro); }
  .fap-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  .fap-row > * { min-width: 0; } /* o campo de data vazava da janela (rolagem lateral) */
  .fap-data { margin-top: 8px; width: 100%; min-width: 0; max-width: 100%; -webkit-appearance: none; appearance: none; background: var(--ui-branco); color: var(--ui-texto); height: 46px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 0 10px; font-family: inherit; font-size: 15px; box-sizing: border-box; }
  .fap-prev { margin-top: 14px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: var(--ui-raio); padding: 10px 12px; }
  .fap-prev b { display: block; font-size: 14px; color: var(--ui-vermelho-escuro); } .fap-prev small { font-size: 13px; color: var(--ui-vermelho-escuro); }
  .fap-erro { margin: 10px 0 0; font-size: 13px; font-weight: 700; color: var(--ui-vermelho); }
  .fap-cta { margin-top: 16px; width: 100%; border: none; border-radius: var(--ui-raio-botao); padding: 15px; background: var(--ui-vinho-escuro); color: var(--ui-branco); font-family: inherit; font-size: 15.5px; font-weight: 700; cursor: pointer; }
  .fap-cta--rosa { background: var(--ui-rosa); box-shadow: 0 3px 0 var(--ui-rosa-escuro); }
  .fap-cta:disabled { opacity: .6; cursor: default; }
  .fap-toast { position: fixed; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1400; background: var(--ui-vinho-escuro); color: var(--ui-branco); padding: 12px 16px; border-radius: var(--ui-raio); font-size: 13.5px; font-weight: 700; box-shadow: 0 10px 26px rgba(0,0,0,.25); max-width: calc(100vw - 32px); }
`;
