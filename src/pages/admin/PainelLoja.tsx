// ── PainelLoja.tsx ───────────────────────────────────────────────────────────
// (03/11) Mini painel de uma loja no admin: abre ao clicar numa conta (Usuários)
// ou numa loja do "Com o app aberto" (Painel). Lê tudo da função admin_loja,
// que só responde para o admin.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Gaveta, Botao } from "@/components/base";
import { explicarErro } from "@/lib/erros";
import { Crown, WhatsappLogo, InstagramLogo, Storefront, ArrowSquareOut } from "@phosphor-icons/react";

type Loja = {
  id: string; nome: string | null; nome_loja: string | null; email: string | null; telefone: string | null; instagram: string | null;
  logo: string | null; criado_em: string | null; ultimo_acesso_em: string | null; ultimo_login_em: string | null;
  plano: string | null; pro_expira_em: string | null; pro_desde: string | null; assinatura_origem: string | null; assinatura_status: string | null;
  bloqueada: boolean; loja_pausada: boolean; codigo_publico: string | null; slug: string | null; pix_online: boolean;
  cidade: string | null; indicada_por: string | null; indicou: number;
  pedidos: number; pedidos_hoje: number; pedidos_30d: number; cardapio_30d: number; cardapio_total: number; vendido_30d: number;
  ultimo_pedido_em: string | null; por_mes: { mes: string; n: number }[]; mais_vendidos: { nome: string; qtd: number }[];
  produtos: number; clientes: number; orcamentos: number;
};

const ONLINE_MS = 2 * 60_000;
const n = (v: number | null | undefined) => (Number(v) || 0).toLocaleString("pt-BR");
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function visto(iso: string | null, agora: number): string {
  if (!iso) return "Nunca entrou";
  const d = new Date(iso), ms = agora - d.getTime();
  if (ms < ONLINE_MS) return "Online agora";
  if (ms < 3_600_000) return `Há ${Math.max(1, Math.round(ms / 60_000))} min`;
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date(agora), ontem = new Date(agora - 86_400_000);
  if (d.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `Ontem, ${hora}`;
  return d.toLocaleDateString("pt-BR");
}

/** botões de gerenciar a conta (dar/tirar PRO, bloquear, excluir): só na tela Usuários */
export type AcaoLoja = { rotulo: string; sub?: string; icone: ReactNode; perigo?: boolean; ativo?: boolean; aoClicar: () => void };

export default function PainelLoja({ id, aoFechar, acoes, rev = 0 }: { id: string | null; aoFechar: () => void; acoes?: AcaoLoja[]; rev?: number }) {
  const [loja, setLoja] = useState<Loja | null>(null);
  const [erro, setErro] = useState("");
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    setErro(""); setAgora(Date.now());
    supabase.rpc("admin_loja", { uid: id }).then(({ data: d, error }) => {
      if (!vivo) return;
      if (error || !d) setErro(explicarErro(error, "Não deu para abrir os detalhes dessa loja. Tente de novo."));
      else setLoja(d as Loja);
    });
    return () => { vivo = false; };
  }, [id, rev]);

  const l = loja;
  const proAtivo = !!l && l.plano === "pro" && (!l.pro_expira_em || new Date(l.pro_expira_em).getTime() > agora);
  const online = !!l?.ultimo_acesso_em && agora - new Date(l.ultimo_acesso_em).getTime() < ONLINE_MS;
  const ultimo = l?.ultimo_acesso_em || l?.ultimo_login_em || null;
  const fone = (l?.telefone || "").replace(/\D/g, "");
  const wa = fone.length >= 10 ? `https://wa.me/${fone.length <= 11 ? "55" + fone : fone}` : "";
  const cardapio = l?.codigo_publico ? `https://doonly.com.br/c/${l.codigo_publico}/${proAtivo && l.slug ? l.slug : "cardapio"}` : "";
  const insta = (l?.instagram || "").replace(/^@/, "").trim();
  const maxMes = Math.max(1, ...(l?.por_mes || []).map(m => m.n));
  const origem = l?.assinatura_origem === "hotmart" ? "Hotmart" : l?.assinatura_origem ? l.assinatura_origem : proAtivo ? "Liberado pelo admin" : "";

  return (
    <Gaveta
      aberta={!!id}
      aoFechar={aoFechar}
      titulo="Detalhes da loja"
      rodape={wa ? <Botao icone={<WhatsappLogo size={20} weight="bold" />} onClick={() => window.open(wa, "_blank", "noopener")}>Chamar no WhatsApp</Botao> : undefined}
    >
      {erro ? <p className="pl-erro" role="alert">{erro}</p>
        : !l ? <div className="pl-esq" aria-busy="true"><span /><span /><span /></div>
        : (
          <div className="pl">
            <div className="pl-topo">
              <span className="pl-av" aria-hidden="true">
                {l.logo ? <img src={l.logo} alt="" /> : (l.nome_loja || l.nome || "?").charAt(0).toUpperCase()}
                {online && <i />}
              </span>
              <div className="pl-quem">
                <b>{l.nome_loja || l.nome || "Sem nome"}</b>
                <small>{[l.nome_loja && l.nome !== l.nome_loja ? l.nome : "", l.cidade].filter(Boolean).join(" · ") || "Sem cidade ainda"}</small>
                <div className="pl-tags">
                  {proAtivo ? <span className="pl-tag pl-tag--pro"><Crown size={12} weight="fill" aria-hidden="true" /> PRO</span> : <span className="pl-tag">Grátis</span>}
                  <span className={`pl-tag${online ? " pl-tag--on" : ""}`}>{visto(ultimo, agora)}</span>
                  {l.bloqueada && <span className="pl-tag pl-tag--bloq">Bloqueada</span>}
                  {l.loja_pausada && <span className="pl-tag pl-tag--pausa">Loja pausada</span>}
                </div>
              </div>
            </div>

            <div className="pl-links">
              {cardapio && <a href={cardapio} target="_blank" rel="noopener noreferrer"><Storefront size={18} weight="bold" aria-hidden="true" />Cardápio<ArrowSquareOut size={14} weight="bold" aria-hidden="true" /></a>}
              {insta && <a href={`https://instagram.com/${encodeURIComponent(insta)}`} target="_blank" rel="noopener noreferrer"><InstagramLogo size={18} weight="bold" aria-hidden="true" />Instagram</a>}
            </div>

            <h3 className="pl-h">Últimos 30 dias</h3>
            <div className="pl-nums">
              <div className="pl-num-gr"><b>{brl(l.vendido_30d)}</b><small>Vendido em pedidos</small></div>
              <div><b>{n(l.pedidos_30d)}</b><small>Pedidos</small></div>
              <div><b>{n(l.cardapio_30d)}</b><small>Pelo cardápio</small></div>
            </div>

            <h3 className="pl-h">Pedidos por mês</h3>
            <div className="pl-meses" role="img" aria-label={l.por_mes.map(m => `${MESES[Number(m.mes.slice(5)) - 1]}: ${m.n}`).join(", ")}>
              {l.por_mes.map((m, i) => (
                <div key={m.mes} className="pl-mes" title={i === l.por_mes.length - 1 ? "Mês atual, até hoje" : undefined}>
                  <em>{n(m.n)}</em>
                  <span><i style={{ height: `${Math.max(m.n ? 6 : 0, Math.round((m.n / maxMes) * 100))}%` }} /></span>
                  <small>{MESES[Number(m.mes.slice(5)) - 1]}</small>
                </div>
              ))}
            </div>

            <h3 className="pl-h">No app</h3>
            <div className="pl-nums">
              <div><b>{n(l.pedidos)}</b><small>Pedidos</small></div>
              <div><b>{n(l.produtos)}</b><small>Produtos</small></div>
              <div><b>{n(l.clientes)}</b><small>Clientes</small></div>
              <div><b>{n(l.orcamentos)}</b><small>Orçamentos</small></div>
            </div>

            {l.mais_vendidos.length > 0 && <>
              <h3 className="pl-h">Mais vendidos em 90 dias</h3>
              <ol className="pl-top">
                {l.mais_vendidos.map((p, i) => <li key={i}><span>{p.nome || "Produto"}</span><b>{n(p.qtd)}</b></li>)}
              </ol>
            </>}

            <h3 className="pl-h">Conta</h3>
            <dl className="pl-dl">
              <div><dt>E-mail</dt><dd>{l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : "—"}</dd></div>
              <div><dt>Telefone</dt><dd>{l.telefone || "—"}</dd></div>
              <div><dt>Cadastro</dt><dd>{data(l.criado_em)}</dd></div>
              <div><dt>Último pedido</dt><dd>{data(l.ultimo_pedido_em)}</dd></div>
              {proAtivo && l.pro_desde && <div><dt>PRO desde</dt><dd>{data(l.pro_desde)}</dd></div>}
              {proAtivo && <div><dt>PRO vence em</dt><dd>{!l.pro_expira_em ? "Sem vencimento" : new Date(l.pro_expira_em).getFullYear() - new Date(agora).getFullYear() > 50 ? "Vitalício" : data(l.pro_expira_em)}</dd></div>}
              {origem && <div><dt>Assinatura</dt><dd>{origem}{l.assinatura_status ? ` · ${l.assinatura_status}` : ""}</dd></div>}
              <div><dt>Pix online</dt><dd>{l.pix_online ? "Ligado" : "Desligado"}</dd></div>
              {l.indicada_por && <div><dt>Indicada por</dt><dd>{l.indicada_por}</dd></div>}
              {l.indicou > 0 && <div><dt>Indicou</dt><dd>{n(l.indicou)} {l.indicou === 1 ? "conta" : "contas"}</dd></div>}
            </dl>

            {acoes && acoes.length > 0 && <>
              <h3 className="pl-h">Gerenciar conta</h3>
              <div className="pl-acoes">
                {acoes.map(a => (
                  <button key={a.rotulo} type="button" className={`pl-acao${a.perigo ? " pl-acao--perigo" : ""}${a.ativo ? " pl-acao--ativo" : ""}`} onClick={a.aoClicar}>
                    <span className="pl-acao-ic" aria-hidden="true">{a.icone}</span>
                    <span className="pl-acao-tx"><b>{a.rotulo}</b>{a.sub && <small>{a.sub}</small>}</span>
                  </button>
                ))}
              </div>
            </>}
          </div>
        )}
      <style>{`
        .pl { display: flex; flex-direction: column; gap: 4px; }
        .pl-erro { margin: 0; padding: 12px; border-radius: var(--ui-raio); background: var(--ui-laranja-fundo); color: var(--ui-laranja); font-size: 14px; font-weight: 500; }
        .pl-esq { display: flex; flex-direction: column; gap: 12px; }
        .pl-esq span { height: 72px; border-radius: var(--ui-raio-cartao); background: var(--ui-cinza); animation: pl-pisca 1.2s ease-in-out infinite; }
        @keyframes pl-pisca { 50% { opacity: .5; } }
        .pl-topo { display: flex; align-items: center; gap: 14px; }
        .pl-av { position: relative; flex: none; display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 22px; font-weight: 600; }
        .pl-av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .pl-av i { position: absolute; right: 1px; bottom: 1px; width: 14px; height: 14px; border: 2px solid var(--ui-branco); border-radius: 50%; background: var(--ui-verde); }
        .pl-quem { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .pl-quem b { font-size: 18px; font-weight: 600; color: var(--ui-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-quem small { font-size: 14px; font-weight: 500; color: var(--ui-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
        .pl-tag { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border-radius: 6px; background: var(--ui-cinza); font-size: 12px; font-weight: 600; color: var(--ui-texto-2); white-space: nowrap; }
        .pl-tag--pro { background: var(--ui-vinho, #3a1f1a); color: #fff; }
        .pl-tag--on { background: var(--ui-verde-fundo, #e6f6ec); color: var(--ui-verde); }
        .pl-tag--bloq { background: var(--ui-vermelho-fundo, #fde8e8); color: var(--ui-vermelho, #c62828); }
        .pl-tag--pausa { background: var(--ui-laranja-fundo); color: var(--ui-laranja); }
        .pl-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
        .pl-links:empty { display: none; }
        .pl-links a { display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; height: 40px; padding: 0 12px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); font-size: 14px; font-weight: 500; color: var(--ui-texto); text-decoration: none; }
        .pl-links a:hover { border-color: var(--ui-rosa); color: var(--ui-rosa-escuro); }
        .pl-h span { font-weight: 500; }
        .pl-h { margin: 18px 0 6px; font-size: 13px; font-weight: 600; color: var(--ui-texto-3); text-transform: none; }
        .pl-nums { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .pl-num-gr { grid-column: 1 / -1; }
        .pl-num-gr b { font-size: 22px !important; color: var(--ui-verde) !important; }
        .pl-nums div { min-width: 0; padding: 10px 12px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); }
        .pl-nums b { display: block; font-size: 18px; font-weight: 600; color: var(--ui-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-nums small { display: block; font-size: 12px; font-weight: 500; color: var(--ui-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-meses { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; height: 132px; padding: 10px 12px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); }
        .pl-mes { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
        .pl-mes em { font-size: 12px; font-style: normal; font-weight: 600; color: var(--ui-texto-2); }
        .pl-mes span { flex: 1; display: flex; align-items: flex-end; width: 100%; max-width: 28px; }
        .pl-mes i { display: block; width: 100%; border-radius: 4px 4px 0 0; background: var(--ui-rosa); }
        .pl-mes:last-child i { opacity: .45; } /* o mês atual ainda está correndo */
        .pl-mes small { font-size: 12px; font-weight: 500; color: var(--ui-texto-3); }
        .pl-top { list-style: none; margin: 0; padding: 0; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); counter-reset: pl; }
        .pl-top li { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; counter-increment: pl; }
        .pl-top li + li { border-top: 1px solid var(--ui-linha); }
        .pl-top li::before { content: counter(pl); flex: none; width: 20px; font-size: 13px; font-weight: 600; color: var(--ui-texto-3); }
        .pl-top span { flex: 1; min-width: 0; font-size: 14px; font-weight: 500; color: var(--ui-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-top b { flex: none; font-size: 14px; font-weight: 600; color: var(--ui-texto); }
        .pl-dl { margin: 0; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); }
        .pl-dl div { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 0 12px; }
        .pl-dl div + div { border-top: 1px solid var(--ui-linha); }
        .pl-dl dt { flex: none; font-size: 14px; font-weight: 500; color: var(--ui-texto-2); }
        .pl-dl dd a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
        .pl-acoes { border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); overflow: hidden; }
        .pl-acao { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 8px 12px; border: 0; background: none; font-family: inherit; text-align: left; cursor: pointer; }
        .pl-acao + .pl-acao { border-top: 1px solid var(--ui-linha); }
        .pl-acao:hover { background: var(--ui-fundo); }
        .pl-acao-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: var(--ui-cinza); color: var(--ui-texto-2); }
        .pl-acao--ativo .pl-acao-ic { background: var(--ui-vinho); color: #FFD27A; }
        .pl-acao--perigo .pl-acao-ic { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); }
        .pl-acao-tx { min-width: 0; display: flex; flex-direction: column; }
        .pl-acao-tx b { font-size: 15px; font-weight: 600; color: var(--ui-texto); }
        .pl-acao--perigo .pl-acao-tx b { color: var(--ui-vermelho); }
        .pl-acao-tx small { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .pl-dl dd { min-width: 0; margin: 0; font-size: 14px; font-weight: 500; color: var(--ui-texto); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </Gaveta>
  );
}
