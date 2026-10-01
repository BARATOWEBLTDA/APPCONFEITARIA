import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, PencilSimple, Trash, ArrowUp, ArrowDown, Eye, EyeSlash, X, Image as ImageIcon, CaretDown } from "@phosphor-icons/react";
import RichEditor from "@/components/RichEditor";

interface Noticia {
  id: string;
  emoji: string;
  titulo: string;
  descricao: string;
  conteudo: any;
  imagem_capa: string | null;
  icone_url: string | null;
  slug: string;
  autor: string;
  autor_id: string | null;
  categoria: string | null;
  cta_texto: string | null;
  cta_url: string | null;
  tempo_leitura: number | null;
  ordem: number;
  ativo: boolean;
  views: number;
  likes_base: number;
  likes_count: number;
  publicado_em: string;
  fixada: boolean;
}

interface AutorOpt {
  id: string;
  nome: string;
  foto_url: string | null;
}

const EMOJIS_SUGERIDOS = ["📢", "👋", "💡", "🤖", "🎨", "✨", "🎂", "🍰", "⭐", "🚀", "🔥", "🎁", "📱", "🎉"];
const CATEGORIAS = ["Dica", "Novidade", "Boas-vindas", "Aviso", "Tutorial"];

function estimarTempoLeitura(conteudo: any): number {
  if (!conteudo) return 1;
  const textoJoin = (nodes: any[]): string => nodes.map((n: any) => n.text || (n.content ? textoJoin(n.content) : "")).join(" ");
  const texto = conteudo.content ? textoJoin(conteudo.content) : "";
  const palavras = texto.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(palavras / 200));
}

export default function AdminNoticias() {
  const [rows, setRows] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Noticia | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const capaRef = useRef<HTMLInputElement>(null);
  const iconeRef = useRef<HTMLInputElement>(null);
  const [uploadingIcone, setUploadingIcone] = useState(false);
  const [autoresList, setAutoresList] = useState<AutorOpt[]>([]);

  // ── Notificação push ao salvar ──
  // Campos vazios = usa os dados da notícia. imagemModo: capa da notícia, outra imagem ou sem imagem.
  const NOTIF_VAZIA = { enviar: true, aberta: false, titulo: "", texto: "", imagemModo: "capa" as "capa" | "custom" | "nenhuma", imagemUrl: "" };
  const [notif, setNotif] = useState(NOTIF_VAZIA);
  const [uploadingNotifImg, setUploadingNotifImg] = useState(false);
  const notifImgRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ emoji: "📢", titulo: "", descricao: "", conteudo: null as any, imagem_capa: "", icone_url: "", autor: "Equipe Doonly", autor_id: "", categoria: "", cta_texto: "", cta_url: "", ativo: true, fixada: false, likes_base: 0 });

  useEffect(() => { load(); loadAutores(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("admin_noticias").select("*").order("fixada", { ascending: false }).order("ordem", { ascending: false }).order("publicado_em", { ascending: false });
    if (error) setMsg({ text: "Erro: " + error.message, kind: "err" });
    else setRows(data as Noticia[]);
    setLoading(false);
  };

  const loadAutores = async () => {
    const { data } = await supabase.from("admin_autores").select("id, nome, foto_url").eq("ativo", true).order("ordem", { ascending: true });
    setAutoresList((data as AutorOpt[]) || []);
  };

  const showMsg = (text: string, kind: "ok" | "err") => { setMsg({ text, kind }); setTimeout(() => setMsg(null), 3500); };

  const abrirNovo = () => {
    setEditing(null);
    setForm({ emoji: "📢", titulo: "", descricao: "", conteudo: null, imagem_capa: "", icone_url: "", autor: "Equipe Doonly", autor_id: "", categoria: "", cta_texto: "", cta_url: "", ativo: true, fixada: false, likes_base: 0 });
    setNotif(NOTIF_VAZIA);
    setModalOpen(true);
  };

  const abrirEditar = (n: Noticia) => {
    setEditing(n);
    setForm({ emoji: n.emoji, titulo: n.titulo, descricao: n.descricao, conteudo: n.conteudo, imagem_capa: n.imagem_capa || "", icone_url: n.icone_url || "", autor: n.autor || "Equipe Doonly", autor_id: n.autor_id || "", categoria: n.categoria || "", cta_texto: n.cta_texto || "", cta_url: n.cta_url || "", ativo: n.ativo, fixada: n.fixada || false, likes_base: n.likes_base || 0 });
    // Editando: não reenvia por padrão (evita notificar todo mundo ao corrigir um detalhe)
    setNotif({ ...NOTIF_VAZIA, enviar: false });
    setModalOpen(true);
  };

  const uploadCapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCapa(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `capa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("noticias-capas").upload(fileName, file, { cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("noticias-capas").getPublicUrl(fileName);
      setForm(f => ({ ...f, imagem_capa: data.publicUrl }));
    } catch (err: any) { showMsg("Erro upload: " + err.message, "err"); }
    setUploadingCapa(false);
    e.target.value = "";
  };

  const uploadIcone = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcone(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `icone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("noticias-capas").upload(fileName, file, { cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("noticias-capas").getPublicUrl(fileName);
      setForm(f => ({ ...f, icone_url: data.publicUrl }));
    } catch (err: any) { showMsg("Erro upload: " + err.message, "err"); }
    setUploadingIcone(false);
    e.target.value = "";
  };

  const uploadNotifImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingNotifImg(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("noticias-capas").upload(fileName, file, { cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("noticias-capas").getPublicUrl(fileName);
      setNotif(n => ({ ...n, imagemModo: "custom", imagemUrl: data.publicUrl }));
    } catch (err: any) { showMsg("Erro upload: " + err.message, "err"); }
    setUploadingNotifImg(false);
    e.target.value = "";
  };

  // Valores finais da notificação (personalizado ou herdado da notícia)
  const notifTituloFinal = notif.titulo.trim() || form.titulo.trim();
  const notifTextoFinal = notif.texto.trim() || form.descricao.trim();
  const notifImagemFinal =
    notif.imagemModo === "nenhuma" ? "" :
    notif.imagemModo === "custom" ? notif.imagemUrl :
    form.imagem_capa;
  const podeNotificar = form.ativo;

  const enviarPushNoticia = async (id: string, slug: string | null) => {
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: {
        titulo: notifTituloFinal,
        mensagem: notifTextoFinal,
        imagem_url: notifImagemFinal || null,
        tag: `noticia-${id}`,
        url: slug ? `/noticias/${slug}` : "/noticias",
      },
    });
    if (error) throw new Error(error.message || "falha no envio");
    return (data?.sent as number | undefined) ?? 0;
  };

  const salvar = async () => {
    if (!form.titulo.trim()) { alert("Preencha o título"); return; }
    setSaving(true);
    try {
      const payload = {
        emoji: form.emoji,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        conteudo: form.conteudo,
        imagem_capa: form.imagem_capa || null,
        icone_url: form.icone_url || null,
        autor: form.autor.trim() || "Equipe Doonly",
        autor_id: form.autor_id || null,
        likes_base: form.likes_base || 0,
        categoria: form.categoria.trim() || null,
        cta_texto: form.cta_texto.trim() || null,
        cta_url: form.cta_url.trim() || null,
        tempo_leitura: estimarTempoLeitura(form.conteudo),
        ativo: form.ativo,
        fixada: form.fixada,
      };
      let salvaId = "";
      let salvaSlug: string | null = null;
      if (editing) {
        const { error } = await supabase.from("admin_noticias").update(payload).eq("id", editing.id);
        if (error) throw error;
        salvaId = editing.id;
        salvaSlug = editing.slug || null;
      } else {
        const maxOrdem = rows.length > 0 ? Math.max(...rows.map(r => r.ordem)) : 0;
        const { data: nova, error } = await supabase.from("admin_noticias").insert({ ...payload, ordem: maxOrdem + 10 }).select("id, slug").single();
        if (error) throw error;
        salvaId = nova?.id || "";
        salvaSlug = nova?.slug || null;
      }
      const acao = editing ? "Atualizada" : "Criada";

      if (notif.enviar && podeNotificar && salvaId) {
        // Também vira uma notificação na aba Notificações (uma vez só por notícia)
        try {
          const chave = `noticia-${salvaId}`;
          const { data: ja } = await supabase.from("notificacoes").select("id").is("user_id", null).eq("chave", chave).maybeSingle();
          if (!ja) await supabase.from("notificacoes").insert({
            titulo: notifTituloFinal, mensagem: notifTextoFinal, imagem_url: notifImagemFinal || null,
            tipo: "noticia", tag: "Novidade", link: salvaSlug ? `/noticias/${salvaSlug}` : "/noticias", chave,
          });
        } catch { /* não impede o push */ }
        try {
          const enviados = await enviarPushNoticia(salvaId, salvaSlug);
          showMsg(`${acao}! Notificação enviada para ${enviados} ${enviados === 1 ? "aparelho" : "aparelhos"}.`, "ok");
        } catch (pushErr: any) {
          showMsg(`${acao}, mas a notificação falhou: ${pushErr.message}`, "err");
        }
      } else {
        showMsg(`${acao}!`, "ok");
      }
      setModalOpen(false);
      await load();
    } catch (err: any) { showMsg("Erro: " + err.message, "err"); }
    setSaving(false);
  };

  const excluir = async (n: Noticia) => {
    if (!confirm(`Excluir "${n.titulo}"?`)) return;
    const { error } = await supabase.from("admin_noticias").delete().eq("id", n.id);
    if (error) showMsg("Erro: " + error.message, "err"); else { showMsg("Excluída!", "ok"); await load(); }
  };

  const toggleAtivo = async (n: Noticia) => {
    const { error } = await supabase.from("admin_noticias").update({ ativo: !n.ativo }).eq("id", n.id);
    if (error) showMsg("Erro: " + error.message, "err"); else await load();
  };

  const mover = async (n: Noticia, dir: "up" | "down") => {
    const idx = rows.findIndex(r => r.id === n.id);
    if (idx === -1) return;
    const outroIdx = dir === "up" ? idx - 1 : idx + 1;
    if (outroIdx < 0 || outroIdx >= rows.length) return;
    const outro = rows[outroIdx];
    await supabase.from("admin_noticias").update({ ordem: outro.ordem }).eq("id", n.id);
    await supabase.from("admin_noticias").update({ ordem: n.ordem }).eq("id", outro.id);
    await load();
  };

  if (loading) return <div className="an-loading">Carregando...</div>;

  return (
    <div className="an-root">
      <div className="an-header">
        <div>
          <h1 className="an-title">Notícias da Home</h1>
          <p className="an-sub">Aparecem na Home e em /noticias</p>
        </div>
        <button className="an-btn-new" onClick={abrirNovo}><Plus size={16} weight="bold" /> Nova notícia</button>
      </div>

      {msg && <div className={`an-msg an-msg--${msg.kind}`}>{msg.text}</div>}

      {rows.length === 0 ? (
        <div className="an-empty"><p>Nenhuma notícia ainda.</p><button className="an-btn-new" onClick={abrirNovo}><Plus size={16} weight="bold" /> Criar primeira</button></div>
      ) : (
        <div className="an-list">
          {rows.map((n, idx) => (
            <div key={n.id} className={`an-card ${!n.ativo ? "an-card--off" : ""}`}>
              <div className="an-card-capa">{n.imagem_capa ? <img src={n.imagem_capa} alt="" /> : <span>{n.emoji}</span>}</div>
              <div className="an-card-body">
                <div className="an-card-tags">
                  {n.fixada && <span className="an-tag an-tag--fix">📌 Fixada</span>}
                  {n.categoria && <span className="an-tag">{n.categoria}</span>}
                  {!n.ativo && <span className="an-tag an-tag--off">Desativada</span>}
                  {n.views > 0 && <span className="an-views">{n.views} views</span>}
                  <span className="an-ordem">ordem: {n.ordem}</span>
                </div>
                <p className="an-card-t">{n.titulo}</p>
                <p className="an-card-d">{n.descricao || "(sem descrição)"}</p>
                <p className="an-card-slug">/{n.slug}</p>
              </div>
              <div className="an-card-actions">
                <button className="an-icbtn" onClick={() => mover(n, "up")} disabled={idx === 0} title="Subir"><ArrowUp size={14} weight="bold" /></button>
                <button className="an-icbtn" onClick={() => mover(n, "down")} disabled={idx === rows.length - 1} title="Descer"><ArrowDown size={14} weight="bold" /></button>
                <button className="an-icbtn" onClick={() => toggleAtivo(n)} title={n.ativo ? "Desativar" : "Ativar"}>{n.ativo ? <Eye size={14} weight="bold" /> : <EyeSlash size={14} weight="bold" />}</button>
                <button className="an-icbtn" onClick={() => abrirEditar(n)} title="Editar"><PencilSimple size={14} weight="bold" /></button>
                <button className="an-icbtn an-icbtn--danger" onClick={() => excluir(n)} title="Excluir"><Trash size={14} weight="bold" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="an-modal-overlay" onClick={() => !saving && setModalOpen(false)}>
          <div className="an-modal" onClick={e => e.stopPropagation()}>
            <div className="an-modal-head">
              <h2>{editing ? "Editar notícia" : "Nova notícia"}</h2>
              <button className="an-icbtn" onClick={() => !saving && setModalOpen(false)}><X size={16} weight="bold" /></button>
            </div>
            <div className="an-modal-body">
              <div className="an-field">
                <label>Emoji</label>
                <div className="an-emoji-row">
                  <input type="text" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4} className="an-emoji-input" />
                  <div className="an-emoji-chips">{EMOJIS_SUGERIDOS.map(e => <button key={e} className="an-emoji-chip" onClick={() => setForm(f => ({ ...f, emoji: e }))}>{e}</button>)}</div>
                </div>
              </div>
              <div className="an-field">
                <label>Título</label>
                <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Como fotografar seus bolos" maxLength={120} />
              </div>
              <div className="an-field">
                <label>Imagem de capa</label>
                {form.imagem_capa ? (
                  <div className="an-capa-preview">
                    <img src={form.imagem_capa} alt="" />
                    <button className="an-capa-remove" onClick={() => setForm(f => ({ ...f, imagem_capa: "" }))}>✕ Remover</button>
                  </div>
                ) : (
                  <div className="an-capa-upload" onClick={() => !uploadingCapa && capaRef.current?.click()}>
                    {uploadingCapa ? <span>Enviando...</span> : (<><ImageIcon size={24} weight="regular" /><span>Enviar imagem de capa</span><span className="an-capa-hint">Formato 16:9 · até 2MB</span></>)}
                  </div>
                )}
                <input ref={capaRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadCapa} />
              </div>

              <div className="an-field">
                <label>Ícone pequeno (imagem quadrada) — aparece no card da Home</label>
                {form.icone_url ? (
                  <div className="an-icone-preview">
                    <img src={form.icone_url} alt="" />
                    <button className="an-capa-remove" onClick={() => setForm(f => ({ ...f, icone_url: "" }))}>✕ Remover</button>
                  </div>
                ) : (
                  <div className="an-icone-upload" onClick={() => !uploadingIcone && iconeRef.current?.click()}>
                    {uploadingIcone ? <span>Enviando...</span> : (<><ImageIcon size={22} weight="regular" /><span>Enviar ícone quadrado</span><span className="an-capa-hint">1:1 · até 500KB · Se vazio, usa o emoji</span></>)}
                  </div>
                )}
                <input ref={iconeRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadIcone} />
              </div>
              <div className="an-row">
                <div className="an-field">
                  <label>Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Nenhuma</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="an-field">
                  <label>Autor</label>
                  {autoresList.length > 0 ? (
                    <select value={form.autor_id} onChange={e => {
                      const id = e.target.value;
                      const a = autoresList.find(x => x.id === id);
                      setForm(f => ({ ...f, autor_id: id, autor: a ? a.nome : f.autor }));
                    }}>
                      <option value="">— Usar texto livre —</option>
                      {autoresList.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} placeholder="Ex: Equipe Doonly" />
                  )}
                  {autoresList.length > 0 && !form.autor_id && (
                    <input type="text" value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} placeholder="Ou digite um nome livre" style={{ marginTop: 6 }} />
                  )}
                  {autoresList.length === 0 && (
                    <span className="an-hint" style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4, display: "block" }}>Cadastre autores em /admin/autores pra selecionar aqui.</span>
                  )}
                </div>
              </div>
              <div className="an-field">
                <label>Likes iniciais (opcional) — soma aos likes reais</label>
                <input type="number" min={0} value={form.likes_base} onChange={e => setForm(f => ({ ...f, likes_base: Math.max(0, parseInt(e.target.value) || 0) }))} placeholder="Ex: 42 (evita começar do zero)" />
              </div>
              <div className="an-field">
                <label>Descrição curta (aparece no card da Home)</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} maxLength={200} />
              </div>
              <div className="an-field">
                <label>Conteúdo completo</label>
                <RichEditor content={form.conteudo} onChange={(json) => setForm(f => ({ ...f, conteudo: json }))} />
              </div>
              <div className="an-row">
                <div className="an-field">
                  <label>Texto do botão CTA (opcional)</label>
                  <input type="text" value={form.cta_texto} onChange={e => setForm(f => ({ ...f, cta_texto: e.target.value }))} />
                </div>
                <div className="an-field">
                  <label>Link do botão</label>
                  <input type="text" value={form.cta_url} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))} />
                </div>
              </div>
              <div className="an-field">
                <label className="an-toggle-lbl">
                  <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                  <span>Ativa (aparece pra usuários)</span>
                </label>
              </div>

              <div className="an-field">
                <label className="an-toggle-lbl">
                  <input type="checkbox" checked={form.fixada} onChange={e => setForm(f => ({ ...f, fixada: e.target.checked }))} />
                  <span>📌 <b>Fixar no topo</b> (sempre visível na Home)</span>
                </label>
                {form.fixada && (
                  <p className="an-fix-hint">
                    ⚠️ Só pode ter <b>1 notícia fixada</b>. Se já existir outra, ela vai ser desafixada automaticamente ao salvar.
                  </p>
                )}
              </div>

              {/* ── Notificação no celular ── */}
              <div className={`an-notif${!podeNotificar ? " an-notif--off" : ""}`}>
                <label className="an-toggle-lbl">
                  <input
                    type="checkbox"
                    checked={notif.enviar && podeNotificar}
                    disabled={!podeNotificar}
                    onChange={e => setNotif(n => ({ ...n, enviar: e.target.checked }))}
                  />
                  <span>🔔 <b>{editing ? "Avisar as confeiteiras de novo" : "Avisar as confeiteiras"}</b> (aparece na aba Notificações e no celular de quem ativou)</span>
                </label>
                {!podeNotificar && <p className="an-notif-hint">Ative a notícia pra poder notificar.</p>}

                {notif.enviar && podeNotificar && (
                  <>
                    <button type="button" className="an-notif-toggle" onClick={() => setNotif(n => ({ ...n, aberta: !n.aberta }))}>
                      Personalizar notificação
                      <CaretDown size={12} weight="bold" style={{ transform: notif.aberta ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                    </button>

                    {notif.aberta && (
                      <div className="an-notif-body">
                        <div className="an-field">
                          <label>Título da notificação <span className="an-notif-count">{notifTituloFinal.length}/40</span></label>
                          <input type="text" value={notif.titulo} maxLength={80}
                            onChange={e => setNotif(n => ({ ...n, titulo: e.target.value }))}
                            placeholder={form.titulo || "Vazio = usa o título da notícia"} />
                        </div>
                        <div className="an-field">
                          <label>Texto <span className="an-notif-count">{notifTextoFinal.length}/100</span></label>
                          <textarea value={notif.texto} rows={2} maxLength={200}
                            onChange={e => setNotif(n => ({ ...n, texto: e.target.value }))}
                            placeholder={form.descricao || "Vazio = usa a descrição da notícia"} />
                        </div>
                        <div className="an-field">
                          <label>Imagem (só aparece no Android)</label>
                          <div className="an-notif-img-opts">
                            <button type="button" className={notif.imagemModo === "capa" ? "on" : ""} onClick={() => setNotif(n => ({ ...n, imagemModo: "capa" }))}>Capa da notícia</button>
                            <button type="button" className={notif.imagemModo === "custom" ? "on" : ""} onClick={() => notif.imagemUrl ? setNotif(n => ({ ...n, imagemModo: "custom" })) : notifImgRef.current?.click()}>
                              {uploadingNotifImg ? "Enviando..." : "Outra imagem"}
                            </button>
                            <button type="button" className={notif.imagemModo === "nenhuma" ? "on" : ""} onClick={() => setNotif(n => ({ ...n, imagemModo: "nenhuma" }))}>Sem imagem</button>
                          </div>
                          {notif.imagemModo === "custom" && notif.imagemUrl && (
                            <button type="button" className="an-notif-trocar" onClick={() => notifImgRef.current?.click()}>Trocar imagem</button>
                          )}
                          <input ref={notifImgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadNotifImg} />
                        </div>
                      </div>
                    )}

                    {/* Prévia (estilo Android) */}
                    <div className="an-notif-prev">
                      <div className="an-notif-prev-top">
                        <img src="/Sistema/icon-192.png" alt="" />
                        <span>Doonly · agora</span>
                      </div>
                      <p className="an-notif-prev-t">{notifTituloFinal || "Título da notificação"}</p>
                      <p className="an-notif-prev-d">{notifTextoFinal || "Texto da notificação"}</p>
                      {notifImagemFinal && <img className="an-notif-prev-img" src={notifImagemFinal} alt="" />}
                      <p className="an-notif-prev-link">Ao tocar, abre esta notícia</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="an-modal-foot">
              <button className="an-btn-cancel" onClick={() => !saving && setModalOpen(false)}>Cancelar</button>
              <button className="an-btn-save" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : (editing ? "Salvar" : "Criar")}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .an-root { padding: 24px; max-width: 900px; margin: 0 auto; font-family: 'Geist', sans-serif; }
        .an-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .an-title { font-size: 22px; font-weight: 900; margin: 0 0 4px; color: #2C1219; }
        .an-sub { font-size: 13px; color: #6B7280; margin: 0; }
        .an-loading { padding: 40px; text-align: center; color: #6B7280; }
        .an-btn-new { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; background: linear-gradient(135deg, #E85A8C, #C33A6E); color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 #7A1B47; font-family: inherit; }
        .an-msg { padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
        .an-msg--ok { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }
        .an-msg--err { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
        .an-empty { text-align: center; padding: 60px 20px; color: #6B7280; }
        .an-list { display: flex; flex-direction: column; gap: 10px; }
        .an-card { display: flex; gap: 14px; padding: 14px 16px; background: #fff; border: 1px solid #F0EBED; border-radius: 10px; }
        .an-card--off { opacity: 0.55; }
        .an-card-capa { width: 60px; height: 60px; border-radius: 8px; background: #F5F0F2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .an-card-capa img { width: 100%; height: 100%; object-fit: cover; }
        .an-card-capa span { font-size: 28px; }
        .an-card-body { flex: 1; min-width: 0; }
        .an-card-tags { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; flex-wrap: wrap; }
        .an-tag { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 2px; background: #F5F0F2; color: #4B5563; letter-spacing: 0.02em; }
        .an-tag--off { background: #F5F0F2; color: #6B7280; }
        .an-tag--fix { background: #FEF3C7; color: #B45309; font-weight: 800; }
        .an-notif { margin-bottom: 16px; padding: 12px; border-radius: 10px; background: #FAF7F8; }
        .an-notif--off { opacity: 0.6; }
        .an-notif-hint { margin: 6px 0 0 26px; font-size: 11px; color: #6B7280; }
        .an-notif-toggle { display: flex; align-items: center; gap: 6px; margin: 10px 0 0 26px; padding: 0; background: none; border: none; font-family: inherit; font-size: 12px; font-weight: 700; color: #C33A6E; cursor: pointer; }
        .an-notif-body { margin: 12px 0 0; }
        .an-notif-count { float: right; font-weight: 500; color: #9CA3AF; }
        .an-notif-img-opts { display: flex; gap: 6px; flex-wrap: wrap; }
        .an-notif-img-opts button { padding: 7px 12px; border-radius: 6px; border: 1.5px solid #F0EBED; background: #fff; font-family: inherit; font-size: 12px; font-weight: 600; color: #4B5563; cursor: pointer; }
        .an-notif-img-opts button.on { border-color: #E85A8C; color: #C33A6E; background: #FFF5F9; }
        .an-notif-trocar { margin-top: 6px; padding: 0; background: none; border: none; font-family: inherit; font-size: 11.5px; font-weight: 600; color: #6B7280; text-decoration: underline; cursor: pointer; }
        .an-notif-prev { margin-top: 12px; background: #fff; border-radius: 14px; padding: 12px 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); max-width: 360px; }
        .an-notif-prev-top { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6B7280; margin-bottom: 6px; }
        .an-notif-prev-top img { width: 16px; height: 16px; border-radius: 4px; }
        .an-notif-prev-t { margin: 0; font-size: 13.5px; font-weight: 700; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-notif-prev-d { margin: 2px 0 0; font-size: 12.5px; color: #4B5563; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .an-notif-prev-img { display: block; width: 100%; aspect-ratio: 2/1; object-fit: cover; border-radius: 8px; margin-top: 8px; }
        .an-notif-prev-link { margin: 8px 0 0; font-size: 10.5px; color: #9CA3AF; }
        .an-fix-hint { margin: 6px 0 0; font-size: 11px; color: #B45309; background: #FEF3C7; padding: 8px 10px; border-radius: 6px; }
        .an-views { font-size: 10px; color: #6B7280; }
        .an-ordem { font-size: 10px; color: #9CA3AF; margin-left: auto; }
        .an-card-t { font-size: 14px; font-weight: 800; margin: 0 0 3px; color: #2C1219; }
        .an-card-d { font-size: 12.5px; color: #6B7280; margin: 0 0 3px; line-height: 1.4; }
        .an-card-slug { font-size: 10.5px; color: #9CA3AF; margin: 0; font-family: monospace; }
        .an-card-actions { display: flex; gap: 4px; flex-shrink: 0; align-items: flex-start; }
        .an-icbtn { width: 30px; height: 30px; background: #F5F0F2; border: none; border-radius: 6px; color: #6B7280; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .an-icbtn:hover:not(:disabled) { background: #E5DDE0; color: #2C1219; }
        .an-icbtn:disabled { opacity: 0.3; cursor: not-allowed; }
        .an-icbtn--danger:hover { background: #FEF2F2; color: #B91C1C; }
        .an-modal-overlay { position: fixed; inset: 0; background: rgba(44,18,25,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100; }
        .an-modal { background: #fff; border-radius: 14px; width: 100%; max-width: 720px; max-height: 92vh; overflow: hidden; display: flex; flex-direction: column; }
        .an-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #F0EBED; }
        .an-modal-head h2 { margin: 0; font-size: 17px; font-weight: 800; color: #2C1219; }
        .an-modal-body { padding: 20px; overflow-y: auto; flex: 1; }
        .an-modal-foot { padding: 14px 20px; border-top: 1px solid #F0EBED; display: flex; gap: 8px; justify-content: flex-end; }
        .an-btn-cancel { padding: 10px 16px; background: transparent; color: #6B7280; border: 1px solid #F0EBED; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .an-btn-save { padding: 10px 20px; background: linear-gradient(135deg, #E85A8C, #C33A6E); color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 #7A1B47; font-family: inherit; }
        .an-btn-save:disabled { opacity: 0.5; cursor: wait; }
        .an-field { margin-bottom: 16px; }
        .an-field label { display: block; font-size: 12px; font-weight: 700; color: #2C1219; margin-bottom: 6px; }
        .an-field input[type="text"], .an-field textarea, .an-field select { width: 100%; padding: 10px 12px; border: 1.5px solid #F0EBED; border-radius: 8px; font-size: 13.5px; font-family: inherit; resize: vertical; }
        .an-field input:focus, .an-field textarea:focus, .an-field select:focus { outline: none; border-color: #E85A8C; }
        .an-row { display: flex; gap: 10px; }
        .an-row .an-field { flex: 1; }
        .an-emoji-row { display: flex; gap: 8px; align-items: center; }
        .an-emoji-input { width: 60px !important; text-align: center; font-size: 20px !important; }
        .an-emoji-chips { display: flex; gap: 4px; flex-wrap: wrap; }
        .an-emoji-chip { width: 32px; height: 32px; background: #F5F0F2; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; }
        .an-emoji-chip:hover { background: #E5DDE0; }
        .an-toggle-lbl { display: flex !important; align-items: center; gap: 8px; cursor: pointer; }
        .an-toggle-lbl input { width: 18px; height: 18px; margin: 0; }
        .an-capa-upload { width: 100%; aspect-ratio: 16/9; background: #FAFAFA; border: 2px dashed #E5DDE0; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #6B7280; gap: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }
        .an-capa-upload:hover { background: #F5F0F2; border-color: #E85A8C; color: #C33A6E; }
        .an-capa-hint { font-size: 10px; color: #9CA3AF; }
        .an-capa-preview { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: 10px; overflow: hidden; }
        .an-capa-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .an-capa-remove { position: absolute; top: 8px; right: 8px; padding: 6px 10px; background: rgba(0,0,0,0.65); color: #fff; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; backdrop-filter: blur(6px); }
        .an-icone-upload { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #FAFAFA; border: 2px dashed #E5DDE0; border-radius: 10px; color: #6B7280; cursor: pointer; font-size: 12px; font-weight: 600; }
        .an-icone-upload:hover { background: #F5F0F2; border-color: #E85A8C; color: #C33A6E; }
        .an-icone-preview { position: relative; display: inline-block; }
        .an-icone-preview img { width: 84px; height: 84px; object-fit: cover; border-radius: 10px; display: block; border: 1px solid #F0EBED; }
      `}</style>
    </div>
  );
}
