import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { HexColorPicker } from "react-colorful";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { ArrowCounterClockwise, ArrowsClockwise, Check, Crown, Image as ImageIcon, Images, Layout, Lock, Palette, Storefront, UploadSimple, X } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, BotaoIcone, Janela, Titulo, avisar } from "@/components/base";
import "./aparencia.css";

/**
 * Aparência do cardápio (08/10 · 3.25, no padrão do guia).
 * Logo, foto do topo, banners de promoção, modelo e cores. Tudo salva na hora, como antes.
 * Ícones do app no lugar dos emojis, letras legíveis, toques de 44px e as partes do PRO
 * num cinza calmo com "No PRO" (sem brilho piscando).
 */

export default function CardapioDesign({ identityCard, avaliacoesCard }: { identityCard?: React.ReactNode; avaliacoesCard?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  // Marca o passo "Escolher design" do passo a passo (ignora erro se a coluna ainda não existir)
  const marcarDesignEscolhido = (uid: string | null | undefined) => {
    if (!uid) return;
    supabase.from("profiles").update({ design_escolhido: true }).eq("id", uid).then(() => {}, () => {});
  };
  // Abrir a Aparência já marca o passo "Escolher design" do passo a passo (01/10): quem gostou do
  // modelo padrão e não mexeu em nada também conclui o passo.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) marcarDesignEscolhido(user.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fotoPerfil, setFotoPerfil] = useState(""); // sem logo, o cardápio usa a foto de perfil
  const [verExemplo, setVerExemplo] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  // Avaliação (veio de Dados da loja em 29/09)
  const [hideStars, setHideStars] = useState(false);
  const [avaliacaoMedia, setAvaliacaoMedia] = useState(5.0);
  const salvarAvaliacao = async (campos: { hide_stars?: boolean; avaliacao_media?: number }) => {
    if (!userId) return;
    await supabase.from("profiles").update(campos).eq("id", userId);
    showSuccess();
  };
  const [nomeLoja, setNomeLoja] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [banner1Url, setBanner1Url] = useState("");
  const [banner2Url, setBanner2Url] = useState("");
  const [banner3Url, setBanner3Url] = useState("");
  const [bannerTopoUrl, setBannerTopoUrl] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const { isPro } = usePlano();
  const modeloAtivoCalc = (m: string) => (m === "padrao" && isPro ? "padrao" : "modelo1");
  const [cardapioModelo, setCardapioModelo] = useState("modelo1");
  // "Padrão" é exclusivo PRO: quem não é PRO usa o Modelo 1 (inclusive contas antigas que estavam no "Padrão")
  const [salvandoModelo, setSalvandoModelo] = useState(false);

  const [corBorda, setCorBorda] = useState("#FF6FA9");
  const [corBackground, setCorBackground] = useState("#FFF1F7");
  const [corNome, setCorNome] = useState("#1f2937");
  const [corBotao, setCorBotao] = useState("#FF6FA9");
  const [corNavbar, setCorNavbar] = useState("#FF6FA9");
  const [corSacola, setCorSacola] = useState("#FF6FA9");
  const [corRodape, setCorRodape] = useState("#FF6FA9");
  const [activePicker, setActivePicker] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const bannerTopoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("logo_url, foto_url, nome_loja, banner_url, banner1_url, banner2_url, banner3_url, banner_topo_url, cor_borda, cor_background, cor_nome, cor_botao, cor_navbar, cor_sacola, cor_rodape, cardapio_modelo, hide_stars, avaliacao_media").eq("id", user.id).single();
      if (data) {
        setLogoUrl(data.logo_url || ""); setFotoPerfil((data as any).foto_url || "");
        setHideStars(!!(data as any).hide_stars);
        setAvaliacaoMedia(Number((data as any).avaliacao_media) || 5.0);
        setNomeLoja(data.nome_loja || "");
        setBannerUrl(data.banner_url || "");
        setBanner1Url(data.banner1_url || "");
        setBanner2Url(data.banner2_url || "");
        setBanner3Url(data.banner3_url || "");
        setBannerTopoUrl(data.banner_topo_url || "");
        setCorBorda(data.cor_borda || "#FF6FA9");
        setCorBackground(data.cor_background || "#FFF1F7");
        setCorNome(data.cor_nome || "#1f2937");
        setCorBotao(data.cor_botao || "#FF6FA9");
        setCorNavbar(data.cor_navbar || "#FF6FA9");
        setCorSacola(data.cor_sacola || "#FF6FA9");
        setCorRodape(data.cor_rodape || "#FF6FA9");
        setCardapioModelo(data.cardapio_modelo || "modelo1");
      }
      setLoading(false);
    };
    load();
  }, []);

  const uploadImage = async (file: File, path: string) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fullPath = `${path}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(fullPath, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("products").getPublicUrl(fullPath);
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const showSuccess = () => {
    // Notifica outros componentes (ex: preview do cardápio no CardapioConfigPage)
    // pra recarregar após save do Design
    window.dispatchEvent(new CustomEvent("cardapio-design-saved"));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleLogoCropDone = async (blob: Blob) => {
    if (!userId) return;
    setCropSrc(null);
    setUploading("logo");
    const path = `logos/${userId}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setLogoUrl(url);
      await supabase.from("profiles").update({ logo_url: url }).eq("id", userId); marcarDesignEscolhido(userId);
      showSuccess();
    } else {
      avisar("Não deu pra enviar a logo. Confira a internet e tente de novo.", { tipo: "erro" });
    }
    setUploading(null);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploading(`banner${index}`);
    const suffix = index === 0 ? "" : `-${index}`;
    const url = await uploadImage(file, `banners/${userId}${suffix}`);
    if (!url) avisar("Não deu pra enviar a imagem. Confira a internet e tente de novo.", { tipo: "erro" });
    if (url) {
      const fields = [setBannerUrl, setBanner1Url, setBanner2Url, setBanner3Url];
      const keys = ["banner_url", "banner1_url", "banner2_url", "banner3_url"];
      fields[index](url);
      await supabase.from("profiles").update({ [keys[index]]: url }).eq("id", userId); marcarDesignEscolhido(userId);
      showSuccess();
    }
    setUploading(null);
  };

  const handleRemoveBanner = async (index: number) => {
    if (!userId) return;
    const fields = [setBannerUrl, setBanner1Url, setBanner2Url, setBanner3Url];
    const keys = ["banner_url", "banner1_url", "banner2_url", "banner3_url"];
    fields[index]("");
    await supabase.from("profiles").update({ [keys[index]]: null }).eq("id", userId);
  };

  const handleBannerTopoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !userId) return;
    setUploading("banner-topo");
    const url = await uploadImage(file, `banners/${userId}-topo`);
    if (!url) avisar("Não deu pra enviar a imagem. Confira a internet e tente de novo.", { tipo: "erro" });
    if (url) {
      setBannerTopoUrl(url);
      await supabase.from("profiles").update({ banner_topo_url: url }).eq("id", userId); marcarDesignEscolhido(userId);
      showSuccess();
    }
    setUploading(null);
  };
  const handleRemoveBannerTopo = async () => {
    if (!userId) return;
    setBannerTopoUrl("");
    await supabase.from("profiles").update({ banner_topo_url: null }).eq("id", userId);
  };

  const colorSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleColorChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (colorSaveTimer.current) clearTimeout(colorSaveTimer.current);
    colorSaveTimer.current = setTimeout(async () => {
      if (!userId) return;
      await supabase.from("profiles").update({ [field]: value }).eq("id", userId); marcarDesignEscolhido(userId);
      showSuccess();
    }, 600);
  };

  const bannerValues = [bannerUrl, banner1Url, banner2Url, banner3Url];

  const coresPro: { campo: string; rotulo: string; dica?: string; valor: string; set: (v: string) => void; padrao: string }[] = [
    { campo: "cor_borda", rotulo: "Borda da logo", valor: corBorda, set: setCorBorda, padrao: "#FF6FA9" },
    { campo: "cor_nome", rotulo: "Nome da confeitaria", dica: "Sem cor escolhida: branco no computador e preto no celular", valor: corNome, set: setCorNome, padrao: "#1f2937" },
    { campo: "cor_botao", rotulo: "Botões de comprar", valor: corBotao, set: setCorBotao, padrao: "#FF6FA9" },
    { campo: "cor_navbar", rotulo: "Fundo atrás da logo e do nome", valor: corNavbar, set: setCorNavbar, padrao: "#FF6FA9" },
  ];
  const iniciais = (nomeLoja || "ML").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "ML";

  const PreviaCor = ({ campo, valor }: { campo: string; valor: string }) => {
    if (campo === "cor_borda") return (
      <div className="ap-previa" style={{ background: corBackground }}>
        <span className="ap-previa-logo" style={{ borderColor: valor }}>{logoUrl ? <img src={logoUrl} alt="" /> : <b style={{ background: valor }}>{iniciais}</b>}</span>
        <i style={{ background: valor }} />
      </div>
    );
    if (campo === "cor_nome") return <div className="ap-previa" style={{ background: corBackground }}><b className="ap-previa-nome" style={{ color: valor }}>{nomeLoja || "Nome da sua loja"}</b></div>;
    if (campo === "cor_botao") return <div className="ap-previa"><span className="ap-previa-bt" style={{ background: valor }}>Adicionar · R$ 50,00</span></div>;
    return <div className="ap-previa" style={{ background: valor }}><small>Fundo atrás da logo e do nome</small></div>;
  };

  const Cabeca = ({ Ic, titulo, apoio, acao }: { Ic: typeof Palette; titulo: string; apoio?: React.ReactNode; acao?: React.ReactNode }) => (
    <div className="ap-cab"><span className="ap-cab-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><Titulo apoio={apoio} acao={acao}>{titulo}</Titulo></div>
  );

  const escolherModelo = async (m: "modelo1" | "padrao") => {
    if (m === "padrao" && !isPro) { avisar("O modelo Premium é do plano PRO.", { tipo: "info", acao: { rotulo: "Ver o PRO", aoTocar: () => navigate("/assinar") } }); return; }
    if (!userId || salvandoModelo) return;
    setSalvandoModelo(true);
    setCardapioModelo(m);
    await supabase.from("profiles").update({ cardapio_modelo: m }).eq("id", userId); marcarDesignEscolhido(userId);
    setSalvandoModelo(false);
    showSuccess();
  };

  if (loading) return (
    <>
      {!identityCard && <AppPageHeader title="Aparência" subtitle="Logo, banners, modelo e cores" onBack={() => navigate("/cardapio")} />}
      <div className="ap-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
    </>
  );

  const modeloAtivo = modeloAtivoCalc(cardapioModelo);
  const ProSlot = ({ n }: { n: number }) => (
    <button type="button" className="ap-slot ap-slot--pro" onClick={() => avisar("Os banners 3 e 4 são do plano PRO.", { tipo: "info", acao: { rotulo: "Ver o PRO", aoTocar: () => navigate("/assinar") } })} aria-label={`Banner ${n}, no plano PRO`}>
      <Lock size={20} weight="bold" aria-hidden="true" /><b>No PRO</b>
    </button>
  );

  return (
    <>
    {cropSrc && (
      <ImageCropper imageSrc={cropSrc} cropShape="round" aspect={1} onCancel={() => setCropSrc(null)} onCropDone={handleLogoCropDone} />
    )}
    {!identityCard && (
      <AppPageHeader title="Aparência" subtitle="Logo, banners, modelo e cores" onBack={() => navigate("/cardapio")}
        infoIcon="🎨"
        infoContent={<>
          <p>Aqui você deixa o <strong>cardápio com a cara da sua confeitaria</strong>: a logo, os banners de promoção e o modelo da página.</p>
          <p>Tudo é salvo na hora e já aparece pros seus clientes. Use o <strong>"Ver meu cardápio"</strong> pra conferir como ficou.</p>
        </>}
        infoTip={<>As <strong>cores</strong> e o modelo <strong>Premium</strong> são do plano PRO.</>}
      />
    )}
    <div className="ap">

      {/* Logo */}
      <section className="ap-card ap-largo">
        <Cabeca Ic={Storefront} titulo="Logo da loja" apoio="Aparece no topo do cardápio, junto do nome" />
        <input ref={logoRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
        <div className="ap-logo">
          <button type="button" className="ap-logo-circ" onClick={() => logoRef.current?.click()} aria-label={logoUrl ? "Trocar a logo" : "Enviar a logo"}>
            {(logoUrl || fotoPerfil) ? <img src={logoUrl || fotoPerfil} alt="" /> : <span>{(nomeLoja || "?").trim().charAt(0).toUpperCase()}</span>}
          </button>
          <div className="ap-logo-tx">
            <b>{logoUrl ? "Sua logo" : fotoPerfil ? "Usando a sua foto de perfil" : "Nenhuma logo ainda"}</b>
            <span>{logoUrl ? "É ela que aparece no topo do cardápio." : fotoPerfil ? "Se tiver uma logo, envie aqui. Ela aparece no lugar da foto." : "Sem logo, o cardápio mostra a primeira letra do nome."}</span>
            {!logoUrl && fotoPerfil && <em><Check size={14} weight="bold" aria-hidden="true" />Já aparece no seu cardápio</em>}
          </div>
          <Botao variante="secundario" tamanho="m" className="ap-logo-bt" icone={<UploadSimple size={20} weight="bold" />} carregando={uploading === "logo"} onClick={() => logoRef.current?.click()}>
            {uploading === "logo" ? "Enviando…" : logoUrl ? "Trocar logo" : "Enviar logo"}
          </Botao>
        </div>
      </section>

      {/* Foto do topo (só no Modelo 1) */}
      {modeloAtivo === "modelo1" && (
        <section className="ap-card ap-largo">
          <Cabeca Ic={ImageIcon} titulo="Foto do topo" apoio="Fica atrás da logo, no topo do cardápio. Use uma foto deitada, de 1200 × 400." />
          {bannerTopoUrl ? (
            <div className="ap-img ap-img--topo">
              <img src={bannerTopoUrl} alt="Foto do topo" />
              <span className="ap-img-sombra" aria-hidden="true" />
              <div className="ap-img-acoes">
                <button type="button" className="ap-chip" onClick={() => bannerTopoRef.current?.click()}><ArrowsClockwise size={16} weight="bold" />Trocar</button>
                <BotaoIcone rotulo="Tirar a foto do topo" variante="neutro" tamanho="p" className="ap-tirar" onClick={handleRemoveBannerTopo}><X size={18} weight="bold" /></BotaoIcone>
              </div>
            </div>
          ) : (
            <button type="button" className="ap-enviar ap-img--topo" onClick={() => !uploading && bannerTopoRef.current?.click()} disabled={!!uploading}>
              {uploading === "banner-topo" ? <span className="ui-gira" aria-label="Enviando" /> : <><UploadSimple size={24} weight="bold" /><b>Escolher foto do topo</b><small>Deitada, 1200 × 400</small></>}
            </button>
          )}
          <input ref={bannerTopoRef} type="file" accept="image/*" hidden onChange={handleBannerTopoUpload} />
        </section>
      )}

      {/* Banners de promoção */}
      <section className="ap-card ap-largo">
        <Cabeca Ic={Images} titulo="Banners de promoção"
          apoio={(isPro ? "Rodam em carrossel no cardápio. Use pra promoções e novidades." : "Anuncie a promoção do mês. No PRO, até 4 banners rodam em carrossel.") + " Tamanho ideal: 1200 × 675, deitado."} />
        <Botao variante="link" tamanho="p" className="ap-ex-bt" onClick={() => setVerExemplo(true)}>Ver um exemplo de banner</Botao>
        <div className="ap-banners">
          {(isPro ? [0, 1, 2, 3] : [0]).map(i => (
            <div key={i} className="ap-banner">
              <span className="ap-banner-r">Banner {i + 1}</span>
              {bannerValues[i] ? (
                <div className="ap-img">
                  <img src={bannerValues[i]} alt={`Banner ${i + 1}`} />
                  <div className="ap-img-acoes">
                    <button type="button" className="ap-chip" onClick={() => bannerRefs[i].current?.click()}><ArrowsClockwise size={16} weight="bold" />Trocar</button>
                    <BotaoIcone rotulo={`Tirar o banner ${i + 1}`} variante="neutro" tamanho="p" className="ap-tirar" onClick={() => handleRemoveBanner(i)}><X size={18} weight="bold" /></BotaoIcone>
                  </div>
                </div>
              ) : (
                <button type="button" className="ap-enviar ap-slot" onClick={() => !uploading && bannerRefs[i].current?.click()} disabled={!!uploading}>
                  {uploading === `banner${i}` ? <span className="ui-gira" aria-label="Enviando" /> : <><UploadSimple size={20} weight="bold" /><b>Adicionar</b></>}
                </button>
              )}
              <input ref={bannerRefs[i]} type="file" accept="image/*" hidden onChange={e => handleBannerUpload(e, i)} />
            </div>
          ))}
          {!isPro && [2, 3, 4].map(n => (
            <div key={n} className="ap-banner"><span className="ap-banner-r">Banner {n}</span><ProSlot n={n} /></div>
          ))}
        </div>
      </section>

      {identityCard}

      {/* Modelo */}
      <section className="ap-card ap-largo">
        <Cabeca Ic={Layout} titulo="Modelo do cardápio" apoio="Como o cliente vê a sua loja" />
        <div className="ap-modelos" role="radiogroup" aria-label="Modelo do cardápio">
          <button type="button" role="radio" aria-checked={modeloAtivo === "modelo1"} className="ap-modelo" onClick={() => escolherModelo("modelo1")} disabled={salvandoModelo}>
            <div className="cd-layout-preview cd-layout-preview-modelo1" aria-hidden="true">
              <div className="cd-lp-hero"><div className="cd-lp-hero-overlay" /></div>
              <div className="cd-lp-m1-logo" />
              <div className="cd-lp-m1-badge" />
              <div className="cd-lp-lines" style={{ marginTop: 18 }}><i style={{ width: "55%" }} /><i style={{ width: "80%" }} /></div>
              <div className="cd-lp-products"><div className="cd-lp-product" /><div className="cd-lp-product" /><div className="cd-lp-product" /></div>
            </div>
            <span className="ap-modelo-pe"><b>Clássico</b><small>Grátis</small></span>
            {modeloAtivo === "modelo1" && <span className="ap-modelo-ok" aria-hidden="true"><Check size={14} weight="bold" /></span>}
          </button>
          <button type="button" role="radio" aria-checked={modeloAtivo === "padrao"} className="ap-modelo" onClick={() => escolherModelo("padrao")} disabled={salvandoModelo}>
            <div className="cd-layout-preview cd-layout-preview-padrao" aria-hidden="true">
              <div className="cd-lp-header" />
              <div className="cd-lp-logo-circle" />
              <div className="cd-lp-lines"><i style={{ width: "60%" }} /><i style={{ width: "40%" }} /></div>
              <div className="cd-lp-products"><div className="cd-lp-product" /><div className="cd-lp-product" /><div className="cd-lp-product" /></div>
            </div>
            <span className="ap-modelo-pe"><b>Premium</b>{isPro ? <small>PRO</small> : <small className="pro"><Crown size={14} weight="fill" />No PRO</small>}</span>
            {modeloAtivo === "padrao" && <span className="ap-modelo-ok" aria-hidden="true"><Check size={14} weight="bold" /></span>}
          </button>
        </div>
      </section>

      {/* Cores */}
      <section className="ap-card ap-largo">
        <Cabeca Ic={Palette} titulo="Cores do cardápio" apoio={isPro ? "Toque numa cor pra mudar. Salva sozinho." : "Botões, bordas e o nome da loja"} />
        {!isPro ? (
          <div className="ap-cores-pro">
            <div className="ap-cores-sw" aria-hidden="true">{["#7C3AED", "#0EA5E9", "#16A34A", "#F59E0B", "#2C1219"].map(c => <span key={c} style={{ background: c }} />)}</div>
            <p>Deixe o cardápio com as cores da sua marca. No plano grátis, ele usa o rosa do Doonly.</p>
            <Botao variante="vinho" icone={<Crown size={20} weight="fill" />} onClick={() => navigate("/assinar")}>Conhecer o PRO</Botao>
          </div>
        ) : (
          <div className="ap-cores">
            {coresPro.map(c => {
              const aberta = activePicker === c.campo;
              return (
                <div key={c.campo} className={`ap-cor${aberta ? " aberta" : ""}`}>
                  <button type="button" className="ap-cor-l" aria-expanded={aberta} onClick={() => setActivePicker(aberta ? null : c.campo)}>
                    <span className="ap-cor-tx"><b>{c.rotulo}</b>{c.dica && <small>{c.dica}</small>}<code>{c.valor.toUpperCase()}</code></span>
                    <span className="ap-cor-sw" style={{ background: c.valor }} />
                  </button>
                  {aberta && (
                    <div className="ap-picker">
                      <PreviaCor campo={c.campo} valor={c.valor} />
                      <HexColorPicker color={c.valor} onChange={v => handleColorChange(c.campo, v, c.set)} style={{ width: "100%", height: 168 }} />
                      <div className="ap-picker-pe">
                        <div className="ui-campo-c ap-hex"><input aria-label="Código da cor" value={c.valor} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange(c.campo, e.target.value, c.set); }} /></div>
                        <BotaoIcone rotulo="Voltar pra cor padrão" variante="neutro" onClick={() => handleColorChange(c.campo, c.padrao, c.set)}><ArrowCounterClockwise size={20} weight="bold" /></BotaoIcone>
                        <Botao variante="suave" tamanho="m" onClick={() => setActivePicker(null)}>Pronto</Botao>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Janela aberta={verExemplo} aoFechar={() => setVerExemplo(false)} tipo="conteudo" titulo="Exemplo de banner"
        acoes={<Botao variante="secundario" cheio onClick={() => setVerExemplo(false)}>Fechar</Botao>} umaAcao>
        <img className="ap-ex" src="/exemplo-banner.jpg" alt="Exemplo de banner: Semana do Brigadeiro, 20% de desconto em todos os kits" />
        <p className="ap-ex-tx">1200 × 675, deitado. Deixe o texto no meio da imagem.</p>
      </Janela>
    </div>
    </>
  );
}
