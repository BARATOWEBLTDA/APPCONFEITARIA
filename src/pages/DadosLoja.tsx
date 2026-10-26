import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { CaretRight, Check, Clock, PencilSimple, MapPin, QrCode, ShareNetwork, Sparkle, Storefront, Truck, Wallet, WarningCircle } from "@phosphor-icons/react";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { LogoFacebook, LogoInstagram } from "@/components/LogosRedes";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_DADOS_LOJA, TOUR_DADOS_LOJA } from "@/lib/comoTelas";
import MapaEndereco, { type BuscaMapa } from "@/components/MapaEndereco";
import { EXEMPLO_DESCRICAO, EditorHorario, OpcoesMostrar } from "@/components/loja/EditoresLoja";
import { Botao, Campo, CampoArea, Gaveta, TelaVazia, Titulo, avisar } from "@/components/base";
import { digitosTelefone, digitosAoDigitar } from "@/lib/telefone";
import { limparFacebook, limparInstagram } from "@/lib/redesSociais";
import ListaChaves from "@/components/loja/ListaChaves";
import CheckoutConfigPage, { type EstadoEntregaPagamento } from "./CheckoutConfigPage";
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

/**
 * (23/10) embutido: a mesma lista, sem o topo, dentro da "Minha loja" do celular (tela Cardápio), em dois blocos:
 * "A loja para o cliente" e "Como você vende". extras = linhas da Minha loja que entram no primeiro bloco (logo e aparência).
 */
export default function DadosLoja({ embutido = false, extras }: { embutido?: boolean; extras?: { antes?: ReactNode; depois?: ReactNode } } = {}) {
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
  // (17/10) cada rede tem a sua chave: desligada, não aparece no cardápio (o texto fica guardado neste aparelho e volta ao ligar)
  const [instaOn, setInstaOn] = useState(false);
  const [faceOn, setFaceOn] = useState(false);

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
        else {
          setRedesNoBanco(true);
          const ig = (r.data as any)?.instagram ? "@" + (r.data as any).instagram : "", fb = (r.data as any)?.facebook || "";
          let guardado: { instagram?: string; facebook?: string } = {};
          try { guardado = JSON.parse(localStorage.getItem(`doonly:redes:${user.id}`) || "{}") || {}; } catch { /* sem armazenamento */ }
          setInstagram(ig || guardado.instagram || ""); setFacebook(fb || guardado.facebook || "");
          setInstaOn(!!ig); setFaceOn(!!fb);
        }
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
  // (22/10) celular: lista de 7 partes, cada uma numa gaveta. Computador: a mesma lista à esquerda e a parte escolhida à direita
  const [cel, setCel] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const f = () => setCel(mq.matches);
    mq.addEventListener("change", f); return () => mq.removeEventListener("change", f);
  }, []);

  // (17/10) Card já preenchido aparece resumido, com "Editar"; vazio (ou faltando algo) já abre o formulário
  type Bloco = "loja" | "redes" | "endereco" | "horario";
  const okDe = (b: Bloco) => b === "loja" ? itens[0].ok && itens[1].ok && itens[2].ok
    : b === "redes" ? !redesNoBanco || (instaOn && !!instagram.trim()) || (faceOn && !!facebook.trim())
    : b === "endereco" ? itens[3].ok : itens[4].ok;
  const [aberto, setAberto] = useState<Record<Bloco, boolean> | null>(null);
  useEffect(() => {
    if (!loading && !erroCarga && aberto === null) setAberto({ loja: !okDe("loja"), redes: !okDe("redes"), endereco: !okDe("endereco"), horario: !okDe("horario") });
  }, [loading, erroCarga, aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const abrir = (b: Bloco) => setAberto((a) => ({ ...(a || { loja: true, redes: true, endereco: true, horario: true }), [b]: true }));
  // no computador a parte escolhida já abre editando (o resumo fica na lista da esquerda)
  const estaAberto = (b: Bloco) => !cel || aberto?.[b] !== false;

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
      if ((f === 0 ? 24 * 60 : f) <= a) return `${rotulo}: o horário de fechar precisa ser depois do de abrir. Para fechar à meia-noite, use 00:00.`;
    }
    return null;
  };

  // (22/10) silencioso = salvar sozinho do computador: não mostra aviso a cada pausa; o que falta aparece no topo da parte
  const [faltaPc, setFaltaPc] = useState("");
  const salvar = async (opc?: { silencioso?: boolean }) => {
    if (!userId) return false;
    const quieto = !!opc?.silencioso;
    const barrar = (txt: string, alvo: string) => { if (quieto) setFaltaPc(txt); else { mostrarAviso(txt, "err"); irPara(alvo); } return false; };
    // (11/10) loja sem nome não salva
    if (!nome.trim()) return barrar("Escreva o nome da loja.", "dl-nome");
    const horarioRuim = problemaNoHorario();
    if (horarioRuim) return barrar(horarioRuim, "dl-horario");
    const insta = instaOn ? limparInstagram(instagram) : "", face = faceOn ? limparFacebook(facebook) : "";
    try { localStorage.setItem(`doonly:redes:${userId}`, JSON.stringify({ instagram: instagram.trim(), facebook: facebook.trim() })); } catch { /* sem armazenamento */ }
    if (instaOn && instagram.trim() && !insta) return barrar("Confira o Instagram: escreva só o @ da loja, como @doceformiga.", "dl-redes");
    if (faceOn && facebook.trim() && !face) return barrar("Confira o Facebook: cole o link da página, como facebook.com/doceformiga.", "dl-redes");
    setFaltaPc("");
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
      if (!r.error) { if (insta) setInstagram("@" + insta); if (face) setFacebook(face); if (!insta) setInstaOn(false); if (!face) setFaceOn(false); }
    }
    setSalvando(false);
    if (error) { mostrarAviso("Não foi possível salvar. Tente de novo.", "err"); return false; }
    else if (erroRedes) { mostrarAviso("Salvou, menos as redes sociais. Tente de novo.", "err"); return false; }
    else {
      if (quieto) return true;
      mostrarAviso("Alterações salvas");
      // (17/10) o que ficou completo volta a aparecer resumido
      setAberto({ loja: !okDe("loja"), redes: !okDe("redes"), endereco: !okDe("endereco"), horario: !okDe("horario") });
      setZapAberto(digitosTelefone(telefone).length < 10);
      return true;
    }
  };

  // (15/10) minimapa grátis (o mesmo dos primeiros passos): começa no Brasil e voa até a rua
  const [busca, setBusca] = useState<BuscaMapa>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setBusca(end.cidade.trim() ? { rua: end.rua.trim(), numero: end.numero.trim(), cidade: end.cidade.trim(), estado: end.estado.trim() } : null), 700);
    return () => window.clearTimeout(t);
  }, [end.rua, end.numero, end.cidade, end.estado]);
  // ── (22/10) celular: a tela vira uma lista de 7 partes; cada uma abre numa gaveta e salva sozinha ao fechar ──
  type Parte = "loja" | "redes" | "endereco" | "horario" | "pag" | "pix" | "ent";
  const [parte, setParte] = useState<Parte | null>(null);
  const [fechando, setFechando] = useState(false);
  const fotoDados = () => JSON.stringify({ nome, telefone, descricao, end, mostrarLocal, recebeAqui, horario, instagram, facebook, instaOn, faceOn });
  const fotoAoAbrir = useRef("");
  const abrirParte = (p: Parte) => {
    if (p === "loja" || p === "redes" || p === "endereco" || p === "horario") { abrir(p); setZapAberto(digitosTelefone(telefone).length < 10 ? true : zapAberto); }
    fotoAoAbrir.current = fotoDados();
    setParte(p);
  };
  // fechar = salvar sozinho (só se mudou algo). Se faltar alguma coisa, avisa e a gaveta continua aberta.
  const fecharParte = async () => {
    if (fechando) return;
    if (parte && ["loja", "redes", "endereco", "horario"].includes(parte) && fotoDados() !== fotoAoAbrir.current) {
      setFechando(true);
      const ok = await salvar();
      setFechando(false);
      if (!ok) return;
    }
    setParte(null);
  };
  // resumo de Pagamento, Pix e Entrega (lido do perfil e atualizado ao vivo pela gaveta)
  const [ep, setEp] = useState<EstadoEntregaPagamento | null>(null);
  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("formas_pagamento, formas_entrega, valor_entrega_propria, entrega_por_bairro, pix_online, pix_chave, pix_modo, pix_sinal_pct").eq("id", userId).maybeSingle().then(({ data }) => {
      if (!data) return;
      const d: any = data;
      setEp(e => e || { formasPagamento: d.formas_pagamento || [], formasEntrega: d.formas_entrega || [], taxa: Number(d.valor_entrega_propria) || 0,
        porBairro: Array.isArray(d.entrega_por_bairro) ? d.entrega_por_bairro.length : 0, pixOnline: !!d.pix_online, pixPronto: !!d.pix_chave,
        pixTipo: "", pixModo: d.pix_modo || "escolha", pixPct: String(d.pix_sinal_pct || 50) });
    });
  }, [userId]);
  // veio do "Definir taxa de entrega" (ou do antigo Entrega e pagamento): abre direto a Entrega
  useEffect(() => { if (!loading && irEntrega) setParte("ent"); }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps
  // (22/10) computador: salva sozinho quando ela para de digitar (sem botão Salvar)
  const salvoPc = useRef("");
  const fotoAgora = fotoDados();
  useEffect(() => {
    if (cel || embutido || loading || erroCarga) return;
    if (!salvoPc.current) { salvoPc.current = fotoAgora; return; }
    if (fotoAgora === salvoPc.current) return;
    const t = window.setTimeout(async () => { if (await salvar({ silencioso: true })) salvoPc.current = fotoAgora; }, 900);
    return () => window.clearTimeout(t);
  }, [cel, embutido, loading, erroCarga, fotoAgora]); // eslint-disable-line react-hooks/exhaustive-deps

  const cidadeUf = [end.cidade.trim(), end.estado.trim()].filter(Boolean).join(", ");

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

  if (embutido && (loading || erroCarga)) {
    return loading ? <div className="dl-emb-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
      : <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu para carregar os dados da loja" texto="Confira a internet e tente de novo." acao={<Botao variante="suave" tamanho="m" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Botao>} />;
  }
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
        <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu para carregar os dados da loja" texto="Confira a internet e tente de novo." acao={<Botao variante="suave" tamanho="m" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Botao>} />
      </>
    );
  }

  const statusCep = buscandoCep ? <span className="dl-cep">Buscando…</span> : cepOk ? <span className="dl-cep ok"><Check size={16} weight="bold" />Encontrado</span> : null;

  // (22/10) as 4 partes viram constantes: no computador ficam na página; no celular cada uma abre numa gaveta
  const secLoja = (
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
  );
  const secRedes = (
    <section className="dl-card" id="dl-redes">
          <Cabeca Ic={ShareNetwork} titulo="Redes sociais" apoio="Aparecem em Sobre a loja, no cardápio" bloco="redes" />
          {redesNoBanco && !estaAberto("redes") ? (
            <div className="dl-res">
              {instaOn && instagram.trim() && <span className="dl-res-li"><LogoInstagram tamanho={20} />{instagram.trim()}</span>}
              {faceOn && facebook.trim() && <span className="dl-res-li"><LogoFacebook tamanho={20} />{facebook.trim().replace(/^https?:\/\/(www\.)?/, "")}</span>}
            </div>
          ) : redesNoBanco ? (
            <>
              <div className={`dl-rede${instaOn ? " on" : ""}`}>
                <button type="button" role="switch" aria-checked={instaOn} className="dl-rede-l" onClick={() => setInstaOn((v) => !v)}>
                  <LogoInstagram tamanho={26} /><span className="dl-rede-n"><b>Instagram</b><small>{instaOn ? "Aparece no cardápio" : "Não aparece no cardápio"}</small></span><span className="dl-rede-sw" aria-hidden="true" />
                </button>
                {instaOn && <Campo id="dl-in-insta" rotulo="@ do Instagram" value={instagram} maxLength={80} placeholder="@suaconfeitaria" autoCapitalize="none" autoCorrect="off"
                  onChange={(e) => setInstagram(e.target.value)} />}
              </div>
              <div className={`dl-rede${faceOn ? " on" : ""}`}>
                <button type="button" role="switch" aria-checked={faceOn} className="dl-rede-l" onClick={() => setFaceOn((v) => !v)}>
                  <LogoFacebook tamanho={26} /><span className="dl-rede-n"><b>Facebook</b><small>{faceOn ? "Aparece no cardápio" : "Não aparece no cardápio"}</small></span><span className="dl-rede-sw" aria-hidden="true" />
                </button>
                {faceOn && <Campo id="dl-in-face" rotulo="Link da página" value={facebook} maxLength={120} placeholder="facebook.com/suaconfeitaria" autoCapitalize="none" autoCorrect="off"
                  onChange={(e) => setFacebook(e.target.value)} />}
              </div>
            </>
          ) : (
            <p className="dl-aviso-redes">Falta um ajuste no banco para usar as redes sociais (SQL 4.25).</p>
          )}
        </section>
  );
  const secEndereco = (
    <section className="dl-card" id="dl-endereco">
          <Cabeca Ic={MapPin} titulo="Endereço" apoio="Para calcular a entrega e mostrar no mapa" bloco="endereco" />
          {!estaAberto("endereco") && <MapaEndereco busca={busca} soCidade={mostrarLocal !== "completo"} selo="" />}
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
            <MapaEndereco busca={busca} soCidade={mostrarLocal !== "completo"} selo={mostrarLocal === "nada" ? "O endereço não aparece no cardápio" : mostrarLocal === "completo" ? ([[end.rua.trim(), end.numero.trim()].filter(Boolean).join(", "), end.bairro.trim()].filter(Boolean).join(" · ") || cidadeUf) : cidadeUf} altura={124} />
            <p className="dl-mapa-nota">{mostrarLocal === "nada" ? "Bom para quem atende em casa." : "É assim que o cliente vê, em Sobre a loja."}</p>
          </div>
          <ListaChaves itens={[{ chave: "recebe", Ic: Storefront, rotulo: "Recebo pedidos aqui", sub: "Endereço para quem vai retirar", on: recebeAqui, aoTocar: () => setRecebeAqui(v => !v) }]} />
          </>)}
        </section>
  );
  const secHorario = (
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
  );

  const NOME_PAG: Record<string, string> = { pix: "Pix", dinheiro: "dinheiro", credito: "crédito", debito: "débito" };
  const listaBR = (xs: string[]) => xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1];
  const pagTxt = ep ? listaBR((ep.formasPagamento || []).map(k => NOME_PAG[k] || k)) : "";
  const temPix = !!ep?.formasPagamento?.includes("pix");
  const temEntregaPropria = !!ep?.formasEntrega?.includes("entrega_propria");
  const faltaTaxa = temEntregaPropria && (ep?.taxa || 0) <= 0 && !(ep?.porBairro);
  const redesTxt = [instaOn && instagram.trim() ? "Instagram" : "", faceOn && facebook.trim() ? "Facebook" : ""].filter(Boolean);
  type Linha = { k: Parte; Ic: typeof Storefront; t: string; sub: string; st: "ok" | "falta" | "op" };
  const linhas: Linha[] = [
    { k: "loja", Ic: Storefront, t: "Sua loja", sub: okDe("loja") ? [nome.trim(), telefone].filter(Boolean).join(" · ") : `Falta ${listaBR(itens.slice(0, 3).filter(i => !i.ok).map(i => i.nome === "WhatsApp" ? "o WhatsApp" : i.nome === "Nome" ? "o nome" : "a descrição"))}`, st: okDe("loja") ? "ok" : "falta" },
    { k: "redes", Ic: ShareNetwork, t: "Redes sociais", sub: redesTxt.length ? `${listaBR(redesTxt)} no cardápio` : "Nenhuma aparece no cardápio", st: redesTxt.length ? "ok" : "op" },
    { k: "endereco", Ic: MapPin, t: "Endereço", sub: itens[3].ok ? [[end.rua.trim(), end.numero.trim()].filter(Boolean).join(", "), end.bairro.trim()].filter(Boolean).join(" · ") || cidadeUf : "Falta o endereço da loja", st: itens[3].ok ? "ok" : "falta" },
    { k: "horario", Ic: Clock, t: "Horário", sub: itens[4].ok ? resumoHorario().join(" · ") : "Falta o horário de funcionamento", st: itens[4].ok ? "ok" : "falta" },
    { k: "pag", Ic: Wallet, t: "Pagamento", sub: !ep ? "…" : pagTxt ? pagTxt.charAt(0).toUpperCase() + pagTxt.slice(1) : "Falta escolher como o cliente paga", st: !ep || pagTxt ? "ok" : "falta" },
    ...(temPix ? [{ k: "pix" as Parte, Ic: QrCode, t: "Pix pelo cardápio", sub: ep!.pixOnline ? (ep!.pixModo === "total" ? "Ligado · cliente paga o total" : ep!.pixModo === "sinal" ? `Ligado · sinal de ${ep!.pixPct}%` : `Ligado · sinal de ${ep!.pixPct}% ou o total`) : "Desligado · paga pelo WhatsApp", st: (ep!.pixOnline ? "ok" : "op") as Linha["st"] }] : []),
    { k: "ent", Ic: Truck, t: "Entrega", sub: !ep ? "…" : !(ep.formasEntrega || []).length ? "Falta escolher como o cliente recebe" : faltaTaxa ? "Falta a taxa de entrega" : [ep.formasEntrega.includes("retirada") ? "Retirada" : "", temEntregaPropria ? (ep.porBairro ? "entrega por bairro" : `entrega R$ ${ep.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : ""].filter(Boolean).join(" e ") || "Configurada", st: !ep ? "ok" : !(ep.formasEntrega || []).length || faltaTaxa ? "falta" : "ok" },
  ];
  const TITULO: Record<Parte, string> = { loja: embutido ? "Sobre a loja" : "Sua loja", redes: "Redes sociais", endereco: "Endereço", horario: "Horário", pag: "Pagamento", pix: "Pix pelo cardápio", ent: "Entrega" };
  const gaveta = (
    <Gaveta aberta={!!parte} aoFechar={fecharParte} titulo={parte ? TITULO[parte] : ""}
      rodape={<Botao cheio carregando={fechando} onClick={fecharParte}>{fechando ? "Salvando…" : "Pronto"}</Botao>}>
      <div className="dl-folha">
        {parte === "loja" && secLoja}
        {parte === "redes" && secRedes}
        {parte === "endereco" && secEndereco}
        {parte === "horario" && secHorario}
        {(parte === "pag" || parte === "pix" || parte === "ent") && <CheckoutConfigPage embutido parte="entrega" so={parte} onEstado={setEp} />}
      </div>
    </Gaveta>
  );
  if (embutido) {
    // (23/10) no estilo do Dora: cada linha mostra o valor atual e só o que falta ganha destaque (sem os vistos verdes)
    const linhaEmb = (k: Parte, titulo?: string) => {
      const l = linhas.find(x => x.k === k);
      if (!l) return null;
      return (
        <button key={l.k} type="button" className="dl-li" onClick={() => abrirParte(l.k)}>
          <span className="dl-li-ic" aria-hidden="true"><l.Ic size={20} weight="bold" /></span>
          <span className="dl-li-tx"><b>{titulo || l.t}</b><small className={l.st === "falta" ? "falta" : ""}>{l.sub}</small></span>
          {l.st === "falta" && <em className="dl-li-st falta">Falta</em>}
          <CaretRight size={16} weight="bold" className="dl-li-seta" aria-hidden="true" />
        </button>
      );
    };
    return (
      <>
        <section className="dl-emb ml-cliente" aria-label="A loja para o cliente">
          <h2 className="dl-emb-t">A loja para o cliente</h2>
          <div className="dl-lista-c">{extras?.antes}{linhaEmb("loja", "Sobre a loja")}{extras?.depois}{linhaEmb("redes")}</div>
        </section>
        <section className="dl-emb ml-vende" aria-label="Como você vende">
          <h2 className="dl-emb-t">Como você vende</h2>
          <div className="dl-lista-c">{linhaEmb("horario")}{linhaEmb("ent")}{linhaEmb("pag")}{linhaEmb("pix")}{linhaEmb("endereco")}</div>
        </section>
        {gaveta}
      </>
    );
  }
  if (cel) {
    return (
      <>
        <AppPageHeader title="Dados da loja" subtitle="Loja, entrega e pagamento" onBack={() => navigate(voltarPara)} infoComo={COMO_DADOS_LOJA} infoTour={TOUR_DADOS_LOJA} />
        <div className="dl-lista">
          <div className="dl-lista-c">
            {linhas.map(l => (
              <button key={l.k} type="button" className="dl-li" onClick={() => abrirParte(l.k)}>
                <span className="dl-li-ic" aria-hidden="true"><l.Ic size={20} weight="bold" /></span>
                <span className="dl-li-tx"><b>{l.t}</b><small className={l.st === "falta" ? "falta" : ""}>{l.sub}</small></span>
                {l.st === "ok" ? <span className="dl-li-ok" aria-label="Pronto"><Check size={13} weight="bold" /></span> : <em className={`dl-li-st ${l.st}`}>{l.st === "falta" ? "Falta" : "Opcional"}</em>}
                <CaretRight size={16} weight="bold" className="dl-li-seta" aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="dl-lista-salva"><Check size={16} weight="bold" aria-hidden="true" />Salva sozinho ao fechar a parte.</p>
        </div>
        {gaveta}
      </>
    );
  }

  // (22/10) computador: a lista das 7 partes à esquerda e a parte escolhida à direita, salvando sozinha
  const parteVista: Parte = parte ?? (linhas.find(l => l.st === "falta")?.k || "loja");
  const sujo = !!salvoPc.current && fotoAgora !== salvoPc.current;
  const ehDaPagina = parteVista === "loja" || parteVista === "redes" || parteVista === "endereco" || parteVista === "horario";
  return (
    <>
      <AppPageHeader title="Dados da loja" subtitle="Loja, entrega e pagamento" onBack={() => navigate(voltarPara)} infoComo={COMO_DADOS_LOJA} infoTour={TOUR_DADOS_LOJA} />
      <div className="dl-pc">
        <div className="dl-lista dl-lista--pc">
          <div className="dl-lista-c">
            {linhas.map(l => (
              <button key={l.k} type="button" className={`dl-li${l.k === parteVista ? " on" : ""}`} aria-current={l.k === parteVista ? "true" : undefined} onClick={() => { abrirParte(l.k); }}>
                <span className="dl-li-ic" aria-hidden="true"><l.Ic size={20} weight="bold" /></span>
                <span className="dl-li-tx"><b>{l.t}</b><small className={l.st === "falta" ? "falta" : ""}>{l.sub}</small></span>
                {l.st === "ok" ? <span className="dl-li-ok" aria-label="Pronto"><Check size={13} weight="bold" /></span> : <em className={`dl-li-st ${l.st}`}>{l.st === "falta" ? "Falta" : "Opcional"}</em>}
                <CaretRight size={16} weight="bold" className="dl-li-seta" aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="dl-lista-salva"><Check size={16} weight="bold" aria-hidden="true" />Tudo salva sozinho.</p>
        </div>
        <section className="dl-painel" aria-label={TITULO[parteVista]}>
          <div className="dl-painel-cab">
            <h2>{TITULO[parteVista]}</h2>
            {ehDaPagina && (faltaPc ? <span className="dl-painel-st falta">{faltaPc}</span>
              : <span className="dl-painel-st">{sujo || salvando ? "Salvando…" : <><Check size={14} weight="bold" aria-hidden="true" />Tudo salvo</>}</span>)}
          </div>
          <div className="dl-folha">
            {parteVista === "loja" && secLoja}
            {parteVista === "redes" && secRedes}
            {parteVista === "endereco" && secEndereco}
            {parteVista === "horario" && secHorario}
            {(parteVista === "pag" || parteVista === "pix" || parteVista === "ent") && <CheckoutConfigPage key={parteVista} embutido parte="entrega" so={parteVista} onEstado={setEp} />}
          </div>
        </section>
      </div>
    </>
  );
}
