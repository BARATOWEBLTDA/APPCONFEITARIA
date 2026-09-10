import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface Cliente {
  id: string;
  user_id: string;
  nome: string;
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
  origem?: string;
  como_conheceu?: string;
  created_at: string;
}

interface Pedido {
  id: string;
  numero?: number;
  nome_cliente?: string;
  cliente_id?: string;
  data_entrega?: string;
  data_pedido?: string;
  created_at?: string;
  valor_total?: number;
  status?: string;
  produtos?: any;
}

function formatPhone(phone?: string) {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
}

function getIniciais(nome?: string) {
  if (!nome) return "?";
  return nome.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("") || "?";
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

function daysSince(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "hoje";
  if (diff === 1) return "há 1 dia";
  if (diff < 30) return `há ${diff} dias`;
  if (diff < 60) return "há 1 mês";
  if (diff < 365) return `há ${Math.floor(diff / 30)} meses`;
  return `há ${Math.floor(diff / 365)} anos`;
}

function daysUntilBirthday(data?: string) {
  if (!data) return null;
  const nasc = new Date(data);
  const hoje = new Date();
  const aniv = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (aniv < hoje) aniv.setFullYear(hoje.getFullYear() + 1);
  return Math.ceil((aniv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  entregue: { label: "Entregue", className: "cp-status-ok" },
  finalizado: { label: "Entregue", className: "cp-status-ok" },
  confirmado: { label: "Confirmado", className: "cp-status-pend" },
  novo: { label: "Novo", className: "cp-status-pend" },
  producao: { label: "Em produção", className: "cp-status-pend" },
  pronto: { label: "Pronto", className: "cp-status-pend" },
  cancelado: { label: "Cancelado", className: "cp-status-cancel" },
};

export default function ClientePerfil() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Carrega cliente
      const { data: cData } = await supabase.from("clientes").select("*").eq("id", id).single();
      if (cData) setCliente(cData);

      // Carrega pedidos deste cliente (busca por cliente_id OU por nome_cliente)
      if (cData) {
        const { data: pData } = await supabase
          .from("pedidos")
          .select("*")
          .eq("user_id", user.id)
          .or(`cliente_id.eq.${id},nome_cliente.eq.${cData.nome}`)
          .order("created_at", { ascending: false });
        if (pData) setPedidos(pData);
      }

      setLoading(false);
    };
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!cliente) return;
    await supabase.from("clientes").delete().eq("id", cliente.id);
    navigate("/clientes");
  };

  const handleWhatsApp = () => {
    if (!cliente?.whatsapp) return;
    const d = cliente.whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/55${d}`, "_blank");
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cliente) return;
    setUploadingFoto(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `clientes/${cliente.user_id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (error) {
      alert("Erro ao enviar foto: " + error.message);
      setUploadingFoto(false);
      return;
    }
    const { data } = supabase.storage.from("profiles").getPublicUrl(path);
    // Atualiza cliente no banco
    await supabase.from("clientes").update({ foto_url: data.publicUrl }).eq("id", cliente.id);
    setCliente({ ...cliente, foto_url: data.publicUrl });
    setUploadingFoto(false);
  };

  if (loading) return (
    <div style={{ minHeight: "calc(100vh - 5rem)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 32, height: 32, border: "3px solid var(--primary-light)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "cpSpin 0.7s linear infinite", display: "inline-block" }} />
      <style>{`@keyframes cpSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!cliente) return (
    <div style={{ padding: "2rem", textAlign: "center", fontFamily: "var(--font-base)" }}>
      <p style={{ color: "var(--text-secondary)" }}>Cliente não encontrado.</p>
      <button onClick={() => navigate("/clientes")} style={{ marginTop: 16, background: "var(--primary)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, fontWeight: 800, cursor: "pointer" }}>← Voltar</button>
    </div>
  );

  const iniciais = getIniciais(cliente.nome);
  const diasAniv = daysUntilBirthday(cliente.data_nascimento);
  const totalGasto = pedidos.filter(p => p.status !== "cancelado").reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const pedidosValidos = pedidos.filter(p => p.status !== "cancelado");
  const ticketMedio = pedidosValidos.length > 0 ? totalGasto / pedidosValidos.length : 0;
  const ultimaCompra = pedidosValidos[0];
  const enderecoCompleto = [cliente.rua, cliente.numero].filter(Boolean).join(", ");
  const localizacao = [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" • ");
  const temEndereco = !!(cliente.rua || cliente.cep || cliente.cidade);

  const goToEdit = (section: string = "essencial") => {
    navigate(`/clientes?edit=${cliente.id}&section=${section}`);
  };

  return (
    <div className="cp-root">
      {/* ═══ Header rosa ═══ */}
      <div className="cp-hero">
        <button className="cp-back" onClick={() => navigate("/clientes")} aria-label="Voltar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>

        <div className="cp-avatar-wrap" onClick={() => fileRef.current?.click()} title="Trocar foto">
          {cliente.foto_url
            ? <img src={cliente.foto_url} alt={cliente.nome} className="cp-avatar cp-avatar--img" />
            : <div className="cp-avatar">{iniciais}</div>
          }
          <span className="cp-avatar-cam" aria-hidden="true">
            {uploadingFoto ? <span className="cp-cam-spinner" /> : "📷"}
          </span>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFotoUpload} style={{display:"none"}} />
        </div>
        <h1 className="cp-name">{cliente.nome}</h1>
        {cliente.whatsapp && <p className="cp-phone">{formatPhone(cliente.whatsapp)}</p>}

        <div className="cp-badges">
          {diasAniv !== null && diasAniv <= 30 && (
            <span className="cp-badge">🎂 {cliente.data_nascimento?.split("-").reverse().slice(0,2).join("/")} (em {diasAniv} dias)</span>
          )}
          {cliente.cidade && <span className="cp-badge">📍 {cliente.cidade}</span>}
          {(cliente.origem || cliente.como_conheceu) && <span className="cp-badge">📱 {cliente.origem || cliente.como_conheceu}</span>}
          {pedidosValidos.length >= 3 && <span className="cp-badge">👑 Top cliente</span>}
        </div>
      </div>

      {/* ═══ Ações principais (só 2 botões) ═══ */}
      <div className="cp-actions">
        <button className="cp-btn cp-btn-wa" onClick={handleWhatsApp} disabled={!cliente.whatsapp}>
          <span>💬</span> WhatsApp
        </button>
        <button className="cp-btn cp-btn-edit" onClick={() => goToEdit("all")}>
          <span>✏️</span> Editar
        </button>
      </div>

      {/* ═══ Cards ═══ */}
      <div className="cp-content">
        {/* Card ÚNICO: Dados do Cliente (juntou dados + endereço + observações) */}
        <div className="cp-card">
          <div className="cp-card-head">
            <div className="cp-card-t"><span>👤</span> Dados do Cliente</div>
          </div>

          {/* Dados pessoais */}
          {cliente.data_nascimento && (
            <div className="cp-row">
              <div className="cp-row-lbl">Aniversário</div>
              <div className="cp-row-val">
                {cliente.data_nascimento.split("-").reverse().join("/")}
                {diasAniv !== null && diasAniv <= 30 && <span style={{ color: "var(--primary)", marginLeft: 6 }}>(em {diasAniv}d)</span>}
              </div>
            </div>
          )}
          {cliente.sexo && <div className="cp-row"><div className="cp-row-lbl">Sexo</div><div className="cp-row-val">{cliente.sexo}</div></div>}
          {cliente.email && <div className="cp-row"><div className="cp-row-lbl">E-mail</div><div className="cp-row-val">{cliente.email}</div></div>}
          {cliente.cpf_cnpj && <div className="cp-row"><div className="cp-row-lbl">CPF/CNPJ</div><div className="cp-row-val">{cliente.cpf_cnpj}</div></div>}

          {/* Endereço + Mapa lado a lado */}
          {temEndereco && (
            <>
              <div className="cp-sub-lbl">📍 Endereço</div>
              <div className="cp-endereco-row">
                <div className="cp-endereco-info">
                  {enderecoCompleto && <div className="cp-endereco-street"><b>{enderecoCompleto}</b></div>}
                  {cliente.complemento && <div className="cp-endereco-sec">{cliente.complemento}</div>}
                  {localizacao && <div className="cp-endereco-sec">{localizacao}</div>}
                  {cliente.cep && <div className="cp-endereco-sec" style={{fontSize: "var(--text-xs)"}}>CEP: {cliente.cep}</div>}
                </div>
                {import.meta.env.VITE_GOOGLE_MAPS_KEY && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([enderecoCompleto, localizacao].filter(Boolean).join(", "))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cp-mini-map-wrap"
                    aria-label="Abrir no Google Maps"
                  >
                    <iframe
                      className="cp-mini-map"
                      loading="lazy"
                      src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&q=${encodeURIComponent([enderecoCompleto, localizacao].filter(Boolean).join(", "))}`}
                      allowFullScreen
                      title="Mapa"
                    />
                    <span className="cp-mini-map-overlay">↗</span>
                  </a>
                )}
              </div>
            </>
          )}

          {/* Observações */}
          <div className="cp-sub-lbl">📝 Observações</div>
          {cliente.observacoes ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-title)", padding: "4px 0 6px", lineHeight: 1.5 }}>
              {cliente.observacoes}
            </div>
          ) : (
            <div className="cp-empty" style={{ padding: "6px 0 4px", textAlign: "left" }}>
              Sem observações.
            </div>
          )}

          {!cliente.data_nascimento && !cliente.sexo && !cliente.email && !cliente.cpf_cnpj && !temEndereco && !cliente.observacoes && (
            <div className="cp-empty">Nenhum dado extra cadastrado ainda.<br/>Clique em Editar pra completar.</div>
          )}
        </div>

        {/* Card: Histórico de Compras (destaque) */}
        <div className="cp-card cp-card--highlight">
          <div className="cp-card-head">
            <div className="cp-card-t"><span>🛍️</span> Histórico de Compras</div>
            <div className="cp-card-count">{pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""}</div>
          </div>

          {pedidos.length > 0 ? (
            <>
              <div className="cp-stats">
                <div className="cp-stat">
                  <div className="cp-stat-v cp-stat-v--green">{formatBRL(totalGasto)}</div>
                  <div className="cp-stat-l">Total gasto</div>
                </div>
                <div className="cp-stat">
                  <div className="cp-stat-v">{formatBRL(ticketMedio)}</div>
                  <div className="cp-stat-l">Ticket médio</div>
                </div>
                {ultimaCompra && (
                  <div className="cp-stat">
                    <div className="cp-stat-v cp-stat-v--pink">{daysSince(ultimaCompra.created_at || ultimaCompra.data_pedido || new Date().toISOString())}</div>
                    <div className="cp-stat-l">Última compra</div>
                  </div>
                )}
              </div>

              <div className="cp-pedidos">
                <div className="cp-pedidos-lbl">Últimos pedidos</div>
                {pedidos.slice(0, 5).map((p, i) => {
                  const st = STATUS_MAP[p.status || ""] || { label: p.status || "-", className: "cp-status-pend" };
                  return (
                    <div key={p.id || i} className="cp-pedido-item" onClick={() => navigate(`/pedidos`)}>
                      <div className="cp-pedido-info">
                        <div className="cp-pedido-nome">
                          {p.numero ? `Pedido #${p.numero}` : (p.produtos && typeof p.produtos === "string" ? p.produtos.slice(0, 40) : "Pedido")}
                        </div>
                        <div className="cp-pedido-data">
                          {formatDate(p.created_at || p.data_pedido || new Date().toISOString())}
                          <span className={`cp-status ${st.className}`}>{st.label}</span>
                        </div>
                      </div>
                      <div className="cp-pedido-valor">{formatBRL(p.valor_total || 0)}</div>
                    </div>
                  );
                })}
                {pedidos.length > 5 && (
                  <button className="cp-ver-todos" onClick={() => navigate("/pedidos")}>
                    Ver todos os {pedidos.length} pedidos →
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="cp-empty" style={{ padding: "16px 0" }}>
              Nenhum pedido registrado ainda
              <br/>
              <button onClick={() => navigate("/pedidos")} style={{ marginTop: 8, color: "var(--primary)", fontSize: "var(--text-xs)", fontWeight: 800, background: "transparent", border: "none", cursor: "pointer" }}>
                Criar primeiro pedido →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Modal confirmar excluir ═══ */}
      {confirmDelete && (
        <div className="cp-modal-ov" onClick={() => setConfirmDelete(false)}>
          <div className="cp-modal-box" onClick={e => e.stopPropagation()}>
            <h3>Excluir cliente?</h3>
            <p>Essa ação não pode ser desfeita. Os pedidos associados NÃO serão excluídos.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button className="cp-modal-btn cp-modal-btn--cancel" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button className="cp-modal-btn cp-modal-btn--danger" onClick={handleDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cp-root, .cp-root * { font-family: var(--font-base); }
        .cp-root {
          padding: 0 0 6rem;
          background: var(--bg-body);
          min-height: 100vh;
        }

        /* ═══ Hero rosa ═══ */
        .cp-hero {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: var(--text-inverse);
          padding: calc(var(--space-6) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-5);
          text-align: center;
          position: relative;
          /* Escape do padding do .layout-main pra pegar 100% da largura e topo */
          margin: calc(-1 * (var(--pad-page-top) + env(safe-area-inset-top, 0px))) calc(-1 * var(--space-2)) 0;
        }
        .cp-back {
          position: absolute;
          top: var(--space-3); left: var(--space-3);
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(255,255,255,0.2);
          color: var(--text-inverse);
          border: none;
          padding: 6px 12px;
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          font-weight: var(--fw-bold);
          cursor: pointer;
          font-family: var(--font-base) !important;
          transition: background var(--dur-fast);
        }
        .cp-back:hover { background: rgba(255,255,255,0.3); }

        .cp-avatar-wrap {
          margin: 0 auto var(--space-2);
          display: inline-block;
          position: relative;
          cursor: pointer;
        }
        .cp-avatar {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: rgba(255,255,255,0.25);
          border: 3px solid var(--text-inverse);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-2xl);
          font-weight: var(--fw-black);
          color: var(--text-inverse);
        }
        .cp-avatar--img { object-fit: cover; }
        .cp-avatar-cam {
          position: absolute;
          bottom: 0; right: -2px;
          width: 28px; height: 28px;
          border-radius: 50%;
          background: var(--bg-card);
          color: var(--primary);
          display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--primary);
          font-size: 13px;
          cursor: pointer;
          transition: transform var(--dur-fast);
        }
        .cp-avatar-wrap:hover .cp-avatar-cam { transform: scale(1.1); }
        .cp-cam-spinner {
          width: 14px; height: 14px;
          border: 2px solid var(--primary-light);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .cp-name {
          font-size: var(--text-xl);
          font-weight: var(--fw-black);
          letter-spacing: -0.02em;
          margin: 0;
        }
        .cp-phone {
          font-size: var(--text-sm);
          opacity: 0.9;
          margin: 4px 0 0;
        }
        .cp-badges {
          display: flex; gap: var(--space-1); justify-content: center;
          margin-top: var(--space-3);
          flex-wrap: wrap;
        }
        .cp-badge {
          background: rgba(255,255,255,0.25);
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          font-weight: var(--fw-bold);
        }

        /* ═══ Ações ═══ */
        .cp-actions {
          display: flex; gap: var(--space-2);
          padding: var(--space-4) var(--space-4) var(--space-3);
          background: var(--bg-body);
        }
        .cp-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          cursor: pointer;
          font-family: var(--font-base) !important;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 6px;
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .cp-btn:active:not(:disabled) { transform: translateY(3px); }
        .cp-btn-wa {
          background: #22C55E;
          color: var(--text-inverse);
          box-shadow: 0 4px 0 #15803D;
        }
        .cp-btn-wa:active:not(:disabled) { box-shadow: 0 1px 0 #15803D; }
        .cp-btn-wa:disabled { opacity: 0.5; cursor: not-allowed; }
        .cp-btn-edit {
          background: var(--accent, #2D1F26);
          color: var(--text-inverse);
          box-shadow: 0 4px 0 #1a1017;
        }
        .cp-btn-edit:active { box-shadow: 0 1px 0 #1a1017; }
        /* .cp-btn-del removido — botão excluir agora vive no modal de edição */

        /* ═══ Cards ═══ */
        .cp-content {
          padding: 0 var(--space-4);
          display: flex; flex-direction: column;
          gap: var(--space-3);
        }

        /* Sub-label dentro do card (endereço, obs) */
        .cp-sub-lbl {
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: var(--space-3) 0 var(--space-2);
          padding-top: var(--space-3);
          border-top: 1px dashed var(--border);
        }
        .cp-card > .cp-sub-lbl:first-of-type { padding-top: var(--space-3); }

        /* Endereço + Mini mapa lado a lado */
        .cp-endereco-row {
          display: grid;
          grid-template-columns: 1fr 130px;
          gap: var(--space-3);
          align-items: start;
        }
        .cp-endereco-info {
          font-size: var(--text-sm);
          color: var(--text-title);
          line-height: 1.5;
        }
        .cp-endereco-street { color: var(--text-title); }
        .cp-endereco-sec { color: var(--text-secondary); margin-top: 2px; }
        .cp-mini-map-wrap {
          position: relative;
          display: block;
          width: 130px; height: 100px;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 1.5px solid var(--border);
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
          text-decoration: none;
        }
        .cp-mini-map {
          width: 100%; height: 100%;
          border: 0;
          pointer-events: none;
        }
        .cp-mini-map-overlay {
          position: absolute;
          top: 4px; right: 4px;
          background: rgba(255,255,255,0.95);
          color: var(--primary);
          width: 22px; height: 22px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px;
          font-weight: 900;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        @media (min-width: 600px) {
          .cp-mini-map-wrap { width: 160px; height: 110px; }
          .cp-endereco-row { grid-template-columns: 1fr 160px; }
        }
        .cp-card {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-3) var(--space-4);
          display: flex; flex-direction: column;
          gap: 4px;
        }
        .cp-card--highlight {
          background: linear-gradient(180deg, var(--accent-bg, #F5EEF0), var(--bg-card));
          border-color: var(--primary-light);
        }
        .cp-card-head {
          display: flex; justify-content: space-between; align-items: center;
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--border);
          margin-bottom: 4px;
        }
        .cp-card-t {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          color: var(--text-title);
          display: flex; align-items: center; gap: 6px;
        }
        .cp-card-edit {
          color: var(--primary);
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          padding: 4px 10px;
          border: 1.5px solid var(--primary);
          border-radius: var(--radius-full);
          background: transparent;
          cursor: pointer;
          font-family: var(--font-base) !important;
          transition: background var(--dur-fast);
        }
        .cp-card-edit:hover { background: var(--primary); color: var(--text-inverse); }
        .cp-card-count {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          font-weight: var(--fw-bold);
        }

        .cp-row {
          display: flex; justify-content: space-between;
          padding: 6px 0;
          font-size: var(--text-sm);
          border-bottom: 1px dashed var(--border);
        }
        .cp-row:last-child { border-bottom: none; }
        .cp-row-lbl { color: var(--text-secondary); }
        .cp-row-val { color: var(--text-title); font-weight: var(--fw-bold); text-align: right; }

        .cp-empty {
          font-size: var(--text-sm);
          color: var(--text-muted);
          font-style: italic;
          text-align: center;
          padding: var(--space-2) 0;
        }

        /* ═══ Stats do histórico ═══ */
        .cp-stats {
          display: flex; justify-content: space-around;
          padding: var(--space-3) 0;
          gap: var(--space-2);
        }
        .cp-stat {
          flex: 1; text-align: center;
          min-width: 0;
        }
        .cp-stat-v {
          font-size: var(--text-lg);
          font-weight: var(--fw-black);
          color: var(--text-title);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cp-stat-v--green { color: #16A34A; }
        .cp-stat-v--pink { color: var(--primary); }
        .cp-stat-l {
          font-size: 0.65rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: var(--fw-bold);
          margin-top: 4px;
        }

        /* ═══ Lista pedidos ═══ */
        .cp-pedidos {
          border-top: 1px dashed var(--border);
          padding-top: var(--space-2);
        }
        .cp-pedidos-lbl {
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-2);
        }
        .cp-pedido-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--space-2) 0;
          border-bottom: 1px dashed var(--border);
          cursor: pointer;
          transition: background var(--dur-fast);
          margin: 0 -8px;
          padding-left: 8px;
          padding-right: 8px;
          border-radius: var(--radius-sm);
        }
        .cp-pedido-item:hover { background: var(--bg-subtle); }
        .cp-pedido-item:last-child { border-bottom: none; }
        .cp-pedido-info { flex: 1; min-width: 0; }
        .cp-pedido-nome {
          font-size: var(--text-sm);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cp-pedido-data {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-top: 2px;
          display: flex; align-items: center; gap: 6px;
        }
        .cp-pedido-valor {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          color: #16A34A;
          font-variant-numeric: tabular-nums;
        }
        .cp-status {
          display: inline-block;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: 0.6rem;
          font-weight: var(--fw-black);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .cp-status-ok { background: #DCFCE7; color: #14532D; }
        .cp-status-pend { background: #FEF3C7; color: #92400E; }
        .cp-status-cancel { background: #FEE2E2; color: #991B1B; }

        .cp-ver-todos {
          width: 100%;
          background: transparent;
          border: none;
          padding: var(--space-2);
          color: var(--primary);
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          cursor: pointer;
          font-family: var(--font-base) !important;
          margin-top: var(--space-1);
        }
        .cp-ver-todos:hover { background: var(--bg-subtle); border-radius: var(--radius-sm); }

        /* ═══ Modal excluir ═══ */
        .cp-modal-ov {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(45, 31, 38, 0.6);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
        }
        .cp-modal-box {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          max-width: 360px; width: 100%;
          text-align: center;
        }
        .cp-modal-box h3 {
          font-size: var(--text-lg);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 var(--space-2);
        }
        .cp-modal-box p {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }
        .cp-modal-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          cursor: pointer;
          font-family: var(--font-base) !important;
        }
        .cp-modal-btn--cancel {
          background: var(--bg-subtle);
          color: var(--text-secondary);
        }
        .cp-modal-btn--danger {
          background: #DC2626;
          color: var(--text-inverse);
        }

        /* ═══ Desktop ═══ */
        @media (min-width: 900px) {
          .cp-root {
            max-width: 100%;
            margin: 0;
            padding: 0 0 6rem;
          }
          /* Hero 100% da largura E altura, escape do padding do layout-main (3rem 2rem 2rem) */
          .cp-hero {
            border-radius: 0;
            padding: var(--space-6) var(--space-5) var(--space-5);
            margin: -3rem -2rem 0;
          }
          .cp-actions {
            padding: var(--space-4) var(--space-6);
            background: var(--bg-card);
            border-radius: 0;
            max-width: 900px;
            margin: 0 auto;
          }
          .cp-content {
            padding: var(--space-4) var(--space-6) 0;
            background: transparent;
            border-radius: 0;
            max-width: 900px;
            margin: 0 auto;
          }
          .cp-name { font-size: var(--text-2xl); }
          .cp-avatar { width: 100px; height: 100px; font-size: var(--text-3xl); }
          .cp-avatar-cam { width: 32px; height: 32px; font-size: 15px; }
          .cp-stat-v { font-size: var(--text-xl); }
        }
      `}</style>
    </div>
  );
}
