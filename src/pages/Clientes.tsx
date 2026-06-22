import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cliente {
  id: string;
  user_id: string;
  nome: string;
  nome_contato?: string;
  email?: string;
  whatsapp?: string;
  cpf_cnpj?: string;
  data_nascimento?: string;
  sexo?: string;
  observacoes?: string;
  foto_url?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  origem?: string;
  como_conheceu?: string;
  created_at: string;
}

type FormMode = "rapido" | "completo";

const ORIGEM_OPTIONS = ["Instagram", "Indicação", "Google", "Facebook", "TikTok", "WhatsApp", "Loja física", "Outro"];
const SEXO_OPTIONS   = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];
const UF_OPTIONS     = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const emptyRapido = { nome: "", whatsapp: "", email: "", observacoes: "", data_nascimento: "" };

const emptyCompleto: Omit<Cliente, "id" | "user_id" | "created_at"> = {
  nome: "", nome_contato: "", email: "", whatsapp: "", cpf_cnpj: "",
  data_nascimento: "", sexo: "", observacoes: "", foto_url: "",
  cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", pais: "Brasil",
  origem: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPhone(phone?: string) {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
}

function getDaysUntil(data: string) {
  const hoje = new Date();
  const nasc = new Date(data);
  const aniv = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (aniv < hoje) aniv.setFullYear(hoje.getFullYear() + 1);
  return Math.ceil((aniv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function getHoursUntil(data: string) {
  const hoje = new Date();
  const nasc = new Date(data);
  const aniv = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (aniv < hoje) aniv.setFullYear(hoje.getFullYear() + 1);
  return Math.ceil((aniv.getTime() - hoje.getTime()) / (1000 * 60 * 60));
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Clientes() {
  const [clientes,      setClientes]      = useState<Cliente[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [userId,        setUserId]        = useState<string | null>(null);

  // Form state
  const [showForm,      setShowForm]      = useState(false);
  const [formMode,      setFormMode]      = useState<FormMode>("rapido");
  const [editando,      setEditando]      = useState<string | null>(null);
  const [rapido,        setRapido]        = useState(emptyRapido);
  const [completo,      setCompleto]      = useState(emptyCompleto);
  const [preview,       setPreview]       = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [cepLoading,    setCepLoading]    = useState(false);

  // Modais
  const [showNiver,     setShowNiver]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchClientes(user.id);
    });
  }, []);

  useEffect(() => {
    const isOpen = showForm || !!confirmDelete || showNiver;
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showForm, confirmDelete, showNiver]);

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchClientes = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase.from("clientes").select("*").eq("user_id", uid).order("nome");
    if (data) setClientes(data);
    setLoading(false);
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openNew = (mode: FormMode) => {
    setFormMode(mode);
    setEditando(null);
    setRapido(emptyRapido);
    setCompleto(emptyCompleto);
    setPreview(null);
    setShowForm(true);
  };

  const openEdit = (c: Cliente) => {
    setFormMode("completo");
    setEditando(c.id);
    setRapido({ nome: c.nome, whatsapp: c.whatsapp || "", email: c.email || "", observacoes: c.observacoes || "", data_nascimento: c.data_nascimento || "" });
    setCompleto({
      nome: c.nome || "", nome_contato: c.nome_contato || "", email: c.email || "",
      whatsapp: c.whatsapp || "", cpf_cnpj: c.cpf_cnpj || "", data_nascimento: c.data_nascimento || "",
      sexo: c.sexo || "", observacoes: c.observacoes || "", foto_url: c.foto_url || "",
      cep: c.cep || "", rua: c.rua || "", numero: c.numero || "", complemento: c.complemento || "",
      bairro: c.bairro || "", cidade: c.cidade || "", estado: c.estado || "", pais: c.pais || "Brasil",
      origem: c.origem || c.como_conheceu || "",
    });
    setPreview(c.foto_url || null);
    setShowForm(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setPreview(URL.createObjectURL(file));
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `clientes/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setCompleto(f => ({ ...f, foto_url: data.publicUrl }));
    }
  };

  const fetchCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setCompleto(f => ({
          ...f,
          rua: data.logradouro || f.rua,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }));
      }
    } catch {}
    setCepLoading(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    let payload: any;

    if (formMode === "rapido" && !editando) {
      if (!rapido.nome.trim() || !rapido.whatsapp.trim()) { setSaving(false); return; }
      payload = {
        user_id: userId,
        nome: rapido.nome.trim(),
        whatsapp: rapido.whatsapp.trim(),
        email: rapido.email.trim() || null,
        observacoes: rapido.observacoes.trim() || null,
        data_nascimento: rapido.data_nascimento || null,
      };
      await supabase.from("clientes").insert(payload);
    } else {
      if (!completo.nome.trim()) { setSaving(false); return; }
      payload = {
        user_id: userId,
        ...completo,
        nome: completo.nome.trim(),
        foto_url: completo.foto_url || null,
        email: completo.email?.trim() || null,
        whatsapp: completo.whatsapp?.trim() || null,
        cpf_cnpj: completo.cpf_cnpj?.trim() || null,
        observacoes: completo.observacoes?.trim() || null,
        cep: completo.cep?.trim() || null,
        rua: completo.rua?.trim() || null,
        numero: completo.numero?.trim() || null,
        complemento: completo.complemento?.trim() || null,
        bairro: completo.bairro?.trim() || null,
        cidade: completo.cidade?.trim() || null,
        estado: completo.estado?.trim() || null,
        pais: completo.pais?.trim() || "Brasil",
        origem: completo.origem || null,
      };
      if (editando) await supabase.from("clientes").update(payload).eq("id", editando);
      else await supabase.from("clientes").insert(payload);
    }

    await fetchClientes(userId);
    setShowForm(false);
    setEditando(null);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    await supabase.from("clientes").delete().eq("id", id);
    await fetchClientes(userId);
    setConfirmDelete(null);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const aniversariantes = clientes
    .filter(c => c.data_nascimento && getDaysUntil(c.data_nascimento) <= 30)
    .sort((a, b) => getDaysUntil(a.data_nascimento!) - getDaysUntil(b.data_nascimento!));

  // ── Form JSX ──────────────────────────────────────────────────────────────

  const formJSX = showForm ? (
    <div className="modal-overlay" onClick={() => setShowForm(false)}>
      <div className="form-drawer" onClick={e => e.stopPropagation()}>
        <div className="form-handle" />

        {/* Header com tabs */}
        <div className="form-header">
          <h2>{editando ? "Editar cliente" : "Novo cliente"}</h2>
          <button className="form-close" onClick={() => setShowForm(false)}>✕</button>
        </div>

        {!editando && (
          <div className="form-tabs">
            <button
              className={`form-tab${formMode === "rapido" ? " form-tab--active" : ""}`}
              onClick={() => setFormMode("rapido")}
            >
              ⚡ Rápido
            </button>
            <button
              className={`form-tab${formMode === "completo" ? " form-tab--active" : ""}`}
              onClick={() => setFormMode("completo")}
            >
              📋 Completo
            </button>
          </div>
        )}

        <div className="form-scroll">

          {/* ── CADASTRO RÁPIDO ── */}
          {formMode === "rapido" && !editando && (
            <div className="form-fields">
              <div className="form-field">
                <label>Nome <span className="req">*</span></label>
                <input type="text" placeholder="Nome do cliente" value={rapido.nome} onChange={e => setRapido(f => ({...f, nome: e.target.value}))} autoComplete="off" />
              </div>
              <div className="form-field">
                <label>Telefone / WhatsApp <span className="req">*</span></label>
                <input type="tel" placeholder="(00) 9 0000-0000" value={rapido.whatsapp} onChange={e => setRapido(f => ({...f, whatsapp: e.target.value}))} autoComplete="off" />
              </div>
              <div className="form-field">
                <label>E-mail <span className="opt">opcional</span></label>
                <input type="email" placeholder="email@exemplo.com" value={rapido.email} onChange={e => setRapido(f => ({...f, email: e.target.value}))} autoComplete="off" />
              </div>
              <div className="form-field">
                <label>Data de nascimento <span className="opt">opcional</span></label>
                <input type="date" value={rapido.data_nascimento} onChange={e => setRapido(f => ({...f, data_nascimento: e.target.value}))} />
              </div>
              <div className="form-field">
                <label>Observações <span className="opt">opcional</span></label>
                <textarea placeholder="Alergias, preferências, anotações..." value={rapido.observacoes} onChange={e => setRapido(f => ({...f, observacoes: e.target.value}))} rows={3} />
              </div>
            </div>
          )}

          {/* ── CADASTRO COMPLETO ── */}
          {(formMode === "completo" || editando) && (
            <>
              {/* Foto */}
              <div className="form-avatar-wrap">
                <div className="form-avatar" onClick={() => fileRef.current?.click()}>
                  {preview
                    ? <img src={preview} alt="foto" />
                    : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary,#986274)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  }
                  <div className="form-avatar-overlay">📷</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />
                <span className="form-avatar-hint">Foto do cliente</span>
              </div>

              {/* Dados pessoais */}
              <div className="form-section-title">Dados pessoais</div>
              <div className="form-fields">
                <div className="form-field">
                  <label>Nome completo <span className="req">*</span></label>
                  <input type="text" placeholder="Nome completo" value={completo.nome} onChange={e => setCompleto(f => ({...f, nome: e.target.value}))} autoComplete="off" />
                </div>
                <div className="form-field">
                  <label>Nome para contato <span className="opt">opcional</span></label>
                  <input type="text" placeholder="Como prefere ser chamado(a)" value={completo.nome_contato} onChange={e => setCompleto(f => ({...f, nome_contato: e.target.value}))} autoComplete="off" />
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>CPF / CNPJ <span className="opt">opcional</span></label>
                    <input type="text" placeholder="000.000.000-00" value={completo.cpf_cnpj} onChange={e => setCompleto(f => ({...f, cpf_cnpj: e.target.value}))} autoComplete="off" />
                  </div>
                  <div className="form-field">
                    <label>Data de nascimento <span className="opt">opcional</span></label>
                    <input type="date" value={completo.data_nascimento} onChange={e => setCompleto(f => ({...f, data_nascimento: e.target.value}))} />
                  </div>
                </div>
                <div className="form-field">
                  <label>Sexo <span className="opt">opcional</span></label>
                  <select value={completo.sexo} onChange={e => setCompleto(f => ({...f, sexo: e.target.value}))}>
                    <option value="">Selecione...</option>
                    {SEXO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Contato */}
              <div className="form-section-title">Contato</div>
              <div className="form-fields">
                <div className="form-field">
                  <label>WhatsApp <span className="opt">opcional</span></label>
                  <input type="tel" placeholder="(00) 9 0000-0000" value={completo.whatsapp} onChange={e => setCompleto(f => ({...f, whatsapp: e.target.value}))} autoComplete="off" />
                </div>
                <div className="form-field">
                  <label>E-mail <span className="opt">opcional</span></label>
                  <input type="email" placeholder="email@exemplo.com" value={completo.email} onChange={e => setCompleto(f => ({...f, email: e.target.value}))} autoComplete="off" />
                </div>
              </div>

              {/* Endereço */}
              <div className="form-section-title">Endereço</div>
              <div className="form-fields">
                <div className="form-field">
                  <label>CEP <span className="opt">opcional</span></label>
                  <div style={{position:"relative"}}>
                    <input
                      type="text" placeholder="00000-000"
                      value={completo.cep}
                      onChange={e => {
                        setCompleto(f => ({...f, cep: e.target.value}));
                        fetchCep(e.target.value);
                      }}
                      autoComplete="off"
                      style={{width:"100%"}}
                    />
                    {cepLoading && <span style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)"}} className="spinner-sm-dark" />}
                  </div>
                </div>
                <div className="form-field">
                  <label>Rua</label>
                  <input type="text" placeholder="Logradouro" value={completo.rua} onChange={e => setCompleto(f => ({...f, rua: e.target.value}))} autoComplete="off" />
                </div>
                <div className="form-row">
                  <div className="form-field" style={{flex:"0 0 90px"}}>
                    <label>Número</label>
                    <input type="text" placeholder="Nº" value={completo.numero} onChange={e => setCompleto(f => ({...f, numero: e.target.value}))} autoComplete="off" />
                  </div>
                  <div className="form-field">
                    <label>Complemento</label>
                    <input type="text" placeholder="Apto, bloco..." value={completo.complemento} onChange={e => setCompleto(f => ({...f, complemento: e.target.value}))} autoComplete="off" />
                  </div>
                </div>
                <div className="form-field">
                  <label>Bairro</label>
                  <input type="text" placeholder="Bairro" value={completo.bairro} onChange={e => setCompleto(f => ({...f, bairro: e.target.value}))} autoComplete="off" />
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Cidade</label>
                    <input type="text" placeholder="Cidade" value={completo.cidade} onChange={e => setCompleto(f => ({...f, cidade: e.target.value}))} autoComplete="off" />
                  </div>
                  <div className="form-field" style={{flex:"0 0 80px"}}>
                    <label>UF</label>
                    <select value={completo.estado} onChange={e => setCompleto(f => ({...f, estado: e.target.value}))}>
                      <option value="">-</option>
                      {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-field">
                  <label>País</label>
                  <input type="text" placeholder="Brasil" value={completo.pais} onChange={e => setCompleto(f => ({...f, pais: e.target.value}))} autoComplete="off" />
                </div>
              </div>

              {/* Origem + Obs */}
              <div className="form-section-title">Mais informações</div>
              <div className="form-fields">
                <div className="form-field">
                  <label>Como conheceu <span className="opt">opcional</span></label>
                  <select value={completo.origem} onChange={e => setCompleto(f => ({...f, origem: e.target.value}))}>
                    <option value="">Selecione...</option>
                    {ORIGEM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Observações <span className="opt">opcional</span></label>
                  <textarea
                    placeholder="Alergias, preferências, anotações..."
                    value={completo.observacoes}
                    onChange={e => setCompleto(f => ({...f, observacoes: e.target.value}))}
                    rows={3}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="form-footer">
          {editando && (
            <button className="form-btn delete-btn" onClick={() => { setShowForm(false); setConfirmDelete(editando); }}>
              🗑️
            </button>
          )}
          <button className="form-btn cancel" onClick={() => setShowForm(false)}>Cancelar</button>
          <button
            className="form-btn save"
            onClick={handleSave}
            disabled={saving || (formMode === "rapido" && !editando ? !rapido.nome.trim() || !rapido.whatsapp.trim() : !completo.nome.trim())}
          >
            {saving ? <span className="spinner-sm" /> : editando ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="cli-root">

      {/* ═══════════════════════ MOBILE ═══════════════════════ */}
      <div className="cli-mobile">

        {/* Header */}
        <div className="mob-header">
          <div>
            <h1 className="mob-title">Clientes</h1>
            <p className="mob-subtitle">{clientes.length} cadastrado{clientes.length !== 1 ? "s" : ""}</p>
          </div>
          {aniversariantes.length > 0 && (
            <button className="mob-niver-pill" onClick={() => setShowNiver(true)}>
              🎂 {aniversariantes.length} aniversariante{aniversariantes.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Busca */}
        <div className="mob-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#9CA3AF)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text" placeholder="Buscar por nome, telefone ou e-mail..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="mob-search" autoComplete="off"
          />
          {search && (
            <button onClick={() => setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:0,lineHeight:1}}>✕</button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{textAlign:"center",padding:"3rem"}}><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="mob-empty">
            <p>{search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}</p>
            {!search && <p style={{fontSize:"0.8rem",marginTop:"0.25rem"}}>Toque em + para cadastrar</p>}
          </div>
        ) : (
          <div className="mob-list">
            {filtered.map(c => (
              <div key={c.id} className="mob-card" onClick={() => openEdit(c)}>
                <div className="mob-avatar">
                  {c.foto_url ? <img src={c.foto_url} alt={c.nome} /> : <span>{c.nome.charAt(0).toUpperCase()}</span>}
                </div>
                <div className="mob-info">
                  <p className="mob-nome">{c.nome}</p>
                  {c.whatsapp ? (
                    <a href={`https://wa.me/55${c.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="mob-whatsapp" onClick={e => e.stopPropagation()}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      {formatPhone(c.whatsapp)}
                    </a>
                  ) : c.email ? (
                    <p className="mob-email">{c.email}</p>
                  ) : (
                    <p className="mob-sem-tel">Sem contato</p>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#9CA3AF)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        )}

        {/* FAB */}
        <button className="mob-fab" onClick={() => openNew("rapido")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo cliente
        </button>

        {/* Modal aniversariantes */}
        {showNiver && (
          <div className="modal-overlay" onClick={() => setShowNiver(false)}>
            <div className="mob-modal" onClick={e => e.stopPropagation()}>
              <div className="form-handle" />
              <div className="form-header">
                <h2>🎂 Aniversariantes</h2>
                <button className="form-close" onClick={() => setShowNiver(false)}>✕</button>
              </div>
              <div style={{padding:"0 1.25rem 1.5rem",overflowY:"auto",maxHeight:"60vh"}}>
                {aniversariantes.length === 0 ? (
                  <p style={{color:"var(--text-muted)",textAlign:"center",padding:"2rem"}}>Nenhum nos próximos 30 dias</p>
                ) : aniversariantes.map(c => {
                  const nasc = new Date(c.data_nascimento!);
                  const diff = getDaysUntil(c.data_nascimento!);
                  const hours = getHoursUntil(c.data_nascimento!);
                  return (
                    <div key={c.id} className="cli-aniv-item" style={{marginBottom:"0.5rem"}}>
                      <div className="cli-aniv-avatar">
                        {c.foto_url ? <img src={c.foto_url} alt={c.nome} /> : <span>{c.nome.charAt(0)}</span>}
                      </div>
                      <div className="cli-aniv-info">
                        <p className="cli-aniv-nome">{c.nome}</p>
                        <p className="cli-aniv-data">
                          Faz aniversário dia {nasc.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                        </p>
                      </div>
                      <span className={`cli-aniv-badge${diff <= 7 ? " soon" : ""}`}>
                        {diff === 0 ? "🎉 Hoje!" : hours <= 24 ? `${hours}h` : `${diff} dias`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════ DESKTOP ═══════════════════════ */}
      <div className="cli-desktop">
        <div className="cli-layout">
          <div className="cli-main">
            <div className="cli-topbar">
              <button className="cli-btn-new" onClick={() => openNew("rapido")}>⚡ Cadastro rápido</button>
              <button className="cli-btn-completo" onClick={() => openNew("completo")}>📋 Cadastro completo</button>
              <div className="cli-search-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#9CA3AF)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Buscar por nome, telefone ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="cli-search" autoComplete="off" />
              </div>
            </div>
            {loading ? (
              <div className="cli-loading"><span className="spinner" /></div>
            ) : filtered.length === 0 ? (
              <div className="cli-empty"><p>Nenhum cliente encontrado</p></div>
            ) : (
              <div className="cli-list">
                {filtered.map(c => (
                  <div key={c.id} className="cli-card" onClick={() => openEdit(c)} style={{cursor:"pointer"}}>
                    <div className="cli-avatar">
                      {c.foto_url ? <img src={c.foto_url} alt={c.nome} /> : <span>{c.nome.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="cli-info">
                      <p className="cli-nome">{c.nome}{c.nome_contato ? <span style={{fontWeight:400,color:"var(--text-muted)",fontSize:"0.82rem"}}> · {c.nome_contato}</span> : null}</p>
                      <div style={{display:"flex",gap:"0.75rem",alignItems:"center",flexWrap:"wrap"}}>
                        {c.whatsapp && (
                          <a href={`https://wa.me/55${c.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="cli-whatsapp-link" onClick={e => e.stopPropagation()}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            {formatPhone(c.whatsapp)}
                          </a>
                        )}
                        {c.email && <span style={{fontSize:"0.78rem",color:"var(--text-muted)"}}>{c.email}</span>}
                        {c.cidade && <span style={{fontSize:"0.78rem",color:"var(--text-muted)"}}>{c.cidade}{c.estado ? `/${c.estado}` : ""}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar aniversariantes */}
          <div className="cli-sidebar">
            {aniversariantes.length > 0 && (
              <div className="cli-panel">
                <p className="cli-panel-title">🎂 Aniversariantes</p>
                {aniversariantes.map(c => {
                  const nasc = new Date(c.data_nascimento!);
                  const diff = getDaysUntil(c.data_nascimento!);
                  const hours = getHoursUntil(c.data_nascimento!);
                  return (
                    <div key={c.id} className="cli-aniv-item">
                      <div className="cli-aniv-avatar">
                        {c.foto_url ? <img src={c.foto_url} alt={c.nome} /> : <span>{c.nome.charAt(0)}</span>}
                      </div>
                      <div className="cli-aniv-info">
                        <p className="cli-aniv-nome">{c.nome}</p>
                        <p className="cli-aniv-data">{nasc.toLocaleDateString("pt-BR",{day:"2-digit",month:"long"})}</p>
                      </div>
                      <span className={`cli-aniv-badge${diff <= 7 ? " soon" : ""}`}>
                        {diff === 0 ? "🎉 Hoje!" : hours <= 24 ? `${hours}h` : `${diff}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════ MODAIS COMPARTILHADOS ═══════════════════════ */}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Excluir cliente?</h3>
            <p>Esta ação não pode ser desfeita.</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="modal-btn confirm" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {formJSX}

      {/* ═══════════════════════ STYLES ═══════════════════════ */}
      <style>{`
        * { box-sizing: border-box; }
        .cli-root { font-family: var(--font-base, 'Geist', sans-serif); }

        .cli-mobile  { display: flex; flex-direction: column; gap: 0.75rem; }
        .cli-desktop { display: none; }
        @media (min-width: 768px) { .cli-mobile { display: none; } .cli-desktop { display: block; } }

        /* ── Mobile ────────────────────────── */
        .mob-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0 0.25rem; }
        .mob-title  { font-size: 1.4rem; font-weight: 700; color: var(--text-title,#1F2937); margin: 0; }
        .mob-subtitle { font-size: 0.78rem; color: var(--text-muted,#9CA3AF); margin: 0.1rem 0 0; }

        .mob-niver-pill { display: flex; align-items: center; gap: 0.3rem; background: var(--primary-light,#FFF1F7); color: var(--primary,#FF6FA9); border: 1.5px solid var(--primary-light,#FEE2EE); border-radius: 999px; padding: 0.4rem 0.85rem; font-size: 0.75rem; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .mob-niver-pill:active { background: #FEE2EE; }

        .mob-search-wrap { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-card,#FFF); border: 1.5px solid var(--border,#E9E9EE); border-radius: 12px; padding: 0.7rem 1rem; }
        .mob-search  { border: none; outline: none; flex: 1; font-family: inherit; font-size: 0.9rem; color: var(--text-title,#1F2937); background: transparent; }
        .mob-search::placeholder { color: var(--text-muted,#9CA3AF); }

        .mob-empty   { text-align: center; padding: 3rem 1rem; color: var(--text-muted,#9CA3AF); font-size: 0.9rem; }
        .mob-list    { display: flex; flex-direction: column; gap: 0.5rem; padding-bottom: 5.5rem; }

        .mob-card    { display: flex; align-items: center; gap: 0.85rem; background: var(--bg-card,#FFF); border-radius: 14px; padding: 0.75rem 1rem; border: 1px solid var(--border,#E9E9EE); cursor: pointer; }
        .mob-card:active { background: var(--bg-body,#F7F7F8); }
        .mob-avatar  { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; background: var(--primary-light,#FFF1F7); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 700; color: var(--primary,#FF6FA9); overflow: hidden; }
        .mob-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .mob-info    { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
        .mob-nome    { font-size: 0.92rem; font-weight: 600; color: var(--text-title,#1F2937); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mob-whatsapp { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; color: #25D366; font-weight: 500; text-decoration: none; }
        .mob-email   { font-size: 0.78rem; color: var(--text-muted,#9CA3AF); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mob-sem-tel { font-size: 0.78rem; color: var(--text-muted,#9CA3AF); margin: 0; }

        .mob-fab { position: fixed; bottom: 5.5rem; right: 1.25rem; display: flex; align-items: center; gap: 0.5rem; background: #3d1a24; color: white; border: none; border-radius: 999px; padding: 0.75rem 1.25rem; font-family: inherit; font-size: 0.9rem; font-weight: 600; box-shadow: 0 4px 20px rgba(61,26,36,0.35); cursor: pointer; z-index: 40; transition: transform 0.15s; }
        .mob-fab:active { transform: scale(0.96); }

        .mob-modal   { background: var(--bg-card,#FFF); border-radius: 24px 24px 0 0; width: 100%; max-height: 85vh; display: flex; flex-direction: column; position: fixed; bottom: 0; left: 0; right: 0; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }

        /* ── Desktop ────────────────────────── */
        .cli-layout  { display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; align-items: start; }
        .cli-main    { min-width: 0; }
        .cli-sidebar { display: flex; flex-direction: column; gap: 1rem; padding-top: 4.5rem; }
        .cli-topbar  { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }

        .cli-btn-new     { padding: 0.75rem 1.1rem; background: #3d1a24; color: white; border: none; border-radius: 10px; font-family: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .cli-btn-completo{ padding: 0.75rem 1.1rem; background: var(--bg-card,#FFF); color: var(--text-title,#1F2937); border: 1.5px solid var(--border,#E9E9EE); border-radius: 10px; font-family: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .cli-btn-completo:hover { border-color: #3d1a24; color: #3d1a24; }

        .cli-search-wrap { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-card,#FFF); border: 1.5px solid var(--border,#E9E9EE); border-radius: 10px; padding: 0.75rem 1rem; flex: 1; min-width: 200px; }
        .cli-search      { border: none; outline: none; flex: 1; font-family: inherit; font-size: 0.9rem; color: var(--text-title,#1F2937); background: transparent; }
        .cli-search::placeholder { color: var(--text-muted,#9CA3AF); }

        .cli-loading { display: flex; justify-content: center; padding: 3rem; }
        .cli-empty   { text-align: center; padding: 3rem; color: var(--text-muted,#9CA3AF); }
        .cli-list    { display: flex; flex-direction: column; gap: 0.6rem; }

        .cli-card    { display: flex; align-items: center; gap: 0.9rem; background: var(--bg-card,#FFF); border-radius: 14px; padding: 0.75rem 1rem; border: 1px solid var(--border,#E9E9EE); transition: box-shadow 0.2s; }
        .cli-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .cli-avatar  { width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0; background: var(--primary-light,#FFF1F7); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700; color: var(--primary,#FF6FA9); overflow: hidden; }
        .cli-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cli-info    { flex: 1; min-width: 0; }
        .cli-nome    { font-size: 0.95rem; font-weight: 600; color: var(--text-title,#1F2937); margin: 0 0 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cli-whatsapp-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: #25D366; font-weight: 500; text-decoration: none; }
        .cli-whatsapp-link:hover { text-decoration: underline; }

        .cli-panel   { background: var(--bg-card,#FFF); border-radius: 14px; padding: 1rem 1.1rem; border: 1px solid var(--border,#E9E9EE); }
        .cli-panel-title { font-size: 0.9rem; font-weight: 700; color: var(--text-title,#1F2937); margin: 0 0 0.75rem; }

        .cli-aniv-item   { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; margin-bottom: 0.5rem; border-radius: 12px; background: linear-gradient(135deg,#1a1a2e,#16213e); overflow: hidden; }
        .cli-aniv-item:last-child { margin-bottom: 0; }
        .cli-aniv-avatar { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 700; color: #ffd700; overflow: hidden; }
        .cli-aniv-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cli-aniv-info   { flex: 1; min-width: 0; }
        .cli-aniv-nome   { font-size: 0.82rem; font-weight: 600; color: #fff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cli-aniv-data   { font-size: 0.72rem; color: rgba(255,215,0,0.7); margin: 0; }
        .cli-aniv-badge  { font-size: 0.72rem; font-weight: 700; color: #1a1a2e; background: linear-gradient(135deg,#ffd700,#ffa500); padding: 0.25rem 0.6rem; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
        .cli-aniv-badge.soon { background: var(--primary-gradient,linear-gradient(135deg,#FF6FA9,#F85A9A)); color: #fff; }

        /* ── Formulário ─────────────────────── */
        .modal-overlay  { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; touch-action: none; }
        @media (min-width: 768px) { .modal-overlay { align-items: center; padding: 1rem; } }

        .form-drawer    { background: var(--bg-card,#FFF); border-radius: 24px 24px 0 0; width: 100%; max-height: 92vh; display: flex; flex-direction: column; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }
        @media (min-width: 768px) { .form-drawer { border-radius: 20px; max-width: 560px; max-height: 88vh; animation: fadeScale 0.25s ease; } }
        @keyframes slideUp   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

        .form-handle    { width: 40px; height: 4px; background: var(--border,#E9E9EE); border-radius: 2px; margin: 0.75rem auto 0; flex-shrink: 0; }
        .form-header    { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem 0.5rem; flex-shrink: 0; }
        .form-header h2 { font-size: 1.1rem; font-weight: 700; color: var(--text-title,#1F2937); margin: 0; }
        .form-close     { background: var(--bg-body,#F7F7F8); border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }

        .form-tabs      { display: flex; gap: 0.5rem; padding: 0 1.25rem 0.75rem; flex-shrink: 0; }
        .form-tab       { flex: 1; padding: 0.6rem; border-radius: 10px; border: 1.5px solid var(--border,#E9E9EE); background: var(--bg-body,#F7F7F8); font-family: inherit; font-size: 0.88rem; font-weight: 600; color: var(--text-secondary,#6B7280); cursor: pointer; transition: all 0.15s; }
        .form-tab--active { background: #3d1a24; color: white; border-color: #3d1a24; }

        .form-scroll    { flex: 1; overflow-y: auto; padding: 0 1.25rem 0.5rem; }

        .form-section-title { font-size: 0.72rem; font-weight: 700; color: var(--text-muted,#9CA3AF); text-transform: uppercase; letter-spacing: 0.1em; margin: 1.25rem 0 0.75rem; }

        .form-fields    { display: flex; flex-direction: column; gap: 0.85rem; }
        .form-row       { display: flex; gap: 0.75rem; }
        .form-row .form-field { flex: 1; }

        .form-field     { display: flex; flex-direction: column; gap: 0.3rem; }
        .form-field label { font-size: 0.82rem; font-weight: 500; color: var(--text-primary,#374151); }
        .form-field input, .form-field select, .form-field textarea { padding: 0.65rem 0.9rem; border: 1.5px solid var(--border,#E9E9EE); border-radius: 8px; font-family: inherit; font-size: 0.9rem; color: var(--text-title,#1F2937); outline: none; transition: border-color 0.2s; background: var(--bg-card,#FFF); resize: none; width: 100%; }
        .form-field input:focus, .form-field select:focus, .form-field textarea:focus { border-color: #3d1a24; }

        .req { color: var(--error,#EF4444); font-size: 0.78rem; }
        .opt { color: var(--text-muted,#9CA3AF); font-size: 0.72rem; font-weight: 400; }

        .form-avatar-wrap    { display: flex; flex-direction: column; align-items: center; margin: 0.75rem 0 0.5rem; gap: 0.4rem; }
        .form-avatar         { width: 80px; height: 80px; border-radius: 50%; border: 2px dashed var(--border,#E9E9EE); background: var(--bg-body,#F7F7F8); display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; }
        .form-avatar img     { width: 100%; height: 100%; object-fit: cover; }
        .form-avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; opacity: 0; transition: opacity 0.2s; }
        .form-avatar:hover .form-avatar-overlay { opacity: 1; }
        .form-avatar-hint    { font-size: 0.78rem; color: var(--text-muted,#9CA3AF); }

        .form-footer    { display: flex; gap: 0.75rem; padding: 0.75rem 1.25rem 1.25rem; border-top: 1px solid var(--border,#E9E9EE); flex-shrink: 0; }
        .form-btn       { flex: 1; padding: 0.8rem; border-radius: 10px; border: none; font-family: inherit; font-size: 0.95rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.15s; }
        .form-btn.cancel    { background: var(--bg-body,#F7F7F8); color: var(--text-secondary,#6B7280); }
        .form-btn.save      { background: #3d1a24; color: white; }
        .form-btn.save:disabled { opacity: 0.5; cursor: not-allowed; }
        .form-btn.delete-btn { background: #fff1f2; color: var(--error,#EF4444); flex: 0 0 auto; padding: 0.8rem 1rem; }

        /* ── Modal confirmação ──────────────── */
        .modal-box      { background: var(--bg-card,#FFF); border-radius: 16px; padding: 1.5rem; width: 90%; max-width: 360px; text-align: center; }
        .modal-box h3   { font-size: 1rem; font-weight: 600; color: var(--text-title,#1F2937); margin-bottom: 0.4rem; }
        .modal-box p    { font-size: 0.85rem; color: var(--text-muted,#9CA3AF); margin-bottom: 1.25rem; }
        .modal-actions  { display: flex; gap: 0.75rem; }
        .modal-btn      { flex: 1; padding: 0.7rem; border-radius: 8px; border: none; font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
        .modal-btn.cancel  { background: var(--bg-body,#F7F7F8); color: var(--text-secondary,#6B7280); }
        .modal-btn.confirm { background: var(--error,#EF4444); color: white; }

        /* ── Spinners ───────────────────────── */
        .spinner         { width: 24px; height: 24px; border: 2px solid var(--border,#E9E9EE); border-top-color: #3d1a24; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        .spinner-sm      { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        .spinner-sm-dark { width: 16px; height: 16px; border: 2px solid var(--border,#E9E9EE); border-top-color: #3d1a24; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin  { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
