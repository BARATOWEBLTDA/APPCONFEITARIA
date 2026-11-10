import { useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowCounterClockwise, CaretLeft, ChatCircleText, Checks, Crown, Info, Microphone, PencilSimple, WarningCircle } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { explicarErro } from "@/lib/erros";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_MENSAGENS, TOUR_MENSAGENS } from "@/lib/comoTelas";
import { Botao, CampoArea, Janela, avisar } from "@/components/base";
import { getCardapioUrl, refreshProfile, useProfile } from "@/hooks/useProfile";
import { MODELOS, etiquetasDesconhecidas, exemplo, montarMensagem, type Modelo } from "@/lib/mensagens";
import { usePlano } from "@/hooks/usePlano";
import { useIsMobile } from "@/hooks/use-mobile";
import RecursoPro from "@/components/billing/RecursoPro";
import "./mensagens.css";

/**
 * Mensagens do WhatsApp (09/10 · 3.59). A confeiteira troca o texto das mensagens prontas.
 * Os textos ficam em profiles.mensagens_whatsapp; sem texto salvo, vale o padrão (lib/mensagens.ts).
 */

/** Mostra *negrito* e _itálico_ como no WhatsApp (27/10: chave com a linha, antes repetia entre linhas) */
function textoZap(t: string): ReactNode[] {
  return t.split("\n").flatMap((linha, i, todas) => {
    const partes = linha.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).filter(Boolean).map((p, j) =>
      p.startsWith("*") && p.endsWith("*") ? <b key={`${i}-${j}`}>{p.slice(1, -1)}</b>
        : p.startsWith("_") && p.endsWith("_") ? <em key={`${i}-${j}`}>{p.slice(1, -1)}</em> : <span key={`${i}-${j}`}>{p}</span>);
    return i < todas.length - 1 ? [...partes, <br key={`br${i}`} />] : partes;
  });
}

/**
 * (6.169) A conversa como aparece no WhatsApp da confeiteira: o topo com o contato, o fundo bege e o balão.
 * Pedido pelo cardápio: quem manda é o cliente (balão branco, chegando). As outras: ela manda (balão verde, com os ✓✓).
 */
function ConversaZap({ m, mensagem, compacta = false }: { m: Modelo; mensagem: string; compacta?: boolean }) {
  const chega = m.chave === "pedido_cardapio";
  return (
    <div className={`mz-tel${compacta ? " mz-tel--compacta" : ""}`}>
      <div className="mz-tel-topo">
        <CaretLeft size={18} weight="bold" aria-hidden="true" />
        <span className="mz-tel-av" aria-hidden="true">A</span>
        <span className="mz-tel-nome"><b>Ana Souza</b><small>{chega ? "cliente · online" : "online"}</small></span>
      </div>
      <div className="mz-tel-conversa">
        <span className="mz-tel-dia">Hoje</span>
        <div className={`mz-tel-bolha ${chega ? "mz-tel-bolha--chega" : "mz-tel-bolha--vai"}`}>
          <span>{textoZap(mensagem)}</span>
          <small className="mz-tel-hora">10:42{!chega && <Checks size={15} weight="bold" aria-hidden="true" />}</small>
        </div>
      </div>
      {!compacta && <div className="mz-tel-pe" aria-hidden="true"><span>Mensagem</span><Microphone size={18} weight="fill" /></div>}
    </div>
  );
}

export default function MensagensWhatsApp() {
  const navigate = useNavigate();
  // (18/10) aberta pela aba Cardápio: o voltar leva pra lá (senão, pra Configurações)
  // (10/11) Mensagens agora mora na Minha loja: o voltar vai pra lá (de onde mais ela abre)
  const voltarPara = (useLocation().state as { de?: string } | null)?.de || "/cardapio";
  const { profile } = useProfile();
  const salvas = profile?.mensagens_whatsapp || {};
  const [editando, setEditando] = useState<Modelo | null>(null);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const posicao = useRef<{ ini: number; fim: number } | null>(null); // onde estava o cursor (sem tocar no campo, vai pro fim)

  // (31/10 · 5.84) mensagens do seu jeito é recurso PRO: no grátis vale o texto padrão do app
  const { isPro, loading: carregandoPlano } = usePlano();
  const [proAberto, setProAberto] = useState(false);
  const abrir = (m: Modelo) => { if (!carregandoPlano && !isPro) { setProAberto(true); return; } posicao.current = null; setEditando(m); setTexto(salvas[m.chave]?.trim() ? salvas[m.chave] : m.padrao); };
  const fechar = () => setEditando(null);
  // (6.169) "Ver como fica": a conversa de exemplo (no grátis é o jeito de ver as mensagens; mudar o texto é do PRO)
  const [vendo, setVendo] = useState<Modelo | null>(null);
  const celular = useIsMobile(); // título curto na janela do celular (o longo não cabe numa linha)
  // o exemplo com o nome e o link da própria loja (o resto é de mentira: Ana, pedido #214)
  const dadosExemplo = (m: Modelo) => {
    const d = exemplo(m);
    const loja = (profile?.nome_loja || profile?.nome || "").trim();
    const link = getCardapioUrl(profile);
    return { ...d, ...(loja && "loja" in d ? { loja } : {}), ...(link && "link" in d ? { link } : {}) };
  };
  const textoDe = (m: Modelo) => (isPro && salvas[m.chave]?.trim() ? salvas[m.chave] : m.padrao);

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
    if (!limpo) { avisar("Escreva a mensagem ou use Voltar ao padrão.", { tipo: "erro" }); return; }
    if (salvando) return;
    setSalvando(true);
    try {
      // (4.24) O banco troca só esta mensagem de uma vez (função salvar_mensagem_whatsapp): duas telas salvando
      // ao mesmo tempo não apagam a mensagem uma da outra. Sem a função no banco, faz como antes.
      const viaBanco = await supabase.rpc("salvar_mensagem_whatsapp", { p_chave: editando.chave, p_texto: limpo === editando.padrao ? null : limpo });
      const semFuncao = !!viaBanco.error && (viaBanco.error.code === "PGRST202" || viaBanco.error.code === "42883" || /could not find the function/i.test(String(viaBanco.error.message || "")));
      if (viaBanco.error && !semFuncao) throw viaBanco.error;
      if (semFuncao) {
      // (11/10) Relê do banco antes de gravar e troca só esta mensagem: antes regravava tudo a partir do que
      // estava no aparelho e apagava a mensagem alterada em outro aparelho.
      const { data: atual, error: erroLer } = await supabase.from("profiles").select("mensagens_whatsapp").eq("id", profile.id).single();
      if (erroLer) throw erroLer;
      const noBanco = (atual as { mensagens_whatsapp?: unknown } | null)?.mensagens_whatsapp;
      const novas: Record<string, string> = noBanco && typeof noBanco === "object" && !Array.isArray(noBanco) ? { ...(noBanco as Record<string, string>) } : {};
      if (limpo === editando.padrao) delete novas[editando.chave]; else novas[editando.chave] = limpo;
      const { error } = await supabase.from("profiles").update({ mensagens_whatsapp: novas }).eq("id", profile.id);
      if (error) throw error;
      }
    } catch (err) {
      setSalvando(false);
      avisar(explicarErro(err, "Não deu para salvar. Tente de novo."), { tipo: "erro" });
      return;
    }
    setSalvando(false);
    await refreshProfile();
    fechar();
    avisar("Mensagem salva", { tipo: "ok" });
  };

  const previa = editando ? montarMensagem(editando.chave, dadosExemplo(editando), texto) : "";
  const desconhecidas = editando ? etiquetasDesconhecidas(texto, editando) : [];

  return (
    <>
      <AppPageHeader title="Mensagens" subtitle="Os textos do WhatsApp que o app escreve por você" infoComo={COMO_MENSAGENS} infoTour={TOUR_MENSAGENS} onBack={() => navigate(voltarPara)} />
      <div className="mz">
        {/* (6.169) uma linha no celular; no PC, a explicação inteira */}
        <p className="mz-intro"><Info size={20} weight="bold" aria-hidden="true" />
          <span className="mz-so-cel">Veja como cada mensagem chega.</span>
          <span className="mz-so-pc">O app abre o WhatsApp com a mensagem pronta. {isPro ? "Aqui você vê como cada uma chega e muda o texto do seu jeito." : "Veja como cada uma chega. No PRO, você muda o texto do seu jeito."}</span>
        </p>
        {proAberto && <RecursoPro recurso="mensagens" onClose={() => setProAberto(false)} />}
        <section className="mz-lista">
          {MODELOS.map(m => {
            const personalizada = isPro && !!salvas[m.chave]?.trim();
            return (
              <div key={m.chave} className="mz-item">
                <span className="mz-ic" aria-hidden="true"><ChatCircleText size={22} weight="bold" /></span>
                <span className="mz-tx">
                  <b><span className="mz-so-cel">{m.curto}</span><span className="mz-so-pc">{m.titulo}</span></b>
                  <small>{m.resumo}{personalizada && <> · <em className="on">Seu texto</em></>}</small>
                </span>
                <span className="mz-acoes">
                  <Botao variante="secundario" tamanho="p" icone={celular ? undefined : <ChatCircleText size={18} weight="bold" />} onClick={() => setVendo(m)}>Ver como fica</Botao>
                  <Botao variante="secundario" tamanho="p" icone={isPro ? <PencilSimple size={18} weight="bold" /> : <Crown size={18} weight="fill" />} onClick={() => abrir(m)}>Editar</Botao>
                </span>
              </div>
            );
          })}
        </section>
      </div>

      <Janela aberta={!!vendo} aoFechar={() => setVendo(null)} tipo="conteudo" titulo={(celular ? vendo?.curto : vendo?.titulo) || ""}
        acoes={<><Botao variante="secundario" onClick={() => setVendo(null)}>Fechar</Botao>
          <Botao icone={isPro ? <PencilSimple size={20} weight="bold" /> : <Crown size={20} weight="fill" />} onClick={() => { const m = vendo; setVendo(null); if (m) abrir(m); }}>{isPro ? (celular ? "Editar" : "Editar mensagem") : "Mudar o texto"}</Botao></>}>
        {vendo && (
          <div className="mz-ver">
            <p className="mz-quando">{vendo.quando}.</p>
            <ConversaZap m={vendo} mensagem={montarMensagem(vendo.chave, dadosExemplo(vendo), textoDe(vendo))} />
            <p className="mz-ver-nota">{isPro && salvas[vendo.chave]?.trim() ? "Com o seu texto." : "Texto do app."} O cliente e o pedido são de exemplo.{!isPro && " No PRO, você escreve do seu jeito."}</p>
          </div>
        )}
      </Janela>

      <Janela aberta={!!editando} aoFechar={fechar} tipo="conteudo" travada titulo={(celular ? editando?.curto : editando?.titulo) || ""} className="mz-janela-ed"
        acoes={<><Botao variante="secundario" onClick={fechar}>Cancelar</Botao><Botao onClick={salvar} carregando={salvando}>Salvar</Botao></>}>
        {editando && (
          <div className="mz-ed">
            <p className="mz-quando">{editando.quando}.</p>
            <CampoArea ref={campo} rotulo="Mensagem" value={texto} rows={5} maxLength={600} onChange={e => setTexto(e.target.value)}
              onSelect={e => { const t = e.currentTarget; posicao.current = { ini: t.selectionStart, fim: t.selectionEnd }; }}
              dica={celular ? "*assim* fica negrito e _assim_, itálico" : "*assim* fica em negrito e _assim_ em itálico no WhatsApp."} />
            {desconhecidas.length > 0 && (
              <p className="mz-alerta" role="status"><WarningCircle size={18} weight="bold" aria-hidden="true" />
                <span>{desconhecidas.map(k => `{${k}}`).join(", ")} não é uma informação do app e vai assim para o cliente. Use os botões abaixo.</span></p>
            )}
            <div>
              <p className="mz-rot">Colocar informação</p>
              <div className="mz-chips">
                {editando.etiquetas.map(e => (
                  <button key={e.k} type="button" onClick={() => colocar(e.k)}>{e.rotulo}</button>
                ))}
              </div>
              {editando.aviso && <p className="mz-aviso">{editando.aviso}</p>}
            </div>
            <div className="mz-ed-previa">
              <p className="mz-rot">Como fica</p>
              <ConversaZap m={editando} mensagem={previa} compacta />
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
