import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registrar } from "@/lib/adminPerfil";
import { Cake, Image as ImageIcon, PencilSimple, Plus, Trash, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { Botao, BotaoIcone, Campo, Janela, Titulo, avisar, confirmar } from "@/components/base";
import { paraWebp } from "@/lib/imagemLeve";
import {
  ACEITA_ARQUIVOS, ACEITA_IMAGEM, BUCKET_ARQUIVOS, BUCKET_CAPAS, carregarCategorias, carregarTopos, ehImagem, formatoDe, nomeSeguro, tamanhoTexto,
  type ArquivoTopo, type CategoriaTopo, type Topo,
} from "@/lib/toposBolo";
import "./admin-topos.css";

/**
 * (09/11) Admin · Topos de bolo. Categorias com imagem (cria na hora, no próprio formulário do topo) e topos com
 * capa + vários arquivos (PNG, JPG, PDF, Studio). Sem capa, a primeira imagem enviada vira a capa.
 * As capas vão pro bucket público topos-capas (em WebP); os arquivos, pro privado topos-arquivos (só PRO baixa).
 */
const sufixo = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function subirCapa(f: Blob, pasta: string): Promise<string | null> {
  let corpo: Blob = f, ext = "png", tipo = f.type || "image/png";
  try { corpo = await paraWebp(f); ext = "webp"; tipo = "image/webp"; } catch { /* sem WebP: vai o original */ }
  const caminho = `${pasta}/${sufixo()}.${ext}`;
  const up = await supabase.storage.from(BUCKET_CAPAS).upload(caminho, corpo, { cacheControl: "31536000", upsert: false, contentType: tipo });
  if (up.error) return null;
  return supabase.storage.from(BUCKET_CAPAS).getPublicUrl(caminho).data.publicUrl;
}

type Form = { id?: string; titulo: string; categoria_id: string; capa: File | null; capaUrl: string | null; novos: File[]; arquivos: ArquivoTopo[]; tags: string[] };
const FORM_VAZIO: Form = { titulo: "", categoria_id: "", capa: null, capaUrl: null, novos: [], arquivos: [], tags: [] };

export default function AdminTopos() {
  const [cats, setCats] = useState<CategoriaTopo[]>([]);
  const [topos, setTopos] = useState<Topo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semTabela, setSemTabela] = useState(false);
  const [filtro, setFiltro] = useState<string>("");
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [novaCat, setNovaCat] = useState<{ id?: string; nome: string; img: File | null; imgUrl: string | null } | null>(null);
  const capaRef = useRef<HTMLInputElement>(null);
  const [tagTxt, setTagTxt] = useState("");
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
        const url = d.data ? await subirCapa(d.data, tp.id) : null;
        if (url && !(await supabase.from("topos").update({ capa_url: url }).eq("id", tp.id)).error) setTopos(l => l.map(x => (x.id === tp.id ? { ...x, capa_url: url } : x)));
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
    let imagem_url = novaCat.imgUrl;
    if (novaCat.img) { imagem_url = await subirCapa(novaCat.img, "categorias"); if (!imagem_url) { setSalvando(false); avisar("Não deu para enviar a imagem.", { tipo: "erro" }); return; } }
    const dados = { nome: novaCat.nome.trim(), imagem_url };
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
  const abrirEditar = (t: Topo) => setForm({ id: t.id, titulo: t.titulo, categoria_id: t.categoria_id || "", capa: null, capaUrl: t.capa_url, novos: [], arquivos: t.arquivos, tags: t.tags || [] });

  const salvarTopo = async () => {
    if (!form) return;
    if (!form.categoria_id) { avisar("Escolha ou crie a categoria.", { tipo: "erro" }); return; }
    if (!form.arquivos.length && !form.novos.length) { avisar("Adicione pelo menos um arquivo.", { tipo: "erro" }); return; }
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
    if (fonteCapa) capa_url = await subirCapa(fonteCapa, id) || capa_url;
    const titulo = form.titulo.trim() || (form.novos[0]?.name || "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 40);
    const dados = { titulo, tags: form.tags, categoria_id: form.categoria_id, capa_url, arquivos: [...form.arquivos.map(a => ({ ...a, formato: formatoDe(a.nome) })), ...enviados] };
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
      <Titulo nivel="tela" apoio="Topos que as confeiteiras veem em Ferramentas › Topos de bolo. Todas veem as capas; só a PRO baixa os arquivos.">Topos de bolo</Titulo>

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
            <div className="atp-sec-cab"><h2>{filtro ? nomeCat(filtro) : "Todos os topos"} <small>{visiveis.length}</small></h2><Botao tamanho="m" icone={<UploadSimple size={18} weight="bold" />} onClick={abrirNovo}>Novo topo</Botao></div>
            {visiveis.length === 0 ? <p className="atp-vz">Nenhum topo aqui ainda.</p> : (
              <div className="atp-grade">
                {visiveis.map(t => (
                  <article key={t.id} className={`atp-it${t.ativo ? "" : " off"}`}>
                    <button type="button" className="atp-capa" onClick={() => abrirEditar(t)}>{t.capa_url ? <img src={t.capa_url} alt="" loading="lazy" /> : <ImageIcon size={28} />}</button>
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
            </div>
            <div className="atp-form-dados">
              <Campo rotulo="Título" placeholder="Ex.: Festa de Halloween" maxLength={40} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
              {/* (09/11) tags: só pra busca achar o topo (não aparecem pra confeiteira) */}
              <div className="ui-campo">
                <span className="ui-campo-r"><span>Tags da busca</span><small>não aparecem no app · Enter ou vírgula pra separar</small></span>
                <div className="ui-campo-c atp-tags" onClick={e => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
                  {form.tags.map(t => <span key={t} className="atp-tag">{t}<button type="button" aria-label={`Tirar ${t}`} onClick={() => setForm({ ...form, tags: form.tags.filter(x => x !== t) })}><X size={12} weight="bold" /></button></span>)}
                  <input placeholder={form.tags.length ? "" : "Ex.: bruxa, abóbora, festa, terror"} value={tagTxt}
                    onChange={e => { const v = e.target.value; if (/[,;]$/.test(v)) { addTags(v); } else setTagTxt(v); }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTags(tagTxt); } else if (e.key === "Backspace" && !tagTxt && form.tags.length) setForm({ ...form, tags: form.tags.slice(0, -1) }); }}
                    onBlur={() => addTags(tagTxt)} />
                </div>
              </div>
              <div className="ui-campo">
                <span className="ui-campo-r"><span>Categoria</span></span>
                <div className="atp-cat-esc">
                  {cats.map(c => <button key={c.id} type="button" className={form.categoria_id === c.id ? "on" : ""} onClick={() => setForm({ ...form, categoria_id: c.id })}>{c.nome}</button>)}
                  <button type="button" className="atp-cat-nova" onClick={() => setNovaCat({ nome: "", img: null, imgUrl: null })}><Plus size={14} weight="bold" />Nova</button>
                </div>
              </div>
              <div className="ui-campo">
                <span className="ui-campo-r"><span>Arquivos</span><small>PNG, JPG, PDF, Studio · até 50 MB cada</small></span>
                <div className="atp-arqs">
                  {form.arquivos.map(a => (
                    <div key={a.caminho} className="atp-arq"><em>{a.formato}</em><span>{a.nome}</span><small>{tamanhoTexto(a.tamanho)}</small>
                      <BotaoIcone rotulo="Tirar" variante="limpo" tamanho="p" onClick={() => tirarArquivo(a)}><X size={14} /></BotaoIcone></div>
                  ))}
                  {form.novos.map((f, i) => (
                    <div key={`n${i}`} className="atp-arq novo"><em>{formatoDe(f.name)}</em><span>{f.name}</span><small>{tamanhoTexto(f.size)}</small>
                      <BotaoIcone rotulo="Tirar" variante="limpo" tamanho="p" onClick={() => setForm({ ...form, novos: form.novos.filter((_, k) => k !== i) })}><X size={14} /></BotaoIcone></div>
                  ))}
                  <button type="button" className="atp-add" onClick={() => arqRef.current?.click()}><UploadSimple size={16} weight="bold" />Adicionar arquivos</button>
                  <input ref={arqRef} type="file" accept={ACEITA_ARQUIVOS} multiple hidden onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) setForm({ ...form, novos: [...form.novos, ...fs] }); }} />
                </div>
              </div>
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
    </div>
  );
}
