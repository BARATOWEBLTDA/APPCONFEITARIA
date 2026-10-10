import { VERSAO_APP } from "@/lib/versao";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Bug, Check } from "@phosphor-icons/react";
import { Botao, CampoArea } from "@/components/base";
import "./clientes.css";
import "./ajuda.css";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

/** "Relatar um problema" (09/10): mesmo padrão do "Sugerir uma melhoria", com os componentes do app */
// Mesmos nomes do menu do app (iguais aos de Sugerir uma melhoria)
const PARTES = ["Cardápio digital", "Pedidos", "Agenda", "Produtos", "Ficha técnica", "Financeiro", "Clientes", "Outro"];

export default function RelatarProblema() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [texto, setTexto] = useState("");
  const [parte, setParte] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pode = texto.trim().length >= 5 && !enviando;
  const primeiroNome = String((profile as any)?.nome || "").trim().split(" ")[0];

  const enviar = async () => {
    if (!pode) return;
    setEnviando(true); setErro(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("sugestoes").insert({
        user_id: user?.id || null,
        nome: (profile as any)?.nome || null,
        telefone: (profile as any)?.telefone || null,
        email: (profile as any)?.email || user?.email || null,
        tipo: "problema",
        titulo: `Problema${parte ? ` em ${parte}` : ""}`,
        descricao: texto.trim(),
        area: parte,
        status: "recebida",
        tela_origem: document.referrer ? new URL(document.referrer).pathname : window.location.pathname,
        versao_app: VERSAO_APP,
      });
      if (error) throw error;
      setOk(true);
    } catch (e: any) {
      setErro("Não deu pra enviar agora. Confira a internet e tente de novo.");
      console.error(e);
    } finally { setEnviando(false); }
  };

  return (
    <>
      <AppPageHeader title="Relatar um problema" subtitle="Conte pra gente o que não funcionou" onBack={() => navigate(-1)} />
      <div className="cl9 aj">
        {ok ? (
          <section className="cl9-card aj-ok">
            <span className="aj-ok-ic" aria-hidden="true"><Check size={30} weight="bold" /></span>
            <h2>{primeiroNome ? `Obrigado, ${primeiroNome}!` : "Obrigado!"}</h2>
            <p>Recebemos o seu relato. A equipe vai analisar e corrigir o mais rápido possível, e a gente te avisa quando estiver resolvido.</p>
            <Botao onClick={() => navigate(-1)}>Voltar</Botao>
            <Botao variante="link" onClick={() => { setOk(false); setTexto(""); setParte(null); }}>Relatar outro problema</Botao>
          </section>
        ) : (
          <section className="cl9-card">
            <div className="aj-intro">
              <span className="aj-intro-ic" aria-hidden="true"><Bug size={24} weight="duotone" /></span>
              <div><b>Algo deu errado?</b><p>Conte o que aconteceu. A gente lê todos os relatos e corrige o mais rápido possível.</p></div>
            </div>
            <CampoArea rotulo="O que aconteceu?" obrigatorio rows={5} maxLength={800} value={texto} onChange={e => setTexto(e.target.value)}
              placeholder="Ex.: salvei o produto e apareceu uma mensagem de erro" />
            <p className="aj-cont">{texto.length} / 800</p>
            <div>
              <p className="aj-rot">Em que parte do app?<small>opcional</small></p>
              <div className="cl9-f-chips">
                {PARTES.map(p => <button type="button" key={p} aria-pressed={parte === p} onClick={() => setParte(parte === p ? null : p)}>{p}</button>)}
              </div>
            </div>
            {erro && <p className="aj-erro" role="alert">{erro}</p>}
            <Botao cheio carregando={enviando} disabled={texto.trim().length < 5} onClick={enviar}>Enviar</Botao>
            <p className="aj-dica">Quanto mais detalhes (o que você fez antes do erro e o que esperava acontecer), mais rápido a gente resolve.</p>
          </section>
        )}
      </div>
    </>
  );
}
