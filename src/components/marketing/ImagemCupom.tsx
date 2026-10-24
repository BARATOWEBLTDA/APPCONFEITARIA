import { useEffect, useState } from "react";
import { DownloadSimple, ShareNetwork } from "@phosphor-icons/react";
import { Botao, Janela, avisar } from "@/components/base";
import { gerarImagemCupom, type DadosImagemCupom } from "@/lib/imagemCupom";
import "./imagemCupom.css";

/**
 * (23/10) Janela "Imagem do cupom" (Marketing › Cupons): mostra a imagem pronta (a mesma que vai ser enviada),
 * "Baixar" salva o PNG e "Compartilhar" abre o compartilhar do celular (status do WhatsApp, Instagram).
 * Onde não dá para compartilhar arquivo (computador), baixa a imagem.
 */
export default function ImagemCupom({ dados, aoFechar }: { dados: DadosImagemCupom | null; aoFechar: () => void }) {
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null);
  const [erro, setErro] = useState(false);
  const chave = dados ? JSON.stringify(dados) : "";

  useEffect(() => {
    if (!dados) return;
    let vivo = true, url = "";
    setImg(null); setErro(false);
    gerarImagemCupom(dados).then(blob => {
      if (!vivo) return;
      url = URL.createObjectURL(blob);
      setImg({ blob, url });
    }, () => { if (vivo) setErro(true); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  const nomeArquivo = `cupom-${(dados?.codigo || "doonly").toLowerCase()}.png`;
  const baixar = () => {
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.url; a.download = nomeArquivo;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const compartilhar = async () => {
    if (!img || !dados) return;
    const arquivo = new File([img.blob], nomeArquivo, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [arquivo] })) {
      try { await nav.share({ files: [arquivo], text: `Use o cupom ${dados.codigo} no nosso cardápio:\n${dados.link}` }); return; }
      catch (e: any) { if (e?.name === "AbortError") return; } // ela fechou a janela
    }
    baixar();
    avisar("A imagem foi baixada. É só postar onde quiser.", { tipo: "ok" });
  };

  return (
    <Janela aberta={!!dados} aoFechar={aoFechar} tipo="conteudo" titulo="Imagem do cupom"
      acoes={<>
        <Botao variante="secundario" icone={<DownloadSimple size={20} weight="bold" />} onClick={baixar} disabled={!img}>Baixar</Botao>
        <Botao icone={<ShareNetwork size={20} weight="bold" />} onClick={compartilhar} disabled={!img}>Compartilhar</Botao>
      </>}>
      <div className="icp">
        <p className="icp-sub">Para postar no status do WhatsApp e no Instagram</p>
        <div className="icp-img">
          {img ? <img src={img.url} alt={`Imagem do cupom ${dados?.codigo || ""}`} />
            : erro ? <span className="icp-erro">Não deu para montar a imagem. Feche e tente de novo.</span>
            : <span className="ui-gira" aria-label="Montando a imagem" />}
        </div>
      </div>
    </Janela>
  );
}
