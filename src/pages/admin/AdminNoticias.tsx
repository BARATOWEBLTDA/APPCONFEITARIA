import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, PencilSimple, Trash, ArrowUp, ArrowDown, Eye, EyeSlash, Image as ImageIcon, CaretDown, PushPin, Bell, WarningCircle, Newspaper, DotsThree } from "@phosphor-icons/react";
import RichEditor from "@/components/RichEditor";
import { Botao, BotaoIcone, Campo, CampoArea, Janela, TelaVazia, Titulo, avisar, confirmar } from "@/components/base";
import "./admin-noticias.css";

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
  const capaRef = useRef<HTMLInputElement>(null);
  const iconeRef = useRef<HTMLInputElement>(null);
  const [uploadingIcone, setUploadingIcone] = useState(false);
  const [autoresList, setAutoresList] = useState<AutorOpt[]>([]);
  const [menuDe, setMenuDe] = useState<Noticia | null>(null);

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
    if (error) avisar("Erro: " + error.message, { tipo: "erro" });
    else setRows(data as Noticia[]);
    setLoading(false);
  };

  const loadAutores = async () => {
    const { data } = await supabase.from("admin_autores").select("id, nome, foto_url").eq("ativo", true).order("ordem", { ascending: true });
    setAutoresList((data as AutorOpt[]) || []);
  };

  const showMsg = (text: string, kind: "ok" | "err") => { avisar(text, { tipo: kind === "err" ? "erro" : "ok" }); };

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
    if (!form.titulo.trim()) { avisar("Preencha o título.", { tipo: "erro" }); return; }
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
    if (!(await confirmar({ titulo: `Excluir "${n.titulo}"?`, texto: "Ela some do Início e da tela de Notícias.", rotulo: "Excluir", perigo: true }))) return;
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

  const fecharModal = () => { if (!saving) setModalOpen(false); };
  const idxMenu = menuDe ? rows.findIndex(r => r.id === menuDe.id) : -1;

  if (loading) return <div className="an-carregando"><span className="ui-gira" aria-label="Carregando" /></div>;

  const botaoNovo = (
    <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={abrirNovo}>
      <span className="an-g">Nova notícia</span><span className="an-c">Nova</span>
    </Botao>
  );

  return (
    <div className="an-root">
      <Titulo nivel="tela" contagem={rows.length || undefined} apoio="Aparecem no Início e na tela de Notícias." acao={rows.length > 0 ? botaoNovo : undefined}>
        Notícias do Início
      </Titulo>

      {rows.length === 0 ? (
        <TelaVazia caixa className="an-vazia" icone={<Newspaper size={30} />} titulo="Nenhuma notícia ainda"
          texto="Crie a primeira pra ela aparecer no Início."
          acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={abrirNovo}>Criar notícia</Botao>} />
      ) : (
        <div className="an-list">
          {rows.map((n, idx) => (
            <div key={n.id} className={`an-card${!n.ativo ? " an-card--off" : ""}`}>
              <div className="an-card-main">
                <div className="an-card-capa">{n.imagem_capa ? <img src={n.imagem_capa} alt="" /> : n.icone_url ? <img src={n.icone_url} alt="" /> : <Newspaper size={26} weight="bold" aria-hidden="true" />}</div>
                <div className="an-card-body">
                  <div className="an-card-tags">
                    {n.fixada && <span className="an-tag an-tag--fix"><PushPin size={12} weight="fill" />Fixada</span>}
                    {n.categoria && <span className="an-tag">{n.categoria}</span>}
                    {!n.ativo && <span className="an-tag an-tag--off"><EyeSlash size={12} weight="bold" />Desativada</span>}
                  </div>
                  <p className="an-card-t">{n.titulo}</p>
                  <p className="an-card-d">{n.descricao || "Sem descrição"}</p>
                  <p className="an-card-meta">
                    <span className="an-card-slug">/{n.slug}</span>
                    {n.views > 0 && <span><Eye size={12} weight="bold" />{n.views} {n.views === 1 ? "visualização" : "visualizações"}</span>}
                    <span>Posição {idx + 1}</span>
                  </p>
                </div>
                <BotaoIcone className="an-mais" rotulo={`Opções de ${n.titulo}`} variante="limpo" onClick={() => setMenuDe(n)}><DotsThree size={22} weight="bold" /></BotaoIcone>
              </div>
              <div className="an-card-actions">
                <BotaoIcone rotulo="Subir" variante="limpo" onClick={() => mover(n, "up")} disabled={idx === 0}><ArrowUp size={20} weight="bold" /></BotaoIcone>
                <BotaoIcone rotulo="Descer" variante="limpo" onClick={() => mover(n, "down")} disabled={idx === rows.length - 1}><ArrowDown size={20} weight="bold" /></BotaoIcone>
                <BotaoIcone rotulo={n.ativo ? "Desativar" : "Ativar"} variante="limpo" onClick={() => toggleAtivo(n)}>{n.ativo ? <Eye size={20} weight="bold" /> : <EyeSlash size={20} weight="bold" />}</BotaoIcone>
                <BotaoIcone rotulo="Editar" variante="limpo" onClick={() => abrirEditar(n)}><PencilSimple size={20} weight="bold" /></BotaoIcone>
                <BotaoIcone rotulo="Excluir" variante="limpo" className="an-perigo" onClick={() => excluir(n)}><Trash size={20} weight="bold" /></BotaoIcone>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* menu da notícia (celular) */}
      <Janela aberta={!!menuDe} aoFechar={() => setMenuDe(null)} tipo="conteudo" titulo={menuDe?.titulo || ""}>
        {menuDe && (
          <div className="an-menu">
            <button type="button" onClick={() => { const n = menuDe; setMenuDe(null); abrirEditar(n); }}><PencilSimple size={20} weight="bold" />Editar</button>
            <button type="button" onClick={() => { const n = menuDe; setMenuDe(null); toggleAtivo(n); }}>
              {menuDe.ativo ? <><EyeSlash size={20} weight="bold" />Desativar</> : <><Eye size={20} weight="bold" />Ativar</>}
            </button>
            <button type="button" disabled={idxMenu <= 0} onClick={() => { const n = menuDe; setMenuDe(null); mover(n, "up"); }}><ArrowUp size={20} weight="bold" />Subir na ordem</button>
            <button type="button" disabled={idxMenu < 0 || idxMenu >= rows.length - 1} onClick={() => { const n = menuDe; setMenuDe(null); mover(n, "down"); }}><ArrowDown size={20} weight="bold" />Descer na ordem</button>
            <button type="button" className="perigo" onClick={() => { const n = menuDe; setMenuDe(null); excluir(n); }}><Trash size={20} weight="bold" />Excluir</button>
          </div>
        )}
      </Janela>

      {/* nova / editar */}
      <Janela aberta={modalOpen} aoFechar={fecharModal} tipo="conteudo" travada titulo={editing ? "Editar notícia" : "Nova notícia"}
        acoes={<><Botao variante="secundario" onClick={fecharModal} disabled={saving}>Cancelar</Botao><Botao onClick={salvar} carregando={saving}>{editing ? "Salvar" : "Criar notícia"}</Botao></>}>
        <div className="an-form">
          <div className="ui-campo">
            <span className="ui-campo-r"><span>Emoji</span></span>
            <div className="an-emoji-row">
              <div className="ui-campo-c an-emoji-input">
                <input type="text" aria-label="Emoji" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4} />
              </div>
              <div className="an-emoji-chips">{EMOJIS_SUGERIDOS.map(e => <button type="button" key={e} className="an-emoji-chip" aria-pressed={form.emoji === e} onClick={() => setForm(f => ({ ...f, emoji: e }))}>{e}</button>)}</div>
            </div>
          </div>

          <Campo rotulo="Título" obrigatorio value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Como fotografar seus bolos" maxLength={120} />

          <div className="ui-campo">
            <span className="ui-campo-r"><span>Imagem de capa</span><small>opcional</small></span>
            {form.imagem_capa ? (
              <div className="an-capa-preview">
                <img src={form.imagem_capa} alt="" />
                <Botao className="an-remover" variante="secundario" tamanho="p" icone={<Trash size={16} weight="bold" />} onClick={() => setForm(f => ({ ...f, imagem_capa: "" }))}>Remover</Botao>
              </div>
            ) : (
              <button type="button" className="an-capa-upload" disabled={uploadingCapa} onClick={() => !uploadingCapa && capaRef.current?.click()}>
                {uploadingCapa ? <span className="ui-gira" aria-label="Enviando" /> : (<><ImageIcon size={24} weight="bold" /><b>Enviar imagem de capa</b><small>Formato 16:9, até 2 MB</small></>)}
              </button>
            )}
            <input ref={capaRef} type="file" accept="image/*" hidden onChange={uploadCapa} />
          </div>

          <div className="ui-campo">
            <span className="ui-campo-r"><span>Ícone pequeno</span><small>opcional</small></span>
            {form.icone_url ? (
              <div className="an-icone-preview">
                <img src={form.icone_url} alt="" />
                <Botao variante="link" tamanho="p" onClick={() => setForm(f => ({ ...f, icone_url: "" }))}>Remover ícone</Botao>
              </div>
            ) : (
              <button type="button" className="an-icone-upload" disabled={uploadingIcone} onClick={() => !uploadingIcone && iconeRef.current?.click()}>
                {uploadingIcone ? <span className="ui-gira" aria-label="Enviando" /> : (<><ImageIcon size={22} weight="bold" /><span><b>Enviar ícone quadrado</b><small>1:1, até 500 KB. Sem ícone, usa o emoji.</small></span></>)}
              </button>
            )}
            <p className="ui-campo-msg">Aparece no cartão do Início.</p>
            <input ref={iconeRef} type="file" accept="image/*" hidden onChange={uploadIcone} />
          </div>

          <div className="an-row">
            <div className="ui-campo">
              <label className="ui-campo-r" htmlFor="an-categoria"><span>Categoria</span></label>
              <div className="ui-campo-c an-sel">
                <select id="an-categoria" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  <option value="">Nenhuma</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <CaretDown size={16} weight="bold" aria-hidden="true" />
              </div>
            </div>
            {autoresList.length > 0 ? (
              <div className="ui-campo">
                <label className="ui-campo-r" htmlFor="an-autor"><span>Autor</span></label>
                <div className="ui-campo-c an-sel">
                  <select id="an-autor" value={form.autor_id} onChange={e => {
                    const id = e.target.value;
                    const a = autoresList.find(x => x.id === id);
                    setForm(f => ({ ...f, autor_id: id, autor: a ? a.nome : f.autor }));
                  }}>
                    <option value="">Digitar um nome</option>
                    {autoresList.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                  <CaretDown size={16} weight="bold" aria-hidden="true" />
                </div>
              </div>
            ) : (
              <Campo rotulo="Autor" value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} placeholder="Ex.: Equipe Doonly"
                dica="Cadastre autores em /admin/autores pra escolher aqui." />
            )}
          </div>
          {autoresList.length > 0 && !form.autor_id && (
            <Campo rotulo="Nome do autor" value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} placeholder="Ex.: Equipe Doonly" />
          )}

          <Campo rotulo="Curtidas iniciais" opcional type="number" inputMode="numeric" min={0} value={form.likes_base}
            onChange={e => setForm(f => ({ ...f, likes_base: Math.max(0, parseInt(e.target.value) || 0) }))}
            placeholder="Ex.: 42" dica="Somam às curtidas reais, pra não começar do zero." />

          <CampoArea rotulo="Descrição curta" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} maxLength={200}
            dica="Aparece no cartão do Início." />

          <div className="ui-campo">
            <span className="ui-campo-r"><span>Conteúdo completo</span></span>
            <div className="an-editor">
              <RichEditor content={form.conteudo} onChange={(json) => setForm(f => ({ ...f, conteudo: json }))} />
            </div>
          </div>

          <div className="an-row">
            <Campo rotulo="Texto do botão" opcional value={form.cta_texto} onChange={e => setForm(f => ({ ...f, cta_texto: e.target.value }))} placeholder="Ex.: Ver agora" />
            <Campo rotulo="Link do botão" opcional value={form.cta_url} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))} placeholder="Ex.: /assinar" />
          </div>

          <div className="an-checks">
            <label className="an-check">
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
              <span><b>Ativa</b><small>Aparece pras confeiteiras.</small></span>
            </label>
            <label className="an-check">
              <input type="checkbox" checked={form.fixada} onChange={e => setForm(f => ({ ...f, fixada: e.target.checked }))} />
              <span><b><PushPin size={16} weight="bold" aria-hidden="true" />Fixar no topo</b><small>Sempre visível no Início.</small></span>
            </label>
            {form.fixada && (
              <p className="an-fix-hint">
                <WarningCircle size={18} weight="bold" aria-hidden="true" />
                <span>Só uma notícia pode ficar fixada. Se já tiver outra, ela sai do topo ao salvar.</span>
              </p>
            )}
          </div>

          {/* ── Notificação no celular ── */}
          <div className={`an-notif${!podeNotificar ? " an-notif--off" : ""}`}>
            <label className="an-check">
              <input
                type="checkbox"
                checked={notif.enviar && podeNotificar}
                disabled={!podeNotificar}
                onChange={e => setNotif(n => ({ ...n, enviar: e.target.checked }))}
              />
              <span>
                <b><Bell size={16} weight="bold" aria-hidden="true" />{editing ? "Avisar as confeiteiras de novo" : "Avisar as confeiteiras"}</b>
                <small>Aparece na aba Notificações e no celular de quem ativou.</small>
              </span>
            </label>
            {!podeNotificar && <p className="an-notif-hint">Ative a notícia pra poder avisar.</p>}

            {notif.enviar && podeNotificar && (
              <>
                <button type="button" className="an-notif-toggle" aria-expanded={notif.aberta} onClick={() => setNotif(n => ({ ...n, aberta: !n.aberta }))}>
                  Personalizar notificação
                  <CaretDown size={16} weight="bold" style={{ transform: notif.aberta ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                </button>

                {notif.aberta && (
                  <div className="an-notif-body">
                    <Campo rotulo={`Título da notificação · ${notifTituloFinal.length}/40`} value={notif.titulo} maxLength={80}
                      onChange={e => setNotif(n => ({ ...n, titulo: e.target.value }))}
                      placeholder={form.titulo || "Vazio usa o título da notícia"} />
                    <CampoArea rotulo={`Texto · ${notifTextoFinal.length}/100`} value={notif.texto} rows={2} maxLength={200}
                      onChange={e => setNotif(n => ({ ...n, texto: e.target.value }))}
                      placeholder={form.descricao || "Vazio usa a descrição da notícia"} />
                    <div className="ui-campo">
                      <span className="ui-campo-r"><span>Imagem</span><small>só no Android</small></span>
                      <div className="an-notif-img-opts" role="group" aria-label="Imagem da notificação">
                        <button type="button" aria-pressed={notif.imagemModo === "capa"} onClick={() => setNotif(n => ({ ...n, imagemModo: "capa" }))}>Capa da notícia</button>
                        <button type="button" aria-pressed={notif.imagemModo === "custom"} onClick={() => notif.imagemUrl ? setNotif(n => ({ ...n, imagemModo: "custom" })) : notifImgRef.current?.click()}>
                          {uploadingNotifImg ? "Enviando..." : "Outra imagem"}
                        </button>
                        <button type="button" aria-pressed={notif.imagemModo === "nenhuma"} onClick={() => setNotif(n => ({ ...n, imagemModo: "nenhuma" }))}>Sem imagem</button>
                      </div>
                      {notif.imagemModo === "custom" && notif.imagemUrl && (
                        <Botao variante="link" tamanho="p" onClick={() => notifImgRef.current?.click()}>Trocar imagem</Botao>
                      )}
                      <input ref={notifImgRef} type="file" accept="image/*" hidden onChange={uploadNotifImg} />
                    </div>
                  </div>
                )}

                {/* Prévia (estilo Android) */}
                <div className="an-notif-prev" aria-label="Prévia da notificação">
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
      </Janela>
    </div>
  );
}
