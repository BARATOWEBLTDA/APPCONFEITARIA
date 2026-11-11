/**
 * (11/11) Admin › Equipe: nome, foto e cor de cada pessoa da equipe (os perfis de "Quem está usando?").
 * A mesma foto aparece no menu do Admin, na escolha de perfil e no convite de acesso de suporte.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, PencilSimple } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { registrar, perfilAtual, escolherPerfil, type PerfilAdmin } from "@/lib/adminPerfil";
import { Botao, Campo, Janela, Titulo, avisar } from "@/components/base";
import { useRecorte } from "@/components/ui/useRecorte";
import { AvatarAdmin } from "./EscolherPerfil";
import "./admin-autores.css";

const CORES = ["#B83A6A", "#7A4FB5", "#2F6FB3", "#2E8A62", "#D9822B", "#4A3A3F"];

export default function AdminEquipe() {
  const [lista, setLista] = useState<PerfilAdmin[] | null>(null);
  const [editando, setEditando] = useState<PerfilAdmin | null>(null);
  const [form, setForm] = useState({ nome: "", foto_url: "", cor: CORES[0] });
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const carregar = () => {
    supabase.from("admin_perfis").select("id, nome, foto_url, cor").order("ordem").then(({ data }) => setLista((data as PerfilAdmin[]) || []));
  };
  useEffect(carregar, []);

  const recorte = useRecorte(async (foto) => {
    setEnviando(true);
    const caminho = `equipe-${editando?.id || "x"}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("autores-fotos").upload(caminho, foto, { contentType: "image/jpeg", cacheControl: "31536000" });
    setEnviando(false);
    if (error) { avisar("Não deu para enviar a foto", { tipo: "erro", detalhe: "Confira a internet e tente de novo" }); return; }
    setForm(f => ({ ...f, foto_url: supabase.storage.from("autores-fotos").getPublicUrl(caminho).data.publicUrl }));
  }, { aspect: 1, forma: "round", titulo: "Ajustar a foto" });

  const abrir = (p: PerfilAdmin) => { setEditando(p); setForm({ nome: p.nome, foto_url: p.foto_url || "", cor: p.cor || CORES[0] }); };

  const salvar = async () => {
    if (!editando) return;
    const nome = form.nome.trim();
    if (!nome) { avisar("Escreva o nome", { tipo: "erro" }); return; }
    setSalvando(true);
    const novo = { nome, foto_url: form.foto_url || null, cor: form.cor };
    const { error } = await supabase.from("admin_perfis").update(novo).eq("id", editando.id);
    setSalvando(false);
    if (error) { avisar("Não deu para salvar", { tipo: "erro", detalhe: "Tente de novo" }); return; }
    // quem está usando agora: o menu do Admin já mostra a foto nova
    if (perfilAtual()?.id === editando.id) escolherPerfil({ ...editando, ...novo });
    void registrar(`editou o perfil de ${nome} na equipe`, { tipo: "outro", alvo_id: null });
    avisar("Perfil salvo", { tipo: "ok" });
    setEditando(null);
    carregar();
  };

  return (
    <div className="aa-root">
      <Titulo nivel="tela" apoio="Nome e foto de quem usa o Admin. Aparecem no convite de acesso de suporte.">Equipe</Titulo>
      {lista === null ? (
        <div className="aa-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
      ) : (
        <section className="aa-card">
          {lista.map(p => (
            <div key={p.id} className="aa-row">
              <button type="button" className="aa-row-b" onClick={() => abrir(p)}>
                <AvatarAdmin perfil={p} tamanho={48} />
                <span className="aa-row-tx"><b>{p.nome}</b><small>{p.foto_url ? "Com foto" : "Sem foto"}</small></span>
                <PencilSimple size={20} weight="bold" className="aeq-lapis" aria-hidden="true" />
              </button>
            </div>
          ))}
        </section>
      )}

      <Janela aberta={!!editando} aoFechar={() => setEditando(null)} tipo="conteudo" titulo="Editar perfil" travada
        acoes={<><Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao><Botao carregando={salvando} disabled={enviando} onClick={salvar}>Salvar</Botao></>}>
        <div className="aeq">
          <button type="button" className="aeq-foto" onClick={() => arquivo.current?.click()} disabled={enviando} aria-label="Trocar a foto">
            <AvatarAdmin perfil={{ nome: form.nome || "?", foto_url: form.foto_url || null, cor: form.cor }} tamanho={96} />
            <span className="aeq-cam">{enviando ? <span className="ui-gira" /> : <Camera size={18} weight="bold" />}</span>
          </button>
          <div className="aeq-links">
            <button type="button" onClick={() => arquivo.current?.click()} disabled={enviando}>{form.foto_url ? "Trocar foto" : "Colocar foto"}</button>
            {form.foto_url && <button type="button" onClick={() => setForm(f => ({ ...f, foto_url: "" }))}>Tirar foto</button>}
          </div>
          <input ref={arquivo} type="file" accept="image/*" hidden onChange={recorte.escolher} />
          <Campo rotulo="Nome" value={form.nome} maxLength={30} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          <div className="aeq-cores">
            <span className="aeq-cores-t">Cor quando não tem foto</span>
            <div className="aeq-cores-l">
              {(CORES.includes(editando?.cor || "") || !editando?.cor ? CORES : [editando.cor, ...CORES.slice(0, 5)]).map(c => <button key={c} type="button" className={`aeq-cor${form.cor === c ? " on" : ""}`} style={{ background: c }} onClick={() => setForm(f => ({ ...f, cor: c }))} aria-label={`Cor ${c}`} aria-pressed={form.cor === c} />)}
            </div>
          </div>
        </div>
      </Janela>
      {recorte.janela}
      <style>{`
        .aeq-lapis { flex: none; margin-right: 12px; color: var(--ui-texto-2); }
        .aeq { display: flex; flex-direction: column; align-items: center; gap: 14px; padding-bottom: 6px; }
        .aeq-foto { position: relative; padding: 0; border: 0; background: none; border-radius: 50%; cursor: pointer; }
        .aeq-cam { position: absolute; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: var(--ui-branco); border: 1px solid var(--ui-borda); color: var(--ui-texto); }
        .aeq-cam .ui-gira { width: 16px; height: 16px; }
        .aeq-links { display: flex; gap: 18px; margin-top: -6px; }
        .aeq-links button { padding: 4px 0; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 500; color: var(--ui-rosa-escuro); cursor: pointer; }
        .aeq > .ui-campo, .aeq > label, .aeq > div:not(.aeq-links):not(.aeq-cores) { width: 100%; }
        .aeq-cores { width: 100%; }
        .aeq-cores-t { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: var(--ui-texto); }
        .aeq-cores-l { display: flex; gap: 10px; }
        .aeq-cor { width: 34px; height: 34px; padding: 0; border: 3px solid var(--ui-branco); border-radius: 50%; box-shadow: 0 0 0 1px var(--ui-borda); cursor: pointer; }
        .aeq-cor.on { box-shadow: 0 0 0 2px var(--ui-texto); }
      `}</style>
    </div>
  );
}
