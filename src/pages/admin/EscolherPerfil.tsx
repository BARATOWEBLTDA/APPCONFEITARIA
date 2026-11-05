// ── EscolherPerfil.tsx ───────────────────────────────────────────────────────
// (04/11) "Quem está no painel?": a tela de entrar do admin, estilo Netflix.
// Os perfis vêm da tabela admin_perfis (Anthony, Bruno e Marcos).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { NomeDoonly } from "@/components/marca/Mascote";
import { escolherPerfil, ultimoPerfil, type PerfilAdmin } from "@/lib/adminPerfil";

export function AvatarAdmin({ perfil, tamanho = 36, className = "" }: { perfil: Pick<PerfilAdmin, "nome" | "foto_url" | "cor"> | null; tamanho?: number; className?: string }) {
  const nome = perfil?.nome || "Admin";
  return (
    <span className={`avad ${className}`} aria-hidden="true"
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.42), background: perfil?.foto_url ? "transparent" : (perfil?.cor || "var(--ui-rosa)") }}>
      {perfil?.foto_url ? <img src={perfil.foto_url} alt="" /> : nome.charAt(0).toUpperCase()}
      <style>{`.avad { flex: none; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%; color: #fff; font-weight: 600; line-height: 1; }
        .avad img { width: 100%; height: 100%; object-fit: cover; }`}</style>
    </span>
  );
}

export default function EscolherPerfil({ aoSair }: { aoSair: () => void }) {
  const [perfis, setPerfis] = useState<PerfilAdmin[] | null>(null);
  const [erro, setErro] = useState(false);
  const ultimo = ultimoPerfil();

  useEffect(() => {
    supabase.from("admin_perfis").select("id, nome, foto_url, cor").eq("ativo", true).order("ordem")
      .then(({ data, error }) => { if (error) setErro(true); else setPerfis((data as PerfilAdmin[]) || []); });
  }, []);

  return (
    <div className="qep">
      <NomeDoonly cor="branco" className="qep-marca" />
      <h1 className="qep-t">Quem está no painel?</h1>
      {erro ? <p className="qep-erro">Não deu para carregar os perfis. Atualize a página.</p>
        : !perfis ? <div className="qep-lista" aria-busy="true">{[0, 1, 2].map(i => <span key={i} className="qep-esq" />)}</div>
        : (
          <div className="qep-lista">
            {perfis.map(p => (
              <button key={p.id} type="button" className={`qep-p${p.id === ultimo ? " qep-p--ultimo" : ""}`} onClick={() => escolherPerfil(p)}>
                <span className="qep-foto" style={{ background: p.foto_url ? "#2a1a1e" : (p.cor || "var(--ui-rosa)") }}>
                  {p.foto_url ? <img src={p.foto_url} alt="" /> : <b>{p.nome.charAt(0)}</b>}
                </span>
                <span className="qep-nome">{p.nome}</span>
              </button>
            ))}
          </div>
        )}
      <button type="button" className="qep-sair" onClick={aoSair}>Sair do painel</button>
      <style>{`
        .qep { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; padding: 24px 16px;
          background: radial-gradient(ellipse at 50% 30%, #3a2128 0%, #1b1012 70%); font-family: var(--font-base); color: #fff; overflow-y: auto; }
        .qep-marca { position: absolute; top: 24px; left: 28px; height: 34px; width: auto; }
        .qep-t { margin: 0; font-size: clamp(26px, 4vw, 40px); font-weight: 600; text-align: center; letter-spacing: -.01em; }
        .qep-lista { display: flex; flex-wrap: wrap; justify-content: center; gap: 28px; }
        .qep-esq { width: 140px; height: 140px; border-radius: 24px; background: rgba(255,255,255,.08); }
        .qep-p { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 0; border: 0; background: none; font-family: inherit; color: rgba(255,255,255,.7); cursor: pointer; }
        .qep-foto { position: relative; display: flex; align-items: center; justify-content: center; width: 140px; height: 140px; overflow: hidden; border-radius: 24px; outline: 3px solid transparent; outline-offset: 4px; box-shadow: 0 12px 30px rgba(0,0,0,.35); transition: transform .18s, outline-color .18s; }
        .qep-foto img { width: 100%; height: 100%; object-fit: cover; }
        .qep-foto b { font-size: 56px; font-weight: 600; color: #fff; }
        .qep-nome { font-size: 18px; font-weight: 500; transition: color .18s; }
        .qep-p:hover .qep-foto, .qep-p:focus-visible .qep-foto { transform: translateY(-4px) scale(1.03); outline-color: #fff; }
        .qep-p:hover .qep-nome, .qep-p:focus-visible .qep-nome { color: #fff; }
        .qep-p:focus-visible { outline: none; }
        .qep-p--ultimo .qep-nome::after { content: ""; display: block; width: 6px; height: 6px; margin: 6px auto 0; border-radius: 50%; background: var(--ui-rosa); }
        .qep-erro { margin: 0; font-size: 15px; color: #FFD3E2; }
        .qep-sair { min-height: 44px; padding: 0 20px; border: 1px solid rgba(255,255,255,.3); border-radius: 99px; background: none; font-family: inherit; font-size: 14px; font-weight: 500; color: rgba(255,255,255,.75); cursor: pointer; }
        .qep-sair:hover { border-color: #fff; color: #fff; }
        @media (max-width: 599px) {
          .qep { justify-content: flex-start; padding-top: 110px; }
          .qep-marca { left: 50%; transform: translateX(-50%); height: 30px; }
          .qep-lista { gap: 20px 18px; }
          .qep-foto, .qep-esq { width: 96px; height: 96px; border-radius: 18px; }
          .qep-foto b { font-size: 40px; }
          .qep-nome { font-size: 16px; }
        }
        @media (prefers-reduced-motion: reduce) { .qep-foto { transition: none; } }
      `}</style>
    </div>
  );
}
