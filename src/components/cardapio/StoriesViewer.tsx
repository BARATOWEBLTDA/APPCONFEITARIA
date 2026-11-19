import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Stories from "react-insta-stories";
import { SpeakerHigh, SpeakerSlash, X } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { type Story, haQuanto, urlVideoStory, STORY_SEGUNDOS_FOTO } from "@/lib/stories";

/**
 * (19/11) Stories do cardápio em tela cheia. As barrinhas, o toque nos lados (volta / próximo) e o segurar
 * para pausar vêm da biblioteca react-insta-stories; o cabeçalho com a logo e o botão do produto são nossos.
 * O vídeo é um MP4 leve guardado no Supabase, que todo celular toca direto.
 */
type Acao = (a: "play" | "pause" | "next" | "previous", semBuffer?: boolean) => void;
/** som ligado/desligado: por contexto, para trocar sem a biblioteca recriar (e reiniciar) o vídeo */
const MudoCtx = createContext(false);

function VideoStory({ story, action, isPaused }: { story: Story; action: Acao; isPaused: boolean }) {
  const mudo = useContext(MudoCtx);
  const ref = useRef<HTMLVideoElement>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || !story.video_id) return;
    action("pause", true); // a barrinha só anda quando o vídeo começa
    v.src = urlVideoStory(story.video_id);
    const aoTocar = () => { setCarregado(true); action("play", true); };
    const aoErro = () => action("next");
    v.addEventListener("playing", aoTocar);
    v.addEventListener("error", aoErro);
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); // sem permissão para som: começa mudo
    return () => { v.removeEventListener("playing", aoTocar); v.removeEventListener("error", aoErro); v.removeAttribute("src"); v.load(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.video_id]);

  useEffect(() => { const v = ref.current; if (!v || !carregado) return; if (isPaused) v.pause(); else v.play().catch(() => {}); }, [isPaused, carregado]);
  useEffect(() => { if (ref.current) ref.current.muted = mudo; }, [mudo]);

  return (
    <div className="stv-midia">
      <video ref={ref} playsInline muted={mudo} poster={story.foto_url || undefined} preload="auto" />
      {!carregado && <span className="stv-carregando" aria-label="Carregando" />}
    </div>
  );
}

function FotoStory({ story }: { story: Story }) {
  return <div className="stv-midia"><img src={story.foto_url || ""} alt="" /></div>;
}

export default function StoriesViewer({ stories, loja, logo, aoFechar, aoVerProduto, nomeProduto }: {
  stories: Story[]; loja: string; logo?: string | null; aoFechar: () => void;
  aoVerProduto: (produtoId: string) => void; nomeProduto: (produtoId: string) => string | null;
}) {
  const [i, setI] = useState(0);
  const [mudo, setMudo] = useState(false);
  const atual = stories[i];

  // trava a rolagem do cardápio por baixo e fecha no "voltar" do celular / Esc
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = antes; window.removeEventListener("keydown", tecla); };
  }, [aoFechar]);

  // conta a visualização uma vez por story em cada visita
  useEffect(() => {
    if (!atual) return;
    try {
      const k = `doonly_story_visto_${atual.id}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch { /* sem armazenamento: conta assim mesmo */ }
    void supabase.rpc("story_viu", { p_id: atual.id }).then(() => {}, () => {});
  }, [atual]);

  const lista = useMemo(() => stories.map(s => ({
    duration: Math.max(3, Math.round((s.tipo === "video" ? Number(s.duracao) || 15 : STORY_SEGUNDOS_FOTO))) * 1000,
    content: ({ action, isPaused }: { action: Acao; isPaused: boolean }) =>
      s.tipo === "video" ? <VideoStory story={s} action={action} isPaused={isPaused} /> : <FotoStory story={s} />,
  })), [stories]);

  if (!atual) return null;
  const prodNome = atual.produto_id ? nomeProduto(atual.produto_id) : null;

  return (
    <div className="stv" role="dialog" aria-modal="true" aria-label={`Stories de ${loja}`}>
      <div className="stv-caixa">
        <MudoCtx.Provider value={mudo}>
          <Stories stories={lista as never} width="100%" height="100%" defaultInterval={6000} keyboardNavigation
            onStoryStart={(n: number) => setI(n)} onAllStoriesEnd={aoFechar}
            storyContainerStyles={{ background: "#000" }} progressContainerStyles={{ padding: "10px 8px 0", filter: "none" }} />
        </MudoCtx.Provider>
        <div className="stv-cab">
          <span className="stv-logo">{logo ? <img src={logo} alt="" /> : <b>{loja.charAt(0).toUpperCase()}</b>}</span>
          <span className="stv-nome"><b>{loja}</b><small>{haQuanto(atual.created_at)}</small></span>
          {atual.tipo === "video" && (
            <button type="button" className="stv-bt" aria-label={mudo ? "Ligar o som" : "Tirar o som"} onClick={() => setMudo(m => !m)}>
              {mudo ? <SpeakerSlash size={20} weight="bold" /> : <SpeakerHigh size={20} weight="bold" />}
            </button>
          )}
          <button type="button" className="stv-bt" aria-label="Fechar" onClick={aoFechar}><X size={22} weight="bold" /></button>
        </div>
        {atual.produto_id && prodNome && (
          <button type="button" className="stv-prod" onClick={() => aoVerProduto(atual.produto_id!)}>Ver {prodNome}</button>
        )}
      </div>
      <style>{`
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
        .stv-prod { position: absolute; z-index: 1001; left: 16px; right: 16px; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); min-height: 48px; margin: 0; padding: 0 14px; border: 0; border-radius: 12px; background: #fff; color: #22130E; font-family: inherit; font-size: 15px; font-weight: 500; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>
    </div>
  );
}
