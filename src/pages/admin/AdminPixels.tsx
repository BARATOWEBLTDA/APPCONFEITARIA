// ── AdminPixels.tsx ──────────────────────────────────────────────────────────
// (04/11 · 6.21) Pixels do próprio Doonly: quantos quiser, de Meta, Google e TikTok.
// Rodam nas telas do app (login, cadastro, Início, Assinar…) e marcam visita, cadastro, clique em
// assinar, teste grátis e assinatura. Não entram no cardápio das confeiteiras (lá vale o pixel de cada
// uma, na tela Pixel do app) nem neste painel.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { FacebookLogo, GoogleLogo, TiktokLogo, Trash, CheckCircle, Target, Info } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Botao, BotaoIcone, Campo, CaixasEscolha, TelaVazia, avisar, confirmar } from "@/components/base";
import { registrar } from "@/lib/adminPerfil";
import { codigoValido, limparCodigo, type Plataforma } from "@/lib/facebookPixel";

type PixelApp = { id: string; plataforma: Plataforma; codigo: string; nome: string | null; ativo: boolean; created_at: string };

const PLAT: Record<Plataforma, { nome: string; sub: string; Ic: Icon; cor: string; rotulo: string; exemplo: string; dica: string; erro: string; limpar: (v: string) => string }> = {
  meta: { nome: "Meta", sub: "Facebook e Instagram", Ic: FacebookLogo, cor: "#1877F2", rotulo: "ID do pixel", exemplo: "Ex.: 123456789012345", dica: "Só os números.",
    erro: "Use de 10 a 20 números, sem espaços.", limpar: v => v.replace(/\D/g, "").slice(0, 20) },
  google: { nome: "Google", sub: "Analytics (G-) ou Google Ads (AW-)", Ic: GoogleLogo, cor: "#EA4335", rotulo: "ID da tag", exemplo: "Ex.: G-AB12CD34EF", dica: "Começa com G- ou AW-.",
    erro: "A tag do Google começa com G- ou AW-. Ex.: G-AB12CD34EF.", limpar: v => v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) },
  tiktok: { nome: "TikTok", sub: "Anúncios do TikTok", Ic: TiktokLogo, cor: "#111111", rotulo: "ID do pixel", exemplo: "Ex.: C9ABCDEF12GHIJ34KLMN", dica: "Letras e números, sem espaços.",
    erro: "Use de 15 a 30 letras e números.", limpar: v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30) },
};
const EVENTOS = ["Visita de cada tela do app", "Cadastro feito", "Tocou em assinar o PRO", "Começou o teste grátis", "Assinou o PRO, com o valor"];
const rotuloDe = (p: PixelApp) => (p.nome || "").trim() || `Pixel do ${PLAT[p.plataforma].nome}`;

export default function AdminPixels() {
  const [lista, setLista] = useState<PixelApp[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [plat, setPlat] = useState<Plataforma>("meta");
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mexendo, setMexendo] = useState<string | null>(null);

  const carregar = async () => {
    const { data, error } = await supabase.from("app_pixels").select("id, plataforma, codigo, nome, ativo, created_at").order("created_at");
    if (error) avisar("Não deu para carregar os pixels. Atualize a página.", { tipo: "erro" });
    else setLista((data as PixelApp[]) || []);
    setCarregando(false);
  };
  useEffect(() => { void carregar(); }, []);

  const P = PLAT[plat];
  const erro = tentou && (!codigo ? "Cole o código do pixel." : !codigoValido(plat, codigo) ? P.erro : undefined);

  const adicionar = async () => {
    setTentou(true);
    if (!codigo || !codigoValido(plat, codigo)) return;
    setSalvando(true);
    const novo = { plataforma: plat, codigo: limparCodigo(plat, codigo), nome: nome.trim() || null };
    const { error } = await supabase.from("app_pixels").insert(novo);
    setSalvando(false);
    if (error) {
      avisar(error.code === "23505" ? "Esse pixel já está na lista." : "Não deu para salvar. Tente de novo.", { tipo: "erro" });
      return;
    }
    void registrar(`adicionou o pixel do ${P.nome} ${novo.nome ? `"${novo.nome}" ` : ""}(${novo.codigo})`, { tipo: "pixel" });
    avisar(`Pixel do ${P.nome} adicionado. Ele já roda no app.`, { tipo: "ok" });
    setCodigo(""); setNome(""); setTentou(false);
    void carregar();
  };

  const ligarDesligar = async (p: PixelApp) => {
    setMexendo(p.id);
    const { error } = await supabase.from("app_pixels").update({ ativo: !p.ativo }).eq("id", p.id);
    setMexendo(null);
    if (error) { avisar("Não deu para mudar. Tente de novo.", { tipo: "erro" }); return; }
    setLista(l => l.map(x => (x.id === p.id ? { ...x, ativo: !p.ativo } : x)));
    void registrar(`${p.ativo ? "desligou" : "ligou"} o pixel "${rotuloDe(p)}" (${p.codigo})`, { tipo: "pixel" });
  };

  const excluir = async (p: PixelApp) => {
    if (!(await confirmar({ titulo: `Excluir "${rotuloDe(p)}"?`, texto: "O app para de mandar visitas e conversões para esse pixel. O que já foi enviado continua na plataforma.", rotulo: "Excluir", perigo: true }))) return;
    const { error } = await supabase.from("app_pixels").delete().eq("id", p.id);
    if (error) { avisar("Não deu para excluir. Tente de novo.", { tipo: "erro" }); return; }
    setLista(l => l.filter(x => x.id !== p.id));
    void registrar(`excluiu o pixel "${rotuloDe(p)}" (${p.codigo})`, { tipo: "pixel" });
  };

  const ligados = lista.filter(p => p.ativo).length;

  return (
    <div className="apx">
      <h1 className="apx-t">Pixels do app</h1>
      <p className="apx-sub">Meça os cadastros e as assinaturas que vêm dos anúncios do Doonly.</p>

      <div className="apx-grade">
        <section className="apx-card">
          <h2 className="apx-h">Adicionar pixel</h2>
          <CaixasEscolha rotulo="Plataforma" valor={plat} onMudar={v => { setPlat(v); setCodigo(""); setTentou(false); }}
            opcoes={(Object.keys(PLAT) as Plataforma[]).map(k => ({ v: k, t: PLAT[k].nome, sub: PLAT[k].sub }))} />
          <Campo rotulo={P.rotulo} placeholder={P.exemplo} autoComplete="off" spellCheck={false} value={codigo} erro={erro || undefined} dica={P.dica}
            onChange={e => setCodigo(P.limpar(e.target.value))} />
          <Campo rotulo="Nome (opcional)" placeholder="Ex.: Campanha do Instagram" maxLength={60} value={nome} onChange={e => setNome(e.target.value)} />
          <Botao onClick={adicionar} carregando={salvando} cheio>Adicionar pixel</Botao>
        </section>

        <div className="apx-col">
          <section className="apx-card">
            <div className="apx-cab">
              <h2 className="apx-h">Seus pixels</h2>
              {lista.length > 0 && <span className="apx-cont">{ligados} {ligados === 1 ? "ligado" : "ligados"}</span>}
            </div>
            {carregando ? <p className="apx-carr" aria-busy="true">Carregando…</p>
              : lista.length === 0 ? <TelaVazia compacta icone={<Target size={30} />} titulo="Nenhum pixel ainda" texto="Adicione o primeiro ao lado. Ele começa a contar na hora." />
              : <ul className="apx-lista">
                  {lista.map(p => {
                    const pl = PLAT[p.plataforma];
                    return (
                      <li key={p.id} className={`apx-l${p.ativo ? "" : " off"}`}>
                        <span className="apx-ic" aria-hidden="true" style={{ color: pl.cor }}><pl.Ic size={22} weight="fill" /></span>
                        <span className="apx-tx"><b>{rotuloDe(p)}</b><small>{pl.nome} · <code>{p.codigo}</code></small></span>
                        <button type="button" role="switch" aria-checked={p.ativo} aria-label={p.ativo ? `Desligar ${rotuloDe(p)}` : `Ligar ${rotuloDe(p)}`}
                          className={`apx-sw${p.ativo ? " on" : ""}`} disabled={mexendo === p.id} onClick={() => ligarDesligar(p)}><i /></button>
                        <BotaoIcone rotulo={`Excluir ${rotuloDe(p)}`} tamanho="p" onClick={() => excluir(p)}><Trash size={18} weight="bold" /></BotaoIcone>
                      </li>
                    );
                  })}
                </ul>}
          </section>

          <section className="apx-card apx-ev">
            <h2 className="apx-h">O que cada pixel registra</h2>
            {EVENTOS.map(t => <span key={t}><CheckCircle size={18} weight="fill" aria-hidden="true" />{t}</span>)}
            <p className="apx-nota"><Info size={18} weight="bold" aria-hidden="true" />Não roda no cardápio das confeiteiras (lá vale o pixel de cada uma) nem neste painel.</p>
          </section>
        </div>
      </div>

      <style>{`
        .apx { font-family: var(--font-base); color: var(--ui-texto); max-width: 1080px; }
        .apx-t { margin: 0; font-size: 22px; font-weight: 600; }
        .apx-sub { margin: 4px 0 16px; font-size: 15px; font-weight: 500; color: var(--ui-texto-2); }
        .apx-grade { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
        @media (min-width: 960px) { .apx-grade { grid-template-columns: minmax(0, 400px) minmax(0, 1fr); } }
        .apx-col { display: grid; gap: 12px; min-width: 0; }
        .apx-card { display: flex; flex-direction: column; gap: 14px; min-width: 0; padding: 18px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); box-shadow: var(--ui-sombra-cartao); }
        .apx-h { margin: 0; font-size: 16px; font-weight: 600; }
        .apx-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .apx-cont { font-size: 13px; font-weight: 500; color: var(--ui-texto-3); white-space: nowrap; }
        .apx-carr { margin: 0; font-size: 14px; color: var(--ui-texto-3); }
        .apx-lista { list-style: none; margin: 0; padding: 0; }
        .apx-l { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 0; border-top: 1px solid var(--ui-linha); }
        .apx-l:first-child { border-top: 0; padding-top: 0; }
        .apx-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: #F4F1F2; }
        .apx-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .apx-tx b { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .apx-tx small { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .apx-tx code { font-family: inherit; letter-spacing: .02em; }
        .apx-l.off .apx-ic, .apx-l.off .apx-tx { opacity: .5; }
        .apx-sw { flex: none; position: relative; width: 44px; height: 26px; padding: 0; border: 0; border-radius: 99px; background: #D9D3D6; cursor: pointer; transition: background .15s; }
        .apx-sw i { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .15s; }
        .apx-sw.on { background: var(--ui-verde); }
        .apx-sw.on i { transform: translateX(18px); }
        .apx-sw:disabled { opacity: .6; cursor: default; }
        .apx-ev { gap: 10px; }
        .apx-ev > span { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
        .apx-ev > span svg { flex: none; color: var(--ui-verde); }
        .apx-nota { display: flex; gap: 8px; margin: 4px 0 0; padding: 12px; border-radius: 12px; background: #F7F4F5; font-size: 13.5px; font-weight: 500; line-height: 1.45; color: var(--ui-texto-2); }
        .apx-nota svg { flex: none; margin-top: 1px; }
      `}</style>
    </div>
  );
}
