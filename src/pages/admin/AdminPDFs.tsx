import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Botao, BotaoIcone, Campo, CampoArea, Janela, TelaVazia, Titulo, confirmar } from "@/components/base";
import { Camera, CheckCircle, Eye, FilePdf, PencilSimple, Paperclip, Plus, Trash } from "@phosphor-icons/react";
import "./adminPDFs.css";

const emptyForm = { titulo: "", descricao: "", categoria: "", capa_url: "", pdf_url: "" };

export default function AdminPDFs() {
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [capaPreview, setCapaPreview] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [saving, setSaving] = useState(false);
  const capaRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("biblioteca_pdf").select("*").order("created_at", { ascending: false });
    setPdfs(data || []);
    setLoading(false);
  };

  const handleCapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapaPreview(URL.createObjectURL(file));
    const path = `pdfs/capas/${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, capa_url: data.publicUrl }));
    }
  };

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfName(file.name);
    const path = `pdfs/arquivos/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, pdf_url: data.publicUrl }));
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    if (editId) await supabase.from("biblioteca_pdf").update(form).eq("id", editId);
    else await supabase.from("biblioteca_pdf").insert(form);
    await load();
    setShowForm(false); setForm(emptyForm); setEditId(null); setCapaPreview(null); setPdfName(""); setSaving(false);
  };

  const handleEdit = (p: any) => {
    setForm({ titulo: p.titulo, descricao: p.descricao, categoria: p.categoria, capa_url: p.capa_url || "", pdf_url: p.pdf_url || "" });
    setCapaPreview(p.capa_url || null);
    setPdfName(p.pdf_url ? "Arquivo atual" : "");
    setEditId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmar({ titulo: "Excluir este PDF?", texto: "Ele some da biblioteca do app.", rotulo: "Excluir", perigo: true }))) return;
    await supabase.from("biblioteca_pdf").delete().eq("id", id);
    load();
  };

  const novoPdf = () => { setForm(emptyForm); setCapaPreview(null); setPdfName(""); setEditId(null); setShowForm(true); };

  return (
    <div className="apd">
      <Titulo
        nivel="tela"
        apoio="Materiais exclusivos para as confeiteiras."
        acao={!loading && pdfs.length > 0 ? <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={novoPdf}>Novo PDF</Botao> : undefined}
      >
        Biblioteca de PDFs
      </Titulo>

      {loading ? <p className="apd-carregando">Carregando…</p> : pdfs.length === 0 ? (
        <TelaVazia
          caixa
          className="apd-vazia"
          icone={<FilePdf size={30} />}
          titulo="Nenhum PDF ainda"
          texto="Publique o primeiro material e ele aparece na biblioteca do app."
          acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={novoPdf}>Novo PDF</Botao>}
        />
      ) : (
        <div className="apd-grade">
          {pdfs.map(p => (
            <div key={p.id} className="apd-card">
              <div className="apd-capa">
                {p.capa_url ? <img src={p.capa_url} alt="" /> : <FilePdf size={36} />}
              </div>
              <div className="apd-corpo">
                <i className="apd-cat">{p.categoria || "Geral"}</i>
                <b>{p.titulo}</b>
                {p.descricao && <small>{p.descricao}</small>}
              </div>
              <div className="apd-acoes">
                {p.pdf_url && (
                  <a href={p.pdf_url} target="_blank" rel="noreferrer" className="ui-bt ui-bt--secundario ui-bt--m apd-ver">
                    <span className="ui-bt-ic" aria-hidden="true"><Eye size={18} weight="bold" /></span>
                    <span className="ui-bt-t">Abrir</span>
                  </a>
                )}
                <BotaoIcone rotulo={`Editar ${p.titulo}`} onClick={() => handleEdit(p)}><PencilSimple size={20} weight="bold" /></BotaoIcone>
                <BotaoIcone rotulo={`Excluir ${p.titulo}`} className="apd-apagar" onClick={() => handleDelete(p.id)}><Trash size={20} weight="bold" /></BotaoIcone>
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
        titulo={editId ? "Editar PDF" : "Novo PDF"}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setShowForm(false)}>Cancelar</Botao>
            <Botao onClick={handleSave} carregando={saving} disabled={!form.titulo.trim()}>{editId ? "Salvar" : "Publicar"}</Botao>
          </>
        }
      >
        <div className="apd-form">
          <button type="button" className="apd-form-capa" onClick={() => capaRef.current?.click()}>
            {capaPreview ? <img src={capaPreview} alt="" /> : <><Camera size={24} /><span>Adicionar capa</span></>}
          </button>
          <input ref={capaRef} type="file" accept="image/*" onChange={handleCapa} style={{ display: "none" }} />

          <Campo rotulo="Título" placeholder="Ex.: Apostila de brigadeiros" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
          <Campo rotulo="Categoria" placeholder="Ex.: Receitas, Precificação" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
          <CampoArea rotulo="Descrição" rows={2} placeholder="Do que o material trata" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />

          <div className="apd-arquivo">
            <span className="apd-arquivo-r">Arquivo PDF</span>
            <button type="button" className={`apd-arquivo-bt${pdfName ? " ok" : ""}`} onClick={() => pdfRef.current?.click()}>
              {pdfName ? <CheckCircle size={20} weight="bold" aria-hidden="true" /> : <Paperclip size={20} weight="bold" aria-hidden="true" />}
              <span>{pdfName || "Escolher PDF"}</span>
            </button>
            <input ref={pdfRef} type="file" accept="application/pdf" onChange={handlePdf} style={{ display: "none" }} />
          </div>
        </div>
      </Janela>
    </div>
  );
}
