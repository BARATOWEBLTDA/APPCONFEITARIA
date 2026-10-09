import { useState, useEffect, useRef } from "react";
import { useRecorte } from "@/components/ui/useRecorte";
import { useNavigate, useParams } from "react-router-dom";
import { Cake, Camera, CaretRight, Envelope, IdentificationCard, MapPin, MegaphoneSimple, NotePencil, PencilSimple, Plus, Receipt, UserCircle, WhatsappLogo } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, TelaVazia, Titulo, avisar } from "@/components/base";
import { situacaoDe } from "@/components/pedidos/pedidoTexto";
import "./clientes.css";

/**
 * Página da cliente (08/10 · 3.34 · etapa 9.3): o mesmo topo da tela do pedido, a cliente com
 * WhatsApp / Editar / Novo pedido, os números, os pedidos (cada um abre a tela dele) e os dados.
 */

interface Cliente {
  id: string;
  user_id: string;
  nome: string;
  email?: string;
  whatsapp?: string;
  cpf_cnpj?: string;
  data_nascimento?: string;
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
  status?: string;
  created_at?: string;
  data_pedido?: string;
  valor_total?: number;
}

function formatPhone(phone?: string) {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}
const iniciaisDe = (nome?: string) => (nome || "?").trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("") || "?";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaMes = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
const mesAno = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", "/");

function haQuanto(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 30) return `Há ${dias} dias`;
  if (dias < 60) return "Há 1 mês";
  if (dias < 365) return `Há ${Math.floor(dias / 30)} meses`;
  const a = Math.floor(dias / 365);
  return `Há ${a} ${a === 1 ? "ano" : "anos"}`;
}

/** Aniversário a partir de AAAA-MM-DD, no horário do aparelho (new Date("AAAA-MM-DD") voltava um dia no Brasil) */
function niverInfo(data?: string) {
  if (!data) return null;
  const [y, m, d] = data.split("-").map(Number);
  if (!m || !d) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let prox = new Date(hoje.getFullYear(), m - 1, d);
  if (prox < hoje) prox = new Date(hoje.getFullYear() + 1, m - 1, d);
  const faltam = Math.round((prox.getTime() - hoje.getTime()) / 86400000);
  const idade = y && y > 1900 ? prox.getFullYear() - y : null;
  const quando = faltam === 0 ? "hoje" : faltam === 1 ? "amanhã" : `em ${faltam} dias`;
  const rotulo = new Date(2000, m - 1, d).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  return { faltam, idade, quando, rotulo };
}

const TOM: Record<string, string> = { rosa: "cp9-st--rosa", verde: "cp9-st--verde", laranja: "cp9-st--laranja", azul: "cp9-st--azul", vermelho: "cp9-st--vermelho" };

export default function ClientePerfil() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cData } = await supabase.from("clientes").select("*").eq("id", id).single();
      if (cData) setCliente(cData);

      // Pedidos da cliente: pelo cadastro (cliente_id) + os antigos só com o nome, sem duplicar
      if (cData) {
        const [porId, porNome] = await Promise.all([
          supabase.from("pedidos").select("*").eq("user_id", user.id).eq("cliente_id", id),
          supabase.from("pedidos").select("*").eq("user_id", user.id).is("cliente_id", null).eq("cliente_nome", cData.nome),
        ]);
        const vistos = new Set<string>();
        const lista = [...(porId.data || []), ...(porNome.data || [])]
          .filter((p: any) => (vistos.has(p.id) ? false : (vistos.add(p.id), true)))
          .sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
        setPedidos(lista as any);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleFotoUpload = async (file: File) => {
    if (!file || !cliente) return;
    setUploadingFoto(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `clientes/${cliente.user_id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (error) {
      avisar("Não deu pra enviar a foto. Tente de novo.", { tipo: "erro" });
      setUploadingFoto(false);
      return;
    }
    const { data } = supabase.storage.from("profiles").getPublicUrl(path);
    await supabase.from("clientes").update({ foto_url: data.publicUrl }).eq("id", cliente.id);
    setCliente({ ...cliente, foto_url: data.publicUrl });
    setUploadingFoto(false);
    avisar("Foto trocada", { tipo: "ok" });
  };
  const recorte = useRecorte(f => { void handleFotoUpload(f); }, { forma: "round" });

  if (loading) return (
    <>
      <AppPageHeader title="Cliente" subtitle="Abrindo…" onBack={() => navigate("/clientes")} />
      <div className="cl9"><div className="cl9-esq" aria-label="Carregando">{[0, 1, 2].map(i => <span key={i} />)}</div></div>
    </>
  );

  if (!cliente) return (
    <>
      <AppPageHeader title="Cliente" subtitle="Não encontrada" onBack={() => navigate("/clientes")} />
      <div className="cl9">
        <TelaVazia caixa icone={<UserCircle size={30} />} titulo="Não achamos essa cliente" texto="Ela pode ter sido excluída."
          acao={<Botao onClick={() => navigate("/clientes")}>Ver os clientes</Botao>} />
      </div>
    </>
  );

  const validos = pedidos.filter(p => p.status !== "cancelado");
  const totalGasto = validos.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const ticket = validos.length ? totalGasto / validos.length : 0;
  const ultima = validos[0];
  const temCancelado = pedidos.some(p => p.status === "cancelado");
  const niver = niverInfo(cliente.data_nascimento);
  const origem = cliente.origem || cliente.como_conheceu;
  const novo = (Date.now() - new Date(cliente.created_at).getTime()) / 86400000 <= 30 && validos.length <= 1;
  const zapDigitos = (cliente.whatsapp || "").replace(/\D/g, "");
  const zap = zapDigitos ? `https://wa.me/${zapDigitos.startsWith("55") ? zapDigitos : "55" + zapDigitos}` : "";
  const rua = [cliente.rua, cliente.numero].filter(Boolean).join(", ");
  const lugar = [cliente.complemento, cliente.bairro, cliente.cidade, cliente.estado, cliente.cep].filter(Boolean).join(" · ");
  const temEndereco = !!(rua || lugar);
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([rua, cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(", "))}`;
  const temDados = temEndereco || !!niver || !!cliente.email || !!cliente.cpf_cnpj || !!cliente.observacoes;
  const editar = () => navigate(`/clientes?edit=${cliente.id}&volta=1`);
  const novoPedido = () => navigate(`/vendas/novo?cliente=${cliente.id}`);
  const primeiro = cliente.nome.trim().split(/\s+/)[0];
  const visiveis = todos ? pedidos : pedidos.slice(0, 5);

  return (
    <>
      <AppPageHeader title={cliente.nome} subtitle={`Cliente desde ${mesAno(cliente.created_at)}`} onBack={() => navigate("/clientes")} />
      <div className="cl9 cp9">
        <div className="cp9-col">
          {/* a cliente */}
          <section className="cl9-card cp9-eu cp9-o1">
            <button type="button" className="cp9-av" aria-label={cliente.foto_url ? "Trocar a foto" : "Colocar uma foto"} onClick={() => fileRef.current?.click()} disabled={uploadingFoto}>
              {cliente.foto_url ? <img src={cliente.foto_url} alt="" /> : <span className="cp9-ini">{iniciaisDe(cliente.nome)}</span>}
              <i>{uploadingFoto ? <span className="cp9-gira" /> : <Camera size={16} weight="bold" />}</i>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={recorte.escolher} hidden />
      {recorte.janela}
            <div className="cp9-eu-tx">
              <b>{cliente.nome}</b>
              <small>{formatPhone(cliente.whatsapp) || "Sem WhatsApp"}</small>
              {(niver && niver.faltam <= 30) || origem || novo ? (
                <div className="cp9-tags">
                  {niver && niver.faltam <= 30 && <i className="cl9-tag cl9-tag--niver"><Cake size={14} weight="bold" />Aniversário {niver.quando}</i>}
                  {novo && <i className="cl9-tag cl9-tag--novo">Novo cadastro</i>}
                  {origem && <i className="cp9-tag"><MegaphoneSimple size={14} weight="bold" />Veio pelo {origem}</i>}
                </div>
              ) : null}
            </div>
            <div className="cp9-acoes">
              {zap
                ? <a className="cp9-zap" href={zap} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={20} weight="bold" />WhatsApp</a>
                : <span className="cp9-zap cp9-zap--off">Sem WhatsApp</span>}
              <Botao variante="secundario" tamanho="m" icone={<PencilSimple size={20} weight="bold" />} onClick={editar}>Editar</Botao>
              <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={novoPedido}>Novo pedido</Botao>
            </div>
          </section>

          {/* dados */}
          <section className="cl9-card cp9-dados cp9-o4">
            <Titulo>Dados</Titulo>
            {!temDados ? (
              <p className="cp9-falta">Só tem o nome e o WhatsApp. Com o aniversário e o endereço, fica mais fácil lembrar de {primeiro} e fazer entregas.
                <button type="button" onClick={editar}>Completar cadastro</button></p>
            ) : (<>
              {temEndereco && (
                <div className="cp9-dado"><MapPin size={22} weight="bold" />
                  <span><small>Endereço</small>{rua && <b>{rua}</b>}{lugar && <em>{lugar}</em>}</span>
                  {(rua || cliente.cidade) && <a href={mapa} target="_blank" rel="noopener noreferrer" className="cp9-link">Ver no mapa</a>}
                </div>
              )}
              {niver && (
                <div className="cp9-dado"><Cake size={22} weight="bold" />
                  <span><small>Aniversário</small><b>{niver.rotulo}</b><em>{niver.quando}{niver.idade ? ` · faz ${niver.idade} anos` : ""}</em></span>
                </div>
              )}
              {cliente.email && <div className="cp9-dado"><Envelope size={22} weight="bold" /><span><small>E-mail</small><b>{cliente.email}</b></span></div>}
              {cliente.cpf_cnpj && <div className="cp9-dado"><IdentificationCard size={22} weight="bold" /><span><small>{cliente.cpf_cnpj.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"}</small><b>{cliente.cpf_cnpj}</b></span></div>}
              {cliente.observacoes && <div className="cp9-obs"><NotePencil size={22} weight="bold" /><span><small>Observações</small><b>{cliente.observacoes}</b></span></div>}
            </>)}
          </section>
        </div>

        <div className="cp9-col">
          {/* números */}
          <section className="cl9-card cp9-o2">
            <div className="cp9-nums">
              <div><small>Pedidos</small><b>{validos.length}</b></div>
              <div><small>Total gasto</small><b>{brl(totalGasto)}</b></div>
              <div><small>Ticket médio</small><b>{validos.length ? brl(ticket) : "—"}</b></div>
              <div><small>Última compra</small><b>{ultima ? haQuanto(ultima.created_at || ultima.data_pedido || new Date().toISOString()) : "—"}</b></div>
            </div>
          </section>

          {/* pedidos */}
          <section className="cl9-card cp9-o3">
            <Titulo contagem={pedidos.length || undefined}>Pedidos</Titulo>
            {pedidos.length === 0 ? (
              <TelaVazia compacta icone={<Receipt size={28} />} titulo="Ainda não tem pedido" texto="Quando ela comprar, os pedidos aparecem aqui."
                acao={<Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={novoPedido}>Novo pedido pra {primeiro}</Botao>} />
            ) : (<>
              {visiveis.map(p => {
                const st = situacaoDe(p as any);
                const cancelado = p.status === "cancelado";
                return (
                  <button key={p.id} type="button" className="cp9-ped" onClick={() => navigate(`/pedidos/${p.id}/editar`)}>
                    <span><b>{p.numero ? `Pedido #${p.numero}` : "Pedido"}</b>{(p.created_at || p.data_pedido) && <small>{diaMes(p.created_at || p.data_pedido!)}</small>}</span>
                    <i className={`cp9-st${st.tom ? ` ${TOM[st.tom] || ""}` : ""}`}>{st.nome}</i>
                    <strong className={cancelado ? "cp9-riscado" : ""}>{brl(Number(p.valor_total) || 0)}</strong>
                    <CaretRight size={18} weight="bold" />
                  </button>
                );
              })}
              {pedidos.length > 5 && !todos && <button type="button" className="cp9-mais" onClick={() => setTodos(true)}>Ver todos os {pedidos.length} pedidos</button>}
              {temCancelado && <p className="cp9-nota">Pedido cancelado não entra no total gasto.</p>}
            </>)}
          </section>
        </div>
      </div>
    </>
  );
}
