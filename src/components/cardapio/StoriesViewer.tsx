import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Stories from "react-insta-stories";
import Hls from "hls.js";
import { SpeakerHigh, SpeakerSlash, X } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { type Story, haQuanto, urlVideoStory, urlCapaStory, aquecerStory, marcarStoryVisto, STORY_SEGUNDOS_FOTO } from "@/lib/stories";

/**
 * (19/11) Stories do cardápio em tela cheia. As barrinhas, o toque nos lados (volta / próximo) e o segurar
 * para pausar vêm da biblioteca react-insta-stories; o cabeçalho com a logo e o botão do produto são nossos.
 * O vídeo vem do Bunny Stream em HLS (hls.js; no iPhone o Safari toca direto).
 */
type Acao = (a: "play" | "pause" | "next" | "previous", semBuffer?: boolean) => void;
/**
 * Conversa entre o vídeo e a tela, por contexto (assim a biblioteca não recria, e reinicia, o vídeo):
 * mudo = som desligado · semSom() = o navegador não deixou começar com som · falhou(de novo) = o vídeo não carregou
 */
type Ponte = { mudo: boolean; semSom: () => void; falhou: (tentarDeNovo: () => void) => void };
const PonteCtx = createContext<Ponte>({ mudo: false, semSom: () => {}, falhou: () => {} });
/** dados do produto que o cartão do story mostra */
export type ProdutoDoStory = { nome: string; foto?: string | null; preco?: string | null };

function VideoStory({ story, action, isPaused }: { story: Story; action: Acao; isPaused: boolean }) {
  const ponte = useContext(PonteCtx);
  const mudo = ponte.mudo;
  const ponteRef = useRef(ponte); ponteRef.current = ponte;
  const ref = useRef<HTMLVideoElement>(null);
  const [carregado, setCarregado] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const v = ref.current;
    if (!v || !story.video_id) return;
    action("pause", true); // a barrinha só anda quando o vídeo começa
    const url = urlVideoStory(story.video_id);
    let hls: Hls | null = null;
    // sem permissão para som: começa mudo e a tela avisa "Toque para ativar o som"
    const tocar = () => { v.play().catch(() => { v.muted = true; ponteRef.current.semSom(); v.play().catch(() => {}); }); };
    // não carregou: em vez de fechar sozinho, a tela mostra "Não deu para carregar" com "Tentar de novo"
    const desistir = () => { setCarregado(true); ponteRef.current.falhou(() => { setCarregado(false); setTentativa(n => n + 1); }); };
    // (19/11) hls.js primeiro. O Chrome novo diz que toca HLS sozinho, mas trava carregando; o player próprio do
    // navegador fica só para quem não tem hls.js (iPhone antigo, onde o Safari toca HLS de verdade).
    if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 10 });
      let consertos = 0;
      hls.on(Hls.Events.MANIFEST_PARSED, tocar);
      hls.on(Hls.Events.ERROR, (_e, d) => {
        console.warn("[stories] vídeo:", d.type, d.details, d.response?.code ?? "", d.fatal ? "(fatal)" : "");
        if (!d.fatal) return;
        // uma segunda chance antes de pular: recarrega (rede) ou reinicia o decodificador (mídia)
        if (consertos++ < 1) { if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError(); else hls?.startLoad(); return; }
        desistir();
      });
      hls.loadSource(url); hls.attachMedia(v);
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = url; tocar(); }
    else { desistir(); return; }
    const aoTocar = () => { setCarregado(true); action("play", true); };
    const aoErro = () => { if (hls) return; console.warn("[stories] vídeo: erro do player", v.error?.code, v.error?.message); desistir(); };
    v.addEventListener("playing", aoTocar);
    v.addEventListener("error", aoErro);
    return () => { v.removeEventListener("playing", aoTocar); v.removeEventListener("error", aoErro); hls?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.video_id, tentativa]);

  useEffect(() => { const v = ref.current; if (!v || !carregado) return; if (isPaused) v.pause(); else v.play().catch(() => {}); }, [isPaused, carregado]);
  useEffect(() => { if (ref.current) ref.current.muted = mudo; }, [mudo]);

  return (
    <div className="stv-midia">
      <video ref={ref} playsInline muted={mudo} poster={story.video_id ? urlCapaStory(story.video_id) : undefined} />
      {!carregado && <span className="stv-carregando" aria-label="Carregando" />}
    </div>
  );
}

function FotoStory({ story }: { story: Story }) {
  return <div className="stv-midia"><img src={story.foto_url || ""} alt="" /></div>;
}

export default function StoriesViewer({ stories, loja, logo, aoFechar, aoVerProduto, produtoDe, inicio = 0, semContar = false }: {
  stories: Story[]; loja: string; logo?: string | null; aoFechar: () => void;
  /** story em que abre · semContar: prévia da própria confeiteira, não soma visualização */
  inicio?: number; semContar?: boolean;
  aoVerProduto: (produtoId: string) => void; produtoDe: (produtoId: string) => ProdutoDoStory | null;
}) {
  const [i, setI] = useState(inicio);
  const [mudo, setMudo] = useState(false);
  const [dicaSom, setDicaSom] = useState(false);
  const [falha, setFalha] = useState<{ de: number; tentar: () => void } | null>(null);
  const atual = stories[i];
  const iRef = useRef(i); iRef.current = i;
  const fecharRef = useRef(aoFechar); fecharRef.current = aoFechar;
  const ponte = useMemo<Ponte>(() => ({
    mudo,
    semSom: () => { setMudo(true); setDicaSom(true); },
    falhou: tentar => setFalha({ de: iRef.current, tentar }),
  }), [mudo]);

  // (19/11) o "voltar" do celular fecha só o story (antes saía do cardápio inteiro): o story entra no histórico
  // do navegador ao abrir e sai dele ao fechar.
  useEffect(() => {
    let noHistorico = true;
    try { window.history.pushState({ ...(window.history.state || {}), stv: 1 }, ""); } catch { noHistorico = false; }
    const voltou = () => { noHistorico = false; fecharRef.current(); };
    window.addEventListener("popstate", voltou);
    return () => {
      window.removeEventListener("popstate", voltou);
      if (noHistorico && window.history.state?.stv) window.history.back();
    };
  }, []);

  // arrastar para baixo fecha, como no Instagram
  const toque = useRef<{ x: number; y: number } | null>(null);
  const aoTocar = (e: React.TouchEvent) => { const t = e.touches[0]; toque.current = t ? { x: t.clientX, y: t.clientY } : null; };
  const aoSoltar = (e: React.TouchEvent) => {
    const a = toque.current, t = e.changedTouches[0]; toque.current = null;
    if (!a || !t) return;
    const dy = t.clientY - a.y, dx = Math.abs(t.clientX - a.x);
    if (dy > 90 && dy > dx * 1.5) aoFechar();
  };

  // ao trocar de story: some o aviso de falha do anterior e o próximo já começa a carregar
  useEffect(() => {
    setFalha(f => (f && f.de !== i ? null : f));
    const prox = stories[i + 1];
    if (!prox) return;
    if (prox.tipo === "video" && prox.video_id) void aquecerStory(prox.video_id);
    else if (prox.foto_url) { const img = new Image(); img.src = prox.foto_url; }
  }, [i, stories]);
  useEffect(() => { if (!dicaSom) return; const t = window.setTimeout(() => setDicaSom(false), 6000); return () => window.clearTimeout(t); }, [dicaSom]);

  // trava a rolagem do cardápio por baixo e fecha no "voltar" do celular / Esc
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("stv-aberto"); // esconde a faixa "Você está vendo como cliente", que cobria o topo do story
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = antes; document.body.classList.remove("stv-aberto"); window.removeEventListener("keydown", tecla); };
  }, [aoFechar]);

  // conta a visualização uma vez por story em cada visita
  useEffect(() => {
    if (!atual || semContar) return;
    marcarStoryVisto(atual.id);
    try {
      const k = `doonly_story_visto_${atual.id}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch { /* sem armazenamento: conta assim mesmo */ }
    void supabase.rpc("story_viu", { p_id: atual.id }).then(() => {}, () => {});
  }, [atual, semContar]);

  const lista = useMemo(() => stories.map(s => ({
    duration: Math.max(3, Math.round((s.tipo === "video" ? Number(s.duracao) || 15 : STORY_SEGUNDOS_FOTO))) * 1000,
    content: ({ action, isPaused }: { action: Acao; isPaused: boolean }) =>
      s.tipo === "video" ? <VideoStory story={s} action={action} isPaused={isPaused} /> : <FotoStory story={s} />,
  })), [stories]);

  if (!atual) return null;
  const prod = atual.produto_id ? produtoDe(atual.produto_id) : null;

  return (
    <div className="stv" role="dialog" aria-modal="true" aria-label={`Stories de ${loja}`}>
      <div className="stv-caixa" onTouchStart={aoTocar} onTouchEnd={aoSoltar}>
        <PonteCtx.Provider value={ponte}>
          <Stories stories={lista as never} currentIndex={inicio} width="100%" height="100%" defaultInterval={6000} keyboardNavigation
            onStoryStart={(n: number) => setI(n)} onAllStoriesEnd={aoFechar}
            storyContainerStyles={{ background: "#000" }} progressContainerStyles={{ padding: "10px 8px 0", filter: "none" }} />
        </PonteCtx.Provider>
        <div className="stv-cab">
          <span className="stv-logo">{logo ? <img src={logo} alt="" /> : <b>{loja.charAt(0).toUpperCase()}</b>}</span>
          <span className="stv-nome"><b>{loja}</b><small>{haQuanto(atual.created_at)}</small></span>
          {atual.tipo === "video" && (
            <button type="button" className="stv-bt" aria-label={mudo ? "Ligar o som" : "Tirar o som"} onClick={() => { setMudo(m => !m); setDicaSom(false); }}>
              {mudo ? <SpeakerSlash size={20} weight="bold" /> : <SpeakerHigh size={20} weight="bold" />}
            </button>
          )}
          <button type="button" className="stv-bt" aria-label="Fechar" onClick={aoFechar}><X size={22} weight="bold" /></button>
        </div>
        {dicaSom && atual.tipo === "video" && !falha && (
          <button type="button" className="stv-som" onClick={() => { setMudo(false); setDicaSom(false); }}><SpeakerHigh size={16} weight="bold" aria-hidden="true" />Toque para ativar o som</button>
        )}
        {falha && falha.de === i && (
          <div className="stv-falha">
            <b>Não deu para carregar</b>
            <button type="button" onClick={() => { const t = falha.tentar; setFalha(null); t(); }}>Tentar de novo</button>
          </div>
        )}
        {atual.produto_id && prod && (
          <button type="button" className="stv-prod" onClick={() => aoVerProduto(atual.produto_id!)} aria-label={`Pedir ${prod.nome}`}>
            {prod.foto && <img src={prod.foto} alt="" />}
            <span className="stv-prod-tx"><b>{prod.nome}</b>{prod.preco && <small>{prod.preco}</small>}</span>
            <span className="stv-prod-bt">Pedir</span>
          </button>
        )}
      </div>
      <style>{`
        body.stv-aberto .cp-cc { display: none; }
        .stv { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: #000; font-family: var(--font-base); }
        .stv-caixa { position: relative; width: 100%; height: 100%; max-width: 480px; overflow: hidden; background: #000; }
        @media (min-width: 640px) { .stv { background: rgba(0,0,0,.92); } .stv-caixa { height: min(100%, 860px); border-radius: 16px; } }
        .stv-midia { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: #000; }
        .stv-midia video, .stv-midia img { width: 100%; height: 100%; object-fit: contain; }
        .stv-carregando { position: absolute; width: 34px; height: 34px; border: 3px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: stv-gira .8s linear infinite; }
        @keyframes stv-gira { to { transform: rotate(360deg); } }
        .stv-cab { position: absolute; z-index: 1001; top: 22px; left: 0; right: 0; display: flex; align-items: center; gap: 8px; padding: 0 10px; color: #fff; pointer-events: none; }
        .stv-cab > * { pointer-events: auto; }
        .stv-logo { flex: none; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; overflow: hidden; background: #fff; color: #22130E; }
        .stv-logo img { width: 100%; height: 100%; object-fit: cover; }
        .stv-nome { flex: 1; min-width: 0; display: flex; flex-direction: column; text-shadow: 0 1px 3px rgba(0,0,0,.6); pointer-events: none; }
        .stv-nome b { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stv-nome small { font-size: 12px; opacity: .85; }
        .stv-bt { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; margin: 0; padding: 0; border: 0; border-radius: 50%; background: rgba(0,0,0,.35); color: #fff; cursor: pointer; }
        .stv-prod { position: absolute; z-index: 1001; left: 12px; right: 12px; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); display: flex; align-items: center; gap: 10px; min-height: 60px; margin: 0; padding: 8px; border: 0; border-radius: 16px; background: #fff; color: #22130E; font-family: inherit; text-align: left; cursor: pointer; }
        .stv-prod img { flex: none; width: 44px; height: 44px; border-radius: 10px; object-fit: cover; }
        .stv-prod-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; padding-left: 4px; }
        .stv-prod-tx b { font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stv-prod-tx small { font-size: 13px; color: #6B5F5A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stv-prod-bt { flex: none; display: flex; align-items: center; height: 40px; padding: 0 18px; border-radius: 999px; background: var(--ui-rosa-botao, #CC2E66); color: #fff; font-size: 15px; font-weight: 500; }
        .stv-som { position: absolute; z-index: 1001; top: 74px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; min-height: 36px; margin: 0; padding: 0 14px; border: 0; border-radius: 999px; background: rgba(0,0,0,.6); color: #fff; font-family: inherit; font-size: 13px; white-space: nowrap; cursor: pointer; }
        .stv-falha { position: absolute; z-index: 1001; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 12px; color: #fff; text-align: center; }
        .stv-falha b { font-size: 15px; font-weight: 500; white-space: nowrap; }
        .stv-falha button { min-height: 44px; margin: 0; padding: 0 20px; border: 0; border-radius: 999px; background: #fff; color: #22130E; font-family: inherit; font-size: 15px; font-weight: 500; cursor: pointer; }
      `}</style>
    </div>
  );
}
