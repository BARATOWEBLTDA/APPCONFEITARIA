import CampoData from '@/components/CampoData'
import { useMemo, useRef, useState } from "react";
import { mascaraBRL, lerBRL } from "@/lib/moeda";
import Folha from "@/components/financeiro/Folha";
import { Botao } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { faltaNoBanco } from "@/lib/pagamentos";
import { APORTE, RETIRADA, nomeCategoriaFin } from "@/lib/categoriasFinanceiro";

/**
 * Financeiro · "Nova entrada" e "Nova saída".
 * (4.29) Revisão:
 *   · entrada pergunta como recebeu (Pix, dinheiro, crédito, débito) e entra em "Formas de pagamento"
 *   · "Aporte (dinheiro seu)" e "Retirada pra você" mexem no caixa, mas não contam como venda nem como despesa
 *   · data antes de informar o saldo em caixa: avisa que o saldo não muda
 * (4.29 · registrar mais rápido)
 *   · saída: "Já paguei" ou "Vou pagar" na mesma janela. "Vou pagar" vira conta em A pagar (não mexe no caixa)
 *   · categorias: as 5 que ela mais usa primeiro (neste aparelho) e abre na última usada; o resto em "Mais"
 *   · "Lançar e nova": lança, limpa valor e descrição e deixa a janela aberta (mesma categoria e data)
 */
const CATEGORIAS = ["Insumos", "Embalagens", "Gás", "Transporte", "Aluguel", "Energia e água", "Internet", "Marketing", "Equipamentos", "Impostos e taxas", RETIRADA, "Outros"];
const CATEGORIAS_ENTRADA = ["Venda no balcão", "Venda fora do app", APORTE, "Outros"];
const FORMAS = [{ k: "pix", l: "Pix" }, { k: "dinheiro", l: "Dinheiro" }, { k: "credito", l: "Crédito" }, { k: "debito", l: "Débito" }];
const VISIVEIS = 5;
/** Nome curto no botão (cabe sem cortar no celular); o valor salvo continua o mesmo */
const CURTO: Record<string, string> = { "Energia e água": "Luz e água", "Impostos e taxas": "Impostos", [RETIRADA]: "Retirada", [APORTE]: "Dinheiro seu" };
const rotulo = (c: string) => CURTO[c] || nomeCategoriaFin(c);
const isoDia = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/** Quantas vezes ela usou cada categoria e qual foi a última (só neste aparelho; sem acesso, volta a ordem padrão). */
type Uso = { uso: Record<string, number>; ultima?: string };
const chaveUso = (tipo: string) => `doonly_fin_cat_${tipo}`;
const lerUso = (tipo: string): Uso => { try { return JSON.parse(localStorage.getItem(chaveUso(tipo)) || "") || { uso: {} }; } catch { return { uso: {} }; } };
const gravarUso = (tipo: string, cat: string) => {
  try { const u = lerUso(tipo); u.uso = { ...(u.uso || {}), [cat]: ((u.uso || {})[cat] || 0) + 1 }; u.ultima = cat; localStorage.setItem(chaveUso(tipo), JSON.stringify(u)); } catch { /* sem acesso */ }
};

export default function DespesaSheet({ onClose, onSalvo, onReceberPedido, tipo = "saida", inicioCaixa, inicialAPagar = false }: {
  onClose: () => void;
  /** aviso de sucesso; continuar = "Lançar e nova" (a janela fica aberta) */
  onSalvo: (aviso: string, continuar?: boolean) => void;
  onReceberPedido?: () => void; tipo?: "entrada" | "saida";
  /** dia (AAAA-MM-DD) em que ela informou o saldo em caixa; data antes disso não mexe no saldo */
  inicioCaixa?: string | null;
  /** saída: já abre em "Vou pagar" (atalho "Nova conta a pagar") */
  inicialAPagar?: boolean;
  /** @deprecated "Vou pagar" agora fica na própria janela */
  onContaAPagar?: () => void;
}) {
  const ehEntrada = tipo === "entrada";
  const todas = ehEntrada ? CATEGORIAS_ENTRADA : CATEGORIAS;
  const usoInicial = useMemo(() => lerUso(tipo), [tipo]);
  // as mais usadas primeiro; empate fica na ordem padrão
  const ordem = useMemo(() => [...todas].sort((a, b) => ((usoInicial.uso || {})[b] || 0) - ((usoInicial.uso || {})[a] || 0)), [todas, usoInicial]);
  const [categoria, setCategoria] = useState(() => (usoInicial.ultima && todas.includes(usoInicial.ultima) ? usoInicial.ultima : ordem[0]));
  const [verTodas, setVerTodas] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [forma, setForma] = useState("pix");
  const [valor, setValor] = useState("");
  const [pago, setPago] = useState(!inicialAPagar); // saída: true = já paguei · false = vou pagar
  const [vencimento, setVencimento] = useState(isoDia(7));
  const [quando, setQuando] = useState<"hoje" | "ontem" | "outra">("hoje");
  const [outra, setOutra] = useState(isoDia(-2));
  const [salvando, setSalvando] = useState<"" | "um" | "mais">("");
  const [erro, setErro] = useState("");
  const campoValor = useRef<HTMLInputElement>(null);

  const visiveis = useMemo(() => {
    if (verTodas || ordem.length <= VISIVEIS + 1) return ordem;
    const v = ordem.slice(0, VISIVEIS);
    return v.includes(categoria) ? v : [...v.slice(0, VISIVEIS - 1), categoria];
  }, [ordem, verTodas, categoria]);
  const escondidas = ordem.length - visiveis.length;

  const aPagar = !ehEntrada && !pago;
  const data = quando === "hoje" ? isoDia() : quando === "ontem" ? isoDia(-1) : outra;
  const antesDoCaixa = !aPagar && !!inicioCaixa && !!data && data < inicioCaixa;

  const salvar = async (continuar: boolean) => {
    if (salvando) return;
    const v = lerBRL(valor);
    if (v <= 0) { setErro(ehEntrada ? "Digite quanto entrou" : aPagar ? "Digite o valor da conta" : "Digite quanto você pagou"); return; }
    if (aPagar && !vencimento) { setErro("Escolha quando vence"); return; }
    if (!aPagar && (!data || data > isoDia())) { setErro(ehEntrada ? "Escolha uma data até hoje" : "Escolha uma data até hoje. Se ainda vai pagar, use Vou pagar."); return; }
    setSalvando(continuar ? "mais" : "um"); setErro("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSalvando(""); setErro("Sua sessão expirou. Entre de novo pra lançar."); return; }
    const desc = descricao.trim() || nomeCategoriaFin(categoria);
    let error: any;
    if (aPagar) {
      ({ error } = await supabase.from("contas_pagar").insert({ user_id: user.id, descricao: desc, categoria, valor: v, vencimento }));
    } else {
      const linha: Record<string, unknown> = { user_id: user.id, tipo: ehEntrada ? "entrada" : "saida", categoria, descricao: desc, valor: v, data };
      ({ error } = await supabase.from("financeiro").insert(ehEntrada ? { ...linha, forma } : linha));
      // sem a coluna forma (SQL 4.31 não rodado): grava sem ela
      if (error && ehEntrada && faltaNoBanco(error)) ({ error } = await supabase.from("financeiro").insert(linha));
    }
    setSalvando("");
    if (error) {
      console.error("[financeiro] não consegui lançar:", error);
      setErro(aPagar && faltaNoBanco(error) ? "Pra guardar contas a pagar, rode o SQL das contas a pagar no Supabase." : "Não deu pra salvar agora. Confira a internet e tente de novo.");
      return;
    }
    gravarUso(tipo, categoria);
    const aviso = aPagar
      ? `Conta de ${brl(v)} guardada em A pagar. Vence ${dataBR(vencimento)}.`
      : `${ehEntrada ? "Entrada" : "Saída"} de ${brl(v)} lançada${data === isoDia() ? "" : data === isoDia(-1) ? " com data de ontem" : ` com data de ${dataBR(data)}`}.`;
    if (continuar) { setValor(""); setDescricao(""); campoValor.current?.focus(); }
    onSalvo(aviso, continuar);
  };

  const notaCategoria = categoria === APORTE ? "Dinheiro seu colocado na confeitaria (aporte). Entra no saldo em caixa, mas não conta como venda."
    : categoria === RETIRADA ? "Dinheiro que você tirou pra você. Sai do saldo em caixa, mas não conta como despesa do negócio." : "";
  const rotuloPrincipal = ehEntrada ? "Lançar entrada" : aPagar ? "Guardar conta a pagar" : "Lançar saída";

  return (
    <Folha titulo={ehEntrada ? "Nova entrada" : "Nova saída"} onClose={onClose} umaAcao={aPagar}
      sub={ehEntrada ? "Dinheiro que entrou fora dos pedidos do app." : undefined}
      acoes={aPagar
        ? <Botao cheio carregando={salvando === "um"} onClick={() => salvar(false)}>{rotuloPrincipal}</Botao>
        : <><Botao variante="secundario" carregando={salvando === "mais"} onClick={() => salvar(true)} className="fo-bt-curto">Lançar e nova</Botao>
            <Botao carregando={salvando === "um"} onClick={() => salvar(false)} className="fo-bt-curto">{rotuloPrincipal}</Botao></>}>
      <label className="fo-lb" htmlFor="dsp-v">{ehEntrada ? "Quanto entrou?" : "Quanto?"}</label>
      <div className="fo-in fo-in--grande"><span>R$</span><input id="dsp-v" ref={campoValor} inputMode="numeric" autoComplete="off" placeholder="0,00" value={valor} onChange={e => { setValor(mascaraBRL(e.target.value)); setErro(""); }} /></div>
      {!ehEntrada && (
        <div className="fo-seg fo-seg--topo" role="radiogroup" aria-label="Já pagou?">
          <button type="button" role="radio" aria-checked={pago} className={pago ? "on" : ""} onClick={() => { setPago(true); setErro(""); }}>Já paguei</button>
          <button type="button" role="radio" aria-checked={!pago} className={!pago ? "on" : ""} onClick={() => { setPago(false); setErro(""); }}>Vou pagar</button>
        </div>
      )}
      <p className="fo-lb">{ehEntrada ? "De onde veio?" : "Com o quê?"}</p>
      <div className={`fo-grade${ehEntrada ? " fo-grade--2" : ""}`}>
        {visiveis.map(c => <button type="button" key={c} className={categoria === c ? "on" : ""} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{rotulo(c)}</button>)}
        {escondidas > 0 && <button type="button" className="mais" onClick={() => setVerTodas(true)}>Mais {escondidas}</button>}
      </div>
      {notaCategoria && <p className="fo-nota">{notaCategoria}</p>}
      {ehEntrada && (<>
        <p className="fo-lb">Como recebeu?</p>
        <div className="fo-grade fo-grade--4">{FORMAS.map(f => <button type="button" key={f.k} className={forma === f.k ? "on" : ""} aria-pressed={forma === f.k} onClick={() => setForma(f.k)}>{f.l}</button>)}</div>
      </>)}
      <label className="fo-lb" htmlFor="dsp-d">Descrição <em>(opcional)</em></label>
      <input id="dsp-d" className="fo-txt" autoComplete="off" maxLength={80}
        placeholder={ehEntrada ? "Ex.: 30 brigadeiros pra vizinha" : aPagar ? "Ex.: aluguel da cozinha" : "Ex.: Atacadão, leite condensado"}
        value={descricao} onChange={e => setDescricao(e.target.value)} />
      {aPagar ? (<>
        <p className="fo-lb">Vence quando?</p>
        <CampoData valor={vencimento} onChange={setVencimento} titulo="Vencimento" />
        <p className="fo-nota fo-nota--amarela">Não sai do caixa agora. Fica em A pagar.</p>
      </>) : (<>
        <p className="fo-lb">{ehEntrada ? "Quando entrou?" : "Quando pagou?"}</p>
        <div className="fo-seg">{(["hoje", "ontem", "outra"] as const).map(q => <button type="button" key={q} className={quando === q ? "on" : ""} aria-pressed={quando === q} onClick={() => setQuando(q)}>{q === "hoje" ? "Hoje" : q === "ontem" ? "Ontem" : "Outra data"}</button>)}</div>
        {quando === "outra" && <div style={{ marginTop: 8 }}><CampoData valor={outra} onChange={setOutra} max={isoDia()} titulo={ehEntrada ? "Data da entrada" : "Data do pagamento"} /></div>}
        {antesDoCaixa && <p className="fo-nota">Essa data é de antes de você informar o saldo em caixa, então o saldo não muda (esse dinheiro já estava na conta). Entra nos números do período.</p>}
      </>)}
      {erro && <p className="fo-erro">{erro}</p>}
      {ehEntrada && onReceberPedido && <button type="button" className="fo-sec neutro" onClick={onReceberPedido}>É de um pedido? Use Receber pedido</button>}
    </Folha>
  );
}
