import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import MapaEndereco, { type BuscaMapa } from "@/components/MapaEndereco";
import { EXEMPLO_DESCRICAO, EditorHorario, OpcoesMostrar, type Horario } from "@/components/loja/EditoresLoja";
import { useNavigate } from "react-router-dom";
import { Check, PencilSimpleLine, ImageSquare, MapPin, Clock, Basket, Wallet, Coins, Sparkle, CaretRight, RocketLaunch, Lightbulb, ArrowRight, Camera, PixLogo, Money, CreditCard, Storefront, Moped } from "@phosphor-icons/react";
import ListaChaves from "@/components/loja/ListaChaves";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { useProfile, refreshProfile } from "@/hooks/useProfile";
import { ImageCropper } from "@/components/ui/ImageCropper";
import Janelinha from "@/components/financeiro/Folha";
import Destaque from "@/components/Destaque";
import { Mascote } from "@/components/marca/Mascote";
import { marcarPagamentoConferido } from "@/lib/primeirosPassos";
import { lerPassos, passosCompletos, avisarPassos, atualizarPerfil, marcarLogoOk, type EstadoPassos } from "@/lib/primeirosPassos";

import { Botao, avisar } from "@/components/base";
import { LojaProntaCartao } from "@/components/loja/LojaPronta";
import PreviaTopoCardapio, { type DadosPrevia } from "@/components/cardapio/PreviaTopoCardapio";
import { PreviaSobreHorario } from "@/components/cardapio/SobreLoja";
import { erroDeConexao, SEM_INTERNET } from "@/lib/erros";
import { definirSaldoInicial } from "@/lib/caixa";
import { mascaraBRL, lerBRL, textoBRL } from "@/lib/moeda";
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
  // (27/10) conta os 7 passos, igual ao cartão do Início ("1 de 7 prontos"); antes dizia "Passo 2 de 6"
  const n = ORDEM.indexOf(k) + 1;
  return (
    <div className="ppf-topo" aria-label={`Passo ${n} de ${ORDEM.length}`}>
      <span>Passo <b>{n} de {ORDEM.length}</b></span>
      <div className="ppf-barra" aria-hidden="true">{ORDEM.map((x, i) => <i key={x} className={i < n ? "on" : ""} />)}</div>
    </div>
  );
}

/** (29/10) computador (901px ou mais): as janelas dos passos ganham duas colunas */
function useLargo() {
  const [largo, setLargo] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const f = () => setLargo(mq.matches);
    mq.addEventListener("change", f); return () => mq.removeEventListener("change", f);
  }, []);
  return largo;
}

/** cores, foto do topo e horário da loja, para a prévia do cardápio ficar igual (só lê quando vai mostrar) */
function useDesignPrevia(uid: string, ligado: boolean) {
  const [design, setDesign] = useState<DadosPrevia>({});
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    supabase.from("profiles").select("cor_navbar, cor_borda, cor_nome, banner_topo_url, horario, loja_pausada").eq("id", uid).maybeSingle()
      .then(({ data }) => { if (vivo && data) setDesign(data as DadosPrevia); }, () => {});
    return () => { vivo = false; };
  }, [uid, ligado]);
  return design;
}

const maskCep = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

export default function PrimeirosPassos({ local = "inicio", onEstado }: { local?: Local; onEstado?: (completo: boolean) => void }) {
  // (19/10) computador no Início: duas colunas (o passo da vez à esquerda, a lista à direita), nada esticado
  const [largo, setLargo] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const f = () => setLargo(mq.matches);
    mq.addEventListener("change", f); return () => mq.removeEventListener("change", f);
  }, []);
  const navigate = useNavigate();
  const { profile } = useProfile();
  const uid = profile?.id as string | undefined;
  const [estado, setEstado] = useState<EstadoPassos | null>(null);
  const [folha, setFolha] = useState<Folha>(null);
  const [fechado, setFechado] = useState(false);
  const [jaViuIncompleto, setJaViuIncompleto] = useState(false);
  // (22/10) celular, no Início: cartão-banner com só o próximo passo; "Ver todos" abre a lista
  const [verTodos, setVerTodos] = useState(false);
  const kFechado = uid ? `doonly_pp_fechado_${uid}` : "";
  const kIncompleto = uid ? `doonly_pp_incompleto_${uid}` : "";
  const pulados = useRef<Set<Passo>>(new Set());
  // o que acabou de ser salvo (logo novo), até a releitura dos passos chegar
  const [perfilNovo, setPerfilNovo] = useState<Record<string, any>>({});
  // (29/10 · 4.97) computador: clicar em "Logo da loja" abre direto o seletor de arquivos (sem a janela da prévia)
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoCrop, setLogoCrop] = useState<string | null>(null);
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
    // (29/10 · 4.99) no computador não abre o próximo sozinho: o cartão marca o passo e a pessoa escolhe o próximo
    if (largo) { if (!pular && agora) avisar(passosFaltando(agora) ? "Salvo!" : "Tudo configurado!", { tipo: "ok" }); return; }
    const prox = agora ? proximoPasso(estado, agora, pulados.current) : null;
    if (prox) window.setTimeout(() => abrirPasso(prox), 250);
    else if (agora) avisar(pulados.current.size ? "Pronto por agora!" : "Tudo configurado!", { tipo: "ok" });
  };
  // quantos passos ainda faltam além deste que acabou de ser feito
  const passosFaltando = (feito: Passo) => ORDEM.some(k => k !== feito && !estado[k]);
  const salvo = (patch?: Record<string, any>) => seguir(false, patch);
  // logo pelo atalho do computador: mesmo caminho do "salvar e continuar" (abre o próximo passo que falta)
  const escolheuLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const rd = new FileReader(); rd.onload = () => setLogoCrop(rd.result as string); rd.readAsDataURL(f);
  };
  const enviarLogoDireto = async (blob: Blob) => {
    setLogoCrop(null);
    avisar("Enviando a logo…");
    const logoUrl = await subirLogo(uid, blob);
    if (!logoUrl) return;
    setPerfilNovo(p => ({ ...p, logo_url: logoUrl })); avisarPassos();
    avisar(passosFaltando("logo") ? "Logo salva!" : "Tudo configurado!", { tipo: "ok" });
  };
  // conta do Google com foto: continua a janela, pra escolher entre usar a foto ou trocar
  const logoDireto = largo && !(estado.perfil?.foto_url && !estado.perfil?.logo_url);
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
  const passos: { feito: boolean; ic: ReactNode; t: string; s: string; pq: string; abrir: () => void }[] = [
    // (29/10 · 4.95) pq: por que o passo importa (aparece no bloco do passo da vez, no computador)
    // (23/10) "Criar sua conta" saiu (já está feito e não é configurar o cardápio); nomes curtos que cabem inteiros no celular
    { feito: estado.logo, ic: I(ImageSquare), t: "Logo da loja", s: "No topo do cardápio", pq: "Deixa sua loja com cara profissional e ajuda a cliente a te reconhecer.", abrir: () => { if (logoDireto) logoInput.current?.click(); else setFolha("logo"); } },
    { feito: estado.descricao, ic: I(PencilSimpleLine), t: "Sobre a confeitaria", s: "Uma frase sobre você", pq: "Conta em poucas palavras quem você é e o que faz de especial.", abrir: () => setFolha("descricao") },
    { feito: estado.endereco, ic: I(MapPin), t: "Endereço", s: "Para calcular a entrega", pq: "Com ele, o app calcula a taxa de entrega de cada cliente sozinho.", abrir: () => setFolha("endereco") },
    { feito: estado.horario, ic: I(Clock), t: "Horário", s: "Aberto agora no cardápio", pq: "A cliente vê se você está aberta e para quando pode encomendar.", abrir: () => setFolha("horario") },
    { feito: estado.pagamento, ic: I(Wallet), t: "Pagamento e entrega", s: "Como o cliente paga", pq: "Diga se aceita Pix, cartão ou dinheiro, e se entrega ou só retirada.", abrir: () => abrirPasso("pagamento") },
    { feito: estado.caixa, ic: I(Coins), t: "Saldo do caixa", s: "Quanto tem em caixa hoje", pq: "Assim o app mostra quanto dinheiro você tem de verdade, todo dia.", abrir: () => setFolha("caixa") },
    { feito: estado.produto, ic: I(Basket), t: "Primeiro produto", s: "", pq: "Com o primeiro doce cadastrado, o cardápio já pode receber pedidos.", abrir: () => navigate("/produtos") },
  ];
  const ultimoQueFalta = passos.filter(p => !p.feito).length === 1;
  passos[passos.length - 1].s = ultimoQueFalta ? "Falta só isso" : "Seu primeiro doce";
  const feitos = passos.filter(p => p.feito).length;
  const atual = passos.findIndex(p => !p.feito);
  const colunas = largo && local === "inicio";

  const banner = local === "inicio" && !largo;
  if (banner && atual >= 0) {
    const p = passos[atual];
    const faltam = passos.length - feitos;
    return (
      <div ref={raiz} className={`pp pp--inicio pp--banner${destaque ? " pp--destaque" : ""}`}>
        <div className="ppb-topo">
          <img src="/Sistema/banner-passos.webp" alt="" aria-hidden="true" className="ppb-img" />
          <b className="ppb-t">{faltam === 1 ? "Falta só 1 passo" : "Seu cardápio quase no ar"}</b>
          <small className="ppb-sub">{feitos === 0 ? `${passos.length} passos rápidos, uns 5 minutos` : `${feitos} de ${passos.length} prontos`}</small>
          <div className="ppb-bar" aria-label={`${feitos} de ${passos.length} passos feitos`}><i style={{ width: `${(feitos / passos.length) * 100}%` }} /></div>
        </div>
        <div className="ppb-at" ref={atRef}>
          <span className="ppb-n" aria-hidden="true">{atual + 1}</span>
          <span className="ppb-tx"><b>{p.t}</b><small>{p.s}</small></span>
          <button type="button" className="ppb-btn" ref={btnRef} onClick={p.abrir}>{feitos === 0 ? "Começar" : "Fazer agora"}</button>
          {spot && <Destaque alvo={atRef} toque={btnRef} mascote titulo="Comece por aqui" texto="Em poucos minutos seu cardápio fica pronto para vender." acao="Começar" aoAcao={() => { setSpot(false); p.abrir(); }} aoFechar={() => setSpot(false)} />}
        </div>
        {verTodos && <div className="ppb-lista">{passos.map((q, i) => i === atual ? null : (
          <button type="button" key={q.t} className={`pp-ps${q.feito ? " pp-ps--ok" : ""}`} onClick={q.feito ? undefined : q.abrir} disabled={q.feito}>
            <span className={`pp-ic${q.feito ? " pp-ic--ok" : ""}`}>{q.feito ? I(Check) : <>{q.ic}<i className="pp-n">{i + 1}</i></>}</span>
            <span className="pp-tx"><b>{q.t}</b><small>{q.feito ? "Feito" : q.s}</small></span>
            {!q.feito && <span className="pp-seta"><CaretRight size={16} weight="bold" /></span>}
          </button>
        ))}</div>}
        <button type="button" className="ppb-ver" aria-expanded={verTodos} onClick={() => setVerTodos(v => !v)}>{verTodos ? "Esconder os passos" : `Ver todos os ${passos.length} passos`}</button>

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

  return (
    <div ref={raiz} className={`pp pp--${local}${destaque ? " pp--destaque" : ""}`}>
      {(() => {
        const cab = <>
          <b className="pp-t">Primeiros passos</b>
          <p className="pp-sub">{passos.length - feitos === 1 ? "Falta 1 passo para abrir o cardápio." : `Faltam ${passos.length - feitos} passos para abrir o cardápio.`}</p>
          {/* (29/10 · 4.93) 7 tracinhos, como no tutorial (a barra vazia parecia uma linha solta) */}
          <div className="pp-segs" aria-label={`${feitos} de ${passos.length} passos feitos`}>
            <span>{passos.map((q, k) => <i key={k} className={q.feito ? "on" : ""} />)}</span><small>{feitos} de {passos.length}</small>
          </div>
        </>;
        const item = (p: typeof passos[number], i: number) => i === atual ? (
          <div key={p.t} className="pp-at" ref={atRef}>
            <div className="pp-ps pp-ps--sem">
              <span className="pp-ic pp-ic--at">{p.ic}<i className="pp-n">{i + 1}</i></span>
              <span className="pp-tx"><b>{p.t}</b><small>{p.s}</small></span>
            </div>
            <button type="button" className="pp-btn" ref={btnRef} onClick={p.abrir}>{feitos === 0 ? "Começar" : "Fazer agora"}</button>
            {spot && <Destaque alvo={atRef} toque={btnRef} mascote titulo="Comece por aqui" texto="Em poucos minutos seu cardápio fica pronto para vender." acao="Começar" aoAcao={() => { setSpot(false); p.abrir(); }} aoFechar={() => setSpot(false)} />}
          </div>
        ) : (
          <button type="button" key={p.t} className={`pp-ps${p.feito ? " pp-ps--ok" : ""}`} onClick={p.feito ? undefined : p.abrir} disabled={p.feito}>
            <span className={`pp-ic${p.feito ? " pp-ic--ok" : ""}`}>{p.feito ? I(Check) : <>{p.ic}<i className="pp-n">{i + 1}</i></>}</span>
            <span className="pp-tx"><b>{p.t}</b><small>{p.feito ? "Feito" : p.s}</small></span>
            {!p.feito && <span className="pp-seta"><CaretRight size={16} weight="bold" /></span>}
          </button>
        );
        if (!colunas) return <>{cab}{passos.map(item)}</>;
        // (29/10 · 4.95) computador: à esquerda o passo da vez num bloco com o porquê e o mascote;
        // à direita a lista com os 7 passos (o da vez marcado só pelo número rosa, sem fundo)
        const p = atual >= 0 ? passos[atual] : null;
        const animo = feitos === 0 ? "Vamos começar!" : passos.length - feitos <= 2 ? "Falta pouco!" : "Você está indo bem!";
        return (
          <div className="pp-dk">
            <div className="pp-dk-cab">
              <span className="pp-dk-ic" aria-hidden="true"><RocketLaunch size={32} weight="bold" /></span>
              <div className="pp-dk-tit">
                <b className="pp-t">Primeiros passos</b>
                <p className="pp-sub">{passos.length - feitos === 1 ? "Falta 1 passo para abrir o cardápio." : `Faltam ${passos.length - feitos} passos para abrir o cardápio.`}</p>
              </div>
              <div className="pp-dk-bar" aria-label={`${feitos} de ${passos.length} passos feitos`}>
                <span><i style={{ width: `${Math.max(feitos, 0.5) / passos.length * 100}%` }} /></span><small>{feitos} de {passos.length}</small>
              </div>
            </div>
            <div className="pp-cols">
              {p && (
                <div className="pp-hero" ref={atRef}>
                  <div className="pp-hero-topo">
                    <div className="pp-hero-tx">
                      <span className="pp-hero-n" aria-hidden="true">{atual + 1}</span>
                      <div>
                        <b className="pp-hero-t">{p.t}</b>
                        <small className="pp-hero-s">{p.s}</small>
                        <p className="pp-hero-p">{p.pq}</p>
                        <button type="button" className="pp-hero-btn" ref={btnRef} onClick={p.abrir}>{feitos === 0 ? "Começar" : "Fazer agora"}<ArrowRight size={18} weight="bold" aria-hidden="true" /></button>
                      </div>
                    </div>
                    <div className="pp-hero-masc"><i aria-hidden="true" /><Mascote pose="prancheta" /></div>
                  </div>
                  <div className="pp-hero-dica">
                    <span aria-hidden="true"><Lightbulb size={22} weight="bold" /></span>
                    <p><b>{animo}</b>Em poucos minutos seu cardápio já fica pronto para vender.</p>
                  </div>
                  {spot && <Destaque alvo={atRef} toque={btnRef} mascote titulo="Comece por aqui" texto="Em poucos minutos seu cardápio fica pronto para vender." acao="Começar" aoAcao={() => { setSpot(false); p.abrir(); }} aoFechar={() => setSpot(false)} />}
                </div>
              )}
              <div className="pp-lista">{passos.map((q, k) => (
                <button type="button" key={q.t} className={`pp-li${q.feito ? " pp-li--ok" : ""}${k === atual ? " pp-li--vez" : ""}`} onClick={q.feito ? undefined : q.abrir} disabled={q.feito}>
                  <span className="pp-li-n">{q.feito ? <Check size={15} weight="bold" /> : k + 1}</span>
                  <span className="pp-li-tx"><b>{q.t}</b><small>{q.feito ? "Feito" : q.s}</small></span>
                  {!q.feito && <CaretRight size={16} weight="bold" className="pp-li-seta" />}
                </button>
              ))}</div>
            </div>
          </div>
        );
      })()}

      {folha === "descricao" && <FolhaDescricao uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "logo" && <FolhaLogo uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "endereco" && <FolhaEndereco uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "pagamento" && <FolhaPagamento uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "caixa" && <FolhaCaixa uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      {folha === "horario" && <FolhaHorario uid={uid} perfil={{ ...estado.perfil, ...perfilNovo }} onClose={() => setFolha(null)} onSalvo={salvo} onDepois={depois} />}
      <input ref={logoInput} type="file" accept="image/*" hidden onChange={escolheuLogo} />
      {logoCrop && <ImageCropper imageSrc={logoCrop} cropShape="round" aspect={1} onCancel={() => setLogoCrop(null)} onCropDone={enviarLogoDireto} />}
      <style>{CSS}</style>
    </div>
  );
}


const PAGA: [string, string][] = [["pix", "Pix"], ["dinheiro", "Dinheiro"], ["credito", "Cartão de crédito"], ["debito", "Cartão de débito"]];

/**
 * (13/10) Passo 5: só as opções, já vindo tudo marcado (ela desmarca o que não usa).
 * A taxa de entrega saiu daqui: com Entrega marcada e sem taxa, fica um aviso (notificação e "Pra vender mais") pra ela definir depois.
 */
function FolhaPagamento({ uid, onClose, onSalvo, onDepois }: FolhaProps) {
  const [paga, setPaga] = useState<string[]>(PAGA.map(([k]) => k));
  const [entrega, setEntrega] = useState<string[]>(["retirada", "entrega_propria"]);
  // (23/10) a taxa da entrega própria já fica aqui (antes ela só descobria depois, por um aviso)
  const [taxa, setTaxa] = useState("");
  const [porBairro, setPorBairro] = useState(false);
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
      setTaxa(textoBRL(Number(d.valor_entrega_propria) || 0));
      setPorBairro(Array.isArray(d.entrega_por_bairro) && d.entrega_por_bairro.length > 0);
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
    const campos: Record<string, unknown> = { formas_pagamento: paga, formas_entrega: entrega };
    if (entrega.includes("entrega_propria") && !porBairro) campos.valor_entrega_propria = lerBRL(taxa || "0");
    const { error } = await supabase.from("profiles").update(campos).eq("id", uid);
    setSalvando(false);
    if (error) { setErro(erroDeConexao(error) ? SEM_INTERNET : "Não foi possível salvar agora. Tente de novo."); return; }
    marcarPagamentoConferido(uid);
    onSalvo();
  };
  const ICONE_PAGA: Record<string, typeof PixLogo> = { pix: PixLogo, dinheiro: Money, credito: CreditCard, debito: CreditCard };
  const SUB_PAGA: Record<string, string> = { pix: "Na hora, sem taxa", dinheiro: "Na entrega ou na retirada", credito: "Na maquininha", debito: "Na maquininha" };
  const campoTaxa = porBairro
    ? <p className="ppf-p-taxa-b">Taxa por bairro, em Minha loja</p>
    : <label className="ppf-p-taxa"><span><b>Taxa de entrega</b><small>Zero para grátis</small></span>
        <span className="ppf-p-taxa-in"><em>R$</em><input inputMode="numeric" autoComplete="off" placeholder="0,00" value={taxa} aria-label="Taxa de entrega em reais"
          onChange={e => setTaxa(mascaraBRL(e.target.value))} /></span></label>;
  return (
    <Janelinha foco titulo="Pagamento e entrega" onClose={onClose}
      acoes={<><Botao variante="secundario" onClick={onDepois}>Agora não</Botao><Botao cheio disabled={!pronto || !carregou} carregando={salvando} onClick={salvar}>Salvar e continuar</Botao></>}>
      <PassoTopo k="pagamento" />
      {/* (23/10) lista com chave, igual aos apps de delivery (antes: caixinhas rosa) */}
      <ListaChaves titulo="Como o cliente paga" id="pp-paga" itens={PAGA.map(([k, n]) => ({ chave: k, Ic: ICONE_PAGA[k], rotulo: n, sub: SUB_PAGA[k], on: paga.includes(k), aoTocar: () => trocarPaga(k) }))} />
      <ListaChaves titulo="Como o cliente recebe" id="pp-recebe" itens={[
        { chave: "retirada", Ic: Storefront, rotulo: "Retirada no local", sub: "Busca no seu endereço", on: entrega.includes("retirada"), aoTocar: () => trocarEntrega("retirada") },
        { chave: "entrega", Ic: Moped, rotulo: "Entrega própria", sub: "Você leva até o cliente", on: temEntrega, aoTocar: () => trocarEntrega("entrega"), depois: campoTaxa },
      ]} />
      <p className="ppf-p-dica">Motoboy e Uber Flash ficam em Minha loja.</p>
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
          <li>Dá para mudar depois no Financeiro</li>
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

const QUANDO = ["Festas", "Casamentos", "Dia a dia"];
function FolhaDescricao({ uid, perfil, onClose, onSalvo, onDepois }: FolhaProps) {
  const [txt, setTxt] = useState(String(perfil?.descricao_loja || ""));
  const nomeLoja = String(perfil?.nome_loja || "Sua confeitaria").trim() || "Sua confeitaria";
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // (23/10) Doo IA: 3 perguntas (o que faz, para quando, diferencial) e 3 opções para escolher
  const [perguntando, setPerguntando] = useState(false);
  const [faz, setFaz] = useState<string[]>([]);
  const [quando, setQuando] = useState<string[]>([]);
  const [diferencial, setDiferencial] = useState("");
  const [opcoes, setOpcoes] = useState<string[] | null>(null);
  const [escolhida, setEscolhida] = useState(0);
  // (29/10 · 5.00) computador: janela larga com a prévia do cardápio ao lado (a logo dela, se já tiver)
  const largo = useLargo();
  const design = useDesignPrevia(uid, largo);
  const alternar = (lista: string[], set: (v: string[]) => void, v: string) => set(lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);
  const gerar = async () => {
    setGerando(true); setErro("");
    const oQue = faz.filter(f => f !== "Outros").map(f => f.toLowerCase());
    const ocasioes = quando.map(q => q.toLowerCase());
    const dif = diferencial.trim().slice(0, 80);
    const prompt = `Crie 3 opções diferentes de descrição para uma confeitaria chamada "${nomeLoja}"`
      + (oQue.length ? `, que faz ${oQue.join(", ")}` : "")
      + (ocasioes.length ? `, para ${ocasioes.join(", ")}` : "")
      + (dif ? `. O diferencial dela: ${dif}` : "")
      + `. Cada opção com 110 a 160 caracteres (umas 3 linhas no celular), em português do Brasil, linguagem profissional e acolhedora, `
      + `dizendo o que a confeitaria faz e para quais ocasiões. Sem emojis, sem aspas, sem numeração. Responda APENAS com as 3 opções, uma por linha.`;
    try {
      const res = await apiFetch("/api/gerar-descricao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await res.json();
      if (data?.error === "limite_diario") { setErro(data.message || "Você chegou ao limite de hoje. Amanhã libera de novo."); setGerando(false); return; }
      const bruto = String(data.content?.[0]?.text || "");
      const lista = bruto.split(/\n+/).map(l => l.replace(/^\s*(\d+[.)-]|[-•*])\s*/, "").replace(/^["“]|["”]$/g, "").trim()).filter(l => l.length >= 40).map(l => l.slice(0, 200)).slice(0, 3);
      if (lista.length) { setOpcoes(lista); setEscolhida(0); }
      else setErro("A Doo IA não conseguiu escrever agora. Tente de novo.");
    } catch { setErro("Sem internet agora. Tente de novo em instantes."); }
    setGerando(false);
  };
  const usarOpcao = () => { if (!opcoes) return; setTxt(opcoes[escolhida] || ""); setOpcoes(null); setPerguntando(false); };
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
      acoes={<><Botao variante="secundario" onClick={onDepois}>Agora não</Botao><Botao cheio disabled={!txt.trim()} carregando={salvando} onClick={salvar}>{largo ? "Salvar" : "Salvar e continuar"}</Botao></>}>
      <div className={`ppf-d${largo ? " ppf-d--2col" : ""}`}>
        {largo && (
          <div className="ppf-d-prev">
            <p>Prévia no seu cardápio</p>
            <PreviaTopoCardapio d={{ ...design, ...perfil, nome_loja: nomeLoja, descricao_loja: txt }} semDescricao="Sua descrição aparece aqui enquanto você escreve." />
          </div>
        )}
        <PassoTopo k="descricao" />

        {perguntando ? (
          <div className="ppf-ia">
            {opcoes ? (
              <>
                <div className="ppf-ia-cab"><img src="/Sistema/doo.png" alt="" aria-hidden="true" /><b>Escolha a que mais combina</b></div>
                <div className="ppf-ia-ops" role="radiogroup" aria-label="Opções da Doo IA">
                  {opcoes.map((t, i) => (
                    <button type="button" key={i} role="radio" aria-checked={escolhida === i} className={escolhida === i ? "on" : ""} onClick={() => setEscolhida(i)}>
                      <i aria-hidden="true" />{t}
                    </button>
                  ))}
                </div>
                <div className="ppf-ia-pe">
                  <button type="button" className="ppf-ia-outras" disabled={gerando} onClick={gerar}><Sparkle size={15} weight="fill" aria-hidden="true" />{gerando ? "Escrevendo…" : "Escrever outras"}</button>
                  <Botao tamanho="m" onClick={usarOpcao}>Usar esta</Botao>
                </div>
              </>
            ) : (
              <>
                <div className="ppf-ia-cab"><img src="/Sistema/doo.png" alt="" aria-hidden="true" /><span><b>A Doo IA escreve para você</b><small>Responda e escolha entre 3 opções</small></span></div>
                <p className="ppf-ia-l">O que você faz?</p>
                <div className="ppf-d-opc">
                  {FAZ.map(f => <button type="button" key={f} className={faz.includes(f) ? "on" : ""} aria-pressed={faz.includes(f)} onClick={() => alternar(faz, setFaz, f)}>{f}</button>)}
                </div>
                <p className="ppf-ia-l">Para quando?</p>
                <div className="ppf-d-opc">
                  {QUANDO.map(f => <button type="button" key={f} className={quando.includes(f) ? "on" : ""} aria-pressed={quando.includes(f)} onClick={() => alternar(quando, setQuando, f)}>{f}</button>)}
                </div>
                <label className="ppf-ia-l" htmlFor="pp-dif">Seu diferencial <span>(se quiser)</span></label>
                <input id="pp-dif" className="ppf-ia-in" autoComplete="off" maxLength={80} value={diferencial} placeholder="Ex.: receita da família" onChange={e => setDiferencial(e.target.value)} />
                <div className="ppf-ia-pe">
                  <button type="button" className="ppf-d-voltar" onClick={() => setPerguntando(false)}>Voltar</button>
                  <Botao tamanho="m" carregando={gerando} icone={<Sparkle size={16} weight="fill" />} onClick={gerar}>Escrever 3 opções</Botao>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <label className="ppf-d-l" htmlFor="pp-desc">Descrição da loja</label>
            <div className="ppf-d-campo">
              <textarea id="pp-desc" autoComplete="off" value={txt} maxLength={200}
                placeholder={EXEMPLO_DESCRICAO}
                onChange={e => setTxt(e.target.value)} />
              <div className="ppf-d-pe">
                <button type="button" className="ppf-doo" onMouseDown={e => e.preventDefault()} onClick={() => { setOpcoes(null); setPerguntando(true); }}>
                  <Sparkle size={16} weight="fill" aria-hidden="true" />{txt.trim() ? "Escrever de novo com a Doo IA" : "Escrever com a Doo IA"}
                </button>
                <span>{txt.length}/200</span>
              </div>
            </div>
            {/* (23/10) a ajuda vem embaixo do campo (antes era uma caixa rosa em cima) */}
            {largo ? <p className="ppf-d-dica1">Conte o que você faz, para quais ocasiões e o que tem de especial.</p> : <div className="ppf-d-ajuda">
              <p>O que escrever</p>
              <ul>
                <li><Check size={14} weight="bold" aria-hidden="true" /><b>O que você faz:</b> bolos, doces, salgados</li>
                <li><Check size={14} weight="bold" aria-hidden="true" /><b>Para quando:</b> festas, dia a dia</li>
                <li><Check size={14} weight="bold" aria-hidden="true" /><b>Seu diferencial:</b> receita da família</li>
              </ul>
              <small>Aparece embaixo do nome, no topo do cardápio.</small>
            </div>}
          </>
        )}
        {erro && <p className="ppf-erro">{erro}</p>}
      </div>
    </Janelinha>
  );
}

/** Envia a logo recortada e grava no perfil. Devolve o endereço da imagem, ou null se deu erro (já avisa). */
async function subirLogo(uid: string, blob: Blob): Promise<string | null> {
  const path = `logos/${uid}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) { avisar("Não foi possível enviar a imagem. Tente de novo.", { tipo: "erro" }); return null; }
  const { data } = supabase.storage.from("products").getPublicUrl(path);
  marcarLogoOk(uid);
  const logoUrl = `${data.publicUrl}?t=${Date.now()}`;
  const e = await atualizarPerfil(uid, { logo_url: logoUrl, design_escolhido: true, logo_confirmado: true }, ["design_escolhido", "logo_confirmado"]);
  if (e) { avisar("Não foi possível salvar agora. Confira a internet e tente de novo.", { tipo: "erro" }); return null; }
  refreshProfile(); // o círculo da conta (menu) já mostra a logo
  return logoUrl;
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
    const logoUrl = await subirLogo(uid, blob);
    setEnviando(false);
    if (logoUrl) onSalvo({ logo_url: logoUrl });
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
  // cores, foto do topo e horário da loja, para a prévia ficar igual ao cardápio
  const [design, setDesign] = useState<DadosPrevia>({});
  useEffect(() => {
    let vivo = true;
    supabase.from("profiles").select("cor_navbar, cor_borda, cor_nome, banner_topo_url, horario, loja_pausada").eq("id", uid).maybeSingle()
      .then(({ data }) => { if (vivo && data) setDesign(data as DadosPrevia); }, () => {});
    return () => { vivo = false; };
  }, [uid]);
  return (
    <>
      <Janelinha foco titulo="Logo da loja" onClose={onClose}
        acoes={temFoto
          ? <><Botao variante="secundario" onClick={escolherFoto}>Trocar</Botao><Botao cheio carregando={enviando} onClick={usarFoto}>Usar esta foto</Botao></>
          : <><Botao variante="secundario" disabled={enviando} onClick={onDepois}>Agora não</Botao><Botao cheio carregando={enviando} onClick={escolherFoto}>Escolher foto</Botao></>}>
        <input ref={ref} type="file" accept="image/*" hidden onChange={escolher} />
        <PassoTopo k="logo" />
        {/* (23/10) a prévia é o topo do cardápio de verdade (mesmas peças e cores da loja), com a logo à direita */}
        <div className="ppf-lg3">
          <PreviaTopoCardapio d={{ ...design, ...perfil, nome_loja: nomeLoja }} onLogo={escolherFoto} enviando={enviando} />
          <p>É assim que o cliente vê o topo do seu cardápio.</p>
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
  const [naoAchou, setNaoAchou] = useState<"" | "cep" | "rede">("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const mudarCep = async (v: string) => {
    const cep = maskCep(v); setEnd(e => ({ ...e, cep })); setAchou(false); setNaoAchou("");
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setBuscando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`); const j = await r.json();
      if (!j.erro) { setEnd(e => ({ ...e, rua: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", estado: j.uf || "" })); setAchou(true); }
      else { setNaoAchou("cep"); setManual(true); }
    } catch { setNaoAchou("rede"); setManual(true); /* sem internet: ela digita */ }
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
  const ruaNum = [end.rua.trim(), end.numero.trim()].filter(Boolean).join(", ");
  const selo = !busca ? "" : mostrar === "nada" ? "O endereço não aparece no cardápio" : mostrar === "completo" ? ([ruaNum, end.bairro.trim()].filter(Boolean).join(" · ") || cidadeUf) : cidadeUf;
  // (29/10 · 5.02) computador: janela larga já no tamanho maior, com o mapa sempre à direita
  const largo = useLargo();
  const campo = (k: keyof typeof end, rotulo: string, ph = "", extra: any = {}) => (
    <div className="ppf-f"><label className="ppf-l" htmlFor={`pp-${k}`}>{rotulo}</label>
      <input id={`pp-${k}`} className="ppf-in" autoComplete="off" value={end[k]} placeholder={ph} onChange={e => setEnd(x => ({ ...x, [k]: e.target.value }))} {...extra} /></div>
  );
  return (
    <Janelinha foco titulo="Endereço da loja" onClose={onClose}
      acoes={<><Botao variante="secundario" onClick={onDepois}>Agora não</Botao><Botao cheio disabled={!pronto} carregando={salvando} onClick={salvar}>{largo ? "Salvar" : "Salvar e continuar"}</Botao></>}>
      <div className={largo ? "ppf-d ppf-d--2col ppf-d--end" : undefined}>
      {largo && (
        <div className="ppf-d-prev">
          <p>No cardápio, em Sobre a loja</p>
          <MapaEndereco busca={busca} soCidade={mostrar !== "completo"} selo={selo || "Digite o CEP para ver no mapa"} altura={500} />
        </div>
      )}
      <PassoTopo k="endereco" />
      {/* (23/10) o CEP vem primeiro; o mapa só aparece depois que acha o endereço, embaixo, mostrando o que o cliente vê */}
      {!manual && (<>
        <div className="ppf-f ppf-e-cep">
          <div className="ppf-e-cab"><label className="ppf-l" htmlFor="pp-cep">CEP da loja</label>{!achou && <button type="button" className="ppf-e-lnk" onClick={() => setManual(true)}>Não sei o CEP</button>}</div>
          <div className="ppf-wrap"><input id="pp-cep" className="ppf-in ppf-in--g" inputMode="numeric" autoComplete="off" value={end.cep} placeholder="00000-000" onChange={e => mudarCep(e.target.value)} />
            {(buscando || achou) && <small className={`ppf-cep${achou ? " ok" : ""}`}>{buscando ? "Procurando…" : <><Check size={14} weight="bold" aria-hidden="true" />Encontrado</>}</small>}</div></div>
        {!achou && <p className="ppf-e-ajuda">Com o CEP, o app preenche a rua, o bairro e a cidade.</p>}
        {achou && (<>
          <div className="ppf-e-achado">
            <span><b>{end.rua || "Rua"}</b><small>{[end.bairro, [end.cidade, end.estado].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</small></span>
            <button type="button" onClick={() => setManual(true)}>Editar</button>
          </div>
          <div className="ppf-row">{campo("numero", "Número", "Ex.: 500", { inputMode: "numeric" })}{campo("complemento", "Complemento", "Opcional")}</div>
        </>)}
      </>)}

      {manual && (<>
        {naoAchou && <p className="ppf-e-aviso">{naoAchou === "rede" ? "Não deu para buscar o CEP agora. Escreva o endereço." : "Não achamos esse CEP. Confira o número ou escreva o endereço."}</p>}
        {/* (27/10) o CEP continua aqui: antes sumia e não dava para corrigir um número errado */}
        {(() => {
          const cepCampo = <div className="ppf-f"><label className="ppf-l" htmlFor="pp-cep">CEP</label>
            <input id="pp-cep" className="ppf-in" inputMode="numeric" autoComplete="off" value={end.cep} placeholder="00000-000" onChange={e => mudarCep(e.target.value)} /></div>;
          // (29/10 · 5.03) computador: campos lado a lado, pra caber sem rolar com as 3 caixinhas embaixo
          return largo ? (<>
            <div className="ppf-row">{cepCampo}{campo("numero", "Número", "Ex.: 500", { inputMode: "numeric" })}{campo("complemento", "Complemento", "Opcional")}</div>
            {campo("rua", "Rua", "Nome da rua")}
            <div className="ppf-row ppf-row--uf">{campo("bairro", "Bairro")}{campo("cidade", "Cidade")}{campo("estado", "UF", "SP", { maxLength: 2 })}</div>
          </>) : (<>
            {cepCampo}
            {campo("rua", "Rua", "Nome da rua")}
            <div className="ppf-row">{campo("numero", "Número", "Ex.: 500", { inputMode: "numeric" })}{campo("bairro", "Bairro")}</div>
            <div className="ppf-row ppf-row--uf">{campo("cidade", "Cidade")}{campo("estado", "UF", "SP", { maxLength: 2 })}</div>
            {campo("complemento", "Complemento", "Opcional")}
          </>);
        })()}
      </>)}

      {(achou || manual) && (<>
        <OpcoesMostrar mostrar={mostrar} onMudar={setMostrar} tituloClasse="ppf-l ppf-e-tit" caixas={largo} />
        {/* (29/10 · 4.76) sem rolar no celular: o mapa encolhe em tela baixa e a frase de baixo saiu (o selo do mapa já diz o que aparece) */}
        {!largo && <div className="ppf-e-mapa"><MapaEndereco busca={busca} soCidade={mostrar !== "completo"} selo={selo} altura={124} /></div>}
      </>)}
      {erro && <p className="ppf-erro">{erro}</p>}
      </div>
    </Janelinha>
  );
}

function FolhaHorario({ uid, perfil, onClose, onSalvo, onDepois }: FolhaProps) {
  const [h, setH] = useState<Horario>({ ...HORARIO_PADRAO, ...(perfil?.horario || {}) });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const temDia = h.dias.length > 0 || h.abre_sabado || h.abre_domingo;
  // (29/10 · 5.01) computador: janela larga com a prévia do cardápio ao lado (o "Aberto agora" muda na hora)
  const largo = useLargo();
  const design = useDesignPrevia(uid, largo);
  const nomeLoja = String(perfil?.nome_loja || "Sua confeitaria").trim() || "Sua confeitaria";
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
      acoes={<><Botao variante="secundario" onClick={onDepois}>Agora não</Botao><Botao cheio disabled={!temDia} carregando={salvando} onClick={salvar}>{largo ? "Salvar" : "Salvar e continuar"}</Botao></>}>
      <div className={largo ? "ppf-d ppf-d--2col ppf-d--hor" : undefined}>
        {largo && (
          <div className="ppf-d-prev">
            <p>No cardápio, em Sobre a loja › Horário</p>
            <PreviaSobreHorario nome={nomeLoja} horario={h} corTopo={design.cor_navbar || design.cor_borda} />
          </div>
        )}
        <PassoTopo k="horario" />
        <EditorHorario h={h} onMudar={setH} semCardapio={largo} />
        {erro && <p className="ppf-erro">{erro}</p>}
      </div>
    </Janelinha>
  );
}

const CSS = `
  /* (22/10) celular, Início: cartão-banner (arte com o Doo acenando à direita, texto à esquerda) */
  .pp.pp--banner { padding: 0; overflow: hidden; }
  .ppb-topo { position: relative; aspect-ratio: 10 / 3; min-height: 96px; padding: 14px 16px 0; box-sizing: border-box; background: #FFE3EE; overflow: hidden; }
  .ppb-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: right center; pointer-events: none; }
  .ppb-t, .ppb-sub, .ppb-bar { position: relative; }
  .ppb-t { display: block; max-width: 72%; font-size: 17px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppb-sub { display: block; max-width: 72%; margin-top: 2px; font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppb-bar { width: 58%; height: 8px; margin-top: 10px; border-radius: 4px; background: rgba(214, 63, 117, .15); overflow: hidden; }
  .ppb-bar i { display: block; height: 100%; border-radius: 4px; background: var(--ui-rosa); transition: width .4s ease; }
  .ppb-at { position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 0; }
  .ppb-n { flex: none; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; background: var(--ui-rosa); color: var(--ui-branco); font-size: 14px; font-weight: 700; }
  .ppb-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .ppb-tx b { font-size: 15px; font-weight: 700; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppb-tx small { font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppb-btn { flex: none; min-height: 44px; padding: 0 14px; border: 0; border-radius: var(--ui-raio-botao); background: var(--ui-rosa); color: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .ppb-btn:active { background: var(--ui-rosa-escuro); }
  .pp--destaque .ppb-at { animation: ppDestaque 1.1s ease-in-out 2; }
  .ppb-lista { padding: 0 14px; border-top: 1px solid var(--ui-linha); }
  .ppb-ver { display: block; width: 100%; min-height: 44px; border: 0; border-top: 1px solid var(--ui-linha); background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .ppb-btn:focus-visible, .ppb-ver:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: -3px; }

  .pp { background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); padding: 16px 16px 8px; box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); color: var(--ui-texto); }
  .pp-t { display: block; font-size: 18px; font-weight: 700; line-height: 1.3; }
  .pp-sub { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 4px 0 0; }
  .pp-bar { height: 8px; border-radius: 4px; background: var(--ui-linha); margin: 12px 0 8px; overflow: hidden; }
  .pp-bar i { display: block; height: 100%; border-radius: 99px; background: var(--ui-rosa); transition: width .5s ease; }
  .pp-segs { display: flex; align-items: center; gap: 10px; margin: 12px 0 8px; }
  .pp-segs span { flex: 1; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 5px; }
  .pp-segs i { height: 5px; border-radius: 3px; background: #ECE7E9; transition: background-color .3s ease; }
  .pp-segs i.on { background: var(--ui-rosa); }
  .pp-segs small { flex: none; font-size: 12.5px; font-weight: 500; color: var(--ui-texto-3); }
  /* (4.93) computador: o passo da vez numa linha limpa (sem o fundo rosa claro) e o "Começar" rosa, do tamanho do texto */
  .pp-cols .pp-at { display: flex; align-items: center; gap: 14px; padding: 14px 0 0; background: none; border-top: 1px solid var(--ui-linha); border-radius: 0; }
  .pp-cols .pp-at .pp-ps { flex: 1; min-width: 0; padding: 0; }
  .pp-cols .pp-at .pp-btn { flex: none; width: auto; min-height: 44px; margin: 0; padding: 0 22px; background: var(--ui-rosa); box-shadow: 0 3px 0 var(--ui-rosa-escuro); }
  .pp-cols .pp-at .pp-btn:active { box-shadow: 0 1px 0 var(--ui-rosa-escuro); }
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
     para não parecer com os atalhos do Início, que têm o quadrado rosa */
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

  /* (19/10) computador: duas colunas para não esticar. Esquerda: título, barra e o passo da vez (igual ao celular);
     direita: a lista dos passos. Cada coluna com a largura de um celular. */
  .pp-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: start; }
  .pp-col-a .pp-at { margin-top: 16px; }
  /* (29/10 · 4.96) computador, no modelo que o Bruno trouxe: cabeçalho com foguete e barra; à esquerda o passo da vez
     (número grande, porquê, botão, mascote e a dica); à direita a lista com os 7 passos */
  .pp-dk-cab { display: flex; align-items: center; gap: 18px; }
  .pp-dk-ic { width: 64px; height: 64px; flex: none; border-radius: 16px; background: #FDEBF1; color: var(--ui-rosa); display: flex; align-items: center; justify-content: center; }
  .pp-dk-tit { flex: 1; min-width: 0; }
  .pp-dk .pp-t { font-size: 26px; font-weight: 600; letter-spacing: -.015em; color: #241A1E; }
  .pp-dk .pp-sub { font-size: 16px; margin-top: 2px; }
  .pp-dk-bar { flex: none; width: 36%; display: flex; align-items: center; gap: 14px; align-self: flex-start; margin-top: 10px; }
  .pp-dk-bar span { flex: 1; height: 8px; border-radius: 4px; background: #EFEAEC; overflow: hidden; }
  .pp-dk-bar i { display: block; height: 100%; border-radius: 4px; background: var(--ui-rosa); transition: width .4s ease; }
  .pp-dk-bar small { font-size: 15px; color: var(--ui-texto-2); white-space: nowrap; }
  .pp-dk .pp-cols { grid-template-columns: minmax(0, 1.85fr) minmax(0, 1fr); gap: 32px; align-items: stretch; margin-top: 26px; }
  .pp-hero { display: flex; flex-direction: column; gap: 18px; padding: 26px 26px 24px; border: 1px solid #F6DCE6; border-radius: 18px; background: linear-gradient(180deg, #FFF6F9, #FDF0F5); }
  .pp-hero-topo { flex: 1; display: flex; align-items: center; gap: 16px; }
  .pp-hero-tx { flex: 1; min-width: 0; display: flex; gap: 22px; align-items: flex-start; }
  .pp-hero-n { width: 60px; height: 60px; flex: none; border-radius: 50%; background: var(--ui-rosa); color: #fff; font-size: 24px; font-weight: 600; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(214, 69, 122, .25); }
  .pp-hero-t { display: block; margin-top: 4px; font-size: 26px; font-weight: 600; letter-spacing: -.015em; color: #241A1E; line-height: 1.2; }
  .pp-hero-s { display: block; margin-top: 4px; font-size: 18px; color: var(--ui-texto-2); }
  .pp-hero-p { margin: 18px 0 0; max-width: 380px; font-size: 16px; line-height: 1.6; color: #6B5C62; }
  .pp-hero-btn { display: inline-flex; align-items: center; gap: 12px; min-height: 54px; margin-top: 26px; padding: 0 30px; border: 0; border-radius: 12px; font-family: inherit; font-size: 17px; font-weight: 600; color: #fff; background: var(--ui-rosa); box-shadow: 0 6px 16px rgba(214, 69, 122, .28); cursor: pointer; white-space: nowrap; transition: transform .15s ease, box-shadow .15s ease; }
  .pp-hero-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(214, 69, 122, .34); }
  .pp-hero-masc { position: relative; flex: none; width: clamp(140px, 12vw, 190px); display: flex; justify-content: center; }
  .pp-hero-masc::after { content: ""; position: absolute; left: 12%; right: 12%; bottom: -4px; height: 18px; border-radius: 50%; background: rgba(214, 69, 122, .14); }
  .pp-hero-masc img { position: relative; z-index: 1; width: 90%; height: auto; }
  .pp-hero-masc > i { position: absolute; left: 6px; top: 22px; width: 18px; height: 16px; background:
      linear-gradient(var(--ui-rosa), var(--ui-rosa)) 0 0 / 4px 12px no-repeat,
      linear-gradient(var(--ui-rosa), var(--ui-rosa)) 8px 2px / 4px 10px no-repeat; transform: rotate(-35deg); border-radius: 2px; opacity: .85; }
  .pp-hero-dica { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border: 1px solid #F6DCE6; border-radius: 14px; background: rgba(255, 255, 255, .6); }
  .pp-hero-dica > span { width: 44px; height: 44px; flex: none; border-radius: 50%; background: #FDEBF1; color: var(--ui-rosa); display: flex; align-items: center; justify-content: center; }
  .pp-hero-dica p { margin: 0; font-size: 14.5px; color: #6B5C62; line-height: 1.45; }
  .pp-hero-dica b { display: block; font-size: 17px; font-weight: 600; color: var(--ui-rosa); margin-bottom: 2px; }
  .pp-lista { display: flex; flex-direction: column; padding: 10px; border: 1px solid var(--ui-linha); border-radius: 16px; }
  .pp-li { display: flex; align-items: center; gap: 16px; width: 100%; min-height: 64px; padding: 8px 14px; border: 0; border-bottom: 1px solid var(--ui-linha); border-radius: 0; background: none; font-family: inherit; text-align: left; color: inherit; cursor: pointer; }
  .pp-li:last-child { border-bottom: 0; }
  .pp-li:disabled { cursor: default; }
  .pp-li:not(:disabled):hover { background: #FCF7F9; }
  .pp-li-n { width: 36px; height: 36px; flex: none; border-radius: 50%; background: #F1EEEF; color: #5E5357; font-size: 15px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
  .pp-li-tx { flex: 1; min-width: 0; }
  .pp-li-tx b { display: block; font-size: 16px; font-weight: 500; color: #241A1E; line-height: 1.25; }
  .pp-li-tx small { display: block; margin-top: 2px; font-size: 14px; color: var(--ui-texto-2); }
  .pp-li-seta { flex: none; color: #B4AAAE; }
  .pp-li--vez { background: #FDEBF1; border-radius: 12px; border-bottom-color: transparent; }
  .pp-li--vez:not(:disabled):hover { background: #FBE2EB; }
  .pp-li--vez .pp-li-n { background: var(--ui-rosa); color: #fff; }
  .pp-li--vez .pp-li-seta { color: var(--ui-rosa); }
  .pp-li--ok .pp-li-n { background: var(--ui-verde); color: #fff; }
  .pp-li--ok .pp-li-tx b { color: var(--ui-texto-2); text-decoration: line-through; text-decoration-color: #C9B9BF; }
  .pp-li--ok .pp-li-tx small { color: var(--ui-verde); }
  .pp-col-b > .pp-ps:first-child { border-top: none; }
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
  .ppf-lg3 { margin-top: 18px; }
  .ppf-lg3 > p { margin: 10px 2px 0; font-size: 13px; color: var(--ui-texto-2); text-align: center; white-space: nowrap; }
  .ppf-d-pe .ppf-doo { margin: 0; height: 36px; border: 0; padding: 0 12px; font-size: 13.5px; }
  .ppf-d-pe span { font-size: 12px; color: var(--ui-texto-3); padding-right: 4px; white-space: nowrap; }
  .ppf-d-opc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .ppf-d-opc button { height: 42px; border: 1px solid var(--ui-borda); border-radius: 10px; background: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; cursor: pointer; }
  .ppf-d-opc button.on { border-color: var(--ui-escolha); background: var(--ui-escolha-fundo); color: var(--ui-escolha); font-weight: 600; }
  .ppf-d-l { display: block; margin: 16px 2px 8px; font-size: 15px; font-weight: 700; color: var(--ui-texto); }
  .ppf-d-l + .ppf-d-campo { margin-top: 0; }
  .ppf-d-ajuda { margin-top: 14px; padding: 0 2px; }
  /* (29/10 · 5.00) computador: janela larga, campo à esquerda e a prévia do cardápio à direita; botões no canto */
  .ui-janela:has(.ppf-d--2col) { width: min(880px, calc(100vw - 48px)); max-width: none; }
  .ui-janela:has(.ppf-d--2col) .ui-janela-pe { display: flex; justify-content: flex-end; }
  .ui-janela:has(.ppf-d--2col) .ui-janela-pe .ui-bt { width: auto; padding-left: 28px; padding-right: 28px; }
  .ppf-d--2col { position: relative; min-height: 340px; padding-right: 368px; }
  .ppf-d--2col > .ppf-d-prev { position: absolute; top: 0; right: 0; width: 340px; }
  .ppf-d-prev > p { margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .ppf-d--2col .ppf-d-campo textarea { height: 190px; font-size: 15.5px; line-height: 1.55; }
  .ui-janela:has(.ppf-d--end) { max-height: min(94dvh, 800px); }
  .ppf-d--end .ppf-row > .ppf-f { min-width: 0; flex: 1; }
  .ppf-d--end { min-height: 560px; } /* (29/10 · 5.02) já no tamanho do endereço escrito à mão (o maior): não cresce ao achar o CEP */
  .ppf-d--end .ppf-d-prev .mpe { margin-top: 0 !important; }
  .ppf-d--hor { min-height: 490px; } /* (29/10 · 5.02) já na altura de Sábado e Domingo ligados: não cresce ao ligar */
  .ppf-d-dica1 { margin: 12px 2px 0; font-size: 13.5px; line-height: 1.5; color: var(--ui-texto-2); }
  .ppf-d-ajuda > p { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--ui-texto-2); }
  .ppf-d-ajuda ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .ppf-d-ajuda li { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppf-d-ajuda li svg { flex: none; color: #16A34A; }
  .ppf-d-ajuda li b { font-weight: 600; color: var(--ui-texto); }
  .ppf-d-ajuda > small { display: block; margin-top: 10px; font-size: 12.5px; color: var(--ui-texto-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppf-ia { margin-top: 14px; border: 1.5px solid #F4C6D7; border-radius: 16px; background: #FFF8FB; padding: 14px; }
  .ppf-ia-cab { display: flex; align-items: center; gap: 10px; }
  .ppf-ia-cab img { flex: none; width: 34px; height: 34px; object-fit: contain; }
  .ppf-ia-cab b { display: block; font-size: 15px; font-weight: 700; color: var(--ui-texto); white-space: nowrap; }
  .ppf-ia-cab small { display: block; font-size: 12.5px; color: var(--ui-texto-2); white-space: nowrap; }
  .ppf-ia-l { display: block; margin: 14px 0 6px; font-size: 13px; font-weight: 600; color: var(--ui-texto); }
  .ppf-ia-l span { font-weight: 400; color: var(--ui-texto-3); }
  .ppf-ia-in { display: block; width: 100%; height: 44px; box-sizing: border-box; padding: 0 12px; border: 1.5px solid var(--ui-borda-campo); border-radius: 10px; background: var(--ui-branco); font-family: inherit; font-size: 16px; color: var(--ui-texto); outline: none; }
  .ppf-ia-in:focus { border-color: var(--ui-rosa); }
  .ppf-ia-pe { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
  .ppf-ia-ops { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .ppf-ia-ops button { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 12px; border: 1px solid var(--ui-borda); border-radius: 12px; background: var(--ui-branco); font-family: inherit; font-size: 14px; line-height: 1.4; color: var(--ui-texto); text-align: left; cursor: pointer; }
  .ppf-ia-ops button.on { border: 2px solid var(--ui-escolha); padding: 11px; }
  .ppf-ia-ops i { flex: none; width: 20px; height: 20px; margin-top: 1px; box-sizing: border-box; border: 2px solid #CFC6CA; border-radius: 50%; }
  .ppf-ia-ops button.on i { border: 6px solid var(--ui-escolha); }
  .ppf-ia-outras { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); white-space: nowrap; cursor: pointer; }
  .ppf-ia-outras:disabled { opacity: .6; }
  .ppf-d-voltar { min-height: 40px; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-texto-2); cursor: pointer; }
  .ppf-e-cep { margin-top: 16px; }
  .ppf-e-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .ppf-e-cab .ppf-l { margin: 0; }
  .ppf-e-cab .ppf-e-lnk { min-height: 36px; margin: 0; white-space: nowrap; }
  .ppf-e-cep .ppf-wrap { margin-top: 6px; }
  .ppf-cep.ok { display: inline-flex; align-items: center; gap: 4px; color: #16803C; font-weight: 600; }
  .ppf-e-ajuda { margin: 8px 2px 0; font-size: 13px; color: var(--ui-texto-2); }
  .ppf-e-ajuda--p { font-size: 12.5px; color: var(--ui-texto-3); }
  .ppf-e-mapa .mpe { height: clamp(64px, calc(100dvh - 620px), 124px) !important; }
  /* celular baixo: um pouco menos de espaço entre os blocos, pra caber sem rolar */
  @media (max-height: 760px) {
    .ppf-e-cep { margin-top: 10px; } .ppf-e-achado { margin-top: 8px; padding: 10px 12px; }
    .ppf-e-tit { margin: 12px 2px 6px; } .ppf-e-mapa .mpe { margin-top: 8px !important; }
  }
  @media (max-height: 660px) { .ppf-e-mapa { display: none; } } /* celular bem baixo: sem o mapa, mas sem rolar */
  /* (4.77) passo a passo: o "Agora não" do tamanho do texto, pra o "Salvar e continuar" caber inteiro no celular pequeno */
  .ui-veu--foco .ui-janela-pe:not(.ui-janela-pe--um) { grid-template-columns: auto 1fr; }
  .ui-veu--foco .ui-janela-pe > .ui-bt--secundario { padding-inline: 18px; }
  .ppf-e-tit { margin: 18px 2px 8px; }
  .ppf-p-taxa { display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: text; }
  .ppf-p-taxa > span:first-child { min-width: 0; display: flex; flex-direction: column; }
  .ppf-p-taxa b { font-size: 14px; font-weight: 600; color: var(--ui-texto); white-space: nowrap; }
  .ppf-p-taxa small { font-size: 12.5px; color: var(--ui-texto-3); white-space: nowrap; }
  .ppf-p-taxa-in { flex: none; display: flex; align-items: center; gap: 6px; width: 108px; height: 44px; padding: 0 10px; box-sizing: border-box; border: 1.5px solid var(--ui-borda-campo); border-radius: 10px; background: var(--ui-branco); }
  .ppf-p-taxa-in:focus-within { border-color: var(--ui-rosa); }
  .ppf-p-taxa-in em { font-style: normal; font-size: 14px; color: var(--ui-texto-3); }
  .ppf-p-taxa-in input { width: 100%; min-width: 0; border: 0; outline: none; background: none; font-family: inherit; font-size: 16px; color: var(--ui-texto); }
  .ppf-p-taxa-b { margin: 0; font-size: 13px; color: var(--ui-texto-2); }
  .ppf-in--g { min-height: 52px; font-size: 17px; }
  .ppf-e-lnk { min-height: 44px; margin-top: 4px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
  .ppf-e-achado { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: var(--ui-cinza); }
  .ppf-e-achado span { min-width: 0; }
  .ppf-e-achado b { display: block; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppf-e-achado small { display: block; font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppf-e-achado button { flex: none; min-height: 40px; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
  .ppf-e-aviso { margin: 12px 0 0; font-size: 13.5px; font-weight: 600; color: var(--ui-laranja); }
  .ppf-row--uf > .ppf-f:last-child { flex: 0 0 76px; }
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
