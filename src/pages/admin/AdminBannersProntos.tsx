import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowDown, ArrowUp, Crown, Images, Trash, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { Botao, BotaoIcone, Campo, Titulo, avisar, confirmar } from "@/components/base";
import { CATEGORIAS_BANNER, TAMANHO_BANNER, type BannerPronto } from "@/lib/bannersProntos";
import "./admin-banners-prontos.css";

/**
 * (17/10) Admin · Banners prontos: a galeria que as confeiteiras usam no cardápio (Aparência > Banners de promoção).
 * Envia a imagem pro bucket admin-banners e grava em banners_prontos. Título, categoria, ativo, só PRO e ordem salvam sozinhos.
 */
export default function AdminBannersProntos() {
  const [lista, setLista] = useState<BannerPronto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semTabela, setSemTabela] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    const { data, error } = await supabase.from("banners_prontos").select("*").order("ordem").order("created_at");
    if (error) { setSemTabela(true); setCarregando(false); return; }
    setSemTabela(false);
    setLista((data as BannerPronto[]) || []);
    setCarregando(false);
  };
  useEffect(() => { void carregar(); }, []);

  const salvar = async (id: string, patch: Partial<BannerPronto>) => {
    setLista(l => l.map(b => (b.id === id ? { ...b, ...patch } : b)));
    const { error } = await supabase.from("banners_prontos").update(patch).eq("id", id);
    if (error) { avisar("Não deu pra salvar. Tente de novo.", { tipo: "erro" }); void carregar(); }
  };

  const enviar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = "";
    if (!arquivos.length) return;
    setEnviando(true);
    let ordem = lista.reduce((m, b) => Math.max(m, b.ordem), 0);
    let falhas = 0;
    for (const f of arquivos) {
      if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) { falhas++; continue; }
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const caminho = `galeria/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const up = await supabase.storage.from("admin-banners").upload(caminho, f, { cacheControl: "31536000", upsert: false, contentType: f.type });
      if (up.error) { falhas++; continue; }
      const url = supabase.storage.from("admin-banners").getPublicUrl(caminho).data.publicUrl;
      const titulo = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 60);
      const { error } = await supabase.from("banners_prontos").insert({ titulo, categoria: "Bolos", imagem_url: url, ordem: ++ordem });
      if (error) falhas++;
    }
    setEnviando(false);
    if (falhas) avisar(`${falhas} ${falhas === 1 ? "imagem não foi enviada" : "imagens não foram enviadas"} (só imagens de até 5 MB).`, { tipo: "erro" });
    else avisar(arquivos.length === 1 ? "Banner adicionado" : "Banners adicionados", { tipo: "ok" });
    void carregar();
  };

  const mover = async (i: number, dir: -1 | 1) => {
    const a = lista[i], b = lista[i + dir];
    if (!a || !b) return;
    const nova = [...lista]; nova[i] = { ...b, ordem: a.ordem }; nova[i + dir] = { ...a, ordem: b.ordem };
    // ordens iguais (banners antigos): renumera a lista inteira
    const final = a.ordem === b.ordem ? nova.map((x, k) => ({ ...x, ordem: k + 1 })) : nova;
    setLista(final);
    const mudou = final.filter(x => lista.find(y => y.id === x.id)?.ordem !== x.ordem);
    const r = await Promise.all(mudou.map(x => supabase.from("banners_prontos").update({ ordem: x.ordem }).eq("id", x.id)));
    if (r.some(x => x.error)) { avisar("Não deu pra mudar a ordem. Tente de novo.", { tipo: "erro" }); void carregar(); }
  };

  const excluir = async (b: BannerPronto) => {
    const ok = await confirmar({ titulo: "Excluir este banner?", texto: "Ele sai da galeria. Quem já está usando continua com ele no cardápio.", rotulo: "Excluir", perigo: true });
    if (!ok) return;
    const { error } = await supabase.from("banners_prontos").delete().eq("id", b.id);
    if (error) { avisar("Não deu pra excluir. Tente de novo.", { tipo: "erro" }); return; }
    setLista(l => l.filter(x => x.id !== b.id));
  };

  if (carregando) return <div className="abp-carregando"><span className="ui-gira" aria-label="Carregando" /></div>;

  return (
    <div className="abp-root">
      <Titulo nivel="tela" apoio={`A galeria que as confeiteiras escolhem em Aparência. Tamanho: ${TAMANHO_BANNER}, deitado, mesmo tamanho pra todos.`}>Banners prontos</Titulo>

      {semTabela ? (
        <p className="abp-aviso"><WarningCircle size={18} weight="bold" aria-hidden="true" /><span>A tabela de banners ainda não existe. Rode o SQL banners_prontos.sql no Supabase.</span></p>
      ) : (
        <>
          <div className="abp-topo">
            <input ref={arquivoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={enviar} />
            <Botao icone={<UploadSimple size={20} weight="bold" />} onClick={() => arquivoRef.current?.click()} carregando={enviando}>Adicionar banners</Botao>
            <span className="abp-conta">{lista.length} {lista.length === 1 ? "banner" : "banners"} · {lista.filter(b => b.ativo).length} na galeria</span>
          </div>

          {lista.length === 0 ? (
            <div className="abp-vazio"><Images size={28} aria-hidden="true" /><b>Nenhum banner ainda</b><span>Envie as imagens; você pode mandar várias de uma vez.</span></div>
          ) : (
            <div className="abp-grade">
              {lista.map((b, i) => (
                <article key={b.id} className={`abp-card${b.ativo ? "" : " off"}`}>
                  <div className="abp-img"><img src={b.imagem_url} alt={b.titulo} loading="lazy" />{b.so_pro && <span className="abp-pro"><Crown size={13} weight="fill" aria-hidden="true" />PRO</span>}</div>
                  <Campo rotulo="Título" value={b.titulo} maxLength={60}
                    onChange={e => setLista(l => l.map(x => (x.id === b.id ? { ...x, titulo: e.target.value } : x)))}
                    onBlur={e => salvar(b.id, { titulo: e.target.value.trim() })} />
                  <div className="abp-cats" role="radiogroup" aria-label="Categoria">
                    {CATEGORIAS_BANNER.map(c => (
                      <button key={c} type="button" role="radio" aria-checked={b.categoria === c} className={b.categoria === c ? "on" : ""} onClick={() => salvar(b.id, { categoria: c })}>{c}</button>
                    ))}
                  </div>
                  <div className="abp-opcoes">
                    <label><input type="checkbox" checked={b.ativo} onChange={e => salvar(b.id, { ativo: e.target.checked })} />Na galeria</label>
                    <label><input type="checkbox" checked={b.so_pro} onChange={e => salvar(b.id, { so_pro: e.target.checked })} />Só PRO</label>
                    <span className="abp-acoes">
                      <BotaoIcone rotulo="Subir" variante="limpo" tamanho="p" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp size={18} weight="bold" /></BotaoIcone>
                      <BotaoIcone rotulo="Descer" variante="limpo" tamanho="p" disabled={i === lista.length - 1} onClick={() => mover(i, 1)}><ArrowDown size={18} weight="bold" /></BotaoIcone>
                      <BotaoIcone rotulo="Excluir" variante="limpo" tamanho="p" onClick={() => excluir(b)}><Trash size={18} weight="bold" /></BotaoIcone>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
