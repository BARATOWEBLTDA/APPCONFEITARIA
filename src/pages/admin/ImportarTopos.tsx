import { useRef, useState } from "react";
import { unzip, type Unzipped } from "fflate";
import { CheckCircle, FileZip, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { Botao, Janela, avisar } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { registrar } from "@/lib/adminPerfil";
import { paraWebp } from "@/lib/imagemLeve";
import { BUCKET_ARQUIVOS, formatoDe, nomeSeguro, type ArquivoTopo, type CategoriaTopo, type Topo } from "@/lib/toposBolo";

/**
 * (10/11) Admin · Topos de bolo: importar vários topos de uma vez, um .zip por topo.
 * Dentro do .zip: o .webp é a capa; os .png e o .pdf são os arquivos que a PRO baixa.
 * O nome do topo é o nome do .zip; a categoria é escolhida uma vez para o lote; as tags a IA gera
 * pela capa e pelo nome (antes era tudo à mão, com as tags vindas do ChatGPT).
 */

type Estado = "fila" | "lendo" | "enviando" | "tags" | "pronto" | "erro" | "existe";
type Item = { zip: File; nome: string; estado: Estado; detalhe?: string };

const TIPOS: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", pdf: "application/pdf", webp: "image/webp" };
const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();
const sufixo = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** "festa_homem-aranha.zip" → "Festa homem aranha" */
export function nomeDoZip(arquivo: string): string {
  const t = arquivo.replace(/\.zip$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1) : "Topo sem nome";
}

const abrirZip = (f: File) => new Promise<Unzipped>((ok, falhou) => {
  f.arrayBuffer().then(b => unzip(new Uint8Array(b), (erro, dados) => (erro ? falhou(erro) : ok(dados))), falhou);
});

async function emBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
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

export default function ImportarTopos({ aberta, aoFechar, cats, topos, categoriaInicial, subirCapa, aoTerminar }: Props) {
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [itens, setItens] = useState<Item[]>([]);
  const [comTags, setComTags] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [terminou, setTerminou] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mudar = (i: number, e: Estado, detalhe?: string) => setItens(l => l.map((x, k) => (k === i ? { ...x, estado: e, detalhe } : x)));
  const escolher = async (fs: FileList | null) => {
    const escolhidos = [...(fs || [])].filter(f => /\.zip$/i.test(f.name));
    if (!escolhidos.length) { avisar("Escolha arquivos .zip.", { tipo: "erro" }); return; }
    // (11/11) um .zip "pacote" com um .zip de cada topo dentro: cada .zip de dentro vira um topo
    const zips: File[] = [];
    for (const z of escolhidos) {
      try {
        const dentro = await abrirZip(z);
        const internos = Object.entries(dentro).filter(([c, d]) => d.length > 0 && /\.zip$/i.test(c) && !/(^|\/)(__MACOSX|\.)/.test(c));
        if (internos.length) internos.forEach(([c, d]) => zips.push(new File([d as Uint8Array<ArrayBuffer>], c.split("/").pop() || c, { type: "application/zip" })));
        else zips.push(z);
      } catch { zips.push(z); /* o erro aparece na hora de importar */ }
    }
    setTerminou(false);
    // o .zip que deu erro pode ser escolhido de novo (corrigido)
    setItens(l => [...l.filter(x => x.estado !== "pronto" && !(x.estado === "erro" && zips.some(z => z.name === x.zip.name))), ...zips.filter(z => !l.some(x => x.zip.name === z.name && x.estado !== "erro")).map(z => ({ zip: z, nome: nomeDoZip(z.name), estado: "fila" as Estado }))]);
  };

  const importar = async () => {
    if (!categoria) { avisar("Escolha a categoria.", { tipo: "erro" }); return; }
    setRodando(true);
    const nomeCat = cats.find(c => c.id === categoria)?.nome || "";
    let ordem = topos.reduce((m, t) => Math.max(m, t.ordem), 0);
    let feitos = 0;
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      if (it.estado !== "fila") continue;
      // o mesmo nome já existe nesta categoria: não duplica
      if (topos.some(t => t.categoria_id === categoria && t.titulo.trim().toLowerCase() === it.nome.toLowerCase())) { mudar(i, "existe", "Já existe um topo com esse nome nesta categoria"); continue; }
      try {
        mudar(i, "lendo");
        const dentro = await abrirZip(it.zip);
        const arquivos = Object.entries(dentro)
          .filter(([caminho, d]) => d.length > 0 && !/(^|\/)(__MACOSX|\.)/.test(caminho) && !caminho.endsWith("/"))
          .map(([caminho, d]) => { const nome = caminho.split("/").pop() || caminho; return new File([d as Uint8Array<ArrayBuffer>], nome, { type: TIPOS[ext(nome)] || "application/octet-stream" }); });
        const capa = arquivos.find(f => ext(f.name) === "webp") || arquivos.find(f => ["png", "jpg", "jpeg"].includes(ext(f.name)));
        const baixaveis = arquivos.filter(f => ext(f.name) !== "webp");
        if (!capa) { mudar(i, "erro", "Sem imagem de capa (.webp) no .zip"); continue; }
        if (!baixaveis.length) { mudar(i, "erro", "Sem arquivo para baixar (.png ou .pdf) no .zip"); continue; }

        mudar(i, "enviando", `${baixaveis.length} ${baixaveis.length === 1 ? "arquivo" : "arquivos"}`);
        const id = crypto.randomUUID();
        const enviados: ArquivoTopo[] = [];
        for (const f of baixaveis) {
          const caminho = `${id}/${sufixo()}-${nomeSeguro(f.name)}`;
          const up = await supabase.storage.from(BUCKET_ARQUIVOS).upload(caminho, f, { upsert: false, contentType: f.type });
          if (up.error) throw new Error(`Não deu para enviar ${f.name}${f.size > 50 * 1024 * 1024 ? " (passa de 50 MB)" : ""}`);
          enviados.push({ caminho, nome: f.name, formato: formatoDe(f.name), tamanho: f.size });
        }
        const c2 = await subirCapa(capa, id);
        if (!c2) throw new Error("Não deu para enviar a capa");

        let tags: string[] = [];
        if (comTags) {
          mudar(i, "tags");
          try {
            const pequena = await paraWebp(capa, 512, 0.8).catch(() => capa);
            const r = await apiFetch("/api/tags-topo", {
              method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000),
              body: JSON.stringify({ nome: it.nome, categoria: nomeCat, imagem: await emBase64(pequena), tipo: pequena.type || "image/webp" }),
            });
            const j = await r.json().catch(() => null);
            if (Array.isArray(j?.tags)) tags = (j.tags as unknown[]).map(String).slice(0, 30);
          } catch { /* sem tags: o topo entra mesmo assim, dá para pôr depois */ }
        }

        ordem += 1;
        const { error } = await supabase.from("topos").insert({ id, titulo: it.nome, categoria_id: categoria, capa_url: c2.url, capa_mini_url: c2.mini, arquivos: enviados, tags, ordem });
        if (error) { void supabase.storage.from(BUCKET_ARQUIVOS).remove(enviados.map(a => a.caminho)); throw new Error("Não deu para salvar o topo"); }
        feitos++;
        mudar(i, "pronto", `${enviados.length} ${enviados.length === 1 ? "arquivo" : "arquivos"} · ${tags.length ? `${tags.length} tags` : "sem tags"}`);
      } catch (e) {
        mudar(i, "erro", e instanceof Error && e.message ? e.message : "Não deu para ler o .zip");
      }
    }
    setRodando(false);
    setTerminou(true);
    if (feitos) {
      void registrar(`importou ${feitos} ${feitos === 1 ? "topo" : "topos"} de bolo em "${nomeCat}"`, { tipo: "topos" });
      aoTerminar();
    }
  };

  const fechar = () => { if (rodando) return; setItens([]); setTerminou(false); aoFechar(); };
  const pendentes = itens.filter(x => x.estado === "fila").length;
  const TXT: Record<Estado, string> = { fila: "Na fila", lendo: "Abrindo o .zip…", enviando: "Enviando", tags: "Gerando as tags…", pronto: "Pronto", erro: "Não entrou", existe: "Pulado" };

  return (
    <Janela aberta={aberta} aoFechar={fechar} tipo="conteudo" titulo="Importar topos" className="atp-janela"
      acoes={terminou && !pendentes
        ? <Botao onClick={fechar}>Concluir</Botao>
        : <><Botao variante="secundario" onClick={fechar} disabled={rodando}>Cancelar</Botao>
          <Botao onClick={importar} carregando={rodando} disabled={!itens.length || !pendentes}>{pendentes ? `Importar ${pendentes} ${pendentes === 1 ? "topo" : "topos"}` : "Importar"}</Botao></>}>
      <div className="atp-imp">
        <p className="atp-imp-ap">Um .zip por topo (ou um .zip com os .zip de cada topo dentro). Em cada topo: o <b>.webp</b> vira a capa e os <b>.png</b> e o <b>.pdf</b> ficam para baixar. O nome do topo é o nome do .zip.</p>
        <label className="ui-campo">
          <span className="ui-campo-r"><span>Categoria do lote</span></span>
          <select className="atp-imp-sel" value={categoria} onChange={e => setCategoria(e.target.value)} disabled={rodando}>
            <option value="">Escolha…</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="atp-imp-ia"><input type="checkbox" checked={comTags} onChange={e => setComTags(e.target.checked)} disabled={rodando} /><span>Gerar as tags com IA<small>Pela capa e pelo nome · cerca de R$ 0,01 por topo</small></span></label>
        <button type="button" className="atp-imp-drop" onClick={() => inputRef.current?.click()} disabled={rodando}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!rodando) void escolher(e.dataTransfer.files); }}>
          <UploadSimple size={24} weight="bold" aria-hidden="true" />
          <b>Escolher os .zip</b>
          <small>ou arraste para cá · vários de uma vez ou um .zip com todos</small>
        </button>
        <input ref={inputRef} type="file" accept=".zip,application/zip" multiple hidden onChange={e => { const fs = e.target.files; void escolher(fs).then(() => { e.target.value = ""; }); }} />
        {itens.length > 0 && (
          <ul className="atp-imp-lista" aria-live="polite">
            {itens.map((x, k) => (
              <li key={x.zip.name + k} className={`atp-imp-it atp-imp-it--${x.estado}`}>
                <span className="atp-imp-ic" aria-hidden="true">{x.estado === "pronto" ? <CheckCircle size={20} weight="fill" /> : x.estado === "erro" || x.estado === "existe" ? <WarningCircle size={20} weight="fill" /> : <FileZip size={20} />}</span>
                <span className="atp-imp-tx"><b>{x.nome}</b><small>{TXT[x.estado]}{x.detalhe ? ` · ${x.detalhe}` : ""}</small></span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Janela>
  );
}
