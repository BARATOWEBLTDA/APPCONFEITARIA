/**
 * (20/11) doonly.com.br/aparelhos — conferência interna: o app de verdade rodando lado a lado em vários tamanhos de tela,
 * cada um numa moldura. Não aparece em menu nenhum. Sem login, mostra só uma caixa de e-mail e senha (sem cadastro):
 * entrando ali, todas as molduras abrem na mesma conta.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Aparelho = { id: string; nome: string; l: number; a: number; on: boolean; tipo?: "tb" | "pc" };

// do menor para o maior (largura × altura da tela, na medida que o app enxerga)
const APARELHOS: Aparelho[] = [
  { id: "p320", nome: "Celular pequeno", l: 320, a: 568, on: true },
  { id: "p360", nome: "Galaxy A / S", l: 360, a: 780, on: true },
  { id: "p375", nome: "iPhone SE", l: 375, a: 667, on: true },
  { id: "p390", nome: "iPhone 14 / 15", l: 390, a: 844, on: true },
  { id: "p412", nome: "Pixel / Galaxy Ultra", l: 412, a: 915, on: true },
  { id: "p430", nome: "iPhone Pro Max", l: 430, a: 932, on: true },
  { id: "t768", nome: "Tablet (iPad mini)", l: 768, a: 1024, on: true, tipo: "tb" },
  { id: "t820", nome: "Tablet (iPad)", l: 820, a: 1180, on: false, tipo: "tb" },
  { id: "pc", nome: "Computador", l: 1280, a: 800, on: false, tipo: "pc" },
];
const ATALHOS: [string, string][] = [["Início", "/inicio"], ["Pedidos", "/pedidos"], ["Produtos", "/produtos"], ["Minha loja", "/cardapio"], ["Aparência", "/cardapio-design"]];
const CHAVE = "doonly-aparelhos-2";

const limpa = (r: string) => {
  let s = (r || "/").trim();
  try { if (/^https?:/i.test(s)) { const u = new URL(s); s = u.pathname + u.search; } } catch { /* fica como digitou */ }
  if (!s.startsWith("/")) s = "/" + s;
  return /^\/aparelhos/.test(s) ? "/inicio" : s;
};
const lerGuardado = (): { rota?: string; zoom?: number; on?: Record<string, boolean> } => { try { return JSON.parse(localStorage.getItem(CHAVE) || "{}"); } catch { return {}; } };

export default function Aparelhos() {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState("");

  const g = useRef(lerGuardado()).current;
  const [rota, setRota] = useState(() => limpa(new URLSearchParams(window.location.search).get("tela") || g.rota || "/inicio"));
  const [campo, setCampo] = useState(rota);
  const [zoom, setZoom] = useState(g.zoom || 55);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(APARELHOS.map(a => [a.id, g.on && a.id in g.on ? g.on[a.id] : a.on])));
  const [juntos, setJuntos] = useState(true);
  const [carga, setCarga] = useState(0); // muda quando é pra recarregar as molduras numa tela
  const palco = useRef<HTMLDivElement>(null);
  const ultima = useRef(rota);

  useEffect(() => {
    document.title = "Doonly em vários aparelhos";
    let vivo = true;
    void supabase.auth.getSession().then(({ data }) => { if (vivo) setLogado(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s));
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { try { localStorage.setItem(CHAVE, JSON.stringify({ rota, zoom, on })); } catch { /* sem espaço: segue sem guardar */ } }, [rota, zoom, on]);

  // "Andar juntos": você navega em um aparelho e os outros vão para a mesma tela (sem recarregar)
  useEffect(() => {
    if (!logado || !juntos) return;
    const t = window.setInterval(() => {
      const quadros = Array.from(palco.current?.querySelectorAll("iframe") || []);
      let mudou: { f: HTMLIFrameElement; p: string } | null = null;
      for (const f of quadros) {
        try { const w = f.contentWindow!; const p = w.location.pathname + w.location.search; if (w.location.href !== "about:blank" && p !== ultima.current && !mudou) mudou = { f, p }; } catch { /* moldura ainda abrindo */ }
      }
      if (!mudou) return;
      const destino = mudou.p; const origem = mudou.f;
      ultima.current = destino; setRota(destino); setCampo(destino);
      for (const f of quadros) {
        if (f === origem) continue;
        try { const w = f.contentWindow!; if (w.location.pathname + w.location.search === destino) continue; w.history.pushState({}, "", destino); w.dispatchEvent(new PopStateEvent("popstate")); } catch { f.src = destino; }
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [logado, juntos]);

  const ir = (r: string) => { const d = limpa(r); ultima.current = d; setRota(d); setCampo(d); setCarga(c => c + 1); };

  const entrar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (entrando) return;
    setErro(""); setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEntrando(false);
    if (error) setErro(/invalid login/i.test(error.message) ? "E-mail ou senha não conferem." : "Não deu para entrar agora. Tente de novo.");
    else setSenha("");
  };

  const ligados = APARELHOS.filter(a => on[a.id]);
  const e = zoom / 100;

  return (
    <div className="apv">
      <style>{CSS}</style>
      {logado === false ? (
        <form className="apv-login" onSubmit={entrar}>
          <h1>Doonly em vários aparelhos</h1>
          <p>Entre com a sua conta do Doonly.</p>
          <label htmlFor="apv-email">E-mail</label>
          <input id="apv-email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={x => setEmail(x.target.value)} />
          <label htmlFor="apv-senha">Senha</label>
          <input id="apv-senha" type="password" autoComplete="current-password" required value={senha} onChange={x => setSenha(x.target.value)} />
          {erro && <p className="apv-erro" role="alert">{erro}</p>}
          <button type="submit" disabled={entrando}>{entrando ? "Entrando…" : "Entrar"}</button>
        </form>
      ) : logado ? (
        <>
          <div className="apv-barra">
            <h1>Doonly em vários aparelhos</h1>
            <form className="apv-end" onSubmit={x => { x.preventDefault(); ir(campo); }}>
              <span>{window.location.host}</span>
              <input value={campo} onChange={x => setCampo(x.target.value)} spellCheck={false} autoComplete="off" aria-label="Tela do app" />
              <button type="submit">Abrir</button>
            </form>
            <div className="apv-linha">{ATALHOS.map(([n, r]) => <button type="button" key={r} onClick={() => ir(r)}>{n}</button>)}</div>
            <div className="apv-linha">{APARELHOS.map(a => <button type="button" key={a.id} aria-pressed={!!on[a.id]} onClick={() => setOn(o => ({ ...o, [a.id]: !o[a.id] }))}>{a.nome}</button>)}</div>
            <label className="apv-sinc"><input type="checkbox" checked={juntos} onChange={x => setJuntos(x.target.checked)} /> Andar juntos</label>
            <label className="apv-zoom">Tamanho <input type="range" min={25} max={100} value={zoom} onChange={x => setZoom(Number(x.target.value))} /> <span>{zoom}%</span></label>
            <button type="button" className="apv-sair" onClick={() => { void supabase.auth.signOut({ scope: "local" }); }}>Sair</button>
          </div>
          <div className="apv-palco" ref={palco}>
            {ligados.length === 0 ? <p className="apv-aviso">Marque pelo menos um aparelho na barra de cima.</p> : (
              <div className="apv-fila">
                {ligados.map(a => {
                  const borda = a.tipo === "pc" ? 9 : a.tipo === "tb" ? 15 : 11;
                  return (
                    <div className="apv-ap" key={a.id}>
                      <p className="apv-nome"><b>{a.nome}</b> · {a.l} × {a.a}</p>
                      <div className="apv-caixa" style={{ width: Math.round((a.l + borda * 2) * e), height: Math.round((a.a + borda * 2) * e) }}>
                        <div className={`apv-corpo${a.tipo ? ` ${a.tipo}` : ""}`} style={{ transform: `scale(${e})` }}>
                          {/* a "key" só muda quando você manda abrir uma tela: mexer no tamanho não recarrega o app */}
                          <Quadro key={carga} nome={a.nome} l={a.l} a={a.a} inicial={ultima.current} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** a moldura guarda o endereço com que nasceu: redesenhar a página (tamanho, marcar aparelho) não recarrega o app */
function Quadro({ nome, l, a, inicial }: { nome: string; l: number; a: number; inicial: string }) {
  const [src] = useState(inicial);
  return <iframe title={nome} width={l} height={a} src={src} />;
}

const CSS = `
.apv { position: fixed; inset: 0; display: flex; flex-direction: column; background: #F3F1F2; color: #2B1F24; font-family: Poppins, system-ui, sans-serif; overflow: hidden; }
.apv * { box-sizing: border-box; }
.apv-login { width: min(360px, calc(100% - 32px)); margin: auto; padding: 26px 24px 24px; border: 1px solid #E8E3E5; border-radius: 16px; background: #fff; display: flex; flex-direction: column; }
.apv-login h1 { margin: 0; font-size: 18px; font-weight: 600; }
.apv-login > p { margin: 4px 0 14px; font-size: 13.5px; color: #776B71; }
.apv-login label { margin: 10px 0 6px; font-size: 13px; font-weight: 600; color: #4B3A42; }
.apv-login input { height: 46px; padding: 0 12px; border: 1.5px solid #DDD5D9; border-radius: 10px; font: inherit; font-size: 15px; color: inherit; outline: 0; }
.apv-login input:focus { border-color: #4B3A42; }
.apv-login button { height: 48px; margin-top: 18px; border: 0; border-radius: 12px; background: #CC2E66; color: #fff; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
.apv-login button:disabled { opacity: .6; cursor: default; }
.apv-login .apv-erro { margin: 12px 0 0; font-size: 13px; color: #B3261E; }
.apv-barra { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #E8E3E5; }
.apv-barra h1 { margin: 0 6px 0 0; font-size: 15px; font-weight: 600; white-space: nowrap; }
.apv-end { flex: 1 1 260px; display: flex; align-items: center; height: 38px; min-width: 0; border: 1.5px solid #DDD5D9; border-radius: 10px; background: #fff; overflow: hidden; }
.apv-end span { padding: 0 2px 0 12px; font-size: 13px; color: #776B71; white-space: nowrap; }
.apv-end input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; font: inherit; font-size: 14px; color: inherit; background: none; }
.apv-end button { height: 100%; padding: 0 14px; border: 0; border-left: 1.5px solid #DDD5D9; background: #FAF8F9; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.apv-linha { display: flex; flex-wrap: wrap; gap: 6px; }
.apv-linha button, .apv-sair { height: 32px; padding: 0 10px; border: 1px solid #E0D9DC; border-radius: 8px; background: #fff; font: inherit; font-size: 12.5px; color: #4B3A42; cursor: pointer; white-space: nowrap; }
.apv-linha button[aria-pressed="true"] { border-color: #2B1F24; background: #F3F1F2; color: #2B1F24; }
.apv-linha button[aria-pressed="false"] { color: #9A8F94; }
.apv-sinc, .apv-zoom { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #4B3A42; white-space: nowrap; cursor: pointer; }
.apv-sinc input, .apv-zoom input { accent-color: #4B3A42; }
.apv-zoom input { width: 110px; }
.apv-sair { margin-left: auto; }
.apv-palco { flex: 1; overflow: auto; padding: 22px 22px 40px; }
.apv-fila { display: flex; align-items: flex-start; gap: 26px; width: max-content; margin: 0 auto; }
.apv-ap { flex: none; }
.apv-nome { margin: 0 0 8px; text-align: center; font-size: 12.5px; color: #776B71; white-space: nowrap; }
.apv-nome b { font-weight: 600; color: #2B1F24; }
.apv-caixa { position: relative; }
.apv-corpo { position: absolute; left: 0; top: 0; transform-origin: 0 0; padding: 10px; border: 1px solid #D9D2D6; border-radius: 44px; background: #fff; box-shadow: 0 10px 30px rgba(43, 31, 36, .08); }
.apv-corpo iframe { display: block; border: 0; border-radius: 35px; background: #fff; }
.apv-corpo.tb { border-radius: 34px; padding: 14px; }
.apv-corpo.tb iframe { border-radius: 20px; }
.apv-corpo.pc { border-radius: 16px; padding: 8px; }
.apv-corpo.pc iframe { border-radius: 9px; }
.apv-aviso { max-width: 520px; margin: 60px auto; padding: 18px 20px; border: 1px solid #E8E3E5; border-radius: 14px; background: #fff; font-size: 14px; line-height: 1.5; text-align: center; }
@media (max-width: 700px) { .apv-barra h1 { width: 100%; } .apv-palco { padding: 16px 12px 30px; } }
`;
