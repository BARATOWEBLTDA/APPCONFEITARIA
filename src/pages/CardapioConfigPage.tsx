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

const MoneyField = ({ icon, placeholder, value, onChange }: any) => {
  const fmt = (v: string) => {
    const digits = v.replace(/\D/g, "");
    if (!digits || digits === "0") return "";
    const num = parseInt(digits) / 100;
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const parse = (formatted: string) => {
    const digits = formatted.replace(/\D/g, "");
    if (!digits) return "";
    return (parseInt(digits) / 100).toString();
  };
  const display = value ? fmt((parseFloat(value) * 100).toFixed(0)) : "";
  return (
    <div className="ccc-field" style={{ position: "relative" }}>
      <span className="ccc-field-icon">{icon}</span>
      {display && <span style={{ fontSize: "0.9rem", color: "#6b7280", flexShrink: 0, marginRight: "2px" }}>R$</span>}
      <input
        className="ccc-field-input"
        placeholder={placeholder}
        value={display}
        inputMode="numeric"
        onChange={e => onChange(parse(e.target.value))}
      />
    </div>
  );
};

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

  // Estados de entrega avançada
  const [fazEntrega, setFazEntrega] = useState(false);
  const [fazRetirada, setFazRetirada] = useState(true);
  const [metodoEntrega, setMetodoEntrega] = useState<'taxa_fixa' | 'faixas'>('taxa_fixa');
  const [taxaFixa, setTaxaFixa] = useState('');
  const [entregaGratis, setEntregaGratis] = useState('');
  const [valorMinimo, setValorMinimo] = useState('');
  const [faixasDistancia, setFaixasDistancia] = useState<{km: string; valor: string}[]>([
    { km: '3', valor: '' },
  ]);

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
        faz_entrega: fazEntrega,
        faz_retirada: fazRetirada,
        metodo_entrega: metodoEntrega,
        taxa_entrega: taxaFixa ? parseFloat(taxaFixa) : null,
        entrega_gratis_acima: entregaGratis ? parseFloat(entregaGratis) : null,
        valor_minimo_entrega: valorMinimo ? parseFloat(valorMinimo) : null,
        faixas_distancia: faixasDistancia,
        pedido_minimo: form.pedido_minimo ? parseFloat(form.pedido_minimo) : null,
        horario_entrega: form.horario_entrega, area_entrega: form.area_entrega,
        observacoes_entrega: form.observacoes_entrega,
        horario: JSON.stringify(horario),
      }).eq("id", userId);
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 2000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [form, horario, fazEntrega, fazRetirada, metodoEntrega, taxaFixa, entregaGratis, valorMinimo, faixasDistancia]);

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
        .select("nome_loja, telefone, foto_url, descricao_loja, hide_stars, avaliacao_media, endereco, mostrar_localizacao, mostrar_apenas_cidade, faz_entrega, taxa_entrega, pedido_minimo, entrega_gratis_acima, horario_entrega, area_entrega, observacoes_entrega, horario, faz_retirada, metodo_entrega, faixas_distancia, valor_minimo_entrega")
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
        // Entrega avançada
        setFazEntrega(data.faz_entrega || false);
        setFazRetirada(data.faz_retirada !== false);
        setMetodoEntrega(data.metodo_entrega || 'taxa_fixa');
        setTaxaFixa(data.taxa_entrega ? data.taxa_entrega.toString() : '');
        setEntregaGratis(data.entrega_gratis_acima ? data.entrega_gratis_acima.toString() : '');
        setValorMinimo(data.valor_minimo_entrega ? data.valor_minimo_entrega.toString() : '');
        if (data.faixas_distancia?.length) setFaixasDistancia(data.faixas_distancia);
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
      <style>{`
        @keyframes ccspin { to { transform:rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn { from{opacity:0;transform:translate(-50%,12px)} to{opacity:1;transform:translate(-50%,0)} }

        /* ── ISOLAMENTO DE TEMA: força light mode nesta página ── */
        .ccc-outer, .ccc-outer * { color-scheme: light; }

        /* ── Layout geral ── */
        .ccc-outer {
          width:100%; display:flex; justify-content:center;
          padding-bottom:3rem; background:#fafafa;
        }
        .ccc-root {
          font-family:'Geist', sans-serif; width:100%; max-width:1160px;
          display:flex; flex-direction:column; gap:1.5rem;
          box-sizing:border-box; padding:0 1.5rem;
        }

        /* ── Header da página ── */
        .ccc-page-header {
          display:flex; align-items:flex-end; justify-content:space-between;
          flex-wrap:wrap; gap:0.75rem; padding-top:2.25rem; padding-bottom:1.25rem;
          border-bottom:1px solid #ececef;
        }
        .ccc-page-title { font-size:1.5rem; font-weight:700; color:#18181b; margin:0 0 0.3rem; letter-spacing:-0.02em; }
        .ccc-page-sub { font-size:0.86rem; color:#71717a; margin:0; }
        .ccc-autosave {
          font-size:0.76rem; font-weight:600; color:#16a34a;
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
        .ccc-row-bottom { display:grid; grid-template-columns:1fr; gap:1.25rem; align-items:start; }

        /* ── Card base ── */
        .ccc-card {
          background:#ffffff; border-radius:14px; padding:1.5rem;
          box-shadow:0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.03);
          border:1px solid #eaeaec;
          display:flex; flex-direction:column; gap:0.85rem;
          width:100%; box-sizing:border-box; height:100%;
          transition:box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .ccc-card:hover {
          box-shadow:0 1px 2px rgba(16,24,40,0.05), 0 8px 24px rgba(16,24,40,0.06);
          border-color:#e2e2e5;
        }

        /* ── Section label ── */
        .ccc-section-label {
          font-size:0.7rem; font-weight:700; color:#a1a1aa;
          text-transform:uppercase; letter-spacing:0.12em; margin:0;
          padding-bottom:0.75rem; border-bottom:1px solid #f4f4f5;
          display:flex; align-items:center; gap:0.4rem;
        }
        .ccc-section-label::before {
          content:""; width:3px; height:12px; border-radius:2px;
          background:linear-gradient(180deg,#F583BF,#e060a8);
        }
        .ccc-hint { font-size:0.76rem; color:#a1a1aa; margin:0; }

        /* ── Logo ── */
        .ccc-logo-row { display:flex; align-items:center; gap:1rem; width:100%; }
        .ccc-logo-preview {
          width:68px; height:68px; min-width:68px; border-radius:50%;
          background:#fdf2f8; border:2px solid #fce7f3;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; position:relative; overflow:hidden; flex-shrink:0;
          transition:border-color 0.2s, box-shadow 0.2s;
        }
        .ccc-logo-preview:hover { border-color:#F583BF; box-shadow:0 0 0 4px rgba(245,131,191,0.12); }
        .ccc-logo-cam {
          position:absolute; bottom:0; right:0;
          background:rgba(0,0,0,0.45); width:20px; height:20px;
          display:flex; align-items:center; justify-content:center;
          border-radius:50% 0 0 0;
        }
        .ccc-logo-label { font-size:0.9rem; font-weight:600; color:#18181b; margin:0; }
        .ccc-logo-sub { font-size:0.75rem; color:#a1a1aa; margin:0.2rem 0 0; }

        /* ── Campos de input ── */
        .ccc-field {
          display:flex; align-items:center; gap:0.65rem;
          border:1px solid #e4e4e7; border-radius:10px;
          padding:0.65rem 1rem; background:#ffffff;
          transition:border-color 0.15s, box-shadow 0.15s;
          width:100%; box-sizing:border-box;
        }
        .ccc-field:hover { border-color:#d4d4d8; }
        .ccc-field:focus-within {
          border-color:#F583BF;
          box-shadow:0 0 0 3px rgba(245,131,191,0.12);
        }
        .ccc-field-icon { display:flex; align-items:center; flex-shrink:0; color:#a1a1aa; }
        .ccc-field-input {
          flex:1; border:none; outline:none;
          font-family:'Geist', sans-serif; font-size:0.88rem;
          color:#18181b; background:transparent; min-width:0;
        }
        .ccc-field-input::placeholder { color:#a1a1aa; }
        .ccc-field-input:-webkit-autofill,
        .ccc-field-input:-webkit-autofill:hover,
        .ccc-field-input:-webkit-autofill:focus {
          -webkit-box-shadow:0 0 0px 1000px #ffffff inset;
          -webkit-text-fill-color:#18181b;
          transition:background-color 5000s;
        }

        /* ── Textarea / extras ── */
        .ccc-char-count { font-size:0.72rem; color:#a1a1aa; text-align:right; margin:0; }
        .ccc-cep-hint { font-size:0.74rem; color:#71717a; margin:0; }
        .ccc-row-2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:0.6rem; }
        .ccc-divider { border:none; border-top:1px solid #f4f4f5; margin:0.25rem 0; }

        /* ── Toggle ── */
        .ccc-toggle-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
        .ccc-toggle-label { font-size:0.86rem; font-weight:600; color:#3f3f46; margin:0; }
        .ccc-toggle-sub { font-size:0.74rem; color:#a1a1aa; margin:0.15rem 0 0; }
        .ccc-toggle { position:relative; display:inline-block; width:42px; height:24px; flex-shrink:0; }
        .ccc-toggle input { opacity:0; width:0; height:0; }
        .ccc-toggle-slider {
          position:absolute; cursor:pointer; inset:0;
          background:#e4e4e7; border-radius:24px; transition:0.25s;
        }
        .ccc-toggle-slider:before {
          content:""; position:absolute; height:18px; width:18px;
          left:3px; bottom:3px; background:white; border-radius:50%;
          transition:0.25s; box-shadow:0 1px 3px rgba(0,0,0,0.2);
        }
        .ccc-toggle input:checked + .ccc-toggle-slider { background:#F583BF; }
        .ccc-toggle input:checked + .ccc-toggle-slider:before { transform:translateX(18px); }
        .ccc-toggle input:focus-visible + .ccc-toggle-slider { box-shadow:0 0 0 3px rgba(245,131,191,0.25); }

        /* ── Dias da semana ── */
        .ccc-dias-grid { display:flex; flex-wrap:wrap; gap:0.45rem; }
        .ccc-dia-btn {
          padding:0.35rem 0.7rem; border-radius:8px;
          border:1px solid #e4e4e7; background:#ffffff;
          font-family:'Geist', sans-serif; font-size:0.78rem;
          font-weight:600; color:#71717a; cursor:pointer; transition:all 0.15s;
        }
        .ccc-dia-btn:hover { border-color:#F583BF; color:#e060a8; background:#fef7fb; }
        .ccc-dia-btn.active { background:#fce7f3; border-color:#F583BF; color:#be3d8f; font-weight:700; }

        /* ── Time fields ── */
        .ccc-time-field { display:flex; flex-direction:column; gap:0.35rem; }
        .ccc-time-field label { font-size:0.74rem; font-weight:600; color:#52525b; }
        .ccc-time-field input {
          padding:0.6rem 0.85rem; border:1px solid #e4e4e7;
          border-radius:10px; font-family:'Geist', sans-serif;
          font-size:0.86rem; color:#18181b; outline:none;
          transition:border-color 0.15s, box-shadow 0.15s; width:100%; background:#ffffff;
        }
        .ccc-time-field input:hover { border-color:#d4d4d8; }
        .ccc-time-field input:focus { border-color:#F583BF; box-shadow:0 0 0 3px rgba(245,131,191,0.12); }

        /* ── Notas de avaliação ── */
        .ccc-notas-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.6rem; }
        .ccc-nota-btn {
          padding:0.75rem 0.4rem; border:1px solid #e4e4e7;
          border-radius:12px; background:#ffffff;
          font-family:'Geist', sans-serif; font-size:0.88rem;
          font-weight:700; color:#3f3f46; cursor:pointer;
          transition:all 0.18s; display:flex; flex-direction:column;
          align-items:center; gap:0.25rem;
        }
        .ccc-nota-btn:hover { border-color:#F583BF; transform:translateY(-1px); box-shadow:0 4px 12px rgba(16,24,40,0.06); }
        .ccc-nota-btn.active {
          border-color:#F583BF;
          background:linear-gradient(135deg,#fdf2f8,#fce7f3);
          color:#be3d8f; box-shadow:0 3px 12px rgba(245,131,191,0.22);
        }

        /* ── Horário entrega btn ── */
        .ccc-horario-btn {
          display:flex; align-items:center; gap:0.65rem;
          border:1px solid #e4e4e7; border-radius:10px;
          padding:0.65rem 1rem; background:#ffffff;
          font-family:'Geist', sans-serif; cursor:pointer;
          width:100%; transition:border-color 0.15s, box-shadow 0.15s; text-align:left;
        }
        .ccc-horario-btn:hover { border-color:#F583BF; box-shadow:0 0 0 3px rgba(245,131,191,0.08); }

        /* ── Botão IA ── */
        .ccc-btn-ia {
          display:inline-flex; align-items:center; gap:0.3rem;
          padding:0.25rem 0.7rem;
          background:linear-gradient(135deg,#F583BF,#e060a8);
          color:white; border:none; border-radius:20px;
          font-family:'Geist', sans-serif; font-size:0.7rem;
          font-weight:700; cursor:pointer; transition:opacity 0.2s, transform 0.15s;
          white-space:nowrap; flex-shrink:0;
          box-shadow:0 2px 8px rgba(245,131,191,0.3);
        }
        .ccc-btn-ia:disabled { opacity:0.5; cursor:not-allowed; box-shadow:none; }
        .ccc-btn-ia:hover:not(:disabled) { opacity:0.9; transform:translateY(-1px); }
        .ccc-spinner-ia {
          width:10px; height:10px;
          border:2px solid rgba(255,255,255,0.4); border-top-color:white;
          border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block;
        }

        /* ── Botão salvar — compacto à direita (padrão SaaS) ── */
        .ccc-btn-save {
          align-self:flex-end;
          padding:0.75rem 2.25rem;
          background:linear-gradient(135deg,#F583BF,#e060a8);
          color:white; border:none; border-radius:10px;
          font-family:'Geist', sans-serif; font-size:0.9rem;
          font-weight:700; cursor:pointer; letter-spacing:0.01em;
          display:flex; align-items:center; justify-content:center;
          min-height:44px; min-width:180px;
          transition:opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow:0 2px 10px rgba(245,131,191,0.32);
        }
        .ccc-btn-save:hover { opacity:0.94; transform:translateY(-1px); box-shadow:0 6px 18px rgba(245,131,191,0.4); }
        .ccc-btn-save:active { transform:translateY(0); }
        .ccc-btn-save:disabled { opacity:0.6; cursor:not-allowed; transform:none; box-shadow:none; }

        /* ── Toast — fixed, não empurra layout ── */
        .ccc-toast {
          position:fixed; bottom:2rem; left:50%;
          transform:translateX(-50%);
          background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d;
          border-radius:12px; padding:0.75rem 1.5rem; font-size:0.86rem;
          font-weight:600; text-align:center; z-index:90;
          box-shadow:0 8px 24px rgba(16,24,40,0.12);
          animation:toastIn 0.3s ease;
        }

        /* ── Spinners ── */
        .ccc-spinner-lg { width:32px; height:32px; border:3px solid #fce7f3; border-top-color:#F583BF; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
        .ccc-spinner-sm { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
        .ccc-spinner-xs { width:13px; height:13px; border:2px solid #fce7f3; border-top-color:#F583BF; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }

        /* ── Modal — centralizado no desktop, bottom-sheet no mobile ── */
        .ccc-modal-overlay {
          position:fixed; inset:0; z-index:999;
          background:rgba(9,9,11,0.5); backdrop-filter:blur(2px);
          display:flex; align-items:center; justify-content:center;
          padding:1rem;
        }
        .ccc-modal {
          background:#ffffff; border-radius:16px;
          padding:1.5rem; width:100%; max-width:420px;
          animation:fadeIn 0.2s ease;
          box-shadow:0 24px 60px rgba(9,9,11,0.25);
        }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .ccc-modal-header { display:flex; align-items:center; gap:0.5rem; font-size:1rem; font-weight:700; color:#18181b; margin-bottom:1.25rem; }
        .ccc-modal-times { display:flex; align-items:center; gap:0.75rem; margin-bottom:1.5rem; }
        .ccc-modal-time-field { display:flex; flex-direction:column; gap:0.35rem; flex:1; }
        .ccc-modal-time-field label { font-size:0.75rem; font-weight:600; color:#52525b; }
        .ccc-modal-time-field input { padding:0.6rem; border:1.5px solid #fce7f3; border-radius:10px; font-family:'Geist', sans-serif; font-size:0.95rem; font-weight:600; color:#18181b; outline:none; text-align:center; background:#fdf2f8; width:100%; transition:border-color 0.15s, background 0.15s; }
        .ccc-modal-time-field input:focus { border-color:#F583BF; background:white; }
        .ccc-modal-actions { display:flex; gap:0.75rem; }
        .ccc-modal-cancel { flex:1; padding:0.75rem; border:1px solid #e4e4e7; border-radius:10px; background:white; font-family:'Geist', sans-serif; font-size:0.88rem; font-weight:600; color:#52525b; cursor:pointer; transition:border-color 0.15s; }
        .ccc-modal-cancel:hover { border-color:#d4d4d8; }
        .ccc-modal-confirm { flex:1; padding:0.75rem; background:linear-gradient(135deg,#F583BF,#e060a8); border:none; border-radius:10px; color:white; font-family:'Geist', sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; transition:opacity 0.15s; }
        .ccc-modal-confirm:hover { opacity:0.92; }

        /* ── Responsivo ── */
        @media (max-width:640px) {
          .ccc-outer { background:#ffffff; }
          .ccc-root { padding:0 0.75rem; gap:1rem; }
          .ccc-row-top { grid-template-columns:1fr; }
          .ccc-row-bottom { grid-template-columns:1fr; }
          .ccc-page-title { font-size:1.2rem; }
          .ccc-page-header { padding-top:1.25rem; }
          .ccc-card { padding:1.15rem; }
          .ccc-btn-save { align-self:stretch; width:100%; border-radius:50px; min-height:50px; }
          .ccc-modal-overlay { align-items:flex-end; padding:0; }
          .ccc-modal { border-radius:24px 24px 0 0; max-width:100%; padding:1.5rem 1.5rem 2rem; animation:slideUp 0.25s ease; }
          .ccc-toast { width:calc(100% - 2rem); bottom:1rem; }
        }
      `}</style>
    </div>
    </div>
    </>
  );
}
