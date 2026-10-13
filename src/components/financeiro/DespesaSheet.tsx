import CampoData from '@/components/CampoData'
import { useState } from "react";
import { mascaraBRL, lerBRL } from "@/lib/moeda";
import Folha from "@/components/financeiro/Folha";
import { Botao } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { faltaNoBanco } from "@/lib/pagamentos";
import { APORTE, RETIRADA, nomeCategoriaFin } from "@/lib/categoriasFinanceiro";

/**
 * Financeiro · "Nova entrada" e "Nova saída": dinheiro que JÁ entrou ou JÁ saiu, na data escolhida.
 * Conta pra pagar depois vai em "A pagar"; pagamento de pedido vai em "A receber".
 * (4.29) Revisão:
 *   · entrada pergunta como recebeu (Pix, dinheiro, crédito, débito) e entra em "Formas de pagamento"
 *     (sem a coluna forma no banco, grava sem ela, como antes)
 *   · "Aporte (dinheiro seu)" e "Retirada pra você" mexem no caixa, mas não contam como venda nem como despesa
 *   · data antes de informar o saldo em caixa: avisa que o saldo não muda (o dinheiro já estava contado)
 */
const CATEGORIAS = ["Insumos", "Embalagens", "Aluguel", "Energia e água", "Internet", "Gás", "Transporte", "Marketing", "Equipamentos", "Impostos e taxas", RETIRADA, "Outros"];
const CATEGORIAS_ENTRADA = ["Venda no balcão", "Venda fora do app", APORTE, "Outros"];
const FORMAS = [{ k: "pix", l: "Pix" }, { k: "dinheiro", l: "Dinheiro" }, { k: "credito", l: "Crédito" }, { k: "debito", l: "Débito" }];
const isoDia = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DespesaSheet({ onClose, onSalvo, onContaAPagar, onReceberPedido, tipo = "saida", inicioCaixa }: {
  onClose: () => void;
  /** recebe o texto do aviso de sucesso */
  onSalvo: (aviso: string) => void;
  onContaAPagar?: () => void; onReceberPedido?: () => void; tipo?: "entrada" | "saida";
  /** dia (AAAA-MM-DD) em que ela informou o saldo em caixa; data antes disso não mexe no saldo */
  inicioCaixa?: string | null;
}) {
  const ehEntrada = tipo === "entrada";
  const cats = ehEntrada ? CATEGORIAS_ENTRADA : CATEGORIAS;
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(cats[0]);
  const [forma, setForma] = useState("pix");
  const [valor, setValor] = useState("");
  const [quando, setQuando] = useState<"hoje" | "ontem" | "outra">("hoje");
  const [outra, setOutra] = useState(isoDia(-2));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const data = quando === "hoje" ? isoDia() : quando === "ontem" ? isoDia(-1) : outra;
  const antesDoCaixa = !!inicioCaixa && !!data && data < inicioCaixa;

  const salvar = async () => {
    if (salvando) return;
    const v = lerBRL(valor);
    if (v <= 0) { setErro(ehEntrada ? "Digite quanto entrou" : "Digite quanto você pagou"); return; }
    if (!data || data > isoDia()) { setErro(ehEntrada ? "Escolha uma data até hoje" : "Escolha uma data até hoje. Conta pra pagar depois vai em A pagar."); return; }
    setSalvando(true); setErro("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSalvando(false); setErro("Sua sessão expirou. Entre de novo pra lançar."); return; }
    const linha: Record<string, unknown> = { user_id: user.id, tipo: ehEntrada ? "entrada" : "saida", categoria, descricao: descricao.trim() || nomeCategoriaFin(categoria), valor: v, data };
    let { error } = await supabase.from("financeiro").insert(ehEntrada ? { ...linha, forma } : linha);
    // sem a coluna forma (SQL 4.31 não rodado): grava sem ela
    if (error && ehEntrada && faltaNoBanco(error)) ({ error } = await supabase.from("financeiro").insert(linha));
    setSalvando(false);
    if (error) { console.error("[financeiro] não consegui lançar:", error); setErro("Não deu pra salvar agora. Confira a internet e tente de novo."); return; }
    const quandoTxt = data === isoDia() ? "" : data === isoDia(-1) ? " com data de ontem" : ` com data de ${data.split("-").reverse().join("/")}`;
    onSalvo(`${ehEntrada ? "Entrada" : "Saída"} de ${brl(v)} lançada${quandoTxt}.`);
  };

  const notaCategoria = categoria === APORTE ? "Entra no saldo em caixa, mas não conta como venda no recebido."
    : categoria === RETIRADA ? "Sai do saldo em caixa, mas não conta como despesa do negócio." : "";

  return (
    <Folha titulo={ehEntrada ? "Nova entrada" : "Nova saída"} onClose={onClose} umaAcao
      sub={ehEntrada ? "Dinheiro que entrou fora dos pedidos do app." : "Algo que você já pagou. Conta pra pagar depois vai em A pagar."}
      acoes={<Botao cheio carregando={salvando} onClick={salvar}>{ehEntrada ? "Lançar entrada" : "Lançar saída"}</Botao>}>
      <label className="fo-lb" htmlFor="dsp-v">{ehEntrada ? "Quanto entrou?" : "Quanto pagou?"}</label>
      <div className="fo-in"><span>R$</span><input id="dsp-v" inputMode="numeric" autoComplete="off" placeholder="0,00" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div>
      <p className="fo-lb">Categoria</p>
      <div className="fo-chips">{cats.map(c => <button type="button" key={c} className={categoria === c ? "on" : ""} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{nomeCategoriaFin(c)}</button>)}</div>
      {notaCategoria && <p className="fo-nota">{notaCategoria}</p>}
      {ehEntrada && (<>
        <p className="fo-lb">Como recebeu?</p>
        <div className="fo-chips">{FORMAS.map(f => <button type="button" key={f.k} className={forma === f.k ? "on" : ""} aria-pressed={forma === f.k} onClick={() => setForma(f.k)}>{f.l}</button>)}</div>
      </>)}
      <label className="fo-lb" htmlFor="dsp-d">Descrição <em>(opcional)</em></label>
      <input id="dsp-d" className="fo-txt" autoComplete="off" maxLength={80} placeholder={ehEntrada ? "Ex.: 30 brigadeiros pra vizinha" : "Ex.: leite condensado e creme de leite"} value={descricao} onChange={e => setDescricao(e.target.value)} />
      <p className="fo-lb">{ehEntrada ? "Quando entrou?" : "Quando pagou?"}</p>
      <div className="fo-chips">{(["hoje", "ontem", "outra"] as const).map(q => <button type="button" key={q} className={quando === q ? "on" : ""} aria-pressed={quando === q} onClick={() => setQuando(q)}>{q === "hoje" ? "Hoje" : q === "ontem" ? "Ontem" : "Outra data"}</button>)}</div>
      {quando === "outra" && <div style={{ marginTop: 8 }}><CampoData valor={outra} onChange={setOutra} max={isoDia()} titulo={ehEntrada ? "Data da entrada" : "Data do pagamento"} /></div>}
      {antesDoCaixa && <p className="fo-nota">Essa data é de antes de você informar o saldo em caixa, então o saldo não muda (esse dinheiro já estava na conta). Entra nos números do período.</p>}
      {erro && <p className="fo-erro">{erro}</p>}
      {ehEntrada && onReceberPedido && <button type="button" className="fo-sec neutro" onClick={onReceberPedido}>É o pagamento de um pedido? Registre em A receber</button>}
      {!ehEntrada && onContaAPagar && <button type="button" className="fo-sec neutro" onClick={onContaAPagar}>É uma conta pra pagar depois? Cadastre em A pagar</button>}
    </Folha>
  );
}
