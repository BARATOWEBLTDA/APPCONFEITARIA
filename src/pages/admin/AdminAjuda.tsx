/**
 * (26/10) Admin → Central de Ajuda: quantas pessoas acharam cada artigo útil e o que faltou (motivo do "Não").
 * Lê public.ajuda_votos (política ajuda_votos_admin_select, só para a conta de gestão).
 */
import { useEffect, useMemo, useState } from "react";
import { Lifebuoy, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { TelaVazia } from "@/components/base";
import { ARTIGOS } from "@/lib/ajuda";

type Voto = { artigo: string; util: boolean; motivo?: string | null; created_at: string; updated_at?: string | null };
const dataCurta = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export default function AdminAjuda() {
  const [votos, setVotos] = useState<Voto[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    (async () => {
      let r = await supabase.from("ajuda_votos").select("artigo, util, motivo, created_at, updated_at").limit(5000);
      if (r.error) r = await supabase.from("ajuda_votos").select("artigo, util, created_at").limit(5000) as any;
      if (r.error) { setErro(true); setVotos([]); return; }
      setVotos((r.data || []) as Voto[]);
    })();
  }, []);

  const linhas = useMemo(() => ARTIGOS.map(a => {
    const v = (votos || []).filter(x => x.artigo === a.slug);
    const sim = v.filter(x => x.util).length, nao = v.length - sim;
    const motivos = v.filter(x => !x.util && x.motivo).sort((p, q) => (q.updated_at || q.created_at).localeCompare(p.updated_at || p.created_at));
    return { a, sim, nao, total: v.length, pct: v.length ? Math.round((sim / v.length) * 100) : null, motivos };
  }), [votos]);

  return (
    <div className="aa-root">
      <h1 className="aa-h1">Central de Ajuda</h1>
      <p className="aa-sub">O que as confeiteiras acharam de cada artigo.</p>
      {erro && <p className="aa-erro">Não deu para ler os votos agora.</p>}
      {votos === null ? <p className="aa-sub">Carregando…</p> : !linhas.length ? (
        <TelaVazia caixa icone={<Lifebuoy size={30} />} titulo="Nenhum artigo ainda" texto="Os artigos publicados aparecem aqui." />
      ) : linhas.map(l => (
        <section key={l.a.slug} className="aa-card">
          <div className="aa-top">
            <span className="aa-tit"><b>{l.a.titulo}</b><small>{l.total ? `${l.total} ${l.total === 1 ? "voto" : "votos"}` : "Sem votos ainda"}</small></span>
            {l.pct !== null && <strong className={`aa-pct${l.pct < 60 ? " aa-pct--baixo" : ""}`}>{l.pct}%</strong>}
          </div>
          <div className="aa-nums">
            <span><ThumbsUp size={18} weight="bold" aria-hidden="true" />{l.sim} ajudou</span>
            <span><ThumbsDown size={18} weight="bold" aria-hidden="true" />{l.nao} não ajudou</span>
          </div>
          {l.total > 0 && <div className="aa-barra" aria-hidden="true"><i style={{ width: `${l.pct}%` }} /></div>}
          {!!l.motivos.length && (<>
            <h2 className="aa-h2">O que faltou</h2>
            <ul className="aa-mot">{l.motivos.slice(0, 30).map((m, i) => <li key={i}><p>{m.motivo}</p><small>{dataCurta(m.updated_at || m.created_at)}</small></li>)}</ul>
          </>)}
        </section>
      ))}
      <style>{`
        .aa-root { font-family: var(--font-base); color: var(--ui-texto); max-width: 760px; }
        .aa-h1 { font-size: 22px; font-weight: 700; margin: 0; }
        .aa-sub { font-size: 15px; font-weight: 500; color: var(--ui-texto-2); margin: 4px 0 20px; }
        .aa-erro { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: var(--ui-vermelho-escuro); }
        .aa-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; margin-bottom: 12px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); }
        .aa-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .aa-tit { display: flex; flex-direction: column; min-width: 0; }
        .aa-tit b { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .aa-tit small { font-size: 13px; color: var(--ui-texto-3); }
        .aa-pct { flex: none; font-size: 22px; font-weight: 700; color: var(--ui-verde); }
        .aa-pct--baixo { color: var(--ui-vermelho-escuro); }
        .aa-nums { display: flex; gap: 18px; font-size: 14px; font-weight: 600; color: var(--ui-texto-2); }
        .aa-nums span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
        .aa-barra { height: 8px; border-radius: 99px; background: var(--ui-vermelho-fundo, #FBE4E4); overflow: hidden; }
        .aa-barra i { display: block; height: 100%; background: var(--ui-verde); border-radius: 99px; }
        .aa-h2 { margin: 4px 0 0; font-size: 14px; font-weight: 700; color: var(--ui-texto-2); }
        .aa-mot { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .aa-mot li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--ui-linha, var(--ui-borda)); }
        .aa-mot p { margin: 0; font-size: 14.5px; line-height: 1.45; }
        .aa-mot small { flex: none; font-size: 12.5px; color: var(--ui-texto-3); }
      `}</style>
    </div>
  );
}
