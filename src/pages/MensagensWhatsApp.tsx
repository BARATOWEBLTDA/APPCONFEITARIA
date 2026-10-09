import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowCounterClockwise, CaretRight, ChatCircleText, Info } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, CampoArea, Janela, avisar } from "@/components/base";
import { refreshProfile, useProfile } from "@/hooks/useProfile";
import { MODELOS, exemplo, montarMensagem, type Modelo } from "@/lib/mensagens";
import "./mensagens.css";

/**
 * Mensagens do WhatsApp (09/10 · 3.59). A confeiteira troca o texto das mensagens prontas.
 * Os textos ficam em profiles.mensagens_whatsapp; sem texto salvo, vale o padrão (lib/mensagens.ts).
 */

/** Mostra *negrito* e _itálico_ como no WhatsApp */
function textoZap(t: string): ReactNode[] {
  return t.split("\n").flatMap((linha, i, todas) => {
    const partes = linha.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).filter(Boolean).map((p, j) =>
      p.startsWith("*") && p.endsWith("*") ? <b key={j}>{p.slice(1, -1)}</b>
        : p.startsWith("_") && p.endsWith("_") ? <i key={j}>{p.slice(1, -1)}</i> : <span key={j}>{p}</span>);
    return i < todas.length - 1 ? [...partes, <br key={`br${i}`} />] : partes;
  });
}

export default function MensagensWhatsApp() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const salvas = profile?.mensagens_whatsapp || {};
  const [editando, setEditando] = useState<Modelo | null>(null);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const posicao = useRef<{ ini: number; fim: number } | null>(null); // onde estava o cursor (sem tocar no campo, vai pro fim)

  const abrir = (m: Modelo) => { posicao.current = null; setEditando(m); setTexto(salvas[m.chave]?.trim() ? salvas[m.chave] : m.padrao); };
  const fechar = () => setEditando(null);

  const colocar = (k: string) => {
    const el = campo.current;
    const tag = `{${k}}`;
    if (!el) { setTexto(t => t + tag); return; }
    const p = posicao.current;
    const ini = p ? p.ini : texto.length, fim = p ? p.fim : texto.length;
    const antes = texto.slice(0, ini), espaco = !p && antes && !/\s$/.test(antes) ? " " : "";
    const novo = antes + espaco + tag + texto.slice(fim);
    posicao.current = { ini: ini + espaco.length + tag.length, fim: ini + espaco.length + tag.length };
    setTexto(novo);
    const c = ini + espaco.length + tag.length;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(c, c); });
  };

  const salvar = async () => {
    if (!editando || !profile?.id) return;
    const limpo = texto.trim();
    if (!limpo) { avisar("Escreva a mensagem ou toque em Voltar ao padrão.", { tipo: "erro" }); return; }
    const novas: Record<string, string> = { ...salvas };
    if (limpo === editando.padrao) delete novas[editando.chave]; else novas[editando.chave] = limpo;
    setSalvando(true);
    const { error } = await supabase.from("profiles").update({ mensagens_whatsapp: novas }).eq("id", profile.id);
    setSalvando(false);
    if (error) { console.error(error); avisar("Não deu pra salvar. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    await refreshProfile();
    fechar();
    avisar("Mensagem salva", { tipo: "ok" });
  };

  const previa = editando ? montarMensagem(editando.chave, exemplo(editando), texto) : "";

  return (
    <>
      <AppPageHeader title="Mensagens do WhatsApp" subtitle="Os textos que o app escreve por você" onBack={() => navigate("/configuracoes")} />
      <div className="mz">
        <p className="mz-intro"><Info size={20} weight="bold" aria-hidden="true" />O app abre o WhatsApp com a mensagem pronta. Aqui você troca o texto do seu jeito.</p>
        <section className="mz-lista">
          {MODELOS.map(m => {
            const personalizada = !!salvas[m.chave]?.trim();
            return (
              <button key={m.chave} type="button" className="mz-item" onClick={() => abrir(m)}>
                <span className="mz-ic" aria-hidden="true"><ChatCircleText size={22} weight="bold" /></span>
                <span className="mz-tx">
                  <b>{m.titulo}</b>
                  <small>{m.quando}</small>
                  <em className={personalizada ? "on" : ""}>{personalizada ? "Personalizada" : "Texto padrão"}</em>
                </span>
                <CaretRight size={18} weight="bold" className="mz-seta" aria-hidden="true" />
              </button>
            );
          })}
        </section>
      </div>

      <Janela aberta={!!editando} aoFechar={fechar} tipo="conteudo" travada titulo={editando?.titulo || ""}
        acoes={<><Botao variante="secundario" onClick={fechar}>Cancelar</Botao><Botao onClick={salvar} carregando={salvando}>Salvar</Botao></>}>
        {editando && (
          <div className="mz-ed">
            <p className="mz-quando">{editando.quando}.</p>
            <CampoArea ref={campo} rotulo="Mensagem" value={texto} rows={5} maxLength={600} onChange={e => setTexto(e.target.value)}
              onSelect={e => { const t = e.currentTarget; posicao.current = { ini: t.selectionStart, fim: t.selectionEnd }; }}
              dica="*assim* fica em negrito e _assim_ em itálico no WhatsApp." />
            <div>
              <p className="mz-rot">Colocar informação</p>
              <div className="mz-chips">
                {editando.etiquetas.map(e => (
                  <button key={e.k} type="button" onClick={() => colocar(e.k)}>{e.rotulo}</button>
                ))}
              </div>
              {editando.aviso && <p className="mz-aviso">{editando.aviso}</p>}
            </div>
            <div>
              <p className="mz-rot">Como fica</p>
              <div className="mz-previa"><div className="mz-bolha">{textoZap(previa)}</div></div>
            </div>
            {texto.trim() !== editando.padrao && (
              <Botao variante="link" tamanho="p" icone={<ArrowCounterClockwise size={18} weight="bold" />} onClick={() => setTexto(editando.padrao)}>Voltar ao padrão</Botao>
            )}
          </div>
        )}
      </Janela>
    </>
  );
}
