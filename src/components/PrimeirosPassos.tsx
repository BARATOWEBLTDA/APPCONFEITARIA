import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, PencilSimpleLine, ImageSquare, MapPin, Clock, Basket, ShareNetwork, CaretRight, Camera, X, LockSimple } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { useProfile, getCardapioUrl } from "@/hooks/useProfile";
import { ImageCropper } from "@/components/ui/ImageCropper";
import HorarioSheet from "@/components/HorarioSheet";
import { Mascote } from "@/components/marca/Mascote";
import { lerPassos, marcarCompartilhado, passosCompletos, avisarPassos, atualizarPerfil, marcarLogoOk, type EstadoPassos } from "@/lib/primeirosPassos";

/**
 * "Primeiros passos" (aprovado 02/10) — o MESMO cartão no Início (celular) e no Cardápio digital.
 * 7 passos; os que dá pra preencher abrem numa janelinha que sobe de baixo, sem sair da tela:
 * descrição (com IA), logo (com recorte), endereço (CEP preenche sozinho) e horário.
 * Salva exatamente como os Dados da loja (endereço e horário em JSON no profiles).
 */
type Local = "inicio" | "cardapio";
type Folha = null | "descricao" | "logo" | "endereco" | "horario";

const DIAS = [
  { nome: "Segunda", letra: "S" }, { nome: "Terça", letra: "T" }, { nome: "Quarta", letra: "Q" },
  { nome: "Quinta", letra: "Q" }, { nome: "Sexta", letra: "S" }, { nome: "Sábado", letra: "S" }, { nome: "Domingo", letra: "D" },
];
const HORARIO_PADRAO = {
  dias: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"], abertura: "08:00", fechamento: "18:00",
  abre_sabado: false, sabado_abertura: "09:00", sabado_fechamento: "14:00",
  abre_domingo: false, domingo_abertura: "09:00", domingo_fechamento: "14:00",
};
const maskCep = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

export default function PrimeirosPassos({ local = "inicio", onEstado }: { local?: Local; onEstado?: (completo: boolean) => void }) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const uid = profile?.id as string | undefined;
  const [estado, setEstado] = useState<EstadoPassos | null>(null);
  const [folha, setFolha] = useState<Folha>(null);
  const [fechado, setFechado] = useState(false);
  const [jaViuIncompleto, setJaViuIncompleto] = useState(false);
  const kFechado = uid ? `doonly_pp_fechado_${uid}` : "";
  const kIncompleto = uid ? `doonly_pp_incompleto_${uid}` : "";

  const atualizar = useCallback(() => { if (uid) lerPassos(uid).then(setEstado).catch(() => {}); }, [uid]);

  useEffect(() => {
    if (!uid) return;
    try { setFechado(localStorage.getItem(kFechado) === "1"); setJaViuIncompleto(localStorage.getItem(kIncompleto) === "1"); } catch {}
    atualizar();
    const f = () => { if (document.visibilityState === "visible") atualizar(); };
    document.addEventListener("visibilitychange", f);
    window.addEventListener("focus", atualizar);
    window.addEventListener("doonly:passos", atualizar);
    return () => { document.removeEventListener("visibilitychange", f); window.removeEventListener("focus", atualizar); window.removeEventListener("doonly:passos", atualizar); };
  }, [uid, atualizar, kFechado, kIncompleto]);

  const completo = passosCompletos(estado);
  useEffect(() => { if (estado) onEstado?.(completo); }, [estado, completo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (uid && estado && !completo && !jaViuIncompleto) { try { localStorage.setItem(kIncompleto, "1"); } catch {} setJaViuIncompleto(true); }
  }, [uid, estado, completo, jaViuIncompleto, kIncompleto]);

  if (!uid || !estado) return null;
  // No Cardápio digital o cartão some quando está tudo pronto (a tela mostra o cartão do link)
  if (completo && (local === "cardapio" || fechado || !jaViuIncompleto)) return null;

  const link = getCardapioUrl(profile);
  const fechar = () => { try { localStorage.setItem(kFechado, "1"); } catch {} setFechado(true); };
  const salvo = () => { setFolha(null); avisarPassos(); };

  const compartilhar = async () => {
    const texto = `Confira o cardápio da minha confeitaria: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: profile?.nome_loja || "Meu cardápio", text: texto, url: link }); marcarCompartilhado(uid); } catch { /* cancelou */ }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
    marcarCompartilhado(uid);
  };

  if (completo) {
    return (
      <div className="pp pp--fim">
        {/* (07/10 · 2.94) o mascote no lugar dos emojis */}
        <Mascote pose="acenando" className="pp-masc" />
        <b className="pp-ft">Sua confeitaria está pronta pra vender!</b>
        <p className="pp-fs">Você concluiu os primeiros passos. Agora é só esperar os pedidos chegarem.</p>
        <a className="pp-btn" href={link} target="_blank" rel="noopener noreferrer">Ver meu cardápio</a>
        <button type="button" className="pp-lnk pp-lnk--cinza" onClick={fechar}>Fechar</button>
        <style>{CSS}</style>
      </div>
    );
  }

  const I = (C: any) => <C size={20} weight="regular" />;
  const passos: { feito: boolean; ic: ReactNode; t: string; s: string; abrir: () => void }[] = [
    { feito: true, ic: I(Check), t: "Criar sua conta", s: "Pronto! Bem-vinda ao Doonly", abrir: () => {} },
    { feito: estado.descricao, ic: I(PencilSimpleLine), t: "Contar sobre a sua confeitaria", s: "Uma frase que aparece no topo do cardápio", abrir: () => setFolha("descricao") },
    { feito: estado.logo, ic: I(ImageSquare), t: "Colocar o logo da loja", s: "Sem logo? Usamos a sua foto de perfil", abrir: () => setFolha("logo") },
    { feito: estado.endereco, ic: I(MapPin), t: "Endereço da loja", s: "Pra calcular a entrega e mostrar no mapa", abrir: () => setFolha("endereco") },
    { feito: estado.horario, ic: I(Clock), t: "Horário de funcionamento", s: "Aparece como \"Aberto agora\" no cardápio", abrir: () => setFolha("horario") },
    { feito: estado.produto, ic: I(Basket), t: "Cadastrar seu primeiro produto", s: "Com foto e preço, do jeito que o cliente vai ver", abrir: () => navigate("/produtos", { state: { abrirCadastro: true } }) },
  ];
  const feitos = passos.filter(p => p.feito).length;
  const atual = passos.findIndex(p => !p.feito);
  const ultimo = -1; // (o passo "compartilhar" saiu em 02/10)
  const compartilharTravado = false;

  return (
    <div className={`pp pp--${local}`}>
      <p className="pp-k">PRIMEIROS PASSOS</p>
      <b className="pp-t">Comece a vender</b>
      <p className="pp-sub">Tudo o que o seu cardápio precisa, sem sair desta tela.</p>
      <div className="pp-bar" aria-label={`${feitos} de ${passos.length} passos feitos`}><i style={{ width: `${(feitos / passos.length) * 100}%` }} /></div>
      {passos.map((p, i) => i === atual ? (
        <div key={p.t} className="pp-at">
          <div className="pp-ps pp-ps--sem">
            <span className="pp-ic pp-ic--at">{p.ic}</span>
            <span className="pp-tx"><b>{p.t}</b><small>{p.s}</small></span>
          </div>
          <button type="button" className="pp-btn" onClick={p.abrir}>Fazer agora</button>
        </div>
      ) : (
        (i === ultimo && compartilharTravado) ? (
          <div key={p.t} className="pp-ps pp-ps--trava" aria-disabled="true">
            <span className="pp-ic pp-ic--trava">{I(LockSimple)}</span>
            <span className="pp-tx"><b>{p.t}</b><small>Libera quando os passos acima estiverem prontos</small></span>
          </div>
        ) : (
        <button type="button" key={p.t} className={`pp-ps${p.feito ? " pp-ps--ok" : ""}`} onClick={p.feito ? undefined : p.abrir} disabled={p.feito}>
          <span className={`pp-ic${p.feito ? " pp-ic--ok" : ""}`}>{p.feito ? I(Check) : p.ic}</span>
          <span className="pp-tx"><b>{p.t}</b><small>{p.s}</small></span>
          {!p.feito && <span className="pp-seta"><CaretRight size={16} /></span>}
        </button>
        )
      ))}

      {folha === "descricao" && <FolhaDescricao uid={uid} perfil={estado.perfil} onClose={() => setFolha(null)} onSalvo={salvo} />}
      {folha === "logo" && <FolhaLogo uid={uid} perfil={estado.perfil} onClose={() => setFolha(null)} onSalvo={salvo} />}
      {folha === "endereco" && <FolhaEndereco uid={uid} perfil={estado.perfil} onClose={() => setFolha(null)} onSalvo={salvo} />}
      {folha === "horario" && <FolhaHorario uid={uid} perfil={estado.perfil} onClose={() => setFolha(null)} onSalvo={salvo} />}
      <style>{CSS}</style>
    </div>
  );
}

/* ── Janelinha que sobe de baixo ───────────────────────────────────────── */
function Folha({ titulo, sub, onClose, children }: { titulo: string; sub: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const y = window.scrollY; const b = document.body.style;
    const antes = { position: b.position, top: b.top, width: b.width, overflow: b.overflow };
    b.position = "fixed"; b.top = `-${y}px`; b.width = "100%"; b.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => { Object.assign(b, antes); window.scrollTo(0, y); window.removeEventListener("keydown", esc); };
  }, [onClose]);
  return (
    <div className="ppf-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="ppf" onClick={e => e.stopPropagation()}>
        <span className="ppf-alca" aria-hidden="true" />
        <div className="ppf-hd"><div><b>{titulo}</b><small>{sub}</small></div><button type="button" className="ppf-x" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
        <div className="ppf-corpo">{children}</div>
      </div>
    </div>
  );
}
type FolhaProps = { uid: string; perfil: any; onClose: () => void; onSalvo: () => void };

function FolhaDescricao({ uid, perfil, onClose, onSalvo }: FolhaProps) {
  const [txt, setTxt] = useState(String(perfil?.descricao_loja || ""));
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const gerar = async () => {
    setGerando(true);
    try {
      const res = await apiFetch("/api/gerar-descricao", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Crie uma descrição curta e atraente para uma confeitaria chamada "${String(perfil?.nome_loja || "minha confeitaria").trim()}". Máximo 150 caracteres, português brasileiro, transmita carinho e qualidade. Retorne APENAS a descrição, sem aspas.` }) });
      const data = await res.json(); const t = data.content?.[0]?.text?.trim();
      if (t) setTxt(t.slice(0, 200));
    } catch { /* sem internet */ }
    setGerando(false);
  };
  const salvar = async () => {
    if (!txt.trim()) return;
    setSalvando(true); setErro("");
    const e = await atualizarPerfil(uid, { descricao_loja: txt.trim() });
    setSalvando(false);
    if (e) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onSalvo();
  };
  return (
    <Folha titulo="Contar sobre a sua confeitaria" sub="Uma frase que aparece no topo do seu cardápio" onClose={onClose}>
      <div className="ppf-lrow"><label className="ppf-l" htmlFor="pp-desc">Descrição</label>
        <button type="button" className="ppf-ia" onClick={gerar} disabled={gerando}>{gerando ? "Gerando…" : "✨ Gerar com IA"}</button></div>
      <textarea id="pp-desc" className="ppf-in ppf-ta" value={txt} maxLength={200} placeholder="Ex.: Bolos e doces feitos com carinho em Curitiba" onChange={e => setTxt(e.target.value)} />
      <p className="ppf-cnt">{txt.length}/200</p>
      {erro && <p className="ppf-erro">{erro}</p>}
      <button type="button" className="pp-btn" disabled={!txt.trim() || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar e continuar"}</button>
    </Folha>
  );
}

function FolhaLogo({ uid, perfil, onClose, onSalvo }: FolhaProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const atual = perfil?.logo_url || perfil?.foto_url || "";
  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setCrop(r.result as string); r.readAsDataURL(f); e.target.value = "";
  };
  const enviar = async (blob: Blob) => {
    setCrop(null); setEnviando(true);
    const path = `logos/${uid}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      marcarLogoOk(uid);
      const e = await atualizarPerfil(uid, { logo_url: `${data.publicUrl}?t=${Date.now()}`, design_escolhido: true, logo_confirmado: true }, ["design_escolhido", "logo_confirmado"]);
      setEnviando(false);
      if (e) { alert("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
      onSalvo(); return;
    }
    setEnviando(false); alert("Não foi possível enviar a imagem. Tente de novo.");
  };
  const usarFoto = async () => {
    marcarLogoOk(uid);
    await atualizarPerfil(uid, { design_escolhido: true, logo_confirmado: true }, ["design_escolhido", "logo_confirmado"]);
    onSalvo();
  };
  return (
    <>
      <Folha titulo="Colocar o logo da loja" sub="Aparece no topo do cardápio, junto do nome" onClose={onClose}>
        <input ref={ref} type="file" accept="image/*" hidden onChange={escolher} />
        <div className="ppf-lg">
          <button type="button" className="ppf-lgc" onClick={() => ref.current?.click()} aria-label="Escolher foto">
            {atual ? <img src={atual} alt="" /> : <span>{String(perfil?.nome_loja || "D").charAt(0).toUpperCase()}</span>}
            <i><Camera size={14} /></i>
          </button>
          <div><b>Toque pra escolher o seu logo</b><small>{perfil?.logo_url ? "Da galeria ou da câmera. Você ajusta o recorte antes de salvar." : atual ? "Hoje o cardápio mostra a sua foto de perfil. Envie o logo da loja pra trocar." : "Da galeria ou da câmera. Você ajusta o recorte antes de salvar."}</small></div>
        </div>
        <button type="button" className="pp-btn" onClick={() => ref.current?.click()} disabled={enviando}>{enviando ? "Enviando…" : "Escolher foto"}</button>
        {!perfil?.logo_url && <button type="button" className="pp-lnk" onClick={usarFoto}>Usar minha foto de perfil por enquanto</button>}
      </Folha>
      {crop && <ImageCropper imageSrc={crop} cropShape="round" aspect={1} onCancel={() => setCrop(null)} onCropDone={enviar} />}
    </>
  );
}

function FolhaEndereco({ uid, perfil, onClose, onSalvo }: FolhaProps) {
  const e0 = perfil?.endereco || {};
  const [end, setEnd] = useState({ cep: e0.cep || "", rua: e0.rua || "", numero: e0.numero || "", bairro: e0.bairro || "", cidade: e0.cidade || "", estado: e0.estado || "" });
  const [mostrar, setMostrar] = useState<"completo" | "cidade" | "nada">(perfil?.mostrar_apenas_cidade && !perfil?.mostrar_localizacao ? "cidade" : "completo"); // padrão: endereço completo (02/10)
  const [buscando, setBuscando] = useState(false);
  const [achou, setAchou] = useState(!!e0.cidade);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const mudarCep = async (v: string) => {
    const cep = maskCep(v); setEnd(e => ({ ...e, cep })); setAchou(false);
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setBuscando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`); const j = await r.json();
      if (!j.erro) { setEnd(e => ({ ...e, rua: j.logradouro || e.rua, bairro: j.bairro || e.bairro, cidade: j.localidade || e.cidade, estado: j.uf || e.estado })); setAchou(true); }
    } catch { /* sem internet: ela digita */ }
    setBuscando(false);
  };
  const pronto = !!end.cidade.trim() && !!(end.rua.trim() || end.cep.trim());
  const salvar = async () => {
    if (!pronto) return;
    setSalvando(true); setErro("");
    const e = await atualizarPerfil(uid, { endereco: JSON.stringify(end), mostrar_localizacao: mostrar === "completo", mostrar_apenas_cidade: mostrar === "cidade" });
    setSalvando(false);
    if (e) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onSalvo();
  };
  const campo = (k: keyof typeof end, rotulo: string, ph = "", extra: any = {}) => (
    <div className="ppf-f"><label className="ppf-l" htmlFor={`pp-${k}`}>{rotulo}</label>
      <input id={`pp-${k}`} className="ppf-in" value={end[k]} placeholder={ph} onChange={e => setEnd(x => ({ ...x, [k]: e.target.value }))} {...extra} /></div>
  );
  return (
    <Folha titulo="Endereço da loja" sub="Pra calcular a entrega e mostrar no mapa" onClose={onClose}>
      <div className="ppf-f"><label className="ppf-l" htmlFor="pp-cep">CEP</label>
        <div className="ppf-wrap"><input id="pp-cep" className="ppf-in" inputMode="numeric" value={end.cep} placeholder="00000-000" onChange={e => mudarCep(e.target.value)} />
          {(buscando || achou) && <small className="ppf-cep">{buscando ? "Procurando…" : "✓ encontrado"}</small>}</div></div>
      {campo("rua", "Rua", "Nome da rua")}
      <div className="ppf-row">{campo("numero", "Número", "Ex.: 500", { inputMode: "numeric" })}{campo("bairro", "Bairro")}</div>
      <div className="ppf-row">{campo("cidade", "Cidade")}{campo("estado", "UF", "PR", { maxLength: 2, style: { textTransform: "uppercase" } })}</div>
      <p className="ppf-l" style={{ marginTop: 14 }}>No cardápio, mostrar</p>
      <div className="ppf-seg">{([["completo", "Completo"], ["cidade", "Só a cidade"], ["nada", "Nada"]] as const).map(([v, l]) => (
        <button type="button" key={v} className={mostrar === v ? "on" : ""} onClick={() => setMostrar(v)}>{l}</button>))}</div>
      {erro && <p className="ppf-erro">{erro}</p>}
      <button type="button" className="pp-btn" disabled={!pronto || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar e continuar"}</button>
    </Folha>
  );
}

function FolhaHorario({ uid, perfil, onClose, onSalvo }: FolhaProps) {
  const [h, setH] = useState<any>({ ...HORARIO_PADRAO, ...(perfil?.horario || {}) });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const ligado = (d: string) => d === "Sábado" ? h.abre_sabado : d === "Domingo" ? h.abre_domingo : h.dias.includes(d);
  const trocar = (d: string) => setH((x: any) => d === "Sábado" ? { ...x, abre_sabado: !x.abre_sabado } : d === "Domingo" ? { ...x, abre_domingo: !x.abre_domingo }
    : { ...x, dias: x.dias.includes(d) ? x.dias.filter((y: string) => y !== d) : DIAS.slice(0, 5).map(z => z.nome).filter(n => n === d || x.dias.includes(n)) });
  const temDia = h.dias.length > 0 || h.abre_sabado || h.abre_domingo;
  const salvar = async () => {
    if (!temDia) return;
    setSalvando(true); setErro("");
    const e = await atualizarPerfil(uid, { horario: JSON.stringify(h) });
    setSalvando(false);
    if (e) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); return; }
    onSalvo();
  };
  const [campo, setCampo] = useState<null | { k: string; titulo: string }>(null);
  const bloco = (titulo: string, a: string, f: string) => (
    <div className="ppf-bl"><b>{titulo}</b><div className="ppf-row">
      <button type="button" className="ppf-hr" onClick={() => setCampo({ k: a, titulo: `${titulo} · abre às` })}><Clock size={18} /><span><small>Abre</small>{h[a] || "--:--"}</span></button>
      <button type="button" className="ppf-hr" onClick={() => setCampo({ k: f, titulo: `${titulo} · fecha às` })}><Clock size={18} /><span><small>Fecha</small>{h[f] || "--:--"}</span></button>
    </div></div>
  );
  return (
    <Folha titulo="Horário de funcionamento" sub="Aparece como &quot;Aberto agora&quot; no cardápio" onClose={onClose}>
      <p className="ppf-l">Dias que você atende</p>
      <div className="ppf-dias">{DIAS.map(d => (
        <button type="button" key={d.nome} className={ligado(d.nome) ? "on" : ""} onClick={() => trocar(d.nome)} aria-pressed={ligado(d.nome)} aria-label={d.nome}>{d.letra}</button>))}</div>
      {h.dias.length > 0 && bloco("Segunda a sexta", "abertura", "fechamento")}
      {h.abre_sabado && bloco("Sábado", "sabado_abertura", "sabado_fechamento")}
      {h.abre_domingo && bloco("Domingo", "domingo_abertura", "domingo_fechamento")}
      {erro && <p className="ppf-erro">{erro}</p>}
      <button type="button" className="pp-btn" disabled={!temDia || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar e continuar"}</button>
      {campo && (
        <HorarioSheet titulo={campo.titulo} value={h[campo.k]} onChange={(v) => setH((x: any) => ({ ...x, [campo.k]: v }))} onClose={() => setCampo(null)} />
      )}
    </Folha>
  );
}

const CSS = `
  .pp { background: #fff; border: 1px solid #F0EBED; border-radius: 18px; padding: 18px 16px 8px; box-shadow: 0 10px 26px rgba(44,18,25,.10); font-family: var(--font-base); color: #2C1219; }
  .pp-k { margin: 0; font-size: 12.5px; font-weight: 800; letter-spacing: .08em; color: #C33A6E; }
  .pp-t { display: block; font-size: 22px; font-weight: 900; margin-top: 3px; letter-spacing: -.02em; line-height: 1.15; }
  .pp-sub { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 4px 0 0; }
  .pp-bar { height: 7px; border-radius: 99px; background: #F5F0F2; margin: 14px 0 6px; overflow: hidden; }
  .pp-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #F472B6, #E85A8C); transition: width .5s ease; }
  .pp-ps { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 2px; border: none; border-top: 1px solid #F5F0F2; background: none; font-family: inherit; text-align: left; color: inherit; cursor: pointer; }
  .pp-ps:disabled { cursor: default; }
  .pp-ps--sem { border-top: none; padding: 0; cursor: default; }
  .pp-ic { width: 40px; height: 40px; border-radius: 10px; background: #FCE0E9; color: #993556; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pp-ic--ok { background: #DCFCE7; color: #15803D; }
  .pp-ic--at { background: #E85A8C; color: #fff; }
  .pp-tx { flex: 1; min-width: 0; }
  .pp-tx b { display: block; font-size: 15px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2; color: #2C2C2A; }
  .pp-tx small { display: block; font-size: 12.5px; color: #6B5D64; margin-top: 3px; line-height: 1.35; }
  .pp-ps--ok .pp-tx b { color: #9A8E94; font-weight: 600; text-decoration: line-through; text-decoration-color: #D6CBD0; }
  .pp-ps--ok .pp-tx small { color: #B5AAB0; }
  .pp-ps--trava { cursor: default; }
  .pp-ic--trava { background: #F5F0F2; color: #B5AAB0; }
  .pp-ps--trava .pp-tx b { color: #9A8E94; font-weight: 600; }
  .pp-seta { color: #B4B2A9; display: flex; }
  .pp-at { background: #FFF6F9; border: 1.5px solid #F7C6D9; border-radius: 14px; padding: 14px 12px 12px; margin: 6px 0; }
  .pp-at + .pp-ps { border-top: none; }
  .pp-btn { display: block; width: 100%; margin-top: 12px; border: none; border-radius: 12px; padding: 13px; font-family: inherit; font-size: 15px; font-weight: 800; color: #fff; background: #E85A8C; box-shadow: 0 3px 0 #C33A6E; cursor: pointer; text-align: center; text-decoration: none; }
  .pp-btn:disabled { background: #F3B6CB; box-shadow: none; cursor: default; }
  .pp-lnk { display: block; width: 100%; margin-top: 8px; padding: 10px; border: none; background: none; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #C33A6E; cursor: pointer; }
  .pp-lnk--cinza { color: #9A8E94; font-weight: 600; }
  .pp--fim { text-align: center; background: linear-gradient(180deg, #FFF1F6, #fff 70%); padding-bottom: 12px; }
  .pp-masc { display: block; width: 120px; height: auto; margin: 0 auto; }
  .pp-ft { display: block; font-size: 18px; font-weight: 900; margin: 6px auto 0; max-width: 260px; line-height: 1.25; text-wrap: balance; }
  .pp-fs { font-size: 13.5px; color: #6B5D64; margin: 6px auto 4px; max-width: 290px; line-height: 1.45; text-wrap: balance; }

  /* (07/10 · 2.94) No Início, em tela larga (tablet e computador), os passos viram blocos lado a lado:
     o cartão fica com metade da altura e não empurra o resto da tela pra baixo. */
  @media (min-width: 768px) {
    .pp--inicio { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 12px; padding: 20px 20px 20px; }
    .pp--inicio > .pp-k, .pp--inicio > .pp-t, .pp--inicio > .pp-sub, .pp--inicio > .pp-bar { grid-column: 1 / -1; }
    .pp--inicio > .pp-bar { margin-bottom: 4px; }
    .pp--inicio > .pp-ps, .pp--inicio > .pp-at { margin: 10px 0 0; border: 1px solid #F0EBED; border-radius: 14px; padding: 12px; }
    .pp--inicio > .pp-at { display: flex; flex-direction: column; justify-content: space-between; border: 1.5px solid #F7C6D9; padding: 14px 12px 12px; }
    .pp--inicio > .pp-ps--ok { background: #FAF7F8; }
  }
  @media (min-width: 1600px) { .pp--inicio { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (min-width: 768px) { .pp--fim .pp-btn { max-width: 340px; margin-left: auto; margin-right: auto; } }

  .ppf-ov { position: fixed; inset: 0; z-index: 3500; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; bottom: var(--teclado, 0px); }
  @media (min-width: 768px) { .ppf-ov { align-items: center; } }
  .ppf { width: 100%; max-width: 480px; max-height: 88vh; max-height: 88dvh; display: flex; flex-direction: column; background: #fff; border-radius: 22px 22px 0 0; font-family: var(--font-base); color: #2C1219; animation: ppfSobe .25s ease; }
  @media (min-width: 768px) { .ppf { border-radius: 22px; } }
  @keyframes ppfSobe { from { transform: translateY(30px); opacity: 0; } to { transform: none; opacity: 1; } }
  .ppf-alca { width: 40px; height: 4px; border-radius: 99px; background: #E5DDE1; margin: 10px auto 0; flex-shrink: 0; }
  .ppf-hd { display: flex; align-items: flex-start; gap: 10px; padding: 12px 18px 12px; border-bottom: 1px solid #F5F0F2; flex-shrink: 0; }
  .ppf-hd > div { flex: 1; } .ppf-hd b { display: block; font-size: 18px; font-weight: 900; letter-spacing: -.01em; }
  .ppf-hd small { display: block; font-size: 13.5px; color: #6B5D64; margin-top: 2px; line-height: 1.4; }
  .ppf-x { width: 34px; height: 34px; border-radius: 10px; border: none; background: #F5F0F2; color: #6B5D64; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .ppf-corpo { padding: 4px 18px calc(18px + env(safe-area-inset-bottom, 0px)); overflow-y: auto; }
  .ppf-l { display: block; font-size: 13px; font-weight: 600; color: #4B3A42; margin: 14px 0 6px; }
  .ppf-lrow { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; margin-bottom: 6px; }
  .ppf-lrow .ppf-l { margin: 0; }
  .ppf-ia { border: none; border-radius: 8px; background: #2C1219; color: #fff; font-family: inherit; font-size: 12px; font-weight: 800; padding: 6px 11px; cursor: pointer; }
  .ppf-ia:disabled { opacity: .6; }
  .ppf-in { width: 100%; box-sizing: border-box; min-height: 46px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 11px 14px; font-family: inherit; font-size: 16px; color: #2C1219; background: #fff; }
  .ppf-in:focus { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .ppf-ta { min-height: 112px; resize: none; line-height: 1.45; display: block; }
  .ppf-erro { margin: 12px 0 0; font-size: 13px; font-weight: 700; color: #B91C1C; }
  .ppf-cnt { text-align: right; font-size: 11px; color: #B5AAB0; margin: 4px 0 0; }
  .ppf-f { flex: 1; min-width: 0; }
  .ppf-row { display: flex; gap: 10px; }
  .ppf-wrap { position: relative; }
  .ppf-cep { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 11.5px; font-weight: 700; color: #15803D; }
  .ppf-seg { display: flex; background: #F5F0F2; border-radius: 10px; padding: 3px; }
  .ppf-seg button { flex: 1; border: none; background: none; padding: 9px 4px; border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 700; color: #6B5D64; cursor: pointer; }
  .ppf-seg button.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .ppf-dias { display: flex; gap: 6px; }
  .ppf-dias button { flex: 1; aspect-ratio: 1; max-width: 46px; border: none; border-radius: 50%; font-family: inherit; font-size: 14px; font-weight: 800; background: #FFF1F6; color: #D9A5B9; cursor: pointer; }
  .ppf-dias button.on { background: #E85A8C; color: #fff; box-shadow: 0 3px 10px rgba(232,90,140,.3); }
  .ppf-bl { background: #FAF7F8; border-radius: 12px; padding: 12px; margin-top: 12px; }
  .ppf-bl b { display: block; font-size: 13.5px; margin-bottom: 8px; }
  .ppf-hr { flex: 1; display: flex; align-items: center; gap: 10px; min-height: 50px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 8px 12px; background: #fff; font-family: inherit; color: #993556; text-align: left; cursor: pointer; }
  .ppf-hr span { display: flex; flex-direction: column; color: #2C1219; font-size: 16px; font-weight: 800; line-height: 1.15; }
  .ppf-hr small { font-size: 11px; font-weight: 700; color: #888780; }
  .ppf-lg { display: flex; gap: 14px; align-items: center; margin-top: 12px; }
  .ppf-lgc { position: relative; width: 76px; height: 76px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 6px 16px rgba(232,90,140,.3); background: linear-gradient(135deg, #F9A8D4, #E85A8C); padding: 0; cursor: pointer; flex-shrink: 0; overflow: visible; }
  .ppf-lgc img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
  .ppf-lgc span { color: #fff; font-weight: 900; font-size: 28px; }
  .ppf-lgc i { position: absolute; right: -4px; bottom: -4px; width: 26px; height: 26px; border-radius: 50%; background: #fff; color: #993556; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
  .ppf-lg b { display: block; font-size: 14.5px; font-weight: 800; }
  .ppf-lg small { display: block; font-size: 12.5px; color: #6B5D64; margin-top: 3px; line-height: 1.4; }
`;
