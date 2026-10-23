import { useState, useEffect, useRef } from "react";
import { useRecorte } from "@/components/ui/useRecorte";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, DotsThreeVertical, Image as ImageIcon, Info, PencilSimple, Plus, SquaresFour, Trash, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { explicarErro } from "@/lib/erros";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_CATEGORIAS, TOUR_CATEGORIAS } from "@/lib/comoTelas";
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

function Icone({ src, grande, foto }: { src?: string; grande?: boolean; foto?: boolean }) {
  return (
    <span className={`ct-ic${grande ? " g" : ""}${foto ? " foto" : ""}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : <SquaresFour size={grande ? 28 : 22} weight="bold" />}
    </span>
  );
}

export default function Categorias() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<{ categoria: string; imagem_url?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Categoria>({ nome: "", imagem_url: "", ordem: 0 });
  const [saving, setSaving] = useState(false);
  const [showGaleria, setShowGaleria] = useState(false);
  const [menuDe, setMenuDe] = useState<Categoria | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  // (11/10) a lista não carregou: mostra o erro com "Tentar de novo" em vez de "Nenhuma categoria ainda"
  const [erroCarga, setErroCarga] = useState("");
  const carregar = async () => {
    setLoading(true); setErroCarga("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErroCarga("Tente de novo em instantes."); setLoading(false); return; }
      setUserId(user.id);
      const [erroCat, erroProd] = await Promise.all([loadCategorias(user.id), loadProdutos(user.id)]);
      // sem a lista de produtos a contagem de cada categoria ficaria errada ("Nenhum produto"): também é erro de carga
      if (erroCat || erroProd) setErroCarga(explicarErro(erroCat || erroProd, "Tente de novo em instantes."));
    } catch (e) {
      setErroCarga(explicarErro(e, "Tente de novo em instantes."));
    }
    setLoading(false);
  };
  useEffect(() => { void carregar(); }, []);

  // As duas leituras devolvem o erro (null = leu). Se falhar, o que está na tela continua como estava.
  const loadCategorias = async (uid: string): Promise<unknown> => {
    const { data, error } = await supabase.from("categorias").select("*").eq("user_id", uid).order("ordem").order("nome");
    if (data && !error) setCategorias(data);
    return error || (data ? null : new Error("sem dados"));
  };

  const loadProdutos = async (uid: string): Promise<unknown> => {
    const { data, error } = await supabase.from("produtos").select("categoria, imagem_url").eq("user_id", uid).order("created_at");
    if (data && !error) setProdutos(data);
    return error || (data ? null : new Error("sem dados"));
  };

  const contarProdutos = (nome: string) => produtos.filter(p => p.categoria === nome).length;
  // (22/10) categoria sem imagem: mostra a foto do primeiro produto dela (quem escolheu ícone ou imagem continua com o seu)
  const [cel] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches) // só no celular
  const fotoDe = (nome: string) => (cel ? produtos.find(p => p.categoria === nome && p.imagem_url)?.imagem_url || undefined : undefined);

  const openNova = () => { setForm({ nome: "", imagem_url: "", ordem: categorias.length }); setShowGaleria(false); setModal(true); };
  const openEditar = (c: Categoria) => { setForm({ ...c }); setShowGaleria(false); setModal(true); };
  const fecharModal = () => { setModal(false); setShowGaleria(false); setForm({ nome: "", imagem_url: "", ordem: 0 }); };

  const handleImageUpload = async (file: File) => {
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
  const recorte = useRecorte(f => { void handleImageUpload(f); }, { forma: "rect" });

  const handleSalvar = async () => {
    const novo = form.nome.trim();
    if (!novo) return avisar("Escreva o nome da categoria", { tipo: "erro" });
    // 10/10: nome repetido não salva (os produtos guardam o NOME da categoria: duas iguais se misturavam)
    if (categorias.some(c => c.id !== form.id && c.nome.trim().toLowerCase() === novo.toLowerCase())) {
      return avisar("Já existe uma categoria com esse nome", { tipo: "erro" });
    }
    setSaving(true);
    // 10/10: confere o erro de cada gravação (antes fechava a janela como se tivesse salvado)
    const falhou = (err: unknown) => {
      setSaving(false);
      // (4.24) o banco não deixa duas categorias com o mesmo nome
      if ((err as { code?: string } | null)?.code === "23505") { avisar("Já existe uma categoria com esse nome", { tipo: "erro" }); return; }
      avisar(explicarErro(err, "Não deu pra salvar a categoria. Tente de novo."), { tipo: "erro" });
    };
    if (form.id) {
      const antigo = categorias.find(c => c.id === form.id)?.nome;
      const { error } = await supabase.from("categorias").update({ nome: novo, imagem_url: form.imagem_url || null, ordem: form.ordem }).eq("id", form.id);
      if (error) return falhou(error);
      // Os produtos guardam o NOME da categoria: renomeou, eles acompanham (antes ficavam numa categoria que não existia mais)
      if (antigo && antigo !== novo) {
        const { error: errProd } = await supabase.from("produtos").update({ categoria: novo }).eq("user_id", userId).eq("categoria", antigo);
        if (errProd) {
          // Os produtos não acompanharam: desfaz o nome pra eles não ficarem numa categoria que não existe
          const { error: errVolta } = await supabase.from("categorias").update({ nome: antigo }).eq("id", form.id);
          if (errVolta) {
            // 11/10: nem o desfazer gravou. A categoria ficou com o nome novo e os produtos com o antigo.
            // A janela fica aberta e a lista continua com o nome antigo: salvar de novo leva os produtos junto.
            console.error("[Doonly]", errVolta);
            setSaving(false);
            avisar("A categoria mudou de nome, mas os produtos não acompanharam. Toque em Salvar de novo.", { tipo: "erro" });
            return;
          }
          await loadCategorias(userId);
          return falhou(errProd);
        }
        await loadProdutos(userId);
      }
    } else {
      const { error } = await supabase.from("categorias").insert({ nome: novo, imagem_url: form.imagem_url || null, ordem: form.ordem, user_id: userId });
      if (error) return falhou(error);
    }
    await loadCategorias(userId);
    setSaving(false);
    fecharModal();
  };

  // Excluir: com produtos dentro não deixa (os produtos ficariam sem categoria e sumiriam do cardápio)
  const handleDelete = async (cat: Categoria) => {
    // 11/10: conta os produtos no banco na hora. A contagem da tela vinha de uma leitura que podia ter falhado
    // (dava 0 e deixava excluir categoria com produtos). Se não der pra contar, não exclui.
    const { count, error: erroContar } = await supabase.from("produtos").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("categoria", cat.nome);
    if (erroContar || count == null) {
      avisar(explicarErro(erroContar, "Não deu pra conferir os produtos da categoria. Tente de novo."), { tipo: "erro" });
      return;
    }
    const qtd = count;
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

  // 11/10: a ordem é gravada numa fila (uma gravação por vez, na ordem dos toques) e cada gravação é conferida.
  // Antes cada toque disparava todas as gravações juntas, sem conferir: dois toques seguidos podiam gravar a ordem misturada.
  const filaOrdem = useRef<Promise<void>>(Promise.resolve());
  const vezOrdem = useRef(0); // muda quando uma gravação falha: o que estava na fila não é mais gravado
  const moverOrdem = (id: string, dir: -1 | 1) => {
    const idx = categorias.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categorias.length) return;
    const updated = [...categorias];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    const nova = updated.map((c, i) => ({ ...c, ordem: i }));
    setCategorias(nova);
    // só o que mudou de posição
    const mudaram = nova.filter(c => c.id && categorias.find(x => x.id === c.id)?.ordem !== c.ordem).map(c => ({ id: c.id!, ordem: c.ordem }));
    const vez = vezOrdem.current;
    filaOrdem.current = filaOrdem.current.then(async () => {
      if (vez !== vezOrdem.current) return;
      try {
        for (const m of mudaram) {
          const { error } = await supabase.from("categorias").update({ ordem: m.ordem }).eq("id", m.id);
          if (error) throw error;
        }
      } catch (e) {
        vezOrdem.current++;
        avisar(explicarErro(e, "Não deu pra salvar a ordem. Tente de novo."), { tipo: "erro" });
        if (userId) await loadCategorias(userId); // volta a mostrar a ordem que está gravada
      }
    });
  };

  const qtdTexto = (q: number) => q === 0 ? "Nenhum produto" : `${q} ${q === 1 ? "produto" : "produtos"}`;
  const idxMenu = menuDe ? categorias.findIndex(c => c.id === menuDe.id) : -1;
  const nomeOriginal = form.id ? categorias.find(c => c.id === form.id)?.nome : undefined;
  const qtdOriginal = nomeOriginal ? contarProdutos(nomeOriginal) : 0;
  const mudouNome = !!nomeOriginal && form.nome.trim() !== "" && form.nome.trim() !== nomeOriginal;

  return (
    <>
      <AppPageHeader title="Categorias" voltar="/cadastros" subtitle="Organize os produtos do seu cardápio" infoComo={COMO_CATEGORIAS} infoTour={TOUR_CATEGORIAS}
        infoContent={<>
          <p>As categorias <strong>separam os produtos no seu cardápio</strong>, como Bolos, Doces e Salgados.</p>
          <p>O cliente acha o que quer mais rápido. O cardápio mostra as categorias na ordem desta lista.</p>
        </>}
        infoTip={<>Cada produto fica em uma categoria. Você escolhe a categoria no cadastro do produto.</>} />
      <div className="ct">
        <div className="ct-abas" role="tablist" aria-label="Catálogo">
          <button type="button" role="tab" aria-selected="false" onClick={() => navigate("/produtos")}>Produtos</button>
          <button type="button" role="tab" aria-selected="true">Categorias</button>
        </div>

        {loading ? (
          <div className="ct-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
        ) : erroCarga ? (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu pra carregar as categorias" texto={erroCarga}
            acao={<Botao onClick={() => void carregar()}>Tentar de novo</Botao>} />
        ) : categorias.length === 0 ? (
          <TelaVazia caixa icone={<SquaresFour size={30} />} titulo="Nenhuma categoria ainda"
            texto='Crie categorias como "Bolos", "Doces" e "Salgados". No cardápio, o cliente acha o que quer mais rápido.'
            acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={openNova}>Criar categoria</Botao>} />
        ) : (<>
          <Titulo contagem={categorias.length} apoio="O cardápio mostra as categorias nesta ordem."
            acao={<Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={openNova}><span className="ct-g">Nova categoria</span><span className="ct-c">Nova</span></Botao>}>Suas categorias</Titulo>
          <section className="ct-card">
            {categorias.map(cat => (
              <div key={cat.id} className="ct-row">
                <button type="button" className="ct-row-b" onClick={() => openEditar(cat)}>
                  <Icone src={cat.imagem_url || fotoDe(cat.nome)} foto={!cat.imagem_url && !!fotoDe(cat.nome)} />
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
          <Campo rotulo="Nome" obrigatorio placeholder="Ex.: bolos, doces, salgados" value={form.nome} maxLength={40}
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
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={recorte.escolher} />
      {recorte.janela}
          </div>
        </div>
      </Janela>
    </>
  );
}
