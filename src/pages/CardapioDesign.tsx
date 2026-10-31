import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { explicarErro } from "@/lib/erros";
import { usePlano } from "@/hooks/usePlano";
import { HexColorPicker } from "react-colorful";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { useRecorte } from "@/components/ui/useRecorte";
import { ArrowCounterClockwise, ArrowsClockwise, CalendarBlank, Camera, Check, Eye, Info, Crown, Image as ImageIcon, Images, Layout, LinkSimple, Lock, MapPin, Palette, Plus, Sparkle, Storefront, UploadSimple, X } from "@phosphor-icons/react";
import { SeloVerificado } from "@/components/cardapio/SeloVerificado";
import { situacaoLoja } from "@/lib/agendaCardapio";
import AppPageHeader from "@/components/AppPageHeader";
import bannerAparencia from "@/assets/banner-aparencia.webp";
import { COMO_APARENCIA, TOUR_APARENCIA } from "@/lib/comoTelas";
import { Botao, BotaoIcone, Janela, TelaVazia, Titulo, avisar } from "@/components/base";
import { lerBannersProntos, CATEGORIAS_BANNER, CATEGORIA_CAPA_NATAL, type BannerPronto } from "@/lib/bannersProntos";
import { COR_BOTOES, PADRAO, PRONTAS, PRONTAS_PRO, corDoItem, topoEscurecido, type CampoCor } from "@/lib/coresCardapio";
import NomeNoLink from "@/components/loja/NomeNoLink";
import "./aparencia.css";

/**
 * Aparência do cardápio (08/10 · 3.25, no padrão do guia).
 * Logo, foto do topo, banners de promoção, modelo e cores. Tudo salva na hora, como antes.
 * Ícones do app no lugar dos emojis, letras legíveis, toques de 44px e as partes do PRO
 * num cinza calmo com "No PRO" (sem brilho piscando).
 */

export default function CardapioDesign({ identityCard, avaliacoesCard }: { identityCard?: React.ReactNode; avaliacoesCard?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  // (15/10) aberta por Configurações: o voltar leva de volta pra lá (senão, pro Cardápio)
  const voltarPara = (useLocation().state as any)?.de === "/configuracoes" ? "/configuracoes" : "/cardapio";
  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState(false); // (27/10) leitura falhou: não abre com o padrão (gravaria por cima do que ela tinha)
  const [tentativaCarga, setTentativaCarga] = useState(0);
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
  // (17/10) galeria de banners prontos (montada pela equipe no admin)
  const [galeria, setGaleria] = useState<{ aberta: boolean; lista: BannerPronto[] | null; erro: boolean; cat: string; slot: number }>({ aberta: false, lista: null, erro: false, cat: "", slot: 0 });
  const [usandoGaleria, setUsandoGaleria] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  // Avaliação (veio de Dados da loja em 29/09)
  const [hideStars, setHideStars] = useState(false);
  const [avaliacaoMedia, setAvaliacaoMedia] = useState(5.0);
  // (11/10) Grava no perfil conferindo o erro. Devolve true se gravou; se falhar, avisa e quem chamou desfaz a mudança da tela.
  const gravar = async (campos: Record<string, unknown>): Promise<boolean> => {
    if (!userId) return false;
    try {
      const { error } = await supabase.from("profiles").update(campos).eq("id", userId);
      if (error) throw error;
      return true;
    } catch (err) {
      avisar(explicarErro(err, "Não deu para salvar. Tente de novo."), { tipo: "erro" });
      return false;
    }
  };
  // (11/10) trava contra toque duplo: enquanto uma gravação está indo, o mesmo botão não dispara outra
  const travas = useRef(new Set<string>());
  const salvarAvaliacao = async (campos: { hide_stars?: boolean; avaliacao_media?: number }) => {
    if (!userId || travas.current.has("avaliacao")) return;
    travas.current.add("avaliacao");
    const ok = await gravar(campos);
    travas.current.delete("avaliacao");
    if (ok) showSuccess();
  };
  const [nomeLoja, setNomeLoja] = useState("");
  // (18/10) prévia do topo: cidade da loja (sem endereço, uma capital de exemplo) e o aberto/fechado
  const [cidade, setCidade] = useState("");
  // (30/10 · 5.46) o tema de Natal saiu do app (o cardápio fica sempre nas cores da loja)
  const [verTopo, setVerTopo] = useState(false);
  const [horario, setHorario] = useState<unknown>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [banner1Url, setBanner1Url] = useState("");
  const [banner2Url, setBanner2Url] = useState("");
  const [banner3Url, setBanner3Url] = useState("");
  const [bannerTopoUrl, setBannerTopoUrl] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const { isPro } = usePlano();
  // (18/10) Por enquanto só existe o Clássico (logo no canto direito). Novos modelos vêm depois.
  const modeloAtivoCalc = (_m: string) => "modelo1" as "modelo1" | "padrao";
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
      setErroCarga(false); setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErroCarga(true); setLoading(false); return; }
      setUserId(user.id);
      const { data, error: erroPerfil } = await supabase.from("profiles").select("logo_url, foto_url, nome_loja, banner_url, banner1_url, banner2_url, banner3_url, banner_topo_url, descricao_loja, endereco, horario, tema_cardapio, tema_aviso, tema_auto, tema_inicio, tema_fim, tema_capa_url, tema_laco, tema_destaque, cor_borda, cor_background, cor_nome, cor_botao, cor_navbar, cor_sacola, cor_rodape, cardapio_modelo, hide_stars, avaliacao_media").eq("id", user.id).single();
      if (erroPerfil || !data) { setErroCarga(true); setLoading(false); return; }
      if (data) {
        setLogoUrl(data.logo_url || ""); setFotoPerfil((data as any).foto_url || "");
        setHideStars(!!(data as any).hide_stars);
        setAvaliacaoMedia(Number((data as any).avaliacao_media) || 5.0);
        setNomeLoja(data.nome_loja || "");
        try { const e: any = typeof (data as any).endereco === "string" ? JSON.parse((data as any).endereco) : (data as any).endereco; setCidade(String(e?.cidade || "").trim()); } catch { setCidade(""); }
        setHorario((data as any).horario ?? null);
        setBannerUrl(data.banner_url || "");
        setBanner1Url(data.banner1_url || "");
        setBanner2Url(data.banner2_url || "");
        setBanner3Url(data.banner3_url || "");
        setBannerTopoUrl(data.banner_topo_url || "");
        setCorBorda((data.cor_borda || PADRAO.cor_borda).toUpperCase());
        setCorBackground(data.cor_background || "#FFF1F7");
        setCorNome((data.cor_nome || PADRAO.cor_nome).toUpperCase());
        setCorBotao((data.cor_botao || COR_BOTOES).toUpperCase());
        setCorNavbar((data.cor_navbar || PADRAO.cor_navbar).toUpperCase());
        setCorSacola(data.cor_sacola || "#FF6FA9");
        setCorRodape(data.cor_rodape || "#FF6FA9");
        // (11/10) as cores que estão no banco: é pra elas que a tela volta se uma gravação falhar
        coresSalvas.current = {
          cor_borda: data.cor_borda || "#FF6FA9",
          cor_nome: data.cor_nome || "#1f2937",
          cor_botao: data.cor_botao || "#FF6FA9",
          cor_navbar: data.cor_navbar || "#FF6FA9",
        };
        setCardapioModelo(data.cardapio_modelo || "modelo1");
      }
      setLoading(false);
    };
    load();
  }, [tentativaCarga]);

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
      // (11/10) a logo nova só aparece na tela depois de gravar no perfil
      if (await gravar({ logo_url: url })) {
        setLogoUrl(url);
        marcarDesignEscolhido(userId);
        showSuccess();
      }
    } else {
      avisar("Não deu para enviar a logo. Confira a internet e tente de novo.", { tipo: "erro" });
    }
    setUploading(null);
  };

  const handleBannerUpload = async (file: File, index: number) => {
    if (!userId) return;
    setUploading(`banner${index}`);
    const suffix = index === 0 ? "" : `-${index}`;
    const url = await uploadImage(file, `banners/${userId}${suffix}`);
    if (!url) avisar("Não deu para enviar a imagem. Confira a internet e tente de novo.", { tipo: "erro" });
    if (url) {
      const fields = [setBannerUrl, setBanner1Url, setBanner2Url, setBanner3Url];
      const keys = ["banner_url", "banner1_url", "banner2_url", "banner3_url"];
      // (11/10) o banner novo só aparece na tela depois de gravar no perfil
      if (await gravar({ [keys[index]]: url })) {
        fields[index](url);
        marcarDesignEscolhido(userId);
        showSuccess();
      }
    }
    setUploading(null);
  };

  const abrirGaleria = async () => {
    const vazio = (isPro ? [0, 1, 2, 3] : [0]).find(i => !bannerValues[i]);
    setGaleria(g => ({ ...g, aberta: true, slot: vazio ?? 0, cat: "" }));
    if (galeria.lista) return;
    const r = await lerBannersProntos();
    setGaleria(g => ({ ...g, lista: r.ok ? r.lista.filter(b => b.categoria !== CATEGORIA_CAPA_NATAL) : [], erro: !r.ok }));
  };
  const usarDaGaleria = async (b: BannerPronto) => {
    if (!userId || usandoGaleria) return;
    if (b.so_pro && !isPro) { avisar("Esse banner é do plano PRO.", { tipo: "info" }); return; }
    const i = galeria.slot;
    const fields = [setBannerUrl, setBanner1Url, setBanner2Url, setBanner3Url];
    const keys = ["banner_url", "banner1_url", "banner2_url", "banner3_url"];
    setUsandoGaleria(b.id);
    const ok = await gravar({ [keys[i]]: b.imagem_url });
    setUsandoGaleria(null);
    if (!ok) return;
    fields[i](b.imagem_url);
    marcarDesignEscolhido(userId);
    showSuccess();
    setGaleria(g => ({ ...g, aberta: false }));
    avisar(`Banner colocado no Banner ${i + 1}`, { tipo: "ok" });
  };

  const handleRemoveBanner = async (index: number) => {
    const chave = `tirar-banner${index}`;
    if (!userId || travas.current.has(chave)) return;
    travas.current.add(chave);
    const fields = [setBannerUrl, setBanner1Url, setBanner2Url, setBanner3Url];
    const keys = ["banner_url", "banner1_url", "banner2_url", "banner3_url"];
    const anterior = [bannerUrl, banner1Url, banner2Url, banner3Url][index];
    fields[index]("");
    const ok = await gravar({ [keys[index]]: null });
    travas.current.delete(chave);
    // (11/10) não gravou: o banner volta pra tela (ele continua no cardápio)
    if (!ok) fields[index](v => (v === "" ? anterior : v));
  };

  const handleBannerTopoUpload = async (file: File) => {
    if (!userId) return;
    setUploading("banner-topo");
    const url = await uploadImage(file, `banners/${userId}-topo`);
    if (!url) avisar("Não deu para enviar a imagem. Confira a internet e tente de novo.", { tipo: "erro" });
    if (url) {
      // (11/10) a foto nova só aparece na tela depois de gravar no perfil
      if (await gravar({ banner_topo_url: url })) {
        setBannerTopoUrl(url);
        marcarDesignEscolhido(userId);
        showSuccess();
      }
    }
    setUploading(null);
  };
  // 09/10: banners e foto do topo passam pelo recorte, já no formato em que aparecem no cardápio
  const recorteTopo = useRecorte(f => { void handleBannerTopoUpload(f); }, { aspect: 3, forma: "rect", titulo: "Ajustar a foto do topo", encaixar: true });
  const bannerIdx = useRef(0);
  const recorteBanner = useRecorte(f => { void handleBannerUpload(f, bannerIdx.current); }, { aspect: 16 / 9, forma: "rect", titulo: "Ajustar o banner", encaixar: true });
  const handleRemoveBannerTopo = async () => {
    if (!userId || travas.current.has("tirar-topo")) return;
    travas.current.add("tirar-topo");
    const anterior = bannerTopoUrl;
    setBannerTopoUrl("");
    const ok = await gravar({ banner_topo_url: null });
    travas.current.delete("tirar-topo");
    // (11/10) não gravou: a foto volta pra tela (ela continua no cardápio)
    if (!ok) setBannerTopoUrl(v => (v === "" ? anterior : v));
  };

  // (11/10) Cores: um temporizador por campo (antes era um só: mudar "Botões" e logo depois "Borda" perdia a primeira)
  // e só grava cor completa (#RRGGBB). Se a gravação falhar, a tela volta pra cor que está no banco.
  const COR_VALIDA = /^#[0-9a-fA-F]{6}$/;
  const colorSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const coresSalvas = useRef<Record<string, string>>({});
  // o que ela está digitando no campo do código (pode estar pela metade; não vai pra tela nem pro banco)
  const [hexDigitando, setHexDigitando] = useState<{ campo: string; texto: string } | null>(null);
  const handleColorChange = (field: string, value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (!COR_VALIDA.test(value)) return;
    setter(value);
    if (colorSaveTimers.current[field]) clearTimeout(colorSaveTimers.current[field]);
    colorSaveTimers.current[field] = setTimeout(async () => {
      delete colorSaveTimers.current[field];
      if (!userId) return;
      if (!(await gravar({ [field]: value }))) {
        const salva = coresSalvas.current[field];
        if (salva) setter(v => (v === value ? salva : v));
        return;
      }
      coresSalvas.current[field] = value;
      marcarDesignEscolhido(userId);
      showSuccess();
    }, 600);
  };
  // Campo do código: aceita digitar aos poucos e colar sem o "#" ("FF0000" vira "#FF0000"); só a cor completa vale
  const digitarHex = (campo: string, bruto: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const limpo = bruto.replace(/\s/g, "");
    const texto = limpo && !limpo.startsWith("#") ? `#${limpo}` : limpo;
    if (texto && !/^#[0-9a-fA-F]{0,6}$/.test(texto)) return;
    setHexDigitando({ campo, texto });
    handleColorChange(campo, texto, setter);
  };

  const bannerValues = [bannerUrl, banner1Url, banner2Url, banner3Url];

  // (18/10) só três cores, todas no topo da loja: faixa do topo, borda da logo e nome
  const itensCor: { campo: CampoCor; n: number; rotulo: string; apoio: string; valor: string; set: React.Dispatch<React.SetStateAction<string>> }[] = [
    { campo: "cor_navbar", n: 1, rotulo: "Faixa do topo", apoio: "Aparece quando não tem foto no topo", valor: corNavbar, set: setCorNavbar },
    { campo: "cor_borda", n: 2, rotulo: "Borda da logo", apoio: "O círculo em volta da logo", valor: corBorda, set: setCorBorda },
    { campo: "cor_nome", n: 3, rotulo: "Nome da loja", apoio: "A cor do nome embaixo do topo", valor: corNome, set: setCorNome },
  ];
  const corAtual = (campo: CampoCor, valor: string) => corDoItem(campo, valor, isPro);
  const iniciais = (nomeLoja || "ML").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "ML";

  const Cabeca = ({ Ic, titulo, apoio, acao }: { Ic: typeof Palette; titulo: string; apoio?: React.ReactNode; acao?: React.ReactNode }) => (
    <div className="ap-cab"><span className="ap-cab-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><Titulo apoio={apoio} acao={acao}>{titulo}</Titulo></div>
  );

  const escolherModelo = async (m: "modelo1" | "padrao") => {
    if (m === "padrao" && !isPro) { avisar("O modelo Premium é do plano PRO.", { tipo: "info", acao: { rotulo: "Ver o PRO", aoTocar: () => navigate("/assinar") } }); return; }
    if (!userId || salvandoModelo) return;
    setSalvandoModelo(true);
    const anterior = cardapioModelo;
    setCardapioModelo(m);
    const ok = await gravar({ cardapio_modelo: m });
    setSalvandoModelo(false);
    // (11/10) não gravou: volta pro modelo que estava
    if (!ok) { setCardapioModelo(anterior); return; }
    marcarDesignEscolhido(userId);
    showSuccess();
  };

  if (erroCarga) return (
    <>
      {!identityCard && <AppPageHeader title="Aparência" subtitle="Logo, banners e cores" onBack={() => navigate(voltarPara)} />}
      <TelaVazia icone={<Info size={30} />} titulo="Não deu para abrir a Aparência" texto="Confira a internet e tente de novo."
        acao={<Botao variante="suave" tamanho="m" onClick={() => setTentativaCarga(t => t + 1)}>Tentar de novo</Botao>} />
    </>
  );

  if (loading) return (
    <>
      {!identityCard && <AppPageHeader title="Aparência" subtitle="Logo, banners e cores" onBack={() => navigate(voltarPara)} />}
      <div className="ap-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
    </>
  );

  const modeloAtivo = modeloAtivoCalc(cardapioModelo);
  const ProSlot = ({ n }: { n: number }) => (
    <button type="button" className="ap-slot ap-slot--pro" onClick={() => avisar("Os banners 2 a 4 são do plano PRO.", { tipo: "info", acao: { rotulo: "Ver o PRO", aoTocar: () => navigate("/assinar") } })} aria-label={`Banners ${n} a 4, no plano PRO`}>
      <Lock size={20} weight="bold" aria-hidden="true" /><b>No PRO</b>
    </button>
  );

  return (
    <>
    {cropSrc && (
      <ImageCropper imageSrc={cropSrc} cropShape="round" aspect={1} onCancel={() => setCropSrc(null)} onCropDone={handleLogoCropDone} />
    )}
    {/* (11/10) fora da seção "Foto do topo": no modelo Premium ela não existe e o recorte do banner não abria */}
    {recorteTopo.janela}{recorteBanner.janela}
    {!identityCard && (
      <AppPageHeader title="Aparência" onBack={() => navigate(voltarPara)}
        infoIcon="🎨" infoComo={COMO_APARENCIA} infoTour={TOUR_APARENCIA}
        infoContent={<>
          <p>Aqui você deixa o <strong>cardápio com a cara da sua confeitaria</strong>: a logo, os banners de promoção e as cores.</p>
          <p>Tudo é salvo na hora e já aparece para os seus clientes. Toque em <strong>Ver como fica</strong> para conferir.</p>
        </>}
        infoTip={<>A primeira fileira de <strong>cores</strong> é grátis. As outras e o + são do plano PRO.</>}
      />
    )}
    {/* (28/10 · 4.61) no computador, duas colunas: à esquerda o que é visual (topo e banners),
        à direita as escolhas pequenas (tema, link e cores). No celular, um embaixo do outro, na mesma ordem de antes. */}
    <div className="ap ap--2col">
      {/* (30/10 · 5.56) banner de abertura da tela, no topo, antes de tudo */}
      {!identityCard && <div className="ap-banner-topo"><img src={bannerAparencia} alt="Personalize sua loja e encante seus clientes! Uma loja com a sua cara vende mais." width={2172} height={724} /></div>}
      {/* (30/10 · 5.57) logo e foto do topo numa faixa da largura do banner, metade cada. (5.52) a logo e a foto do topo em cartões separados, com campos grandes de escolher a imagem (igual aos banners) */}
        <input ref={logoRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
        <input ref={bannerTopoRef} type="file" accept="image/*" hidden onChange={recorteTopo.escolher} />
      <div className="ap-par">
      <section className="ap-card ap-sec-logo">
        <Cabeca Ic={Storefront} titulo="Logo" apoio="No topo" />
        {(logoUrl || fotoPerfil) ? (
          <div className="ap-img ap-img--logo">
            <span className="ap-logo-circ" style={{ borderColor: corAtual("cor_borda", corBorda) }}>{uploading === "logo" ? <span className="ui-gira" aria-label="Enviando" /> : <img src={logoUrl || fotoPerfil} alt="Logo da loja" />}</span>
            <div className="ap-img-acoes">
              <button type="button" className="ap-chip" disabled={!!uploading} onClick={() => logoRef.current?.click()}><ArrowsClockwise size={16} weight="bold" />Trocar</button>
            </div>
          </div>
        ) : (
          <button type="button" className="ap-enviar ap-slot ap-slot--logo" onClick={() => !uploading && logoRef.current?.click()} disabled={!!uploading}>
            {uploading === "logo" ? <span className="ui-gira" aria-label="Enviando" /> : <><Plus size={20} weight="bold" /><b>Adicionar logo</b><small>Quadrada</small></>}
          </button>
        )}
      </section>

      <section className="ap-card ap-sec-topo">
        <Cabeca Ic={ImageIcon} titulo="Foto do topo" apoio="Atrás do nome"
          acao={<Botao variante="secundario" tamanho="p" icone={<Eye size={16} weight="bold" />} onClick={() => setVerTopo(true)}>Ver como fica</Botao>} />
        {bannerTopoUrl ? (
          <div className="ap-img ap-img--topo" style={{ "--ap-fundo": `url("${bannerTopoUrl}")` } as React.CSSProperties}>
            <img src={bannerTopoUrl} alt="Foto do topo" />
            {uploading === "banner-topo" && <span className="ap-topo-gira"><span className="ui-gira" aria-label="Enviando" /></span>}
            <div className="ap-img-acoes">
              <button type="button" className="ap-chip" disabled={!!uploading} onClick={() => bannerTopoRef.current?.click()}><ArrowsClockwise size={16} weight="bold" />Trocar</button>
              <BotaoIcone rotulo="Tirar a foto do topo" variante="neutro" tamanho="p" className="ap-tirar" onClick={handleRemoveBannerTopo}><X size={18} weight="bold" /></BotaoIcone>
            </div>
          </div>
        ) : (
          <button type="button" className="ap-enviar ap-slot ap-slot--topo" onClick={() => !uploading && bannerTopoRef.current?.click()} disabled={!!uploading}>
            {uploading === "banner-topo" ? <span className="ui-gira" aria-label="Enviando" /> : <><Plus size={20} weight="bold" /><b>Adicionar foto do topo</b><small>Deitada, 1200 × 400 · sem foto, fica a cor da faixa</small></>}
          </button>
        )}
      </section>
      </div>

      <div className="ap-col ap-col-esq">


      {/* Banners de promoção */}
      <section className="ap-card ap-largo ap-sec-banners">
        <Cabeca Ic={Images} titulo="Banners de promoção" apoio={isPro ? "Até 4, passando sozinhos" : "1 banner no plano grátis"} />
        <p className="ap-exp">Aparecem logo abaixo do topo do cardápio. Use para <b>promoções e datas especiais</b>. Imagem deitada, <b>1200 × 675</b>, com o texto no meio. <button type="button" className="ap-exp-lk" onClick={() => setVerExemplo(true)}>Ver um exemplo</button></p>
        <div className="ap-banners">
          {(isPro ? [0, 1, 2, 3] : [0]).map(i => (
            <div key={i} className="ap-banner">
              <span className="ap-banner-r">Banner {i + 1}</span>
              {bannerValues[i] ? (
                <div className="ap-img ap-img--banner" style={{ "--ap-fundo": `url("${bannerValues[i]}")` } as React.CSSProperties}>
                  <img src={bannerValues[i]} alt={`Banner ${i + 1}`} />
                  <div className="ap-img-acoes">
                    <button type="button" className="ap-chip" onClick={() => bannerRefs[i].current?.click()}><ArrowsClockwise size={16} weight="bold" />Trocar</button>
                    <BotaoIcone rotulo={`Tirar o banner ${i + 1}`} variante="neutro" tamanho="p" className="ap-tirar" onClick={() => handleRemoveBanner(i)}><X size={18} weight="bold" /></BotaoIcone>
                  </div>
                </div>
              ) : (
                <button type="button" className="ap-enviar ap-slot" onClick={() => !uploading && bannerRefs[i].current?.click()} disabled={!!uploading}>
                  {uploading === `banner${i}` ? <span className="ui-gira" aria-label="Enviando" /> : <><Plus size={20} weight="bold" /><b>Adicionar</b><small>Do celular</small></>}
                </button>
              )}
              <input ref={bannerRefs[i]} type="file" accept="image/*" hidden onChange={e => { bannerIdx.current = i; recorteBanner.escolher(e); }} />
            </div>
          ))}
          {!isPro && <div className="ap-banner"><span className="ap-banner-r">Banners 2 a 4</span><ProSlot n={2} /></div>}
        </div>
        <Botao variante="secundario" cheio icone={<Sparkle size={18} weight="bold" />} onClick={abrirGaleria}>Usar um banner pronto</Botao>
      </section>

      {identityCard && <div className="ap-ident">{identityCard}</div>}

      {/* (18/10) Modelo do cardápio oculto: só o Clássico por enquanto */}
      {false && (
      <section className="ap-card ap-largo ap-sec-modelo">
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
      )}



      <section className="ap-card ap-largo ap-sec-link">
        <Cabeca Ic={LinkSimple} titulo="Link do cardápio" apoio="O endereço da sua loja" />
        <p className="ap-exp">É por esse link que a cliente abre o seu cardápio. Com o <b>nome da loja no fim</b>, ele fica mais fácil de lembrar e passa mais confiança no Instagram e no WhatsApp. Ao mudar, o link antigo continua funcionando.</p>
        <NomeNoLink />
      </section>
      </div>
      <div className="ap-col ap-col-dir">
      {/* Cores (18/10): só as três do topo da loja. Grátis: cores prontas; PRO: qualquer cor */}
      <section className={`ap-card ap-largo ap-sec-cores`}>
        <Cabeca Ic={Palette} titulo="Cores do topo" apoio="Faixa, borda da logo e nome da loja" />
        {itensCor.map(it => {
          const atual = corAtual(it.campo, it.valor);
          const aberta = activePicker === it.campo;
          const pronta = [...PRONTAS[it.campo], ...PRONTAS_PRO[it.campo]].some(p => p.cor === atual);
          return (
            <div key={it.campo} className="ap-cgrupo">
              <div className="ap-crot"><span className="ap-crot-tx"><b>{it.rotulo}</b><small>{it.apoio}</small></span><i className="ap-crot-cor" style={{ background: atual }} aria-hidden="true" /></div>
              <div className="ap-prontas" role="radiogroup" aria-label={it.rotulo}>
                {/* (30/10 · 5.24) 4 cores de graça numa linha; na de baixo, as 4 do PRO (no grátis com cadeado) e o "+" */}
                {(isPro ? (["gratis", "pro"] as const) : (["gratis"] as const)).map(grupo => (
                  <div key={grupo} className={`ap-prontas-l${grupo === "pro" ? " ap-prontas-l--pro" : ""}`}>

                    {(grupo === "gratis" ? PRONTAS : PRONTAS_PRO)[it.campo].map(p => {
                      const on = atual === p.cor;
                      const travada = grupo === "pro" && !isPro;
                      return (
                        <button key={p.cor} type="button" role="radio" aria-checked={on} aria-label={travada ? `${p.nome}, no plano PRO` : p.nome} title={p.nome}
                          className={`${on ? "on" : ""}${travada ? " ap-cor-pro" : ""}`} style={{ background: p.cor }}
                          onClick={() => {
                            if (travada) { avisar(`A cor ${p.nome.toLowerCase()} é do plano PRO.`, { tipo: "info", acao: { rotulo: "Ver o PRO", aoTocar: () => navigate("/assinar") } }); return; }
                            setActivePicker(null); handleColorChange(it.campo, p.cor, it.set);
                          }}>
                          {on ? <Check size={16} weight="bold" aria-hidden="true" /> : travada ? <Lock size={12} weight="bold" aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                    {grupo === "pro" && (isPro ? (
                  <button type="button" className={`ap-outra${!pronta ? " on" : ""}`} aria-label="Outra cor" aria-expanded={aberta} style={!pronta ? { background: atual } : undefined}
                    onClick={() => setActivePicker(aberta ? null : it.campo)}><Plus size={16} weight="bold" aria-hidden="true" /></button>
                ) : (
                  <button type="button" className="ap-outra ap-outra--pro" aria-label="Outra cor, no plano PRO"
                    onClick={() => avisar("Qualquer outra cor é do plano PRO.", { tipo: "info", acao: { rotulo: "Ver o PRO", aoTocar: () => navigate("/assinar") } })}><Lock size={14} weight="bold" aria-hidden="true" /></button>
                    ))}
                  </div>
                ))}
              </div>
              {isPro && aberta && (
                <div className="ap-picker">
                  <HexColorPicker color={it.valor} onChange={v => { setHexDigitando(null); handleColorChange(it.campo, v, it.set); }} style={{ width: "100%", height: 168 }} />
                  <div className="ap-picker-pe">
                    <div className="ui-campo-c ap-hex"><input aria-label="Código da cor" maxLength={9}
                      value={hexDigitando?.campo === it.campo ? hexDigitando.texto : it.valor}
                      onChange={e => digitarHex(it.campo, e.target.value, it.set)}
                      onBlur={() => setHexDigitando(null)} /></div>
                    <BotaoIcone rotulo="Voltar para cor padrão" variante="neutro" onClick={() => { setHexDigitando(null); handleColorChange(it.campo, PADRAO[it.campo], it.set); }}><ArrowCounterClockwise size={20} weight="bold" /></BotaoIcone>
                    <Botao variante="suave" tamanho="m" onClick={() => setActivePicker(null)}>Pronto</Botao>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {/* (30/10 · 5.25) no grátis: só as 4 cores de cada lugar e um botão só no fim (antes as do PRO apareciam com cadeado) */}
        {!isPro && (
          <button type="button" className="ap-mais-cores" onClick={() => navigate("/assinar")}>
            <Crown size={16} weight="fill" aria-hidden="true" />Desbloquear mais cores<span>PRO</span>
          </button>
        )}
      </section>

      {/* (27/10) nome da loja no link (PRO) · (30/10 · 5.53) embaixo das cores */}

      </div>


      {/* (17/10) galeria de banners prontos */}
      <Janela aberta={galeria.aberta} aoFechar={() => setGaleria(g => ({ ...g, aberta: false }))} tipo="conteudo" titulo="Banners prontos"
        acoes={<Botao variante="secundario" cheio onClick={() => setGaleria(g => ({ ...g, aberta: false }))}>Fechar</Botao>} umaAcao>
        {isPro && (
          <div className="ap-gal-slots" role="radiogroup" aria-label="Onde colocar">
            <span>Colocar no</span>
            {[0, 1, 2, 3].map(i => (
              <button key={i} type="button" role="radio" aria-checked={galeria.slot === i} className={galeria.slot === i ? "on" : ""} onClick={() => setGaleria(g => ({ ...g, slot: i }))}>Banner {i + 1}</button>
            ))}
          </div>
        )}
        {galeria.lista === null ? (
          <div className="ap-gal-vazio"><span className="ui-gira" aria-label="Carregando" /></div>
        ) : galeria.erro || galeria.lista.length === 0 ? (
          <p className="ap-gal-vazio">{galeria.erro ? "Não deu para abrir a galeria agora. Tente de novo." : "Ainda não há banners prontos. Em breve teremos novidades."}</p>
        ) : (() => {
          const cats = CATEGORIAS_BANNER.filter(c => galeria.lista!.some(b => b.categoria === c));
          const lista = galeria.lista!.filter(b => !galeria.cat || b.categoria === galeria.cat);
          return (
            <>
              {cats.length > 1 && (
                <div className="ap-gal-cats" role="group" aria-label="Categorias">
                  <button type="button" aria-pressed={!galeria.cat} onClick={() => setGaleria(g => ({ ...g, cat: "" }))}>Todos</button>
                  {cats.map(c => <button key={c} type="button" aria-pressed={galeria.cat === c} onClick={() => setGaleria(g => ({ ...g, cat: c }))}>{c}</button>)}
                </div>
              )}
              <div className="ap-gal-lista">
                {lista.map(b => {
                  const bloqueado = b.so_pro && !isPro;
                  return (
                    <button key={b.id} type="button" className={`ap-gal-it${bloqueado ? " bloq" : ""}`} onClick={() => usarDaGaleria(b)} disabled={!!usandoGaleria}>
                      <img src={b.imagem_url} alt={b.titulo} loading="lazy" />
                      {bloqueado && <span className="ap-gal-pro"><Crown size={13} weight="fill" aria-hidden="true" />PRO</span>}
                      {usandoGaleria === b.id && <span className="ap-gal-gira"><span className="ui-gira" aria-label="Salvando" /></span>}
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}
      </Janela>


      {/* (30/10 · 5.46) "Ver como fica": o topo do cardápio do jeito que o cliente vê (foto, logo e as cores escolhidas) */}
      <Janela aberta={verTopo} aoFechar={() => setVerTopo(false)} tipo="conteudo" titulo="Assim fica o topo do cardápio"
        acoes={<Botao variante="secundario" onClick={() => setVerTopo(false)}>Fechar</Botao>} umaAcao>
        <div className="ap-ver-previa">
        <div className="ap-topo">
          {/* (18/10) a faixa não é clicável: quem troca a foto é o botão de baixo */}
          <div className={`ap-topo-capa${bannerTopoUrl ? " ap-topo-capa--foto" : " ap-topo-capa--vazia"}`} style={bannerTopoUrl ? undefined : { backgroundColor: topoEscurecido(corAtual("cor_navbar", corNavbar)) }}>
            {bannerTopoUrl ? <img className="ap-topo-capa-img" src={bannerTopoUrl} alt="" /> : <span className="ap-topo-pill"><ImageIcon size={16} weight="bold" aria-hidden="true" />Foto do topo · 1200 × 400</span>}
            {bannerTopoUrl && <BotaoIcone rotulo="Tirar a foto do topo" variante="neutro" tamanho="p" className="ap-tirar ap-topo-x" onClick={handleRemoveBannerTopo}><X size={18} weight="bold" /></BotaoIcone>}
            {(() => { const sit = situacaoLoja(horario as any); const aberto = !sit || sit.aberto; return (
              <span className={`ap-topo-st${aberto ? " aberto" : ""}`}><i aria-hidden="true" />{aberto ? "Aberto agora" : "Fechado"}</span>
            ); })()}
            {uploading === "banner-topo" && <span className="ap-topo-gira"><span className="ui-gira" aria-label="Enviando" /></span>}
          </div>
          <div className="ap-topo-corpo">
            <button type="button" className="ap-topo-logo" style={{ borderColor: corAtual("cor_borda", corBorda) }} onClick={() => !uploading && logoRef.current?.click()} aria-label={logoUrl ? "Trocar a logo" : "Enviar a logo"}>
              {uploading === "logo" ? <span className="ui-gira" aria-label="Enviando" />
                : (logoUrl || fotoPerfil) ? <img src={logoUrl || fotoPerfil} alt="" /> : <b>{(nomeLoja || "?").trim().charAt(0).toUpperCase()}</b>}
              <i aria-hidden="true"><Camera size={12} weight="bold" /></i>
            </button>
            <b className="ap-topo-nome"><span style={{ color: corAtual("cor_nome", corNome) }}>{nomeLoja || "Nome da sua loja"}</span>{isPro && <SeloVerificado tamanho={18} />}</b>
            <span className="ap-topo-sl"><b style={{ color: COR_BOTOES }}>Sobre a loja</b><em aria-hidden="true">·</em><MapPin size={14} weight="bold" color={COR_BOTOES} aria-hidden="true" /><span>{cidade || "São Paulo"}</span></span>
          </div>
        </div>
        </div>
      </Janela>

      <Janela aberta={verExemplo} aoFechar={() => setVerExemplo(false)} tipo="conteudo" titulo="Exemplo de banner"
        acoes={<Botao variante="secundario" cheio onClick={() => setVerExemplo(false)}>Fechar</Botao>} umaAcao>
        <img className="ap-ex" src="/exemplo-banner.jpg" alt="Exemplo de banner: Semana do Brigadeiro, 20% de desconto em todos os kits" />
        <p className="ap-ex-tx">1200 × 675, deitado. Deixe o texto no meio da imagem.</p>
      </Janela>
    </div>
    </>
  );
}
