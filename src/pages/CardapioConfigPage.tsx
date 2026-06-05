import { useState, useEffect, useRef } from "react";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { supabase } from "@/lib/supabase";

const SectionLabel = ({ children }: any) => <p className="ccc-section-label">{children}</p>;

const Field = ({ icon, placeholder, value, onChange, type = "text" }: any) => (
  <div className="ccc-field">
    <span className="ccc-field-icon">{icon}</span>
    <input className="ccc-field-input" type={type} placeholder={placeholder} value={value} onChange={onChange} />
  </div>
);

const DIAS = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];

export default function CardapioConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepPreenchido, setCepPreenchido] = useState(false);
  const [modalHorario, setModalHorario] = useState(false);
  const [horarioTemp, setHorarioTemp] = useState({ inicio: "08:00", fim: "18:00" });
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
        pedido_minimo: form.pedido_minimo ? parseFloat(form.pedido_minimo) : null,
        entrega_gratis_acima: form.entrega_gratis_acima ? parseFloat(form.entrega_gratis_acima) : null,
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
    <div className="ccc-root">

      <div className="ccc-page-header" style={{paddingTop:"1.5rem"}}>
        <h1 className="ccc-page-title">Configuração do Cardápio</h1>
        <p className="ccc-page-sub">Personalize as informações do seu cardápio público</p>
        {autoSaved && <span className="ccc-autosave">✓ Salvo automaticamente</span>}
      </div>

      {/* Card 1 — Identidade */}
      <div className="ccc-card">
        <SectionLabel>Identidade da loja</SectionLabel>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFileChange} />
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
        <div className="ccc-field" style={{alignItems:"flex-start",borderRadius:"10px",padding:"0.75rem 1.1rem"}}>
          <span className="ccc-field-icon" style={{marginTop:"0.15rem"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </span>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:"0.4rem"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:"0.75rem",color:"#9ca3af"}}>Descrição</span>
              <button type="button" className="ccc-btn-ia" onClick={gerarDescricaoLoja} disabled={gerandoDescricao || !form.nome_loja.trim()}>
                {gerandoDescricao ? <><span className="ccc-spinner-ia" /> Gerando...</> : <>✨ Gerar com IA</>}
              </button>
            </div>
            <textarea className="ccc-field-input" placeholder="Descrição da loja (aparece no cardápio)" value={form.descricao_loja} onChange={e => setForm({...form, descricao_loja: e.target.value})} rows={5} maxLength={200} style={{resize:"none"}} />
          </div>
        </div>
        <p className="ccc-char-count">{(form.descricao_loja || "").length}/200</p>
      </div>

      {/* Card 2 — Localização */}
      <div className="ccc-card">
        <SectionLabel>Localização da loja</SectionLabel>
        <div className="ccc-field">
          <span className="ccc-field-icon">
            {buscandoCep ? <span className="ccc-spinner-xs" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
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
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 80px",gap:"0.5rem",width:"100%",boxSizing:"border-box"}}>
          <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>}
            placeholder="Rua / Avenida" value={form.rua} onChange={(e: any) => setForm({...form, rua: e.target.value})} />
          <div className="ccc-field">
            <input className="ccc-field-input" placeholder="Nº" value={form.numero} onChange={(e: any) => setForm({...form, numero: e.target.value})} />
          </div>
        </div>
        <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>}
          placeholder="Bairro" value={form.bairro} onChange={(e: any) => setForm({...form, bairro: e.target.value})} />
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 90px",gap:"0.5rem",width:"100%",boxSizing:"border-box"}}>
          <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg>}
            placeholder="Cidade" value={form.cidade} onChange={(e: any) => setForm({...form, cidade: e.target.value})} />
          <div className="ccc-field">
            <input className="ccc-field-input" placeholder="UF" value={form.estado} onChange={(e: any) => setForm({...form, estado: e.target.value.toUpperCase()})} maxLength={2} />
          </div>
        </div>
        {cepPreenchido && <p className="ccc-cep-hint">Preenchido automaticamente. <span onClick={() => setCepPreenchido(false)} style={{color:"#F583BF",cursor:"pointer",fontWeight:600}}>Editar manual</span></p>}
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

      {/* Card 3 — Entrega */}
      <div className="ccc-card">
        <SectionLabel>Entrega</SectionLabel>
        <div className="ccc-toggle-row">
          <div><p className="ccc-toggle-label">Faz entrega?</p><p className="ccc-toggle-sub">Ative para configurar opções e taxas de entrega no seu cardápio.</p></div>
          <label className="ccc-toggle"><input type="checkbox" checked={form.faz_entrega} onChange={e => setForm({...form, faz_entrega: e.target.checked})} /><span className="ccc-toggle-slider" /></label>
        </div>
        {form.faz_entrega && (
          <>
            <div className="ccc-divider" />
            <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} placeholder="Taxa de entrega" value={form.taxa_entrega} onChange={(e: any) => setForm({...form, taxa_entrega: e.target.value.replace(/[^0-9.,]/g,"")})} />
            <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>} placeholder="Pedido mínimo" value={form.pedido_minimo} onChange={(e: any) => setForm({...form, pedido_minimo: e.target.value.replace(/[^0-9.,]/g,"")})} />
            <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/></svg>} placeholder="Entrega grátis acima de" value={form.entrega_gratis_acima} onChange={(e: any) => setForm({...form, entrega_gratis_acima: e.target.value.replace(/[^0-9.,]/g,"")})} />
            <button className="ccc-horario-btn" onClick={() => { if (form.horario_entrega) { const [ini,fim] = form.horario_entrega.split(" às "); setHorarioTemp({inicio:ini||"08:00",fim:fim||"18:00"}); } setModalHorario(true); }}>
              <span className="ccc-field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
              <span style={{flex:1,textAlign:"left",color:form.horario_entrega?"var(--text-primary,#1f2937)":"#9ca3af",fontSize:"0.9rem"}}>{form.horario_entrega || "Horário de entregas"}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>} placeholder="Área de entrega" value={form.area_entrega} onChange={(e: any) => setForm({...form, area_entrega: e.target.value})} />
            <div className="ccc-field" style={{alignItems:"flex-start",borderRadius:"10px",padding:"0.75rem 1.1rem"}}>
              <span className="ccc-field-icon" style={{marginTop:"0.15rem"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
              <textarea className="ccc-field-input" placeholder="Observações" value={form.observacoes_entrega} onChange={e => setForm({...form, observacoes_entrega: e.target.value})} rows={3} style={{resize:"none"}} />
            </div>
          </>
        )}
      </div>

      {/* Card 4 — Horários */}
      <div className="ccc-card">
        <SectionLabel>Horários de funcionamento</SectionLabel>
        <p className="ccc-hint">Dias que sua loja funciona</p>
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

      {/* Card 5 — Avaliações */}
      <div className="ccc-card">
        <SectionLabel>Avaliações</SectionLabel>
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

      {success && <div className="ccc-toast">✓ Salvo com sucesso!</div>}

      {/* Modal Horário Entrega */}
      {modalHorario && (
        <div className="ccc-modal-overlay" onClick={() => setModalHorario(false)}>
          <div className="ccc-modal" onClick={e => e.stopPropagation()}>
            <div className="ccc-modal-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Horário de entregas</span>
            </div>
            <div className="ccc-modal-times">
              <div className="ccc-modal-time-field"><label>Início</label><input type="time" value={horarioTemp.inicio} onChange={e => setHorarioTemp({...horarioTemp, inicio: e.target.value})} /></div>
              <div style={{color:"#d1d5db",fontSize:"1.2rem",paddingTop:"1.2rem"}}>→</div>
              <div className="ccc-modal-time-field"><label>Fim</label><input type="time" value={horarioTemp.fim} onChange={e => setHorarioTemp({...horarioTemp, fim: e.target.value})} /></div>
            </div>
            <div className="ccc-modal-actions">
              <button className="ccc-modal-cancel" onClick={() => setModalHorario(false)}>Cancelar</button>
              <button className="ccc-modal-confirm" onClick={() => { setForm(f => ({...f, horario_entrega: `${horarioTemp.inicio} às ${horarioTemp.fim}`})); setModalHorario(false); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <button className="ccc-btn-save" onClick={handleSave} disabled={saving || uploading}>
        {saving ? <span className="ccc-spinner-sm" /> : "Salvar alterações"}
      </button>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:ital@1&display=swap');
        @keyframes ccspin { to { transform:rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .ccc-root { font-family:'Inter',sans-serif; max-width:520px; width:100%; display:flex; flex-direction:column; gap:0.85rem; overflow:hidden; box-sizing:border-box; }
        .ccc-page-title { font-size:1.25rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.3rem; text-align:center; }
        .ccc-page-sub { font-size:0.84rem; color:#4b5563; margin:0; font-family:'Nunito',sans-serif; font-style:italic; text-align:center; }
        .ccc-card { background:var(--bg-card,white); border-radius:18px; padding:1.15rem; box-shadow:var(--shadow-card,0 2px 12px rgba(0,0,0,0.06)); display:flex; flex-direction:column; gap:0.7rem; width:100%; box-sizing:border-box; overflow:hidden; }
        .ccc-section-label { font-size:0.75rem; font-weight:800; color:#F583BF; text-transform:uppercase; letter-spacing:0.12em; margin:0; }
        .ccc-hint { font-size:0.75rem; color:var(--text-muted,#9ca3af); margin:0; }
        .ccc-logo-row { display:flex; align-items:center; gap:0.85rem; width:100%; overflow:hidden; padding-right:0.25rem; }
        .ccc-logo-preview { width:72px; height:72px; min-width:72px; border-radius:50%; background:#fdf2f8; border:2px solid #fce7f3; display:flex; align-items:center; justify-content:center; cursor:pointer; position:relative; overflow:hidden; flex-shrink:0; }
        .ccc-logo-cam { position:absolute; bottom:0; right:0; background:rgba(0,0,0,0.45); width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:50% 0 0 0; }
        .ccc-logo-label { font-size:0.88rem; font-weight:600; color:var(--text-primary,#1f2937); margin:0; }
        .ccc-logo-sub { font-size:0.75rem; color:var(--text-muted,#9ca3af); margin:0.2rem 0 0; }
        .ccc-autosave { font-size:0.75rem; font-weight:600; color:#22c55e; display:flex; align-items:center; gap:0.25rem; animation:fadeIn 0.3s ease; justify-content:center; margin-top:0.25rem; }
        .ccc-field { display:flex; align-items:center; gap:0.7rem; border:1.5px solid var(--border,#e5e7eb); border-radius:10px; padding:0.65rem 1.1rem; background:var(--bg-input,white); transition:border-color 0.2s; width:100%; box-sizing:border-box; overflow:hidden; }
        .ccc-field:focus-within { border-color:#F583BF; }
        .ccc-field-icon { display:flex; align-items:center; flex-shrink:0; color:var(--text-muted,#9ca3af); }
        .ccc-field-input { flex:1; border:none; outline:none; font-family:'Inter',sans-serif; font-size:0.9rem; color:var(--text-primary,#1f2937); background:transparent; min-width:0; max-width:100%; }
        .ccc-field-input::placeholder { color:#9ca3af; }
        .ccc-field-input:-webkit-autofill,
        .ccc-field-input:-webkit-autofill:hover,
        .ccc-field-input:-webkit-autofill:focus { -webkit-box-shadow:0 0 0px 1000px white inset; -webkit-text-fill-color:#1f2937; transition:background-color 5000s; }
        .ccc-obs { display:flex; align-items:flex-start; gap:0.5rem; background:#fdf2f8; border-radius:10px; padding:0.65rem 0.85rem; }
        .ccc-obs p { font-size:0.75rem; color:var(--text-secondary,#6b7280); margin:0; line-height:1.5; }
        .ccc-char-count { font-size:0.72rem; color:var(--text-muted,#9ca3af); text-align:right; margin:0; }
        .ccc-cep-hint { font-size:0.72rem; color:var(--text-muted,#9ca3af); margin:0; }
        .ccc-row-2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:0.5rem; }
        .ccc-divider { border:none; border-top:1px solid var(--border,#f3f4f6); margin:0; }
        .ccc-toggle-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
        .ccc-toggle-label { font-size:0.88rem; font-weight:600; color:var(--text-primary,#374151); margin:0; }
        .ccc-toggle-sub { font-size:0.74rem; color:var(--text-muted,#9ca3af); margin:0.1rem 0 0; }
        .ccc-toggle { position:relative; display:inline-block; width:46px; height:26px; flex-shrink:0; }
        .ccc-toggle input { opacity:0; width:0; height:0; }
        .ccc-toggle-slider { position:absolute; cursor:pointer; inset:0; background:#e5e7eb; border-radius:26px; transition:0.3s; }
        .ccc-toggle-slider:before { content:""; position:absolute; height:20px; width:20px; left:3px; bottom:3px; background:white; border-radius:50%; transition:0.3s; box-shadow:0 1px 4px rgba(0,0,0,0.15); }
        .ccc-toggle input:checked + .ccc-toggle-slider { background:#F583BF; }
        .ccc-toggle input:checked + .ccc-toggle-slider:before { transform:translateX(20px); }
        .ccc-horario-btn { display:flex; align-items:center; gap:0.7rem; border:1.5px solid var(--border,#e5e7eb); border-radius:10px; padding:0.65rem 1.1rem; background:var(--bg-input,white); font-family:'Inter',sans-serif; cursor:pointer; width:100%; transition:border-color 0.2s; text-align:left; }
        .ccc-horario-btn:hover { border-color:#F583BF; }
        .ccc-dias-grid { display:flex; flex-wrap:wrap; gap:0.4rem; }
        .ccc-dia-btn { padding:0.35rem 0.7rem; border-radius:8px; border:1.5px solid var(--border,#e5e7eb); background:var(--bg-card,white); font-family:'Nunito',sans-serif; font-size:0.78rem; font-weight:500; color:var(--text-secondary,#6b7280); cursor:pointer; transition:all 0.15s; }
        .ccc-dia-btn.active { background:#fce7f3; border-color:#F583BF; color:#F583BF; font-weight:700; }
        .ccc-time-field { display:flex; flex-direction:column; gap:0.25rem; }
        .ccc-time-field label { font-size:0.74rem; font-weight:600; color:var(--text-secondary,#6b7280); }
        .ccc-time-field input { padding:0.6rem 0.85rem; border:1.5px solid var(--border,#e5e7eb); border-radius:10px; font-family:'Inter',sans-serif; font-size:0.88rem; color:var(--text-primary,#1f2937); outline:none; transition:border-color 0.2s; width:100%; background:var(--bg-input,white); }
        .ccc-time-field input:focus { border-color:#F583BF; }
        .ccc-notas-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.6rem; }
        .ccc-nota-btn { padding:0.75rem 0.5rem; border:1.5px solid var(--border,#e5e7eb); border-radius:12px; background:var(--bg-card,white); font-family:'Inter',sans-serif; font-size:0.88rem; font-weight:700; color:var(--text-secondary,#374151); cursor:pointer; transition:all 0.2s; box-shadow:0 2px 6px rgba(0,0,0,0.06); display:flex; flex-direction:column; align-items:center; gap:0.25rem; }
        .ccc-nota-btn:hover { border-color:#F583BF; box-shadow:0 4px 12px rgba(245,131,191,0.2); transform:translateY(-1px); }
        .ccc-nota-btn.active { border-color:#F583BF; background:linear-gradient(135deg,#fdf2f8,#fce7f3); color:#e060a8; box-shadow:0 4px 14px rgba(245,131,191,0.35); transform:translateY(-1px); }
        .ccc-toast { background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; border-radius:12px; padding:0.7rem 1rem; font-size:0.85rem; font-weight:500; }
        .ccc-btn-ia { display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.6rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:20px; font-family:'Inter',sans-serif; font-size:0.7rem; font-weight:700; cursor:pointer; transition:opacity 0.2s; white-space:nowrap; }
        .ccc-btn-ia:disabled { opacity:0.5; cursor:not-allowed; }
        .ccc-btn-ia:hover:not(:disabled) { opacity:0.9; }
        .ccc-spinner-ia { width:10px; height:10px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
        .ccc-btn-save { width:100%; padding:0.9rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.95rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; min-height:50px; transition:opacity 0.2s; }
        .ccc-btn-save:hover { opacity:0.9; }
        .ccc-btn-save:disabled { opacity:0.65; cursor:not-allowed; }
        .ccc-modal-overlay { position:fixed; inset:0; z-index:999; background:rgba(0,0,0,0.45); display:flex; align-items:flex-end; justify-content:center; }
        .ccc-modal { background:white; border-radius:24px 24px 0 0; padding:1.5rem 1.5rem 2rem; width:100%; max-width:480px; animation:slideUp 0.25s ease; }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .ccc-modal-header { display:flex; align-items:center; gap:0.5rem; font-size:1rem; font-weight:700; color:#1f2937; margin-bottom:1.25rem; }
        .ccc-modal-times { display:flex; align-items:center; gap:0.75rem; margin-bottom:1.5rem; }
        .ccc-modal-time-field { display:flex; flex-direction:column; gap:0.3rem; flex:1; }
        .ccc-modal-time-field label { font-size:0.75rem; font-weight:600; color:#6b7280; }
        .ccc-modal-time-field input { padding:0.55rem; border:2px solid #fce7f3; border-radius:12px; font-family:'Inter',sans-serif; font-size:0.95rem; font-weight:600; color:#1f2937; outline:none; text-align:center; background:#fdf2f8; width:100%; }
        .ccc-modal-time-field input:focus { border-color:#F583BF; background:white; }
        .ccc-modal-actions { display:flex; gap:0.75rem; }
        .ccc-modal-cancel { flex:1; padding:0.85rem; border:1.5px solid #e5e7eb; border-radius:50px; background:white; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:600; color:#6b7280; cursor:pointer; }
        .ccc-modal-confirm { flex:1; padding:0.85rem; background:linear-gradient(135deg,#F583BF,#e060a8); border:none; border-radius:50px; color:white; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; }
        .ccc-spinner-lg { width:32px; height:32px; border:3px solid #fce7f3; border-top-color:#F583BF; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
        .ccc-spinner-sm { width:20px; height:20px; border:2px solid rgba(255,255,255,0.35); border-top-color:white; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
        .ccc-spinner-xs { width:14px; height:14px; border:2px solid rgba(255,255,255,0.35); border-top-color:white; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
      `}</style>
    </div>
    </>
  );
}
