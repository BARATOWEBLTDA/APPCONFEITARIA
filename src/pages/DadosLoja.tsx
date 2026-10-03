import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import AppPageHeader from "@/components/AppPageHeader";
import HorarioSheet from "@/components/HorarioSheet";

/**
 * Dados da loja — página única (aprovada 29/09).
 * Nome, WhatsApp, descrição, endereço e horário. Logo e avaliação ficam em Aparência;
 * pagamento/entrega em "Entrega e pagamento". Sem "Ver cardápio"/"Copiar link" aqui.
 * Mesmo formato de dados de antes (profiles.telefone formatado, endereco e horario em JSON).
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

const IconeWhats = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#16a34a" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.1 1.4z" />
  </svg>
);
const IconeRelogio = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B5D64" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);
const IconeOk = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function DadosLoja() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ txt: string; tipo: "ok" | "err" } | null>(null);
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
  const faltando = itens.filter((i) => !i.ok).map((i) => i.nome);

  const irPara = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = el.querySelector("input, textarea") as HTMLElement | null;
    window.setTimeout(() => input?.focus(), 350);
  };

  const mostrarAviso = (txt: string, tipo: "ok" | "err" = "ok") => {
    setAviso({ txt, tipo });
    window.setTimeout(() => setAviso(null), 3000);
  };

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
    ? "Seg a Sex"
    : diasMarcados.map((d) => DIAS_UTEIS.find((x) => x.nome === d)!.curto).join(", ");

  const tituloSheet: Record<CampoHora, string> = {
    abertura: "Abre às", fechamento: "Fecha às",
    sabado_abertura: "Sábado · abre às", sabado_fechamento: "Sábado · fecha às",
    domingo_abertura: "Domingo · abre às", domingo_fechamento: "Domingo · fecha às",
  };

  const BotoesHora = ({ abre, fecha }: { abre: CampoHora; fecha: CampoHora }) => (
    <div className="dl-tbtns">
      <button type="button" className="dl-tb" onClick={() => setSheet(abre)}>
        <IconeRelogio /><span><small>Abre</small>{horario[abre] || "--:--"}</span>
      </button>
      <button type="button" className="dl-tb" onClick={() => setSheet(fecha)}>
        <IconeRelogio /><span><small>Fecha</small>{horario[fecha] || "--:--"}</span>
      </button>
    </div>
  );

  if (loading) {
    return (
      <>
        <AppPageHeader title="Dados da loja" subtitle="O que o cliente vê sobre sua confeitaria" onBack={() => navigate("/cardapio")} />
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><span className="dl-spin" /></div>
        <style>{`.dl-spin{width:28px;height:28px;border-radius:50%;border:3px solid #FCE0E9;border-top-color:#E85A8C;animation:dlspin .7s linear infinite;display:inline-block}@keyframes dlspin{to{transform:rotate(360deg)}}`}</style>
      </>
    );
  }

  return (
    <>
      <AppPageHeader title="Dados da loja" subtitle="O que o cliente vê sobre sua confeitaria" onBack={() => navigate("/cardapio")} />

      <div className="dl-root">
        {/* Resumo */}
        <div className="dl-card dl-st">
          <div className="dl-st-row">
            <b>{feitos === itens.length ? "Tudo preenchido ✓" : `${feitos} de ${itens.length} preenchidos`}</b>
            {faltando.length > 0 && (
              <span>Falta{faltando.length > 1 ? "m" : ""} {faltando.length > 1 ? faltando.slice(0, -1).join(", ") + " e " + faltando[faltando.length - 1] : faltando[0]}</span>
            )}
          </div>
          <div className="dl-bar"><i style={{ width: `${Math.round((feitos / itens.length) * 100)}%`, background: feitos === itens.length ? "#16a34a" : "#F59E0B" }} /></div>
          <div className="dl-chips">
            {itens.map((i) => (
              <button key={i.nome} type="button" className={`dl-chip${i.ok ? " ok" : ""}`} onClick={() => irPara(i.alvo)}>
                {i.ok && <i><IconeOk /></i>}{i.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Sua loja */}
        <div className="dl-card">
          <div className="cfg-hd"><span className="cfg-ic" aria-hidden="true">🏪</span><div><p className="cfg-h">Sua loja</p><p className="cfg-s">Nome, WhatsApp e a descrição que aparecem no cardápio</p></div></div>
          <div id="dl-nome">
            <label className="dl-lbl" htmlFor="dl-in-nome">Nome da loja</label>
            <input id="dl-in-nome" className="dl-in" value={nome} maxLength={60} placeholder="Ex: Doce Formiga Confeitaria" onChange={(e) => setNome(e.target.value)} />
          </div>
          <div id="dl-whats">
            <label className="dl-lbl" htmlFor="dl-in-whats">WhatsApp que recebe os pedidos</label>
            <div className="dl-in dl-in-ic">
              <IconeWhats />
              <input id="dl-in-whats" inputMode="tel" value={telefone} placeholder="(41) 99999-8888" onChange={(e) => setTelefone(formatPhone(e.target.value))} />
            </div>
          </div>
          <div id="dl-desc">
            <div className="dl-lbl-row">
              <label className="dl-lbl" htmlFor="dl-in-desc">Descrição</label>
              <button type="button" className="dl-ia" onClick={gerarDescricao} disabled={gerando}>{gerando ? "Gerando..." : "✨ Gerar com IA"}</button>
            </div>
            <textarea id="dl-in-desc" className="dl-in dl-ta" value={descricao} maxLength={200}
              placeholder="Conte em uma frase o que sua confeitaria tem de especial"
              onChange={(e) => setDescricao(e.target.value)} />
            <span className="dl-cnt">{descricao.length}/200</span>
          </div>
        </div>

        {/* Endereço */}
        <div className="dl-card" id="dl-endereco">
          <div className="cfg-hd"><span className="cfg-ic" aria-hidden="true">📍</span><div><p className="cfg-h">Endereço</p><p className="cfg-s">Pra calcular a entrega e mostrar no mapa</p></div></div>
          <label className="dl-lbl" htmlFor="dl-in-cep">CEP</label>
          <div className="dl-in dl-in-ic">
            <input id="dl-in-cep" inputMode="numeric" value={end.cep} placeholder="00000-000"
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "").slice(0, 8);
                const v = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
                setEnd((x) => ({ ...x, cep: v }));
                if (d.length === 8) buscarCep(d); else setCepOk(false);
              }} />
            {buscandoCep ? <span className="dl-auto dl-auto--busca">buscando...</span> : cepOk ? <span className="dl-auto">✓ endereço encontrado</span> : null}
          </div>
          <div className="dl-g2n">
            <div>
              <label className="dl-lbl" htmlFor="dl-in-rua">Rua</label>
              <input id="dl-in-rua" className="dl-in" value={end.rua} onChange={(e) => setEnd((x) => ({ ...x, rua: e.target.value }))} />
            </div>
            <div>
              <label className="dl-lbl" htmlFor="dl-in-num">Nº</label>
              <input id="dl-in-num" className="dl-in" value={end.numero} onChange={(e) => setEnd((x) => ({ ...x, numero: e.target.value }))} />
            </div>
          </div>
          <div className="dl-g2">
            <div>
              <label className="dl-lbl" htmlFor="dl-in-bairro">Bairro</label>
              <input id="dl-in-bairro" className="dl-in" value={end.bairro} onChange={(e) => setEnd((x) => ({ ...x, bairro: e.target.value }))} />
            </div>
            <div>
              <label className="dl-lbl" htmlFor="dl-in-cidade">Cidade</label>
              <input id="dl-in-cidade" className="dl-in" value={end.cidade} onChange={(e) => setEnd((x) => ({ ...x, cidade: e.target.value }))} />
            </div>
          </div>
          <label className="dl-lbl">No cardápio, mostrar</label>
          <div className="dl-seg" role="radiogroup">
            {([["completo", "Completo"], ["cidade", "Só a cidade"], ["nada", "Nada"]] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={mostrarLocal === v} className={mostrarLocal === v ? "on" : ""} onClick={() => setMostrarLocal(v)}>{l}</button>
            ))}
          </div>
          <label className="dl-recebe">
            <input type="checkbox" checked={recebeAqui} onChange={(e) => setRecebeAqui(e.target.checked)} />
            <span><b>Recebo pedidos nesse endereço</b><small>O cliente vê esse endereço pra retirar a encomenda.</small></span>
          </label>
        </div>

        {/* Horário */}
        <div className="dl-card" id="dl-horario">
          <div className="cfg-hd"><span className="cfg-ic" aria-hidden="true">🕐</span><div><p className="cfg-h">Horário de funcionamento</p><p className="cfg-s">Aparece como “Aberto agora” no cardápio</p></div></div>
          <div className="dl-days">
            {DIAS_UTEIS.map((d) => (
              <button key={d.nome} type="button" className={horario.dias.includes(d.nome) ? "on" : ""} aria-pressed={horario.dias.includes(d.nome)} aria-label={d.nome} onClick={() => toggleDiaUtil(d.nome)}>
                <span className="dl-bola">{d.letra}</span><small>{d.curto}</small>
              </button>
            ))}
            <button type="button" className={horario.abre_sabado ? "on" : ""} aria-pressed={horario.abre_sabado} aria-label="Sábado" onClick={() => setHorario((h) => ({ ...h, abre_sabado: !h.abre_sabado }))}>
              <span className="dl-bola">S</span><small>Sáb</small>
            </button>
            <button type="button" className={horario.abre_domingo ? "on" : ""} aria-pressed={horario.abre_domingo} aria-label="Domingo" onClick={() => setHorario((h) => ({ ...h, abre_domingo: !h.abre_domingo }))}>
              <span className="dl-bola">D</span><small>Dom</small>
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
        </div>
      </div>

      {/* Salvar fixo */}
      <div className="dl-savebar">
        {aviso && <p className={`dl-aviso dl-aviso--${aviso.tipo}`}>{aviso.txt}</p>}
        <button type="button" className="dl-save" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar alterações"}</button>
      </div>

      {sheet && (
        <HorarioSheet
          titulo={tituloSheet[sheet]}
          value={horario[sheet]}
          onChange={(v) => setHorario((h) => ({ ...h, [sheet]: v }))}
          onClose={() => setSheet(null)}
        />
      )}

      <style>{`
        .dl-root { font-family: var(--font-base); max-width: 640px; margin: 0 auto; padding: 14px 4px 90px; color: #2C1219; }
        .dl-card { background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
        .dl-st { padding: 12px 14px; }
        .dl-st-row { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; } /* título e "Faltam…" um embaixo do outro: no celular estreito ficavam espremidos */
        .dl-st-row b { font-size: 14px; font-weight: 800; }
        .dl-st-row span { font-size: 12px; color: #B45309; font-weight: 700; }
        .dl-bar { height: 5px; background: #F5F0F2; border-radius: 3px; margin: 8px 0 10px; overflow: hidden; }
        .dl-bar i { display: block; height: 100%; border-radius: 3px; transition: width .3s; }
        .dl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .dl-chip { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border: none; border-radius: 8px; font-family: inherit; font-size: 12px; font-weight: 700; background: #FEF3C7; color: #92400E; cursor: pointer; }
        .dl-chip.ok { background: #F0FDF4; color: #15803D; }
        .dl-chip i { width: 14px; height: 14px; border-radius: 50%; background: #16a34a; display: flex; align-items: center; justify-content: center; }
        .dl-h { font-size: 15px; font-weight: 800; margin: 0; }
        .dl-hs { font-size: 11.5px; color: #888780; margin: 2px 0 8px; }
        .dl-lbl { display: block; font-size: 12px; font-weight: 700; color: #4B3A42; margin: 11px 0 5px; }
        .dl-in { width: 100%; box-sizing: border-box; border: 1px solid #EAE3E6; border-radius: 10px; padding: 11px 12px; font-family: inherit; font-size: 14px; color: #2C1219; background: #fff; }
        .dl-in:focus, .dl-in-ic:focus-within { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,0.12); }
        .dl-in::placeholder, .dl-in input::placeholder { color: #A8A0A4; }
        .dl-in-ic { display: flex; align-items: center; gap: 8px; }
        .dl-in-ic input { flex: 1; min-width: 0; border: none; outline: none; background: none; font-family: inherit; font-size: 14px; color: #2C1219; padding: 0; }
        .dl-ta { min-height: 112px; resize: none; line-height: 1.45; display: block; }
        .dl-cnt { display: block; text-align: right; font-size: 10.5px; color: #9CA3AF; margin-top: 4px; }
        .dl-lbl-row { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; margin-bottom: 6px; } /* "Gerar com IA" com respiro: antes encostava no WhatsApp */
        .dl-lbl-row .dl-lbl { margin: 0 !important; }
        .dl-ia { font-family: inherit; font-size: 11.5px; font-weight: 800; padding: 6px 11px; border: none; border-radius: 8px; background: #2C1219; color: #fff; margin: 0; cursor: pointer; }
        .dl-ia:disabled { opacity: .6; cursor: default; }
        .dl-auto { margin-left: auto; font-size: 11px; color: #15803D; font-weight: 700; white-space: nowrap; }
        .dl-auto--busca { color: #9CA3AF; }
        .dl-g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .dl-g2n { display: grid; grid-template-columns: 1fr 78px; gap: 8px; }
        .dl-seg { display: flex; gap: 4px; padding: 4px; background: #F5F0F2; border-radius: 10px; }
        .dl-seg button { flex: 1; padding: 8px 2px; border: none; border-radius: 7px; background: none; font-family: inherit; font-size: 11.5px; font-weight: 700; color: #7C7A8E; cursor: pointer; }
        .dl-seg button.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(44,18,25,0.08); }
        .dl-days { display: flex; gap: 5px; margin-top: 4px; }
        .dl-days button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; border: none; background: none; padding: 0; font-family: inherit; cursor: pointer; font-size: 12px; font-weight: 800; color: #7C7A8E; }
        .dl-days button > small { font-size: 9.5px; font-weight: 600; color: #9CA3AF; }
        .dl-bola { width: 100%; max-width: 40px; aspect-ratio: 1; border-radius: 50%; background: #F5F0F2; color: #7C7A8E; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 800; transition: background .15s, color .15s; }
        /* Dias: rosinha do Doonly (antes eram bolinhas quase pretas) */
        .dl-days button.on .dl-bola { background: #E85A8C; color: #fff; box-shadow: 0 3px 10px rgba(232,90,140,.3); }
        .dl-days button:not(.on) .dl-bola { background: #FFF1F6; color: #D9A5B9; }
        .dl-vazio { font-size: 12px; color: #9CA3AF; margin: 10px 0 0; }
        .dl-hr { margin-top: 10px; background: #FAF7F8; border-radius: 10px; padding: 10px; }
        .dl-hr b { display: block; font-size: 12.5px; margin-bottom: 8px; }
        .dl-tbtns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .dl-tb { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #EAE3E6; border-radius: 10px; padding: 8px 10px; text-align: left; font-family: inherit; font-size: 15px; font-weight: 800; color: #2C1219; cursor: pointer; }
        .dl-tb small { display: block; font-size: 10px; font-weight: 700; color: #888780; }
        .dl-tb:active { transform: scale(0.98); }
        /* Barra de salvar fixa (acima do menu inferior no celular; ao lado da sidebar no computador) */
        .dl-savebar { position: fixed; left: 220px; right: 0; bottom: 0; z-index: 40; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); background: rgba(255,255,255,0.97); backdrop-filter: blur(6px); border-top: 1px solid #F0EBED; }
        @media (max-width: 900px) {
          .dl-savebar { left: 0; bottom: calc(56px + env(safe-area-inset-bottom, 0px)); padding-bottom: 10px; }
        }
        .dl-save { display: block; width: 100%; max-width: 640px; margin: 0 auto; height: 46px; border: none; border-radius: 12px; background: #E85A8C; color: #fff; font-family: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer; }
        .dl-save:disabled { opacity: .6; cursor: default; }
        .dl-aviso { max-width: 640px; margin: 0 auto 8px; padding: 8px 12px; border-radius: 9px; font-size: 12.5px; font-weight: 800; }
        .dl-aviso--ok { background: #DCFCE7; color: #15803D; }
        .dl-aviso--err { background: #FEE2E2; color: #B91C1C; }
      
        /* ── Computador (02/10): duas colunas em vez de uma lista estreita ──
           esquerda: Sua loja + Endereço · direita: Horário · status em cima, na largura toda */
        @media (min-width: 1024px) {
          .dl-root { max-width: 1120px; padding: 20px 0 32px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
          .dl-root > .dl-card { margin-bottom: 0; padding: 18px 20px; }
          .dl-root > .dl-st { grid-column: 1 / -1; }
          .dl-root > .dl-card:not(.dl-st):not(#dl-endereco):not(#dl-horario) { grid-column: 1; grid-row: 2; }
          .dl-root > #dl-endereco { grid-column: 1; grid-row: 3; }
          .dl-root > #dl-horario { grid-column: 2; grid-row: 2 / span 2; position: sticky; top: 20px; }
          /* Salvar: botão de 280px no canto de baixo, à direita (antes era uma faixa larga tapando o conteúdo) */
          .dl-savebar { left: calc(220px + 236px) !important; background: transparent !important; box-shadow: none !important; border: none !important;
            pointer-events: none; display: flex; flex-direction: column; align-items: flex-end; padding: 0 28px 22px !important; }
          .dl-savebar > * { pointer-events: auto; }
          .dl-save { width: 280px !important; max-width: none !important; margin: 0 !important; box-shadow: 0 10px 28px rgba(232,90,140,.35); }
          .dl-aviso { margin: 0 0 8px !important; max-width: none !important; }
          .dl-root { padding-bottom: 96px; }
        }

          .dl-recebe { display: flex; align-items: flex-start; gap: 10px; margin-top: 14px; padding: 12px; border: 1.5px solid #EDE6E9; border-radius: 12px; cursor: pointer; background: #fff; }
          .dl-recebe input { width: 20px; height: 20px; accent-color: #E85A8C; margin: 1px 0 0; flex-shrink: 0; cursor: pointer; }
          .dl-recebe b { display: block; font-size: 14px; font-weight: 800; color: #2C1219; }
          .dl-recebe small { display: block; font-size: 12.5px; color: #6B5D64; margin-top: 2px; line-height: 1.4; }
`}</style>
    </>
  );
}
