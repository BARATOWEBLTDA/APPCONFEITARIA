// ── AdminRegistro.tsx ────────────────────────────────────────────────────────
// (04/11) Registro do que cada admin fez no painel ("Bruno adicionou um banner",
// "Marcos excluiu a conta Doce Formiga", "Anthony deu o PRO de 30 dias para…").
// Todos os admins veem tudo. Ninguém edita nem apaga: fica como aconteceu.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Botao, TelaVazia } from "@/components/base";
import { ClockCounterClockwise, Crown, Lock, UserPlus, Trash, Image as ImageIcon, Newspaper, PenNib, Lightbulb, Bell, Sparkle, Target } from "@phosphor-icons/react";
import { EVENTO_REGISTRO, type PerfilAdmin } from "@/lib/adminPerfil";
import { AvatarAdmin } from "./EscolherPerfil";

export type Registro = { id: number; perfil_id: string | null; perfil_nome: string; acao: string; tipo: string | null; created_at: string };

const POR_VEZ = 40;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
function diaDe(iso: string): string {
  const d = new Date(iso), hoje = new Date(), ontem = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return `${d.getDate()} de ${MESES[d.getMonth()]}${d.getFullYear() !== hoje.getFullYear() ? ` de ${d.getFullYear()}` : ""}`;
}
/** "há 5 min", "há 2 h", senão o dia e a hora */
export function quando(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 6 * 3600) return `há ${Math.round(s / 3600)} h`;
  const dia = diaDe(iso);
  return `${dia === "Hoje" ? "hoje" : dia === "Ontem" ? "ontem" : dia}, ${hora(iso)}`;
}
const ICONE: Record<string, React.ReactNode> = {
  pro: <Crown size={13} weight="fill" />, bloqueio: <Lock size={13} weight="bold" />, usuario: <UserPlus size={13} weight="bold" />,
  exclusao: <Trash size={13} weight="bold" />, banner: <ImageIcon size={13} weight="bold" />, noticia: <Newspaper size={13} weight="bold" />,
  autor: <PenNib size={13} weight="bold" />, ideia: <Lightbulb size={13} weight="bold" />, aviso: <Bell size={13} weight="bold" />, pixel: <Target size={13} weight="bold" />,
};

/** uma linha do registro: foto de quem fez, "Bruno deu o PRO…" e quando */
export function LinhaRegistro({ r, perfis, soHora = false }: { r: Registro; perfis: Record<string, PerfilAdmin>; soHora?: boolean }) {
  const p = (r.perfil_id && perfis[r.perfil_id]) || { nome: r.perfil_nome, foto_url: null, cor: null };
  return (
    <li className="rg-l">
      <span className="rg-av">
        <AvatarAdmin perfil={p} tamanho={38} />
        <i className={`rg-tipo rg-tipo--${r.tipo || "outro"}`} aria-hidden="true">{ICONE[r.tipo || ""] || <Sparkle size={13} weight="fill" />}</i>
      </span>
      <span className="rg-tx"><b>{r.perfil_nome}</b> {r.acao}</span>
      <time className="rg-h" dateTime={r.created_at} title={new Date(r.created_at).toLocaleString("pt-BR")}>{soHora ? hora(r.created_at) : quando(r.created_at)}</time>
    </li>
  );
}

export function usePerfisAdmin() {
  const [perfis, setPerfis] = useState<Record<string, PerfilAdmin>>({});
  const [lista, setLista] = useState<PerfilAdmin[]>([]);
  useEffect(() => {
    supabase.from("admin_perfis").select("id, nome, foto_url, cor").order("ordem").then(({ data }) => {
      const l = (data as PerfilAdmin[]) || [];
      setLista(l); setPerfis(Object.fromEntries(l.map(p => [p.id, p])));
    });
  }, []);
  return { perfis, lista };
}

export const CSS_REGISTRO = `
  .rg-dia { margin: 18px 0 6px; font-size: 13px; font-weight: 600; color: var(--ui-texto-3); }
  .rg-dia:first-child { margin-top: 0; }
  .rg-lista { list-style: none; margin: 0; padding: 0; }
  .rg-l { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 0; border-top: 1px solid var(--ui-linha); }
  .rg-lista .rg-l:first-child { border-top: 0; }
  .rg-av { position: relative; flex: none; display: flex; }
  .rg-tipo { position: absolute; right: -5px; bottom: -4px; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 2px solid var(--ui-branco); border-radius: 50%; background: var(--ui-cinza); color: var(--ui-texto-2); font-style: normal; }
  .rg-tipo--pro { background: var(--ui-vinho); color: #FFD27A; }
  .rg-tipo--bloqueio, .rg-tipo--exclusao { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); }
  .rg-tipo--usuario { background: var(--ui-verde-fundo); color: var(--ui-verde); }
  .rg-tipo--banner, .rg-tipo--noticia, .rg-tipo--autor, .rg-tipo--aviso, .rg-tipo--pixel { background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
  .rg-tipo--ideia { background: var(--ui-laranja-fundo); color: var(--ui-laranja); }
  .rg-tx { flex: 1; min-width: 0; font-size: 14px; font-weight: 500; line-height: 1.4; color: var(--ui-texto-2); }
  .rg-tx b { font-weight: 600; color: var(--ui-texto); }
  .rg-h { flex: none; font-size: 12px; font-weight: 500; color: var(--ui-texto-3); white-space: nowrap; }
`;

export default function AdminRegistro() {
  const { perfis, lista } = usePerfisAdmin();
  const [quem, setQuem] = useState<string>("todos");
  const [itens, setItens] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (antesDe?: string) => {
    setCarregando(true); setErro("");
    let q = supabase.from("admin_log").select("id, perfil_id, perfil_nome, acao, tipo, created_at").order("created_at", { ascending: false }).limit(POR_VEZ);
    if (quem !== "todos") q = q.eq("perfil_id", quem);
    if (antesDe) q = q.lt("created_at", antesDe);
    const { data, error } = await q;
    if (error) setErro("Não deu para carregar o registro. Tente de novo.");
    else {
      const novos = (data as Registro[]) || [];
      setItens(l => (antesDe ? [...l, ...novos] : novos));
      setTemMais(novos.length === POR_VEZ);
    }
    setCarregando(false);
  }, [quem]);

  useEffect(() => {
    void carregar();
    const novo = () => void carregar();
    window.addEventListener(EVENTO_REGISTRO, novo);
    return () => window.removeEventListener(EVENTO_REGISTRO, novo);
  }, [carregar]);

  // agrupa por dia
  const grupos: { dia: string; itens: Registro[] }[] = [];
  itens.forEach(r => {
    const d = diaDe(r.created_at);
    if (grupos.length && grupos[grupos.length - 1].dia === d) grupos[grupos.length - 1].itens.push(r);
    else grupos.push({ dia: d, itens: [r] });
  });

  return (
    <div className="rg">
      <h1 className="rg-t">Registro</h1>
      <p className="rg-sub">Tudo o que cada admin fez no painel, do mais novo para o mais antigo.</p>

      <div className="rg-filtro" role="radiogroup" aria-label="De quem">
        {[{ id: "todos", nome: "Todos", foto_url: null, cor: null } as PerfilAdmin, ...lista].map(p => (
          <button key={p.id} type="button" role="radio" aria-checked={quem === p.id} className={quem === p.id ? "on" : ""} onClick={() => setQuem(p.id)}>
            {p.id !== "todos" && <AvatarAdmin perfil={p} tamanho={24} />}{p.nome}
          </button>
        ))}
      </div>

      <div className="rg-card">
        {erro ? <TelaVazia compacta icone={<ClockCounterClockwise size={30} />} titulo="Não deu para carregar" texto={erro} acao={<Botao tamanho="m" onClick={() => carregar()}>Tentar de novo</Botao>} />
          : !carregando && itens.length === 0 ? <TelaVazia compacta icone={<ClockCounterClockwise size={30} />} titulo="Nada registrado ainda" texto="Quando alguém der PRO, mexer em banner, novidade ou conta, aparece aqui." />
          : <>
              {grupos.map(g => (
                <section key={g.dia}>
                  <h2 className="rg-dia">{g.dia}</h2>
                  <ul className="rg-lista">{g.itens.map(r => <LinhaRegistro key={r.id} r={r} perfis={perfis} soHora />)}</ul>
                </section>
              ))}
              {carregando && <p className="rg-carr" aria-busy="true">Carregando…</p>}
              {!carregando && temMais && <div className="rg-mais"><Botao variante="secundario" tamanho="m" onClick={() => carregar(itens[itens.length - 1]?.created_at)}>Ver mais antigos</Botao></div>}
            </>}
      </div>

      <style>{`
        .rg { font-family: var(--font-base); color: var(--ui-texto); max-width: 760px; }
        .rg-t { margin: 0; font-size: 22px; font-weight: 600; }
        .rg-sub { margin: 4px 0 16px; font-size: 15px; font-weight: 500; color: var(--ui-texto-2); }
        .rg-filtro { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .rg-filtro button { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px 0 8px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 500; color: var(--ui-texto-2); cursor: pointer; }
        .rg-filtro button:first-child { padding-left: 14px; }
        .rg-filtro button.on { border-color: var(--ui-texto); background: var(--ui-fundo); color: var(--ui-texto); } /* (10/11) caixa, sem pílula */
        .rg-card { padding: 16px 18px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); box-shadow: var(--ui-sombra-cartao); }
        .rg-carr { margin: 12px 0 0; font-size: 14px; color: var(--ui-texto-3); text-align: center; }
        .rg-mais { display: flex; justify-content: center; padding-top: 14px; }
        ${CSS_REGISTRO}
      `}</style>
    </div>
  );
}
