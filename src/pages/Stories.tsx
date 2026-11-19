// ── Stories.tsx ──────────────────────────────────────────────────────────────
// (19/11) Stories do cardápio: a confeiteira posta um vídeo curto (até 30 s) ou uma foto, escolhe por
// quantos dias fica no ar (1 a 3) e, se quiser, o produto que o botão do story abre. Recurso do PRO.
// O vídeo vai do celular direto para o Bunny Stream (envio em partes, retoma se a internet cair).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { Eye, Image as ImageIc, Play, Plus, Trash, UploadSimple } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, CaixasEscolha, Janela, avisar } from "@/components/base";
import { CartaoPro } from "@/components/billing/RecursoPro";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { type Story, STORY_MAX_ATIVOS, STORY_MAX_SEGUNDOS, STORY_SEGUNDOS_FOTO, saiDoAr, urlCapaStory } from "@/lib/stories";

type Prod = { id: string; nome: string };
const MAX_VIDEO_MB = 150;

const api = async (corpo: Record<string, unknown>) => {
  const r = await apiFetch("/api/story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, d: d as Record<string, any> };
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
  const [envio, setEnvio] = useState<{ nome: string; previa: string; video: boolean; pct: number } | null>(null);

  const enviar = async (arq: File, seg: number, dias: number, prod: string) => {
    if (!uid || envio) return;
    const video = arq.type.startsWith("video/");
    const previa = video ? "" : URL.createObjectURL(arq);
    setEnvio({ nome: (prod && produtos.find(p => p.id === prod)?.nome) || (video ? "Vídeo" : "Foto"), previa, video, pct: 0 });
    const expira_em = new Date(Date.now() + dias * 86400000).toISOString();
    const fim = (msg?: string) => { if (previa) URL.revokeObjectURL(previa); setEnvio(null); if (msg) avisar(msg, { tipo: "erro" }); };
    try {
      if (!video) {
        const blob = await reduzirFoto(arq);
        if (!blob) return fim("Não deu para ler essa foto. Tente outra.");
        const caminho = `${uid}/stories/${Date.now()}.jpg`;
        const up = await supabase.storage.from("products").upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) return fim("Não deu para enviar a foto. Confira a internet e tente de novo.");
        const foto_url = supabase.storage.from("products").getPublicUrl(caminho).data.publicUrl;
        const { error } = await supabase.from("stories").insert({ user_id: uid, tipo: "foto", foto_url, produto_id: prod || null, duracao: STORY_SEGUNDOS_FOTO, pronto: true, expira_em });
        if (error) return fim("Não deu para publicar. Tente de novo.");
        fim(); avisar("Story publicado", { tipo: "ok" }); void carregar(); return;
      }
      const { ok, d } = await api({ acao: "criar" });
      if (!ok) return fim(d.message || "Não deu para preparar o envio. Tente de novo.");
      await new Promise<void>((resolve, reject) => {
        new tus.Upload(arq, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: { AuthorizationSignature: d.assinatura, AuthorizationExpire: String(d.expira), VideoId: d.videoId, LibraryId: String(d.libraryId) },
          metadata: { filetype: arq.type, title: `story-${uid}-${Date.now()}` }, // o título começa com o id da conta: é como o servidor sabe de quem é o vídeo
          onError: e => reject(e),
          onProgress: (enviado, total) => setEnvio(x => x ? { ...x, pct: total ? Math.round((enviado / total) * 100) : 0 } : x),
          onSuccess: () => resolve(),
        }).start();
      });
      const { error } = await supabase.from("stories").insert({ user_id: uid, tipo: "video", video_id: d.videoId, produto_id: prod || null, duracao: Math.min(seg || 15, STORY_MAX_SEGUNDOS + 1), pronto: false, expira_em });
      if (error) { await api({ acao: "apagar", videoId: d.videoId }).catch(() => null); return fim("Não deu para publicar. Tente de novo."); }
      fim(); void carregar();
    } catch {
      fim("O envio parou. Confira a internet e tente de novo.");
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

  // vídeo ainda convertendo: pergunta ao Bunny de 5 em 5 segundos até ficar pronto
  useEffect(() => {
    for (const s of lista) {
      if (s.tipo !== "video" || s.pronto || !s.video_id || conferindo.current.has(s.id)) continue;
      conferindo.current.add(s.id);
      let n = 0;
      const t = window.setInterval(async () => {
        n++;
        const { ok, d } = await api({ acao: "status", videoId: s.video_id }).catch(() => ({ ok: false, d: {} as Record<string, any> }));
        if (ok && d.pronto) {
          window.clearInterval(t);
          await supabase.from("stories").update({ pronto: true, ...(d.duracao ? { duracao: Math.min(Number(d.duracao), STORY_MAX_SEGUNDOS + 1) } : {}) }).eq("id", s.id).eq("user_id", uid);
          setLista(l => l.map(x => x.id === s.id ? { ...x, pronto: true } : x));
          avisar("Seu story já está no cardápio", { tipo: "ok" });
        } else if (ok && !d.falhou && Number(d.progresso) > 0) {
          setLista(l => l.map(x => x.id === s.id ? { ...x, progresso: Number(d.progresso) } as Story : x));
        } else if ((ok && d.falhou) || n > 180) {
          window.clearInterval(t);
          if (ok && d.falhou) avisar("Não deu para converter esse vídeo. Apague e envie de novo.", { tipo: "erro" });
        }
      }, 5000);
    }
  }, [lista, uid]);

  const confirmarApagar = async () => {
    const s = apagar; if (!s) return;
    setApagar(null);
    if (s.tipo === "video" && s.video_id) await api({ acao: "apagar", videoId: s.video_id }).catch(() => null);
    const { error } = await supabase.from("stories").delete().eq("id", s.id).eq("user_id", uid);
    if (error) { avisar("Não deu para apagar. Tente de novo.", { tipo: "erro" }); return; }
    setLista(l => l.filter(x => x.id !== s.id));
  };

  const nomeProd = (id: string | null) => (id ? produtos.find(p => p.id === id)?.nome : null) || null;
  const cheio = lista.length >= STORY_MAX_ATIVOS;

  return (
    <>
      <AppPageHeader title="Stories" voltar="/cardapio" subtitle="Vídeos curtos e fotos no topo do seu cardápio"
        infoContent={<><p>Poste um vídeo de até {STORY_MAX_SEGUNDOS} segundos ou uma foto. A logo do seu cardápio ganha um aro colorido e a cliente toca para assistir.</p><p>Cada story fica no ar de 1 a 3 dias e depois some sozinho. Dá para ter até {STORY_MAX_ATIVOS} no ar ao mesmo tempo.</p></>} />
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
              <ul className="sto-lista">
                {envio && (
                  <li>
                    <span className="sto-ft sto-ft--env">{envio.previa ? <img src={envio.previa} alt="" /> : <Play size={22} weight="fill" />}<i className="sto-gira" aria-hidden="true" /></span>
                    <span className="sto-tx">
                      <b>{envio.nome}</b>
                      <small>{envio.video ? `Enviando… ${envio.pct}%` : "Enviando…"}</small>
                      <span className="sto-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={envio.pct}><i style={{ width: `${envio.video ? envio.pct : 60}%` }} /></span>
                    </span>
                  </li>
                )}
                {lista.map(s => (
                  <li key={s.id}>
                    <span className={`sto-ft${s.pronto ? "" : " sto-ft--env"}`}>
                      {s.tipo === "video" ? (s.pronto && s.video_id ? <img src={urlCapaStory(s.video_id)} alt="" /> : <><Play size={22} weight="fill" /><i className="sto-gira" aria-hidden="true" /></>) : (s.foto_url ? <img src={s.foto_url} alt="" /> : <ImageIc size={22} weight="bold" />)}
                    </span>
                    <span className="sto-tx">
                      <b>{nomeProd(s.produto_id) || (s.tipo === "video" ? "Vídeo" : "Foto")}</b>
                      <small>{s.pronto ? saiDoAr(s.expira_em || "") : `Preparando em alta qualidade… ${(s as Story & { progresso?: number }).progresso ? `${(s as Story & { progresso?: number }).progresso}%` : ""}`}</small>
                      {!s.pronto && <span className="sto-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={(s as Story & { progresso?: number }).progresso || 0}><i style={{ width: `${Math.max(8, (s as Story & { progresso?: number }).progresso || 0)}%` }} /></span>}
                      <small className="sto-vw"><Eye size={14} weight="bold" aria-hidden="true" />{s.views === 1 ? "1 pessoa viu" : `${s.views || 0} pessoas viram`}</small>
                    </span>
                    <button type="button" className="sto-del" aria-label="Apagar este story" onClick={() => setApagar(s)}><Trash size={20} weight="bold" /></button>
                  </li>
                ))}
              </ul>
            )}
            {!carregando && (
              <div className="sto-acao">
                <Botao cheio icone={<Plus size={20} weight="bold" />} disabled={cheio || !!envio} onClick={() => setPostar(true)}>Postar story</Botao>
                {cheio && <p className="sto-dica">Você já tem {STORY_MAX_ATIVOS} stories no ar. Apague um para postar outro.</p>}
              </div>
            )}
          </>
        )}
      </div>

      {postar && <JanelaPostar produtos={produtos} aoFechar={() => setPostar(false)} aoPublicar={(arq, seg, dias, prod) => { setPostar(false); void enviar(arq, seg, dias, prod); }} />}

      <Janela aberta={!!apagar} aoFechar={() => setApagar(null)} titulo="Apagar este story?" texto="Ele sai do cardápio na hora."
        acoes={<><Botao variante="secundario" onClick={() => setApagar(null)}>Voltar</Botao><Botao variante="perigo" onClick={() => void confirmarApagar()}>Apagar</Botao></>} />

      <style>{`
        .sto { max-width: 560px; margin: 0 auto; padding-bottom: 24px; }
        .sto-vazio { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 16px 8px 8px; }
        .sto-vazio img { width: 150px; height: auto; margin-bottom: 16px; }
        .sto-eb { font-size: 14px; font-weight: 600; color: #B02C5F; line-height: 1; }
        .sto-vazio h1 { margin: 6px 0 0; font-size: 2rem; font-weight: 500; letter-spacing: -.03em; line-height: 1.1; color: var(--ui-texto); }
        .sto-vazio p { margin: 12px 0 0; max-width: 420px; font-size: 16px; line-height: 1.55; color: var(--ui-texto-2); }
        .sto-lista { list-style: none; margin: 0; padding: 0; border: 1px solid var(--ui-borda); border-radius: 16px; background: var(--ui-branco); overflow: hidden; }
        .sto-lista li { display: flex; align-items: center; gap: 12px; padding: 12px; border-top: 1px solid var(--ui-linha); }
        .sto-lista li:first-child { border-top: 0; }
        .sto-ft { flex: none; display: flex; align-items: center; justify-content: center; width: 48px; height: 64px; border-radius: 10px; overflow: hidden; background: var(--ui-cinza); color: var(--ui-texto-2); }
        .sto-ft img { width: 100%; height: 100%; object-fit: cover; }
        .sto-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .sto-tx b { font-size: 15px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sto-tx small { font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sto-vw { display: flex; align-items: center; gap: 4px; }
        .sto-del { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin: 0; padding: 0; border: 0; border-radius: 12px; background: none; color: var(--ui-texto-2); cursor: pointer; }
        .sto-acao { margin-top: 16px; }
        .sto-dica { margin: 8px 0 0; font-size: 13px; text-align: center; color: var(--ui-texto-2); }
        .sto-up { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 96px; margin: 0; padding: 12px; border: 1.5px dashed var(--ui-borda); border-radius: 12px; background: var(--ui-branco); font-family: inherit; font-size: 15px; color: var(--ui-texto-2); cursor: pointer; }
        .sto-up b { max-width: 100%; font-weight: 500; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sto-lbl { margin: 16px 0 6px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .sto-sel { width: 100%; min-height: 48px; padding: 0 12px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); font-family: inherit; font-size: 15px; color: var(--ui-texto); }
        .sto-barra { display: block; height: 4px; margin-top: 4px; border-radius: 2px; background: var(--ui-cinza); overflow: hidden; }
        .sto-ft--env { position: relative; }
        .sto-ft--env img { opacity: .5; }
        .sto-gira { position: absolute; width: 26px; height: 26px; border: 3px solid rgba(0,0,0,.12); border-top-color: var(--ui-rosa-botao, #CC2E66); border-radius: 50%; animation: sto-gira .8s linear infinite; }
        @keyframes sto-gira { to { transform: rotate(360deg); } }
        .sto-barra i { display: block; height: 100%; background: var(--ui-rosa-botao, #CC2E66); transition: width .2s; }
        .sto-pct { margin: 6px 0 0; font-size: 13px; text-align: center; color: var(--ui-texto-2); }
      `}</style>
    </>
  );
}

function JanelaPostar({ produtos, aoFechar, aoPublicar }: { produtos: Prod[]; aoFechar: () => void; aoPublicar: (arq: File, seg: number, dias: number, prod: string) => void }) {
  const [arq, setArq] = useState<File | null>(null);
  const [seg, setSeg] = useState(0);
  const [dias, setDias] = useState<"1" | "2" | "3">("1");
  const [prod, setProd] = useState("");
  const enviando = false;
  const campo = useRef<HTMLInputElement>(null);
  const ehVideo = !!arq && arq.type.startsWith("video/");

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    if (f.type.startsWith("video/")) {
      if (f.size > MAX_VIDEO_MB * 1024 * 1024) { avisar(`O vídeo passa de ${MAX_VIDEO_MB} MB. Escolha um menor.`, { tipo: "erro" }); return; }
      const d = await duracaoDoVideo(f);
      if (d > STORY_MAX_SEGUNDOS + 1) { avisar(`O vídeo tem ${Math.round(d)} segundos. O limite é ${STORY_MAX_SEGUNDOS}.`, { tipo: "erro" }); return; }
      setSeg(d); setArq(f);
    } else if (f.type.startsWith("image/")) { setSeg(STORY_SEGUNDOS_FOTO); setArq(f); }
    else avisar("Escolha um vídeo ou uma foto.", { tipo: "erro" });
  };
  const publicar = async () => { if (arq) aoPublicar(arq, seg, Number(dias), prod); };

  return (
    <Janela aberta aoFechar={aoFechar} titulo="Postar story" tipo="conteudo" travada={enviando}
      acoes={<><Botao variante="secundario" onClick={aoFechar} disabled={enviando}>Voltar</Botao><Botao carregando={enviando} disabled={!arq} onClick={() => void publicar()}>Publicar</Botao></>}>
      <input ref={campo} type="file" accept="video/*,image/*" hidden onChange={e => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
      <button type="button" className="sto-up" disabled={enviando} onClick={() => campo.current?.click()}>
        <UploadSimple size={24} weight="bold" aria-hidden="true" />
        {arq ? <b>{arq.name}</b> : <span>Escolher vídeo ou foto</span>}
        <small>{arq ? (ehVideo ? `${Math.round(seg)} segundos` : "Foto") : `Vídeo de até ${STORY_MAX_SEGUNDOS} segundos`}</small>
      </button>
      <p className="sto-lbl">Fica no ar por</p>
      <CaixasEscolha<"1" | "2" | "3"> rotulo="Por quanto tempo fica no ar" valor={dias} onMudar={setDias} opcoes={[
        { v: "1", t: "1 dia", sub: "Bom para o bolo do dia" },
        { v: "2", t: "2 dias", sub: "Para o fim de semana" },
        { v: "3", t: "3 dias", sub: "Para uma promoção" },
      ]} />
      <p className="sto-lbl">Produto do botão (opcional)</p>
      <select className="sto-sel" value={prod} onChange={e => setProd(e.target.value)} disabled={enviando} aria-label="Produto que o botão do story abre">
        <option value="">Sem botão</option>
        {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </Janela>
  );
}
