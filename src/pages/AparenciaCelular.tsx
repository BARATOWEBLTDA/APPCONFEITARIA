/**
 * (20/11) Aparência nova, só no celular: a tela É o cardápio. O topo de verdade (foto, logo, nome, situação e descrição)
 * dentro de um celular claro, com o link em cima como barra de navegador. Cada coisa se edita onde ela aparece
 * (câmera na foto, na logo e no banner; lápis na descrição e no link). As cores ficam presas embaixo, em três abas.
 * Os dados e as gravações são os mesmos da Aparência de sempre (CardapioDesign): aqui é só o desenho.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HexColorPicker } from "react-colorful";
import { ArrowCounterClockwise, BatteryFull, Camera, CaretRight, CellSignalFull, Check, Crown, Images, LockSimple, PencilSimple, Plus, Question, Sparkle, WifiHigh, X } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, BotaoIcone, CampoArea, Janela } from "@/components/base";
import { abrirConvitePro } from "@/components/billing/RecursoPro";
import { getStatusLoja } from "@/components/cardapio/CardapioModelo1";
import { SeloVerificado } from "@/components/cardapio/SeloVerificado";
import NomeNoLink from "@/components/loja/NomeNoLink";
import Destaque, { jaViuDestaque, marcarDestaque } from "@/components/Destaque";
import { useProfile } from "@/hooks/useProfile";
import { COR_BOTOES, PADRAO, PRONTAS, PRONTAS_PRO, topoEscurecido, type CampoCor } from "@/lib/coresCardapio";
import "@/components/cardapio/cardapioModelo1.css";
import "@/components/cardapio/itensCardapio.css";
import "./aparencia.css";
import "./aparenciaNova.css";

export type CorDaTela = { campo: CampoCor; valor: string; mudar: (cor: string) => void };

type Props = {
  voltar: () => void;
  isPro: boolean;
  /** cores e modelo Premium: PRO ou liberado avulso */
  premium: boolean;
  nomeLoja: string;
  logo: string;
  fotoTopo: string;
  banner: string;
  horario: unknown;
  descricao: string;
  salvarDescricao: (texto: string) => Promise<boolean>;
  enviando: string | null;
  cores: CorDaTela[];
  escolherLogo: () => void;
  escolherTopo: () => void;
  tirarTopo: () => void;
  escolherBanner: () => void;
  tirarBanner: () => void;
  abrirGaleria: () => void;
  /** recortes de imagem e a galeria de banners prontos (as janelas da Aparência de sempre) */
  janelas: ReactNode;
};

const ABAS: { campo: CampoCor; aba: string; dica?: string }[] = [
  { campo: "cor_navbar", aba: "Faixa" },
  { campo: "cor_borda", aba: "Borda da logo" },
  { campo: "cor_nome", aba: "Nome" },
];
const LIMITE_DESCRICAO = 200;

export default function AparenciaCelular(p: Props) {
  const { profile } = useProfile();
  const codigo = String(profile?.codigo_publico || "");
  const slug = String(profile?.slug_personalizado || "") || "cardapio";
  const selo = p.isPro;

  const [aba, setAba] = useState<CampoCor>("cor_borda");
  const [outraCor, setOutraCor] = useState(false);
  const [hex, setHex] = useState<string | null>(null);
  const [verLink, setVerLink] = useState(false);
  const [menuBanner, setMenuBanner] = useState(false);
  const [editDesc, setEditDesc] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // (20/11) primeira vez na tela: pergunta se quer ajuda e, se sim, mostra onde se toca em cada coisa (depois ela segue sozinha)
  const [ajuda, setAjuda] = useState<"pergunta" | number | null>(null);
  useEffect(() => {
    if (jaViuDestaque("aparencia-nova")) return;
    const t = window.setTimeout(() => { marcarDestaque("aparencia-nova"); setAjuda("pergunta"); }, 600);
    return () => window.clearTimeout(t);
  }, []);
  const passos: { alvo: string; titulo: string; texto: string }[] = [
    { alvo: ".apn-url", titulo: "O link do seu cardápio", texto: p.isPro ? "É o endereço que você manda para os clientes. Toque no lápis para mudar o fim dele." : "É o endereço que você manda para os clientes. No PRO, ele leva o nome da sua loja." },
    { alvo: ".apn-rel", titulo: "Foto do topo", texto: "Toque na câmera para pôr uma foto atrás do nome da loja." },
    { alvo: ".apn-logo", titulo: "Sua logo", texto: "Toque na logo para escolher ou trocar a imagem." },
    { alvo: p.descricao ? ".apn-desc" : ".apn-desc-vazia", titulo: "Descrição da loja", texto: p.descricao ? "Toque no lápis para contar o que você faz." : "Toque aqui e conte em uma frase o que você faz." },
    { alvo: p.banner ? ".apn-banner" : ".apn-slot", titulo: "Banner de promoção", texto: "Para promoções e datas especiais. Pode ser uma foto sua ou um banner pronto." },
    { alvo: ".apn-ctl", titulo: "Cores", texto: "Escolha a cor da faixa, da borda da logo e do nome. Tudo salva na hora." },
  ];

  const cor = (c: CampoCor) => p.cores.find(x => x.campo === c)!;
  const atual = cor(aba);
  const prontas = p.premium ? [...PRONTAS[aba], ...PRONTAS_PRO[aba]] : PRONTAS[aba];
  const ePronta = prontas.some(x => x.cor === atual.valor);

  const status = getStatusLoja(p.horario || null);
  const faixa = topoEscurecido(cor("cor_navbar").valor);
  const ocupado = !!p.enviando;

  // o painel de cores fica preso logo acima do menu de baixo do app (a altura dele muda entre aparelhos)
  const painel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const medir = () => {
      const nav = document.querySelector<HTMLElement>(".bottom-nav");
      const h = nav && getComputedStyle(nav).display !== "none" ? Math.round(window.innerHeight - nav.getBoundingClientRect().top) : 0;
      painel.current?.style.setProperty("--apn-nav", `${Math.max(0, h)}px`);
    };
    medir(); window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const gravarDescricao = async () => {
    if (editDesc === null || salvando) return;
    setSalvando(true);
    const ok = await p.salvarDescricao(editDesc.trim());
    setSalvando(false);
    if (ok) setEditDesc(null);
  };

  return (
    <>
      {p.janelas}
      <AppPageHeader title="Aparência" onBack={p.voltar} />
      <div className="apn">
        {/* rever a ajuda quando quiser (no lugar do "i" das outras telas) */}
        <button type="button" className="apn-ajuda-bt" aria-label="Ver a ajuda desta tela" onClick={() => setAjuda(0)}><Question size={20} weight="bold" /></button>
        <div className="apn-cw">
          <i className="apn-b1" aria-hidden="true" /><i className="apn-b2" aria-hidden="true" /><i className="apn-b3" aria-hidden="true" />
          <div className="apn-cel">
            <div className="apn-topo-cel">
              <div className="apn-sb" aria-hidden="true"><span>9:41</span><i className="apn-ilha" /><span className="apn-sbi"><CellSignalFull size={13} weight="fill" /><WifiHigh size={13} weight="bold" /><BatteryFull size={15} weight="fill" /></span></div>
              {/* o link, como numa barra de navegador */}
              <div className="apn-url">
                <span className="apn-cad" aria-hidden="true"><LockSimple size={13} weight="fill" /></span>
                <em>doonly.com.br/c/{codigo}/{p.isPro ? <b>{slug}</b> : slug}</em>
                {p.isPro
                  ? <button type="button" aria-label="Mudar o fim do link" onClick={() => setVerLink(true)}><PencilSimple size={15} weight="bold" /></button>
                  : <button type="button" className="apn-up" aria-label="Link com o nome da loja, no plano PRO" onClick={() => abrirConvitePro("link")}><Crown size={13} weight="fill" />PRO</button>}
              </div>
            </div>

            <div className="cm1-root apn-card">
              <div className="apn-rel">
                <div className={`cm1-hero${p.fotoTopo ? " cm1-hero--foto" : ""}`}>
                  {p.fotoTopo
                    ? <div className="cm1-hero-img" style={{ backgroundImage: `url("${p.fotoTopo}")` }} />
                    : <div className="cm1-hero-faixa" style={{ backgroundColor: faixa }}><span className="cm1-hero-pontos" /></div>}
                </div>
                {p.enviando === "banner-topo" && <span className="apn-gira"><span className="ui-gira" aria-label="Enviando" /></span>}
                {p.fotoTopo && <button type="button" className="apn-rb apn-rb--e" aria-label="Tirar a foto do topo" disabled={ocupado} onClick={p.tirarTopo}><X size={16} weight="bold" /></button>}
                <button type="button" className={`apn-rb apn-rb--d${p.fotoTopo ? "" : " apn-rb--tx"}`} aria-label={p.fotoTopo ? "Trocar a foto do topo" : "Adicionar foto do topo"} disabled={ocupado} onClick={p.escolherTopo}>
                  <Camera size={17} weight="bold" />{!p.fotoTopo && <span>Foto do topo</span>}
                </button>
              </div>
              <div className="cm1-content apn-conteudo">
                <button type="button" className="cm1-logo apn-logo" style={{ borderColor: cor("cor_borda").valor }} aria-label={p.logo ? "Trocar a logo" : "Adicionar a logo"} disabled={ocupado} onClick={p.escolherLogo}>
                  {p.enviando === "logo" ? <span className="ui-gira" aria-label="Enviando" />
                    : p.logo ? <img src={p.logo} alt="" />
                    : <b>{(p.nomeLoja || "?").trim().charAt(0).toUpperCase()}</b>}
                </button>
                <i className="apn-lc" aria-hidden="true"><Camera size={13} weight="bold" /></i>
                <h1 className="cm1-nome" style={{ color: cor("cor_nome").valor }}>
                  {p.nomeLoja || "Nome da sua loja"}{selo && <span className="apn-selo"><SeloVerificado tamanho={20} /></span>}
                </h1>
                <div className="cm1-sl">
                  {status ? (
                    <span className={`cm1-sl-st${status.aberto ? " aberto" : ""}`}>
                      <i aria-hidden="true" /><b>{status.msg.split(" · ")[0]}</b>
                      {status.curto.includes(" · ") && <span> · {status.curto.split(" · ").slice(1).join(" · ")}</span>}
                    </span>
                  ) : <span />}
                  <span className="cm1-sl-sobre apn-sobre" style={{ color: COR_BOTOES }}>Sobre a loja<CaretRight size={14} weight="bold" aria-hidden="true" /></span>
                </div>
                {p.descricao
                  ? <p className="cm1-descricao apn-desc">{p.descricao} <button type="button" className="apn-dp" aria-label="Mudar a descrição" onClick={() => setEditDesc(p.descricao)}><PencilSimple size={13} weight="bold" /></button></p>
                  : <button type="button" className="apn-desc-vazia" onClick={() => setEditDesc("")}><PencilSimple size={14} weight="bold" aria-hidden="true" />Escrever a descrição da loja</button>}
              </div>
            </div>

            {p.banner ? (
              <div className="apn-banner">
                <img src={p.banner} alt="Banner de promoção" />
                {p.enviando === "banner0" && <span className="apn-gira"><span className="ui-gira" aria-label="Enviando" /></span>}
                <button type="button" className="apn-rb apn-rb--e" aria-label="Tirar o banner" disabled={ocupado} onClick={p.tirarBanner}><X size={16} weight="bold" /></button>
                <button type="button" className="apn-rb apn-rb--d" aria-label="Trocar o banner" disabled={ocupado} onClick={() => setMenuBanner(true)}><Camera size={17} weight="bold" /></button>
              </div>
            ) : (
              <button type="button" className="ap-enviar ap-slot apn-slot" disabled={ocupado} onClick={() => setMenuBanner(true)}>
                {p.enviando === "banner0" ? <span className="ui-gira" aria-label="Enviando" /> : <><b><Plus size={17} weight="bold" aria-hidden="true" />Adicionar banner de promoção</b><small>Sua foto ou um banner pronto</small></>}
              </button>
            )}

            {/* produtos só de ilustração: não abrem, servem para ela ver o cardápio inteiro */}
            <section className="ic-sec apn-prod" aria-hidden="true">
              <div className="ic-lista">
                <article className="ic-ln"><div className="ic-ln-tx"><b>Bolo de Morango</b><p>Massa branca, recheio de morango e chantilly</p><div className="ic-pp"><span className="ic-pp-linha"><s>R$ 120,00</s><b>R$ 99,00</b></span></div></div><div className="ic-ln-ft"><span className="apn-ex">Exemplo</span></div></article>
                <article className="ic-ln"><div className="ic-ln-tx"><b>Brigadeiro gourmet</b><p>Caixa com 12 unidades</p><span className="ic-ln-preco"><b>R$ 36,00</b></span></div><div className="ic-ln-ft"><span className="apn-ex">Exemplo</span></div></article>
              </div>
            </section>
          </div>
        </div>

        {/* cores: presas embaixo, em três abas */}
        <div className="apn-ctl" ref={painel}>
          <div className="apn-abas" role="tablist" aria-label="Cores do topo">
            {ABAS.map(a => <button key={a.campo} type="button" role="tab" aria-selected={aba === a.campo} className={aba === a.campo ? "on" : ""} onClick={() => { setAba(a.campo); setOutraCor(false); setHex(null); }}>{a.aba}</button>)}
          </div>
          <div className={`apn-cores${p.premium ? "" : " apn-cores--g"}`} role="radiogroup" aria-label={ABAS.find(a => a.campo === aba)!.aba}>
            {prontas.map(x => {
              const on = atual.valor === x.cor;
              return <button key={x.cor} type="button" role="radio" aria-checked={on} aria-label={x.nome} title={x.nome} className={on ? "on" : ""} style={{ background: x.cor }} onClick={() => { setOutraCor(false); atual.mudar(x.cor); }}>{on && <Check size={14} weight="bold" aria-hidden="true" />}</button>;
            })}
            {p.premium
              ? <button type="button" className={`apn-mais${!ePronta ? " on" : ""}`} aria-label="Outra cor" aria-expanded={outraCor} style={!ePronta ? { background: atual.valor, color: "#fff", borderStyle: "solid", borderColor: "transparent" } : undefined} onClick={() => setOutraCor(v => !v)}><Plus size={14} weight="bold" aria-hidden="true" /></button>
              : <button type="button" className="ap-mais-cores apn-mc" onClick={() => abrirConvitePro("cores")}><Crown size={15} weight="fill" aria-hidden="true" />Mais cores<span>PRO</span></button>}
          </div>
          {aba === "cor_navbar" && !!p.fotoTopo && <p className="apn-dica">A faixa aparece quando o topo está sem foto.</p>}
        </div>
      </div>

      <Janela aberta={ajuda === "pergunta"} aoFechar={() => setAjuda(null)} tipo="conteudo" titulo="Primeira vez aqui?"
        acoes={<><Botao variante="secundario" onClick={() => setAjuda(null)}>Agora não</Botao><Botao onClick={() => setAjuda(0)}>Quero ajuda</Botao></>}>
        <p className="apn-ajuda-tx">Quer uma ajudinha para personalizar o seu cardápio? Eu mostro onde tocar em cada coisa.</p>
      </Janela>
      {typeof ajuda === "number" && (
        <Destaque key={ajuda} alvo={passos[ajuda].alvo} titulo={passos[ajuda].titulo} texto={passos[ajuda].texto}
          passo={`${ajuda + 1} de ${passos.length}`} acao={ajuda === passos.length - 1 ? "Concluir" : "Próximo"} naoTexto="Sair"
          aoAcao={() => setAjuda(ajuda === passos.length - 1 ? null : ajuda + 1)} aoFechar={() => setAjuda(null)} />
      )}

      {/* outra cor (PRO) */}
      <Janela aberta={outraCor && p.premium} aoFechar={() => { setOutraCor(false); setHex(null); }} tipo="conteudo" titulo={`Cor: ${ABAS.find(a => a.campo === aba)!.aba.toLowerCase()}`}
        acoes={<Botao variante="secundario" onClick={() => { setOutraCor(false); setHex(null); }}>Pronto</Botao>} umaAcao>
        <div className="ap-picker apn-picker">
          <HexColorPicker color={atual.valor} onChange={v => { setHex(null); atual.mudar(v.toUpperCase()); }} style={{ width: "100%", height: 168 }} />
          <div className="ap-picker-pe">
            <div className="ui-campo-c ap-hex"><input aria-label="Código da cor" maxLength={7} value={hex ?? atual.valor}
              onChange={e => { const l = e.target.value.replace(/\s/g, ""); const t = l && !l.startsWith("#") ? `#${l}` : l; if (t && !/^#[0-9a-fA-F]{0,6}$/.test(t)) return; setHex(t); if (/^#[0-9a-fA-F]{6}$/.test(t)) atual.mudar(t.toUpperCase()); }}
              onBlur={() => setHex(null)} /></div>
            <BotaoIcone rotulo="Voltar para cor padrão" variante="neutro" onClick={() => { setHex(null); atual.mudar(PADRAO[aba]); }}><ArrowCounterClockwise size={20} weight="bold" /></BotaoIcone>
          </div>
        </div>
      </Janela>

      {/* banner: sua foto ou um banner pronto */}
      <Janela aberta={menuBanner} aoFechar={() => setMenuBanner(false)} tipo="conteudo" titulo="Banner de promoção">
        <div className="apn-ops">
          <button type="button" onClick={() => { setMenuBanner(false); p.escolherBanner(); }}><span><Images size={20} weight="bold" aria-hidden="true" /></span><b>Escolher da galeria</b><small>Uma foto sua, deitada</small></button>
          <button type="button" onClick={() => { setMenuBanner(false); p.abrirGaleria(); }}><span><Sparkle size={20} weight="bold" aria-hidden="true" /></span><b>Usar um banner pronto</b><small>Feitos pela equipe Doonly</small></button>
        </div>
      </Janela>

      {/* descrição da loja */}
      <Janela aberta={editDesc !== null} aoFechar={() => !salvando && setEditDesc(null)} tipo="conteudo" titulo="Descrição da loja"
        acoes={<><Botao variante="secundario" onClick={() => setEditDesc(null)} disabled={salvando}>Voltar</Botao><Botao onClick={gravarDescricao} carregando={salvando}>Salvar</Botao></>}>
        <CampoArea rotulo="Aparece embaixo do nome, no cardápio" value={editDesc ?? ""} maxLength={LIMITE_DESCRICAO} rows={4} placeholder="Ex.: Bolos e doces feitos por encomenda, com entrega no mesmo dia."
          onChange={e => setEditDesc(e.target.value.slice(0, LIMITE_DESCRICAO))} />
      </Janela>

      {/* link (PRO) */}
      <Janela aberta={verLink} aoFechar={() => setVerLink(false)} tipo="conteudo" titulo="Link do cardápio"
        acoes={<Botao variante="secundario" onClick={() => setVerLink(false)}>Fechar</Botao>} umaAcao>
        <NomeNoLink />
      </Janela>
    </>
  );
}
