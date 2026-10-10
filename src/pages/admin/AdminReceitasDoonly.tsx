import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Botao, BotaoIcone, Campo, CampoArea, Janela, TelaVazia, Titulo, confirmar, informar } from "@/components/base";
import { ArrowDown, ArrowUp, Cake, Camera, Medal, PencilSimple, Plus, SquaresFour, Trash } from "@phosphor-icons/react";
import "./adminReceitasDoonly.css";

const emptyForm = { nome: "", categoria: "", ingredientes: "", modo_preparo: "", foto_url: "" };

export default function AdminReceitasDoonly() {
  const [receitas, setReceitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Categorias (cartões da tela de Receitas do app) ──
  const [categorias, setCategorias] = useState<any[]>([]);
  const [novaCat, setNovaCat] = useState("");
  const [enviandoCat, setEnviandoCat] = useState<string | null>(null);
  const catFileRef = useRef<HTMLInputElement>(null);
  const catAlvo = useRef<string | null>(null);
  const loadCategorias = async () => {
    const { data } = await supabase.from("receitas_categorias").select("*").order("ordem", { ascending: true });
    setCategorias(data || []);
  };
  const addCategoria = async () => {
    const nome = novaCat.trim();
    if (!nome) return;
    const ordem = (categorias.reduce((m, c) => Math.max(m, c.ordem || 0), 0) || 0) + 1;
    await supabase.from("receitas_categorias").insert({ nome, ordem });
    setNovaCat(""); loadCategorias();
  };
  const moverCategoria = async (id: string, dir: -1 | 1) => {
    const i = categorias.findIndex(c => c.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= categorias.length) return;
    const a = categorias[i], b = categorias[j];
    await Promise.all([
      supabase.from("receitas_categorias").update({ ordem: b.ordem ?? j }).eq("id", a.id),
      supabase.from("receitas_categorias").update({ ordem: a.ordem ?? i }).eq("id", b.id),
    ]);
    loadCategorias();
  };
  const escolherFotoCategoria = (id: string) => { catAlvo.current = id; catFileRef.current?.click(); };
  const handleFotoCategoria = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; const id = catAlvo.current;
    e.target.value = "";
    if (!file || !id) return;
    setEnviandoCat(id);
    const path = `receitas-categorias/${id}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      await supabase.from("receitas_categorias").update({ imagem_url: data.publicUrl }).eq("id", id);
      loadCategorias();
    }
    setEnviandoCat(null);
  };
  const tirarFotoCategoria = async (id: string) => { await supabase.from("receitas_categorias").update({ imagem_url: null }).eq("id", id); loadCategorias(); };
  const apagarCategoria = async (c: any) => {
    const usadas = receitas.filter(r => r.categoria === c.nome).length;
    if (usadas > 0) { await informar({ titulo: `"${c.nome}" ainda tem receitas`, texto: `São ${usadas} receita${usadas === 1 ? "" : "s"} nela. Troque a categoria delas antes de apagar.`, icone: "alerta" }); return; }
    if (!(await confirmar({ titulo: `Apagar a categoria "${c.nome}"?`, texto: "Ela sai da tela de Receitas do app.", rotulo: "Apagar", perigo: true }))) return;
    await supabase.from("receitas_categorias").delete().eq("id", c.id); loadCategorias();
  };

  useEffect(() => { load(); loadCategorias(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("receitas_doonly").select("*").order("created_at", { ascending: false });
    setReceitas(data || []);
    setLoading(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const path = `receitas-doonly/${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, foto_url: data.publicUrl }));
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    if (editId) await supabase.from("receitas_doonly").update(form).eq("id", editId);
    else await supabase.from("receitas_doonly").insert(form);
    await load();
    setShowForm(false); setForm(emptyForm); setEditId(null); setPreview(null); setSaving(false);
  };

  const handleEdit = (r: any) => {
    setForm({ nome: r.nome, categoria: r.categoria, ingredientes: r.ingredientes, modo_preparo: r.modo_preparo, foto_url: r.foto_url || "" });
    setPreview(r.foto_url || null);
    setEditId(r.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmar({ titulo: "Excluir esta receita?", texto: "Ela some do app e não dá pra desfazer.", rotulo: "Excluir", perigo: true }))) return;
    await supabase.from("receitas_doonly").delete().eq("id", id);
    load();
  };

  const novaReceita = () => { setForm(emptyForm); setPreview(null); setEditId(null); setShowForm(true); };

  return (
    <div className="ard">
      <Titulo
        nivel="tela"
        apoio="Receitas conferidas pela equipe Doonly."
        acao={<Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={novaReceita}>Nova receita</Botao>}
      >
        Receitas Doonly
      </Titulo>

      {/* Categorias: aparecem como cartões na tela de Receitas do app */}
      <section className="ard-cat">
        <Titulo nivel="secao" apoio="Aparecem como cartões na tela de Receitas. Sem foto, o app usa a cor e o desenho.">Categorias</Titulo>
        <div className="ard-cat-add">
          <input
            placeholder="Nova categoria"
            aria-label="Nome da nova categoria"
            value={novaCat}
            onChange={e => setNovaCat(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addCategoria(); }}
          />
          <Botao variante="secundario" icone={<Plus size={20} weight="bold" />} onClick={addCategoria}>Adicionar</Botao>
        </div>
        <input ref={catFileRef} type="file" accept="image/*" onChange={handleFotoCategoria} style={{ display: "none" }} />
        <div className="ard-cat-lista">
          {categorias.map((c, i) => {
            const qtd = receitas.filter(r => r.categoria === c.nome).length;
            return (
              <div key={c.id} className="ard-cat-l">
                <button type="button" className="ard-cat-foto" onClick={() => escolherFotoCategoria(c.id)} aria-label={`Trocar a foto de ${c.nome}`} title="Trocar foto">
                  {c.imagem_url ? <img src={c.imagem_url} alt="" /> : enviandoCat === c.id ? <span className="ui-gira" aria-hidden="true" /> : <><Camera size={18} weight="bold" /><span>Foto</span></>}
                </button>
                <div className="ard-cat-tx">
                  <b>{c.nome}</b>
                  <small>{qtd} receita{qtd === 1 ? "" : "s"}{qtd === 0 ? " · não aparece no app" : ""}</small>
                </div>
                <div className="ard-cat-acoes">
                  <BotaoIcone rotulo="Subir" variante="limpo" onClick={() => moverCategoria(c.id, -1)} disabled={i === 0}><ArrowUp size={20} weight="bold" /></BotaoIcone>
                  <BotaoIcone rotulo="Descer" variante="limpo" onClick={() => moverCategoria(c.id, 1)} disabled={i === categorias.length - 1}><ArrowDown size={20} weight="bold" /></BotaoIcone>
                  {c.imagem_url && <Botao variante="secundario" tamanho="m" onClick={() => tirarFotoCategoria(c.id)}>Tirar foto</Botao>}
                  <BotaoIcone rotulo={`Apagar ${c.nome}`} variante="limpo" className="ard-apagar" onClick={() => apagarCategoria(c)}><Trash size={20} weight="bold" /></BotaoIcone>
                </div>
              </div>
            );
          })}
          {categorias.length === 0 && (
            <TelaVazia compacta icone={<SquaresFour size={26} />} titulo="Nenhuma categoria ainda" texto="Rode o SQL receitas_categorias.sql no Supabase." />
          )}
        </div>
      </section>

      {loading ? <p className="ard-carregando">Carregando…</p> : receitas.length === 0 ? (
        <TelaVazia
          caixa
          icone={<Cake size={30} />}
          titulo="Nenhuma receita Doonly ainda"
          texto="Publique a primeira e ela aparece pra todas as confeiteiras."
          acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={novaReceita}>Nova receita</Botao>}
        />
      ) : (
        <div className="ard-grade">
          {receitas.map(r => (
            <div key={r.id} className="ard-card">
              <div className="ard-foto">
                {r.foto_url ? <img src={r.foto_url} alt="" /> : <Cake size={36} />}
                <span className="ard-selo"><Medal size={14} weight="bold" aria-hidden="true" />Verificada</span>
              </div>
              <div className="ard-corpo">
                <b>{r.nome}</b>
                <small>{r.categoria || "Sem categoria"}</small>
              </div>
              <div className="ard-card-acoes">
                <Botao variante="secundario" tamanho="m" cheio icone={<PencilSimple size={18} weight="bold" />} onClick={() => handleEdit(r)}>Editar</Botao>
                <BotaoIcone rotulo={`Excluir ${r.nome}`} className="ard-apagar" onClick={() => handleDelete(r.id)}><Trash size={20} weight="bold" /></BotaoIcone>
              </div>
            </div>
          ))}
        </div>
      )}

      <Janela
        aberta={showForm}
        aoFechar={() => setShowForm(false)}
        tipo="conteudo"
        travada
        titulo={editId ? "Editar receita" : "Nova receita"}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setShowForm(false)}>Cancelar</Botao>
            <Botao onClick={handleSave} carregando={saving} disabled={!form.nome.trim()}>{editId ? "Salvar" : "Publicar"}</Botao>
          </>
        }
      >
        <div className="ard-form">
          <button type="button" className="ard-form-foto" onClick={() => fileRef.current?.click()}>
            {preview ? <img src={preview} alt="" /> : <><Camera size={24} /><span>Adicionar foto</span></>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <Campo rotulo="Nome da receita" placeholder="Ex.: Brigadeiro gourmet" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          <Campo rotulo="Categoria" list="ard-cats" placeholder="Ex.: Bolos, Recheios" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
          <datalist id="ard-cats">{categorias.map(c => <option key={c.id} value={c.nome} />)}</datalist>
          <CampoArea rotulo="Ingredientes" rows={3} placeholder="Um ingrediente por linha" value={form.ingredientes} onChange={e => setForm({ ...form, ingredientes: e.target.value })} />
          <CampoArea rotulo="Modo de preparo" rows={4} placeholder="Conte o passo a passo" value={form.modo_preparo} onChange={e => setForm({ ...form, modo_preparo: e.target.value })} />
        </div>
      </Janela>
    </div>
  );
}
