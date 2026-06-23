import { useState, useEffect, useRef } from "react";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { supabase } from "@/lib/supabase";
import CardapioDesign from "@/pages/CardapioDesign";
import CheckoutConfigPage from "@/pages/CheckoutConfigPage";

const SectionLabel = ({ children, icon, sub }: any) => (
  <div className="ccc-section-header">
    {icon && <div className="ccc-section-icon">{icon}</div>}
    <div style={{ flex: 1, minWidth: 0 }}>
      <p className="ccc-section-label">{children}</p>
      {sub && <p className="ccc-section-sub">{sub}</p>}
    </div>
  </div>
);

const Field = ({ icon, placeholder, value, onChange, type = "text" }: any) => (
  <div className="ccc-field">
    <span className="ccc-field-icon">{icon}</span>
    <input className="ccc-field-input" type={type} placeholder={placeholder} value={value} onChange={onChange} />
  </div>
);

const DIAS = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];

export default function CardapioConfigPage() {
  const [activeTab, setActiveTab] = useState<"geral"|"design"|"checkout">("geral");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepPreenchido, setCepPreenchido] = useState(false);
  const [gerandoDescricao, setGerandoDescricao] = useState(false);

  const [horario, setHorario] = useState({
    dias: ["Segunda","Terça","Quarta","Quinta","Sexta"] as string[],
    abertura: "08:00", fechamento: "18:00",
    abre_sabado: false, sabado_abertura: "09:00", sabado_fechamento: "14:00",
    abre_domingo: false, domingo_abertura: "09:00", domingo_fechamento: "14:00"
  });

  const [form, setForm] = useState({
    nome_loja: "", telefone: "", foto_url: "", descricao_loja: "",
    hide_stars: false, avaliacao_media: 5.0,
    cep: "", rua: "", numero: "", bairro: "", cidade: "", estado: "",
    mostrar_localizacao: false, mostrar_apenas_cidade: false,
    faz_entrega: false, taxa_entrega: "", pedido_minimo: "",
    entrega_gratis_acima: "", horario_entrega: "", area_entrega: "", observacoes_entrega: "",
  });

  const fileRef = useRef<HTMLInputElement>(null);

  const [autoSaved, setAutoSaved] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save com debounce de 2 segundos
  useEffect(() => {
    if (loading) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      if (!userId) return;
      const endereco = JSON.stringify({ cep: form.cep, rua: form.rua, numero: form.numero, bairro: form.bairro, cidade: form.cidade, estado: form.estado });
      await supabase.from("profiles").update({
        nome_loja: form.nome_loja, telefone: form.telefone,
        foto_url: form.foto_url, descricao_loja: form.descricao_loja,
        hide_stars: form.hide_stars, avaliacao_media: form.avaliacao_media,
        endereco, mostrar_localizacao: form.mostrar_localizacao,
        mostrar_apenas_cidade: form.mostrar_apenas_cidade,
        faz_entrega: form.faz_entrega,
        taxa_entrega: form.taxa_entrega ? parseFloat(form.taxa_entrega) : null,
        entrega_gratis_acima: form.entrega_gratis_acima ? parseFloat(form.entrega_gratis_acima) : null,
        pedido_minimo: form.pedido_minimo ? parseFloat(form.pedido_minimo) : null,
        horario_entrega: form.horario_entrega, area_entrega: form.area_entrega,
        observacoes_entrega: form.observacoes_entrega,
        horario: JSON.stringify(horario),
      }).eq("id", userId);
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 2000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [form, horario]);

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 3) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles")
        .select("nome_loja, telefone, foto_url, descricao_loja, hide_stars, avaliacao_media, endereco, mostrar_localizacao, mostrar_apenas_cidade, faz_entrega, taxa_entrega, pedido_minimo, entrega_gratis_acima, horario_entrega, area_entrega, observacoes_entrega, horario")
        .eq("id", user.id).single();
      if (data) {
        let addr: any = {};
        try { addr = data.endereco ? JSON.parse(data.endereco) : {}; } catch {}
        setForm({
          nome_loja: data.nome_loja || "", telefone: formatPhone(data.telefone || ""),
          foto_url: data.foto_url || "", descricao_loja: data.descricao_loja || "",
          hide_stars: data.hide_stars || false, avaliacao_media: data.avaliacao_media || 5.0,
          cep: addr.cep || "", rua: addr.rua || "", numero: addr.numero || "",
          bairro: addr.bairro || "", cidade: addr.cidade || "", estado: addr.estado || "",
          mostrar_localizacao: data.mostrar_localizacao || false,
          mostrar_apenas_cidade: data.mostrar_apenas_cidade || false,
          faz_entrega: data.faz_entrega || false,
          taxa_entrega: data.taxa_entrega ? data.taxa_entrega.toString() : "",
          pedido_minimo: data.pedido_minimo ? data.pedido_minimo.toString() : "",
          entrega_gratis_acima: data.entrega_gratis_acima ? data.entrega_gratis_acima.toString() : "",
          horario_entrega: data.horario_entrega || "",
          area_entrega: data.area_entrega || "",
          observacoes_entrega: data.observacoes_entrega || "",
        });
        if (data.foto_url) setPreview(data.foto_url);
        if (addr.cep) setCepPreenchido(true);
        if (data.horario) { try { setHorario(h => ({ ...h, ...JSON.parse(data.horario) })); } catch {} }
      }
      setLoading(false);
    };
    load();
  }, []);

  const buscarCep = async (cep: string) => {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(f => ({ ...f, rua: data.logradouro || f.rua, bairro: data.bairro || f.bairro, cidade: data.localidade || f.cidade, estado: data.uf || f.estado }));
        setCepPreenchido(true);
      }
    } catch {}
    setBuscandoCep(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropDone = async (blob: Blob) => {
    if (!userId) return;
    setCropSrc(null);
    setUploading(true);
    const path = `avatars/${userId}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("profiles").upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => ({ ...f, foto_url: publicUrl }));
      setPreview(publicUrl);
    }
    setUploading(false);
  };

  const gerarDescricaoLoja = async () => {
    if (!form.nome_loja.trim()) return alert("Digite o nome da loja primeiro.");
    setGerandoDescricao(true);
    try {
      const response = await fetch("/api/gerar-descricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Crie uma descrição curta e atraente para uma confeitaria chamada "${form.nome_loja}". Máximo 150 caracteres, português brasileiro, transmita carinho e qualidade. Retorne APENAS a descrição, sem aspas.`
        })
      });
      const data = await response.json();
      const desc = data.content?.[0]?.text?.trim();
      if (desc) setForm(f => ({ ...f, descricao_loja: desc }));
    } catch { alert("Erro ao gerar descrição."); }
    setGerandoDescricao(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const endereco = JSON.stringify({ cep: form.cep, rua: form.rua, numero: form.numero, bairro: form.bairro, cidade: form.cidade, estado: form.estado });
    await supabase.from("profiles").update({
      nome_loja: form.nome_loja, telefone: form.telefone,
      foto_url: form.foto_url, descricao_loja: form.descricao_loja,
      hide_stars: form.hide_stars, avaliacao_media: form.avaliacao_media,
      endereco, mostrar_localizacao: form.mostrar_localizacao,
      mostrar_apenas_cidade: form.mostrar_apenas_cidade,
      faz_entrega: form.faz_entrega,
      taxa_entrega: form.taxa_entrega ? parseFloat(form.taxa_entrega) : null,
      pedido_minimo: form.pedido_minimo ? parseFloat(form.pedido_minimo) : null,
      entrega_gratis_acima: form.entrega_gratis_acima ? parseFloat(form.entrega_gratis_acima) : null,
      horario_entrega: form.horario_entrega, area_entrega: form.area_entrega,
      observacoes_entrega: form.observacoes_entrega,
      horario: JSON.stringify(horario),
    }).eq("id", userId);
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"40vh"}}>
      <span className="ccc-spinner-lg" />
      <style>{`@keyframes ccspin{to{transform:rotate(360deg)}} .ccc-spinner-lg{width:32px;height:32px;border:3px solid var(--primary-light, #FFF1F7);border-top-color:var(--primary, #FF6FA9);border-radius:50%;animation:ccspin 0.7s linear infinite;display:inline-block;}`}</style>
    </div>
  );

  return (
    <>
    {cropSrc && (
      <ImageCropper
        imageSrc={cropSrc}
        cropShape="round"
        aspect={1}
        onCancel={() => setCropSrc(null)}
        onCropDone={handleCropDone}
      />
    )}
    <div className="ccc-outer">
    <div className="ccc-root">

      {/* Cabeçalho */}
      <div className="ccc-page-header">
        <div>
          <h1 className="ccc-page-title">Cardápio Digital</h1>
          <p className="ccc-page-sub">Deixe seu cardápio com a cara da sua confeitaria</p>
        </div>
        {autoSaved && activeTab === "geral" && <span className="ccc-autosave">✓ Salvo automaticamente</span>}
      </div>

      {/* ── Tabs ── */}
      <div className="ccc-tabs">
        <button className={`ccc-tab${activeTab==="geral"?" ccc-tab--active":""}`} onClick={()=>setActiveTab("geral")}>
          Geral
        </button>
        <button className={`ccc-tab${activeTab==="design"?" ccc-tab--active":""}`} onClick={()=>setActiveTab("design")}>
          Design
        </button>
        <button className={`ccc-tab${activeTab==="checkout"?" ccc-tab--active":""}`} onClick={()=>setActiveTab("checkout")}>
          Checkout
        </button>
      </div>

      {/* ── Tab Design ── */}
      {activeTab === "design" && <CardapioDesign />}

      {/* ── Tab Checkout ── */}
      {activeTab === "checkout" && <CheckoutConfigPage />}

      {/* ── Tab Geral ── */}
      {activeTab === "geral" && <>

      {/* LINHA 1: 4 cards */}
      <div className="ccc-row-top">

        {/* Card 1 — Identidade */}
        <div className="ccc-card">
          <SectionLabel
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-7L9 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>}
            sub="Logo, nome e descrição da sua confeitaria"
          >Identidade da loja</SectionLabel>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFileChange} />

          <div className="ccc-logo-row">
            <div className="ccc-logo-preview" onClick={() => fileRef.current?.click()}>
              {preview || form.foto_url
                ? <img src={preview || form.foto_url} alt="Logo" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #FF6FA9)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              }
              <div className="ccc-logo-cam">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p className="ccc-logo-label">Logo da loja</p>
              <p className="ccc-logo-sub">Aparece no topo do cardápio</p>
              <button
                style={{marginTop:"0.5rem",padding:"0.3rem 0.85rem",background:"var(--primary-light, #FFF1F7)",border:"1.5px solid var(--primary-light, #FFF1F7)",borderRadius:"50px",fontFamily:"Geist,sans-serif",fontSize:"0.75rem",fontWeight:700,color:"var(--primary-dark, #F85A9A)",cursor:"pointer"}}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <span className="ccc-spinner-xs" /> : "Trocar foto"}
              </button>
            </div>
          </div>

          <Field
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
            placeholder="Nome da loja" value={form.nome_loja}
            onChange={(e: any) => setForm({...form, nome_loja: e.target.value})}
          />
          <Field
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>}
            placeholder="WhatsApp" value={form.telefone} type="tel"
            onChange={(e: any) => setForm({...form, telefone: formatPhone(e.target.value)})}
          />
          <div className="ccc-field" style={{alignItems:"flex-start",borderRadius:"10px",padding:"0.75rem 1rem"}}>
            <span className="ccc-field-icon" style={{marginTop:"0.15rem"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:"0.4rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:"0.75rem",color:"var(--text-muted, #9CA3AF)"}}>Descrição</span>
                <button type="button" className="ccc-btn-ia" onClick={gerarDescricaoLoja} disabled={gerandoDescricao || !form.nome_loja.trim()}>
                  {gerandoDescricao
                    ? <><span className="ccc-spinner-ia" /> Gerando...</>
                    : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Gerar com IA</>
                  }
                </button>
              </div>
              <textarea
                className="ccc-field-input"
                placeholder="Descreva sua confeitaria..."
                value={form.descricao_loja}
                onChange={e => setForm({...form, descricao_loja: e.target.value.slice(0,200)})}
                rows={3}
                style={{resize:"none"}}
              />
              <p className="ccc-char-count">{form.descricao_loja.length}/200</p>
            </div>
          </div>
        </div>

        {/* Card 2 — Localização */}
        <div className="ccc-card">
          <SectionLabel
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
            sub="Onde sua confeitaria está localizada"
          >Localização da loja</SectionLabel>

          <div className="ccc-field">
            <span className="ccc-field-icon">
              {buscandoCep
                ? <span className="ccc-spinner-xs" style={{borderColor:"var(--primary-light, #FFF1F7)",borderTopColor:"var(--primary, #FF6FA9)"}} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
            </span>
            <input className="ccc-field-input" placeholder="CEP (opcional)" value={form.cep}
              onChange={e => {
                const d = e.target.value.replace(/\D/g,"").slice(0,8);
                const fmt = d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d;
                setForm({...form, cep: fmt});
                if (d.length < 8) setCepPreenchido(false);
                if (d.length === 8) buscarCep(d);
              }}
            />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 80px",gap:"0.5rem"}}>
            <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>}
              placeholder="Rua / Avenida" value={form.rua} onChange={(e: any) => setForm({...form, rua: e.target.value})} />
            <div className="ccc-field"><input className="ccc-field-input" placeholder="Nº" value={form.numero} onChange={(e: any) => setForm({...form, numero: e.target.value})} /></div>
          </div>
          <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>}
            placeholder="Bairro" value={form.bairro} onChange={(e: any) => setForm({...form, bairro: e.target.value})} />
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 90px",gap:"0.5rem"}}>
            <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg>}
              placeholder="Cidade" value={form.cidade} onChange={(e: any) => setForm({...form, cidade: e.target.value})} />
            <div className="ccc-field"><input className="ccc-field-input" placeholder="UF" value={form.estado} onChange={(e: any) => setForm({...form, estado: e.target.value.toUpperCase()})} maxLength={2} /></div>
          </div>
          {cepPreenchido && <p className="ccc-cep-hint">Preenchido automaticamente. <span onClick={() => setCepPreenchido(false)} style={{color:"var(--primary, #FF6FA9)",cursor:"pointer",fontWeight:600}}>Editar manual</span></p>}
          <div className="ccc-divider" />
          <div className="ccc-toggle-row">
            <div><p className="ccc-toggle-label">Mostrar localização completa</p><p className="ccc-toggle-sub">Exibe rua, bairro e cidade no cardápio</p></div>
            <label className="ccc-toggle"><input type="checkbox" checked={form.mostrar_localizacao} onChange={e => setForm({...form, mostrar_localizacao: e.target.checked, mostrar_apenas_cidade: e.target.checked ? false : form.mostrar_apenas_cidade})} /><span className="ccc-toggle-slider" /></label>
          </div>
          <div className="ccc-toggle-row">
            <div><p className="ccc-toggle-label">Mostrar apenas cidade</p><p className="ccc-toggle-sub">Exibe somente a cidade no cardápio</p></div>
            <label className="ccc-toggle"><input type="checkbox" checked={form.mostrar_apenas_cidade} onChange={e => setForm({...form, mostrar_apenas_cidade: e.target.checked, mostrar_localizacao: e.target.checked ? false : form.mostrar_localizacao})} /><span className="ccc-toggle-slider" /></label>
          </div>
        </div>

        {/* Card 3 — Horários */}
        <div className="ccc-card">
          <SectionLabel
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            sub="Quando você está disponível"
          >Horários de funcionamento</SectionLabel>
          <div className="ccc-dias-grid">
            {["Segunda","Terça","Quarta","Quinta","Sexta"].map(dia => (
              <button key={dia} className={`ccc-dia-btn${horario.dias.includes(dia) ? " active" : ""}`} onClick={() => setHorario(h => ({...h, dias: h.dias.includes(dia) ? h.dias.filter(d => d !== dia) : [...h.dias, dia]}))}>
                {dia.slice(0,3)}
              </button>
            ))}
          </div>
          <div className="ccc-row-2">
            <div className="ccc-time-field"><label>Abertura</label><input type="time" value={horario.abertura} onChange={e => setHorario({...horario, abertura: e.target.value})} /></div>
            <div className="ccc-time-field"><label>Fechamento</label><input type="time" value={horario.fechamento} onChange={e => setHorario({...horario, fechamento: e.target.value})} /></div>
          </div>
          <div className="ccc-divider" />
          <div className="ccc-toggle-row">
            <p className="ccc-toggle-label">Abre Sábado?</p>
            <label className="ccc-toggle"><input type="checkbox" checked={horario.abre_sabado} onChange={e => setHorario({...horario, abre_sabado: e.target.checked})} /><span className="ccc-toggle-slider" /></label>
          </div>
          {horario.abre_sabado && (
            <div className="ccc-row-2">
              <div className="ccc-time-field"><label>Abertura (sáb)</label><input type="time" value={horario.sabado_abertura} onChange={e => setHorario({...horario, sabado_abertura: e.target.value})} /></div>
              <div className="ccc-time-field"><label>Fechamento (sáb)</label><input type="time" value={horario.sabado_fechamento} onChange={e => setHorario({...horario, sabado_fechamento: e.target.value})} /></div>
            </div>
          )}
          <div className="ccc-toggle-row">
            <p className="ccc-toggle-label">Abre Domingo?</p>
            <label className="ccc-toggle"><input type="checkbox" checked={horario.abre_domingo} onChange={e => setHorario({...horario, abre_domingo: e.target.checked})} /><span className="ccc-toggle-slider" /></label>
          </div>
          {horario.abre_domingo && (
            <div className="ccc-row-2">
              <div className="ccc-time-field"><label>Abertura (dom)</label><input type="time" value={horario.domingo_abertura} onChange={e => setHorario({...horario, domingo_abertura: e.target.value})} /></div>
              <div className="ccc-time-field"><label>Fechamento (dom)</label><input type="time" value={horario.domingo_fechamento} onChange={e => setHorario({...horario, domingo_fechamento: e.target.value})} /></div>
            </div>
          )}
        </div>

        {/* Card 4 — Avaliações */}
        <div className="ccc-card">
          <SectionLabel
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
            sub="Como sua nota aparece para os clientes"
          >Avaliações</SectionLabel>
          <div className="ccc-toggle-row">
            <div><p className="ccc-toggle-label">Exibir estrelas de avaliação</p><p className="ccc-toggle-sub">Mostra a avaliação média no cardápio</p></div>
            <label className="ccc-toggle"><input type="checkbox" checked={!form.hide_stars} onChange={e => setForm({...form, hide_stars: !e.target.checked})} /><span className="ccc-toggle-slider" /></label>
          </div>
          {!form.hide_stars && (
            <>
              <div className="ccc-divider" />
              <p className="ccc-hint">Selecione a nota que aparecerá no cardápio</p>
              <div className="ccc-notas-grid">
                {[5.0, 4.9, 4.8].map(nota => (
                  <button key={nota} className={`ccc-nota-btn${form.avaliacao_media === nota ? " active" : ""}`} onClick={() => setForm({...form, avaliacao_media: nota})}>
                    <span style={{fontSize:"1.1rem"}}>⭐</span>
                    <span>{nota.toFixed(1)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

      </div>{/* fim linha 1 */}

      {/* Botão salvar */}
      <button className="ccc-btn-save" onClick={handleSave} disabled={saving || uploading}>
        {saving ? <span className="ccc-spinner-sm" /> : "Salvar alterações"}
      </button>

      {success && <div className="ccc-toast">✓ Salvo com sucesso!</div>}

      </>
      }

      <style>{`
        @keyframes ccspin { to { transform:rotate(360deg); } }

        /* ── Tabs ── */
        .ccc-tabs { display:flex; gap:0.3rem; background:var(--bg-card, #FFFFFF); border:1px solid var(--border, #E9E9EE); border-radius:14px; padding:5px; width:fit-content; margin-bottom:0.5rem; box-shadow:0 1px 4px rgba(0,0,0,0.03); }
        .ccc-tab { display:flex; align-items:center; gap:0.4rem; padding:0.55rem 1.25rem; border-radius:10px; border:none; background:transparent; font-family:'Geist',sans-serif; font-size:0.86rem; font-weight:600; color:var(--text-secondary, #6B7280); cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .ccc-tab:hover { color:var(--primary, #FF6FA9); background:var(--primary-light, #FFF1F7); }
        .ccc-tab--active { background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color:#ffffff; box-shadow:0 3px 10px rgba(255,111,169,0.32); }
        .ccc-tab--active:hover { color:#ffffff; background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); }
        @media(max-width:640px) { .ccc-tabs { width:100%; } .ccc-tab { flex:1; justify-content:center; padding:0.55rem 0.25rem; font-size:0.8rem; } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn { from{opacity:0;transform:translate(-50%,12px)} to{opacity:1;transform:translate(-50%,0)} }

        /* ── ISOLAMENTO DE TEMA: força light mode nesta página ── */
        .ccc-outer, .ccc-outer * { color-scheme: light; }

        /* ── Layout geral ── */
        .ccc-outer {
          width:calc(100% + 4rem); display:flex; justify-content:center;
          margin: -2rem -2rem 0;
          padding-top:1.25rem; padding-bottom:3rem; background:var(--bg-body, #F7F7F8);
          overflow-x:hidden;
        }
        .ccc-root {
          font-family:'Geist', sans-serif; width:100%; max-width:1500px;
          display:flex; flex-direction:column; gap:1.5rem;
          box-sizing:border-box; padding:0 2rem;
          overflow-x:hidden;
        }

        /* ── Header da página ── */
        .ccc-page-header {
          display:flex; align-items:flex-end; justify-content:space-between;
          flex-wrap:wrap; gap:0.75rem; padding-top:1rem; padding-bottom:1.25rem;
          border-bottom: none;
        }
        .ccc-page-title { font-size:1.5rem; font-weight:700; color:var(--text-title, #1F2937); margin:0 0 0.3rem; letter-spacing:-0.02em; }
        .ccc-page-sub { font-size:0.86rem; color:var(--text-secondary, #6B7280); margin:0; }
        .ccc-autosave {
          font-size:0.76rem; font-weight:600; color:var(--success, #22C55E);
          display:inline-flex; align-items:center; gap:0.35rem;
          background:#f0fdf4; padding:0.32rem 0.8rem;
          border-radius:50px; border:1px solid #dcfce7;
          animation:fadeIn 0.25s ease;
        }

        /* ── Grid de cards ── */
        .ccc-row-top {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:1.25rem; align-items:stretch;
        }
        @media (min-width:1180px) {
          .ccc-row-top { grid-template-columns:repeat(3,1fr); grid-auto-rows:min-content; align-items:start; }
          .ccc-row-top > .ccc-card:nth-child(1) { grid-column:1; grid-row:1 / span 2; }
          .ccc-row-top > .ccc-card:nth-child(2) { grid-column:2; grid-row:1 / span 2; }
          .ccc-row-top > .ccc-card:nth-child(3) { grid-column:3; grid-row:1; height:auto; }
          .ccc-row-top > .ccc-card:nth-child(4) { grid-column:3; grid-row:2; height:auto; }
        }

        /* ── Card base ── */
        .ccc-card {
          background:var(--bg-card, #FFFFFF); border-radius:20px; padding:1.5rem;
          box-shadow:var(--shadow-card, 0 2px 12px rgba(0,0,0,0.05));
          border:1px solid var(--border, #E9E9EE);
          display:flex; flex-direction:column; gap:0.95rem;
          width:100%; box-sizing:border-box; height:100%;
          transition:box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
          position:relative; overflow:hidden;
        }
        .ccc-card::before {
          content:""; position:absolute; top:-60px; right:-60px;
          width:140px; height:140px;
          background:radial-gradient(circle, var(--primary-light, #FFF1F7) 0%, transparent 70%);
          pointer-events:none; opacity:0.7;
        }
        .ccc-card:hover {
          box-shadow:0 4px 24px rgba(255,111,169,0.08), 0 1px 2px rgba(16,24,40,0.04);
          border-color:rgba(255,111,169,0.18);
        }

        /* ── Section header (com ícone) ── */
        .ccc-section-header {
          display:flex; align-items:center; gap:0.7rem;
          padding-bottom:1rem; margin-bottom:0.1rem;
          border-bottom:1px solid var(--border, #E9E9EE);
          position:relative; z-index:1;
        }
        .ccc-section-icon {
          width:36px; height:36px; flex-shrink:0;
          border-radius:11px;
          background:var(--primary-light, #FFF1F7);
          color:var(--primary, #FF6FA9);
          display:flex; align-items:center; justify-content:center;
        }
        .ccc-section-label {
          font-size:0.95rem; font-weight:700;
          color:var(--text-title, #1F2937); margin:0;
          letter-spacing:-0.01em;
        }
        .ccc-section-sub {
          font-size:0.74rem; color:var(--text-muted, #9CA3AF);
          margin:0.1rem 0 0; line-height:1.3;
        }
        .ccc-hint { font-size:0.76rem; color:var(--text-muted, #9CA3AF); margin:0; }

        /* ── Logo ── */
        .ccc-logo-row { display:flex; align-items:center; gap:1rem; width:100%; position:relative; z-index:1; }
        .ccc-logo-preview {
          width:78px; height:78px; min-width:78px; border-radius:50%;
          background:var(--primary-light, #FFF1F7);
          border:3px solid var(--bg-card, #FFFFFF);
          box-shadow:0 0 0 2px var(--primary-light, #FFF1F7);
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; position:relative; overflow:hidden; flex-shrink:0;
          transition:box-shadow 0.2s, transform 0.2s;
        }
        .ccc-logo-preview:hover {
          box-shadow:0 0 0 2px var(--primary, #FF6FA9), 0 6px 18px rgba(255,111,169,0.25);
          transform:scale(1.03);
        }
        .ccc-logo-cam {
          position:absolute; bottom:2px; right:2px;
          background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
          width:24px; height:24px;
          display:flex; align-items:center; justify-content:center;
          border-radius:50%; border:2px solid var(--bg-card, #FFFFFF);
          box-shadow:0 2px 6px rgba(255,111,169,0.4);
        }
        .ccc-logo-label { font-size:0.95rem; font-weight:700; color:var(--text-title, #1F2937); margin:0; }
        .ccc-logo-sub { font-size:0.75rem; color:var(--text-muted, #9CA3AF); margin:0.2rem 0 0; }

        /* ── Campos de input ── */
        .ccc-field {
          display:flex; align-items:center; gap:0.65rem;
          border:1px solid var(--border, #E9E9EE); border-radius:10px;
          padding:0.65rem 1rem; background:var(--bg-input, #FFFFFF);
          transition:border-color 0.15s, box-shadow 0.15s;
          width:100%; box-sizing:border-box;
        }
        .ccc-field:hover { border-color:var(--text-muted, #9CA3AF); }
        .ccc-field:focus-within {
          border-color:var(--border-focus, #FF6FA9);
          box-shadow:0 0 0 3px rgba(255,111,169,0.12);
        }
        .ccc-field-icon { display:flex; align-items:center; flex-shrink:0; color:var(--text-muted, #9CA3AF); }
        .ccc-field-input {
          flex:1; border:none; outline:none;
          font-family:'Geist', sans-serif; font-size:0.88rem;
          color:var(--text-title, #1F2937); background:transparent; min-width:0;
        }
        .ccc-field-input::placeholder { color:var(--text-muted, #9CA3AF); }
        .ccc-field-input:-webkit-autofill,
        .ccc-field-input:-webkit-autofill:hover,
        .ccc-field-input:-webkit-autofill:focus {
          -webkit-box-shadow:0 0 0px 1000px var(--bg-input, #FFFFFF) inset;
          -webkit-text-fill-color:var(--text-title, #1F2937);
          transition:background-color 5000s;
        }

        /* ── Textarea / extras ── */
        .ccc-char-count { font-size:0.72rem; color:var(--text-muted, #9CA3AF); text-align:right; margin:0; }
        .ccc-cep-hint { font-size:0.74rem; color:var(--text-secondary, #6B7280); margin:0; }
        .ccc-row-2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:0.6rem; }
        .ccc-divider { border:none; margin:0.25rem 0; }

        /* ── Toggle ── */
        .ccc-toggle-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
        .ccc-toggle-label { font-size:0.86rem; font-weight:600; color:var(--text-primary, #374151); margin:0; }
        .ccc-toggle-sub { font-size:0.74rem; color:var(--text-muted, #9CA3AF); margin:0.15rem 0 0; }
        .ccc-toggle { position:relative; display:inline-block; width:42px; height:24px; flex-shrink:0; }
        .ccc-toggle input { opacity:0; width:0; height:0; }
        .ccc-toggle-slider {
          position:absolute; cursor:pointer; inset:0;
          background:var(--border, #E9E9EE); border-radius:24px; transition:0.25s;
        }
        .ccc-toggle-slider:before {
          content:""; position:absolute; height:18px; width:18px;
          left:3px; bottom:3px; background:var(--bg-card, #FFFFFF); border-radius:50%;
          transition:0.25s; box-shadow:0 1px 3px rgba(0,0,0,0.2);
        }
        .ccc-toggle input:checked + .ccc-toggle-slider { background:var(--primary, #FF6FA9); }
        .ccc-toggle input:checked + .ccc-toggle-slider:before { transform:translateX(18px); }
        .ccc-toggle input:focus-visible + .ccc-toggle-slider { box-shadow:0 0 0 3px rgba(255,111,169,0.25); }

        /* ── Dias da semana ── */
        .ccc-dias-grid { display:flex; flex-wrap:wrap; gap:0.5rem; }
        .ccc-dia-btn {
          padding:0.5rem 0.95rem; border-radius:50px;
          border:1.5px solid var(--border, #E9E9EE); background:var(--bg-card, #FFFFFF);
          font-family:'Geist', sans-serif; font-size:0.78rem;
          font-weight:600; color:var(--text-secondary, #6B7280); cursor:pointer;
          transition:all 0.18s; min-width:54px;
        }
        .ccc-dia-btn:hover {
          border-color:var(--primary, #FF6FA9);
          color:var(--primary-dark, #F85A9A);
          background:var(--primary-light, #FFF1F7);
          transform:translateY(-1px);
        }
        .ccc-dia-btn.active {
          background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
          border-color:transparent; color:#ffffff; font-weight:700;
          box-shadow:0 3px 10px rgba(255,111,169,0.32);
        }

        /* ── Time fields ── */
        .ccc-time-field { display:flex; flex-direction:column; gap:0.35rem; }
        .ccc-time-field label { font-size:0.74rem; font-weight:600; color:var(--text-primary, #374151); }
        .ccc-time-field input {
          padding:0.6rem 0.85rem; border:1px solid var(--border, #E9E9EE);
          border-radius:10px; font-family:'Geist', sans-serif;
          font-size:0.86rem; color:var(--text-title, #1F2937); outline:none;
          transition:border-color 0.15s, box-shadow 0.15s; width:100%; background:var(--bg-input, #FFFFFF);
        }
        .ccc-time-field input:hover { border-color:var(--text-muted, #9CA3AF); }
        .ccc-time-field input:focus { border-color:var(--border-focus, #FF6FA9); box-shadow:0 0 0 3px rgba(255,111,169,0.12); }

        /* ── Notas de avaliação ── */
        .ccc-notas-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.6rem; }
        .ccc-nota-btn {
          padding:0.95rem 0.4rem; border:1.5px solid var(--border, #E9E9EE);
          border-radius:14px; background:var(--bg-card, #FFFFFF);
          font-family:'Geist', sans-serif; font-size:1.05rem;
          font-weight:800; color:var(--text-primary, #374151); cursor:pointer;
          transition:all 0.2s; display:flex; flex-direction:column;
          align-items:center; gap:0.3rem; position:relative; overflow:hidden;
        }
        .ccc-nota-btn span:first-child { font-size:1.35rem; filter:grayscale(0.4); transition:filter 0.2s; }
        .ccc-nota-btn:hover {
          border-color:var(--primary, #FF6FA9); transform:translateY(-2px);
          box-shadow:0 6px 16px rgba(255,111,169,0.14);
        }
        .ccc-nota-btn:hover span:first-child { filter:grayscale(0); }
        .ccc-nota-btn.active {
          border-color:transparent;
          background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
          color:#ffffff;
          box-shadow:0 6px 18px rgba(255,111,169,0.35);
        }
        .ccc-nota-btn.active span:first-child { filter:grayscale(0) brightness(1.1); }

        /* ── Botão IA ── */
        .ccc-btn-ia {
          display:inline-flex; align-items:center; gap:0.3rem;
          padding:0.25rem 0.7rem;
          background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
          color:var(--text-inverse, #FFFFFF); border:none; border-radius:20px;
          font-family:'Geist', sans-serif; font-size:0.7rem;
          font-weight:700; cursor:pointer; transition:opacity 0.2s, transform 0.15s;
          white-space:nowrap; flex-shrink:0;
          box-shadow:0 2px 8px rgba(255,111,169,0.3);
        }
        .ccc-btn-ia:disabled { opacity:0.5; cursor:not-allowed; box-shadow:none; }
        .ccc-btn-ia:hover:not(:disabled) { opacity:0.9; transform:translateY(-1px); }
        .ccc-spinner-ia {
          width:10px; height:10px;
          border:2px solid rgba(255,255,255,0.4); border-top-color:white;
          border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block;
        }

        /* ── Botão salvar ── */
        .ccc-btn-save {
          align-self:flex-end;
          padding:0.75rem 2.25rem;
          background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
          color:var(--text-inverse, #FFFFFF); border:none; border-radius:10px;
          font-family:'Geist', sans-serif; font-size:0.9rem;
          font-weight:700; cursor:pointer; letter-spacing:0.01em;
          display:flex; align-items:center; justify-content:center;
          min-height:44px; min-width:180px;
          transition:opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow:0 2px 10px rgba(255,111,169,0.32);
        }
        .ccc-btn-save:hover { opacity:0.94; transform:translateY(-1px); box-shadow:0 6px 18px rgba(255,111,169,0.4); }
        .ccc-btn-save:active { transform:translateY(0); }
        .ccc-btn-save:disabled { opacity:0.6; cursor:not-allowed; transform:none; box-shadow:none; }

        /* ── Toast ── */
        .ccc-toast {
          position:fixed; bottom:2rem; left:50%;
          transform:translateX(-50%);
          background:#f0fdf4; border:1px solid #bbf7d0; color:var(--success, #22C55E);
          border-radius:12px; padding:0.75rem 1.5rem; font-size:0.86rem;
          font-weight:600; text-align:center; z-index:90;
          box-shadow:0 8px 24px rgba(16,24,40,0.12);
          animation:toastIn 0.3s ease;
        }

        /* ── Spinners ── */
        .ccc-spinner-lg { width:32px; height:32px; border:3px solid var(--primary-light, #FFF1F7); border-top-color:var(--primary, #FF6FA9); border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
        .ccc-spinner-sm { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
        .ccc-spinner-xs { width:13px; height:13px; border:2px solid var(--primary-light, #FFF1F7); border-top-color:var(--primary, #FF6FA9); border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }

        /* ── Responsivo ── */
        @media (max-width:640px) {
          /* Corrige overflow: layout-main mobile tem padding 0.75rem (não 2rem) */
          .ccc-outer {
            width: calc(100% + 1.5rem);
            margin: -0.75rem -0.75rem 0;
            background: var(--bg-body, #F7F7F8);
          }
          .ccc-root { padding:0 0.75rem; gap:1rem; }
          .ccc-row-top { grid-template-columns:1fr; }
          .ccc-page-title { font-size:1.2rem; }
          .ccc-page-header { padding-top:1.25rem; }
          .ccc-card { padding:1.15rem; }
          .ccc-btn-save { align-self:stretch; width:100%; border-radius:50px; min-height:50px; }
          .ccc-toast { width:calc(100% - 2rem); bottom:1rem; }
        }
      `}</style>
    </div>
    </div>
    </>
  );
}