import { useState } from "react";
import { Cake, Plus } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { Botao, CaixasEscolha, Janela, avisar } from "@/components/base";

/**
 * (19/11) "Arrumar" dos produtos sem categoria: a confeiteira escolhe entre a Doo organizar
 * (ela sugere, a confeiteira confere e salva tudo de uma vez) ou escolher um por um
 * (o app mostra cada produto e ela toca na categoria). Antes o botão só filtrava a lista.
 */
export type ProdutoSemCat = { id: string; nome: string; descricao?: string | null; imagem_url?: string | null };
type Props = {
  produtos: ProdutoSemCat[];
  categorias: string[];
  userId: string;
  /** o produto ganhou categoria (a tela atualiza a lista) */
  onProduto: (id: string, categoria: string) => void;
  /** categoria criada aqui (a tela inclui na lista dela) */
  onCategoria: (nome: string) => void;
  onFechar: () => void;
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const fotoDe = (p: ProdutoSemCat) => String(p.imagem_url || "").split(",")[0].trim();

export default function ArrumarCategorias({ produtos, categorias, userId, onProduto, onCategoria, onFechar }: Props) {
  const [fila] = useState(produtos); // a lista do momento em que abriu (a de fora vai encolhendo conforme salva)
  const [cats, setCats] = useState(categorias);
  const [tela, setTela] = useState<"escolha" | "doo" | "manual" | "fim">("escolha");
  const [modo, setModo] = useState<"doo" | "manual">("doo");
  const [ocupado, setOcupado] = useState(false);
  const [sug, setSug] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [feitos, setFeitos] = useState(0);
  const [nova, setNova] = useState<string | null>(null);

  /** usa a categoria que já existe com esse nome ou cria; devolve o nome certo (ou null se não deu) */
  const garantirCategoria = async (nomeBruto: string): Promise<string | null> => {
    const nome = nomeBruto.trim().slice(0, 40);
    if (!nome) return null;
    const existe = cats.find(c => semAcento(c) === semAcento(nome));
    if (existe) return existe;
    const { error } = await supabase.from("categorias").insert({ nome, imagem_url: null, ordem: cats.length, user_id: userId }).then(r => r, (e: unknown) => ({ error: e }));
    if (error && (error as { code?: string })?.code !== "23505") return null;
    setCats(l => [...l, nome]);
    onCategoria(nome);
    return nome;
  };

  const gravar = async (id: string, categoria: string): Promise<boolean> => {
    const { error } = await supabase.from("produtos").update({ categoria }).eq("id", id).eq("user_id", userId).then(r => r, (e: unknown) => ({ error: e }));
    if (error) return false;
    onProduto(id, categoria);
    return true;
  };

  // ── A Doo organiza ──
  const pedirDoo = async () => {
    setOcupado(true);
    try {
      const lista = fila.map((p, n) => `${n + 1}. ${p.nome}${p.descricao ? ` (${String(p.descricao).slice(0, 80)})` : ""}`).join("\n");
      const res = await apiFetch("/api/doo-chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          system: "Você organiza o cardápio de uma confeitaria. Para cada produto da lista, escolha a categoria. Use uma das categorias que a loja já tem sempre que alguma servir. Só quando nenhuma servir, sugira uma nova, curta (1 ou 2 palavras, primeira letra maiúscula). Nunca use \"Outros\" nem \"Sem categoria\". Responda SOMENTE com JSON, sem texto antes ou depois, no formato [{\"n\":1,\"categoria\":\"Bolos\"}].",
          messages: [{ role: "user", content: `Categorias da loja: ${cats.length ? cats.join(", ") : "(nenhuma ainda)"}\n\nProdutos:\n${lista}` }],
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        const tipo = typeof data?.error === "string" ? data.error : "";
        avisar(tipo === "limite_mensal" || tipo === "limite_diario" ? "Você chegou ao limite de mensagens da Doo. Escolha um por um." : "A Doo não conseguiu organizar agora. Tente de novo ou escolha um por um.", { tipo: "erro" });
        return;
      }
      const texto = String(data?.content?.[0]?.text || "");
      const json = texto.slice(texto.indexOf("["), texto.lastIndexOf("]") + 1);
      const itens = JSON.parse(json) as { n?: number; categoria?: string }[];
      const mapa: Record<string, string> = {};
      for (const it of itens) {
        const p = fila[Number(it.n) - 1];
        const c = String(it.categoria || "").trim();
        if (p && c) mapa[p.id] = cats.find(x => semAcento(x) === semAcento(c)) || c.slice(0, 40);
      }
      if (!Object.keys(mapa).length) throw new Error("vazio");
      setSug(mapa); setTela("doo");
    } catch {
      avisar("A Doo não conseguiu organizar agora. Tente de novo ou escolha um por um.", { tipo: "erro" });
    } finally { setOcupado(false); }
  };

  const salvarDoo = async () => {
    setOcupado(true);
    let ok = 0;
    for (const p of fila) {
      const alvo = sug[p.id];
      if (!alvo) continue;
      const cat = await garantirCategoria(alvo);
      if (cat && await gravar(p.id, cat)) ok++;
    }
    setOcupado(false); setFeitos(ok); setTela("fim");
  };

  // ── Um por um ──
  const atual = fila[i];
  const proximo = () => { setNova(null); if (i + 1 >= fila.length) setTela("fim"); else setI(i + 1); };
  const escolher = async (nomeCat: string) => {
    if (!atual || ocupado) return;
    setOcupado(true);
    const cat = await garantirCategoria(nomeCat);
    const ok = !!cat && await gravar(atual.id, cat);
    setOcupado(false);
    if (!ok) { avisar("Não deu para salvar. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    setFeitos(n => n + 1); proximo();
  };

  const opcoesCat = Array.from(new Set([...cats, ...Object.values(sug)])).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const n = fila.length;
  const titulo = tela === "escolha" ? `${n} ${n === 1 ? "produto" : "produtos"} sem categoria`
    : tela === "doo" ? "Confira as sugestões"
    : tela === "manual" ? `${i + 1} de ${n}`
    : feitos > 0 ? "Pronto!" : "Nada foi alterado";

  return (
    <Janela aberta aoFechar={onFechar} titulo={titulo} tipo="conteudo" travada={ocupado} className="arc-janela"
      texto={tela === "escolha" ? "Como você quer arrumar?" : tela === "doo" ? "Toque numa categoria para trocar. Nada é salvo antes de você confirmar." : tela === "fim"
        ? `${feitos} ${feitos === 1 ? "produto arrumado" : "produtos arrumados"}${n - feitos > 0 ? `, ${n - feitos} ${n - feitos === 1 ? "ficou" : "ficaram"} sem categoria` : ""}.` : undefined}
      acoes={tela === "escolha" ? <><Botao variante="secundario" onClick={onFechar}>Fechar</Botao><Botao carregando={ocupado} onClick={() => { if (modo === "doo") void pedirDoo(); else setTela("manual"); }}>Continuar</Botao></>
        : tela === "doo" ? <><Botao variante="secundario" onClick={() => setTela("escolha")} disabled={ocupado}>Voltar</Botao><Botao carregando={ocupado} onClick={() => void salvarDoo()}>{`Salvar ${Object.keys(sug).length === 1 ? "o produto" : `os ${Object.keys(sug).length}`}`}</Botao></>
        : tela === "manual" ? <><Botao variante="secundario" onClick={onFechar} disabled={ocupado}>Fechar</Botao><Botao variante="secundario" onClick={proximo} disabled={ocupado}>Pular este</Botao></>
        : <Botao cheio onClick={onFechar}>Fechar</Botao>}>
      {tela === "escolha" && (
        <CaixasEscolha<"doo" | "manual"> rotulo="Como arrumar" valor={modo} onMudar={setModo} opcoes={[
          { v: "doo", t: "A Doo organiza", sub: "Ela sugere a categoria de cada um e você confere" },
          { v: "manual", t: "Escolher um por um", sub: "O app mostra cada produto e você toca na categoria" },
        ]} />
      )}

      {tela === "doo" && (
        <ul className="arc-lista">
          {fila.filter(p => sug[p.id]).map(p => (
            <li key={p.id}>
              <span className="arc-nm">{p.nome}</span>
              <select aria-label={`Categoria de ${p.nome}`} value={sug[p.id]} disabled={ocupado} onChange={e => setSug(s => ({ ...s, [p.id]: e.target.value }))}>
                {opcoesCat.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}

      {tela === "manual" && atual && (
        <div className="arc-um">
          <div className="arc-prod">
            <span className="arc-ft" aria-hidden="true">{fotoDe(atual) ? <img src={fotoDe(atual)} alt="" /> : <Cake size={22} weight="bold" />}</span>
            <b>{atual.nome}</b>
          </div>
          <p className="arc-lbl">Qual é a categoria?</p>
          <div className="arc-cats">
            {cats.slice().sort((a, b) => a.localeCompare(b, "pt-BR")).map(c => (
              <button key={c} type="button" className="arc-cat" disabled={ocupado} onClick={() => void escolher(c)}>{c}</button>
            ))}
            {nova === null
              ? <button type="button" className="arc-cat arc-cat--nova" disabled={ocupado} onClick={() => setNova("")}><Plus size={16} weight="bold" aria-hidden="true" />Nova categoria</button>
              : (
                <form className="arc-nova" onSubmit={e => { e.preventDefault(); if (nova.trim()) void escolher(nova); }}>
                  <input autoFocus maxLength={40} placeholder="Nome da categoria" value={nova} onChange={e => setNova(e.target.value)} autoComplete="off" />
                  <Botao tamanho="m" type="submit" disabled={!nova.trim() || ocupado}>Criar</Botao>
                </form>
              )}
          </div>
        </div>
      )}

      <style>{`
        .arc-lista { list-style: none; margin: 0; padding: 0; }
        .arc-lista li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--ui-linha); }
        .arc-lista li:first-child { border-top: 0; }
        .arc-nm { flex: 1; min-width: 0; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .arc-lista select { flex: none; max-width: 46%; min-height: 40px; padding: 0 8px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); font-family: inherit; font-size: 14px; color: var(--ui-texto); }
        .arc-prod { display: flex; align-items: center; gap: 12px; }
        .arc-prod b { flex: 1; min-width: 0; font-size: 16px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .arc-ft { flex: none; display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 12px; overflow: hidden; background: var(--ui-cinza); color: var(--ui-texto-2); }
        .arc-ft img { width: 100%; height: 100%; object-fit: cover; }
        .arc-lbl { margin: 14px 0 6px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .arc-cats { display: flex; flex-direction: column; gap: 6px; }
        .arc-cat { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 46px; margin: 0; padding: 0 12px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); background: var(--ui-branco); font-family: inherit; font-size: 15px; text-align: left; color: var(--ui-texto); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .arc-cat:active { background: var(--ui-cinza); }
        .arc-cat--nova { color: var(--ui-texto-2); }
        .arc-nova { display: flex; gap: 8px; }
        .arc-nova input { flex: 1; min-width: 0; min-height: 46px; padding: 0 12px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); font-family: inherit; font-size: 15px; color: var(--ui-texto); }
      `}</style>
    </Janela>
  );
}
