import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { Check, Clock, MapPin, Sparkle, Storefront, WhatsappLogo } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import HorarioSheet from "@/components/HorarioSheet";
import { Botao, Campo, CampoArea, Titulo, avisar } from "@/components/base";
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

function formatPhone(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function DadosLoja() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepOk, setCepOk] = useState(false);
  const [sheet, setSheet] = useState<CampoHora | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [descricao, setDescricao] = useState("");
  const [end, setEnd] = useState({ cep: "", rua: "", numero: "", bairro: "", cidade: "", estado: "" });
  const [mostrarLocal, setMostrarLocal] = useState<"completo" | "cidade" | "nada">("completo");
  // 02/10: "Recebo pedidos nesse endereço" — vira o endereço de retirada da Finalizar encomenda
  const [recebeAqui, setRecebeAqui] = useState(true);
  const [horario, setHorario] = useState<Horario>(HORARIO_PADRAO);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("nome_loja, telefone, descricao_loja, endereco, mostrar_localizacao, mostrar_apenas_cidade, horario, endereco_retirada, formas_entrega")
        .eq("id", user.id)
        .single();
      if (data) {
        setNome(data.nome_loja || "");
        setTelefone(formatPhone(data.telefone || ""));
        setDescricao(data.descricao_loja || "");
        let addr: any = {};
        try { addr = data.endereco ? (typeof data.endereco === "string" ? JSON.parse(data.endereco) : data.endereco) : {}; } catch { /* ignora */ }
        setEnd({ cep: addr.cep || "", rua: addr.rua || "", numero: addr.numero || "", bairro: addr.bairro || "", cidade: addr.cidade || "", estado: addr.estado || "" });
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
  }, []);

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

  const irPara = (id: string) => {
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
      const texto = data.content?.[0]?.text?.trim();
      if (texto) setDescricao(texto.slice(0, 200));
      else mostrarAviso("A IA não respondeu. Tente de novo.", "err");
    } catch {
      mostrarAviso("A IA não respondeu. Tente de novo.", "err");
    }
    setGerando(false);
  };

  const toggleDiaUtil = (diaNome: string) =>
    setHorario((h) => ({ ...h, dias: h.dias.includes(diaNome) ? h.dias.filter((d) => d !== diaNome) : [...h.dias, diaNome] }));

  const salvar = async () => {
    if (!userId) return;
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
        ? [[end.rua, end.numero].filter(Boolean).join(", "), end.bairro, [end.cidade, end.estado].filter(Boolean).join("/")].filter(Boolean).join(" · ")
        : "",
      horario: JSON.stringify(horario),
    }).eq("id", userId);
    setSalvando(false);
    if (error) mostrarAviso("Não foi possível salvar. Tente de novo.", "err");
    else mostrarAviso("Alterações salvas");
  };

  // Rótulo do período dos dias úteis marcados
  const ordem = DIAS_UTEIS.map((d) => d.nome);
  const diasMarcados = ordem.filter((d) => horario.dias.includes(d));
  const rotuloDiasUteis = diasMarcados.length === 5
    ? "Segunda a sexta"
    : diasMarcados.map((d) => DIAS_UTEIS.find((x) => x.nome === d)!.curto).join(", ");

  const tituloSheet: Record<CampoHora, string> = {
    abertura: "Abre às", fechamento: "Fecha às",
    sabado_abertura: "Sábado · abre às", sabado_fechamento: "Sábado · fecha às",
    domingo_abertura: "Domingo · abre às", domingo_fechamento: "Domingo · fecha às",
  };


  const BotoesHora = ({ abre, fecha }: { abre: CampoHora; fecha: CampoHora }) => (
    <div className="dl-tbtns">
      <button type="button" className="dl-tb" onClick={() => setSheet(abre)} aria-label={`${tituloSheet[abre]} ${horario[abre] || ""}`}>
        <Clock size={20} weight="bold" aria-hidden="true" /><span><small>Abre</small>{horario[abre] || "--:--"}</span>
      </button>
      <button type="button" className="dl-tb" onClick={() => setSheet(fecha)} aria-label={`${tituloSheet[fecha]} ${horario[fecha] || ""}`}>
        <Clock size={20} weight="bold" aria-hidden="true" /><span><small>Fecha</small>{horario[fecha] || "--:--"}</span>
      </button>
    </div>
  );

  const Cabeca = ({ Ic, titulo, apoio }: { Ic: typeof Storefront; titulo: string; apoio: string }) => (
    <div className="dl-cab"><span className="dl-cab-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><Titulo apoio={apoio}>{titulo}</Titulo></div>
  );

  if (loading) {
    return (
      <>
        <AppPageHeader title="Dados da loja" subtitle="O que o cliente vê sobre sua confeitaria" onBack={() => navigate("/cardapio")} />
        <div className="dl-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
      </>
    );
  }

  const tudo = feitos === itens.length;
  const statusCep = buscandoCep ? <span className="dl-cep">Buscando…</span> : cepOk ? <span className="dl-cep ok"><Check size={16} weight="bold" />Encontrado</span> : null;

  return (
    <>
      <AppPageHeader title="Dados da loja" subtitle="O que o cliente vê sobre sua confeitaria" onBack={() => navigate("/cardapio")} />

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
          <Cabeca Ic={Storefront} titulo="Sua loja" apoio="Nome, WhatsApp e a frase que aparecem no cardápio" />
          <div id="dl-nome">
            <Campo id="dl-in-nome" rotulo="Nome da loja" value={nome} maxLength={60} placeholder="Ex.: Doce Formiga Confeitaria" onChange={(e) => setNome(e.target.value)} />
          </div>
          <div id="dl-whats">
            <Campo id="dl-in-whats" rotulo="WhatsApp que recebe os pedidos" inputMode="tel" value={telefone} placeholder="(41) 99999-8888"
              icone={<WhatsappLogo size={20} weight="bold" className="dl-zap" />} onChange={(e) => setTelefone(formatPhone(e.target.value))} />
          </div>
          <div id="dl-desc" className="dl-desc">
            <CampoArea id="dl-in-desc" rotulo="Descrição" value={descricao} maxLength={200} rows={4}
              placeholder="Conte em uma frase o que sua confeitaria tem de especial"
              dica={`${descricao.length} de 200 letras`} onChange={(e) => setDescricao(e.target.value)} />
            <Botao variante="suave" tamanho="p" className="dl-ia" icone={<Sparkle size={16} weight="bold" />} carregando={gerando} onClick={gerarDescricao}>
              {gerando ? "Escrevendo…" : "Escrever com IA"}
            </Botao>
          </div>
        </section>

        {/* Endereço */}
        <section className="dl-card" id="dl-endereco">
          <Cabeca Ic={MapPin} titulo="Endereço" apoio="Pra calcular a entrega e mostrar no mapa" />
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
          <div className="dl-g2">
            <Campo id="dl-in-bairro" rotulo="Bairro" value={end.bairro} onChange={(e) => setEnd((x) => ({ ...x, bairro: e.target.value }))} />
            <Campo id="dl-in-cidade" rotulo="Cidade" value={end.cidade} onChange={(e) => setEnd((x) => ({ ...x, cidade: e.target.value }))} />
          </div>
          <div className="ui-campo">
            <span className="ui-campo-r" id="dl-mostrar"><span>No cardápio, mostrar</span></span>
            <div className="dl-seg" role="radiogroup" aria-labelledby="dl-mostrar">
              {([["completo", "Completo"], ["cidade", "Só a cidade"], ["nada", "Não mostrar"]] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={mostrarLocal === v} onClick={() => setMostrarLocal(v)}>{l}</button>
              ))}
            </div>
          </div>
          <label className="dl-recebe">
            <input type="checkbox" checked={recebeAqui} onChange={(e) => setRecebeAqui(e.target.checked)} />
            <span className="dl-cx" aria-hidden="true">{recebeAqui && <Check size={16} weight="bold" />}</span>
            <span><b>Recebo pedidos nesse endereço</b><small>O cliente vê esse endereço pra retirar a encomenda.</small></span>
          </label>
        </section>

        {/* Horário */}
        <section className="dl-card" id="dl-horario">
          <Cabeca Ic={Clock} titulo="Horário de funcionamento" apoio="Aparece como “Aberto agora” no cardápio" />
          <p className="dl-dias-t">Dias em que a loja abre</p>
          <div className="dl-days">
            {DIAS_UTEIS.map((d) => (
              <button key={d.nome} type="button" className={horario.dias.includes(d.nome) ? "on" : ""} aria-pressed={horario.dias.includes(d.nome)} aria-label={d.nome} onClick={() => toggleDiaUtil(d.nome)}>
                <span className="dl-bola">{d.curto}</span>
              </button>
            ))}
            <button type="button" className={horario.abre_sabado ? "on" : ""} aria-pressed={horario.abre_sabado} aria-label="Sábado" onClick={() => setHorario((h) => ({ ...h, abre_sabado: !h.abre_sabado }))}>
              <span className="dl-bola">Sáb</span>
            </button>
            <button type="button" className={horario.abre_domingo ? "on" : ""} aria-pressed={horario.abre_domingo} aria-label="Domingo" onClick={() => setHorario((h) => ({ ...h, abre_domingo: !h.abre_domingo }))}>
              <span className="dl-bola">Dom</span>
            </button>
          </div>

          {diasMarcados.length > 0 && (
            <div className="dl-hr"><b>{rotuloDiasUteis}</b><BotoesHora abre="abertura" fecha="fechamento" /></div>
          )}
          {horario.abre_sabado && (
            <div className="dl-hr"><b>Sábado</b><BotoesHora abre="sabado_abertura" fecha="sabado_fechamento" /></div>
          )}
          {horario.abre_domingo && (
            <div className="dl-hr"><b>Domingo</b><BotoesHora abre="domingo_abertura" fecha="domingo_fechamento" /></div>
          )}
          {diasMarcados.length === 0 && !horario.abre_sabado && !horario.abre_domingo && (
            <p className="dl-vazio">Toque nos dias em que a loja abre.</p>
          )}
        </section>
      </div>

      {/* Salvar fixo */}
      <div className="dl-savebar">
        <Botao cheio className="dl-save" carregando={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar alterações"}</Botao>
      </div>

      {sheet && (
        <HorarioSheet
          titulo={tituloSheet[sheet]}
          value={horario[sheet]}
          onChange={(v) => setHorario((h) => ({ ...h, [sheet]: v }))}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}
