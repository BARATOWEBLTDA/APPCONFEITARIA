// Custos — refeita no padrão novo do financeiro (03/10). Mesma lógica de antes:
// custos fixos (com dia de vencimento → viram conta em "A pagar"), custos variáveis
// (% de cada venda ou R$ por pedido) e mão de obra (salário, horas e dias).
import { useAbrirPedido } from "@/hooks/useAbrirPedido";
import EstiloFinanceiro from "@/components/financeiro/EstiloFinanceiro";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import { parseNumBR } from "@/lib/numeroBR";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Buildings, Percent, Clock, Plus, CaretRight, Receipt, WarningCircle, CreditCard, Fire, PencilSimple } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_CUSTOS, TOUR_CUSTOS } from "@/lib/comoTelas";
import { Botao, TelaVazia } from "@/components/base";
import { erroDeConexao, explicarErro } from "@/lib/erros";
import Folha, { FOLHA_CSS } from "@/components/financeiro/Folha";
import { supabase } from "@/lib/supabase";

type CustoFixo = { id: string; nome: string; valor: number; ativo: boolean; dia_vencimento: number | null };
// (13/10) forma: em que vendas o custo entra (null = todas). A maquininha cobra diferente no crédito e no débito.
type FormaCusto = "credito" | "debito" | null;
type CustoVariavel = { id: string; nome: string; tipo: "percentual" | "fixo"; valor: number; ativo: boolean; forma?: FormaCusto };
const FORMA_TXT: Record<string, string> = { credito: "no crédito", debito: "no débito" };
/** Grava; se a coluna "forma" ainda não existir no banco (SQL 4.33 não rodado), grava sem ela */
async function gravarVariavel(id: string | null, uid: string, payload: Record<string, any>) {
  const ir = (dados: Record<string, any>) => id ? supabase.from("custos_variaveis").update(dados).eq("id", id) : supabase.from("custos_variaveis").insert({ user_id: uid, ...dados });
  let r = await ir(payload);
  if (r.error && "forma" in payload && /forma|PGRST204|42703|column/i.test(`${r.error.code} ${r.error.message}`)) {
    const { forma: _f, ...sem } = payload; r = await ir(sem);
  }
  return r;
}
type MaoObra = { salario_mensal: number; horas_dia: number; dias_semana_array: number[] };

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => Math.round((parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;
const txt = (v: number | null | undefined) => (v == null || v === 0 ? "" : String(v).replace(".", ","));
const DIAS = [{ id: 1, l: "Seg" }, { id: 2, l: "Ter" }, { id: 3, l: "Qua" }, { id: 4, l: "Qui" }, { id: 5, l: "Sex" }, { id: 6, l: "Sáb" }, { id: 7, l: "Dom" }];

export default function Custos() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [fixos, setFixos] = useState<CustoFixo[]>([]);
  const [variaveis, setVariaveis] = useState<CustoVariavel[]>([]);
  const [mo, setMo] = useState<MaoObra>({ salario_mensal: 0, horas_dia: 8, dias_semana_array: [1, 2, 3, 4, 5] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false); // não deu pra carregar (11/10)
  const [editFixo, setEditFixo] = useState<CustoFixo | "novo" | null>(null);
  const [editVar, setEditVar] = useState<CustoVariavel | "novo" | null>(null);
  const [editMaq, setEditMaq] = useState(false);
  const [editMo, setEditMo] = useState(false);
  // (16/10) custos invisíveis (% sobre os ingredientes): saíram da Ficha técnica e ficam aqui, com os outros custos
  const [cv, setCv] = useState<number | null>(null);
  const [editCv, setEditCv] = useState(false);

  const carregar = useCallback(async () => {
    // 11/10: leitura que falha avisa "Não deu pra carregar" (antes virava "Nenhum custo fixo ainda" e salário R$ 0,00)
    setErro(false);
    const { data: { user }, error: eUser } = await supabase.auth.getUser().catch(e => ({ data: { user: null }, error: e }));
    if (!user) { if (erroDeConexao(eUser)) { setErro(true); setCarregando(false); } return; }
    setUid(user.id);
    supabase.from("profiles").select("custos_invisiveis_pct").eq("id", user.id).maybeSingle()
      .then(({ data, error }) => { const x = (data as any)?.custos_invisiveis_pct; setCv(!error && x != null ? Number(x) : null); }, () => {});
    const [f, v, m] = await Promise.all([
      supabase.from("custos_fixos").select("id, nome, valor, ativo, dia_vencimento").eq("user_id", user.id).order("nome"),
      supabase.from("custos_variaveis").select("*").eq("user_id", user.id).order("nome"),
      supabase.from("config_mao_obra").select("salario_mensal, horas_dia, dias_semana, dias_semana_array").eq("user_id", user.id).maybeSingle(),
    ]);
    if (f.error || v.error || m.error) {
      console.error("[custos] não consegui carregar:", f.error || v.error || m.error);
      setErro(true); setCarregando(false); return;
    }
    setFixos(((f.data as any[]) || []).map(x => ({ ...x, valor: Number(x.valor) || 0 })));
    setVariaveis(((v.data as any[]) || []).map(x => ({ ...x, valor: Number(x.valor) || 0 })));
    if (m.data) {
      const d: any = m.data;
      const arr: number[] = Array.isArray(d.dias_semana_array) && d.dias_semana_array.length > 0
        ? d.dias_semana_array : Array.from({ length: Math.min(Math.max(Number(d.dias_semana) || 5, 1), 7) }, (_, i) => i + 1);
      setMo({ salario_mensal: Number(d.salario_mensal) || 0, horas_dia: Number(d.horas_dia) || 8, dias_semana_array: arr });
    }
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // (16/10) veio do "Ver" do Seus próximos passos: abre direto a janela que resolve
  useAbrirPedido(!carregando && !!uid, p => { if (p === "maquininha") setEditMaq(true); else if (p === "fixo") setEditFixo("novo"); });
  const totalFixos = useMemo(() => fixos.filter(f => f.ativo).reduce((s, f) => s + f.valor, 0), [fixos]);
  const horasMes = mo.horas_dia * mo.dias_semana_array.length * 4.345;
  const custoHora = horasMes > 0 ? (totalFixos + mo.salario_mensal) / horasMes : 0;
  const valorHora = horasMes > 0 ? mo.salario_mensal / horasMes : 0;
  const ativosVar = variaveis.filter(v => v.ativo);
  // 10/10: o card de variáveis no mesmo formato dos outros (valor em reais + quantos ativos)
  const varPorPedido = ativosVar.filter(v => v.tipo === "fixo").reduce((s, v) => s + v.valor, 0);
  const varPct = Math.round(ativosVar.filter(v => v.tipo === "percentual").reduce((s, v) => s + v.valor, 0) * 100) / 100;
  const qtdFixosAtivos = fixos.filter(f => f.ativo).length;
  const diasTxt = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const seq = s.length > 1 && s.every((d, i) => i === 0 || d === s[i - 1] + 1);
    return seq ? `${DIAS[s[0] - 1].l} a ${DIAS[s[s.length - 1] - 1].l}` : s.map(d => DIAS[d - 1]?.l).join(", ");
  };

  return (
    <>
      <AppPageHeader
        title="Custos"
        subtitle="O que a confeitaria gasta" infoComo={COMO_CUSTOS} infoTour={TOUR_CUSTOS}
        onBack={() => navigate("/financeiro")}
        infoIcon="🧮"
        infoContent={<>
          <p><strong>Custos fixos</strong> são os que vêm todo mês (aluguel, internet…). Com o <strong>dia de vencimento</strong>, eles viram uma conta em <strong>A pagar</strong> sozinhos.</p>
          <p><strong>Custos variáveis</strong> acompanham cada venda (taxa da maquininha, embalagem por pedido).</p>
          <p><strong>Custos invisíveis</strong> são o que gasta a mais em cada produção (gás do forno, perdas, descartáveis): uma porcentagem sobre os ingredientes, em todas as fichas.</p>
          <p>A <strong>mão de obra</strong> é o seu salário: com ele e os custos fixos, o app calcula quanto custa cada hora sua.</p>
        </>}
      />
      <EstiloFinanceiro />
      <div className="cu">
        {erro ? (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu pra carregar os custos" texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={() => { setCarregando(true); carregar(); }}>Tentar de novo</Botao>} />
        ) : (<>
        <div className="cu-resumo">
          <div className="cu-k"><small>Fixos por mês</small><b>{brl(totalFixos)}</b><i>{qtdFixosAtivos} {qtdFixosAtivos === 1 ? "ativo" : "ativos"}</i></div>
          <div className="cu-k"><small>Seu salário</small><b>{brl(mo.salario_mensal)}</b><i>mão de obra</i></div>
          <div className="cu-k destaque"><small>Custo da sua hora</small><b>{brl(custoHora)}</b><i>fixos + salário</i></div>
          <div className="cu-k"><small>Variáveis por pedido</small><b>{brl(varPorPedido)}</b><i>{varPct > 0 ? `+ ${String(varPct).replace(".", ",")}% da venda · ` : ""}{ativosVar.length} {ativosVar.length === 1 ? "ativo" : "ativos"}</i></div>
        </div>

        <div className="cu-grid">
          <section className="cu-card cu-a-fixos">
            <div className="cu-ct"><span className="cu-ic"><Buildings size={18} weight="duotone" /></span><div><b>Custos fixos</b><small>Todo mês, vendendo ou não</small></div>
              <button type="button" className="cu-add" onClick={() => setEditFixo("novo")}><Plus size={14} weight="bold" />Adicionar</button></div>
            {carregando ? <div className="cu-ph" /> : fixos.length === 0 ? (
              <p className="cu-vazio">Nenhum ainda. Ex.: aluguel, internet, conta de luz.</p>
            ) : fixos.map(f => (
              <button type="button" key={f.id} className={`cu-it ${f.ativo ? "" : "off"}`} onClick={() => setEditFixo(f)}>
                <div className="cu-it-t"><b>{f.nome}</b>
                  <small>{!f.ativo ? "Pausado" : f.dia_vencimento ? <><Receipt size={12} weight="bold" /><em>Vence dia {f.dia_vencimento} · vira conta em A pagar</em></> : "Sem dia de vencimento"}</small></div>
                <span className="cu-it-v">{brl(f.valor)}</span><CaretRight size={14} weight="bold" className="cu-it-ar" />
              </button>
            ))}
          </section>

          <section className="cu-card cu-a-mo">
            <div className="cu-ct"><span className="cu-ic"><Clock size={18} weight="duotone" /></span><div><b>Mão de obra</b><small>O seu trabalho também tem preço</small></div></div>
            <div className="cu-mo">
              <div className="cu-mo-l"><span>Salário</span><b>{brl(mo.salario_mensal)}</b></div>
              <div className="cu-mo-l"><span>Jornada</span><b>{mo.horas_dia}h por dia · {diasTxt(mo.dias_semana_array)}</b></div>
              <div className="cu-mo-l"><span>Salário por hora</span><b className="rosa">{brl(valorHora)}</b></div>
              <div className="cu-mo-l"><span>Salário por dia</span><b>{brl(valorHora * mo.horas_dia)}</b></div>
            </div>
            {/* (16/10) botão de verdade (antes era um "Editar" pequeno no canto) */}
            <button type="button" className="cu-bt" onClick={() => setEditMo(true)}><PencilSimple size={16} weight="bold" />Editar salário e jornada</button>
          </section>

          <section className="cu-card cu-a-var">
            <div className="cu-ct"><span className="cu-ic"><Percent size={18} weight="duotone" /></span><div><b>Custos variáveis</b><small>Acompanham cada venda</small></div>
              <button type="button" className="cu-add" onClick={() => setEditVar("novo")}><Plus size={14} weight="bold" />Adicionar</button></div>
            {carregando ? <div className="cu-ph" /> : variaveis.length === 0 ? (
              <p className="cu-vazio">Nenhum ainda. Ex.: maquininha, embalagem.</p>
            ) : variaveis.map(v => (
              <button type="button" key={v.id} className={`cu-it ${v.ativo ? "" : "off"}`} onClick={() => setEditVar(v)}>
                <div className="cu-it-t"><b>{v.nome}</b><small>{!v.ativo ? "Pausado" : v.tipo === "percentual" ? (v.forma ? `% das vendas ${FORMA_TXT[v.forma]}` : "% de cada venda") : "Valor por pedido"}</small></div>
                <span className="cu-it-v">{v.tipo === "percentual" ? `${String(v.valor).replace(".", ",")}%` : brl(v.valor)}</span><CaretRight size={14} weight="bold" className="cu-it-ar" />
              </button>
            ))}
            {/* (13/10) atalho: a taxa da maquininha com o débito e o crédito separados */}
            {/* (16/10) a maquininha que falta vira uma linha como as outras (antes um botão tracejado comprido) */}
            {!carregando && !variaveis.some(v => v.forma) && (
              <button type="button" className="cu-it cu-it--falta" onClick={() => setEditMaq(true)}>
                <span className="cu-it-ic" aria-hidden="true"><CreditCard size={16} weight="bold" /></span>
                <div className="cu-it-t"><b>Taxa da maquininha</b><small>Débito e crédito · falta cadastrar</small></div>
                <CaretRight size={14} weight="bold" className="cu-it-ar" />
              </button>
            )}
          </section>

          {/* (16/10) custos invisíveis: antes só dava pra mudar dentro da Ficha técnica */}
          <section className="cu-card cu-a-cv">
            <div className="cu-ct"><span className="cu-ic"><Fire size={18} weight="duotone" /></span><div><b>Custos invisíveis</b><small>Gás do forno, perdas, descartáveis</small></div></div>
            <div className="cu-mo">
              <div className="cu-mo-l"><span>Sobre os ingredientes</span><b className="rosa">{String(cv ?? 25).replace(".", ",")}%</b></div>
              <div className="cu-mo-l"><span>Ex.: R$ 100,00 de ingredientes</span><b>+ {brl((cv ?? 25))}</b></div>
            </div>
            <p className="cu-vazio">{cv == null ? "Usando o padrão de 25%. " : ""}A maioria das confeiteiras usa entre 20% e 30%. Entra em todas as fichas técnicas.</p>
            <button type="button" className="cu-bt" onClick={() => setEditCv(true)}><PencilSimple size={16} weight="bold" />Editar porcentagem</button>
          </section>
        </div>
        </>)}
      </div>

      {editFixo && uid && <FixoSheet uid={uid} item={editFixo === "novo" ? null : editFixo} onClose={() => setEditFixo(null)} onFeito={() => { setEditFixo(null); carregar(); }} />}
      {editVar && uid && <VariavelSheet uid={uid} item={editVar === "novo" ? null : editVar} onClose={() => setEditVar(null)} onFeito={() => { setEditVar(null); carregar(); }} />}
      {editMaq && uid && <MaquininhaSheet uid={uid} onClose={() => setEditMaq(false)} onFeito={() => { setEditMaq(false); carregar(); }} />}
      {editCv && uid && <InvisiveisSheet uid={uid} atual={cv ?? 25} onClose={() => setEditCv(false)} onFeito={v => { setCv(v); setEditCv(false); }} />}
      {editMo && uid && <MaoObraSheet uid={uid} atual={mo} totalFixos={totalFixos} onClose={() => setEditMo(false)} onFeito={() => { setEditMo(false); carregar(); }} />}
      {/* (16/10) primeira vez aqui: convite pro tour */}
      <style>{CSS}{FOLHA_CSS}</style>
    </>
  );
}

function Switch({ ligado, onToggle, titulo, sub }: { ligado: boolean; onToggle: () => void; titulo: string; sub: string }) {
  return <div className={`fo-sw ${ligado ? "on" : ""}`} role="switch" aria-checked={ligado} tabIndex={0} onClick={onToggle} onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle(); } }}>
    <div><b>{titulo}</b><small>{sub}</small></div><i aria-hidden="true" />
  </div>;
}

function Excluir({ nome, onSim, onNao, ocupado }: { nome: string; onSim: () => void; onNao: () => void; ocupado: boolean }) {
  return <div className="fo-dica" style={{ background: "#FEF2F2" }}>
    <b>Excluir “{nome}”?</b> Isso não apaga contas e lançamentos que já existem. Se for só por um tempo, prefira pausar.
    <div className="fo-row" style={{ marginTop: 10 }}>
      <button type="button" className="fo-cta escuro" style={{ marginTop: 0, background: "#fff", color: "#2C1219", border: "1.5px solid #EDE6E9" }} onClick={onNao}>Voltar</button>
      <button type="button" className="fo-cta vermelho" style={{ marginTop: 0 }} onClick={onSim} disabled={ocupado}>{ocupado ? "Excluindo…" : "Excluir"}</button>
    </div>
  </div>;
}

function FixoSheet({ uid, item, onClose, onFeito }: { uid: string; item: CustoFixo | null; onClose: () => void; onFeito: () => void }) {
  const [nome, setNome] = useState(item?.nome || "");
  const [valor, setValor] = useState(textoBRL(item?.valor));
  const [dia, setDia] = useState(item?.dia_vencimento ? String(item.dia_vencimento) : "");
  const [ativo, setAtivo] = useState(item ? item.ativo : true);
  const [excluir, setExcluir] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const salvar = async () => {
    const v = num(valor), d = dia ? Math.round(Number(dia)) : null;
    if (!nome.trim()) { setErro("Dê um nome (ex.: Aluguel do ateliê)"); return; }
    if (v <= 0) { setErro("Digite o valor por mês"); return; }
    if (d !== null && (d < 1 || d > 31)) { setErro("O dia de vencimento vai de 1 a 31"); return; }
    setOcupado(true);
    const payload = { nome: nome.trim(), valor: v, ativo, dia_vencimento: d };
    const { error } = item ? await supabase.from("custos_fixos").update(payload).eq("id", item.id) : await supabase.from("custos_fixos").insert({ user_id: uid, ...payload });
    setOcupado(false);
    if (error) { setErro("Não foi possível salvar agora."); return; }
    onFeito();
  };
  const apagar = async () => {
    if (!item) return;
    setOcupado(true);
    // 11/10: confere se excluiu mesmo (antes a folha fechava e o custo reaparecia)
    const { error } = await supabase.from("custos_fixos").delete().eq("id", item.id);
    setOcupado(false);
    if (error) { console.error("[custos] não excluiu:", error); setExcluir(false); setErro(explicarErro(error, "Não deu pra excluir. Tente de novo.")); return; }
    onFeito();
  };
  return (
    <Folha titulo={item ? "Editar custo fixo" : "Novo custo fixo"} sub="Um gasto que vem todo mês, no mesmo valor" onClose={onClose}>
      <label className="fo-lb" htmlFor="cf-n">Nome</label>
      <input id="cf-n" className="fo-txt" placeholder="Ex.: Aluguel do ateliê" value={nome} onChange={e => { setNome(e.target.value); setErro(""); }} />
      <div className="fo-row">
        <div><label className="fo-lb" htmlFor="cf-v">Valor por mês</label><div className="fo-in"><span>R$</span><input id="cf-v" inputMode="numeric" placeholder="0,00" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div></div>
        <div><label className="fo-lb" htmlFor="cf-d">Vence dia <em>(opcional)</em></label><div className="fo-in"><input id="cf-d" inputMode="numeric" placeholder="Ex.: 5" value={dia} onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 2); if (Number(d) > 31) { setErro("O dia de vencimento vai de 1 a 31"); return; } setDia(d); setErro(""); }} /></div></div>
      </div>
      <div className="fo-dica">{Number(dia) >= 1 && Number(dia) <= 31 ? <>Todo mês, uma conta de <b>{brl(num(valor))}</b> vencendo no <b>dia {Number(dia)}</b> aparece em <b>A pagar</b>. Ela só sai do caixa quando você pagar.</> : <>Com o dia de vencimento, este custo vira uma conta em <b>A pagar</b> todo mês, sozinho.</>}</div>
      <Switch ligado={ativo} onToggle={() => setAtivo(a => !a)} titulo={ativo ? "Ativo" : "Pausado"} sub={ativo ? "Entra no custo da sua hora e gera a conta do mês" : "Não conta nem gera conta enquanto estiver pausado"} />
      {erro && <p className="fo-erro">{erro}</p>}
      {excluir ? <Excluir nome={item?.nome || ""} ocupado={ocupado} onNao={() => setExcluir(false)} onSim={apagar} /> : (<>
        <button type="button" className="fo-cta" onClick={salvar} disabled={ocupado}>{ocupado ? "Salvando…" : item ? "Salvar" : "Cadastrar custo fixo"}</button>
        {item && <button type="button" className="fo-sec" onClick={() => setExcluir(true)}>Excluir este custo</button>}
      </>)}
    </Folha>
  );
}

function VariavelSheet({ uid, item, onClose, onFeito }: { uid: string; item: CustoVariavel | null; onClose: () => void; onFeito: () => void }) {
  const [nome, setNome] = useState(item?.nome || "");
  const [tipo, setTipo] = useState<"percentual" | "fixo">(item?.tipo || "percentual");
  const [valor, setValor] = useState(item?.tipo === "fixo" ? textoBRL(item?.valor) : txt(item?.valor));
  const [ativo, setAtivo] = useState(item ? item.ativo : true);
  const [forma, setForma] = useState<FormaCusto>(item?.forma || null);
  const [excluir, setExcluir] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  // 10/10: a porcentagem aceita "3,5" e "3.5" (antes o ponto era apagado e "3.5" virava 35). O valor em reais segue na máscara de centavos.
  const v = tipo === "percentual" ? Math.round(parseNumBR(valor) * 100) / 100 : num(valor);
  const salvar = async () => {
    if (!nome.trim()) { setErro("Dê um nome (ex.: Taxa da maquininha)"); return; }
    if (v <= 0) { setErro("Digite o valor"); return; }
    if (tipo === "percentual" && v > 100) { setErro("A porcentagem vai até 100%"); return; }
    setOcupado(true);
    const payload = { nome: nome.trim(), tipo, valor: v, ativo, forma: tipo === "percentual" ? forma : null };
    const { error } = await gravarVariavel(item?.id || null, uid, payload);
    setOcupado(false);
    if (error) { setErro("Não foi possível salvar agora."); return; }
    onFeito();
  };
  const apagar = async () => {
    if (!item) return;
    setOcupado(true);
    // 11/10: confere se excluiu mesmo (antes a folha fechava e o custo reaparecia)
    const { error } = await supabase.from("custos_variaveis").delete().eq("id", item.id);
    setOcupado(false);
    if (error) { console.error("[custos] não excluiu:", error); setExcluir(false); setErro(explicarErro(error, "Não deu pra excluir. Tente de novo.")); return; }
    onFeito();
  };
  return (
    <Folha titulo={item ? "Editar custo variável" : "Novo custo variável"} sub="Um gasto que acompanha cada venda" onClose={onClose}>
      <label className="fo-lb" htmlFor="cv-n">Nome</label>
      <input id="cv-n" className="fo-txt" placeholder="Ex.: Taxa da maquininha" value={nome} onChange={e => { setNome(e.target.value); setErro(""); }} />
      <p className="fo-lb">Como é cobrado?</p>
      <div className="fo-seg"><button type="button" className={tipo === "percentual" ? "on" : ""} onClick={() => { if (tipo !== "percentual") { setTipo("percentual"); setValor(""); } }}>% da venda</button><button type="button" className={tipo === "fixo" ? "on" : ""} onClick={() => { if (tipo !== "fixo") { setTipo("fixo"); setValor(""); } }}>R$ por pedido</button></div>
      <label className="fo-lb" htmlFor="cv-v">{tipo === "percentual" ? "Porcentagem" : "Valor por pedido"}</label>
      <div className="fo-in">{tipo === "fixo" && <span>R$</span>}<input id="cv-v" inputMode={tipo === "percentual" ? "decimal" : "numeric"} placeholder={tipo === "percentual" ? "Ex.: 3,5" : "0,00"} value={valor} onChange={e => { setValor(tipo === "fixo" ? mascaraBRL(e.target.value) : e.target.value); setErro(""); }} />{tipo === "percentual" && <span>%</span>}</div>
      {tipo === "percentual" && (<>
        <p className="fo-lb">Entra em quais vendas?</p>
        <div className="fo-seg fo-seg--3">
          <button type="button" className={!forma ? "on" : ""} onClick={() => setForma(null)}>Todas</button>
          <button type="button" className={forma === "credito" ? "on" : ""} onClick={() => setForma("credito")}>Crédito</button>
          <button type="button" className={forma === "debito" ? "on" : ""} onClick={() => setForma("debito")}>Débito</button>
        </div>
      </>)}
      {v > 0 && <div className="fo-dica">Numa venda de <b>R$ 100,00</b>, este custo é <b>{brl(tipo === "percentual" ? v : v)}</b>{tipo === "percentual" ? "" : " (por pedido, qualquer valor)"}.</div>}
      <Switch ligado={ativo} onToggle={() => setAtivo(a => !a)} titulo={ativo ? "Ativo" : "Pausado"} sub={ativo ? "Entra no lucro do mês e na ficha técnica" : "Não entra nas contas enquanto estiver pausado"} />
      {erro && <p className="fo-erro">{erro}</p>}
      {excluir ? <Excluir nome={item?.nome || ""} ocupado={ocupado} onNao={() => setExcluir(false)} onSim={apagar} /> : (<>
        <button type="button" className="fo-cta" onClick={salvar} disabled={ocupado}>{ocupado ? "Salvando…" : item ? "Salvar" : "Cadastrar custo variável"}</button>
        {item && <button type="button" className="fo-sec" onClick={() => setExcluir(true)}>Excluir este custo</button>}
      </>)}
    </Folha>
  );
}

/** (13/10) Taxa da maquininha: cada empresa cobra uma taxa no débito e outra no crédito. Vira 2 custos, cada um na sua forma de pagamento. */
function MaquininhaSheet({ uid, onClose, onFeito }: { uid: string; onClose: () => void; onFeito: () => void }) {
  const [deb, setDeb] = useState("");
  const [cred, setCred] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const d = Math.round(parseNumBR(deb) * 100) / 100, c = Math.round(parseNumBR(cred) * 100) / 100;
  const salvar = async () => {
    if (d <= 0 && c <= 0) { setErro("Digite a taxa do débito ou do crédito"); return; }
    if (d > 100 || c > 100) { setErro("A porcentagem vai até 100%"); return; }
    setOcupado(true);
    const linhas: [string, number, FormaCusto][] = [["Maquininha (débito)", d, "debito"], ["Maquininha (crédito)", c, "credito"]];
    for (const [nome, valor, forma] of linhas) {
      if (valor <= 0) continue;
      const { error } = await gravarVariavel(null, uid, { nome, tipo: "percentual", valor, ativo: true, forma });
      if (error) { setOcupado(false); setErro(explicarErro(error, "Não foi possível salvar agora.")); return; }
    }
    setOcupado(false);
    onFeito();
  };
  return (
    <Folha titulo="Taxa da maquininha" sub="Veja no app da sua maquininha quanto ela cobra" onClose={onClose}>
      <label className="fo-lb" htmlFor="mq-d">No débito</label>
      <div className="fo-in"><input id="mq-d" inputMode="decimal" placeholder="Ex.: 1,99" value={deb} onChange={e => { setDeb(e.target.value); setErro(""); }} /><span>%</span></div>
      <label className="fo-lb" htmlFor="mq-c">No crédito à vista</label>
      <div className="fo-in"><input id="mq-c" inputMode="decimal" placeholder="Ex.: 4,99" value={cred} onChange={e => { setCred(e.target.value); setErro(""); }} /><span>%</span></div>
      <div className="fo-dica">Pix e dinheiro não pagam taxa. No lucro do mês, cada taxa entra só nos pedidos pagos daquele jeito. Na ficha técnica entra a do crédito, que é o pior caso.</div>
      {erro && <p className="fo-erro">{erro}</p>}
      <button type="button" className="fo-cta" onClick={salvar} disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar taxas"}</button>
    </Folha>
  );
}

function InvisiveisSheet({ uid, atual, onClose, onFeito }: { uid: string; atual: number; onClose: () => void; onFeito: (v: number) => void }) {
  const [pct, setPct] = useState(String(atual).replace(".", ","));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const v = Number(pct.replace(",", ".")) || 0;
  const salvar = async () => {
    if (v < 0 || v > 100) { setErro("Coloque um valor de 0 a 100"); return; }
    setOcupado(true);
    const { error } = await supabase.from("profiles").update({ custos_invisiveis_pct: v }).eq("id", uid);
    setOcupado(false);
    if (error) {
      const semColuna = error.code === "PGRST204" || error.code === "42703" || /custos_invisiveis_pct/i.test(String(error.message || ""));
      setErro(semColuna ? "Falta um ajuste no banco pra salvar (SQL 4.30)." : "Não foi possível salvar agora."); return;
    }
    onFeito(v);
  };
  return (
    <Folha titulo="Custos invisíveis" sub="O que gasta a mais em cada produção" onClose={onClose}>
      <label className="fo-lb" htmlFor="cv-p">Porcentagem sobre os ingredientes</label>
      <div className="fo-in"><input id="cv-p" inputMode="decimal" value={pct} onChange={e => { setPct(e.target.value); setErro(""); }} /><span>%</span></div>
      <div className="fo-dica">Gás do forno, perdas e descartáveis (papel manteiga, luva, filme). A conta de luz e água da casa vai em <b>Custos fixos</b>. Com {String(v).replace(".", ",")}%, a cada R$ 100,00 de ingredientes entram <b>{brl(v)}</b>.</div>
      {erro && <p className="fo-erro">{erro}</p>}
      <button type="button" className="fo-cta" onClick={salvar} disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</button>
    </Folha>
  );
}

function MaoObraSheet({ uid, atual, totalFixos, onClose, onFeito }: { uid: string; atual: MaoObra; totalFixos: number; onClose: () => void; onFeito: () => void }) {
  const [salario, setSalario] = useState(textoBRL(atual.salario_mensal));
  const [horas, setHoras] = useState(String(atual.horas_dia || 8));
  const [dias, setDias] = useState<number[]>(atual.dias_semana_array);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const s = num(salario), h = Number(horas.replace(",", ".")) || 0;
  const hMes = h * dias.length * 4.345;
  const salvar = async () => {
    if (h <= 0 || h > 24) { setErro("As horas por dia vão de 1 a 24"); return; }
    if (dias.length === 0) { setErro("Escolha pelo menos um dia"); return; }
    setOcupado(true);
    const { error } = await supabase.from("config_mao_obra").upsert({
      user_id: uid, salario_mensal: s, horas_dia: h, dias_semana: dias.length, dias_semana_array: [...dias].sort((a, b) => a - b), updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setOcupado(false);
    if (error) { setErro("Não foi possível salvar agora."); return; }
    onFeito();
  };
  return (
    <Folha titulo="Mão de obra" sub="Quanto você quer ganhar e quanto trabalha" onClose={onClose}>
      <label className="fo-lb" htmlFor="mo-s">Salário que você quer tirar por mês</label>
      <div className="fo-in"><span>R$</span><input id="mo-s" inputMode="numeric" placeholder="0,00" value={salario} onChange={e => { setSalario(mascaraBRL(e.target.value)); setErro(""); }} /></div>
      <label className="fo-lb" htmlFor="mo-h">Horas de trabalho por dia</label>
      <div className="fo-in"><input id="mo-h" inputMode="decimal" value={horas} onChange={e => { setHoras(e.target.value); setErro(""); }} /><span>horas</span></div>
      <p className="fo-lb">Dias em que você produz</p>
      <div className="fo-chips">{DIAS.map(d => <button type="button" key={d.id} className={dias.includes(d.id) ? "on" : ""} onClick={() => setDias(x => x.includes(d.id) ? x.filter(y => y !== d.id) : [...x, d.id])}>{d.l}</button>)}</div>
      {hMes > 0 && <div className="fo-dica">São <b>{Math.round(hMes)} horas por mês</b>. Salário por hora: <b>{brl(s / hMes)}</b> · custo da sua hora (com os custos fixos): <b>{brl((s + totalFixos) / hMes)}</b>.</div>}
      {erro && <p className="fo-erro">{erro}</p>}
      <button type="button" className="fo-cta" onClick={salvar} disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</button>
    </Folha>
  );
}

const CSS = `
  .cu { max-width: 1120px; margin: 0 auto; padding: 14px 0 96px; font-family: var(--font-base); color: var(--ui-texto); display: flex; flex-direction: column; gap: 16px; }
  .cu-resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (min-width: 900px) { .cu-resumo { grid-template-columns: repeat(4, 1fr); } }
  .cu-k { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 12px; min-width: 0; }
  .cu-k small { display: block; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .cu-k b { display: block; font-size: clamp(16px, 4.6vw, 21px); font-weight: 600; letter-spacing: -.02em; margin: 3px 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cu-k i { display: block; font-style: normal; font-size: 13px; color: #888780; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cu-k small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cu-k.destaque { background: radial-gradient(130% 160% at 0 0, #6B2340, var(--ui-vinho-escuro) 70%); border: none; color: var(--ui-branco); }
  .cu-k.destaque small, .cu-k.destaque i { color: rgba(255,255,255,.72); }
  .cu-grid { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); grid-template-areas: "fixos" "mo" "var" "cv"; }
  @media (min-width: 900px) { .cu-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "fixos mo" "var cv"; align-items: start; } }
  .cu-a-fixos { grid-area: fixos; } .cu-a-mo { grid-area: mo; } .cu-a-var { grid-area: var; } .cu-a-cv { grid-area: cv; }
  .cu-card { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 14px; }
  .cu-ct { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .cu-ct > div { flex: 1; min-width: 0; }
  .cu-ct b { display: block; font-size: 15.5px; font-weight: 700; } .cu-ct small { font-size: 12.5px; color: #888780; }
  .cu-ic { width: 38px; height: 38px; border-radius: 11px; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cu-ph { height: 90px; background: #FAF7F8; border-radius: var(--ui-raio-p); }
  .cu-vazio { margin: 6px 0 4px; font-size: 13px; color: #888780; line-height: 1.45; }
  .cu-it { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: none; border: none; border-top: 1px solid var(--ui-linha); padding: 11px 2px; font-family: inherit; color: var(--ui-texto); cursor: pointer; }
  .cu-it:first-of-type { border-top: none; }
  .cu-it-t { flex: 1; min-width: 0; } .cu-it-t b { display: block; font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cu-it-t small { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #888780; margin-top: 2px; }
  .cu-it-t small em { min-width: 0; font-style: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cu-it-v { font-size: 14px; font-weight: 700; white-space: nowrap; } .cu-it-ar { color: #C9BEC3; flex-shrink: 0; }
  .cu-it.off { opacity: .55; }
  /* (16/10) "+ Adicionar" discreto no título do bloco (antes um botão tracejado embaixo) */
  .cu-add { flex: none; display: flex; align-items: center; gap: 4px; min-height: 36px; margin: 0 -6px 0 0; padding: 0 8px; border: 0; border-radius: 8px; background: none; color: var(--ui-rosa-escuro); font-family: inherit; font-size: 13.5px; font-weight: 700; white-space: nowrap; cursor: pointer; }
  @media (hover: hover) { .cu-add:hover { background: #FFF1F6; } }
  .cu-it-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: #FFF1F6; color: var(--ui-rosa-escuro); }
  .cu-it--falta .cu-it-t small { color: var(--ui-rosa-escuro); }
  .cu-bt { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 44px; margin-top: 10px; border: 1.5px solid #F3C9DA; border-radius: var(--ui-raio); background: var(--ui-branco); color: var(--ui-rosa-escuro); font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; }
  .cu-mo { display: block; width: 100%; text-align: left; background: #FAF7F8; border: none; border-radius: var(--ui-raio); padding: 4px 12px 4px; font-family: inherit; color: var(--ui-texto); }
  .cu-mo-l { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid #F0EBED; font-size: 13.5px; }
  .cu-mo-l span { color: var(--ui-texto-2); } .cu-mo-l b { font-weight: 700; text-align: right; } .cu-mo-l b.rosa { color: var(--ui-rosa-escuro); }
  .cu-mo-l:last-child { border-bottom: 0; }
`;
