import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, DotsThreeVertical, Image as ImageIcon, Info, PencilSimple, Plus, SquaresFour, Trash, UploadSimple } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, BotaoIcone, Campo, Janela, TelaVazia, Titulo, avisar, confirmar, informar } from "@/components/base";
import "./categorias.css";

/**
 * Categorias (08/10 · 3.23, no padrão do guia).
 * Uma tela só: a aba "Categorias" de Produtos abre esta mesma tela (/categorias).
 * No celular e no tablet ela mostra as abas Produtos | Categorias no topo.
 * O que faz continua igual: criar, editar (renomear leva os produtos junto), subir/descer na ordem,
 * excluir só sem produtos, enviar imagem ou escolher um ícone pronto.
 */

type Categoria = {
  id?: string;
  user_id?: string;
  nome: string;
  imagem_url?: string;
  ordem?: number;
};

// Ícones prontos (os repetidos da pasta ficam de fora da galeria; categoria antiga com eles continua mostrando)
const ICONES_PRONTOS = [28, 1, 3, 10, 2, 14, 20, 25, 26, 27, 31, 32, 33, 34, 29, 35, 36, 37, 6, 9, 30, 38, 39, 40, 5, 8, 12].map(n => `/categoriaicones/icone (${n}).png`);

function Icone({ src, grande }: { src?: string; grande?: boolean }) {
  return (
    <span className={`ct-ic${grande ? " g" : ""}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : <SquaresFour size={grande ? 28 : 22} weight="bold" />}
    </span>
  );
}

export default function Categorias() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<{ categoria: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Categoria>({ nome: "", imagem_url: "", ordem: 0 });
  const [saving, setSaving] = useState(false);
  const [showGaleria, setShowGaleria] = useState(false);
  const [menuDe, setMenuDe] = useState<Categoria | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await Promise.all([loadCategorias(user.id), loadProdutos(user.id)]);
      setLoading(false);
    };
    load();
  }, []);

  const loadCategorias = async (uid: string) => {
    const { data } = await supabase.from("categorias").select("*").eq("user_id", uid).order("ordem").order("nome");
    if (data) setCategorias(data);
  };

  const loadProdutos = async (uid: string) => {
    const { data } = await supabase.from("produtos").select("categoria").eq("user_id", uid);
    if (data) setProdutos(data);
  };

  const contarProdutos = (nome: string) => produtos.filter(p => p.categoria === nome).length;

  const openNova = () => { setForm({ nome: "", imagem_url: "", ordem: categorias.length }); setShowGaleria(false); setModal(true); };
  const openEditar = (c: Categoria) => { setForm({ ...c }); setShowGaleria(false); setModal(true); };
  const fecharModal = () => { setModal(false); setShowGaleria(false); setForm({ nome: "", imagem_url: "", ordem: 0 }); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading("img");
    const ext = file.name.split(".").pop();
    const path = `categorias/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      setForm(f => ({ ...f, imagem_url: data.publicUrl }));
    } else avisar("Não deu pra enviar a imagem. Tente de novo.", { tipo: "erro" });
    if (imgRef.current) imgRef.current.value = "";
    setUploading(null);
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) return avisar("Escreva o nome da categoria", { tipo: "erro" });
    setSaving(true);
    if (form.id) {
      const antigo = categorias.find(c => c.id === form.id)?.nome;
      const novo = form.nome.trim();
      await supabase.from("categorias").update({ nome: novo, imagem_url: form.imagem_url || null, ordem: form.ordem }).eq("id", form.id);
      // Os produtos guardam o NOME da categoria: renomeou, eles acompanham (antes ficavam numa categoria que não existia mais)
      if (antigo && antigo !== novo) {
        await supabase.from("produtos").update({ categoria: novo }).eq("user_id", userId).eq("categoria", antigo);
        await loadProdutos(userId);
      }
    } else {
      await supabase.from("categorias").insert({ nome: form.nome, imagem_url: form.imagem_url || null, ordem: form.ordem, user_id: userId });
    }
    await loadCategorias(userId);
    setSaving(false);
    fecharModal();
  };

  // Excluir: com produtos dentro não deixa (os produtos ficariam sem categoria e sumiriam do cardápio)
  const handleDelete = async (cat: Categoria) => {
    const qtd = contarProdutos(cat.nome);
    if (qtd > 0) {
      await informar({ titulo: `${cat.nome} tem ${qtd} ${qtd === 1 ? "produto" : "produtos"}`, texto: `Mova ${qtd === 1 ? "o produto" : "os produtos"} pra outra categoria antes de excluir. Senão ${qtd === 1 ? "ele some" : "eles somem"} do cardápio.`, icone: "alerta" });
      return;
    }
    const ok = await confirmar({ titulo: `Excluir a categoria ${cat.nome}?`, texto: "Ela sai do cardápio. Não dá pra desfazer.", rotulo: "Excluir", rotuloVoltar: "Cancelar", perigo: true });
    if (!ok) return;
    const { error } = await supabase.from("categorias").delete().eq("id", cat.id!);
    if (error) { avisar("Não deu pra excluir. Tente de novo.", { tipo: "erro" }); return; }
    setCategorias(c => c.filter(x => x.id !== cat.id));
    avisar("Categoria excluída", { tipo: "ok" });
  };

  const moverOrdem = async (id: string, dir: -1 | 1) => {
    const idx = categorias.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categorias.length) return;
    const updated = [...categorias];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updated.forEach((c, i) => c.ordem = i);
    setCategorias(updated);
    await Promise.all(updated.map(c => supabase.from("categorias").update({ ordem: c.ordem }).eq("id", c.id!)));
  };

  const qtdTexto = (q: number) => q === 0 ? "Nenhum produto" : `${q} ${q === 1 ? "produto" : "produtos"}`;
  const idxMenu = menuDe ? categorias.findIndex(c => c.id === menuDe.id) : -1;
  const nomeOriginal = form.id ? categorias.find(c => c.id === form.id)?.nome : undefined;
  const qtdOriginal = nomeOriginal ? contarProdutos(nomeOriginal) : 0;
  const mudouNome = !!nomeOriginal && form.nome.trim() !== "" && form.nome.trim() !== nomeOriginal;

  return (
    <>
      <AppPageHeader title="Categorias" subtitle="Separam os produtos no seu cardápio" />
      <div className="ct">
        <div className="ct-abas" role="tablist" aria-label="Catálogo">
          <button type="button" role="tab" aria-selected="false" onClick={() => navigate("/produtos")}>Produtos</button>
          <button type="button" role="tab" aria-selected="true">Categorias</button>
        </div>

        {loading ? (
          <div className="ct-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
        ) : categorias.length === 0 ? (
          <TelaVazia caixa icone={<SquaresFour size={30} />} titulo="Nenhuma categoria ainda"
            texto='Crie categorias como "Bolos", "Docinhos" e "Salgados". No cardápio, o cliente acha o que quer mais rápido.'
            acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={openNova}>Criar categoria</Botao>} />
        ) : (<>
          <Titulo contagem={categorias.length} apoio="O cardápio mostra as categorias nesta ordem."
            acao={<Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={openNova}><span className="ct-g">Nova categoria</span><span className="ct-c">Nova</span></Botao>}>Suas categorias</Titulo>
          <section className="ct-card">
            {categorias.map(cat => (
              <div key={cat.id} className="ct-row">
                <button type="button" className="ct-row-b" onClick={() => openEditar(cat)}>
                  <Icone src={cat.imagem_url} />
                  <span className="ct-row-tx"><b>{cat.nome}</b><small>{qtdTexto(contarProdutos(cat.nome))}</small></span>
                </button>
                <BotaoIcone rotulo={`Opções de ${cat.nome}`} variante="limpo" onClick={() => setMenuDe(cat)}><DotsThreeVertical size={20} weight="bold" /></BotaoIcone>
              </div>
            ))}
          </section>
          <p className="ct-dica"><Info size={20} weight="bold" aria-hidden="true" />Produto sem categoria só aparece em "Todos" no cardápio.</p>
        </>)}
      </div>

      {/* menu da categoria */}
      <Janela aberta={!!menuDe} aoFechar={() => setMenuDe(null)} tipo="conteudo" titulo={menuDe?.nome || ""}>
        {menuDe && (
          <div className="ct-menu">
            <button type="button" onClick={() => { const c = menuDe; setMenuDe(null); openEditar(c); }}><PencilSimple size={20} weight="bold" />Editar</button>
            <button type="button" disabled={idxMenu <= 0} onClick={() => { moverOrdem(menuDe.id!, -1); setMenuDe(null); }}><ArrowUp size={20} weight="bold" />Subir na ordem</button>
            <button type="button" disabled={idxMenu < 0 || idxMenu >= categorias.length - 1} onClick={() => { moverOrdem(menuDe.id!, 1); setMenuDe(null); }}><ArrowDown size={20} weight="bold" />Descer na ordem</button>
            <button type="button" className="perigo" onClick={() => { const c = menuDe; setMenuDe(null); handleDelete(c); }}><Trash size={20} weight="bold" />Excluir</button>
          </div>
        )}
      </Janela>

      {/* nova / editar */}
      <Janela aberta={modal} aoFechar={fecharModal} tipo="conteudo" travada titulo={form.id ? "Editar categoria" : "Nova categoria"}
        acoes={<><Botao variante="secundario" onClick={fecharModal}>Cancelar</Botao><Botao onClick={handleSalvar} carregando={saving}>{form.id ? "Salvar" : "Criar categoria"}</Botao></>}>
        <div className="ct-form">
          <Campo rotulo="Nome" obrigatorio placeholder="Ex.: Bolos, Docinhos, Salgados" value={form.nome} maxLength={40}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          {mudouNome && qtdOriginal > 0 && <p className="ct-aviso-nome">{qtdOriginal === 1 ? `O produto de ${nomeOriginal} muda junto.` : `Os ${qtdOriginal} produtos de ${nomeOriginal} mudam junto.`}</p>}
          <div className="ui-campo">
            <span className="ui-campo-r"><span>Ícone</span><small>opcional</small></span>
            <div className="ct-esc">
              <Icone src={form.imagem_url} grande />
              <div>
                <b>{form.imagem_url ? "Ícone escolhido" : "Nenhum ícone escolhido"}</b>
                <small>Aparece em cima do nome no cardápio</small>
                {form.imagem_url && <Botao variante="link" tamanho="p" onClick={() => setForm(f => ({ ...f, imagem_url: "" }))}>Tirar o ícone</Botao>}
              </div>
            </div>
            <div className="ct-abas ct-abas--janela" role="tablist" aria-label="De onde vem o ícone">
              <button type="button" role="tab" aria-selected={!showGaleria} onClick={() => setShowGaleria(false)}><UploadSimple size={20} weight="bold" />Enviar imagem</button>
              <button type="button" role="tab" aria-selected={showGaleria} onClick={() => setShowGaleria(true)}><ImageIcon size={20} weight="bold" />Ícones prontos</button>
            </div>
            {showGaleria ? (
              <div className="ct-gal">
                {ICONES_PRONTOS.map((src, i) => (
                  <button key={src} type="button" aria-pressed={form.imagem_url === src} aria-label={`Ícone ${i + 1}`} onClick={() => setForm(f => ({ ...f, imagem_url: src }))}>
                    <img src={src} alt="" onError={e => { e.currentTarget.parentElement!.style.display = "none"; }} />
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" className="ct-up" onClick={() => !uploading && imgRef.current?.click()} disabled={!!uploading}>
                {uploading ? <span className="ui-gira" aria-label="Enviando" /> : <><UploadSimple size={24} weight="bold" /><b>Escolher imagem</b><small>PNG com fundo transparente fica melhor</small></>}
              </button>
            )}
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
          </div>
        </div>
      </Janela>
    </>
  );
}
