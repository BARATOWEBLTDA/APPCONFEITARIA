import { useRef, useState } from "react";
import { unzip, type Unzipped } from "fflate";
import { CheckCircle, FileZip, Plus, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { Botao, CaixasEscolha, Janela, avisar } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { registrar } from "@/lib/adminPerfil";
import { paraWebp } from "@/lib/imagemLeve";
import { BUCKET_ARQUIVOS, formatoDe, nomeSeguro, type ArquivoTopo, type CategoriaTopo, type Topo } from "@/lib/toposBolo";

/**
 * (10/11) Admin · Topos de bolo: importar vários topos de uma vez.
 * Cada topo: o .webp é a capa; os .png, .pdf (e .studio3, .jpg…) são os arquivos que a PRO baixa.
 * (11/11) Aceita 3 jeitos de mandar:
 *  · um .zip por topo (pode escolher vários)          → nome do topo = nome do .zip
 *  · um .zip com o .zip de cada topo dentro           → nome = nome de cada .zip de dentro
 *  · um .zip com uma pasta para cada topo             → nome = nome da pasta
 * A categoria é escolhida (ou criada) uma vez para o lote; as tags a IA gera pela capa e pelo nome.
 * Opções do lote: deixar escondido para conferir, e o que fazer quando o nome já existe (pular ou substituir).
 */

type Estado = "fila" | "lendo" | "enviando" | "tags" | "pronto" | "erro" | "existe" | "parado";
type Item = { chave: string; nome: string; abrir: () => Promise<File[]>; estado: Estado; detalhe?: string };

const TIPOS: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", pdf: "application/pdf", webp: "image/webp" };
const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();
const sufixo = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const lixo = (caminho: string) => /(^|\/)(__MACOSX|\.)/.test(caminho) || caminho.endsWith("/");
const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "festa_homem-aranha.zip" → "Festa homem aranha" */
export function nomeDoZip(arquivo: string): string {
  const t = arquivo.replace(/\.zip$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1) : "Topo sem nome";
}

const abrirBytes = (b: Uint8Array) => new Promise<Unzipped>((ok, falhou) => unzip(b, (erro, dados) => (erro ? falhou(erro) : ok(dados))));
const abrirZip = async (f: Blob) => abrirBytes(new Uint8Array(await f.arrayBuffer()));
const paraFile = (caminho: string, d: Uint8Array) => { const nome = caminho.split("/").pop() || caminho; return new File([d as Uint8Array<ArrayBuffer>], nome, { type: TIPOS[ext(nome)] || "application/octet-stream" }); };
const arquivosDe = (dentro: Unzipped) => Object.entries(dentro).filter(([c, d]) => d.length > 0 && !lixo(c)).map(([c, d]) => paraFile(c, d));

async function emBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** um .zip escolhido vira 1 ou vários topos */
async function topoDoZip(z: File): Promise<Omit<Item, "estado">[]> {
  let dentro: Unzipped;
  try { dentro = await abrirZip(z); } catch { return [{ chave: z.name, nome: nomeDoZip(z.name), abrir: async () => { throw new Error("Não deu para abrir o .zip"); } }]; }
  const validos = Object.entries(dentro).filter(([c, d]) => d.length > 0 && !lixo(c));
  // .zip com os .zip de cada topo dentro
  const internos = validos.filter(([c]) => /\.zip$/i.test(c));
  if (internos.length) return internos.map(([c, d]) => { const n = c.split("/").pop() || c; return { chave: `${z.name}/${c}`, nome: nomeDoZip(n), abrir: async () => arquivosDe(await abrirBytes(d)) }; });
  // .zip com uma pasta por topo: mais de uma pasta com arquivos dentro (uma pasta só por fora, tipo "Lote/", é ignorada)
  const partes = validos.map(([c, d]) => ({ p: c.split("/"), d, c }));
  const tiraComum = (ps: string[][]): string[][] => { if (ps.length && ps.every(p => p.length > 2 && p[0] === ps[0][0])) return tiraComum(ps.map(p => p.slice(1))); return ps; };
  const caminhos = tiraComum(partes.map(x => x.p));
  const pastas = new Map<string, File[]>();
  let soltos = 0;
  caminhos.forEach((p, i) => { if (p.length > 1) { const f = pastas.get(p[0]) || []; f.push(paraFile(partes[i].c, partes[i].d)); pastas.set(p[0], f); } else soltos++; });
  if (pastas.size > 1 && soltos === 0) return [...pastas.entries()].map(([pasta, fs]) => ({ chave: `${z.name}/${pasta}`, nome: nomeDoZip(pasta), abrir: async () => fs }));
  // .zip de um topo só
  return [{ chave: z.name, nome: nomeDoZip(z.name), abrir: async () => validos.map(([c, d]) => paraFile(c, d)) }];
}

type Props = {
  aberta: boolean;
  aoFechar: () => void;
  cats: CategoriaTopo[];
  topos: Topo[];
  categoriaInicial: string;
  subirCapa: (f: Blob, pasta: string) => Promise<{ url: string; mini: string | null } | null>;
  aoTerminar: () => void;
};

export default function ImportarTopos({ aberta, aoFechar, cats: catsIniciais, topos, categoriaInicial, subirCapa, aoTerminar }: Props) {
  const [cats, setCats] = useState(catsIniciais);
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [novaCat, setNovaCat] = useState<string | null>(null);
  const [criandoCat, setCriandoCat] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);
  const [comTags, setComTags] = useState(true);
  const [escondido, setEscondido] = useState(false);
  const [repetido, setRepetido] = useState<"pular" | "substituir">("pular");
  const [rodando, setRodando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [terminou, setTerminou] = useState(false);
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 });
  const parar = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mudouAlgo = useRef(false);

  const mudar = (chave: string, e: Estado, detalhe?: string) => setItens(l => l.map(x => (x.chave === chave ? { ...x, estado: e, detalhe } : x)));

  const escolher = async (fs: FileList | File[] | null) => {
    const escolhidos = [...(fs || [])].filter(f => /\.zip$/i.test(f.name));
    if (!escolhidos.length) { avisar("Escolha arquivos .zip.", { tipo: "erro" }); return; }
    setTerminou(false);
    setLendo(true);
    const novos: Item[] = [];
    for (const z of escolhidos) (await topoDoZip(z)).forEach(t => novos.push({ ...t, estado: "fila" }));
    setLendo(false);
    // o que deu erro ou foi parado pode ser escolhido de novo; o resto não repete
    setItens(l => [...l.filter(x => x.estado !== "pronto" && !(["erro", "parado"].includes(x.estado) && novos.some(n => n.chave === x.chave))), ...novos.filter(n => !l.some(x => x.chave === n.chave && !["erro", "parado"].includes(x.estado)))]);
  };

  const criarCategoria = async () => {
    const nome = (novaCat || "").trim();
    if (!nome) return;
    const ja = cats.find(c => igual(c.nome, nome));
    if (ja) { setCategoria(ja.id); setNovaCat(null); return; }
    setCriandoCat(true);
    const r = await supabase.from("topos_categorias").insert({ nome, ordem: cats.length + 1 }).select("id, nome, imagem_url, imagem_mini_url, ordem, ativo").single();
    setCriandoCat(false);
    if (r.error || !r.data) { avisar("Não deu para criar a categoria.", { tipo: "erro" }); return; }
    setCats(l => [...l, r.data as CategoriaTopo]);
    setCategoria((r.data as CategoriaTopo).id);
    setNovaCat(null);
    mudouAlgo.current = true;
    void registrar(`criou a categoria de topos "${nome}"`, { tipo: "topos" });
  };

  const gerarTags = async (capa: File, nome: string, nomeCat: string): Promise<string[]> => {
    try {
      const pequena = await paraWebp(capa, 512, 0.8).catch(() => capa);
      const r = await apiFetch("/api/tags-topo", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ nome, categoria: nomeCat, imagem: await emBase64(pequena), tipo: pequena.type || "image/webp" }),
      });
      const j = await r.json().catch(() => null);
      return Array.isArray(j?.tags) ? (j.tags as unknown[]).map(String).slice(0, 30) : [];
    } catch { return []; /* sem tags: o topo entra mesmo assim, dá para pôr depois */ }
  };

  const importar = async () => {
    if (!categoria) { avisar("Escolha a categoria.", { tipo: "erro" }); return; }
    const fila = itens.filter(x => x.estado === "fila");
    parar.current = false;
    setRodando(true);
    setProgresso({ feito: 0, total: fila.length });
    const nomeCat = cats.find(c => c.id === categoria)?.nome || "";
    let ordem = topos.reduce((m, t) => Math.max(m, t.ordem), 0);
    let novos = 0, trocados = 0;
    const nomesDoLote = new Set<string>();
    for (const [n, it] of fila.entries()) {
      if (parar.current) { fila.slice(n).forEach(x => mudar(x.chave, "parado", "Você parou antes deste")); break; }
      const existente = topos.find(t => t.categoria_id === categoria && igual(t.titulo, it.nome));
      const repetidoNoLote = nomesDoLote.has(it.nome.toLowerCase());
      if ((existente && repetido === "pular") || repetidoNoLote) {
        mudar(it.chave, "existe", repetidoNoLote ? "Outro topo deste lote já tem esse nome" : "Já existe com esse nome nesta categoria");
        setProgresso(p => ({ ...p, feito: p.feito + 1 }));
        continue;
      }
      nomesDoLote.add(it.nome.toLowerCase());
      try {
        mudar(it.chave, "lendo");
        const arquivos = await it.abrir();
        const capa = arquivos.find(f => ext(f.name) === "webp") || arquivos.find(f => ["png", "jpg", "jpeg"].includes(ext(f.name)));
        const baixaveis = arquivos.filter(f => ext(f.name) !== "webp");
        if (!capa) throw new Error("Sem imagem de capa (.webp)");
        if (!baixaveis.length) throw new Error("Sem arquivo para baixar (.png ou .pdf)");

        mudar(it.chave, "enviando", `${baixaveis.length} ${baixaveis.length === 1 ? "arquivo" : "arquivos"}`);
        const id = existente?.id || crypto.randomUUID();
        const enviados: ArquivoTopo[] = [];
        for (const f of baixaveis) {
          const caminho = `${id}/${sufixo()}-${nomeSeguro(f.name)}`;
          const up = await supabase.storage.from(BUCKET_ARQUIVOS).upload(caminho, f, { upsert: false, contentType: f.type });
          if (up.error) {
            if (enviados.length) void supabase.storage.from(BUCKET_ARQUIVOS).remove(enviados.map(a => a.caminho));
            throw new Error(`Não deu para enviar ${f.name}${f.size > 50 * 1024 * 1024 ? " (passa de 50 MB)" : ""}`);
          }
          enviados.push({ caminho, nome: f.name, formato: formatoDe(f.name), tamanho: f.size });
        }
        const c2 = await subirCapa(capa, id);
        if (!c2) { void supabase.storage.from(BUCKET_ARQUIVOS).remove(enviados.map(a => a.caminho)); throw new Error("Não deu para enviar a capa"); }

        let tags: string[] = existente?.tags || [];
        if (comTags) { mudar(it.chave, "tags"); const t = await gerarTags(capa, it.nome, nomeCat); if (t.length) tags = t; }

        const dados = { titulo: it.nome, categoria_id: categoria, capa_url: c2.url, capa_mini_url: c2.mini, arquivos: enviados, tags, ...(escondido ? { ativo: false } : {}) };
        if (existente) {
          // substituir: troca capa, arquivos e tags; os arquivos antigos saem do armazenamento depois que o novo salvou
          const { error } = await supabase.from("topos").update(dados).eq("id", existente.id);
          if (error) { void supabase.storage.from(BUCKET_ARQUIVOS).remove(enviados.map(a => a.caminho)); throw new Error("Não deu para salvar o topo"); }
          if (existente.arquivos.length) void supabase.storage.from(BUCKET_ARQUIVOS).remove(existente.arquivos.map(a => a.caminho));
          trocados++;
          mudar(it.chave, "pronto", `Substituído · ${enviados.length} ${enviados.length === 1 ? "arquivo" : "arquivos"} · ${tags.length ? `${tags.length} tags` : "sem tags"}`);
        } else {
          ordem += 1; // ordem maior aparece primeiro: os importados entram no começo da lista
          const { error } = await supabase.from("topos").insert({ id, ...dados, ordem, ativo: !escondido });
          if (error) { void supabase.storage.from(BUCKET_ARQUIVOS).remove(enviados.map(a => a.caminho)); throw new Error("Não deu para salvar o topo"); }
          novos++;
          mudar(it.chave, "pronto", `${enviados.length} ${enviados.length === 1 ? "arquivo" : "arquivos"} · ${tags.length ? `${tags.length} tags` : "sem tags"}${escondido ? " · escondido" : ""}`);
        }
      } catch (e) {
        mudar(it.chave, "erro", e instanceof Error && e.message ? e.message : "Não deu para ler o .zip");
      }
      setProgresso(p => ({ ...p, feito: p.feito + 1 }));
    }
    setRodando(false);
    setTerminou(true);
    if (novos || trocados) {
      const partes = [novos ? `importou ${novos} ${novos === 1 ? "topo" : "topos"}` : "", trocados ? `substituiu ${trocados}` : ""].filter(Boolean).join(" e ");
      void registrar(`${partes} de bolo em "${nomeCat}"${escondido ? " (escondidos)" : ""}`, { tipo: "topos" });
      mudouAlgo.current = true;
    }
    if (mudouAlgo.current) aoTerminar();
  };

  const fechar = () => { if (rodando) return; if (mudouAlgo.current) aoTerminar(); setItens([]); setTerminou(false); aoFechar(); };
  const pendentes = itens.filter(x => x.estado === "fila").length;
  const prontos = itens.filter(x => x.estado === "pronto").length;
  const TXT: Record<Estado, string> = { fila: "Na fila", lendo: "Abrindo…", enviando: "Enviando", tags: "Gerando as tags…", pronto: "Pronto", erro: "Não entrou", existe: "Pulado", parado: "Parado" };

  return (
    <Janela aberta={aberta} aoFechar={fechar} tipo="conteudo" titulo="Importar topos" className="atp-janela"
      acoes={rodando
        ? <><Botao variante="secundario" onClick={() => { parar.current = true; }}>Parar</Botao><Botao carregando>{`Importando ${Math.min(progresso.feito + 1, progresso.total)} de ${progresso.total}`}</Botao></>
        : terminou && !pendentes
          ? <Botao onClick={fechar}>Concluir</Botao>
          : <><Botao variante="secundario" onClick={fechar}>Cancelar</Botao>
            <Botao onClick={importar} disabled={!pendentes || lendo}>{pendentes ? `Importar ${pendentes} ${pendentes === 1 ? "topo" : "topos"}` : "Importar"}</Botao></>}>
      <div className="atp-imp">
        <p className="atp-imp-ap">Em cada topo, o <b>.webp</b> vira a capa e os <b>.png</b> e o <b>.pdf</b> ficam para baixar. Pode mandar um .zip por topo, um .zip com os .zip de cada topo dentro, ou um .zip com uma pasta para cada topo.</p>

        <div className="ui-campo">
          <span className="ui-campo-r"><span>Categoria do lote</span></span>
          {novaCat === null ? (
            <select className="atp-imp-sel" value={categoria} disabled={rodando} aria-label="Categoria do lote"
              onChange={e => { if (e.target.value === "__nova") setNovaCat(""); else setCategoria(e.target.value); }}>
              <option value="">Escolha…</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value="__nova">+ Nova categoria…</option>
            </select>
          ) : (
            <div className="atp-imp-nova">
              <input className="atp-imp-sel" autoFocus value={novaCat} maxLength={40} placeholder="Ex.: Halloween" aria-label="Nome da nova categoria"
                onChange={e => setNovaCat(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void criarCategoria(); if (e.key === "Escape") setNovaCat(null); }} />
              <Botao variante="secundario" onClick={() => setNovaCat(null)} disabled={criandoCat}>Voltar</Botao>
              <Botao icone={<Plus size={16} weight="bold" />} onClick={criarCategoria} carregando={criandoCat} disabled={!novaCat.trim()}>Criar</Botao>
            </div>
          )}
        </div>

        <div className="ui-campo">
          <span className="ui-campo-r" id="atp-imp-rep"><span>Se o nome já existir nesta categoria</span></span>
          <CaixasEscolha<"pular" | "substituir"> rotuloId="atp-imp-rep" valor={repetido} onMudar={v => { if (!rodando) setRepetido(v); }} opcoes={[
            { v: "pular", t: "Pular", sub: "O topo que já existe fica como está" },
            { v: "substituir", t: "Substituir os arquivos", sub: "Troca a capa, os arquivos e as tags pelos novos" },
          ]} />
        </div>

        <div className="atp-imp-checks">
          <label className="atp-imp-ia"><input type="checkbox" checked={comTags} onChange={e => setComTags(e.target.checked)} disabled={rodando} /><span>Gerar as tags com IA<small>Pela capa e pelo nome · cerca de R$ 0,01 por topo</small></span></label>
          <label className="atp-imp-ia"><input type="checkbox" checked={escondido} onChange={e => setEscondido(e.target.checked)} disabled={rodando} /><span>Deixar escondidos para eu conferir<small>Entram desmarcados em “Visível”; você libera depois</small></span></label>
        </div>

        <button type="button" className="atp-imp-drop" onClick={() => inputRef.current?.click()} disabled={rodando || lendo}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!rodando) void escolher(e.dataTransfer.files); }}>
          <UploadSimple size={24} weight="bold" aria-hidden="true" />
          <b>{lendo ? "Abrindo os .zip…" : "Escolher os .zip"}</b>
          <small>ou arraste para cá · vários de uma vez ou um .zip com todos</small>
        </button>
        <input ref={inputRef} type="file" accept=".zip,application/zip" multiple hidden onChange={e => { const fs = e.target.files ? [...e.target.files] : null; e.target.value = ""; void escolher(fs); }} />

        {itens.length > 0 && (
          <>
            <p className="atp-imp-resumo">{itens.length} {itens.length === 1 ? "topo" : "topos"}{prontos ? ` · ${prontos} ${prontos === 1 ? "pronto" : "prontos"}` : ""}{rodando ? ` · importando ${Math.min(progresso.feito + 1, progresso.total)} de ${progresso.total}` : ""}</p>
            <ul className="atp-imp-lista" aria-live="polite">
              {itens.map(x => (
                <li key={x.chave} className={`atp-imp-it atp-imp-it--${x.estado}`}>
                  <span className="atp-imp-ic" aria-hidden="true">{x.estado === "pronto" ? <CheckCircle size={20} weight="fill" /> : ["erro", "existe", "parado"].includes(x.estado) ? <WarningCircle size={20} weight="fill" /> : <FileZip size={20} />}</span>
                  <span className="atp-imp-tx"><b>{x.nome}</b><small>{TXT[x.estado]}{x.detalhe ? ` · ${x.detalhe}` : ""}</small></span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Janela>
  );
}
