import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Botao, BotaoIcone, Campo, CampoArea, Janela, TelaVazia, Titulo, avisar, confirmar } from "@/components/base";
import { explicarErro } from "@/lib/erros";
import { Bell, Camera, PaperPlaneTilt, Plus, Trash } from "@phosphor-icons/react";
import "./adminNotificacoes.css";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tag?: string;
  imagem_url?: string;
  created_at: string;
}

export default function AdminNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: "", mensagem: "", tag: "", imagem_url: "" });
  const [saving, setSaving] = useState(false);
  const [enviandoImagem, setEnviandoImagem] = useState(false); // (11/10) a imagem ainda está subindo: o Enviar espera
  const enviandoRef = useRef(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    // (11/10) só os avisos gerais (user_id vazio): antes a lista misturava os avisos pessoais de todas as contas
    const { data, error } = await supabase.from("notificacoes").select("*").is("user_id", null).order("created_at", { ascending: false });
    if (error) avisar(explicarErro(error, "Não deu pra carregar as notificações."), { tipo: "erro" });
    else setNotificacoes(data || []);
    setLoading(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPreview(URL.createObjectURL(file));
    // (11/10) nome seguro no caminho (só a hora e a extensão) e o Enviar espera a imagem subir
    const ext = (file.name.includes(".") ? file.name.split(".").pop() || "" : "").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `notificacoes/${Date.now()}.${ext}`;
    setEnviandoImagem(true);
    let error: unknown = null;
    try { error = (await supabase.storage.from("profiles").upload(path, file, { upsert: true })).error; } catch (err) { error = err; }
    setEnviandoImagem(false);
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, imagem_url: data.publicUrl }));
    } else {
      setPreview(form.imagem_url || null);
      avisar(explicarErro(error, "Não deu pra enviar a imagem. Tente de novo."), { tipo: "erro" });
    }
  };

  const handleSend = async () => {
    if (!form.titulo.trim() || enviandoImagem || enviandoRef.current) return;
    enviandoRef.current = true; // toque duplo não manda duas vezes
    setSaving(true);

    // 1. Salva na tabela notificacoes (pra histórico + sininho in-app)
    let erroGravar: unknown = null;
    try {
      erroGravar = (await supabase.from("notificacoes").insert({
        titulo: form.titulo,
        mensagem: form.mensagem,
        tag: form.tag || null,
        imagem_url: form.imagem_url || null,
      })).error;
    } catch (err) { erroGravar = err; }
    // (11/10) não gravou: não dispara o push nem fecha o formulário
    if (erroGravar) {
      enviandoRef.current = false; setSaving(false);
      avisar(explicarErro(erroGravar, "Não deu pra enviar a notificação. Tente de novo."), { tipo: "erro" });
      return;
    }

    // 2. Dispara Web Push real pra todos os subscribers
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          titulo: form.titulo,
          mensagem: form.mensagem,
          imagem_url: form.imagem_url || null,
          tag: form.tag || null,
          url: "/",
        },
      });
      if (error) { console.error("Push error:", error); avisar("A notificação ficou salva no app, mas o aviso no celular não saiu.", { tipo: "info", duracao: 6000 }); }
      else {
        // (23/10) diz pra quantos aparelhos o aviso saiu
        const t = Number(data?.total) || 0, e = Number(data?.sent) || 0, f = Number(data?.failed) || 0;
        avisar(t === 0 ? "Notificação salva. Nenhum aparelho está com os avisos ativados ainda." : `Aviso no celular enviado para ${e} de ${t} ${t === 1 ? "aparelho" : "aparelhos"}${f ? ` (${f} falharam)` : ""}.`, { tipo: t === 0 || f ? "info" : "ok", duracao: 7000 });
      }
    } catch (err) {
      console.warn("Push dispatch failed (notifications still saved in-app):", err);
      avisar("A notificação ficou salva no app, mas o aviso no celular não saiu.", { tipo: "info", duracao: 6000 });
    }

    enviandoRef.current = false;
    await load();
    setShowForm(false);
    setForm({ titulo: "", mensagem: "", tag: "", imagem_url: "" });
    setPreview(null);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmar({ titulo: "Excluir notificação?", texto: "Ela some para todas as confeiteiras.", rotulo: "Excluir", perigo: true }))) return;
    const { error } = await supabase.from("notificacoes").delete().eq("id", id);
    if (error) { avisar(explicarErro(error, "Não deu pra excluir. Tente de novo."), { tipo: "erro" }); return; }
    load();
  };

  const formatData = (d: string) => new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const novaNotificacao = () => { setShowForm(true); setForm({ titulo: "", mensagem: "", tag: "", imagem_url: "" }); setPreview(null); };

  return (
    <div className="anf">
      <Titulo
        nivel="tela"
        apoio="Mande um aviso para todas as confeiteiras."
        acao={!loading && notificacoes.length > 0 ? <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={novaNotificacao}>Nova notificação</Botao> : undefined}
      >
        Notificações
      </Titulo>

      {/* Lista de notificações enviadas */}
      {loading ? <p className="anf-carregando">Carregando…</p> : notificacoes.length === 0 ? (
        <TelaVazia
          caixa
          className="anf-vazia"
          icone={<Bell size={30} />}
          titulo="Nenhuma notificação enviada"
          texto="O que você mandar fica guardado aqui."
          acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={novaNotificacao}>Nova notificação</Botao>}
        />
      ) : (
        <div className="anf-lista">
          {notificacoes.map(n => (
            <div key={n.id} className="anf-l">
              <span className="anf-img">
                {n.imagem_url ? <img src={n.imagem_url} alt="" /> : <Bell size={24} />}
              </span>
              <div className="anf-tx">
                <b>{n.titulo}</b>
                {n.mensagem && <p>{n.mensagem}</p>}
                <span className="anf-meta">
                  {n.tag && <i className="anf-tag">{n.tag}</i>}
                  <small>{formatData(n.created_at)}</small>
                </span>
              </div>
              <BotaoIcone rotulo={`Excluir ${n.titulo}`} variante="limpo" className="anf-apagar" onClick={() => handleDelete(n.id)}><Trash size={20} weight="bold" /></BotaoIcone>
            </div>
          ))}
        </div>
      )}

      {/* Janela nova notificação */}
      <Janela
        aberta={showForm}
        aoFechar={() => setShowForm(false)}
        tipo="conteudo"
        travada
        titulo="Nova notificação"
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setShowForm(false)}>Cancelar</Botao>
            <Botao icone={<PaperPlaneTilt size={20} weight="bold" />} onClick={handleSend} carregando={saving} disabled={!form.titulo.trim() || enviandoImagem}>{enviandoImagem ? "Enviando a imagem…" : "Enviar para todas"}</Botao>
          </>
        }
      >
        <div className="anf-form">
          <button type="button" className="anf-form-img" onClick={() => fileRef.current?.click()}>
            {preview ? <img src={preview} alt="" /> : <><Camera size={24} /><span>Imagem (opcional)</span></>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

          <Campo rotulo="Título" obrigatorio placeholder="Ex.: Novidade no app" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
          <CampoArea rotulo="Mensagem" rows={3} placeholder="O que você quer contar" value={form.mensagem} onChange={e => setForm({ ...form, mensagem: e.target.value })} />
          <Campo rotulo="Etiqueta" opcional dica="Aparece em rosa embaixo do texto. Ex.: nova receita, atualização." placeholder="Ex.: nova receita" value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} />

          {/* Como vai aparecer */}
          {form.titulo && (
            <div className="anf-prev">
              <p className="anf-prev-r">Como vai aparecer</p>
              <div className="anf-prev-l">
                <span className="anf-img anf-img--p">
                  {preview ? <img src={preview} alt="" /> : <Bell size={20} />}
                </span>
                <div className="anf-tx">
                  <b>{form.titulo}</b>
                  {form.mensagem && <p>{form.mensagem}</p>}
                  {form.tag && <i className="anf-tag">{form.tag}</i>}
                </div>
              </div>
            </div>
          )}
        </div>
      </Janela>
    </div>
  );
}
