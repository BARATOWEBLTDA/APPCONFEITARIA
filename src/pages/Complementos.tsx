import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { Package, Plus, PencilSimple, Trash, MagnifyingGlass, X, CheckCircle, DotsThree } from "@phosphor-icons/react";
import ReqTag from "@/components/ReqTag";

type Complemento = {
  id: string;
  nome: string;
  descricao?: string;
  valor: number;
  categorias: string[]; // reaproveitado: agora guarda IDs de produtos
};

// Formata nome do produto pra evitar CAIXA ALTA feia: transforma
// "BOLO DE PAÇOCA" em "Bolo de Paçoca" (preposições em minúsculas).
function formatNomeProduto(nome: string): string {
  const preps = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "a", "o"]);
  return nome.toLowerCase().split(/\s+/).map((w, i) => {
    if (i > 0 && preps.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}

type ProdutoLite = {
  id: string;
  nome: string;
  categoria?: string;
  imagem_url?: string | null;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePreco(s: string): number {
  const digits = s.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export default function Complementos() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [items, setItems] = useState<Complemento[]>([]);
  const [produtos, setProdutos] = useState<ProdutoLite[]>([]);
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Complemento | null>(null);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [showInfo, setShowInfo] = useState(false);
  const [primeiroNome, setPrimeiroNome] = useState<string>("");
  const [form, setForm] = useState<{ nome: string; descricao: string; valor: number; categorias: string[] }>({ nome: "", descricao: "", valor: 0, categorias: [] });
  const [modoPreco, setModoPreco] = useState<"cobrar" | "gratis">("cobrar");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Complemento | null>(null);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { setLoading(false); return; }
      setUserId(uid);
      // Buscar nome pra personalizar tooltips
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", uid).single();
      if (profile?.nome) setPrimeiroNome(profile.nome.trim().split(/\s+/)[0]);
      const { data } = await supabase.from("biblioteca_extras").select("*").eq("user_id", uid).order("nome");
      if (data) setItems(data as Complemento[]);
      const { data: prods } = await supabase.from("produtos").select("id, nome, categoria, imagem_url").eq("user_id", uid).order("nome");
      if (prods) setProdutos(prods as ProdutoLite[]);
      setLoading(false);
    })();
  }, []);

  // Fecha o menu de ações do card ao clicar em qualquer lugar fora dele.
  useEffect(() => {
    if (!menuAbertoId) return;
    const close = () => setMenuAbertoId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuAbertoId]);

  // Bloqueia scroll do body enquanto o modal ou o info estiver aberto (evita
  // o "fundo scrollando" atrás do modal, comum em mobile).
  // Guardar o scrollY antes e restaurar depois pra evitar salto de posição
  // ao fechar o modal (iOS Safari e Chrome mobile).
  useEffect(() => {
    const algumAberto = modalOpen || showInfo || !!confirmDel;
    if (algumAberto) {
      const scrollY = window.scrollY;
      const prev = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
      };
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      return () => {
        document.body.style.overflow = prev.overflow;
        document.body.style.position = prev.position;
        document.body.style.top = prev.top;
        document.body.style.width = prev.width;
        window.scrollTo(0, scrollY);
      };
    }
  }, [modalOpen, showInfo, confirmDel]);

  const abrirNovo = () => {
    setEditing(null);
    setForm({ nome: "", descricao: "", valor: 0, categorias: [] });
    setModoPreco("cobrar");
    setModalStep(1);
    setModalOpen(true);
  };
  const abrirEditar = (c: Complemento) => {
    setEditing(c);
    setForm({ nome: c.nome, descricao: c.descricao || "", valor: c.valor, categorias: c.categorias || [] });
    setModoPreco(c.valor > 0 ? "cobrar" : "gratis");
    setModalStep(1);
    setModalOpen(true);
  };
  const abrirProdutos = (c: Complemento) => {
    setEditing(c);
    setForm({ nome: c.nome, descricao: c.descricao || "", valor: c.valor, categorias: c.categorias || [] });
    setModoPreco(c.valor > 0 ? "cobrar" : "gratis");
    setModalStep(2);
    setModalOpen(true);
  };
  const fechar = () => { setModalOpen(false); setEditing(null); setModalStep(1); };

  const salvar = async () => {
    const nomeLimpo = form.nome.trim();
    if (!nomeLimpo) return alert("Digite o nome da personalização");
    if (modoPreco === "cobrar" && form.valor <= 0) return alert("Digite um valor válido ou escolha \"Grátis\"");
    const valorFinal = modoPreco === "gratis" ? 0 : form.valor;
    setSaving(true);
    try {
      if (editing) {
        const { data, error } = await supabase.from("biblioteca_extras")
          .update({ nome: nomeLimpo, descricao: form.descricao.trim() || null, valor: valorFinal, categorias: form.categorias })
          .eq("id", editing.id).eq("user_id", userId).select().single();
        if (error) throw error;
        if (data) setItems(prev => prev.map(i => i.id === editing.id ? (data as Complemento) : i).sort((a, b) => a.nome.localeCompare(b.nome)));
      } else {
        const { data, error } = await supabase.from("biblioteca_extras")
          .insert({ user_id: userId, nome: nomeLimpo, descricao: form.descricao.trim() || null, valor: valorFinal, categorias: form.categorias })
          .select().single();
        if (error) throw error;
        if (data) setItems(prev => [...prev, data as Complemento].sort((a, b) => a.nome.localeCompare(b.nome)));
      }
      fechar();
    } catch (err: any) {
      alert("Erro ao salvar: " + (err.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const excluir = async () => {
    if (!confirmDel) return;
    const id = confirmDel.id;
    setConfirmDel(null);
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from("biblioteca_extras").delete().eq("id", id).eq("user_id", userId);
  };

  const toggleProduto = (idProduto: string) => {
    setForm(f => ({ ...f, categorias: f.categorias.includes(idProduto) ? f.categorias.filter(c => c !== idProduto) : [...f.categorias, idProduto] }));
  };

  const itemsFiltrados = items.filter(i => !busca.trim() || i.nome.toLowerCase().includes(busca.toLowerCase()));

  if (loading) {
    return (
      <div className="cpl-root">
        <AppPageHeader title="Personalização" subtitle="Adicionais e extras dos seus produtos" infoContent={null} />
        <div className="cpl-loading"><div className="cpl-spinner" /></div>
        <style>{stylesLoading}</style>
      </div>
    );
  }

  return (
    <div className="cpl-root">
      <AppPageHeader
        title="Personalização"
        subtitle="Adicionais e extras dos seus produtos"
        infoContent={
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#4B5563" }}>
            <p style={{ margin: "0 0 8px" }}>Personalizações são <b>opções que o cliente escolhe</b> ao pedir um produto — como topo de bolo, escrita personalizada, papel de arroz.</p>
            <p style={{ margin: 0 }}>Cadastre <b>uma vez</b> aqui e depois selecione em quais produtos vai aparecer. Muda o preço aqui e reflete em todos.</p>
          </div>
        }
      />

      <div className="cpl-content">
        {items.length > 0 && (
          <div className="cpl-topbar">
            <button className="cpl-btn-novo" onClick={abrirNovo}>
              <Plus size={16} weight="bold" /> Nova personalização
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="cpl-empty">
            <div className="cpl-empty-avatar">
              <img src="/log.png" alt="Doonly" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '✨'; }} />
            </div>
            <p className="cpl-empty-title">Personalize seus produtos</p>
            <p className="cpl-empty-sub">Cadastre uma vez aqui e escolha em quais produtos aparece. Ideal pra escritas, topos, temas e papel de arroz.</p>

            <div className="cpl-empty-preview">
              <div className="cpl-empty-preview-product">
                <div className="cpl-empty-preview-img">
                  <img src="/Sistema/bolo.jpg" alt="Bolo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '🎂'; }} />
                </div>
                <div className="cpl-empty-preview-info">
                  <div className="cpl-empty-preview-nome">Bolo de Paçoca</div>
                  <div className="cpl-empty-preview-preco">R$ 47,90 <span className="cpl-empty-preview-un">/ kg</span></div>
                </div>
              </div>

              <div className="cpl-empty-preview-item selected">
                <div className="cpl-empty-preview-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="cpl-empty-preview-nm">Topo de bolo</div>
                <div className="cpl-empty-preview-pr">+ R$ 15</div>
              </div>
              <div className="cpl-empty-preview-item">
                <div className="cpl-empty-preview-check" />
                <div className="cpl-empty-preview-nm">Papel de arroz</div>
                <div className="cpl-empty-preview-pr">+ R$ 10</div>
              </div>
              <div className="cpl-empty-preview-item">
                <div className="cpl-empty-preview-check" />
                <div className="cpl-empty-preview-nm">Escrita</div>
                <div className="cpl-empty-preview-pr gratis">Grátis</div>
              </div>

              <div className="cpl-empty-preview-upload">
                <div className="cpl-empty-preview-upload-ico">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div className="cpl-empty-preview-upload-info">
                  <div className="cpl-empty-preview-upload-tit">Enviar referência</div>
                  <div className="cpl-empty-preview-upload-sub">Anexe uma foto ou imagem</div>
                </div>
              </div>
            </div>

            <button className="cpl-btn-novo cpl-btn-novo--empty" onClick={abrirNovo}>
              <Plus size={16} weight="bold" /> Criar primeira personalização
            </button>
          </div>
        ) : itemsFiltrados.length === 0 ? (
          <p className="cpl-noresult">Nenhum resultado pra "{busca}"</p>
        ) : (
          <div className="cpl-list">
            {itemsFiltrados.map(item => {
              const idsLigados = item.categorias || [];
              const produtosLigados = idsLigados
                .map(id => produtos.find(p => p.id === id))
                .filter((p): p is ProdutoLite => !!p);
              const totalProdutos = produtosLigados.length;
              const mostrarFotos = produtosLigados.slice(0, 4);
              const restante = totalProdutos - mostrarFotos.length;
              const emTodos = idsLigados.length === 0;
              const isGratis = !item.valor || item.valor === 0;

              return (
                <div key={item.id} className="cpl-card" onClick={() => setMenuAbertoId(menuAbertoId === item.id ? null : item.id)}>
                  <div className="cpl-card-hdr">
                    <div className="cpl-card-nome-wrap">
                      <p className="cpl-card-nome">{item.nome}</p>
                      <span className={`cpl-card-valor ${isGratis ? "cpl-card-valor--gratis" : ""}`}>
                        {isGratis ? "Grátis" : `R$ ${formatBRL(item.valor)}`}
                      </span>
                    </div>
                    <div className="cpl-card-actions">
                      <button
                        className="cpl-card-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuAbertoId(menuAbertoId === item.id ? null : item.id);
                        }}
                        aria-label="Ações"
                      >
                        <DotsThree size={20} weight="bold" />
                      </button>
                      {menuAbertoId === item.id && (
                        <div className="cpl-card-menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="cpl-card-menu-item"
                            onClick={() => { setMenuAbertoId(null); abrirEditar(item); }}
                          >
                            <PencilSimple size={15} weight="bold" /> Editar
                          </button>
                          <button
                            className="cpl-card-menu-item"
                            onClick={() => { setMenuAbertoId(null); abrirProdutos(item); }}
                          >
                            <Package size={15} weight="bold" /> Adicionar produtos
                          </button>
                          <button
                            className="cpl-card-menu-item cpl-card-menu-item--del"
                            onClick={() => { setMenuAbertoId(null); setConfirmDel(item); }}
                          >
                            <Trash size={15} weight="bold" /> Remover
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {emTodos ? (
                    <div className="cpl-card-todos">
                      <CheckCircle size={14} weight="fill" /> Aparece em todos os produtos
                    </div>
                  ) : (
                    <div className="cpl-card-fotos">
                      {mostrarFotos.map(p => (
                        <div key={p.id} className="cpl-card-foto" title={p.nome}>
                          {p.imagem_url ? (
                            <img src={p.imagem_url} alt={p.nome} />
                          ) : (
                            <span>🎂</span>
                          )}
                        </div>
                      ))}
                      <span className="cpl-card-fotos-txt">
                        {restante > 0
                          ? `+${restante} produto${restante === 1 ? "" : "s"}`
                          : `${totalProdutos} produto${totalProdutos === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {modalOpen && (
        <div className="cpl-modal-ov" onClick={fechar}>
          <div className="cpl-modal" onClick={e => e.stopPropagation()}>
            <div className="cpl-modal-handle" />
            <div className="cpl-modal-head">
              <div style={{display:"flex", alignItems:"center", gap:8, flex:1, minWidth:0}}>
                <h3 className="cpl-modal-title">{editing ? "Editar personalização" : "Nova personalização"}</h3>
              </div>
              <button className="cpl-modal-close" onClick={fechar}><X size={16} weight="bold" /></button>
            </div>

            <div className="cpl-modal-body">
              {modalStep === 1 ? (
                <>
                  <div className="cpl-field">
                    <label>
                      Nome da personalização
                      <ReqTag />
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Topo de bolo, Escrita, Papel de arroz..."
                      value={form.nome}
                      onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    />
                  </div>
                  <div className="cpl-field">
                    <label>Descrição <span className="cpl-req-opt">opcional</span></label>
                    <textarea
                      className="cpl-desc-input"
                      placeholder="Ex: Escolha um tema da galeria ou envie sua imagem"
                      value={form.descricao}
                      onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      maxLength={140}
                      rows={2}
                    />
                    <p className="cpl-field-explain">Explica pro cliente o que ele precisa fazer. Aparece embaixo do nome no cardápio.</p>
                  </div>
                  <div className="cpl-field">
                    <label>
                      Quanto custa essa personalização
                      <ReqTag />
                    </label>
                    <div className="cpl-seg">
                      <button
                        type="button"
                        className={`cpl-seg-btn ${modoPreco === "cobrar" ? "cpl-seg-btn--active" : ""}`}
                        onClick={() => setModoPreco("cobrar")}
                      >
                        Cobrar valor
                      </button>
                      <button
                        type="button"
                        className={`cpl-seg-btn ${modoPreco === "gratis" ? "cpl-seg-btn--active-green" : ""}`}
                        onClick={() => setModoPreco("gratis")}
                      >
                        Grátis
                      </button>
                    </div>
                    {modoPreco === "cobrar" ? (
                      <div className={`cpl-field-input-wrap ${form.valor > 0 ? "cpl-field-input-wrap--filled" : ""}`}>
                        <span className="cpl-field-prefix">R$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Digite o valor aqui"
                          value={form.valor > 0 ? formatBRL(form.valor) : ""}
                          onChange={e => setForm(f => ({ ...f, valor: parsePreco(e.target.value) }))}
                        />
                      </div>
                    ) : (
                      <div className="cpl-gratis-info">Sem custo adicional</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="cpl-field">
                  <label style={{ margin: 0 }}>Aparece em quais produtos?</label>
                  <p className="cpl-prods-hint">Deixe vazio pra aparecer em todos</p>
                  {produtos.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12.5, color: "#9CA3AF" }}>Você ainda não tem produtos cadastrados.</p>
                  ) : (
                    <div className="cpl-prods-list">
                      {produtos.map(p => {
                        const ativo = form.categorias.includes(p.id);
                        return (
                          <button
                            type="button"
                            key={p.id}
                            className={`cpl-prod-item ${ativo ? "cpl-prod-item--on" : ""}`}
                            onClick={() => toggleProduto(p.id)}
                          >
                            <div className="cpl-prod-check">
                              {ativo && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              )}
                            </div>
                            <div className="cpl-prod-foto">
                              {p.imagem_url ? (
                                <img src={p.imagem_url} alt={p.nome} />
                              ) : (
                                <span>🎂</span>
                              )}
                            </div>
                            <span className="cpl-prod-nome">{formatNomeProduto(p.nome)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="cpl-modal-foot">
              {modalStep === 1 ? (
                <>
                  <button className="cpl-modal-btn cpl-modal-btn--sec" onClick={fechar}>Cancelar</button>
                  <button
                    className="cpl-modal-btn cpl-modal-btn--pri"
                    onClick={() => {
                      if (!form.nome.trim()) return alert("Digite o nome da personalização");
                      setModalStep(2);
                    }}
                  >
                    Avançar
                  </button>
                </>
              ) : (
                <>
                  <button className="cpl-modal-btn cpl-modal-btn--sec" onClick={() => setModalStep(1)}>Voltar</button>
                  <button className="cpl-modal-btn cpl-modal-btn--pri" onClick={salvar} disabled={saving}>
                    {saving ? "Salvando..." : (editing ? "Salvar" : "Criar personalização")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal info personalizado */}
      {showInfo && (
        <div className="cpl-modal-ov" onClick={() => setShowInfo(false)} style={{ zIndex: 10001 }}>
          <div className="cpl-info-card" onClick={e => e.stopPropagation()}>
            <div className="cpl-info-ico">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.5 6.5L21 9l-5 4.5 1.5 6.5L12 16.5 6.5 20 8 13.5 3 9l6.5-.5L12 2z"/></svg>
            </div>
            <h4 className="cpl-info-title">
              {primeiroNome ? `${primeiroNome}, `: ""}
              como sua personalização vai aparecer?
            </h4>
            <p className="cpl-info-txt">
              Cada personalização que você cria aparece pro cliente <b>na hora dele escolher o produto</b> no cardápio.
            </p>
            <p className="cpl-info-txt">
              Ele vê as opções ativadas pra aquele produto e escolhe qual quer. Se tiver valor, soma no total do pedido.
            </p>
            <p className="cpl-info-example">
              <b>Exemplo:</b> "Topo de bolo — R$ 15,00" aparece só nos produtos onde você marcou.
            </p>
            <button className="cpl-info-btn" onClick={() => setShowInfo(false)}>Entendi</button>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDel && (
        <div className="cpl-modal-ov" onClick={() => setConfirmDel(null)}>
          <div className="cpl-modal cpl-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="cpl-modal-handle" />
            <div style={{ padding: "18px 20px 22px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#DC2626" }}>Excluir personalização?</h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B7280", lineHeight: 1.4 }}>
                "<b>{confirmDel.nome}</b>" será removido. Produtos que já usam essa personalização não serão alterados.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="cpl-modal-btn cpl-modal-btn--sec" style={{ flex: 1 }} onClick={() => setConfirmDel(null)}>Cancelar</button>
                <button className="cpl-modal-btn" style={{ flex: 1, background: "#DC2626", color: "#fff" }} onClick={excluir}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

const stylesLoading = `
  .cpl-loading { display: flex; justify-content: center; padding: 60px 20px; }
  .cpl-spinner { width: 30px; height: 30px; border: 3px solid #F0EBED; border-top-color: #E85A8C; border-radius: 50%; animation: cplspin 0.7s linear infinite; }
  @keyframes cplspin { to { transform: rotate(360deg); } }
`;

const styles = `
  ${stylesLoading}
  .cpl-root { min-height: 100vh; background: var(--bg-body); font-family: 'Geist', sans-serif; }
  .cpl-content { max-width: 720px; margin: 0 auto; padding: 20px 16px 100px; }

  .cpl-topbar { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; justify-content: flex-end; }
  .cpl-search { flex: 1 1 200px; min-width: 0; position: relative; display: flex; align-items: center; gap: 8px; background: #fff; border: 1.5px solid #F0EBED; border-radius: 10px; padding: 10px 12px; color: #6B7280; }
  .cpl-search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 13.5px; color: #1F1F23; font-family: inherit; }
  .cpl-search-clear { background: #F3F4F6; border: none; width: 20px; height: 20px; border-radius: 50%; color: #6B7280; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .cpl-btn-novo { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; background: #E85A8C; color: #fff; border: none; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; box-shadow: 0 4px 12px rgba(232,90,140,0.35); white-space: nowrap; flex-shrink: 0; }
  .cpl-btn-novo:hover { background: #d54a7a; }
  .cpl-btn-novo--empty {
    margin-top: 16px;
    padding: 14px 24px;
    font-size: 14px;
    border-radius: 8px;
    background: linear-gradient(135deg, #E85A8C, #C33A6E);
    box-shadow: 0 3px 0 #993556, 0 6px 14px rgba(232, 90, 140, 0.35);
    transition: transform 0.1s ease, box-shadow 0.1s ease;
    letter-spacing: 0.01em;
  }
  .cpl-btn-novo--empty:hover { background: linear-gradient(135deg, #E85A8C, #C33A6E); transform: translateY(-1px); box-shadow: 0 4px 0 #993556, 0 8px 18px rgba(232, 90, 140, 0.4); }
  .cpl-btn-novo--empty:active { transform: translateY(2px); box-shadow: 0 1px 0 #993556, 0 3px 8px rgba(232, 90, 140, 0.3); }

  .cpl-empty { text-align: center; padding: 32px 20px 24px; background: #fff; border-radius: 14px; border: 1.5px solid #F0EBED; }
  .cpl-empty-avatar { width: 96px; height: 96px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 40px; }
  .cpl-empty-avatar img { width: 100%; height: 100%; object-fit: contain; }
  .cpl-empty-title { margin: 0 0 6px; font-size: 16px; font-weight: 800; color: #2C1219; letter-spacing: -0.02em; }
  .cpl-empty-sub { margin: 0 0 16px; font-size: 12.5px; color: #6B7280; line-height: 1.5; }

  /* Preview de como aparece no cardápio (lista com checkbox) */
  .cpl-empty-preview { border: 1px solid #F0D8DE; border-radius: 10px; padding: 18px; margin-bottom: 20px; background: #fff; text-align: left; }
  .cpl-empty-preview-product { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid #F0D8DE; margin-bottom: 4px; }
  .cpl-empty-preview-img { width: 60px; height: 60px; border-radius: 8px; background: linear-gradient(135deg, #F5DEB3, #DEB887); display: flex; align-items: center; justify-content: center; font-size: 30px; flex-shrink: 0; overflow: hidden; }
  .cpl-empty-preview-img img { width: 100%; height: 100%; object-fit: cover; }
  .cpl-empty-preview-info { flex: 1; min-width: 0; }
  .cpl-empty-preview-nome { font-size: 15px; font-weight: 800; color: #2C1219; line-height: 1.2; letter-spacing: -0.01em; }
  .cpl-empty-preview-preco { font-size: 14px; color: #C33A6E; font-weight: 700; margin-top: 3px; }
  .cpl-empty-preview-un { font-size: 11px; font-weight: 600; color: #6B7280; margin-left: 2px; }

  .cpl-empty-preview-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #F0D8DE; }
  .cpl-empty-preview-item:last-of-type { border-bottom: none; }
  .cpl-empty-preview-check { width: 20px; height: 20px; border-radius: 5px; border: 2px solid #C0C0C0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; background: #fff; }
  .cpl-empty-preview-item.selected .cpl-empty-preview-check { border-color: #E85A8C; background: #E85A8C; }
  .cpl-empty-preview-nm { flex: 1; font-size: 14px; color: #2C1219; font-weight: 600; }
  .cpl-empty-preview-pr { font-size: 13px; color: #C33A6E; font-weight: 700; }
  .cpl-empty-preview-pr.gratis { color: #16a34a; }

  .cpl-empty-preview-upload { display: flex; align-items: center; gap: 12px; padding: 12px; background: #FFF5F9; border: 1.5px dashed #F0D8DE; border-radius: 6px; margin-top: 14px; }
  .cpl-empty-preview-upload-ico { width: 36px; height: 36px; border-radius: 6px; background: #FCE0E9; color: #C33A6E; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cpl-empty-preview-upload-info { flex: 1; }
  .cpl-empty-preview-upload-tit { font-size: 13px; font-weight: 700; color: #2C1219; line-height: 1.2; }
  .cpl-empty-preview-upload-sub { font-size: 11px; color: #6B7280; margin-top: 2px; }

  .cpl-empty-desc { max-width: 320px; margin: 0 auto 20px; font-size: 13px; color: #6B7280; line-height: 1.55; }
  .cpl-noresult { text-align: center; color: #9CA3AF; font-size: 13px; padding: 40px 20px; margin: 0; }

  .cpl-list { display: flex; flex-direction: column; gap: 8px; }
  .cpl-card { padding: 14px; background: #fff; border: 1.5px solid #F0EBED; border-radius: 10px; transition: border-color 0.15s; cursor: pointer; }
  .cpl-card:hover { border-color: #E85A8C; }
  .cpl-card-hdr { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  .cpl-card-nome-wrap { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .cpl-card-nome { margin: 0; font-size: 15px; font-weight: 800; color: #2C1219; letter-spacing: -0.01em; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cpl-card-valor {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    background: linear-gradient(135deg, #22C55E, #16a34a);
    color: #fff;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 800;
    box-shadow: 0 1px 3px rgba(22, 163, 74, 0.3);
    white-space: nowrap;
    flex-shrink: 0;
    letter-spacing: 0.01em;
  }
  .cpl-card-valor--gratis {
    background: linear-gradient(135deg, #16a34a, #15803d);
    box-shadow: 0 1px 3px rgba(21, 128, 61, 0.3);
  }
  .cpl-card-actions { display: flex; gap: 4px; flex-shrink: 0; position: relative; }
  .cpl-card-btn { background: transparent; border: none; width: 32px; height: 32px; border-radius: 6px; color: #6B7280; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
  .cpl-card-btn:hover { background: #F5F0F2; color: #2C1219; }
  .cpl-card-btn--del:hover { color: #DC2626; background: #FEE2E2; }

  .cpl-card-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: #fff;
    border: 1px solid #F0EBED;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    min-width: 200px;
    padding: 4px;
    z-index: 10;
    animation: cplMenuIn 0.15s ease-out;
  }
  @keyframes cplMenuIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .cpl-card-menu-item {
    all: unset; box-sizing: border-box; cursor: pointer;
    display: flex; align-items: center; gap: 10px;
    width: 100%;
    padding: 10px 12px;
    font-size: 13px; font-weight: 600; color: #2C1219;
    border-radius: 5px;
    font-family: inherit;
    transition: background 0.12s;
    white-space: nowrap;
  }
  .cpl-card-menu-item:hover { background: #F5F0F2; }
  .cpl-card-menu-item--del { color: #DC2626; }
  .cpl-card-menu-item--del:hover { background: #FEE2E2; }
  .cpl-card-fotos { display: flex; align-items: center; gap: 6px; padding-top: 10px; border-top: 1px solid #F5F0F2; }
  .cpl-card-foto { width: 28px; height: 28px; border-radius: 5px; background: linear-gradient(135deg, #FCE0E9, #F0D8DE); display: flex; align-items: center; justify-content: center; font-size: 14px; overflow: hidden; flex-shrink: 0; }
  .cpl-card-foto img { width: 100%; height: 100%; object-fit: cover; }
  .cpl-card-fotos-txt { font-size: 11.5px; color: #6B7280; font-weight: 600; margin-left: 4px; }
  .cpl-card-todos { display: flex; align-items: center; gap: 6px; padding-top: 10px; border-top: 1px solid #F5F0F2; font-size: 12px; color: #C33A6E; font-weight: 700; }

  .cpl-modal-ov { position: fixed; inset: 0; z-index: 10000; background: rgba(45, 31, 38, 0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; animation: cplfade 0.2s; overscroll-behavior: contain; touch-action: none; }
  @keyframes cplfade { from { opacity: 0; } to { opacity: 1; } }
  .cpl-modal { background: #fff; width: 100%; max-width: 520px; height: 70vh; max-height: 70vh; border-radius: 20px 20px 0 0; display: flex; flex-direction: column; overflow: hidden; animation: cplup 0.28s cubic-bezier(0.32,0.72,0,1); font-family: inherit; }
  .cpl-modal--sm { max-width: 400px; }
  @media (min-width: 720px) { .cpl-modal-ov { align-items: center; padding: 24px; } .cpl-modal { border-radius: 16px; max-height: 82vh; } }
  @keyframes cplup { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .cpl-modal-handle { width: 40px; height: 4px; background: #D1D5DB; border-radius: 2px; margin: 8px auto 4px; }
  .cpl-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 20px 14px; border-bottom: 1px solid #F3F4F6; }
  .cpl-modal-title { margin: 0; font-size: 16px; font-weight: 800; color: #1F1F23; }
  .cpl-modal-close { background: #F3F4F6; border: none; width: 30px; height: 30px; border-radius: 8px; color: #6B7280; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .cpl-modal-body { padding: 18px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; }
  .cpl-modal-foot { padding: 14px 16px; padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)); display: flex; gap: 10px; }
  .cpl-modal-btn { flex: 1; padding: 14px; border: none; border-radius: 8px; font-weight: 800; font-size: 13.5px; cursor: pointer; font-family: inherit; transition: transform 0.1s ease, box-shadow 0.1s ease; }
  .cpl-modal-btn--sec { background: #F3F4F6; color: #4B5563; box-shadow: 0 3px 0 #D1D5DB; }
  .cpl-modal-btn--sec:hover { background: #E5E7EB; transform: translateY(-1px); box-shadow: 0 4px 0 #D1D5DB; }
  .cpl-modal-btn--sec:active { transform: translateY(2px); box-shadow: 0 1px 0 #D1D5DB; }
  .cpl-modal-btn--pri { background: linear-gradient(135deg, #E85A8C, #C33A6E); color: #fff; font-weight: 800; flex: 2; box-shadow: 0 3px 0 #993556, 0 6px 14px rgba(232, 90, 140, 0.3); }
  .cpl-modal-btn--pri:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 0 #993556, 0 8px 18px rgba(232, 90, 140, 0.4); }
  .cpl-modal-btn--pri:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #993556, 0 3px 8px rgba(232, 90, 140, 0.3); }
  .cpl-modal-btn--pri:disabled { background: #E5E7EB; color: #9CA3AF; box-shadow: none; cursor: not-allowed; }

  .cpl-field { display: flex; flex-direction: column; gap: 6px; }
  .cpl-field > label { font-size: 12px; font-weight: 700; color: #1F1F23; }
  .cpl-field-hint { font-weight: 500; color: #9CA3AF; }
  .cpl-field input[type="text"] { padding: 12px 14px; border: 1.5px solid #E5E7EB; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; transition: border 0.15s; }
  .cpl-field input:focus { border-color: #E85A8C; }
  .cpl-desc-input { padding: 10px 14px; border: 1.5px solid #E5E7EB; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; resize: vertical; min-height: 60px; transition: border 0.15s; width: 100%; box-sizing: border-box; }
  .cpl-desc-input:focus { border-color: #E85A8C; }
  .cpl-req-opt { display: inline-block; margin-left: 8px; padding: 2px 7px; background: #F3F4F6; color: #6B7280; font-size: 10px; font-weight: 700; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; vertical-align: middle; }

  /* Segmented control Cobrar / Grátis */
  .cpl-seg {
    display: flex; gap: 6px;
    padding: 4px;
    background: #F5F0F2;
    border-radius: 10px;
    margin-bottom: 10px;
  }
  .cpl-seg-btn {
    flex: 1;
    padding: 9px 8px;
    background: transparent;
    border: none;
    border-radius: 7px;
    font-size: 12.5px;
    font-weight: 700;
    color: #6B7280;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
  }
  .cpl-seg-btn--active {
    background: #fff;
    color: #C33A6E;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .cpl-seg-btn--active-green {
    background: #16a34a;
    color: #fff;
    box-shadow: 0 1px 3px rgba(22,163,74,0.3);
  }
  .cpl-gratis-info {
    padding: 14px;
    background: #F0FDF4;
    border: 1.5px solid #86EFAC;
    border-radius: 10px;
    text-align: center;
    color: #15803D;
    font-weight: 700;
    font-size: 14px;
  }
  .cpl-field-input-wrap { position: relative; display: flex; align-items: center; }
  .cpl-field-prefix { position: absolute; left: 14px; font-size: 13px; font-weight: 700; color: #6B7280; pointer-events: none; z-index: 1; opacity: 0; transition: opacity 0.15s; }
  .cpl-field-input-wrap--filled .cpl-field-prefix { opacity: 1; }
  .cpl-field-input-wrap input[type="text"] { width: 100%; box-sizing: border-box; padding-left: 14px; transition: padding-left 0.15s; }
  .cpl-field-input-wrap--filled input[type="text"] { padding-left: 40px !important; }

  .cpl-prods-hint { font-size: 11px; color: #6B7280; margin: 2px 0 8px; font-weight: 500; }
  .cpl-prods-list {
    display: flex; flex-direction: column; gap: 6px;
    max-height: 320px; overflow-y: auto;
    padding: 4px 4px 4px 0;
  }
  .cpl-prod-item {
    all: unset; box-sizing: border-box; cursor: pointer;
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px;
    background: #fff;
    border: 1.5px solid #F0EBED;
    border-radius: 8px;
    transition: all 0.15s;
    font-family: inherit;
  }
  .cpl-prod-item:hover { border-color: #F5B8CD; }
  .cpl-prod-item--on { background: #FFF5F9; border-color: #E85A8C; }
  .cpl-prod-check {
    width: 22px; height: 22px; border-radius: 6px;
    border: 2px solid #D1D5DB; background: #fff;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.15s;
  }
  .cpl-prod-item--on .cpl-prod-check { background: #E85A8C; border-color: #E85A8C; }
  .cpl-prod-foto {
    width: 40px; height: 40px; border-radius: 6px;
    background: linear-gradient(135deg, #FCE0E9, #F0D8DE);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; overflow: hidden; flex-shrink: 0;
  }
  .cpl-prod-foto img { width: 100%; height: 100%; object-fit: cover; }
  .cpl-prod-nome { flex: 1; font-size: 14px; font-weight: 700; color: #2C1219; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Info tip (i) ao lado do título */
  .cpl-info-tip {
    all: unset; box-sizing: border-box; cursor: pointer;
    width: 20px; height: 20px; border-radius: 50%;
    background: #FCE0E9; color: #E85A8C;
    display: inline-flex; align-items: center; justify-content: center;
    transition: all 0.15s; flex-shrink: 0;
  }
  .cpl-info-tip:hover { background: #E85A8C; color: #fff; }

  /* Badge da etapa */
  .cpl-step-badge {
    display: inline-flex; align-items: center;
    padding: 3px 8px; background: #F5F3EF; color: #6B7280;
    font-size: 10.5px; font-weight: 800; border-radius: 6px;
    letter-spacing: 0.03em; text-transform: uppercase;
    margin-left: auto; flex-shrink: 0;
  }

  /* Tag "obrigatório" ao lado do label */
  .cpl-req-tag {
    display: inline-block; margin-left: 6px;
    padding: 2px 7px; background: #F5F3EF; color: #9CA3AF;
    font-size: 9.5px; font-weight: 800; border-radius: 5px;
    letter-spacing: 0.04em; text-transform: uppercase;
    vertical-align: middle;
  }

  /* Explicação sob o campo */
  .cpl-field-explain {
    margin: 6px 0 0; font-size: 11.5px; color: #9CA3AF; font-weight: 500;
  }

  /* Modal info personalizado */
  .cpl-info-card {
    background: #fff; border-radius: 14px;
    padding: 24px 22px 20px; width: 92%; max-width: 380px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    display: flex; flex-direction: column; gap: 12px;
    animation: cplInfoIn 0.2s ease-out;
  }
  @keyframes cplInfoIn {
    from { opacity: 0; transform: translateY(10px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .cpl-info-ico {
    width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(135deg, #FCE0E9, #F5B8CD);
    color: #E85A8C;
    display: flex; align-items: center; justify-content: center;
    align-self: center;
    box-shadow: 0 4px 12px rgba(232,90,140,0.2);
  }
  .cpl-info-title {
    margin: 4px 0 0; font-size: 18px; font-weight: 800; color: #1F1F23;
    text-align: center; line-height: 1.3;
  }
  .cpl-info-txt {
    margin: 0; font-size: 13px; color: #4B5563; line-height: 1.5;
  }
  .cpl-info-example {
    margin: 4px 0 0; padding: 10px 12px;
    background: #FCE0E9; border-radius: 8px;
    font-size: 12.5px; color: #831843; line-height: 1.4;
  }
  .cpl-info-btn {
    margin-top: 8px; padding: 11px 16px;
    background: #E85A8C; color: #fff;
    border: none; border-radius: 10px;
    font-family: 'Geist', sans-serif; font-size: 13.5px; font-weight: 700;
    cursor: pointer; transition: background 0.15s;
  }
  .cpl-info-btn:hover { background: #d54a7a; }
`;
