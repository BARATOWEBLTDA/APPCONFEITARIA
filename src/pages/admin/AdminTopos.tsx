import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registrar } from "@/lib/adminPerfil";
import { Cake, Crop, FileZip, Sparkle, Image as ImageIcon, PencilSimple, Plus, Trash, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { Botao, BotaoIcone, Campo, Janela, Titulo, avisar, confirmar, BotaoTirar } from "@/components/base";
import { paraWebp } from "@/lib/imagemLeve";
import { ImageCropper } from "@/components/ui/ImageCropper";
import {
  ACEITA_ARQUIVOS, ACEITA_IMAGEM, BUCKET_ARQUIVOS, BUCKET_CAPAS, carregarCategorias, carregarTopos, ehImagem, formatoDe, nomeSeguro, tamanhoTexto,
  type ArquivoTopo, type CategoriaTopo, type Topo,
} from "@/lib/toposBolo";
import ImportarTopos, { gerarTags } from "./ImportarTopos";
import "./admin-topos.css";

/**
 * (09/11) Admin · Topos de bolo. Categorias com imagem (cria na hora, no próprio formulário do topo) e topos com
 * capa + vários arquivos (PNG, JPG, PDF, Studio). Sem capa, a primeira imagem enviada vira a capa.
 * As capas vão pro bucket público topos-capas (em WebP); os arquivos, pro privado topos-arquivos (só PRO baixa).
 */
const sufixo = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** sobe uma imagem em WebP (larguraMax px); devolve o endereço público */
async function subirWebp(f: Blob, pasta: string, larguraMax: number, qualidade: number, fim = ""): Promise<string | null> {
  let corpo: Blob = f, ext = "png", tipo = f.type || "image/png";
  try { corpo = await paraWebp(f, larguraMax, qualidade); ext = "webp"; tipo = "image/webp"; } catch { /* sem WebP: vai o original */ }
  const caminho = `${pasta}/${sufixo()}${fim}.${ext}`;
  const up = await supabase.storage.from(BUCKET_CAPAS).upload(caminho, corpo, { cacheControl: "31536000", upsert: false, contentType: tipo });
  if (up.error) return null;
  return supabase.storage.from(BUCKET_CAPAS).getPublicUrl(caminho).data.publicUrl;
}
/** (09/11) capa em 2 tamanhos: a grande (1400 px, só no topo aberto) e a miniatura leve (480 px, grade e bolinhas) */
async function subirCapa(f: Blob, pasta: string): Promise<{ url: string; mini: string | null } | null> {
  const [url, mini] = await Promise.all([subirWebp(f, pasta, 1400, 0.84), subirWebp(f, pasta, 480, 0.78, "-mini")]);
  return url ? { url, mini } : null;
}
/** gera a miniatura de uma capa que já está no ar (topos e categorias antigos) */
async function miniDe(urlCapa: string, pasta: string): Promise<string | null> {
  try { const r = await fetch(urlCapa); if (!r.ok) return null; return await subirWebp(await r.blob(), pasta, 480, 0.78, "-mini"); } catch { return null; }
}

type Form = { id?: string; titulo: string; categoria_id: string; capa: File | null; capaUrl: string | null; novos: File[]; arquivos: ArquivoTopo[]; tags: string[]; canva: string };
const FORM_VAZIO: Form = { titulo: "", categoria_id: "", capa: null, capaUrl: null, novos: [], arquivos: [], tags: [], canva: "" };

export default function AdminTopos() {
  const [cats, setCats] = useState<CategoriaTopo[]>([]);
  const [topos, setTopos] = useState<Topo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semTabela, setSemTabela] = useState(false);
  const [filtro, setFiltro] = useState<string>("");
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false); // (10/11) importar vários topos por .zip
  const [novaCat, setNovaCat] = useState<{ id?: string; nome: string; img: File | null; imgUrl: string | null } | null>(null);
  const capaRef = useRef<HTMLInputElement>(null);
  const [tagTxt, setTagTxt] = useState("");
  // (11/11) gerar as tags pela IA também no topo avulso (antes só à mão, vindas do ChatGPT)
  const [gerandoTags, setGerandoTags] = useState(false);
  const gerarTagsDoForm = async () => {
    if (!form) return;
    let fonte: Blob | null = form.capa || form.novos.find(f => ehImagem(f.name)) || null;
    if (!fonte && form.capaUrl) { try { const r = await fetch(form.capaUrl); if (r.ok) fonte = await r.blob(); } catch { /* sem capa */ } }
    if (!fonte) { avisar("Escolha a capa primeiro: a IA olha a imagem.", { tipo: "info" }); return; }
    setGerandoTags(true);
    const t = await gerarTags(fonte, form.titulo.trim(), cats.find(c => c.id === form.categoria_id)?.nome || "");
    setGerandoTags(false);
    if (!t.length) { avisar("Não deu para gerar as tags agora. Tente de novo.", { tipo: "erro" }); return; }
    setForm(f => f && { ...f, tags: [...new Set([...f.tags, ...t])].slice(0, 30) });
  };
  // (09/11) ajustar a miniatura: recorta 3×4 a partir da imagem original do topo (sem perder qualidade a cada ajuste)
  const [recorte, setRecorte] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const abrirAjuste = async () => {
    if (!form) return;
    setPreparando(true);
    try {
      let fonte: Blob | null = form.novos.find(f => ehImagem(f.name)) || null;
      const salva = form.arquivos.find(a => ehImagem(a.nome));
      if (!fonte && salva) { const d = await supabase.storage.from(BUCKET_ARQUIVOS).download(salva.caminho); fonte = d.data || null; }
      if (!fonte && form.capa) fonte = form.capa;
      setRecorte(fonte ? URL.createObjectURL(fonte) : form.capaUrl);
    } finally { setPreparando(false); }
  };
  // separa por vírgula/ponto e vírgula, tira espaços e repetidas, minúsculo
  const addTags = (txt: string) => {
    const novas = txt.split(/[,;]/).map(x => x.trim().toLowerCase()).filter(Boolean);
    setTagTxt("");
    if (novas.length) setForm(f => f && { ...f, tags: [...new Set([...f.tags, ...novas])].slice(0, 30) });
  };
  const arqRef = useRef<HTMLInputElement>(null);
  const catImgRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    try {
      const [c, t] = await Promise.all([carregarCategorias(), carregarTopos()]); setCats(c); setTopos(t); setSemTabela(false);
      // (09/11) topo sem capa que tem imagem salva (ex.: .jfif de antes do suporte): cria a capa sozinho, uma vez
      for (const tp of t.filter(x => !x.capa_url)) {
        const img = tp.arquivos.find(a => ehImagem(a.nome));
        if (!img) continue;
        const d = await supabase.storage.from(BUCKET_ARQUIVOS).download(img.caminho);
        const c2 = d.data ? await subirCapa(d.data, tp.id) : null;
        if (c2 && !(await supabase.from("topos").update({ capa_url: c2.url, capa_mini_url: c2.mini }).eq("id", tp.id)).error) setTopos(l => l.map(x => (x.id === tp.id ? { ...x, capa_url: c2.url, capa_mini_url: c2.mini } : x)));
      }
      // (09/11) capas de antes da miniatura: cria a versão leve uma vez
      for (const tp of t.filter(x => x.capa_url && !x.capa_mini_url)) {
        const mini = await miniDe(tp.capa_url!, tp.id);
        if (mini) await supabase.from("topos").update({ capa_mini_url: mini }).eq("id", tp.id);
      }
      for (const ct of c.filter(x => x.imagem_url && !x.imagem_mini_url)) {
        const mini = await miniDe(ct.imagem_url!, "categorias");
        if (mini) await supabase.from("topos_categorias").update({ imagem_mini_url: mini }).eq("id", ct.id);
      }
    }
    catch { setSemTabela(true); }
    setCarregando(false);
  };
  useEffect(() => { void carregar(); }, []);

  // ── categoria (nova ou editar) ──
  const salvarCategoria = async () => {
    if (!novaCat || !novaCat.nome.trim()) return;
    setSalvando(true);
    let imagem_url = novaCat.imgUrl, imagem_mini_url: string | null | undefined = undefined;
    if (novaCat.img) { const c2 = await subirCapa(novaCat.img, "categorias"); if (!c2) { setSalvando(false); avisar("Não deu para enviar a imagem.", { tipo: "erro" }); return; } imagem_url = c2.url; imagem_mini_url = c2.mini; }
    const dados = { nome: novaCat.nome.trim(), imagem_url, ...(imagem_mini_url !== undefined ? { imagem_mini_url } : {}) };
    const r = novaCat.id
      ? await supabase.from("topos_categorias").update(dados).eq("id", novaCat.id).select("id").single()
      : await supabase.from("topos_categorias").insert({ ...dados, ordem: cats.length + 1 }).select("id").single();
    setSalvando(false);
    if (r.error) { avisar("Não deu para salvar a categoria.", { tipo: "erro" }); return; }
    void registrar(`${novaCat.id ? "editou" : "criou"} a categoria de topos "${dados.nome}"`, { tipo: "topos" });
    // criada de dentro do formulário do topo: já fica escolhida
    if (!novaCat.id && form) setForm(f => f && { ...f, categoria_id: (r.data as { id: string }).id });
    setNovaCat(null);
    void carregar();
  };
  const excluirCategoria = async (c: CategoriaTopo) => {
    const n = topos.filter(t => t.categoria_id === c.id).length;
    const ok = await confirmar({ titulo: `Excluir "${c.nome}"?`, texto: n ? `${n} ${n === 1 ? "topo fica" : "topos ficam"} sem categoria (não aparecem pras confeiteiras até você escolher outra).` : "A categoria está vazia.", rotulo: "Excluir", perigo: true });
    if (!ok) return;
    const { error } = await supabase.from("topos_categorias").delete().eq("id", c.id);
    if (error) { avisar("Não deu para excluir.", { tipo: "erro" }); return; }
    void registrar(`excluiu a categoria de topos "${c.nome}"`, { tipo: "topos" });
    if (filtro === c.id) setFiltro("");
    void carregar();
  };

  // ── topo ──
  const abrirNovo = () => setForm({ ...FORM_VAZIO, categoria_id: filtro || cats[0]?.id || "" });
  const abrirEditar = (t: Topo) => setForm({ id: t.id, titulo: t.titulo, categoria_id: t.categoria_id || "", capa: null, capaUrl: t.capa_url, novos: [], arquivos: t.arquivos, tags: t.tags || [], canva: t.canva_url || "" });

  const salvarTopo = async () => {
    if (!form) return;
    if (!form.categoria_id) { avisar("Escolha ou crie a categoria.", { tipo: "erro" }); return; }
    if (form.canva.trim() && !/^https?:\/\/(www\.)?canva\.(com|link)\//i.test(form.canva.trim())) { avisar("O link do Canva não parece certo.", { tipo: "erro" }); return; }
    if (!form.arquivos.length && !form.novos.length && !form.canva.trim()) { avisar("Adicione pelo menos um arquivo.", { tipo: "erro" }); return; }
    setSalvando(true);
    const id = form.id || crypto.randomUUID();
    const enviados: ArquivoTopo[] = [];
    for (const f of form.novos) {
      const caminho = `${id}/${sufixo()}-${nomeSeguro(f.name)}`;
      const up = await supabase.storage.from(BUCKET_ARQUIVOS).upload(caminho, f, { upsert: false, contentType: f.type || (/\.jfif$/i.test(f.name) ? "image/jpeg" : "application/octet-stream") });
      if (up.error) { setSalvando(false); avisar(`Não deu para enviar ${f.name}${f.size > 50 * 1024 * 1024 ? " (passa de 50 MB)" : ""}.`, { tipo: "erro" }); return; }
      enviados.push({ caminho, nome: f.name, formato: formatoDe(f.name), tamanho: f.size });
    }
    // capa: a escolhida; sem ela, a primeira imagem enviada
    let capa_url = form.capaUrl;
    let fonteCapa: Blob | undefined = form.capa || (!capa_url ? form.novos.find(f => ehImagem(f.name)) : undefined);
    // (09/11) topo sem capa que já tem uma imagem salva (ex.: .jfif enviado antes do suporte): usa ela como capa
    if (!fonteCapa && !capa_url) {
      const img = form.arquivos.find(a => ehImagem(a.nome));
      if (img) { const d = await supabase.storage.from(BUCKET_ARQUIVOS).download(img.caminho); if (d.data) fonteCapa = d.data; }
    }
    let capa_mini_url: string | null | undefined = undefined;
    if (fonteCapa) { const c2 = await subirCapa(fonteCapa, id); if (c2) { capa_url = c2.url; capa_mini_url = c2.mini; } }
    const titulo = form.titulo.trim() || (form.novos[0]?.name || "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 40);
    const dados = { ...(capa_mini_url !== undefined ? { capa_mini_url } : {}), titulo, tags: form.tags, canva_url: form.canva.trim() || null, categoria_id: form.categoria_id, capa_url, arquivos: [...form.arquivos.map(a => ({ ...a, formato: formatoDe(a.nome) })), ...enviados] };
    const { error } = form.id
      ? await supabase.from("topos").update(dados).eq("id", id)
      : await supabase.from("topos").insert({ id, ...dados, ordem: topos.reduce((m, t) => Math.max(m, t.ordem), 0) + 1 });
    setSalvando(false);
    if (error) { avisar("Não deu para salvar o topo.", { tipo: "erro" }); return; }
    void registrar(`${form.id ? "editou" : "adicionou"} o topo de bolo "${titulo}"`, { tipo: "topos", alvo_id: id });
    avisar(form.id ? "Topo salvo" : "Topo adicionado", { tipo: "ok" });
    setForm(null);
    void carregar();
  };

  const tirarArquivo = async (a: ArquivoTopo) => {
    if (!form) return;
    setForm({ ...form, arquivos: form.arquivos.filter(x => x.caminho !== a.caminho) });
    void supabase.storage.from(BUCKET_ARQUIVOS).remove([a.caminho]);
  };

  const ativar = async (t: Topo, ativo: boolean) => {
    setTopos(l => l.map(x => (x.id === t.id ? { ...x, ativo } : x)));
    const { error } = await supabase.from("topos").update({ ativo }).eq("id", t.id);
    if (error) { avisar("Não deu para salvar.", { tipo: "erro" }); void carregar(); }
  };
  const excluirTopo = async (t: Topo) => {
    const ok = await confirmar({ titulo: "Excluir este topo?", texto: "Ele e os arquivos saem pra todas as confeiteiras.", rotulo: "Excluir", perigo: true });
    if (!ok) return;
    const { error } = await supabase.from("topos").delete().eq("id", t.id);
    if (error) { avisar("Não deu para excluir.", { tipo: "erro" }); return; }
    if (t.arquivos.length) void supabase.storage.from(BUCKET_ARQUIVOS).remove(t.arquivos.map(a => a.caminho));
    void registrar(`excluiu o topo de bolo "${t.titulo}"`, { tipo: "topos", alvo_id: t.id });
    setTopos(l => l.filter(x => x.id !== t.id));
  };

  if (carregando) return <div className="atp-carregando"><span className="ui-gira" aria-label="Carregando" /></div>;
  const nomeCat = (id: string | null) => cats.find(c => c.id === id)?.nome || "Sem categoria";
  const visiveis = filtro ? topos.filter(t => t.categoria_id === filtro) : topos;

  return (
    <div className="atp-root">
      <Titulo nivel="tela" apoio="Todas veem as capas; só a PRO baixa os arquivos.">Topos de bolo</Titulo>

      {semTabela ? (
        <p className="atp-aviso"><WarningCircle size={18} weight="bold" aria-hidden="true" /><span>As tabelas ainda não existem. Rode o SQL topos_de_bolo.sql no Supabase.</span></p>
      ) : (
        <>
          <section className="atp-sec">
            <div className="atp-sec-cab"><h2>Categorias</h2><Botao variante="secundario" tamanho="m" icone={<Plus size={16} weight="bold" />} onClick={() => setNovaCat({ nome: "", img: null, imgUrl: null })}>Nova categoria</Botao></div>
            {cats.length === 0 ? <p className="atp-vz">Nenhuma categoria ainda. Crie a primeira (ex.: Halloween, Aniversário, Chá de bebê).</p> : (
              <div className="atp-cats">
                <button type="button" className={`atp-cat${!filtro ? " on" : ""}`} onClick={() => setFiltro("")}><span className="atp-cat-img"><Cake size={20} /></span><span>Todas <small>{topos.length}</small></span></button>
                {cats.map(c => (
                  <div key={c.id} className={`atp-cat${filtro === c.id ? " on" : ""}`}>
                    <button type="button" className="atp-cat-bt" onClick={() => setFiltro(c.id)}>
                      <span className="atp-cat-img">{c.imagem_url ? <img src={c.imagem_url} alt="" /> : <ImageIcon size={20} />}</span>
                      <span>{c.nome} <small>{topos.filter(t => t.categoria_id === c.id).length}</small></span>
                    </button>
                    <BotaoIcone rotulo="Editar categoria" variante="limpo" tamanho="p" onClick={() => setNovaCat({ id: c.id, nome: c.nome, img: null, imgUrl: c.imagem_url })}><PencilSimple size={16} /></BotaoIcone>
                    <BotaoIcone rotulo="Excluir categoria" variante="limpo" tamanho="p" onClick={() => excluirCategoria(c)}><Trash size={16} /></BotaoIcone>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="atp-sec">
            <div className="atp-sec-cab"><h2>{filtro ? nomeCat(filtro) : "Todos os topos"} <small>{visiveis.length}</small></h2><span className="atp-sec-bts"><Botao variante="secundario" tamanho="m" icone={<FileZip size={18} weight="bold" />} onClick={() => setImportando(true)}>Importar .zip</Botao><Botao tamanho="m" icone={<UploadSimple size={18} weight="bold" />} onClick={abrirNovo}>Novo topo</Botao></span></div>
            {visiveis.length === 0 ? <p className="atp-vz">Nenhum topo aqui ainda.</p> : (
              <div className="atp-grade">
                {visiveis.map(t => (
                  <article key={t.id} className={`atp-it${t.ativo ? "" : " off"}`}>
                    <button type="button" className="atp-capa" onClick={() => abrirEditar(t)}>{t.capa_url ? <img src={t.capa_mini_url || t.capa_url} alt="" loading="lazy" /> : <ImageIcon size={28} />}</button>
                    <b>{t.titulo || "Sem título"}</b>
                    <small>{nomeCat(t.categoria_id)}</small>
                    <span className="atp-fmts">{[...new Set(t.arquivos.map(a => a.formato))].map(f => <em key={f}>{f}</em>)}{(t.tags || []).length > 0 && <small className="atp-ntags">{t.tags.length} {t.tags.length === 1 ? "tag" : "tags"}</small>}</span>
                    <div className="atp-acoes">
                      <label><input type="checkbox" checked={t.ativo} onChange={e => ativar(t, e.target.checked)} />Visível</label>
                      <BotaoIcone rotulo="Editar" variante="limpo" tamanho="p" onClick={() => abrirEditar(t)}><PencilSimple size={16} /></BotaoIcone>
                      <BotaoIcone rotulo="Excluir" variante="limpo" tamanho="p" onClick={() => excluirTopo(t)}><Trash size={16} /></BotaoIcone>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {importando && <ImportarTopos aberta={importando} aoFechar={() => setImportando(false)} cats={cats} topos={topos} categoriaInicial={filtro || ""} subirCapa={subirCapa} aoTerminar={() => void carregar()} />}

      {/* novo topo / editar */}
      <Janela aberta={!!form} aoFechar={() => !salvando && setForm(null)} tipo="conteudo" titulo={form?.id ? "Editar topo" : "Novo topo"} className="atp-janela"
        acoes={<><Botao variante="secundario" onClick={() => setForm(null)} disabled={salvando}>Cancelar</Botao><Botao onClick={salvarTopo} carregando={salvando}>Salvar</Botao></>}>
        {form && (
          <div className="atp-form">
            <div className="atp-form-capa">
              <button type="button" className="atp-capa atp-capa--g" onClick={() => capaRef.current?.click()}>
                {form.capa ? <img src={URL.createObjectURL(form.capa)} alt="" /> : form.capaUrl ? <img src={form.capaUrl} alt="" /> : <span><ImageIcon size={28} />Capa<small>Sem capa, usa a 1ª imagem</small></span>}
              </button>
              <input ref={capaRef} type="file" accept={ACEITA_IMAGEM} hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setForm({ ...form, capa: f }); }} />
              {/* (09/11) escolher o pedaço da imagem que aparece na miniatura (ex.: esconder o rodapé com o site) */}
              {(form.capa || form.capaUrl || form.novos.some(f => ehImagem(f.name)) || form.arquivos.some(a => ehImagem(a.nome))) && (
                <button type="button" className="atp-ajustar" onClick={abrirAjuste} disabled={preparando}><Crop size={16} weight="bold" />{preparando ? "Abrindo…" : "Ajustar miniatura"}</button>
              )}
              <button type="button" className="atp-trocar" onClick={() => capaRef.current?.click()}>{form.capa || form.capaUrl ? "Trocar a capa" : "Escolher a capa"}</button>
            </div>
            <div className="atp-form-dados">
              <Campo rotulo="Título" placeholder="Ex.: Festa de Halloween" maxLength={40} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
              {/* (11/11) categoria numa lista (antes uma fila de botões que quebrava no celular) */}
              <label className="ui-campo">
                <span className="ui-campo-r"><span>Categoria</span></span>
                <select className="atp-imp-sel" value={form.categoria_id} onChange={e => { if (e.target.value === "__nova") setNovaCat({ nome: "", img: null, imgUrl: null }); else setForm({ ...form, categoria_id: e.target.value }); }}>
                  <option value="">Escolha…</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  <option value="__nova">+ Nova categoria…</option>
                </select>
              </label>
              <div className="ui-campo">
                <span className="ui-campo-r"><span>Arquivos para baixar</span></span>
                <div className="atp-arqs">
                  {form.arquivos.map(a => (
                    <div key={a.caminho} className="atp-arq"><em>{a.formato}</em><span>{a.nome}</span><small>{tamanhoTexto(a.tamanho)}</small>
                      <BotaoTirar onClick={() => tirarArquivo(a)} /></div>
                  ))}
                  {form.novos.map((f, i) => (
                    <div key={`n${i}`} className="atp-arq novo"><em>{formatoDe(f.name)}</em><span>{f.name}</span><small>{tamanhoTexto(f.size)}</small>
                      <BotaoTirar onClick={() => setForm({ ...form, novos: form.novos.filter((_, k) => k !== i) })} /></div>
                  ))}
                  <button type="button" className="atp-add" onClick={() => arqRef.current?.click()}><UploadSimple size={18} weight="bold" /><span>Adicionar arquivos<small>PNG, PDF, JPG ou Studio · até 50 MB cada</small></span></button>
                  <input ref={arqRef} type="file" accept={ACEITA_ARQUIVOS} multiple hidden onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) setForm({ ...form, novos: [...form.novos, ...fs] }); }} />
                </div>
              </div>
              {/* (09/11) tags: só pra busca achar o topo (não aparecem pra confeiteira) */}
              <div className="ui-campo">
                <span className="ui-campo-r"><span>Tags da busca</span><button type="button" className="ui-ia atp-tags-ia" onClick={gerarTagsDoForm} disabled={gerandoTags}><Sparkle size={15} weight="fill" aria-hidden="true" />{gerandoTags ? "Gerando…" : "Gerar com IA"}</button></span>
                <div className="ui-campo-c atp-tags" onClick={e => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
                  {form.tags.map(t => <span key={t} className="atp-tag">{t}<button type="button" aria-label={`Tirar ${t}`} onClick={() => setForm({ ...form, tags: form.tags.filter(x => x !== t) })}><X size={12} weight="bold" /></button></span>)}
                  <input placeholder={form.tags.length ? "" : "Ex.: bruxa, abóbora, festa"} value={tagTxt} enterKeyHint="done"
                    onChange={e => { const v = e.target.value; if (/[,;]$/.test(v)) { addTags(v); } else setTagTxt(v); }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTags(tagTxt); } else if (e.key === "Backspace" && !tagTxt && form.tags.length) setForm({ ...form, tags: form.tags.slice(0, -1) }); }}
                    onBlur={() => addTags(tagTxt)} />
                </div>
                <small className="atp-dica">Separe com vírgula. Não aparecem no app, só ajudam a busca.</small>
              </div>
              {/* (09/11) link do modelo no Canva: na confeiteira vira "Editar no Canva" (só PRO) */}
              <Campo rotulo="Link do Canva" opcional type="url" inputMode="url" placeholder="https://www.canva.com/design/…" value={form.canva}
                onChange={e => setForm({ ...form, canva: e.target.value })}
                erro={form.canva.trim() && !/^https?:\/\/(www\.)?canva\.(com|link)\//i.test(form.canva.trim()) ? "Cole o link do Canva (começa com https://www.canva.com/)" : undefined} />
            </div>
          </div>
        )}
      </Janela>

      {/* nova categoria / editar (abre por cima do topo também) */}
      <Janela aberta={!!novaCat} aoFechar={() => !salvando && setNovaCat(null)} tipo="conteudo" titulo={novaCat?.id ? "Editar categoria" : "Nova categoria"} className="atp-janela-cat"
        acoes={<><Botao variante="secundario" onClick={() => setNovaCat(null)} disabled={salvando}>Cancelar</Botao><Botao onClick={salvarCategoria} carregando={salvando} disabled={!novaCat?.nome.trim()}>Salvar</Botao></>}>
        {novaCat && (
          <div className="atp-catf">
            <button type="button" className="atp-capa atp-capa--cat" onClick={() => catImgRef.current?.click()}>
              {novaCat.img ? <img src={URL.createObjectURL(novaCat.img)} alt="" /> : novaCat.imgUrl ? <img src={novaCat.imgUrl} alt="" /> : <span><ImageIcon size={24} />Imagem</span>}
            </button>
            <input ref={catImgRef} type="file" accept={ACEITA_IMAGEM} hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setNovaCat({ ...novaCat, img: f }); }} />
            <Campo rotulo="Nome" placeholder="Ex.: Halloween" maxLength={40} autoFocus value={novaCat.nome} onChange={e => setNovaCat({ ...novaCat, nome: e.target.value })} onKeyDown={e => { if (e.key === "Enter") void salvarCategoria(); }} />
          </div>
        )}
      </Janela>
      {recorte && (
        <ImageCropper imageSrc={recorte} aspect={3 / 4} cropShape="rect" titulo="Ajustar a miniatura" encaixar
          onCancel={() => setRecorte(null)}
          onCropDone={blob => { setForm(f => f && { ...f, capa: new File([blob], "capa.jpg", { type: "image/jpeg" }) }); setRecorte(null); }} />
      )}
    </div>
  );
}
