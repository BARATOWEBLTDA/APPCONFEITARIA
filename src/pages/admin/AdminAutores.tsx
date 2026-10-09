import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, PencilSimple, Trash, User, Image as ImageIcon, Eye, EyeSlash, DotsThree } from "@phosphor-icons/react";
import { Botao, BotaoIcone, Campo, CampoArea, Janela, TelaVazia, Titulo, avisar, confirmar } from "@/components/base";
import "./admin-autores.css";

interface Autor {
  id: string;
  nome: string;
  cargo: string | null;
  foto_url: string | null;
  bio: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

export default function AdminAutores() {
  const [autores, setAutores] = useState<Autor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Autor | null>(null);
  const [menuDe, setMenuDe] = useState<Autor | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [form, setForm] = useState({ nome: "", cargo: "", foto_url: "", bio: "", ativo: true, ordem: 0 });

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_autores").select("*").order("ordem", { ascending: true }).order("created_at", { ascending: false });
    setAutores((data as Autor[]) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const showMsg = (txt: string, tipo: "ok" | "err" = "ok") => {
    avisar(txt, { tipo: tipo === "err" ? "erro" : "ok" });
  };

  const abrirNovo = () => {
    setEditing(null);
    setForm({ nome: "", cargo: "", foto_url: "", bio: "", ativo: true, ordem: 0 });
    setModalOpen(true);
  };

  const abrirEditar = (a: Autor) => {
    setEditing(a);
    setForm({ nome: a.nome, cargo: a.cargo || "", foto_url: a.foto_url || "", bio: a.bio || "", ativo: a.ativo, ordem: a.ordem });
    setModalOpen(true);
  };

  const uploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `autor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("autores-fotos").upload(fileName, file, { cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("autores-fotos").getPublicUrl(fileName);
      setForm(f => ({ ...f, foto_url: data.publicUrl }));
    } catch (err: any) {
      showMsg("Erro upload: " + err.message, "err");
    }
    setUploadingFoto(false);
    e.target.value = "";
  };

  const salvar = async () => {
    if (!form.nome.trim()) return showMsg("Preencha o nome.", "err");
    const payload = {
      nome: form.nome.trim(),
      cargo: form.cargo.trim() || null,
      foto_url: form.foto_url || null,
      bio: form.bio.trim() || null,
      ativo: form.ativo,
      ordem: form.ordem,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from("admin_autores").update(payload).eq("id", editing.id);
      if (error) return showMsg("Erro: " + error.message, "err");
    } else {
      const { error } = await supabase.from("admin_autores").insert(payload);
      if (error) return showMsg("Erro: " + error.message, "err");
    }
    setModalOpen(false);
    carregar();
    showMsg(editing ? "Atualizado!" : "Autor criado!");
  };

  const excluir = async (a: Autor) => {
    if (!(await confirmar({ titulo: `Excluir ${a.nome}?`, texto: "As notícias dele ficam sem autor.", rotulo: "Excluir", perigo: true }))) return;
    const { error } = await supabase.from("admin_autores").delete().eq("id", a.id);
    if (error) return showMsg("Erro: " + error.message, "err");
    carregar();
    showMsg("Autor excluído");
  };

  const toggleAtivo = async (a: Autor) => {
    await supabase.from("admin_autores").update({ ativo: !a.ativo }).eq("id", a.id);
    carregar();
  };

  const fecharModal = () => setModalOpen(false);

  return (
    <div className="aa-root">
      <Titulo nivel="tela" contagem={autores.length || undefined} apoio="Quem assina as notícias."
        acao={autores.length > 0 ? <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={abrirNovo}><span className="aa-g">Novo autor</span><span className="aa-c">Novo</span></Botao> : undefined}>
        Autores
      </Titulo>

      {loading ? (
        <div className="aa-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
      ) : autores.length === 0 ? (
        <TelaVazia caixa icone={<User size={30} />} titulo="Nenhum autor ainda"
          texto="Cadastre quem escreve as notícias pra escolher na hora de publicar."
          acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={abrirNovo}>Cadastrar autor</Botao>} />
      ) : (
        <section className="aa-card">
          {autores.map(a => (
            <div key={a.id} className={`aa-row${!a.ativo ? " aa-row--off" : ""}`}>
              <button type="button" className="aa-row-b" onClick={() => abrirEditar(a)}>
                <span className="aa-av">{a.foto_url ? <img src={a.foto_url} alt="" /> : a.nome.charAt(0).toUpperCase()}</span>
                <span className="aa-row-tx">
                  <b>{a.nome}</b>
                  {a.cargo && <small>{a.cargo}</small>}
                  {a.bio && <small className="aa-bio">{a.bio}</small>}
                  {!a.ativo && <i className="aa-tag">Inativo</i>}
                </span>
              </button>
              <div className="aa-acoes">
                <BotaoIcone rotulo={a.ativo ? "Desativar" : "Ativar"} variante="limpo" onClick={() => toggleAtivo(a)}>{a.ativo ? <Eye size={20} weight="bold" /> : <EyeSlash size={20} weight="bold" />}</BotaoIcone>
                <BotaoIcone rotulo="Editar" variante="limpo" onClick={() => abrirEditar(a)}><PencilSimple size={20} weight="bold" /></BotaoIcone>
                <BotaoIcone rotulo="Excluir" variante="limpo" className="aa-perigo" onClick={() => excluir(a)}><Trash size={20} weight="bold" /></BotaoIcone>
              </div>
              <BotaoIcone className="aa-mais" rotulo={`Opções de ${a.nome}`} variante="limpo" onClick={() => setMenuDe(a)}><DotsThree size={22} weight="bold" /></BotaoIcone>
            </div>
          ))}
        </section>
      )}

      {/* menu do autor (celular) */}
      <Janela aberta={!!menuDe} aoFechar={() => setMenuDe(null)} tipo="conteudo" titulo={menuDe?.nome || ""}>
        {menuDe && (
          <div className="aa-menu">
            <button type="button" onClick={() => { const a = menuDe; setMenuDe(null); abrirEditar(a); }}><PencilSimple size={20} weight="bold" />Editar</button>
            <button type="button" onClick={() => { const a = menuDe; setMenuDe(null); toggleAtivo(a); }}>
              {menuDe.ativo ? <><EyeSlash size={20} weight="bold" />Desativar</> : <><Eye size={20} weight="bold" />Ativar</>}
            </button>
            <button type="button" className="perigo" onClick={() => { const a = menuDe; setMenuDe(null); excluir(a); }}><Trash size={20} weight="bold" />Excluir</button>
          </div>
        )}
      </Janela>

      {/* novo / editar */}
      <Janela aberta={modalOpen} aoFechar={fecharModal} tipo="conteudo" travada titulo={editing ? "Editar autor" : "Novo autor"}
        acoes={<><Botao variante="secundario" onClick={fecharModal}>Cancelar</Botao><Botao onClick={salvar}>{editing ? "Salvar" : "Criar autor"}</Botao></>}>
        <div className="aa-form">
          <div className="ui-campo">
            <span className="ui-campo-r"><span>Foto</span><small>opcional</small></span>
            {form.foto_url ? (
              <div className="aa-foto-preview">
                <img src={form.foto_url} alt="" />
                <Botao variante="link" tamanho="p" onClick={() => setForm(f => ({ ...f, foto_url: "" }))}>Remover foto</Botao>
              </div>
            ) : (
              <button type="button" className="aa-foto-upload" disabled={uploadingFoto} onClick={() => !uploadingFoto && fotoRef.current?.click()}>
                {uploadingFoto ? <span className="ui-gira" aria-label="Enviando" /> : (<><ImageIcon size={22} weight="bold" /><span><b>Enviar foto</b><small>Quadrada, até 500 KB</small></span></>)}
              </button>
            )}
            <input ref={fotoRef} type="file" accept="image/*" hidden onChange={uploadFoto} />
          </div>

          <Campo rotulo="Nome" obrigatorio value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Bruno Eduardo" />
          <Campo rotulo="Cargo" opcional value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex.: Fundador, Editora de conteúdo" />
          <CampoArea rotulo="Bio" opcional rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Uma frase curta sobre o autor" />
          <Campo rotulo="Ordem na lista" type="number" inputMode="numeric" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))} />

          <label className="aa-check">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
            <span><b>Ativo</b><small>Aparece na lista de autores das notícias.</small></span>
          </label>
        </div>
      </Janela>
    </div>
  );
}
