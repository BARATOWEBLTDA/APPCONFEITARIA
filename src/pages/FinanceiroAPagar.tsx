import { useTravarRolagem } from "@/hooks/useTravarRolagem";
import { useCallback, useEffect, useMemo, useState } from "react";
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CalendarBlank, CheckCircle, Plus, Receipt, X } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { supabase } from "@/lib/supabase";

/**
 * Financeiro · Passo 5 (03/10) — Contas a pagar.
 * A conta não mexe no caixa até ela tocar em "Pagar": aí a função do banco contas_pagar_pagar()
 * lança a saída no financeiro e marca a conta como paga, tudo junto.
 * Custos fixos com dia de vencimento viram uma conta por mês (este mês e o próximo).
 */
type Conta = {
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
const FORMAS = [{ k: "pix", l: "Pix" }, { k: "dinheiro", l: "Dinheiro" }, { k: "credito", l: "Crédito" }, { k: "debito", l: "Débito" }, { k: "boleto", l: "Boleto" }];
const CATEGORIAS = ["Insumos", "Embalagens", "Aluguel", "Energia e água", "Internet", "Gás", "Transporte", "Marketing", "Equipamentos", "Outros"];

export default function FinanceiroAPagar() {
  const navigate = useNavigate();
  const [contas, setContas] = useState<Conta[]>([]);
  const [pagasMes, setPagasMes] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [precisaSql, setPrecisaSql] = useState(false);
  const [pagar, setPagar] = useState<Conta | null>(null);
  const [nova, setNova] = useState(false);
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    // contas do mês (e do próximo) a partir dos custos fixos — não duplica
    await Promise.all([supabase.rpc("contas_pagar_gerar_mes", { p_competencia: competencia(0) }), supabase.rpc("contas_pagar_gerar_mes", { p_competencia: competencia(1) })]).catch(() => {});
    const { data, error } = await supabase.from("contas_pagar")
      .select("id, descricao, categoria, valor, vencimento, status, pago_em, valor_pago, custo_fixo_id")
      .in("status", ["pendente", "paga"]).order("vencimento", { ascending: true });
    if (error) { setPrecisaSql(true); setCarregando(false); return; }
    const lista = (data as Conta[]) || [];
    const ini = `${competencia(0)}-01`;
    setContas(lista.filter(c => c.status === "pendente"));
    setPagasMes(lista.filter(c => c.status === "paga" && (c.pago_em || "") >= ini).sort((a, b) => (b.pago_em || "").localeCompare(a.pago_em || "")));
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const grupos = useMemo(() => {
    const hoje = isoDia(), em7 = isoDia(6);
    return {
      vencidas: contas.filter(c => c.vencimento < hoje),
      semana: contas.filter(c => c.vencimento >= hoje && c.vencimento <= em7),
      depois: contas.filter(c => c.vencimento > em7),
    };
  }, [contas]);
  const soma = (l: Conta[]) => l.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const total = soma(contas);
  const avisar = (m: string) => { setAviso(m); setTimeout(() => setAviso(""), 3500); };

  const cancelar = async (c: Conta) => {
    if (!window.confirm(`Cancelar a conta "${c.descricao}"? Ela sai da lista e não entra no financeiro.`)) return;
    const { error } = await supabase.from("contas_pagar").update({ status: "cancelada" }).eq("id", c.id);
    if (error) { avisar("Não foi possível cancelar agora."); return; }
    avisar("Conta cancelada."); carregar();
  };

  return (
    <div className="fap-root">
      <AppPageHeader
        title="A pagar"
        subtitle={carregando ? "Carregando…" : contas.length ? `${brl(total)} em ${contas.length} ${contas.length === 1 ? "conta" : "contas"}` : "Nenhuma conta pendente"}
        onBack={() => navigate("/financeiro")}
        infoIcon="🧾"
        infoContent={<>
          <p>Aqui ficam as <strong>contas que você ainda vai pagar</strong>, com o vencimento. Elas <strong>não saem do caixa</strong> até você tocar em <strong>Pagar</strong>.</p>
          <p>Os <strong>custos fixos com dia de vencimento</strong> (aluguel, internet…) viram uma conta aqui todo mês, sozinhos.</p>
        </>}
      />
      <EstiloFinanceiro />

      <div className="fap-wrap">
        {precisaSql ? (
          <div className="fap-vazio"><b>Falta um ajuste no banco</b><p>Rode o SQL do Passo 5 (contas a pagar) no Supabase pra ativar esta tela.</p></div>
        ) : (<>
          <button type="button" className="fap-nova" onClick={() => setNova(true)}><Plus size={17} weight="bold" />Nova conta a pagar</button>

          {!carregando && contas.length > 0 && (
            <div className="fap-resumo">
              <div className={`fap-k ${soma(grupos.vencidas) > 0 ? "fap-k--atr" : ""}`}><small>Vencidas</small><b>{brl(soma(grupos.vencidas))}</b><i>{grupos.vencidas.length} {grupos.vencidas.length === 1 ? "conta" : "contas"}</i></div>
              <div className="fap-k"><small>Próximos 7 dias</small><b>{brl(soma(grupos.semana))}</b><i>{grupos.semana.length} {grupos.semana.length === 1 ? "conta" : "contas"}</i></div>
              <div className="fap-k"><small>Depois</small><b>{brl(soma(grupos.depois))}</b><i>{grupos.depois.length} {grupos.depois.length === 1 ? "conta" : "contas"}</i></div>
            </div>
          )}

          {carregando && <p className="fap-carregando">Carregando…</p>}
          {!carregando && contas.length === 0 && (
            <div className="fap-vazio">
              <span className="fap-vazio-ic"><CheckCircle size={34} weight="duotone" /></span>
              <b>Nenhuma conta a pagar</b>
              <p>Cadastre as contas com vencimento, ou coloque o dia de vencimento nos seus <button type="button" className="fap-link" onClick={() => navigate("/custos")}>custos fixos</button> pra elas aparecerem aqui todo mês.</p>
            </div>
          )}

          {([["Vencidas", grupos.vencidas], ["Próximos 7 dias", grupos.semana], ["Depois", grupos.depois]] as [string, Conta[]][])
            .filter(([, l]) => l.length > 0)
            .map(([titulo, lista]) => (
              <section key={titulo}>
                <p className="fap-gt">{titulo} <span>· {brl(soma(lista))}</span></p>
                <div className="fap-lista">
                  {lista.map(c => { const d = diasAte(c.vencimento); return (
                    <div key={c.id} className="fap-it">
                      <div className="fap-it-h"><b>{c.descricao}</b><span className={`fap-tg ${d < 0 ? "fap-tg--atr" : ""}`}>{quando(d)}</span></div>
                      <div className="fap-it-v"><small>{c.custo_fixo_id ? "Custo fixo · todo mês" : (c.categoria || "Conta")}</small><b>{brl(c.valor)}</b></div>
                      <div className="fap-it-a">
                        <span><CalendarBlank size={15} />vence {dataCurta(c.vencimento)}</span>
                        <div className="fap-bts">
                          <button type="button" className="fap-canc" onClick={() => cancelar(c)} aria-label="Cancelar conta"><X size={15} weight="bold" /></button>
                          <button type="button" className="fap-pag" onClick={() => setPagar(c)}>Pagar</button>
                        </div>
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

      {pagar && <PagarSheet conta={pagar} onClose={() => setPagar(null)} onFeito={() => { setPagar(null); avisar("Conta paga. A saída entrou no financeiro."); carregar(); }} />}
      {nova && <NovaContaSheet onClose={() => setNova(false)} onFeito={() => { setNova(false); avisar("Conta cadastrada."); carregar(); }} />}
      {aviso && <div className="fap-toast" role="status">{aviso}</div>}
      <style>{CSS}</style>
    </div>
  );
}

function Folha({ titulo, sub, onClose, children }: { titulo: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  useTravarRolagem(true)
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [onClose]);
  return createPortal(
    <div className="fap-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="fap-sh" onClick={e => e.stopPropagation()}>
        <span className="fap-alca" aria-hidden="true" />
        <b className="fap-sh-t">{titulo}</b>{sub && <small className="fap-sh-s">{sub}</small>}
        {children}
      </div>
    </div>, document.body);
}

function PagarSheet({ conta, onClose, onFeito }: { conta: Conta; onClose: () => void; onFeito: () => void }) {
  const [valor, setValor] = useState(textoBRL(conta.valor));
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
    const { error } = await supabase.rpc("contas_pagar_pagar", { p_id: conta.id, p_valor: v, p_data: data, p_forma: forma });
    setSalvando(false);
    if (error) { setErro(/não está mais a pagar/i.test(error.message) ? "Essa conta já foi paga." : "Não foi possível pagar agora. Confira a internet e tente de novo."); return; }
    onFeito();
  };
  return (
    <Folha titulo={`Pagar · ${conta.descricao}`} sub={`Vence ${dataCurta(conta.vencimento)} · ${brl(conta.valor)}`} onClose={onClose}>
      <label className="fap-lb" htmlFor="fap-v">Quanto você pagou?</label>
      <div className="fap-in"><span>R$</span><input id="fap-v" inputMode="numeric" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div>
      <p className="fap-lb">Forma de pagamento</p>
      <div className="fap-chips">{FORMAS.map(f => <button type="button" key={f.k} className={forma === f.k ? "on" : ""} onClick={() => setForma(f.k)}>{f.l}</button>)}</div>
      <p className="fap-lb">Quando pagou?</p>
      <div className="fap-chips">{(["hoje", "ontem", "outra"] as const).map(q => <button type="button" key={q} className={quandoPg === q ? "on" : ""} onClick={() => setQuandoPg(q)}>{q === "hoje" ? "Hoje" : q === "ontem" ? "Ontem" : "Outra data"}</button>)}</div>
      {quandoPg === "outra" && <input type="date" className="fap-data" value={outra} max={isoDia()} onChange={e => setOutra(e.target.value)} />}
      <div className="fap-prev"><b>Sai do caixa: {brl(num(valor))}</b><small>A saída entra no financeiro na data do pagamento.</small></div>
      {erro && <p className="fap-erro">{erro}</p>}
      <button type="button" className="fap-cta" onClick={confirmar} disabled={salvando}>{salvando ? "Registrando…" : "Confirmar pagamento"}</button>
    </Folha>
  );
}

function NovaContaSheet({ onClose, onFeito }: { onClose: () => void; onFeito: () => void }) {
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
    const { error } = await supabase.from("contas_pagar").insert({ user_id: user?.id, descricao: descricao.trim(), categoria, valor: v, vencimento });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onFeito();
  };
  return (
    <Folha titulo="Nova conta a pagar" sub="Ela só sai do caixa quando você pagar" onClose={onClose}>
      <label className="fap-lb" htmlFor="fap-d">Conta</label>
      <input id="fap-d" className="fap-txt" placeholder="Ex.: Fornecedor de chocolate" value={descricao} onChange={e => { setDescricao(e.target.value); setErro(""); }} />
      <p className="fap-lb">Categoria</p>
      <div className="fap-chips">{CATEGORIAS.map(c => <button type="button" key={c} className={categoria === c ? "on" : ""} onClick={() => setCategoria(c)}>{c}</button>)}</div>
      <div className="fap-row">
        <div><label className="fap-lb" htmlFor="fap-nv">Valor</label><div className="fap-in sm"><span>R$</span><input id="fap-nv" inputMode="numeric" placeholder="0,00" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div></div>
        <div><label className="fap-lb" htmlFor="fap-venc">Vencimento</label><input id="fap-venc" type="date" className="fap-data" style={{ marginTop: 0 }} value={vencimento} onChange={e => setVencimento(e.target.value)} /></div>
      </div>
      {erro && <p className="fap-erro">{erro}</p>}
      <button type="button" className="fap-cta fap-cta--rosa" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar conta"}</button>
    </Folha>
  );
}

const CSS = `
  .fap-root { font-family: var(--font-base); }
  .fap-wrap { max-width: 760px; margin: 0 auto; padding: 22px 0 96px; display: flex; flex-direction: column; gap: 20px; }
  .fap-nova { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; border: 1.5px dashed #F3C9DA; background: #FFF6F9; color: #C33A6E; border-radius: 12px; padding: 11px 14px; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
  .fap-resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .fap-k { background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 12px 10px; min-width: 0; }
  .fap-k small { display: block; font-size: 11.5px; font-weight: 700; color: #9A8E94; }
  .fap-k b { display: block; font-size: clamp(13.5px, 3.9vw, 17px); letter-spacing: -.02em; font-weight: 900; color: #2C1219; margin: 3px 0 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fap-k i { font-style: normal; font-size: 11.5px; color: #888780; }
  .fap-k--atr { border-color: #FECACA; background: #FFF7F7; } .fap-k--atr b { color: #DC2626; }
  .fap-carregando { text-align: center; color: #9A8E94; font-size: 14px; padding: 30px 0; }
  .fap-vazio { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 28px 20px; text-align: center; }
  .fap-vazio-ic { width: 64px; height: 64px; border-radius: 20px; background: #F0FDF4; color: #16A34A; display: inline-flex; align-items: center; justify-content: center; }
  .fap-vazio b { display: block; font-size: 17px; font-weight: 900; color: #2C1219; margin-top: 12px; }
  .fap-vazio p { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 6px auto 0; max-width: 380px; text-wrap: balance; }
  .fap-link { border: none; background: none; padding: 0; font: inherit; color: #C33A6E; font-weight: 800; cursor: pointer; text-decoration: underline; }
  .fap-gt { margin: 0 0 8px; font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #9A8E94; } .fap-gt span { color: #6B5D64; }
  .fap-lista { display: flex; flex-direction: column; gap: 10px; }
  .fap-it { background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 14px; }
  .fap-it-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .fap-it-h b { font-size: 14.5px; font-weight: 800; color: #2C1219; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fap-tg { flex-shrink: 0; font-size: 11px; font-weight: 800; color: #92400E; background: #FEF3C7; padding: 3px 8px; border-radius: 7px; }
  .fap-tg--atr { color: #991B1B; background: #FEE2E2; }
  .fap-it-v { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 6px; }
  .fap-it-v small { font-size: 12.5px; color: #888780; } .fap-it-v b { font-size: 15.5px; font-weight: 900; color: #DC2626; white-space: nowrap; }
  .fap-it-a { display: flex; justify-content: space-between; align-items: center; margin-top: 11px; gap: 8px; }
  .fap-it-a > span { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: #6B5D64; }
  .fap-bts { display: flex; gap: 6px; }
  .fap-canc { width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid #EDE6E9; background: #fff; color: #9A8E94; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .fap-pag { border: none; border-radius: 10px; padding: 0 16px; height: 36px; background: #2C1219; color: #fff; font-family: inherit; font-weight: 800; font-size: 13.5px; cursor: pointer; }
  .fap-pagas { background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 4px 14px; }
  .fap-pg { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-top: 1px solid #F5F0F2; font-size: 13.5px; color: #4B3A42; }
  .fap-pg:first-child { border-top: none; } .fap-pg svg { color: #15803D; flex-shrink: 0; }
  .fap-pg span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .fap-pg em { font-style: normal; font-size: 12px; color: #9A8E94; } .fap-pg b { font-weight: 800; color: #2C1219; }
  .fap-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
  @media (min-width: 768px) { .fap-ov { align-items: center; } }
  .fap-sh { width: 100%; max-width: 460px; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 18px calc(20px + env(safe-area-inset-bottom, 0px)); max-height: 92dvh; overflow-y: auto; color: #2C1219; }
  @media (min-width: 768px) { .fap-sh { border-radius: 22px; } }
  .fap-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
  .fap-sh-t { display: block; font-size: 19px; font-weight: 900; } .fap-sh-s { display: block; font-size: 13px; color: #6B5D64; margin-top: 2px; }
  .fap-lb { display: block; font-size: 13px; font-weight: 700; color: #4B3A42; margin: 14px 0 6px; }
  .fap-in { display: flex; align-items: center; gap: 6px; border: 1.5px solid #E85A8C; border-radius: 12px; padding: 0 12px; height: 52px; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .fap-in.sm { height: 46px; border-color: #EDE6E9; box-shadow: none; }
  .fap-in span { font-size: 17px; color: #6B5D64; font-weight: 700; }
  .fap-in input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 21px; font-weight: 900; color: #2C1219; background: none; } .fap-in.sm input { font-size: 17px; }
  .fap-txt { width: 100%; box-sizing: border-box; height: 48px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 0 12px; font-family: inherit; font-size: 16px; color: #2C1219; }
  .fap-txt:focus { outline: none; border-color: #E85A8C; }
  .fap-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .fap-chips button { border: 1.5px solid #EDE6E9; background: #fff; border-radius: 10px; padding: 8px 12px; font-family: inherit; font-size: 13px; font-weight: 700; color: #2C1219; cursor: pointer; }
  .fap-chips button.on { border-color: #E85A8C; background: #FFF1F6; color: #C33A6E; }
  .fap-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  .fap-row > * { min-width: 0; } /* o campo de data vazava da janela (rolagem lateral) */
  .fap-data { margin-top: 8px; width: 100%; min-width: 0; max-width: 100%; -webkit-appearance: none; appearance: none; background: #fff; color: #2C1219; height: 46px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 0 10px; font-family: inherit; font-size: 15px; box-sizing: border-box; }
  .fap-prev { margin-top: 14px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 10px 12px; }
  .fap-prev b { display: block; font-size: 13.5px; color: #991B1B; } .fap-prev small { font-size: 12px; color: #991B1B; }
  .fap-erro { margin: 10px 0 0; font-size: 13px; font-weight: 800; color: #DC2626; }
  .fap-cta { margin-top: 16px; width: 100%; border: none; border-radius: 14px; padding: 15px; background: #2C1219; color: #fff; font-family: inherit; font-size: 15.5px; font-weight: 800; cursor: pointer; }
  .fap-cta--rosa { background: #E85A8C; box-shadow: 0 3px 0 #C33A6E; }
  .fap-cta:disabled { opacity: .6; cursor: default; }
  .fap-toast { position: fixed; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1400; background: #2C1219; color: #fff; padding: 12px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700; box-shadow: 0 10px 26px rgba(0,0,0,.25); max-width: calc(100vw - 32px); }
`;
