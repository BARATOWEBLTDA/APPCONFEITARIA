import CampoData from '@/components/CampoData'
import { useState } from "react";
import { mascaraBRL, textoBRL } from "@/lib/moeda";
import Folha from "@/components/financeiro/Folha";
import { Botao } from "@/components/base";
import { supabase } from "@/lib/supabase";

/**
 * Financeiro · Passo 7 (03/10) — "Nova despesa": uma saída JÁ PAGA (sai do caixa na data escolhida).
 * Conta pra pagar depois vai em "A pagar" (Passo 5), que só sai do caixa quando for paga.
 */
const CATEGORIAS = ["Insumos", "Embalagens", "Aluguel", "Energia e água", "Internet", "Gás", "Transporte", "Marketing", "Equipamentos", "Outros"];
const CATEGORIAS_ENTRADA = ["Venda fora do app", "Venda no balcão", "Aporte (dinheiro seu)", "Outros"];
const isoDia = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const num = (s: string) => Math.round((parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;

export default function DespesaSheet({ onClose, onSalvo, onContaAPagar, tipo = "saida" }: { onClose: () => void; onSalvo: () => void; onContaAPagar?: () => void; tipo?: "entrada" | "saida" }) {
  const ehEntrada = tipo === "entrada";
  const cats = ehEntrada ? CATEGORIAS_ENTRADA : CATEGORIAS;
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(cats[0]);
  const [valor, setValor] = useState("");
  const [quando, setQuando] = useState<"hoje" | "ontem" | "outra">("hoje");
  const [outra, setOutra] = useState(isoDia());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async () => {
    const v = num(valor);
    if (v <= 0) { setErro(ehEntrada ? "Digite quanto entrou" : "Digite quanto você pagou"); return; }
    const data = quando === "hoje" ? isoDia() : quando === "ontem" ? isoDia(-1) : outra;
    if (!data || data > isoDia()) { setErro(ehEntrada ? "Escolha uma data até hoje" : "Escolha uma data até hoje (conta futura vai em A pagar)"); return; }
    setSalvando(true); setErro("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("financeiro").insert({ user_id: user?.id, tipo: ehEntrada ? "entrada" : "saida", categoria, descricao: descricao.trim() || categoria, valor: v, data });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onSalvo();
  };

  return (
    <Folha titulo={ehEntrada ? "Nova entrada" : "Nova despesa"} onClose={onClose} umaAcao
      sub={ehEntrada ? "Dinheiro que entrou fora dos pedidos do app. Entra no caixa na data escolhida." : "Algo que você já pagou. Sai do caixa na data escolhida."}
      acoes={<Botao cheio carregando={salvando} onClick={salvar}>{ehEntrada ? "Lançar entrada" : "Lançar despesa"}</Botao>}>
      <label className="fo-lb" htmlFor="dsp-v">{ehEntrada ? "Quanto entrou?" : "Quanto pagou?"}</label>
      <div className="fo-in"><span>R$</span><input id="dsp-v" inputMode="numeric" placeholder="0,00" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div>
      <p className="fo-lb">Categoria</p>
      <div className="fo-chips">{cats.map(c => <button type="button" key={c} className={categoria === c ? "on" : ""} onClick={() => setCategoria(c)}>{c === "Insumos" ? "Ingredientes" : c}</button>)}</div>
      <label className="fo-lb" htmlFor="dsp-d">Descrição <em>(opcional)</em></label>
      <input id="dsp-d" className="fo-txt" placeholder={ehEntrada ? "Ex.: 30 brigadeiros pra vizinha" : "Ex.: Leite condensado e creme de leite"} value={descricao} onChange={e => setDescricao(e.target.value)} />
      <p className="fo-lb">{ehEntrada ? "Quando entrou?" : "Quando pagou?"}</p>
      <div className="fo-chips">{(["hoje", "ontem", "outra"] as const).map(q => <button type="button" key={q} className={quando === q ? "on" : ""} onClick={() => setQuando(q)}>{q === "hoje" ? "Hoje" : q === "ontem" ? "Ontem" : "Outra data"}</button>)}</div>
      {quando === "outra" && <div style={{ marginTop: 8 }}><CampoData valor={outra} onChange={setOutra} max={isoDia()} titulo={ehEntrada ? "Data da entrada" : "Data do pagamento"} /></div>}
      {erro && <p className="fo-erro">{erro}</p>}
      {!ehEntrada && onContaAPagar && <button type="button" className="fo-sec neutro" onClick={onContaAPagar}>É uma conta pra pagar depois? Cadastre em A pagar</button>}
    </Folha>
  );
}
