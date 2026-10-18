import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { Check, Clock, FacebookLogo, PencilSimple, InstagramLogo, MapPin, ShareNetwork, Sparkle, Storefront, WarningCircle } from "@phosphor-icons/react";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import AppPageHeader from "@/components/AppPageHeader";
import MapaEndereco, { type BuscaMapa } from "@/components/MapaEndereco";
import { EXEMPLO_DESCRICAO, EditorHorario, OpcoesMostrar } from "@/components/loja/EditoresLoja";
import { Botao, Campo, CampoArea, TelaVazia, Titulo, avisar } from "@/components/base";
import { digitosTelefone, digitosAoDigitar } from "@/lib/telefone";
import { limparFacebook, limparInstagram } from "@/lib/redesSociais";
import CheckoutConfigPage from "./CheckoutConfigPage";
import "./dadosLoja.css";

/**
 * Dados da loja — página única (aprovada 29/09).
 * Nome, WhatsApp, descrição, endereço e horário. Logo e avaliação ficam em Aparência;
 * pagamento/entrega em "Entrega e pagamento". Sem "Ver cardápio"/"Copiar link" aqui.
 * Mesmo formato de dados de antes (profiles.telefone formatado, endereco e horario em JSON).
 * (08/10 · 3.24) No padrão do guia: campos do app, ícones no lugar dos emojis, letras legíveis,
 * toques de 44px e o aviso de salvo no balão do app. O que salva continua igual.
 */

const DIAS_UTEIS = [
  { nome: "Segunda", curto: "Seg", letra: "S" },
  { nome: "Terça", curto: "Ter", letra: "T" },
  { nome: "Quarta", curto: "Qua", letra: "Q" },
  { nome: "Quinta", curto: "Qui", letra: "Q" },
  { nome: "Sexta", curto: "Sex", letra: "S" },
];

interface Horario {
  dias: string[];
  abertura: string;
  fechamento: string;
  abre_sabado: boolean;
  sabado_abertura: string;
  sabado_fechamento: string;
  abre_domingo: boolean;
  domingo_abertura: string;
  domingo_fechamento: string;
}

const HORARIO_PADRAO: Horario = {
  dias: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
  abertura: "08:00", fechamento: "18:00",
  abre_sabado: false, sabado_abertura: "09:00", sabado_fechamento: "14:00",
  abre_domingo: false, domingo_abertura: "09:00", domingo_fechamento: "14:00",
};

type CampoHora = "abertura" | "fechamento" | "sabado_abertura" | "sabado_fechamento" | "domingo_abertura" | "domingo_fechamento";

// 10/10: tira o +55 antes da máscara (antes "+55 41 99999-8888" virava "(55) 41999-9988").
// digitando = no campo, enquanto ela escreve (não confunde o DDD 55 com o código do país)
function formatPhone(v: string, digitando = false) {
  const d = digitando ? digitosAoDigitar(v) : digitosTelefone(v).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function DadosLoja() {
  const navigate = useNavigate();
  // (15/10) aberta por Configurações: o voltar leva de volta pra lá (senão, pro Cardápio)
  const voltarPara = (useLocation().state as any)?.de === "/configuracoes" ? "/configuracoes" : "/cardapio";
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepOk, setCepOk] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [descricao, setDescricao] = useState("");
  const [end, setEnd] = useState({ cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
  const [mostrarLocal, setMostrarLocal] = useState<"completo" | "cidade" | "nada">("completo");
  // 02/10: "Recebo pedidos nesse endereço" — vira o endereço de retirada da Finalizar encomenda
  const [recebeAqui, setRecebeAqui] = useState(true);
  const [horario, setHorario] = useState<Horario>(HORARIO_PADRAO);
  // (4.25) Instagram e Facebook: vazios = não aparecem no cardápio. Sem as colunas no banco (SQL 4.25), o bloco avisa.
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [redesNoBanco, setRedesNoBanco] = useState(true);

  // (10/10) Se a leitura falhar, a tela NÃO abre: antes abria em branco e "Salvar alterações" gravava nome, WhatsApp,
  // endereço e horário vazios por cima dos dados da loja.
  const [erroCarga, setErroCarga] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    (async () => {
      setErroCarga(false); setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setErroCarga(true); setLoading(false); return; }
      setUserId(user.id);
      const { data, error } = await supabase
        .from("profiles")
        .select("nome_loja, telefone, descricao_loja, endereco, mostrar_localizacao, mostrar_apenas_cidade, horario, endereco_retirada, formas_entrega")
        .eq("id", user.id)
        .single();
      if (error || !data) { setErroCarga(true); setLoading(false); return; }
      {
        const r = await supabase.from("profiles").select("instagram, facebook").eq("id", user.id).maybeSingle();
        if (r.error) setRedesNoBanco(false);
        else { setRedesNoBanco(true); setInstagram(((r.data as any)?.instagram) ? "@" + (r.data as any).instagram : ""); setFacebook((r.data as any)?.facebook || ""); }
      }
      if (data) {
        setNome(data.nome_loja || "");
        setTelefone(formatPhone(data.telefone || ""));
        setDescricao(data.descricao_loja || "");
        let addr: any = {};
        try { addr = data.endereco ? (typeof data.endereco === "string" ? JSON.parse(data.endereco) : data.endereco) : {}; } catch { /* ignora */ }
        setEnd({ cep: addr.cep || "", rua: addr.rua || "", numero: addr.numero || "", complemento: addr.complemento || "", bairro: addr.bairro || "", cidade: addr.cidade || "", estado: addr.estado || "" });
        if (addr.cep) setCepOk(true);
        // 02/10: sem endereço salvo ainda, já vem "Mostrar endereço completo"
        const jaTemEndereco = !!(addr.rua || addr.cep || addr.cidade);
        setMostrarLocal(!jaTemEndereco ? "completo" : data.mostrar_localizacao ? "completo" : data.mostrar_apenas_cidade ? "cidade" : "nada");
        setRecebeAqui(!jaTemEndereco || !!(data as any).endereco_retirada || ((data as any).formas_entrega || ["retirada"]).includes("retirada"));
        if (data.horario) {
          try {
            const h = typeof data.horario === "string" ? JSON.parse(data.horario) : data.horario;
            setHorario((prev) => ({ ...prev, ...h }));
          } catch { /* ignora */ }
        }
      }
      setLoading(false);
    })();
  }, [tentativa]);

  // ── Resumo do que falta ──
  const itens = useMemo(() => {
    const temHorario = (horario.dias?.length || 0) > 0 || horario.abre_sabado || horario.abre_domingo;
    return [
      { nome: "Nome", ok: nome.trim().length > 0, alvo: "dl-nome" },
      { nome: "WhatsApp", ok: telefone.replace(/\D/g, "").length >= 10, alvo: "dl-whats" },
      { nome: "Descrição", ok: descricao.trim().length > 0, alvo: "dl-desc" },
      { nome: "Endereço", ok: !!(end.cidade.trim() && (end.rua.trim() || end.cep.trim())), alvo: "dl-endereco" },
      { nome: "Horário", ok: !!temHorario, alvo: "dl-horario" },
    ];
  }, [nome, telefone, descricao, end, horario]);
  const feitos = itens.filter((i) => i.ok).length;
  // 09/10: se já abriu tudo preenchido, o resumo não aparece (só aparece pra quem ainda tem o que preencher)
  const [resumoVisivel, setResumoVisivel] = useState<boolean | null>(null);
  useEffect(() => { if (!loading && resumoVisivel === null) setResumoVisivel(feitos < itens.length); }, [loading, feitos, itens.length, resumoVisivel]);
  const faltando = itens.filter((i) => !i.ok).map((i) => i.nome);

  // (17/10) Card já preenchido aparece resumido, com "Editar"; vazio (ou faltando algo) já abre o formulário
  type Bloco = "loja" | "redes" | "endereco" | "horario";
  const okDe = (b: Bloco) => b === "loja" ? itens[0].ok && itens[1].ok && itens[2].ok
    : b === "redes" ? !redesNoBanco || !!(instagram.trim() || facebook.trim())
    : b === "endereco" ? itens[3].ok : itens[4].ok;
  const [aberto, setAberto] = useState<Record<Bloco, boolean> | null>(null);
  useEffect(() => {
    if (!loading && !erroCarga && aberto === null) setAberto({ loja: !okDe("loja"), redes: !okDe("redes"), endereco: !okDe("endereco"), horario: !okDe("horario") });
  }, [loading, erroCarga, aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const abrir = (b: Bloco) => setAberto((a) => ({ ...(a || { loja: true, redes: true, endereco: true, horario: true }), [b]: true }));
  const estaAberto = (b: Bloco) => aberto?.[b] !== false;

  // (16/10) WhatsApp já preenchido vira um cartão verde em destaque (com Editar); vazio, já abre o campo
  const [zapAberto, setZapAberto] = useState<boolean | null>(null);
  useEffect(() => { if (!loading && zapAberto === null) setZapAberto(digitosTelefone(telefone).length < 10); }, [loading, zapAberto, telefone]);
  // (16/10) a descrição cresce com o texto (antes cortava num campo de 4 linhas)
  const descRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const t = descRef.current?.querySelector("textarea");
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight + 2}px`;
  }, [descricao, loading]);

  // (17/10) veio do antigo "Entrega e pagamento": desce direto pra essa parte
  const irEntrega = (useLocation().state as any)?.secao === "entrega";
  useEffect(() => {
    if (loading || !irEntrega) return;
    const t = window.setTimeout(() => document.getElementById("entrega-pagamento")?.scrollIntoView({ block: "start" }), 400);
    return () => window.clearTimeout(t);
  }, [loading, irEntrega]);

  const irPara = (id: string) => {
    // (17/10) o card resumido abre antes (o campo só existe com o formulário aberto)
    const bloco: Bloco | null = id === "dl-nome" || id === "dl-whats" || id === "dl-desc" ? "loja" : id === "dl-redes" ? "redes" : id === "dl-endereco" ? "endereco" : id === "dl-horario" ? "horario" : null;
    if (bloco && !estaAberto(bloco)) { abrir(bloco); window.setTimeout(() => irPara(id), 60); return; }
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = el.querySelector("input, textarea") as HTMLElement | null;
    window.setTimeout(() => input?.focus(), 350);
  };

  const mostrarAviso = (txt: string, tipo: "ok" | "err" = "ok") => avisar(txt, { tipo: tipo === "ok" ? "ok" : "erro" });

  const buscarCep = async (cep: string) => {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) { setCepOk(false); return; }
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setEnd((e) => ({ ...e, rua: d.logradouro || e.rua, bairro: d.bairro || e.bairro, cidade: d.localidade || e.cidade, estado: d.uf || e.estado }));
        setCepOk(true);
      } else {
        setCepOk(false);
      }
    } catch { setCepOk(false); }
    setBuscandoCep(false);
  };

  const gerarDescricao = async () => {
    if (!nome.trim()) { mostrarAviso("Preencha o nome da loja primeiro.", "err"); return; }
    setGerando(true);
    try {
      const res = await apiFetch("/api/gerar-descricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Crie uma descrição curta e atraente para uma confeitaria chamada "${nome.trim()}". Máximo 150 caracteres, português brasileiro, transmita carinho e qualidade. Retorne APENAS a descrição, sem aspas.`,
        }),
      });
      const data = await res.json();
      if (data?.error === "limite_diario") { mostrarAviso(data.message || "Você chegou ao limite de hoje. Amanhã libera de novo.", "err"); setGerando(false); return; }
      const texto = data.content?.[0]?.text?.trim();
      if (texto) setDescricao(texto.slice(0, 200));
      else mostrarAviso("A IA não respondeu. Tente de novo.", "err");
    } catch {
      mostrarAviso("A IA não respondeu. Tente de novo.", "err");
    }
    setGerando(false);
  };


  // (11/10) Confere o horário antes de salvar: fechar antes (ou na mesma hora) de abrir deixava o cardápio
  // sem nenhuma data pra agendar e a loja sempre "fechada". "00:00" no fechar vale como meia-noite.
  const problemaNoHorario = (): string | null => {
    const emMin = (h: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(h || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const blocos: [boolean, string, CampoHora, CampoHora][] = [
      [DIAS_UTEIS.some((d) => horario.dias.includes(d.nome)), "Dias de semana", "abertura", "fechamento"],
      [horario.abre_sabado, "Sábado", "sabado_abertura", "sabado_fechamento"],
      [horario.abre_domingo, "Domingo", "domingo_abertura", "domingo_fechamento"],
    ];
    for (const [abre, rotulo, campoAbre, campoFecha] of blocos) {
      if (!abre) continue;
      const a = emMin(horario[campoAbre]);
      const f = emMin(horario[campoFecha]);
      if (a === null || f === null) return `${rotulo}: escolha o horário de abrir e o de fechar.`;
      if ((f === 0 ? 24 * 60 : f) <= a) return `${rotulo}: o horário de fechar precisa ser depois do de abrir. Pra fechar à meia-noite, use 00:00.`;
    }
    return null;
  };

  const salvar = async () => {
    if (!userId) return;
    // (11/10) loja sem nome não salva
    if (!nome.trim()) { mostrarAviso("Escreva o nome da loja.", "err"); irPara("dl-nome"); return; }
    const horarioRuim = problemaNoHorario();
    if (horarioRuim) { mostrarAviso(horarioRuim, "err"); irPara("dl-horario"); return; }
    const insta = limparInstagram(instagram), face = limparFacebook(facebook);
    if (instagram.trim() && !insta) { mostrarAviso("Confira o Instagram: escreva só o @ da loja, como @doceformiga.", "err"); irPara("dl-redes"); return; }
    if (facebook.trim() && !face) { mostrarAviso("Confira o Facebook: cole o link da página, como facebook.com/doceformiga.", "err"); irPara("dl-redes"); return; }
    setSalvando(true);
    const endereco = JSON.stringify(end);
    const { error } = await supabase.from("profiles").update({
      nome_loja: nome.trim(),
      telefone,
      descricao_loja: descricao.trim(),
      endereco,
      mostrar_localizacao: mostrarLocal === "completo",
      mostrar_apenas_cidade: mostrarLocal === "cidade",
      endereco_retirada: recebeAqui
        ? [[end.rua, end.numero, end.complemento].filter(Boolean).join(", "), end.bairro, [end.cidade, end.estado].filter(Boolean).join("/")].filter(Boolean).join(" · ")
        : "",
      horario: JSON.stringify(horario),
    }).eq("id", userId);
    let erroRedes = false;
    if (!error && redesNoBanco) {
      const r = await supabase.from("profiles").update({ instagram: insta || null, facebook: face || null }).eq("id", userId);
      erroRedes = !!r.error;
      if (!r.error) { setInstagram(insta ? "@" + insta : ""); setFacebook(face); }
    }
    setSalvando(false);
    if (error) mostrarAviso("Não foi possível salvar. Tente de novo.", "err");
    else if (erroRedes) mostrarAviso("Salvou, menos as redes sociais. Tente de novo.", "err");
    else {
      mostrarAviso("Alterações salvas");
      // (17/10) o que ficou completo volta a aparecer resumido
      setAberto({ loja: !okDe("loja"), redes: !okDe("redes"), endereco: !okDe("endereco"), horario: !okDe("horario") });
      setZapAberto(digitosTelefone(telefone).length < 10);
    }
  };

  // (15/10) minimapa grátis (o mesmo dos primeiros passos): começa no Brasil e voa até a rua
  const [busca, setBusca] = useState<BuscaMapa>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setBusca(end.cidade.trim() ? { rua: end.rua.trim(), numero: end.numero.trim(), cidade: end.cidade.trim(), estado: end.estado.trim() } : null), 700);
    return () => window.clearTimeout(t);
  }, [end.rua, end.numero, end.cidade, end.estado]);
  const cidadeUf = [end.cidade.trim(), end.estado.trim()].filter(Boolean).join(", ");
  const seloMapa = !busca ? "Digite o CEP pra achar sua loja" : mostrarLocal === "nada" ? "Endereço escondido no cardápio" : [mostrarLocal === "completo" ? end.bairro.trim() : "", cidadeUf].filter(Boolean).join(" · ");

  // (17/10) resumido: sem o texto de apoio e com "Editar" ao lado do título (o botão nunca fica por cima de nada)
  const Cabeca = ({ Ic, titulo, apoio, bloco }: { Ic: typeof Storefront; titulo: string; apoio: string; bloco?: Bloco }) => {
    const resumido = !!bloco && !estaAberto(bloco);
    return (
      <div className="dl-cab"><span className="dl-cab-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span>
        <Titulo apoio={resumido ? undefined : apoio}
          acao={resumido ? <button type="button" className="dl-editar" onClick={() => abrir(bloco!)}><PencilSimple size={16} weight="bold" aria-hidden="true" />Editar</button> : undefined}>{titulo}</Titulo>
      </div>
    );
  };
  const DIA_CURTO: Record<string, string> = { Segunda: "Seg", "Terça": "Ter", Quarta: "Qua", Quinta: "Qui", Sexta: "Sex" };
  const hh = (h: string) => (h || "").replace(/^0(\d)/, "$1").replace(":00", "h").replace(/:(\d\d)$/, "h$1");
  const resumoHorario = (): string[] => {
    const linhas: string[] = [];
    const ord = DIAS_UTEIS.map((d) => d.nome).filter((n) => horario.dias.includes(n));
    if (ord.length) {
      const idx = ord.map((n) => DIAS_UTEIS.findIndex((d) => d.nome === n));
      const seguidos = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
      const dias = ord.length === 1 ? DIA_CURTO[ord[0]] : seguidos ? `${DIA_CURTO[ord[0]]} a ${DIA_CURTO[ord[ord.length - 1]]}` : ord.map((n) => DIA_CURTO[n]).join(", ");
      linhas.push(`${dias} · ${hh(horario.abertura)} às ${hh(horario.fechamento)}`);
    }
    if (horario.abre_sabado) linhas.push(`Sáb · ${hh(horario.sabado_abertura)} às ${hh(horario.sabado_fechamento)}`);
    if (horario.abre_domingo) linhas.push(`Dom · ${hh(horario.domingo_abertura)} às ${hh(horario.domingo_fechamento)}`);
    return linhas;
  };

  if (loading) {
    return (
      <>
        <AppPageHeader title="Dados da loja" subtitle="Loja, entrega e pagamento" onBack={() => navigate(voltarPara)} />
        <div className="dl-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
      </>
    );
  }
  if (erroCarga) {
    return (
      <>
        <AppPageHeader title="Dados da loja" subtitle="Loja, entrega e pagamento" onBack={() => navigate(voltarPara)} />
        <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu pra carregar os dados da loja" texto="Confira a internet e tente de novo." acao={<Botao variante="suave" tamanho="m" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Botao>} />
      </>
    );
  }

  const tudo = feitos === itens.length;
  const statusCep = buscandoCep ? <span className="dl-cep">Buscando…</span> : cepOk ? <span className="dl-cep ok"><Check size={16} weight="bold" />Encontrado</span> : null;

  return (
    <>
      <AppPageHeader title="Dados da loja" subtitle="Loja, entrega e pagamento" onBack={() => navigate(voltarPara)} />

      <div className="dl-root">
        {/* Resumo */}
        {resumoVisivel !== false && <section className="dl-card dl-st">
          <div className="dl-st-row">
            <b>{tudo ? "Tudo preenchido" : `${feitos} de ${itens.length} preenchidos`}</b>
            {faltando.length > 0 && (
              <span>Falta{faltando.length > 1 ? "m" : ""} {faltando.length > 1 ? faltando.slice(0, -1).join(", ") + " e " + faltando[faltando.length - 1] : faltando[0]}</span>
            )}
          </div>
          <div className="dl-bar" aria-hidden="true"><i className={tudo ? "ok" : ""} style={{ width: `${Math.round((feitos / itens.length) * 100)}%` }} /></div>
          <div className="dl-chips">
            {itens.map((i) => (
              <button key={i.nome} type="button" className={`dl-chip${i.ok ? " ok" : ""}`} onClick={() => irPara(i.alvo)}>
                {i.ok && <Check size={14} weight="bold" aria-hidden="true" />}{i.nome}
              </button>
            ))}
          </div>
        </section>}

        {/* Sua loja */}
        <section className="dl-card dl-loja">
          <Cabeca Ic={Storefront} titulo="Sua loja" apoio="Nome, WhatsApp e descrição" bloco="loja" />
          {!estaAberto("loja") ? (
            <div className="dl-res">
              <b className="dl-res-t">{nome}</b>
              <span className="dl-res-zap"><IconeWhatsApp size={16} />{telefone}</span>
              <p className="dl-res-desc">{descricao}</p>
            </div>
          ) : (<>
          <div id="dl-nome">
            <Campo id="dl-in-nome" rotulo="Nome da loja" value={nome} maxLength={60} placeholder="Ex.: Doce Formiga Confeitaria" onChange={(e) => setNome(e.target.value)} />
          </div>
          <div id="dl-whats">
            {zapAberto === false ? (
              <div className="dl-zapc">
                <span className="dl-zapc-ic" aria-hidden="true"><IconeWhatsApp size={22} /></span>
                <span className="dl-zapc-tx"><small>Recebe os pedidos</small><b>{telefone}</b></span>
                <button type="button" className="dl-zapc-bt" onClick={() => setZapAberto(true)} aria-label="Editar o WhatsApp" title="Editar"><PencilSimple size={18} weight="bold" aria-hidden="true" /></button>
              </div>
            ) : (
              <Campo id="dl-in-whats" rotulo="WhatsApp que recebe os pedidos" inputMode="tel" value={telefone} placeholder="(41) 99999-8888"
                icone={<IconeWhatsApp size={20} className="dl-zap" />} onChange={(e) => setTelefone(formatPhone(e.target.value, true))} />
            )}
          </div>
          <div id="dl-desc" className="dl-desc" ref={descRef}>
            <CampoArea id="dl-in-desc" rotulo="Descrição" value={descricao} maxLength={200} rows={3} autoComplete="off"
              placeholder={EXEMPLO_DESCRICAO} onChange={(e) => setDescricao(e.target.value)} />
            <div className="dl-desc-pe">
              <small>{descricao.length} de 200 caracteres</small>
              <button type="button" className="dl-ia" onClick={gerarDescricao} disabled={gerando}><Sparkle size={15} weight="fill" aria-hidden="true" />{gerando ? "Escrevendo…" : "Escrever com IA"}</button>
            </div>
          </div>
          </>)}
        </section>

        {/* (4.25) Redes sociais: aparecem em "Sobre a loja" no cardápio */}
        <section className="dl-card" id="dl-redes">
          <Cabeca Ic={ShareNetwork} titulo="Redes sociais" apoio="Aparecem em Sobre a loja, no cardápio" bloco="redes" />
          {redesNoBanco && !estaAberto("redes") ? (
            <div className="dl-res">
              {instagram.trim() && <span className="dl-res-li"><InstagramLogo size={18} aria-hidden="true" />{instagram.trim()}</span>}
              {facebook.trim() && <span className="dl-res-li"><FacebookLogo size={18} aria-hidden="true" />{facebook.trim().replace(/^https?:\/\/(www\.)?/, "")}</span>}
            </div>
          ) : redesNoBanco ? (
            <>
              <Campo id="dl-in-insta" rotulo="Instagram" value={instagram} maxLength={80} placeholder="@suaconfeitaria" autoCapitalize="none" autoCorrect="off"
                icone={<InstagramLogo size={20} />} onChange={(e) => setInstagram(e.target.value)} />
              <Campo id="dl-in-face" rotulo="Facebook" value={facebook} maxLength={120} placeholder="facebook.com/suaconfeitaria" autoCapitalize="none" autoCorrect="off"
                icone={<FacebookLogo size={20} />} onChange={(e) => setFacebook(e.target.value)} />
            </>
          ) : (
            <p className="dl-aviso-redes">Falta um ajuste no banco pra usar as redes sociais (SQL 4.25).</p>
          )}
        </section>

        {/* Endereço */}
        <section className="dl-card" id="dl-endereco">
          <Cabeca Ic={MapPin} titulo="Endereço" apoio="Pra calcular a entrega e mostrar no mapa" bloco="endereco" />
          <MapaEndereco busca={busca} soCidade={mostrarLocal !== "completo"} selo={estaAberto("endereco") ? seloMapa : undefined} />
          {!estaAberto("endereco") ? (
            <div className="dl-res">
              <b className="dl-res-t">{[end.rua.trim(), end.numero.trim()].filter(Boolean).join(", ") || cidadeUf}</b>
              <span className="dl-res-sub">{[end.complemento.trim(), end.bairro.trim(), cidadeUf, end.cep.trim()].filter(Boolean).join(" · ")}</span>
              <span className="dl-res-tag">{mostrarLocal === "completo" ? "No cardápio: endereço completo" : mostrarLocal === "cidade" ? "No cardápio: só a cidade" : "Escondido no cardápio"}</span>
            </div>
          ) : (<>
          <Campo id="dl-in-cep" rotulo="CEP" inputMode="numeric" value={end.cep} placeholder="00000-000" depois={statusCep}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 8);
              const v = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
              setEnd((x) => ({ ...x, cep: v }));
              if (d.length === 8) buscarCep(d); else setCepOk(false);
            }} />
          <div className="dl-g2n">
            <Campo id="dl-in-rua" rotulo="Rua" value={end.rua} onChange={(e) => setEnd((x) => ({ ...x, rua: e.target.value }))} />
            <Campo id="dl-in-num" rotulo="Número" inputMode="numeric" value={end.numero} onChange={(e) => setEnd((x) => ({ ...x, numero: e.target.value }))} />
          </div>
          <Campo id="dl-in-comp" rotulo="Complemento" opcional placeholder="Ex.: sala 3, fundos" value={end.complemento} onChange={(e) => setEnd((x) => ({ ...x, complemento: e.target.value }))} />
          <div className="dl-g2">
            <Campo id="dl-in-bairro" rotulo="Bairro" value={end.bairro} onChange={(e) => setEnd((x) => ({ ...x, bairro: e.target.value }))} />
            <Campo id="dl-in-cidade" rotulo="Cidade" value={end.cidade} onChange={(e) => setEnd((x) => ({ ...x, cidade: e.target.value }))} />
          </div>
          <div className="dl-bloco">
            <OpcoesMostrar mostrar={mostrarLocal} onMudar={setMostrarLocal} end={end} tituloClasse="dl-tit" />
          </div>
          <label className="dl-recebe">
            <input type="checkbox" checked={recebeAqui} onChange={(e) => setRecebeAqui(e.target.checked)} />
            <span className="dl-cx" aria-hidden="true">{recebeAqui && <Check size={16} weight="bold" />}</span>
            <span><b>Recebo pedidos aqui</b><small>O endereço completo aparece pro cliente só quando ele escolhe retirar a encomenda.</small></span>
          </label>
          </>)}
        </section>

        {/* Horário */}
        <section className="dl-card" id="dl-horario">
          <Cabeca Ic={Clock} titulo="Horário" apoio="Aparece como “Aberto agora” no cardápio" bloco="horario" />
          {!estaAberto("horario") ? (
            <div className="dl-res">
              {resumoHorario().map((l) => <span key={l} className="dl-res-li">{l}</span>)}
            </div>
          ) : (
            <div className="dl-bloco">
              <EditorHorario h={horario} onMudar={setHorario} tituloClasse="dl-tit" />
            </div>
          )}
        </section>
      </div>

      {/* (17/10) Entrega e pagamento entrou nesta mesma tela (salva sozinha, separada do botão abaixo) */}
      <div id="entrega-pagamento" className="dl-ep"><CheckoutConfigPage embutido /></div>

      {/* Salvar fixo */}
      <div className="dl-savebar">
        <Botao cheio className="dl-save" carregando={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar dados da loja"}</Botao>
      </div>

    </>
  );
}
