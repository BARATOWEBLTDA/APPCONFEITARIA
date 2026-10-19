import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import MapaEndereco, { type BuscaMapa } from "@/components/MapaEndereco";
import { DicaDescricao, EXEMPLO_DESCRICAO, EditorHorario, OpcoesMostrar, type Horario } from "@/components/loja/EditoresLoja";
import { useNavigate } from "react-router-dom";
import { Check, PencilSimpleLine, ImageSquare, MapPin, Clock, Basket, Wallet, Coins, Sparkle, CaretRight, Camera } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { useProfile, refreshProfile } from "@/hooks/useProfile";
import { ImageCropper } from "@/components/ui/ImageCropper";
import Janelinha from "@/components/financeiro/Folha";
import Destaque from "@/components/Destaque";
import { marcarPagamentoConferido } from "@/lib/primeirosPassos";
import { criarNotificacaoPessoal } from "@/lib/notificacoesUsuario";
import { lerPassos, passosCompletos, avisarPassos, atualizarPerfil, marcarLogoOk, type EstadoPassos } from "@/lib/primeirosPassos";

import { Botao, avisar } from "@/components/base";
import { LojaProntaCartao } from "@/components/loja/LojaPronta";
import { erroDeConexao, SEM_INTERNET } from "@/lib/erros";
import { definirSaldoInicial } from "@/lib/caixa";
import { mascaraBRL, lerBRL } from "@/lib/moeda";
/**
 * "Primeiros passos" (aprovado 02/10) — o MESMO cartão no Início (celular) e no Cardápio digital.
 * 7 passos (13/10: + "Pagamento e entrega"); os que dá pra preencher abrem numa janelinha que sobe de baixo, sem sair da tela:
 * descrição (com IA), logo (com recorte), endereço (CEP preenche sozinho) e horário.
 * Salva exatamente como os Dados da loja (endereço e horário em JSON no profiles).
 */
type Local = "inicio" | "cardapio";
type Folha = null | "descricao" | "logo" | "endereco" | "horario" | "pagamento" | "caixa";

const HORARIO_PADRAO = {
  dias: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"], abertura: "08:00", fechamento: "18:00",
  abre_sabado: false, sabado_abertura: "09:00", sabado_fechamento: "14:00",
  abre_domingo: false, domingo_abertura: "09:00", domingo_fechamento: "14:00",
};
// (13/10) ordem dos passos: "Salvar e continuar" abre o próximo que falta, e o "Configurar minha confeitaria" abre o primeiro
// 13/10: o logo vem antes da descrição, assim a prévia da descrição já mostra o logo dela ao lado do nome
const ORDEM = ["logo", "descricao", "endereco", "horario", "pagamento", "caixa", "produto"] as const;
type Passo = typeof ORDEM[number];
// (13/10) a sequência guiada vai até o pagamento: o produto fica livre (ela cadastra quando quiser, navegando pelo app)
const SEQ: Passo[] = ORDEM.filter(k => k !== "produto");
const proximoPasso = (e: EstadoPassos, feitoAgora?: Passo, pulados: Set<Passo> = new Set()): Passo | null =>
  SEQ.find(k => k !== feitoAgora && !pulados.has(k) && !e[k]) || null;

/** (13/10) Topo de cada card: "Passo 2 de 6" e a barrinha */
function PassoTopo({ k }: { k: Passo }) {
  const n = SEQ.indexOf(k) + 1;
  return (
    <div className="ppf-topo" aria-label={`Passo ${n} de ${SEQ.length}`}>
      <span>Passo <b>{n} de {SEQ.length}</b></span>
      <div className="ppf-barra" aria-hidden="true">{SEQ.map((x, i) => <i key={x} className={i < n ? "on" : ""} />)}</div>
    </div>
  );
}

const maskCep = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

export default function PrimeirosPassos({ local = "inicio", onEstado }: { local?: Local; onEstado?: (completo: boolean) => void }) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const uid = profile?.id as string | undefined;
  const [estado, setEstado] = useState<EstadoPassos | null>(null);
  const [folha, setFolha] = useState<Folha>(null);
  const [fechado, setFechado] = useState(false);
  const [jaViuIncompleto, setJaViuIncompleto] = useState(false);
  const kFechado = uid ? `doonly_pp_fechado_${uid}` : "";
  const kIncompleto = uid ? `doonly_pp_incompleto_${uid}` : "";
  const pulados = useRef<Set<Passo>>(new Set());
  // o que acabou de ser salvo (logo novo), até a releitura dos passos chegar
  const [perfilNovo, setPerfilNovo] = useState<Record<string, any>>({});
  const abrirPasso = useCallback((k: Passo) => {
    // (13/10) pagamento e entrega virou um card como os outros (antes abria a tela inteira de Entrega e pagamento)
    // (15/10) abre a tela de produtos com a apresentação "Cadastre seu primeiro produto" (antes ia direto pro cadastro)
    if (k === "produto") navigate("/produtos");
    else setFolha(k);
  }, [navigate]);

  // Quem vem do "Configurar minha confeitaria" das boas-vindas: rola até aqui e destaca o passo da vez (09/10 · 3.67)
  const raiz = useRef<HTMLDivElement>(null);
  const [destaque, setDestaque] = useState(false);
  const [spot, setSpot] = useState(false);
  const atRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // (13/10) o pedido é lido uma vez e os tempos não são cancelados quando o estado relê (antes uma releitura
  // logo depois de abrir cancelava o destaque, e o pedido já tinha sido apagado: nada acontecia)
  const pedidoDestaque = useRef<boolean | null>(null);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  useEffect(() => {
    if (local !== "inicio" || !estado || !raiz.current) return;
    if (pedidoDestaque.current === null) {
      try { pedidoDestaque.current = sessionStorage.getItem("doonly_pp_destacar") === "1"; sessionStorage.removeItem("doonly_pp_destacar"); } catch { pedidoDestaque.current = false; }
    }
    if (!pedidoDestaque.current) return;
    pedidoDestaque.current = false;
    // (15/10) o Início abre no topo (o cartão já fica logo ali; rolar até ele empurrava a tela pra baixo).
    // Celular, primeira vez: o destaque do "Começar". Senão: o passo da vez pisca.
    window.scrollTo(0, 0);
    const kSpot = uid ? `doonly_pp_destaque_visto_${uid}` : "";
    let viu = true;
    try { viu = !kSpot || localStorage.getItem(kSpot) === "1"; } catch {}
    const celular = window.matchMedia("(max-width: 767px)").matches;
    // espera outra janela (boas-vindas, conta ativa) fechar antes de mostrar o destaque
    let tentativas = 0;
    const mostrar = () => {
      if (!montado.current) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]') && tentativas++ < 40) { window.setTimeout(mostrar, 500); return; }
      window.scrollTo(0, 0);
      if (celular && !viu) { try { localStorage.setItem(kSpot, "1"); } catch {} setSpot(true); return; }
      setDestaque(true);
      window.setTimeout(() => { if (montado.current) setDestaque(false); }, 2300);
    };
    window.setTimeout(mostrar, 450);
  }, [local, estado]);

  // (10/10) leitura que falhou não conclui nada: fica o que já estava na tela (ou escondido) até ler com sucesso
  const atualizar = useCallback(() => { if (uid) lerPassos(uid).then(e => { if (!e.falhou) setEstado(e); }).catch(() => {}); }, [uid]);

  useEffect(() => {
    if (!uid) return;
    try { setFechado(localStorage.getItem(kFechado) === "1"); setJaViuIncompleto(localStorage.getItem(kIncompleto) === "1"); } catch {}
    atualizar();
    const f = () => { if (document.visibilityState === "visible") atualizar(); };
    document.addEventListener("visibilitychange", f);
    window.addEventListener("focus", atualizar);
    window.addEventListener("doonly:passos", atualizar);
    return () => { document.removeEventListener("visibilitychange", f); window.removeEventListener("focus", atualizar); window.removeEventListener("doonly:passos", atualizar); };
  }, [uid, atualizar, kFechado, kIncompleto]);

  const completo = passosCompletos(estado);
  // (15/10) saiu a janela "Sua loja está pronta!": abria junto com o cartão "Sua confeitaria está pronta pra vender!"
  useEffect(() => { if (estado) onEstado?.(completo); }, [estado, completo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (uid && estado && !completo && !jaViuIncompleto) { try { localStorage.setItem(kIncompleto, "1"); } catch {} setJaViuIncompleto(true); }
  }, [uid, estado, completo, jaViuIncompleto, kIncompleto]);

  if (!uid || !estado) return null;

  // No Cardápio digital o cartão some quando está tudo pronto (a tela mostra o cartão do link)
  if (completo && (local === "cardapio" || fechado || !jaViuIncompleto)) return null;

  const fechar = () => { try { localStorage.setItem(kFechado, "1"); } catch {} setFechado(true); };
  // "Salvar e continuar": fecha e abre o próximo passo que falta.
  // "Fazer depois": pula este (fica pendente) e segue pro próximo, sem voltar nele nesta sequência.
  const seguir = (pular: boolean, patch?: Record<string, any>) => {
    if (patch) setPerfilNovo(p => ({ ...p, ...patch }));
    const agora = folha as Passo | null;
    if (pular && agora) pulados.current.add(agora);
    setFolha(null); if (!pular) avisarPassos();
    const prox = agora ? proximoPasso(estado, agora, pulados.current) : null;
    if (prox) window.setTimeout(() => abrirPasso(prox), 250);
    else if (agora) avisar(pulados.current.size ? "Pronto por agora!" : "Tudo configurado!", { tipo: "ok" });
  };
  const salvo = (patch?: Record<string, any>) => seguir(false, patch);
  const depois = () => seguir(true);


  if (completo) {
    return (
      <>
        {/* (16/10) cartão pequeno: antes ocupava quase a tela toda */}
        <LojaProntaCartao profile={profile} onFechar={fechar} />
        <style>{CSS}</style>
      </>
    );
  }

  const I = (C: any) => <C size={20} weight="regular" />;
  const passos: { feito: boolean; ic: ReactNode; t: string; s: string; abrir: () => void }[] = [
    { feito: true, ic: I(Check), t: "Criar sua conta", s: "Pronto! Boas-vindas ao Doonly", abrir: () => {} },
    { feito: estado.logo, ic: I(ImageSquare), t: "Colocar o logo da loja", s: "Ou use a sua foto de perfil", abrir: () => setFolha("logo") },
    { feito: estado.descricao, ic: I(PencilSimpleLine), t: "Sobre a sua confeitaria", s: "Uma frase no topo do cardápio", abrir: () => setFolha("descricao") },
    { feito: estado.endereco, ic: I(MapPin), t: "Endereço da loja", s: "Pra calcular a entrega", abrir: () => setFolha("endereco") },
    { feito: estado.horario, ic: I(Clock), t: "Horário de funcionamento", s: "Mostra \"Aberto agora\" no cardápio", abrir: () => setFolha("horario") },
    { feito: estado.pagamento, ic: I(Wallet), t: "Pagamento e entrega", s: "Como o cliente paga e recebe", abrir: () => abrirPasso("pagamento") },
    { feito: estado.caixa, ic: I(Coins), t: "Saldo do caixa", s: "Quanto tem em caixa hoje", abrir: () => setFolha("caixa") },
    // (13/10) quando só falta o produto, o texto chama pro cardápio ir pro ar
    { feito: estado.produto, ic: I(Basket), t: "Cadastrar um produto", s: "", abrir: () => navigate("/produtos") },
  ];
  const ultimoQueFalta = passos.filter(p => !p.feito).length === 1;
  passos[passos.length - 1].s = ultimoQueFalta ? "Falta só isso pro cardápio ir pro ar" : "Seu primeiro doce no cardápio";
  const feitos = passos.filter(p => p.feito).length;
  const atual = passos.findIndex(p => !p.feito);

  return (
    <div ref={raiz} className={`pp pp--${local}${destaque ? " pp--destaque" : ""}`}>
      <b className="pp-t">Primeiros passos</b>
      <p className="pp-sub">{passos.length - feitos === 1 ? "Falta 1 passo pra abrir o cardápio." : `Faltam ${passos.length - feitos} passos pra abrir o cardápio.`}</p>
      <div className="pp-bar" aria-label={`${feitos} de ${passos.length} passos feitos`}><i style={{ width: `${(feitos / passos.length) * 100}%` }} /></div>
      {passos.map((p, i) => i === atual ? (
        <div key={p.t} className="pp-at" ref={atRef}>
          <div className="pp-ps pp-ps--sem">
            <span className="pp-ic pp-ic--at">{p.ic}<i className="pp-n">{i + 1}</i></span>
            <span className="pp-tx"><b>{p.t}</b><small>{p.s}</small></span>
          </div>
          <button type="button" className="pp-btn" ref={btnRef} onClick={p.abrir}>{feitos <= 1 ? "Começar" : "Fazer agora"}</button>
          {spot && <Destaque alvo={atRef} toque={btnRef} mascote titulo="Comece por aqui" texto="Em poucos minutos seu cardápio fica pronto pra vender." acao="Começar" aoAcao={() => { setSpot(false); p.abrir(); }} aoFechar={() => setSpot(false)} />}
        </div>
      ) : (
        <button type="button" key={p.t} className={`pp-ps${p.feito ? " pp-ps--ok" : ""}`} onClick={p.feito ? undefined : p.abrir} disabled={p.feito}>
          <span className={`pp-ic${p.feito ? " pp-ic--ok" : ""}`}>{p.feito ? I(Check) : <>{p.ic}<i className="pp-n">{i + 1}</i></>}</span>
          <span className="pp-tx"><b>{p.t}</b><small>{p.feito ? "Feito" : p.s}</small></span>
          {!p.feito && <span className="pp-seta"><CaretRight size={16} weight="bold" /></span>}
        </button>
      ))}

      {folha === "descricao" && <FolhaDescricao uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "logo" && <FolhaLogo uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "endereco" && <FolhaEndereco uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "pagamento" && <FolhaPagamento uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "caixa" && <FolhaCaixa uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "horario" && <FolhaHorario uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      <style>{CSS}</style>
    </div>
  );
}


const PAGA: [string, string][] = [["pix", "Pix"], ["dinheiro", "Dinheiro"], ["credito", "Crédito"], ["debito", "Débito"]];

/**
 * (13/10) Passo 5: só as opções, já vindo tudo marcado (ela desmarca o que não usa).
 * A taxa de entrega saiu daqui: com Entrega marcada e sem taxa, fica um aviso (notificação e "Pra vender mais") pra ela definir depois.
 */
function FolhaPagamento({ uid, onClose, onSalvo, onDepois }: FolhaProps) {
  const [paga, setPaga] = useState<string[]>(PAGA.map(([k]) => k));
  const [entrega, setEntrega] = useState<string[]>(["retirada", "entrega_propria"]);
  const [taxaAtual, setTaxaAtual] = useState(0);
  const [carregou, setCarregou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    supabase.from("profiles").select("formas_pagamento, formas_entrega, valor_entrega_propria, entrega_por_bairro").eq("id", uid).maybeSingle().then(({ data }) => {
      if (!vivo) return;
      const d: any = data || {};
      // o padrão do banco (só Pix / só retirada) conta como "não escolheu ainda": fica tudo marcado
      const fp: string[] = Array.isArray(d.formas_pagamento) ? d.formas_pagamento : [];
      const fe: string[] = Array.isArray(d.formas_entrega) ? d.formas_entrega : [];
      if (fp.length && !(fp.length === 1 && fp[0] === "pix")) setPaga(fp);
      if (fe.length && !(fe.length === 1 && fe[0] === "retirada")) setEntrega(fe);
      setTaxaAtual(Number(d.valor_entrega_propria) > 0 || (Array.isArray(d.entrega_por_bairro) && d.entrega_por_bairro.length) ? 1 : 0);
      setCarregou(true);
    }, () => { if (vivo) setCarregou(true); });
    return () => { vivo = false; };
  }, [uid]);
  const temEntrega = entrega.some(e => e !== "retirada");
  const trocarPaga = (k: string) => setPaga(l => l.includes(k) ? l.filter(x => x !== k) : [...l, k]);
  const trocarEntrega = (k: "retirada" | "entrega") => setEntrega(l => {
    if (k === "retirada") return l.includes("retirada") ? l.filter(x => x !== "retirada") : ["retirada", ...l];
    // "Entrega" aqui é a entrega própria; motoboy e Uber Flash (marcados na outra tela) continuam como estão
    return temEntrega ? l.filter(x => x === "retirada") : [...l, "entrega_propria"];
  });
  const pronto = paga.length > 0 && entrega.length > 0;
  const salvar = async () => {
    if (!pronto) return;
    setSalvando(true); setErro("");
    const { error } = await supabase.from("profiles").update({ formas_pagamento: paga, formas_entrega: entrega }).eq("id", uid);
    setSalvando(false);
    if (error) { setErro(erroDeConexao(error) ? SEM_INTERNET : "Não foi possível salvar agora. Tente de novo."); return; }
    marcarPagamentoConferido(uid);
    if (entrega.includes("entrega_propria") && !taxaAtual) {
      criarNotificacaoPessoal({ tipo: "aviso", titulo: "Defina a taxa de entrega", mensagem: "Você marcou entrega. Enquanto não tiver taxa, o cardápio mostra entrega grátis.", link: "/checkout-config", chave: "taxa_entrega_pendente" }).catch(() => {});
    }
    onSalvo();
  };
  const opc = (on: boolean, rot: string, fn: () => void) => (
    <button type="button" key={rot} className={on ? "on" : ""} aria-pressed={on} onClick={fn}><i>{on && <Check size={13} weight="bold" />}</i>{rot}</button>
  );
  return (
    <Janelinha foco titulo="Pagamento e entrega" onClose={onClose}
      acoes={<><Botao variante="secundario" onClick={onDepois}>Agora não</Botao><Botao cheio disabled={!pronto || !carregou} carregando={salvando} onClick={salvar}>Salvar e continuar</Botao></>}>
      <PassoTopo k="pagamento" />
      <p className="ppf-l ppf-h-tit">Como o cliente paga?</p>
      <div className="ppf-p-opc">{PAGA.map(([k, n]) => opc(paga.includes(k), n, () => trocarPaga(k)))}</div>
      {/* (15/10) retirada e entrega em linhas, igual ao endereço e ao horário */}
      <p className="ppf-l ppf-h-tit">Como ele recebe?</p>
      <div className="ppf-mos ppf-mos--chk">
        {([
          ["retirada", "Retirada", "O cliente busca no seu endereço", entrega.includes("retirada")],
          ["entrega", "Entrega", "Você leva até o cliente", temEntrega],
        ] as const).map(([k, t, sub, on]) => (
          <button type="button" role="checkbox" aria-checked={on} key={k} className={on ? "on" : ""} onClick={() => trocarEntrega(k)}>
            <i aria-hidden="true">{on && <Check size={13} weight="bold" />}</i><span><b>{t}</b><small><em>{sub}</em></small></span>
          </button>
        ))}
      </div>
      <p className="ppf-p-dica">Desmarque o que você não usa.</p>
      {erro && <p className="ppf-erro">{erro}</p>}
    </Janelinha>
  );
}

/* ── (13/10) Passo 6: quanto ela tem em caixa hoje. Daqui pra frente o Financeiro soma o que entra e tira o que sai. ── */
function FolhaCaixa({ uid, onClose, onSalvo, onDepois }: FolhaProps) {
  const [txt, setTxt] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const salvar = async (zero = false) => {
    if (salvando) return;
    setSalvando(true); setErro("");
    const r = await definirSaldoInicial(uid, zero ? 0 : lerBRL(txt || "0"));
    setSalvando(false);
    if (!r.ok) { setErro(erroDeConexao(r.erro) ? SEM_INTERNET : "Não foi possível salvar agora. Tente de novo."); return; }
    supabase.auth.updateUser({ data: { pp_caixa: true } }).then(() => {}, () => {});
    onSalvo();
  };
  return (
    <Janelinha foco titulo="Saldo do caixa" onClose={onClose}
      acoes={<><Botao variante="secundario" onClick={onDepois}>Agora não</Botao><Botao cheio carregando={salvando} onClick={() => salvar()}>Salvar e continuar</Botao></>}>
      <PassoTopo k="caixa" />
      {/* (15/10) pergunta curta, "Começo do zero", o porquê numa caixinha e o aviso do sinal já recebido */}
      <p className="ppf-l ppf-h-tit">Quanto tem hoje no caixa?</p>
      <div className="ppf-cx"><span>R$</span><input inputMode="numeric" autoComplete="off" placeholder="0,00" value={txt} aria-label="Saldo do caixa hoje"
        onChange={e => { setTxt(mascaraBRL(e.target.value)); setErro(""); }} onKeyDown={e => { if (e.key === "Enter") salvar(); }} /></div>
      <button type="button" className="ppf-cx-zero" disabled={salvando} onClick={() => salvar(true)}>Começo do zero</button>
      <div className="ppf-d-dica ppf-cx-dica">
        <p>Por que isso?</p>
        <ul>
          <li>O app soma o que entra e tira o que sai</li>
          <li>Você sabe quanto tem, todo dia</li>
          <li>Dá pra mudar depois no Financeiro</li>
        </ul>
      </div>
      <div className="ppf-cx-av"><b>Já recebeu sinal de alguma encomenda?</b>Ao cadastrar o pedido, coloque a data em que recebeu. Assim o app não conta duas vezes.</div>
      {erro && <p className="ppf-erro">{erro}</p>}
    </Janelinha>
  );
}

/* ── Janelinha: a Janela de formulário do app (components/financeiro/Folha) ── */
type FolhaProps = { uid: string; perfil: any; onClose: () => void; onSalvo: (patch?: Record<string, any>) => void; onDepois: () => void };

const FAZ = ["Bolos", "Doces", "Salgados", "Tortas", "Kit festa", "Outros"];

function FolhaDescricao({ uid, perfil, onClose, onSalvo, onDepois }: FolhaProps) {
  const [txt, setTxt] = useState(String(perfil?.descricao_loja || ""));
  const nomeLoja = String(perfil?.nome_loja || "Sua confeitaria").trim() || "Sua confeitaria";
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // (13/10) a Doo IA pergunta o que ela faz antes de escrever
  const [perguntando, setPerguntando] = useState(false);
  const [faz, setFaz] = useState<string[]>([]);
  const [escreveu, setEscreveu] = useState(false);
  const gerar = async () => {
    setGerando(true); setErro("");
    const oQue = faz.filter(f => f !== "Outros").map(f => f.toLowerCase());
    try {
      const res = await apiFetch("/api/gerar-descricao", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Crie uma descrição atraente para uma confeitaria chamada "${nomeLoja}"${oQue.length ? `, que faz ${oQue.join(", ")}` : ""}. Entre 110 e 160 caracteres (umas 3 linhas no celular), português brasileiro, diga o que a confeitaria faz e pra quais ocasiões, transmita carinho e qualidade. Sem emojis. Retorne APENAS a descrição, sem aspas.` }) });
      const data = await res.json();
      if (data?.error === "limite_diario") { setErro(data.message || "Você chegou ao limite de hoje. Amanhã libera de novo."); setGerando(false); return; }
      const t = data.content?.[0]?.text?.trim();
      if (t) { setTxt(t.replace(/^["“]|["”]$/g, "").slice(0, 200)); setEscreveu(true); setPerguntando(false); }
      else setErro("A Doo IA não conseguiu escrever agora. Tente de novo.");
    } catch { setErro("Sem internet agora. Tente de novo em instantes."); }
    setGerando(false);
  };
  const salvar = async () => {
    if (!txt.trim()) return;
    setSalvando(true); setErro("");
    const e = await atualizarPerfil(uid, { descricao_loja: txt.trim() });
    setSalvando(false);
    if (e) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onSalvo();
  };
  return (
    <Janelinha foco titulo="Sobre a sua confeitaria" onClose={onClose}
      acoes={<><Botao variante="secundario" onClick={onDepois}>Agora não</Botao><Botao cheio disabled={!txt.trim()} carregando={salvando} onClick={salvar}>Salvar e continuar</Botao></>}>
      <div className="ppf-d">
        <PassoTopo k="descricao" />
        {/* (15/10) saiu a prévia do topo do cardápio (sem foto ficava estranha): no lugar, uma dica do que escrever */}
        <DicaDescricao />

        {perguntando ? (
          <div className="ppf-d-perg">
            <p className="ppf-d-perg-t"><i><Sparkle size={14} weight="fill" /></i>O que você faz?</p>
            <p className="ppf-d-perg-s">Marque e a Doo IA escreve pra você.</p>
            <div className="ppf-d-opc">
              {FAZ.map(f => {
                const on = faz.includes(f);
                return <button type="button" key={f} className={on ? "on" : ""} aria-pressed={on} onClick={() => setFaz(l => on ? l.filter(x => x !== f) : [...l, f])}>{f}</button>;
              })}
            </div>
            <div className="ppf-d-perg-pe">
              <button type="button" className="ppf-d-voltar" onClick={() => setPerguntando(false)}>Voltar</button>
              <Botao tamanho="m" carregando={gerando} onClick={gerar}>Escrever</Botao>
            </div>
          </div>
        ) : (
          <div className="ppf-d-campo">
            <textarea id="pp-desc" autoComplete="off" value={txt} maxLength={200} aria-label="Descrição da sua confeitaria"
              placeholder={EXEMPLO_DESCRICAO}
              onChange={e => setTxt(e.target.value)} />
            <div className="ppf-d-pe">
              <button type="button" className="ppf-doo" onMouseDown={e => e.preventDefault()} onClick={() => setPerguntando(true)}>
                <Sparkle size={16} weight="fill" aria-hidden="true" />{escreveu ? "Escrever de novo" : "Escrever com a Doo IA"}
              </button>
              <span>{txt.length}/200</span>
            </div>
          </div>
        )}
        {erro && <p className="ppf-erro">{erro}</p>}
      </div>
    </Janelinha>
  );
}

function FolhaLogo({ uid, perfil, onClose, onSalvo, onDepois }: FolhaProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const atual = perfil?.logo_url || perfil?.foto_url || "";
  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setCrop(r.result as string); r.readAsDataURL(f); e.target.value = "";
  };
  const enviar = async (blob: Blob) => {
    setCrop(null); setEnviando(true);
    const path = `logos/${uid}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      marcarLogoOk(uid);
      const logoUrl = `${data.publicUrl}?t=${Date.now()}`;
      const e = await atualizarPerfil(uid, { logo_url: logoUrl, design_escolhido: true, logo_confirmado: true }, ["design_escolhido", "logo_confirmado"]);
      setEnviando(false);
      if (e) { avisar("Não foi possível salvar agora. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
      refreshProfile(); // o círculo da conta (menu) já mostra a logo
      onSalvo({ logo_url: logoUrl }); return;
    }
    setEnviando(false); avisar("Não foi possível enviar a imagem. Tente de novo.", { tipo: "erro" });
  };
  const usarFoto = async () => {
    if (enviando) return;
    setEnviando(true);
    // (11/10) Confere a gravação: antes fechava como "feito" mesmo sem internet (e o passo só valia neste aparelho).
    // Erro que não é de conexão (coluna que ainda não existe no banco) segue como antes: fica a marca no aparelho.
    let erro: unknown = null;
    try { erro = (await supabase.from("profiles").update({ design_escolhido: true, logo_confirmado: true }).eq("id", uid)).error; } catch (e) { erro = e; }
    setEnviando(false);
    if (erro && erroDeConexao(erro)) { avisar(SEM_INTERNET, { tipo: "erro" }); return; }
    marcarLogoOk(uid);
    onSalvo();
  };
  // (13/10) refeito: a prévia do topo do cardápio explica sozinha.
  // (15/10) "Agora não" só pula (o passo fica pendente). Antes marcava o logo como feito
  const temFoto = !!perfil?.foto_url && !perfil?.logo_url;
  const nomeLoja = String(perfil?.nome_loja || "Sua confeitaria").trim() || "Sua confeitaria";
  const escolherFoto = () => ref.current?.click();
  return (
    <>
      <Janelinha foco titulo="Logo da loja" onClose={onClose}
        acoes={temFoto
          ? <><Botao variante="secundario" onClick={escolherFoto}>Trocar</Botao><Botao cheio carregando={enviando} onClick={usarFoto}>Usar esta foto</Botao></>
          : <><Botao variante="secundario" disabled={enviando} onClick={onDepois}>Agora não</Botao><Botao cheio carregando={enviando} onClick={escolherFoto}>Escolher foto</Botao></>}>
        <input ref={ref} type="file" accept="image/*" hidden onChange={escolher} />
        <PassoTopo k="logo" />
        <div className="ppf-lg2">
          <div className="ppf-lg2-cap" />
          <div className="ppf-lg2-corpo">
            <button type="button" className={`ppf-lg2-logo${atual ? "" : " vazio"}`} onClick={escolherFoto} aria-label={atual ? "Trocar a foto" : "Escolher o logo"}>
              {atual
                ? <><img src={atual} alt="" /><i><Camera size={15} weight="fill" /></i></>
                : <span><Camera size={28} weight="fill" /><small>Toque aqui</small></span>}
            </button>
            <b>{nomeLoja}</b>
            <small>Assim aparece no seu cardápio</small>
          </div>
        </div>
      </Janelinha>
      {crop && <ImageCropper imageSrc={crop} cropShape="round" aspect={1} onCancel={() => setCrop(null)} onCropDone={enviar} />}
    </>
  );
}

function FolhaEndereco({ uid, perfil, onClose, onSalvo, onDepois }: FolhaProps) {
  const e0 = perfil?.endereco || {};
  const [end, setEnd] = useState({ cep: e0.cep || "", rua: e0.rua || "", numero: e0.numero || "", complemento: e0.complemento || "", bairro: e0.bairro || "", cidade: e0.cidade || "", estado: e0.estado || "" });
  const [mostrar, setMostrar] = useState<"completo" | "cidade" | "nada">(perfil?.mostrar_apenas_cidade && !perfil?.mostrar_localizacao ? "cidade" : "completo"); // padrão: endereço completo (02/10)
  const [buscando, setBuscando] = useState(false);
  // (13/10) começa só com o CEP; achou → quadrinho com rua/bairro/cidade e só falta o número; "Não sei o CEP" ou "Editar" → todos os campos
  const [achou, setAchou] = useState(!!(e0.cep && e0.cidade));
  const [manual, setManual] = useState(!!(e0.cidade && !e0.cep));
  const [naoAchou, setNaoAchou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const mudarCep = async (v: string) => {
    const cep = maskCep(v); setEnd(e => ({ ...e, cep })); setAchou(false); setNaoAchou(false);
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setBuscando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`); const j = await r.json();
      if (!j.erro) { setEnd(e => ({ ...e, rua: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", estado: j.uf || "" })); setAchou(true); }
      else { setNaoAchou(true); setManual(true); }
    } catch { setNaoAchou(true); setManual(true); /* sem internet: ela digita */ }
    setBuscando(false);
  };
  const pronto = !!end.cidade.trim() && !!(end.rua.trim() || end.cep.trim());
  const salvar = async () => {
    if (!pronto) return;
    setSalvando(true); setErro("");
    const e = await atualizarPerfil(uid, { endereco: JSON.stringify(end), mostrar_localizacao: mostrar === "completo", mostrar_apenas_cidade: mostrar === "cidade" });
    setSalvando(false);
    if (e) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onSalvo();
  };
  // (15/10) minimapa gratuito: começa no Brasil e voa até a rua. Espera ela parar de digitar pra não ficar buscando a cada letra.
  const cidadeUf = [end.cidade.trim(), end.estado.trim()].filter(Boolean).join(", ");
  const [busca, setBusca] = useState<BuscaMapa>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setBusca(end.cidade.trim() && (achou || manual) ? { rua: end.rua.trim(), numero: end.numero.trim(), cidade: end.cidade.trim(), estado: end.estado.trim() } : null), 700);
    return () => window.clearTimeout(t);
  }, [end.rua, end.numero, end.cidade, end.estado, achou, manual]);
  const selo = !busca ? "Digite o CEP pra achar sua loja" : mostrar === "nada" ? "Endereço escondido no cardápio" : [mostrar === "completo" ? end.bairro.trim() : "", cidadeUf].filter(Boolean).join(" · ");
  const campo = (k: keyof typeof end, rotulo: string, ph = "", extra: any = {}) => (
    <div className="ppf-f"><label className="ppf-l" htmlFor={`pp-${k}`}>{rotulo}</label>
      <input id={`pp-${k}`} className="ppf-in" autoComplete="off" value={end[k]} placeholder={ph} onChange={e => setEnd(x => ({ ...x, [k]: e.target.value }))} {...extra} /></div>
  );
  return (
    <Janelinha foco titulo="Endereço da loja" onClose={onClose}
      acoes={<><Botao variante="secundario" onClick={onDepois}>Agora não</Botao><Botao cheio disabled={!pronto} carregando={salvando} onClick={salvar}>Salvar e continuar</Botao></>}>
      <PassoTopo k="endereco" />
      <MapaEndereco busca={busca} soCidade={mostrar !== "completo"} selo={selo} />

      {!manual && (<>
        <div className="ppf-f"><label className="ppf-l" htmlFor="pp-cep">CEP</label>
          <div className="ppf-wrap"><input id="pp-cep" className="ppf-in ppf-in--g" inputMode="numeric" autoComplete="off" value={end.cep} placeholder="00000-000" onChange={e => mudarCep(e.target.value)} />
            {(buscando || achou) && <small className="ppf-cep">{buscando ? "Procurando…" : "✓ achamos"}</small>}</div></div>
        {achou ? (<>
          <div className="ppf-e-achado">
            <span><b>{end.rua || "Rua"}</b><small>{[end.bairro, [end.cidade, end.estado].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</small></span>
            <button type="button" onClick={() => setManual(true)}>Editar</button>
          </div>
          <div className="ppf-row">{campo("numero", "Número", "Ex.: 500", { inputMode: "numeric" })}{campo("complemento", "Complemento", "Opcional")}</div>
        </>) : (
          <button type="button" className="ppf-e-lnk" onClick={() => setManual(true)}>Não sei o CEP</button>
        )}
      </>)}

      {manual && (<>
        {naoAchou && <p className="ppf-e-aviso">Não achamos esse CEP. Escreva o endereço.</p>}
        {campo("rua", "Rua", "Nome da rua")}
        <div className="ppf-row">{campo("numero", "Número", "Ex.: 500", { inputMode: "numeric" })}{campo("bairro", "Bairro")}</div>
        <div className="ppf-row ppf-row--uf">{campo("cidade", "Cidade")}{campo("estado", "UF", "SP", { maxLength: 2 })}</div>
        {campo("complemento", "Complemento", "Opcional")}
      </>)}

      {(achou || manual) && (<>
        <OpcoesMostrar mostrar={mostrar} onMudar={setMostrar} end={end} tituloClasse="ppf-l ppf-h-tit" />
      </>)}
      {erro && <p className="ppf-erro">{erro}</p>}
    </Janelinha>
  );
}

function FolhaHorario({ uid, perfil, onClose, onSalvo, onDepois }: FolhaProps) {
  const [h, setH] = useState<Horario>({ ...HORARIO_PADRAO, ...(perfil?.horario || {}) });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const temDia = h.dias.length > 0 || h.abre_sabado || h.abre_domingo;
  const salvar = async () => {
    if (!temDia) return;
    setSalvando(true); setErro("");
    const e = await atualizarPerfil(uid, { horario: JSON.stringify(h) });
    setSalvando(false);
    if (e) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onSalvo();
  };
  // (15/10) o editor é o mesmo da tela Dados da loja (components/loja/EditoresLoja)
  return (
    <Janelinha foco titulo="Horário de funcionamento" onClose={onClose}
      acoes={<><Botao variante="secundario" onClick={onDepois}>Agora não</Botao><Botao cheio disabled={!temDia} carregando={salvando} onClick={salvar}>Salvar e continuar</Botao></>}>
      <PassoTopo k="horario" />
      <EditorHorario h={h} onMudar={setH} />
      {erro && <p className="ppf-erro">{erro}</p>}
    </Janelinha>
  );
}

const CSS = `

  .pp { background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); padding: 16px 16px 8px; box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); color: var(--ui-texto); }
  .pp-t { display: block; font-size: 18px; font-weight: 700; line-height: 1.3; }
  .pp-sub { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 4px 0 0; }
  .pp-bar { height: 8px; border-radius: 4px; background: var(--ui-linha); margin: 12px 0 8px; overflow: hidden; }
  .pp-bar i { display: block; height: 100%; border-radius: 99px; background: var(--ui-rosa); transition: width .5s ease; }
  .pp-ps { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 8px 2px; border: none; border-top: 1px solid var(--ui-linha); background: none; font-family: inherit; text-align: left; color: inherit; cursor: pointer; }
  .pp-ps:disabled { cursor: default; }
  .pp-ps--sem { border-top: none; padding: 0; cursor: default; }
  .pp-ic { width: 40px; height: 40px; border-radius: var(--ui-raio-p); background: var(--primary-light); color: #993556; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pp-ic--ok { background: var(--ui-verde-fundo); color: var(--ui-verde); }
  .pp-ic--at { background: var(--ui-rosa); color: var(--ui-branco); }
  .pp-tx { flex: 1; min-width: 0; }
  .pp-tx b { display: block; font-size: 15px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2; color: #2C2C2A; }
  .pp-tx small { display: block; font-size: 13px; color: var(--ui-texto-2); margin-top: 2px; line-height: 1.4; }
  .pp-ps--ok .pp-tx b { color: var(--ui-texto-2); font-weight: 500; }
  .pp-ps--ok .pp-tx small { color: var(--ui-verde); font-weight: 700; }
  .pp-n { display: none; font-style: normal; }
  /* (15/10) celular: os passos viram checklist numerado (bolinha com número; feito = check verde e riscado),
     pra não parecer com os atalhos do Início, que têm o quadrado rosa */
  @media (max-width: 767px) {
    .pp-ic { width: 28px; height: 28px; margin: 0 6px; border-radius: 50%; background: none; border: 2px solid #DCCBD1; color: #8F7C83; font-size: 13px; font-weight: 700; }
    .pp-ic:not(.pp-ic--ok) svg { display: none; }
    .pp-n { display: inline; }
    .pp-ic--at { background: var(--ui-rosa); border-color: var(--ui-rosa); color: var(--ui-branco); }
    .pp-ic--ok { background: var(--ui-verde); border-color: var(--ui-verde); color: var(--ui-branco); }
    .pp-ic--ok svg { width: 14px; height: 14px; }
    .pp-ps--ok { min-height: 44px; }
    .pp-ps--ok .pp-tx b { text-decoration: line-through; text-decoration-color: #C9B9BF; }
    .pp-ps--ok .pp-tx small { display: none; }
  }
  .pp-seta { color: #B4B2A9; display: flex; }
  .pp-at { background: var(--ui-rosa-claro); border: 0; border-radius: var(--ui-raio); padding: 12px; margin: 4px 0 8px; }
  .pp-at + .pp-ps { border-top: none; }
  .pp--destaque .pp-at { animation: ppDestaque 1.1s ease-in-out 2; }
  @keyframes ppDestaque { 0%, 100% { box-shadow: 0 0 0 0 rgba(232, 90, 140, 0); } 50% { box-shadow: 0 0 0 4px rgba(232, 90, 140, .45); } }
  @media (prefers-reduced-motion: reduce) { .pp--destaque .pp-at { animation: none; box-shadow: 0 0 0 3px rgba(232, 90, 140, .45); } }
  .pp-btn { display: block; width: 100%; min-height: 48px; margin-top: 12px; border: none; border-radius: var(--ui-raio-botao); padding: 13px; font-family: inherit; font-size: 15px; font-weight: 700; color: var(--ui-branco); background: var(--ui-rosa); box-shadow: 0 3px 0 var(--ui-rosa-escuro); cursor: pointer; text-align: center; text-decoration: none; }
  .pp-btn:disabled { background: #F3B6CB; box-shadow: none; cursor: default; }
  /* (15/10) "Fazer agora"/"Começar" no chocolate do onboarding: não compete com o rosa da Nova venda */
  .pp-at .pp-btn { background: var(--chocolate); box-shadow: 0 3px 0 var(--chocolate-escuro); }
  .pp-at .pp-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--chocolate-escuro); }
  .pp-lnk { display: block; width: 100%; min-height: 44px; margin-top: 8px; padding: 10px; border: none; background: none; font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; }
  .pp-lnk--cinza { color: var(--ui-texto-3); font-weight: 500; }

  /* (19/10) Início: os passos no mesmo checklist do celular em qualquer tela (antes viravam etiquetas no computador) */
  .pp--inicio .pp-ic { width: 28px; height: 28px; margin: 0 6px; border-radius: 50%; background: none; border: 2px solid #DCCBD1; color: #8F7C83; font-size: 13px; font-weight: 700; }
  .pp--inicio .pp-ic:not(.pp-ic--ok) svg { display: none; }
  .pp--inicio .pp-n { display: inline; }
  .pp--inicio .pp-ic--at { background: var(--ui-rosa); border-color: var(--ui-rosa); color: var(--ui-branco); }
  .pp--inicio .pp-ic--ok { background: var(--ui-verde); border-color: var(--ui-verde); color: var(--ui-branco); }
  .pp--inicio .pp-ic--ok svg { width: 14px; height: 14px; }
  .pp--inicio .pp-ps--ok { min-height: 44px; }
  .pp--inicio .pp-ps--ok .pp-tx b { text-decoration: line-through; text-decoration-color: #C9B9BF; }
  .pp--inicio .pp-ps--ok .pp-tx small { display: none; }

  .ppf-d-logo { flex: none; width: 84px; height: 84px; border-radius: 50%; border: 4px solid var(--ui-branco); background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro);
    box-shadow: 0 4px 14px rgba(44, 18, 25, .12); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 700; }
  .ppf-d-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  /* (15/10) dica do que escrever no lugar da prévia */
  .ppf-d-campo { margin-top: 18px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); overflow: hidden; background: var(--ui-branco); }
  .ppf-d-campo:focus-within { border-color: var(--ui-rosa); }
  .ppf-d-campo textarea { display: block; width: 100%; box-sizing: border-box; height: 104px; resize: none; border: 0; outline: none; padding: 12px 12px 4px; background: none;
    font-family: inherit; font-size: 16px; font-weight: 500; line-height: 1.45; color: var(--ui-texto); }
  .ppf-d-campo textarea::placeholder { color: var(--ui-texto-3); }
  .ppf-d-pe { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 8px 8px; }
  .ppf-d-pe .ppf-doo { margin: 0; height: 36px; border: 0; padding: 0 12px; font-size: 13.5px; }
  .ppf-d-pe span { font-size: 12px; color: var(--ui-texto-3); padding-right: 4px; white-space: nowrap; }
  .ppf-d-perg { margin-top: 14px; border: 1.5px solid #F4C6D7; border-radius: 16px; background: #FFF8FB; padding: 14px; }
  .ppf-d-perg-t { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; font-weight: 600; }
  .ppf-d-perg-t i { width: 26px; height: 26px; border-radius: 8px; background: var(--ui-rosa); color: var(--ui-branco); display: inline-flex; align-items: center; justify-content: center; }
  .ppf-d-perg-s { margin: 4px 0 10px; font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; }
  .ppf-d-opc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .ppf-d-opc button { height: 42px; border: 1px solid var(--ui-borda); border-radius: 10px; background: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; cursor: pointer; }
  .ppf-d-opc button.on { border-color: var(--ui-rosa); background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-weight: 600; }
  .ppf-d-perg-pe { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
  .ppf-d-voltar { min-height: 40px; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-texto-2); cursor: pointer; }
  .ppf-in--g { min-height: 52px; font-size: 17px; }
  .ppf-e-lnk { min-height: 44px; margin-top: 4px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
  .ppf-e-achado { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: var(--ui-cinza); }
  .ppf-e-achado span { min-width: 0; }
  .ppf-e-achado b { display: block; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppf-e-achado small { display: block; font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppf-e-achado button { flex: none; min-height: 40px; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
  .ppf-e-aviso { margin: 12px 0 0; font-size: 13.5px; font-weight: 600; color: var(--ui-laranja); }
  .ppf-row--uf > .ppf-f:last-child { flex: 0 0 76px; }
  .ppf-p-opc { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ppf-p-opc button { display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 12px; border: 1.5px solid var(--ui-borda); border-radius: 12px; background: var(--ui-branco);
    font-family: inherit; font-size: 14.5px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; cursor: pointer; text-align: left; }
  .ppf-p-opc button i { flex: none; width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid #D7CBD0; display: flex; align-items: center; justify-content: center; color: var(--ui-branco); }
  .ppf-p-opc button.on { border-color: var(--ui-rosa); background: #FFF5F9; font-weight: 600; }
  .ppf-p-opc button.on i { background: var(--ui-rosa); border-color: var(--ui-rosa); }
  .ppf-p-dica { margin: 14px 0 0; font-size: 13px; color: var(--ui-texto-3); }
  .ppf-cx { display: flex; align-items: center; gap: 8px; height: 60px; padding: 0 16px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); background: var(--ui-branco); }
  .ppf-cx:focus-within { border-color: var(--ui-rosa); }
  .ppf-cx span { font-size: 18px; font-weight: 600; color: var(--ui-texto-2); }
  .ppf-cx input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-family: inherit; font-size: 24px; font-weight: 600; color: var(--ui-texto); font-variant-numeric: tabular-nums; }
  .ppf-cx-zero { display: inline-flex; align-items: center; min-height: 40px; margin-top: 10px; padding: 0 14px; border: 1.5px solid var(--ui-borda); border-radius: 8px; background: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-texto-2); cursor: pointer; }
  .ppf-cx-zero:disabled { opacity: .5; }
  .ppf-cx-dica { margin-top: 24px; }
  .ppf-cx-av { margin-top: 12px; padding: 12px 14px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); font-size: 13px; line-height: 1.45; color: var(--ui-texto-2); }
  .ppf-cx-av b { display: block; margin-bottom: 2px; font-size: 13.5px; color: var(--ui-texto); }
  .ppf-lg2 { margin-top: 18px; border: 1px solid var(--ui-borda); border-radius: 18px; overflow: hidden; }
  .ppf-lg2-cap { height: 64px; background: linear-gradient(120deg, #F7B2CB, var(--ui-rosa)); }
  .ppf-lg2-corpo { display: flex; flex-direction: column; align-items: center; padding: 0 16px 18px; margin-top: -48px; text-align: center; }
  .ppf-lg2-corpo > b { margin-top: 10px; font-size: 16px; font-weight: 600; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppf-lg2-corpo > small { margin-top: 2px; font-size: 13px; color: var(--ui-texto-3); }
  .ppf-lg2-logo { position: relative; width: 104px; height: 104px; padding: 0; border: 4px solid var(--ui-branco); border-radius: 50%; background: var(--ui-branco);
    box-shadow: 0 4px 14px rgba(44, 18, 25, .12); cursor: pointer; font-family: inherit; }
  .ppf-lg2-logo img { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
  .ppf-lg2-logo.vazio span { width: 100%; height: 100%; border-radius: 50%; border: 2px dashed #F0A9C3; background: #FFF6FA; color: var(--ui-rosa-escuro);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .ppf-lg2-logo.vazio small { font-size: 12px; font-weight: 600; }
  .ppf-lg2-logo i { position: absolute; right: -4px; bottom: 0; width: 32px; height: 32px; border: 3px solid var(--ui-branco); border-radius: 50%; background: var(--ui-rosa); color: var(--ui-branco);
    display: flex; align-items: center; justify-content: center; }
  .ppf-lg2-logo:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: 2px; }
  .ppf-topo { display: flex; align-items: center; gap: 12px; margin: 2px 0 0; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; }
  .ppf-topo b { font-weight: 600; color: var(--ui-rosa-escuro); }
  .ppf-barra { display: flex; gap: 4px; flex: 1; }
  .ppf-barra i { flex: 1; height: 4px; border-radius: 4px; background: var(--ui-linha); }
  .ppf-barra i.on { background: var(--ui-rosa); }
  .ppf-sub { margin: 10px 0 0; font-size: 14px; color: var(--ui-texto-2); line-height: 1.4; }
  .ppf-prev { margin-top: 12px; border: 1px solid var(--ui-borda); border-radius: 16px; overflow: hidden; }
  .ppf-prev-cap { height: 42px; background: linear-gradient(120deg, #F7B2CB, var(--ui-rosa)); }
  .ppf-prev-corpo { display: flex; gap: 10px; align-items: flex-start; padding: 0 12px 12px; margin-top: -18px; }
  .ppf-prev-logo { flex: none; width: 46px; height: 46px; border-radius: 50%; border: 3px solid var(--ui-branco); background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro);
    display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; overflow: hidden; }
  .ppf-prev-logo img { width: 100%; height: 100%; object-fit: cover; }
  .ppf-prev-tx { min-width: 0; padding-top: 22px; }
  .ppf-prev-tx b { display: block; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppf-prev-tx small { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-top: 2px; font-size: 13px; color: var(--ui-texto-2); line-height: 1.35; overflow-wrap: anywhere; }
  .ppf-dica { margin: 6px 2px 0; font-size: 13px; color: var(--ui-texto-3); }
  .ppf-prev-tx small.vazio { color: var(--ui-texto-3); font-style: italic; }
  .ppf-wrap .ppf-ta { margin-top: 12px; min-height: 128px; padding-bottom: 26px; }
  .ppf-cnt2 { position: absolute; right: 12px; bottom: 8px; font-size: 12px; color: var(--ui-texto-3); }
  .ppf-doo { display: inline-flex; align-items: center; gap: 6px; height: 40px; margin-top: 10px; padding: 0 14px; border: 1px solid #F4C6D7; border-radius: var(--ui-raio);
    background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-family: inherit; font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer; }
  .ppf-doo:disabled { opacity: .6; cursor: progress; }
  .ppf-l { display: block; font-size: 13px; font-weight: 700; color: var(--ui-cinza-texto); margin: 16px 0 6px; }
  .ppf-lrow { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; margin-bottom: 6px; }
  .ppf-lrow .ppf-l { margin: 0; }
  .ppf-ia { min-height: 44px; border: none; border-radius: var(--ui-raio); background: var(--ui-vinho, #2C1219); color: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 700; padding: 0 14px; cursor: pointer; }
  .ppf-ia:disabled { opacity: .6; }
  .ppf-in { width: 100%; box-sizing: border-box; min-height: 48px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 0 12px; font-family: inherit; font-size: 16px; font-weight: 500; color: var(--ui-texto); background: var(--ui-branco); }
  .ppf-in:focus { outline: none; border-color: var(--ui-rosa); }
  .ppf-ta { min-height: 112px; padding: 12px; resize: none; line-height: 1.45; display: block; }
  .ppf-erro { margin: 12px 0 0; font-size: 13px; font-weight: 700; color: #B91C1C; }
  .ppf-cnt { text-align: right; font-size: 12.5px; color: var(--ui-texto-3); margin: 4px 0 0; }
  .ppf-f { flex: 1; min-width: 0; }
  .ppf-row { display: flex; gap: 10px; }
  .ppf-wrap { position: relative; }
  .ppf-cep { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 12.5px; font-weight: 700; color: var(--ui-verde); }
  .ppf-dias { display: flex; gap: 6px; }
  .ppf-dias button { flex: 1; aspect-ratio: 1; min-height: 44px; max-width: 48px; border: none; border-radius: 50%; font-family: inherit; font-size: 15px; font-weight: 700; background: var(--ui-cinza); color: var(--ui-texto-2); cursor: pointer; }
  .ppf-dias button.on { background: var(--ui-rosa); color: var(--ui-branco); }
  .ppf-bl { background: var(--ui-cinza); border-radius: var(--ui-raio); padding: 12px; margin-top: 12px; }
  .ppf-bl b { display: block; font-size: 13.5px; margin-bottom: 8px; }
  .ppf-hr { flex: 1; display: flex; align-items: center; gap: 10px; min-height: 52px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 6px 12px; background: var(--ui-branco); font-family: inherit; color: var(--ui-rosa-escuro); text-align: left; cursor: pointer; }
  .ppf-hr span { display: flex; flex-direction: column; color: var(--ui-texto); font-size: 16px; font-weight: 700; line-height: 1.15; }
  .ppf-hr small { font-size: 12.5px; font-weight: 500; color: var(--ui-texto-2); }
  .ppf-lg { display: flex; gap: 14px; align-items: center; margin-top: 12px; }
  .ppf-lgc { position: relative; width: 76px; height: 76px; border-radius: 50%; border: 0; background: var(--ui-rosa-claro); padding: 0; cursor: pointer; flex-shrink: 0; overflow: visible; }
  .ppf-lgc img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
  .ppf-lgc span { color: var(--ui-rosa-escuro); font-weight: 700; font-size: 28px; }
  .ppf-lgc i { position: absolute; right: -4px; bottom: -4px; width: 28px; height: 28px; border: 2px solid var(--ui-branco); border-radius: 50%; background: var(--ui-rosa); color: var(--ui-branco); display: flex; align-items: center; justify-content: center; }
  .ppf-lg b { display: block; font-size: 14.5px; font-weight: 700; }
  .ppf-lg small { display: block; font-size: 13px; color: var(--ui-texto-2); margin-top: 3px; line-height: 1.4; }
`;
