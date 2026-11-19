// ── Stories.tsx ──────────────────────────────────────────────────────────────
// (19/11) Stories do cardápio: a confeiteira posta um vídeo curto (até 30 s) ou uma foto, escolhe por
// quantos dias fica no ar (1 a 3) e, se quiser, o produto que o botão do story abre. Recurso do PRO.
// O vídeo vai do celular direto para o Bunny Stream (envio em partes, retoma se a internet cair).
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { Eye, Image as ImageIc, Images, Play, Plus, Trash, VideoCamera, X } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, CaixasEscolha, Janela, avisar } from "@/components/base";
import { CartaoPro } from "@/components/billing/RecursoPro";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { useProfile, fotoDaLoja } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { type Story, STORY_MAX_ATIVOS, STORY_MAX_SEGUNDOS, STORY_SEGUNDOS_FOTO, saiCurto, tempoStory, urlCapaStory } from "@/lib/stories";

const StoriesViewer = lazy(() => import("@/components/cardapio/StoriesViewer"));

type Prod = { id: string; nome: string };
const MAX_VIDEO_MB = 500; // 2 minutos de câmera chegam a 400 MB; o vídeo é reduzido no aparelho antes de subir

const api = async (corpo: Record<string, unknown>) => {
  const r = await apiFetch("/api/story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, sumiu: r.status === 404, d: d as Record<string, any> };
};

/** quantos segundos tem o vídeo escolhido */
const duracaoDoVideo = (arq: File) => new Promise<number>(resolve => {
  const v = document.createElement("video");
  const url = URL.createObjectURL(arq);
  const fim = (n: number) => { URL.revokeObjectURL(url); resolve(n); };
  v.preload = "metadata"; v.onloadedmetadata = () => fim(Number.isFinite(v.duration) ? v.duration : 0); v.onerror = () => fim(0);
  v.src = url;
});

/** foto em pé, no máximo 1080 de largura, JPEG leve */
const reduzirFoto = (arq: File) => new Promise<Blob | null>(resolve => {
  const img = new Image();
  const url = URL.createObjectURL(arq);
  img.onload = () => {
    const k = Math.min(1, 1080 / img.width, 1920 / img.height);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob(b => resolve(b), "image/jpeg", 0.85);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
  img.src = url;
});

export default function Stories() {
  const { profile } = useProfile();
  const { isPro, loading: carregandoPlano } = usePlano();
  const uid = profile?.id || "";
  const [lista, setLista] = useState<Story[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [produtos, setProdutos] = useState<Prod[]>([]);
  const [postar, setPostar] = useState(false);
  const [apagar, setApagar] = useState<Story | null>(null);
  const conferindo = useRef(new Set<string>());
  // (19/11) igual ao Instagram: tocou em Publicar, a janela fecha e o story já aparece na lista "Enviando…"
  // Se o envio falha, o story continua na vaga como "Não enviado", com "Tentar de novo" (guarda o arquivo escolhido).
  type Envio = { previa: string; video: boolean; pct: number; fase: "preparando" | "enviando" | "falhou"; arq: File; seg: number; dias: number; prod: string; inicio?: number };
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [ver, setVer] = useState<number | null>(null); // "Ver como fica": abre o visualizador neste story

  /** inicio: segundo em que o trecho começa, quando o vídeo passou do limite e a confeiteira escolheu o corte */
  const enviar = async (arq: File, seg: number, dias: number, prod: string, inicio?: number) => {
    if (!uid || (envio && envio.fase !== "falhou")) return;
    const video = arq.type.startsWith("video/");
    if (envio?.previa) URL.revokeObjectURL(envio.previa);
    const previa = video ? "" : URL.createObjectURL(arq);
    setEnvio({ previa, video, pct: 0, fase: "enviando", arq, seg, dias, prod, inicio });
    const expira_em = new Date(Date.now() + dias * 86400000).toISOString();
    // fim(): terminou (ou não adianta tentar de novo) · falhou(): fica na vaga para tentar de novo
    const fim = (msg?: string) => { if (previa) URL.revokeObjectURL(previa); setEnvio(null); if (msg) avisar(msg, { tipo: "erro" }); };
    const falhou = () => setEnvio(x => x ? { ...x, fase: "falhou" } : x);
    let criado = ""; // vídeo já aberto no Bunny: se o envio falhar, ele é apagado para não ficar perdido lá
    try {
      if (!video) {
        const blob = await reduzirFoto(arq);
        if (!blob) return fim("Não deu para abrir a foto, tente outra");
        const caminho = `${uid}/stories/${Date.now()}.jpg`;
        const up = await supabase.storage.from("products").upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) return falhou();
        const foto_url = supabase.storage.from("products").getPublicUrl(caminho).data.publicUrl;
        const { error } = await supabase.from("stories").insert({ user_id: uid, tipo: "foto", foto_url, produto_id: prod || null, duracao: STORY_SEGUNDOS_FOTO, pronto: true, expira_em });
        if (error) return falhou();
        fim(); avisar("Seu story está no cardápio", { tipo: "ok" }); void carregar(); return;
      }
      // prepara o endereço de envio e, ao mesmo tempo, reduz o vídeo no aparelho para subir mais rápido.
      // Vídeo que já é leve (menos de 8 Mbps) sobe como está; se o aparelho não conseguir reduzir, também.
      const corte = inicio != null ? { inicio, fim: inicio + seg } : undefined;
      const pesado = !!corte || (seg > 0 && (arq.size * 8) / seg > 8_000_000);
      if (pesado) setEnvio(x => x ? { ...x, fase: "preparando" } : x);
      const reduzir = async (): Promise<Blob> => {
        if (!pesado) return arq;
        try {
          const { prepararVideoStory } = await import("@/lib/prepararVideoStory");
          const b = await prepararVideoStory(arq, pct => setEnvio(x => x ? { ...x, pct } : x), corte);
          return corte || b.size < arq.size ? b : arq;
        } catch (e) { if (corte) throw e; return arq; } // sem conseguir cortar não dá para subir o vídeo inteiro: fica "Não enviado"
      };
      // com corte, corta primeiro: se o aparelho não conseguir, nem chega a abrir um vídeo no Bunny
      const cortado = corte ? await reduzir() : null;
      const [{ ok, d }, pronto] = await Promise.all([api({ acao: "criar" }), cortado ? Promise.resolve(cortado) : reduzir()]);
      // limite de stories ou conta sem PRO: tentar de novo não resolve, então sai da vaga com o aviso
      if (!ok) return d.error === "limite" || d.error === "so_pro" ? fim(d.message) : falhou();
      criado = String(d.videoId);
      setEnvio(x => x ? { ...x, fase: "enviando", pct: 0 } : x);
      await new Promise<void>((resolve, reject) => {
        new tus.Upload(pronto, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: { AuthorizationSignature: d.assinatura, AuthorizationExpire: String(d.expira), VideoId: d.videoId, LibraryId: String(d.libraryId) },
          metadata: { filetype: pronto.type || arq.type, title: `story-${uid}-${Date.now()}` }, // o título começa com o id da conta: é como o servidor sabe de quem é o vídeo
          onError: e => reject(e),
          onProgress: (enviado, total) => setEnvio(x => x ? { ...x, pct: total ? Math.round((enviado / total) * 100) : 0 } : x),
          onSuccess: () => resolve(),
        }).start();
      });
      const { error } = await supabase.from("stories").insert({ user_id: uid, tipo: "video", video_id: d.videoId, produto_id: prod || null, duracao: Math.min(seg || 15, STORY_MAX_SEGUNDOS + 1), pronto: false, expira_em });
      if (error) { await api({ acao: "apagar", videoId: d.videoId }).catch(() => null); return falhou(); }
      criado = "";
      fim(); void carregar();
    } catch {
      if (criado) void api({ acao: "apagar", videoId: criado }).catch(() => null);
      falhou();
    }
  };

  const carregar = useCallback(async () => {
    if (!uid) return;
    const { data, error } = await supabase.from("stories").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (error) { setCarregando(false); return; }
    const todos = (data || []) as Story[];
    const agora = Date.now();
    const vencidos = todos.filter(s => new Date(s.expira_em || 0).getTime() <= agora);
    setLista(todos.filter(s => !vencidos.includes(s)));
    setCarregando(false);
    // faxina: o que venceu sai do Bunny (para de ocupar espaço) e da lista
    for (const s of vencidos) {
      if (s.tipo === "video" && s.video_id) await api({ acao: "apagar", videoId: s.video_id }).catch(() => null);
      await supabase.from("stories").delete().eq("id", s.id).eq("user_id", uid);
    }
  }, [uid]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    if (!uid) return;
    void supabase.from("produtos").select("id, nome").eq("user_id", uid).eq("disponivel", true).order("nome").then(({ data }) => setProdutos((data || []) as Prod[]));
  }, [uid]);

  // vídeo ainda convertendo: pergunta ao Bunny logo em seguida e depois de 2 em 2 segundos, até ficar pronto
  useEffect(() => {
    for (const s of lista) {
      if (s.tipo !== "video" || s.pronto || !s.video_id || conferindo.current.has(s.id)) continue;
      conferindo.current.add(s.id);
      let n = 0;
      let ocupado = false;
      const conferir = async () => {
        if (ocupado) return; // a resposta anterior ainda não chegou
        ocupado = true;
        try { await passo(); } finally { ocupado = false; }
      };
      const passo = async () => {
        n++;
        const { ok, sumiu, d } = await api({ acao: "status", videoId: s.video_id }).catch(() => ({ ok: false, sumiu: false, d: {} as Record<string, any> }));
        // story apagado aqui, ou vídeo que não existe mais no Bunny: para de perguntar
        if (!conferindo.current.has(s.id) || sumiu) {
          window.clearInterval(t);
          if (sumiu && conferindo.current.has(s.id)) avisar("Vídeo não ficou pronto, envie de novo", { tipo: "erro" });
          return;
        }
        if (ok && d.pronto) {
          window.clearInterval(t);
          await supabase.from("stories").update({ pronto: true, ...(d.duracao ? { duracao: Math.min(Number(d.duracao), STORY_MAX_SEGUNDOS + 1) } : {}) }).eq("id", s.id).eq("user_id", uid);
          setLista(l => l.map(x => x.id === s.id ? { ...x, pronto: true } : x));
          avisar("Seu story está no cardápio", { tipo: "ok" });
        } else if (ok && !d.falhou && Number(d.progresso) > 0) {
          setLista(l => l.map(x => x.id === s.id ? { ...x, progresso: Number(d.progresso) } as Story : x));
        } else if ((ok && d.falhou) || n > 450) {
          window.clearInterval(t);
          if (ok && d.falhou) avisar("Vídeo não ficou pronto, envie de novo", { tipo: "erro" });
        }
      };
      const t = window.setInterval(() => void conferir(), 2000);
      window.setTimeout(() => void conferir(), 600);
    }
  }, [lista, uid]);

  const confirmarApagar = async () => {
    const s = apagar; if (!s) return;
    setApagar(null);
    if (s.tipo === "video" && s.video_id) await api({ acao: "apagar", videoId: s.video_id }).catch(() => null);
    const { error } = await supabase.from("stories").delete().eq("id", s.id).eq("user_id", uid);
    if (error) { avisar("Não deu para apagar, tente de novo", { tipo: "erro" }); return; }
    conferindo.current.delete(s.id);
    setLista(l => l.filter(x => x.id !== s.id));
  };

  const nomeProd = (id: string | null) => (id ? produtos.find(p => p.id === id)?.nome : null) || null;
  // o visualizador mostra do mais antigo para o mais novo, como no cardápio
  const prontos = lista.filter(s => s.pronto).slice().reverse();
  const cheio = lista.length + (envio ? 1 : 0) >= STORY_MAX_ATIVOS;
  const proximoASair = prontos.map(s => s.expira_em || "").filter(Boolean).sort()[0] || "";

  return (
    <>
      <AppPageHeader title="Stories" voltar="/cardapio" subtitle="Vídeos curtos e fotos no topo do seu cardápio"
        infoContent={<><p>Poste um vídeo de até {tempoStory(STORY_MAX_SEGUNDOS)} ou uma foto. A logo do seu cardápio ganha um aro colorido e a cliente toca para assistir.</p><p>Cada story fica no ar de 1 a 3 dias e depois some sozinho. Dá para ter até {STORY_MAX_ATIVOS} no ar ao mesmo tempo.</p></>} />
      <div className="sto">
        {!isPro && !carregandoPlano ? <CartaoPro recurso="stories" /> : (
          <>
            {!carregando && lista.length === 0 && !envio && (
              <div className="sto-vazio">
                <img src="/marca/leve/acenando.webp" alt="" aria-hidden="true" width={150} height={175} />
                <span className="sto-eb">Vamos começar</span>
                <h1>Poste seu<br />primeiro story</h1>
                <p>Mostre o bolo do dia, uma promoção ou os bastidores. A cliente vê ao tocar na logo do cardápio.</p>
              </div>
            )}
            {(lista.length > 0 || envio) && (
              <>
                <div className="sto-topo">
                  <span>No ar agora</span><small>{lista.length} de {STORY_MAX_ATIVOS}</small>
                  {/* computador: o botão de postar fica no canto, do tamanho do texto (no celular a vaga vazia já é o botão) */}
                  <span className="sto-topo-bt"><Botao icone={<Plus size={18} weight="bold" />} disabled={cheio} onClick={() => setPostar(true)}>Postar story</Botao></span>
                </div>
                <div className="sto-cols">
                <div className="sto-grade">
                  {lista.map((s, i) => {
                    const pct = (s as Story & { progresso?: number }).progresso || 0;
                    const iPronto = prontos.findIndex(x => x.id === s.id);
                    return (
                      <div className="sto-vaga" key={s.id}>
                        <button type="button" className="sto-capa" disabled={!s.pronto} aria-label={`Ver o story ${i + 1} como a cliente vê`} onClick={() => setVer(Math.max(0, iPronto))}>
                          {s.tipo === "video" ? (s.pronto && s.video_id ? <CapaVideo src={urlCapaStory(s.video_id)} /> : <Play size={24} weight="fill" />) : (s.foto_url ? <img src={s.foto_url} alt="" /> : <ImageIc size={24} weight="bold" />)}
                          {s.pronto
                            ? <span className="sto-vw"><Eye size={14} weight="bold" aria-hidden="true" />{s.views || 0}</span>
                            : <span className="sto-sobre"><i className="sto-gira" aria-hidden="true" /><b>Processando…</b>{pct > 0 && <em>{pct}%</em>}</span>}
                        </button>
                        <button type="button" className="sto-del" aria-label="Apagar este story" onClick={() => setApagar(s)}><Trash size={16} weight="bold" /></button>
                        <small>{s.pronto ? saiCurto(s.expira_em || "") : "Quase lá"}</small>
                      </div>
                    );
                  })}
                  {envio && (
                    <div className="sto-vaga">
                      <div className="sto-capa">
                        {envio.previa ? <img src={envio.previa} alt="" /> : <Play size={24} weight="fill" />}
                        {envio.fase === "falhou" ? (
                          <span className="sto-sobre sto-sobre--falhou">
                            <b>Não enviado</b>
                            <button type="button" onClick={() => void enviar(envio.arq, envio.seg, envio.dias, envio.prod, envio.inicio)}>Tentar de novo</button>
                          </span>
                        ) : (
                          <span className="sto-sobre" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={envio.pct}>
                            <i className="sto-gira" aria-hidden="true" />
                            <b>{envio.fase === "preparando" ? "Preparando…" : "Enviando…"}</b>{envio.video && <em>{envio.pct}%</em>}
                          </span>
                        )}
                      </div>
                      {envio.fase === "falhou" && <button type="button" className="sto-del" aria-label="Desistir deste story" onClick={() => { if (envio.previa) URL.revokeObjectURL(envio.previa); setEnvio(null); }}><X size={16} weight="bold" /></button>}
                      <small>{envio.fase === "falhou" ? "Confira a internet" : "Não feche o app"}</small>
                    </div>
                  )}
                  {Array.from({ length: Math.max(0, STORY_MAX_ATIVOS - lista.length - (envio ? 1 : 0)) }, (_, i) => (
                    <div className="sto-vaga" key={`vaga${i}`}>
                      {i === 0 && !envio
                        ? <button type="button" className="sto-capa sto-capa--nova" onClick={() => setPostar(true)}><Plus size={24} weight="bold" aria-hidden="true" /><b>Postar</b></button>
                        : <div className="sto-capa sto-capa--livre" aria-hidden="true" />}
                      <small>&nbsp;</small>
                    </div>
                  ))}
                </div>
                {/* computador: resumo na outra coluna, no topo */}
                <aside className="sto-resumo" aria-label="Resumo dos stories">
                  <b>Resumo</b>
                  <p><span>No ar</span><em>{lista.length} de {STORY_MAX_ATIVOS}</em></p>
                  <p><span>Visualizações</span><em>{lista.reduce((n, x) => n + (x.views || 0), 0)}</em></p>
                  {proximoASair && <p><span>Próximo a sair</span><em>{saiCurto(proximoASair).replace(/^Sai /, "")}</em></p>}
                </aside>
                </div>
              </>
            )}
            {!carregando && lista.length === 0 && !envio && (
              <div className="sto-acao">
                <Botao cheio icone={<Plus size={20} weight="bold" />} onClick={() => setPostar(true)}>Postar story</Botao>
              </div>
            )}
          </>
        )}
      </div>

      {ver !== null && prontos.length > 0 && (
        <Suspense fallback={null}>
          <StoriesViewer stories={prontos} inicio={Math.min(ver, prontos.length - 1)} semContar loja={profile?.nome_loja || "Sua loja"} logo={fotoDaLoja(profile) || null}
            aoFechar={() => setVer(null)} aoVerProduto={() => setVer(null)} produtoDe={id => { const n = nomeProd(id); return n ? { nome: n } : null; }} />
        </Suspense>
      )}

      {postar && <JanelaPostar produtos={produtos} aoFechar={() => setPostar(false)} aoPublicar={(arq, seg, dias, prod, inicio) => { setPostar(false); void enviar(arq, seg, dias, prod, inicio); }} />}

      <Janela aberta={!!apagar} aoFechar={() => setApagar(null)} titulo="Apagar este story?" texto="Ele sai do cardápio na hora."
        acoes={<><Botao variante="secundario" onClick={() => setApagar(null)}>Voltar</Botao><Botao variante="perigo" onClick={() => void confirmarApagar()}>Apagar</Botao></>} />

      <style>{`
        .sto { max-width: 560px; margin: 0 auto; padding-bottom: 24px; }
        .sto-vazio { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 16px 8px 8px; }
        .sto-vazio img { width: 150px; height: auto; margin-bottom: 16px; }
        .sto-eb { font-size: 14px; font-weight: 600; color: #B02C5F; line-height: 1; }
        .sto-vazio h1 { margin: 6px 0 0; font-size: 2rem; font-weight: 500; letter-spacing: -.03em; line-height: 1.1; color: var(--ui-texto); }
        .sto-vazio p { margin: 12px 0 0; max-width: 420px; font-size: 16px; line-height: 1.55; color: var(--ui-texto-2); }
        .sto-topo { display: flex; align-items: baseline; justify-content: space-between; margin: 4px 2px 10px; }
        .sto-topo span { font-size: 16px; font-weight: 500; color: var(--ui-texto); }
        .sto-topo small { font-size: 14px; color: var(--ui-texto-2); }
        .sto-topo-bt, .sto-resumo { display: none; }
        /* (19/11) computador: capas no tamanho de celular (as 3 vagas na tela), botão no canto e resumo na outra coluna */
        @media (min-width: 1100px) {
          .sto { max-width: 980px; }
          .sto-topo { align-items: center; justify-content: flex-start; gap: 10px; margin-bottom: 16px; }
          .sto-topo-bt { display: block; margin-left: auto; }
          .sto-cols { display: grid; grid-template-columns: auto minmax(0, 300px); gap: 40px; justify-content: space-between; align-items: start; }
          .sto-cols .sto-grade { grid-template-columns: repeat(3, 180px); gap: 16px; }
          .sto-resumo { display: block; padding: 20px; border: 1px solid var(--ui-borda); border-radius: 16px; background: var(--ui-branco); }
          .sto-resumo b { display: block; margin-bottom: 8px; font-size: 16px; font-weight: 500; color: var(--ui-texto); }
          .sto-resumo p { display: flex; justify-content: space-between; gap: 12px; margin: 0; padding: 10px 0; border-top: 1px solid var(--ui-linha); font-size: 14px; color: var(--ui-texto-2); }
          .sto-resumo p:first-of-type { border-top: 0; }
          .sto-resumo em { font-style: normal; color: var(--ui-texto); white-space: nowrap; }
        }
        .sto-grade { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .sto-vaga { position: relative; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .sto-vaga > small { font-size: 12px; text-align: center; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sto-capa { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; width: 100%; aspect-ratio: 9 / 16; margin: 0; padding: 0; border: 0; border-radius: 14px; overflow: hidden; background: var(--ui-cinza); color: var(--ui-texto-2); font-family: inherit; cursor: pointer; }
        .sto-capa:disabled { cursor: default; }
        .sto-capa > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .sto-capa--nova { border: 1.5px dashed var(--ui-borda); background: var(--ui-branco); color: var(--ui-rosa-botao, #CC2E66); }
        .sto-capa--nova b { font-size: 14px; font-weight: 500; }
        .sto-capa--livre { border: 1.5px dashed var(--ui-linha); background: none; cursor: default; }
        .sto-vw { position: absolute; left: 6px; bottom: 6px; display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; background: rgba(0,0,0,.55); color: #fff; font-size: 12px; }
        .sto-sobre { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 6px; background: rgba(34,19,14,.6); color: #fff; text-align: center; }
        .sto-sobre b { font-size: 12px; font-weight: 500; white-space: nowrap; }
        .sto-sobre em { margin-top: -6px; font-size: 12px; font-style: normal; opacity: .85; }
        .sto-sobre button { min-height: 32px; margin: 0; padding: 0 8px; border: 0; border-radius: 999px; background: #fff; color: #22130E; font-family: inherit; font-size: 12px; font-weight: 500; white-space: nowrap; cursor: pointer; }
        .sto-del { position: absolute; top: 6px; right: 6px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; margin: 0; padding: 0; border: 0; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff; cursor: pointer; }
        .sto-acao { margin-top: 16px; }
        .sto-up { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 96px; margin: 0; padding: 12px; border: 1.5px dashed var(--ui-borda); border-radius: 12px; background: var(--ui-branco); font-family: inherit; font-size: 15px; color: var(--ui-texto-2); cursor: pointer; }
        .sto-up b { max-width: 100%; font-weight: 500; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sto-esc { display: flex; gap: 10px; }
        .sto-esc .sto-up { flex: 1; min-width: 0; }
        .sto-up b { white-space: nowrap; }
        .sto-arq { margin: 8px 0 0; font-size: 13px; text-align: center; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sto-corte { margin-top: 12px; }
        .sto-corte video { display: block; width: 100%; max-height: 220px; border-radius: 12px; background: #000; object-fit: contain; }
        .sto-corte input[type=range] { width: 100%; margin: 0; accent-color: var(--ui-rosa-botao, #CC2E66); }
        .sto-corte small { display: block; margin-top: 4px; font-size: 13px; text-align: center; color: var(--ui-texto-2); white-space: nowrap; }
        .sto-lbl { margin: 16px 0 6px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .sto-sel { width: 100%; min-height: 48px; padding: 0 12px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); font-family: inherit; font-size: 15px; color: var(--ui-texto); }
        .sto-gira { width: 24px; height: 24px; border: 3px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: sto-gira .8s linear infinite; }
        @keyframes sto-gira { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

/** capa do vídeo; enquanto o Bunny ainda não gerou a imagem, mostra o ícone de vídeo e tenta de novo */
function CapaVideo({ src }: { src: string }) {
  const [tentativa, setTentativa] = useState(0);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (!falhou || tentativa >= 6) return;
    const t = window.setTimeout(() => { setFalhou(false); setTentativa(n => n + 1); }, 5000);
    return () => window.clearTimeout(t);
  }, [falhou, tentativa]);
  if (falhou) return <Play size={24} weight="fill" />;
  return <img src={tentativa ? `${src}?t=${tentativa}` : src} alt="" onError={() => setFalhou(true)} />;
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** vídeo maior que o limite: a confeiteira arrasta a barra e escolhe qual trecho vai ao ar (a prévia toca só ele) */
function CorteVideo({ url, duracao, inicio, aoMudar }: { url: string; duracao: number; inicio: number; aoMudar: (n: number) => void }) {
  const v = useRef<HTMLVideoElement>(null);
  const fim = inicio + STORY_MAX_SEGUNDOS;
  useEffect(() => { const el = v.current; if (el) { el.currentTime = inicio; el.play().catch(() => {}); } }, [inicio]);
  return (
    <div className="sto-corte">
      <video ref={v} src={url} muted playsInline onTimeUpdate={e => { const el = e.currentTarget; if (el.currentTime >= fim || el.currentTime < inicio - 0.5) el.currentTime = inicio; }} />
      <p className="sto-lbl">Escolha o trecho de {tempoStory(STORY_MAX_SEGUNDOS)}</p>
      <input type="range" min={0} max={Math.max(0, Math.floor(duracao - STORY_MAX_SEGUNDOS))} step={1} value={inicio} onChange={e => aoMudar(Number(e.target.value))} aria-label="Onde o trecho começa" />
      <small>De {mmss(inicio)} até {mmss(fim)} · o vídeo tem {mmss(duracao)}</small>
    </div>
  );
}

function JanelaPostar({ produtos, aoFechar, aoPublicar }: { produtos: Prod[]; aoFechar: () => void; aoPublicar: (arq: File, seg: number, dias: number, prod: string, inicio?: number) => void }) {
  const [arq, setArq] = useState<File | null>(null);
  const [seg, setSeg] = useState(0);
  const [inicio, setInicio] = useState(0);
  const [urlVideo, setUrlVideo] = useState("");
  const [dias, setDias] = useState<"1" | "2" | "3">("1");
  const [prod, setProd] = useState("");
  const galeria = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const ehVideo = !!arq && arq.type.startsWith("video/");
  const longo = ehVideo && seg > STORY_MAX_SEGUNDOS + 1;
  // "Gravar agora" abre a câmera do celular; no computador esse recurso não existe, então o botão não aparece
  const temCamera = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  useEffect(() => () => { if (urlVideo) URL.revokeObjectURL(urlVideo); }, [urlVideo]);

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    if (f.type.startsWith("video/")) {
      if (f.size > MAX_VIDEO_MB * 1024 * 1024) { avisar("Vídeo pesado demais, escolha outro", { tipo: "erro" }); return; }
      const d = await duracaoDoVideo(f);
      setInicio(0); setSeg(d); setArq(f);
      setUrlVideo(d > STORY_MAX_SEGUNDOS + 1 ? URL.createObjectURL(f) : ""); // passou do limite: abre o corte em vez de recusar
    } else if (f.type.startsWith("image/")) { setUrlVideo(""); setSeg(STORY_SEGUNDOS_FOTO); setArq(f); }
    else avisar("Escolha um vídeo ou uma foto", { tipo: "erro" });
  };
  const publicar = () => { if (arq) aoPublicar(arq, longo ? STORY_MAX_SEGUNDOS : seg, Number(dias), prod, longo ? inicio : undefined); };

  return (
    <Janela aberta aoFechar={aoFechar} titulo="Postar story" tipo="conteudo"
      acoes={<><Botao variante="secundario" onClick={aoFechar}>Voltar</Botao><Botao disabled={!arq} onClick={publicar}>Publicar</Botao></>}>
      <input ref={galeria} type="file" accept="video/*,image/*" hidden onChange={e => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camera} type="file" accept="video/*" capture="environment" hidden onChange={e => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="sto-esc">
        {temCamera && <button type="button" className="sto-up" onClick={() => camera.current?.click()}><VideoCamera size={24} weight="bold" aria-hidden="true" /><b>Gravar agora</b></button>}
        <button type="button" className="sto-up" onClick={() => galeria.current?.click()}><Images size={24} weight="bold" aria-hidden="true" /><b>{temCamera ? "Galeria" : "Escolher vídeo ou foto"}</b></button>
      </div>
      <p className="sto-arq">{arq ? `${ehVideo ? (longo ? "Vídeo longo, escolha o trecho" : `Vídeo de ${tempoStory(seg)}`) : "Foto"} · pronto para publicar` : `Vídeo de até ${tempoStory(STORY_MAX_SEGUNDOS)} ou foto`}</p>
      {longo && urlVideo && <CorteVideo url={urlVideo} duracao={seg} inicio={inicio} aoMudar={setInicio} />}
      <p className="sto-lbl">Fica no ar por</p>
      <CaixasEscolha<"1" | "2" | "3"> rotulo="Por quanto tempo fica no ar" valor={dias} onMudar={setDias} opcoes={[
        { v: "1", t: "1 dia", sub: "Bom para o bolo do dia" },
        { v: "2", t: "2 dias", sub: "Para o fim de semana" },
        { v: "3", t: "3 dias", sub: "Para uma promoção" },
      ]} />
      <p className="sto-lbl">Produto do botão (opcional)</p>
      <select className="sto-sel" value={prod} onChange={e => setProd(e.target.value)} aria-label="Produto que o botão do story abre">
        <option value="">Sem botão</option>
        {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </Janela>
  );
}
