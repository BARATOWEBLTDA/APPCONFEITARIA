import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { BookOpenText, CaretLeft, CaretRight, MagnifyingGlass, MapPin, SpeakerHigh, SpeakerSlash, X, CalendarBlank } from "@phosphor-icons/react";
import type { Configuracoes, DesignSettings, Produto } from "@/types/database";
import { montarSecoes, SecaoCardapio, LinhaProduto, type Secao } from "@/components/cardapio/ItensCardapio";
import { getStatusLoja, getEnderecoData } from "@/components/cardapio/CardapioModelo1";
import { SeloVerificado } from "@/components/cardapio/SeloVerificado";
import { Touquinha } from "./Natal";
import "./catalogoNatal.css";

/**
 * (18/10) Cardápio de Natal em forma de catálogo (celular).
 * Capa: imagem grande (da loja ou da biblioteca), logo com a touquinha, "Cardápio Especial de Natal", aviso e "Ver catálogo".
 * Depois, uma página por categoria (categoria grande se divide em páginas de 8). A folha vira pro lado com som de papel;
 * o alto-falante desliga o som (fica lembrado). Quem pede menos movimento vê a página só trocar.
 */
const POR_PAGINA = 8;
const COR = "#8B2332";
const CHAVE_SOM = "doonly:somCatalogo";

type Pagina = { id: string; secaoId: string; titulo: string; parte: string; secao: Secao };

function fonteFesta() {
  if (document.getElementById("ctn-fonte")) return;
  const l = document.createElement("link");
  l.id = "ctn-fonte"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,500&display=swap";
  document.head.appendChild(l);
}

let ac: AudioContext | null = null;
/**
 * Som de folha virando, suave: ruído "rosa" (mais grave que o chiado), entra devagar, passa por um filtro
 * que sobe e desce (o "fffuu" do papel) e some no mesmo tempo da animação (0,8 s). Volume baixo.
 */
function somDePapel() {
  try {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return;
    ac = ac || new C();
    if (ac.state === "suspended") void ac.resume();
    const d = 0.75, sr = ac.sampleRate, n = Math.floor(sr * d);
    const b = ac.createBuffer(1, n, sr), x = b.getChannelData(0);
    // ruído rosa (Paul Kellet, versão curta) com leve "textura" de papel
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      const rosa = (b0 + b1 + b2 + w * 0.1848) * 0.18;
      const t = i / n;
      const env = t < 0.25 ? Math.pow(t / 0.25, 2) : Math.pow(1 - (t - 0.25) / 0.75, 2.2); // sobe macio e cai devagar
      const textura = 0.85 + 0.15 * Math.sin(i / sr * 2 * Math.PI * 23) * Math.random();
      x[i] = rosa * env * textura;
    }
    const s = ac.createBufferSource(); s.buffer = b;
    const f = ac.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.55;
    const t0 = ac.currentTime;
    f.frequency.setValueAtTime(700, t0);
    f.frequency.linearRampToValueAtTime(2200, t0 + d * 0.3);
    f.frequency.exponentialRampToValueAtTime(900, t0 + d);
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4200;
    const g = ac.createGain(); g.gain.value = 0.32;
    s.connect(f).connect(lp).connect(g).connect(ac.destination); s.start(t0);
  } catch { /* sem som, segue */ }
}

function HeroPadrao() {
  // Sem imagem: fundo bordô com brilhos e bolas douradas penduradas
  const bola = (x: number, len: number, c: string) => (
    <g key={x}><line x1={x} y1={0} x2={x} y2={len} stroke="#E7C46A" strokeWidth={1} /><rect x={x - 3} y={len - 2} width={6} height={4} fill="#E7C46A" />
      <circle cx={x} cy={len + 11} r={11} fill={c} /><circle cx={x - 3.5} cy={len + 7.5} r={2.6} fill="#fff" opacity={0.5} /></g>
  );
  return (
    <div className="ctn-hero-padrao" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => { const s = 10 + ((i * 37) % 30); return <span key={i} className="ctn-bok" style={{ left: `${(i * 53) % 100}%`, top: `${(i * 29) % 88}%`, width: s, height: s }} />; })}
      <svg className="ctn-bolas" viewBox="0 0 360 300" preserveAspectRatio="xMidYMin slice">
        {bola(38, 64, "#C9A227")}{bola(92, 30, "#E7C46A")}{bola(272, 46, "#C9A227")}{bola(322, 86, "#E7C46A")}
      </svg>
    </div>
  );
}

export default function CatalogoNatal({ design, config, isPro, produtos, categorias, agrupar, aoAbrirSobre, espacoBaixo }: {
  design: DesignSettings; config: Configuracoes | null; isPro: boolean; produtos: Produto[]; categorias: string[]; agrupar: boolean;
  aoAbrirSobre: () => void; espacoBaixo: number;
}) {
  useEffect(fonteFesta, []);
  const [atual, setAtual] = useState(0); // 0 = capa
  const [virando, setVirando] = useState<{ de: number; dir: 1 | -1 } | null>(null);
  const [som, setSom] = useState(() => { try { return localStorage.getItem(CHAVE_SOM) !== "0"; } catch { return true; } });
  const [busca, setBusca] = useState("");

  const paginas: Pagina[] = useMemo(() => {
    const cats = categorias.filter(c => c && c !== "Todos");
    return montarSecoes(produtos, cats, agrupar && cats.length > 0).flatMap(sec => {
      const partes: Produto[][] = [];
      for (let i = 0; i < sec.produtos.length; i += POR_PAGINA) partes.push(sec.produtos.slice(i, i + POR_PAGINA));
      return partes.map((ps, i) => ({ id: `${sec.id}-${i}`, secaoId: sec.id, titulo: sec.nome, parte: partes.length > 1 ? `${i + 1} de ${partes.length}` : "", secao: { ...sec, produtos: ps } }));
    });
  }, [produtos, categorias.join("|"), agrupar]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = paginas.length;
  const capitulos = paginas.filter((p, i) => i === 0 || paginas[i - 1].secaoId !== p.secaoId);

  const pouco = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const ir = (n: number) => {
    if (n < 0 || n > total || n === atual || virando) return;
    window.scrollTo({ top: 0 });
    setBusca("");
    if (som) somDePapel();
    if (!pouco) setVirando({ de: atual, dir: n > atual ? 1 : -1 });
    setAtual(n);
  };
  /**
   * (19/10) Da capa pra primeira página: folha de verdade (StPageFlip), com a ponta dobrando.
   * Tira uma "foto" (cópia) da capa e da página 1, folheia por cima e some quando termina.
   * Se a biblioteca não carregar, cai no virar simples.
   */
  const abrirCatalogo = async () => {
    if (virando || atual !== 0 || total === 0) return;
    if (pouco) { ir(1); return; }
    const atualEl = document.querySelector<HTMLElement>(".ctn-atual");
    if (!atualEl) { ir(1); return; }
    window.scrollTo({ top: 0 });
    const capaCopia = atualEl.cloneNode(true) as HTMLElement;
    let PageFlip: typeof import("page-flip").PageFlip;
    try { ({ PageFlip } = await import("page-flip")); } catch { ir(1); return; }
    flushSync(() => { setBusca(""); setAtual(1); });
    const pagCopia = (document.querySelector<HTMLElement>(".ctn-atual")?.cloneNode(true) as HTMLElement) || document.createElement("div");
    const w = Math.round(window.innerWidth), h = Math.round(window.innerHeight - espacoBaixo);
    const veu = document.createElement("div");
    veu.className = "ctn-pf";
    veu.style.height = `${h}px`;
    const livro = document.createElement("div");
    [capaCopia, pagCopia].forEach(c => { const pg = document.createElement("div"); pg.className = "ctn-pf-pg"; const ctx = document.createElement("div"); ctx.className = "ctn"; ctx.appendChild(c); pg.appendChild(ctx); livro.appendChild(pg); }); // dentro de .ctn: os estilos do catálogo valem na cópia
    veu.appendChild(livro);
    document.body.appendChild(veu);
    let pf: InstanceType<typeof PageFlip> | null = null;
    const acabar = () => { try { pf?.destroy(); } catch { /* ok */ } veu.remove(); };
    const seguranca = setTimeout(acabar, 2600);
    try {
      pf = new PageFlip(livro, { width: w, height: h, size: "fixed", usePortrait: true, showCover: false, drawShadow: true, maxShadowOpacity: 0.45, flippingTime: 950, useMouseEvents: false, disableFlipByClick: true, mobileScrollSupport: false, startZIndex: 0 });
      pf.loadFromHTML(livro.querySelectorAll<HTMLElement>(".ctn-pf-pg"));
      pf.on("flip", () => { clearTimeout(seguranca); setTimeout(acabar, 60); });
      if (som) somDePapel();
      requestAnimationFrame(() => pf?.flipNext("bottom"));
    } catch { clearTimeout(seguranca); acabar(); }
  };
  const alternarSom = () => { const v = !som; setSom(v); try { localStorage.setItem(CHAVE_SOM, v ? "1" : "0"); } catch { /* ok */ } };

  const status = (config as any)?.loja_pausada ? { aberto: false, msg: "Pedidos pausados no momento" } : getStatusLoja((config as any)?.horario || null);
  const endereco = getEnderecoData(config);
  const logo = design.logo_url;
  const capa = design.tema_capa_url;
  const termo = busca.trim().toLowerCase();
  const achados = termo ? produtos.filter(p => p.nome.toLowerCase().includes(termo) || p.descricao?.toLowerCase().includes(termo)) : [];

  const renderCapa = () => (
    <div className="ctn-capa" style={{ height: `calc(100svh - ${espacoBaixo}px)` }}>
      <div className="ctn-hero" style={capa ? { backgroundImage: `url(${capa})` } : undefined}>
        {!capa && <HeroPadrao />}
        {status && <span className={`ctn-st${status.aberto ? " aberto" : ""}`}><i aria-hidden="true" />{status.msg}</span>}
        <svg className="ctn-onda" viewBox="0 0 360 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 18 C30 6 50 30 80 22 C105 15 110 34 130 34 C150 34 150 14 180 16 C215 18 220 36 250 30 C275 25 285 8 315 14 C335 18 348 28 360 22 L360 40 L0 40Z" fill="#FFF8EE" />
        </svg>
      </div>
      <div className="ctn-meio">
        <div className="ctn-logo-w">
          <Touquinha parte="tras" />
          <div className="ctn-logo">{logo ? <img src={logo} alt={design.nome_loja || ""} /> : <b>{(design.nome_loja || "D").charAt(0).toUpperCase()}</b>}</div>
          <Touquinha parte="frente" />
        </div>
        <p className="ctn-nome">{design.nome_loja}{isPro && <SeloVerificado tamanho={18} />}</p>
        <h1 className="ctn-titulo">Cardápio<em>Especial de Natal</em></h1>
        {design.tema_aviso && <p className="ctn-aviso"><CalendarBlank size={16} weight="bold" aria-hidden="true" />{design.tema_aviso}</p>}
        {total > 0 && <button type="button" className="ctn-ver" onClick={() => { void abrirCatalogo(); }}><BookOpenText size={22} weight="bold" aria-hidden="true" />Ver catálogo</button>}
        <div className="ctn-sl">
          <button type="button" onClick={aoAbrirSobre}>Sobre a loja</button>
          {endereco && <><span aria-hidden="true">·</span><span className="ctn-cid"><MapPin size={15} weight="bold" aria-hidden="true" />{endereco.cidade}</span></>}
        </div>
        {(config as any)?.loja_pausada && <p className="ctn-pausa">Pedidos pausados no momento. Pra encomendar, chame a loja no WhatsApp.</p>}
      </div>
    </div>
  );

  const renderPagina = (i: number) => {
    const p = paginas[i - 1];
    if (!p) return null;
    const ultima = i === total;
    return (
      <div className="ctn-pag">
        <header className="ctn-cab">
          <button type="button" className="ctn-cab-loja" onClick={() => ir(0)} aria-label="Voltar pra capa">
            <span className="ctn-mini">{logo ? <img src={logo} alt="" /> : null}</span>
            <span><b>{design.nome_loja}</b><small>Cardápio de Natal</small></span>
          </button>
        </header>
        <div className="ctn-busca">
          <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
          <input type="search" placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")}><X size={16} weight="bold" /></button>}
        </div>
        {termo ? (
          <section className="ctn-res">
            <h2 className="ctn-h2">{achados.length === 1 ? "1 produto" : `${achados.length} produtos`}</h2>
            {achados.length ? <div className="ic-lista">{achados.map(pr => <LinhaProduto key={pr.id} produto={pr} cor={COR} />)}</div>
              : <p className="ctn-nada">Nenhum produto com “{busca.trim()}”.</p>}
          </section>
        ) : (<>
          {capitulos.length > 1 && (
            <div className="ctn-caps" role="tablist" aria-label="Páginas do catálogo">
              {capitulos.map(c => {
                const n = paginas.indexOf(c) + 1;
                const on = p.secaoId === c.secaoId;
                return <button key={c.id} type="button" role="tab" aria-selected={on} className={on ? "on" : ""} onClick={() => ir(n)}>{c.titulo}</button>;
              })}
            </div>
          )}
          <h2 className="ctn-h2">{p.titulo}{p.parte && <small>{p.parte}</small>}</h2>
          <SecaoCardapio secao={p.secao} cor={COR} />
          <nav className="ctn-nav" aria-label="Folhear o catálogo">
            <button type="button" onClick={() => ir(i - 1)}><CaretLeft size={16} weight="bold" aria-hidden="true" />{i === 1 ? "Capa" : "Voltar"}</button>
            <span>Página {i} de {total}</span>
            {ultima
              ? <button type="button" onClick={() => ir(0)}>Início</button>
              : <button type="button" className="pri" onClick={() => ir(i + 1)}>Próxima<CaretRight size={16} weight="bold" aria-hidden="true" /></button>}
          </nav>
          <p className="ctn-festas">Boas festas!</p>
        </>)}
      </div>
    );
  };

  const pag = (i: number) => (i === 0 ? renderCapa() : renderPagina(i));

  return (
    <div className="ctn" style={{ paddingBottom: atual === 0 ? 0 : espacoBaixo }}>
      <button type="button" className="ctn-som" onClick={alternarSom} aria-label={som ? "Desligar o som das páginas" : "Ligar o som das páginas"}>
        {som ? <SpeakerHigh size={18} weight="bold" /> : <SpeakerSlash size={18} weight="bold" />}
      </button>
      <div key={atual} className="ctn-atual">{pag(atual)}</div>
      {virando && (
        <div className={`ctn-folha ctn-folha--${virando.dir > 0 ? "vai" : "volta"}`} aria-hidden="true" onAnimationEnd={() => setVirando(null)}>
          {pag(virando.de)}
        </div>
      )}
    </div>
  );
}
