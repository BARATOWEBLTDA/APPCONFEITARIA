import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { listarBiblioteca, salvarNaBiblioteca, type BibliotecaOpcao } from "@/lib/biblioteca";
import { carregarGruposDoBanco, salvarGruposParaBanco } from "@/lib/produto-grupos";
import {
  existeConflitoSaborTamanho,
  REGRA_CONFLITO_LABEL,
  REGRA_CONFLITO_HINT,
  REGRA_CONFLITO_DEFAULT,
  TIPO_ADICIONAL_DEFAULT,
  type RegraConflitoTamanho,
} from "@/lib/produto-precificacao";
import { gerarFichaProduto } from "@/lib/gerarFichaProduto";
import { usePlano } from "@/hooks/usePlano";
import { ImageCropper } from "@/components/ui/ImageCropper";
import EmptyDoo from "@/components/EmptyDoo";
import BtnNovo from "@/components/BtnNovo";
import Categorias from "@/pages/Categorias";
import QuickAddInsumo from "@/components/QuickAddInsumo";
import AppPageHeader from "@/components/AppPageHeader";
import ReqTag from "@/components/ReqTag";

// ── Helpers de conversão de unidades (ficha técnica) ──
const UNIT_FAMILIES_MAP: Record<string, { family: string; base: string; toBase: number }> = {
  kg: { family: "massa", base: "kg", toBase: 1 },
  g:  { family: "massa", base: "kg", toBase: 0.001 },
  L:  { family: "volume", base: "L", toBase: 1 },
  ml: { family: "volume", base: "L", toBase: 0.001 },
  un: { family: "unidade", base: "un", toBase: 1 },
};

function getCompatibleUnitsProd(unidadeInsumo: string): string[] {
  const info = UNIT_FAMILIES_MAP[unidadeInsumo];
  if (!info) return [unidadeInsumo];
  return Object.entries(UNIT_FAMILIES_MAP).filter(([, v]) => v.family === info.family).map(([k]) => k);
}

function getDefaultRecipeUnitProd(unidadeInsumo: string): string {
  const info = UNIT_FAMILIES_MAP[unidadeInsumo];
  if (!info) return unidadeInsumo;
  if (info.family === "massa") return "g";
  if (info.family === "volume") return "ml";
  return unidadeInsumo;
}

function calcCustoProd(qtd: number, unidadeUtilizada: string, unidadeInsumo: string, custoUnitario: number): number {
  const fU = UNIT_FAMILIES_MAP[unidadeUtilizada];
  const fI = UNIT_FAMILIES_MAP[unidadeInsumo];
  if (fU && fI && fU.family === fI.family && fI.toBase > 0) {
    return (qtd * fU.toBase / fI.toBase) * custoUnitario;
  }
  return qtd * custoUnitario;
}

function toBaseProd(qtd: number, unidade: string): number {
  const info = UNIT_FAMILIES_MAP[unidade];
  return info ? qtd * info.toBase : qtd;
}

type Tamanho = { label: string; preco: number; foto_url?: string };

type KitItem = { nome: string; quantidade: string };

// ═══ ARQUITETURA V3 ═══════════════════════════════════════════════
// Tipos pra novo sistema Produto + Variações + Personalização
type Variacao = { id: string; nome: string; preco: number; foto?: string };
type OpcaoPersonalizacao = { id: string; nome: string; adicional: number; foto?: string; tipo_adicional?: "fixo" | "por_kg" | "por_unidade" | "por_quantidade" };
type OpcaoTamanho = { id: string; nome: string; preco: number; peso_kg?: number | null; serve?: string; foto?: string };
type DistribuicaoModo = "nenhuma" | "igual" | "livre";
type GrupoPersonalizacao = {
  ativo: boolean;
  min: number;
  max: number;
  distribuicao: DistribuicaoModo;
  opcoes: OpcaoPersonalizacao[];
  foto_por_opcao?: boolean;
};
type GrupoTamanhos = {
  ativo: boolean;
  min: number;
  max: number;
  distribuicao: DistribuicaoModo;
  opcoes: OpcaoTamanho[];
  foto_por_opcao?: boolean;
  // Fase 3: modo explícito de precificação por tamanho
  // "preco_fixo"      → cada tamanho tem seu preço (default clássico)
  // "por_peso"        → preco_base × peso_kg (calcula automático)
  // "herdar_base"     → todos usam preco_normal do produto
  // "sob_consulta"    → sem preço, vira "consulte-nos"
  modo_preco_tamanho?: "preco_fixo" | "por_peso" | "herdar_base" | "sob_consulta";
  // Fase 3: label dinâmico — "Tamanhos" (bolo) vs "Quantidades" (brigadeiro/salgado)
  nome_exibicao?: "Tamanhos e Pesos" | "Quantidades";
};
type OpcaoSabor = { id: string; nome: string; adicional: number; preco?: number; foto?: string; tipo_adicional?: "fixo" | "por_kg" | "por_unidade" | "por_quantidade" };
type GrupoSabores = {
  ativo: boolean;
  min: number;
  max: number;
  distribuicao: DistribuicaoModo;
  opcoes: OpcaoSabor[];
  foto_por_opcao?: boolean;
  sabor_tem_preco_proprio?: boolean;
  regra_conflito_tamanho?: "preco_tamanho" | "preco_sabor" | "tamanho_base_sabor_adicional";
};
type TipoProduto = "simples" | "variacao" | "personalizavel" | "variacao_e_personalizavel";

const gerarId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Title Case pt-BR — "bolo de chocolate" → "Bolo de Chocolate"
const MINUSCULAS_TITLE = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "os", "as", "com", "sem", "à", "ao", "aos", "às", "em", "para", "por"]);
/**
 * Title Case inteligente — preserva capitalização intencional.
 *
 * REGRA: só normaliza quando a string está TODA em minúsculo ou TODA em
 * maiúsculo (indica que o usuário não formatou). Se tem capitalização
 * mista (M&M's, iFood, KitKat, Nutella, Kinder Bueno), preserva como
 * foi digitado.
 *
 * Exemplos:
 * - "bolo de chocolate" → "Bolo de Chocolate"    (tudo minúsculo → normaliza)
 * - "BOLO DE CHOCOLATE" → "Bolo de Chocolate"    (tudo maiúsculo → normaliza)
 * - "M&M's Chocolate"   → "M&M's Chocolate"      (mista → preserva)
 * - "iFood Special"     → "iFood Special"        (mista → preserva)
 * - "KitKat"            → "KitKat"               (mista → preserva)
 */
function titleCase(str: string): string {
  if (!str) return str;
  const trimmed = str.trim();
  if (!trimmed) return trimmed;

  // Se tem alguma capitalização mista (letra maiúscula NÃO no começo, ou
  // letra minúscula NÃO seguindo espaço), preserva tudo como veio.
  // Detecção: se, ao remover espaços/pontuação, existe alguma letra
  // maiúscula que não é a primeira letra da palavra, considera "mista".
  const palavras = trimmed.split(/\s+/);
  const temCapitalizacaoIntencional = palavras.some(palavra => {
    // Se a palavra tem UPPERCASE no meio (não no começo), é intencional
    // Ex: "iFood" (F maiúsculo no meio), "KitKat" (K maiúsculo), "M&M's"
    for (let i = 1; i < palavra.length; i++) {
      const c = palavra[i];
      // Ignora ' e outros pontuação que não são letra
      if (/[A-ZÀ-Ý]/.test(c)) return true;
    }
    return false;
  });

  if (temCapitalizacaoIntencional) return trimmed;

  // Caso "tudo minúsculo" ou "tudo maiúsculo": normaliza
  return trimmed.toLowerCase().split(/\s+/).map((p, i) => {
    if (i > 0 && MINUSCULAS_TITLE.has(p)) return p;
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(" ");
}

const GRUPO_VAZIO: GrupoPersonalizacao = {
  ativo: false, min: 1, max: 1, distribuicao: "nenhuma", opcoes: [],
};
const GRUPO_TAMANHOS_VAZIO: GrupoTamanhos = {
  ativo: false, min: 1, max: 1, distribuicao: "nenhuma", opcoes: [],
  modo_preco_tamanho: undefined,  // Sem seleção — usuário escolhe qual
  nome_exibicao: "Tamanhos e Pesos",          // Fase 3 — default
};
const GRUPO_SABORES_VAZIO: GrupoSabores = {
  ativo: false, min: 1, max: 1, distribuicao: "nenhuma", opcoes: [], sabor_tem_preco_proprio: false,
};

type Produto = {
  id?: string;
  user_id?: string;
  nome: string;
  descricao: string;
  preco_normal: number;
  preco_promocional?: number;
  imagem_url?: string;
  categoria: string;
  forma_venda: string;
  disponivel: boolean;
  promocao: boolean;
  permite_personalizacao?: boolean;
  // ── Campos ANTIGOS (mantidos por compatibilidade) ─────────────
  massas_disponiveis?: string[];
  recheios_disponiveis?: string[];
  coberturas_disponiveis?: string[];
  tamanhos_disponiveis?: Tamanho[];
  precos_variacoes?: Record<string, number>;
  fotos_variacoes?: Record<string, string>;
  usar_foto_variacao?: boolean;
  // ── V3: NOVOS campos ──────────────────────────────────────────
  tipo_produto?: TipoProduto;
  quantidade_base?: number | null;
  usar_variacoes?: boolean;
  variacoes?: Variacao[];
  label_variacao?: string;
  grupo_massas?: GrupoPersonalizacao;
  grupo_recheios?: GrupoPersonalizacao;
  grupo_coberturas?: GrupoPersonalizacao;
  grupo_sabores?: GrupoSabores;
  grupo_tamanhos?: GrupoTamanhos;
  // ── Restante ──────────────────────────────────────────────────
  oferece_pacote?: boolean;
  pronta_entrega?: boolean;
  kit_itens?: KitItem[];
  kit_serve_pessoas?: string;
  kit_prazo_encomenda?: string;
  zero_acucar?: boolean;
  tem_vela?: boolean;
  valor_vela?: number;
  tem_topo?: boolean;
  valor_topo?: number;
  tem_papel_arroz?: boolean;
  valor_papel_arroz?: number;
  tem_outro?: boolean;
  titulo_outro?: string;
  valor_outro?: number;
  tem_adicionais?: boolean;
  adicionais?: Adicional[];
  tipo_promocao?: 'fixo' | 'percentual';
  desconto_percentual?: number;
  updated_at?: string;
  created_at?: string;
};

// Um adicional (extra) de um produto: nome + valor + origem opcional na biblioteca
type Adicional = {
  nome: string;
  valor: number;
  from_biblioteca?: string; // id do extra na biblioteca_extras
};

// Extra na biblioteca do usuário (reutilizável entre produtos)
type BibliotecaExtra = {
  id: string;
  nome: string;
  valor: number;
  categorias: string[];
};

const SYSTEM_ICONS = Array.from({ length: 42 }, (_, i) => `/categoriaicones/icone (${i + 1}).png`);

// ═══════════════════════════════════════════════════════════════════
// Componente do STEP 3 (variações): Sabores e Tamanhos com grid de preços
// ═══════════════════════════════════════════════════════════════════
type Subtipo = "sabores_e_tamanhos" | "so_sabores" | "so_tamanhos";
interface SaboresTamanhosStepProps {
  subtipo: Subtipo | null;
  onSubtipoChange: (s: Subtipo) => void;
  sabores: string[];
  onSaboresChange: (s: string[]) => void;
  tamanhos: Tamanho[];
  onTamanhosChange: (t: Tamanho[]) => void;
  precos: Record<string, number>;
  onPrecosChange: (p: Record<string, number>) => void;
}
function SaboresTamanhosStep({ subtipo, onSubtipoChange, sabores, onSaboresChange, tamanhos, onTamanhosChange, precos, onPrecosChange }: SaboresTamanhosStepProps) {
  const [novoSabor, setNovoSabor] = useState("");
  const [novoTamanho, setNovoTamanho] = useState("");
  // Modo lista automático quando combinações > 12
  const [listaModeManual, setListaModeManual] = useState<boolean | null>(null);
  const listaMode = listaModeManual !== null ? listaModeManual : (sabores.length * tamanhos.length > 12);
  const setListaMode = (v: boolean) => setListaModeManual(v);
  // Máscara BRL
  const formatPreco = (v: number) => v > 0 ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  const parsePreco = (s: string) => (parseInt(s.replace(/\D/g, "")) || 0) / 100;

  const addSabor = () => {
    const s = novoSabor.trim();
    if (!s || sabores.includes(s) || sabores.length >= 30) return;
    onSaboresChange([...sabores, s]);
    setNovoSabor("");
  };
  const removeSabor = (idx: number) => {
    const s = sabores[idx];
    // remove todos os preços associados a esse sabor
    const novosPrecos = { ...precos };
    Object.keys(novosPrecos).forEach(k => { if (k.startsWith(`${s}|`)) delete novosPrecos[k]; });
    onSaboresChange(sabores.filter((_, i) => i !== idx));
    onPrecosChange(novosPrecos);
  };
  const addTamanho = () => {
    const t = novoTamanho.trim();
    if (!t || tamanhos.some(x => x.label === t) || tamanhos.length >= 12) return;
    onTamanhosChange([...tamanhos, { label: t, preco: 0 }]);
    setNovoTamanho("");
  };
  const removeTamanho = (idx: number) => {
    const t = tamanhos[idx].label;
    const novosPrecos = { ...precos };
    Object.keys(novosPrecos).forEach(k => { if (k.endsWith(`|${t}`)) delete novosPrecos[k]; });
    onTamanhosChange(tamanhos.filter((_, i) => i !== idx));
    onPrecosChange(novosPrecos);
  };

  const setPrecoCombo = (sabor: string, tamanho: string, valor: number) => {
    const key = `${sabor}|${tamanho}`;
    onPrecosChange({ ...precos, [key]: valor });
  };

  const mostraSabores = subtipo === "sabores_e_tamanhos" || subtipo === "so_sabores";
  const mostraTamanhos = subtipo === "sabores_e_tamanhos" || subtipo === "so_tamanhos";
  const mostraGrid = subtipo === "sabores_e_tamanhos" && sabores.length > 0 && tamanhos.length > 0;
  const mostraListaSabores = subtipo === "so_sabores" && sabores.length > 0;
  const mostraListaTamanhos = subtipo === "so_tamanhos" && tamanhos.length > 0;

  return (
    <div className="prod-modal-body">
      <p className="st-hint-topo">Configure sabores, tamanhos e preços de cada combinação.</p>

      {/* Selector de subtipo (3 cards) */}
      <div className="st-subtipo-wrap">
        <div className="st-subtipo-label">Este produto terá</div>
        <div className="st-subcards">
          <button type="button" className={`st-subcard ${subtipo === "sabores_e_tamanhos" ? "st-subcard--ativo" : ""}`} onClick={() => onSubtipoChange("sabores_e_tamanhos")}>
            <div className="st-subcard-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>
            </div>
            <div className="st-subcard-title">Sabores e tamanhos</div>
            <div className="st-subcard-desc">Ex.: bolo (sabor + P/M/G)</div>
          </button>
          <button type="button" className={`st-subcard ${subtipo === "so_sabores" ? "st-subcard--ativo" : ""}`} onClick={() => onSubtipoChange("so_sabores")}>
            <div className="st-subcard-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6 8 6 13 6 16a6 6 0 0 0 12 0c0-3 0-8-6-14z"/></svg>
            </div>
            <div className="st-subcard-title">Só sabores</div>
            <div className="st-subcard-desc">Ex.: brigadeiro (ninho, morango)</div>
          </button>
          <button type="button" className={`st-subcard ${subtipo === "so_tamanhos" ? "st-subcard--ativo" : ""}`} onClick={() => onSubtipoChange("so_tamanhos")}>
            <div className="st-subcard-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v-3H3v3M21 12V9H3v3M21 9V6H3v3"/></svg>
            </div>
            <div className="st-subcard-title">Só tamanhos</div>
            <div className="st-subcard-desc">Ex.: torta (fatia, inteira)</div>
          </button>
        </div>
      </div>

      {/* Seção de SABORES */}
      {mostraSabores && (
        <div className="st-secao">
          <div className="st-secao-header">
            <div className="st-secao-title">
              <span className="st-secao-dot st-secao-dot--rosa"></span>
              Sabores <span className="st-secao-count">{sabores.length}/30</span>
            </div>
          </div>
          <div className="st-add-row">
            <input type="text" placeholder="Digite o sabor..." value={novoSabor} onChange={e => setNovoSabor(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSabor(); }}} className="st-add-input" />
            <button type="button" className="st-add-btn" onClick={addSabor} disabled={!novoSabor.trim() || sabores.length >= 30}>+</button>
          </div>
          {sabores.length === 0 ? (
            <div className="st-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B4A9AE" strokeWidth="1.5"><path d="M12 2C6 8 6 13 6 16a6 6 0 0 0 12 0c0-3 0-8-6-14z"/></svg>
              <div>Nenhum sabor adicionado</div>
            </div>
          ) : (
            <div className="st-lista">
              {sabores.map((s, i) => (
                <div key={i} className="st-item">
                  <span className="st-item-num">{i + 1}</span>
                  <span className="st-item-label">{s}</span>
                  <button type="button" className="st-item-remove" onClick={() => removeSabor(i)} aria-label="Remover">✕</button>
                </div>
              ))}
            </div>
          )}
          <p className="st-hint">* Exatamente 1 sabor por item.</p>
        </div>
      )}

      {/* Seção de TAMANHOS */}
      {mostraTamanhos && (
        <div className="st-secao">
          <div className="st-secao-header">
            <div className="st-secao-title">
              <span className="st-secao-dot st-secao-dot--azul"></span>
              Tamanhos <span className="st-secao-count">{tamanhos.length}/12</span>
            </div>
          </div>
          <div className="st-add-row">
            <input type="text" placeholder="Digite o tamanho..." value={novoTamanho} onChange={e => setNovoTamanho(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTamanho(); }}} className="st-add-input" />
            <button type="button" className="st-add-btn" onClick={addTamanho} disabled={!novoTamanho.trim() || tamanhos.length >= 12}>+</button>
          </div>
          {tamanhos.length === 0 ? (
            <div className="st-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B4A9AE" strokeWidth="1.5"><path d="M21 15v-3H3v3M21 12V9H3v3M21 9V6H3v3"/></svg>
              <div>Nenhum tamanho adicionado</div>
            </div>
          ) : subtipo === "so_tamanhos" ? null : (
            <div className="st-lista">
              {tamanhos.map((t, i) => (
                <div key={i} className="st-item">
                  <span className="st-item-num">{i + 1}</span>
                  <span className="st-item-label">{t.label}</span>
                  <button type="button" className="st-item-remove" onClick={() => removeTamanho(i)} aria-label="Remover">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GRID de preços — Sabores × Tamanhos */}
      {mostraGrid && (
        <div className="st-secao">
          <div className="st-precos-header">
            <div className="st-secao-title" style={{marginBottom: 0}}>💰 Preços por combinação</div>
            <div className="st-precos-toggle">
              <button
                type="button"
                className={`st-precos-toggle-btn ${!listaMode ? "st-precos-toggle-btn--ativo" : ""}`}
                onClick={() => setListaMode(false)}
                aria-label="Ver como grade"
                title="Grade"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                </svg>
              </button>
              <button
                type="button"
                className={`st-precos-toggle-btn ${listaMode ? "st-precos-toggle-btn--ativo" : ""}`}
                onClick={() => setListaMode(true)}
                aria-label="Ver como lista"
                title="Lista"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/>
                </svg>
              </button>
            </div>
          </div>
          {sabores.length * tamanhos.length > 12 && !listaMode && (
            <div className="st-precos-tip">💡 Muitas combinações — modo lista é mais fácil de preencher</div>
          )}

          {listaMode ? (
            /* MODO LISTA — 1 linha por combinação */
            <div className="st-combo-lista">
              {sabores.map((s) => (
                tamanhos.map((t) => {
                  const key = `${s}|${t.label}`;
                  const val = precos[key] || 0;
                  return (
                    <div key={key} className="st-combo-row">
                      <div className="st-combo-labels">
                        <span className="st-combo-sabor">{s}</span>
                        <span className="st-combo-sep">×</span>
                        <span className="st-combo-tam">{t.label}</span>
                      </div>
                      <div className="st-preco-input-wrap">
                        <span className="st-grid-rs">R$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatPreco(val)}
                          placeholder="0,00"
                          onChange={e => setPrecoCombo(s, t.label, parsePreco(e.target.value))}
                          className="st-preco-input"
                        />
                      </div>
                    </div>
                  );
                })
              )).flat()}
            </div>
          ) : (
            /* MODO GRID — tabela */
            <div className="st-grid-wrap">
              <table className="st-grid">
                <thead>
                  <tr>
                    <th className="st-grid-corner">Sabor</th>
                    {tamanhos.map((t, i) => <th key={i}>{t.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sabores.map((s, i) => (
                    <tr key={i}>
                      <td className="st-grid-sabor">{s}</td>
                      {tamanhos.map((t, j) => {
                        const key = `${s}|${t.label}`;
                        const val = precos[key] || 0;
                        return (
                          <td key={j}>
                            <div className="st-grid-cell">
                              <span className="st-grid-rs">R$</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatPreco(val)}
                                placeholder="0,00"
                                onChange={e => setPrecoCombo(s, t.label, parsePreco(e.target.value))}
                                className="st-grid-input"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Só sabores com lista de preços */}
      {mostraListaSabores && (
        <div className="st-secao">
          <div className="st-secao-title" style={{marginBottom: 10}}>💰 Preço de cada sabor</div>
          {sabores.map((s, i) => {
            const key = `${s}|`;
            return (
              <div key={i} className="st-preco-row">
                <span className="st-preco-label">{s}</span>
                <div className="st-preco-input-wrap">
                  <span className="st-grid-rs">R$</span>
                  <input type="text" inputMode="numeric" value={formatPreco(precos[key] || 0)} placeholder="0,00" onChange={e => onPrecosChange({ ...precos, [key]: parsePreco(e.target.value) })} className="st-preco-input" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Só tamanhos com lista de preços */}
      {mostraListaTamanhos && (
        <div className="st-secao">
          <div className="st-secao-title" style={{marginBottom: 10}}>💰 Preço de cada tamanho</div>
          {tamanhos.map((t, i) => {
            const key = `|${t.label}`;
            return (
              <div key={i} className="st-preco-row">
                <span className="st-preco-label">{t.label}</span>
                <div className="st-preco-input-wrap">
                  <span className="st-grid-rs">R$</span>
                  <input type="text" inputMode="numeric" value={formatPreco(precos[key] || 0)} placeholder="0,00" onChange={e => onPrecosChange({ ...precos, [key]: parsePreco(e.target.value) })} className="st-preco-input" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state cruzado — quando só tem 1 lado no modo "sabores_e_tamanhos" */}
      {subtipo === "sabores_e_tamanhos" && sabores.length > 0 && tamanhos.length === 0 && (
        <div className="st-cross-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B4A9AE" strokeWidth="1.5"><path d="M21 15v-3H3v3M21 12V9H3v3M21 9V6H3v3"/></svg>
          <div>Adicione ao menos 1 tamanho pra montar o grid de preços</div>
        </div>
      )}
      {subtipo === "sabores_e_tamanhos" && tamanhos.length > 0 && sabores.length === 0 && (
        <div className="st-cross-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B4A9AE" strokeWidth="1.5"><path d="M12 2C6 8 6 13 6 16a6 6 0 0 0 12 0c0-3 0-8-6-14z"/></svg>
          <div>Adicione ao menos 1 sabor pra montar o grid de preços</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PersonalizacaoStep (V3) — 4 grupos colapsáveis com min/max/adicional
// ═══════════════════════════════════════════════════════════════════
interface PersonalizacaoStepProps {
  grupoMassas: GrupoPersonalizacao;
  grupoRecheios: GrupoPersonalizacao;
  grupoCoberturas: GrupoPersonalizacao;
  grupoSabores: GrupoSabores;
  grupoTamanhos: GrupoTamanhos;
  precoBase: number;
  quantidadeBase: number | null;
  formaVenda: string;
  onChange: (patch: Partial<Produto>) => void;
  onPrecoBaseChange: (v: number) => void;
  onFormaVendaChange: (v: string) => void;
  mobileMode?: "checklist" | "fill";
  onGoToFill?: () => void;
  onBackToChecklist?: () => void;
  primeiroNome?: string;
  produtoNome?: string;
  produtoCategoria?: string;
}

// ═══════════════════════════════════════════════════════════════
// SelectDoonly — Seletor custom (mobile: bottom sheet, desktop: popover)
// ═══════════════════════════════════════════════════════════════
interface SelectDoonlyOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
}
interface SelectDoonlyProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectDoonlyOption[];
  placeholder?: string;
  title?: string;
  extraOptionLabel?: string;
  onExtraOption?: () => void;
  big?: boolean;
}
function SelectDoonly({
  value, onChange, options, placeholder = "Selecione...", title = "Escolha uma opção", extraOptionLabel, onExtraOption, big = false
}: SelectDoonlyProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pop, setPop] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Calcula posição do popover (position: fixed baseado no trigger)
    if (!isMobile && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const espacoAbaixo = window.innerHeight - r.bottom;
      const alturaEstimada = Math.min(320, options.length * 34 + 30);
      // Se não cabe embaixo, abre pra cima
      const abrePraCima = espacoAbaixo < alturaEstimada + 20 && r.top > alturaEstimada;
      setPop({
        top: abrePraCima ? r.top - alturaEstimada - 6 : r.bottom + 6,
        left: r.left,
        width: r.width,
      });
    }
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false);
    };
    // Só fecha se scroll for FORA do popover (permite rolar categorias por dentro)
    // No mobile o dropdown vira bottom sheet fixed — não deve fechar em nenhum scroll
    const onScroll = (e: Event) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const t = setTimeout(() => {
      window.addEventListener("click", handler);
      if (!isMobile) window.addEventListener("scroll", onScroll, true);
    }, 10);
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", handler);
      if (!isMobile) window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, isMobile, options.length]);

  const selected = options.find(o => o.value === value);

  return (
    <div className="sd-wrap">
      <button
        ref={btnRef}
        type="button"
        className={`sd-trigger ${open ? "sd-trigger--open" : ""} ${big ? "sd-trigger--big" : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className={`sd-trigger-text ${!selected ? "sd-trigger-text--placeholder" : ""}`}>
          {selected ? (
            <>
              {selected.icon && <span className="sd-trigger-icon">{selected.icon}</span>}
              {selected.label}
            </>
          ) : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none"}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && isMobile && (
        <div className="sd-sheet-ov" onClick={() => setOpen(false)}>
          <div className="sd-sheet" onClick={e => e.stopPropagation()}>
            <div className="sd-sheet-handle" />
            <div className="sd-sheet-title">{title}</div>
            <div className="sd-sheet-list">
              {options.map(op => (
                <button
                  key={op.value}
                  type="button"
                  className={`sd-sheet-item ${op.value === value ? "sd-sheet-item--ativo" : ""}`}
                  onClick={() => { onChange(op.value); setOpen(false); }}
                >
                  {op.icon && <span className="sd-item-icon">{op.icon}</span>}
                  <span className="sd-item-label">
                    {op.label}
                    {op.hint && <span className="sd-item-hint">{op.hint}</span>}
                  </span>
                  {op.value === value && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>
              ))}
              {extraOptionLabel && onExtraOption && (
                <button
                  type="button"
                  className="sd-sheet-item sd-sheet-item--extra"
                  onClick={() => { onExtraOption(); setOpen(false); }}
                >
                  <span className="sd-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </span>
                  <span className="sd-item-label">{extraOptionLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {open && !isMobile && pop && (
        <div
          ref={popRef}
          className="sd-popover"
          style={{ top: pop.top, left: pop.left, width: pop.width }}
          onClick={e => e.stopPropagation()}
        >
          {options.map(op => (
            <button
              key={op.value}
              type="button"
              className={`sd-pop-item ${op.value === value ? "sd-pop-item--ativo" : ""}`}
              onClick={() => { onChange(op.value); setOpen(false); }}
            >
              {op.icon && <span className="sd-item-icon">{op.icon}</span>}
              <span className="sd-item-label">
                {op.label}
                {op.hint && <span className="sd-item-hint">{op.hint}</span>}
              </span>
              {op.value === value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </button>
          ))}
          {extraOptionLabel && onExtraOption && (
            <button
              type="button"
              className="sd-pop-item sd-pop-item--extra"
              onClick={() => { onExtraOption(); setOpen(false); }}
            >
              <span className="sd-item-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
              <span className="sd-item-label">{extraOptionLabel}</span>
            </button>
          )}
        </div>
      )}

      <style>{`
        .sd-wrap { position: relative; width: 100%; }
        .sd-trigger {
          all: unset;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
          padding: 14px 14px;
          background: #fff;
          border: 1.5px solid #E5D8DE;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          color: #2D1F26;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .sd-trigger:hover { border-color: #E85A8C; }
        .sd-trigger--open {
          border-color: #E85A8C;
          box-shadow: 0 0 0 3px rgba(232, 90, 140, 0.1);
        }
        .sd-trigger--big {
          padding: 20px 14px;
          font-size: 16px;
        }
        .sd-trigger-text {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sd-trigger-text--placeholder { color: #9A8B93; font-weight: 500; }
        .sd-trigger-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px; height: 24px;
          background: #FCE0E9;
          color: #E85A8C;
          border-radius: 6px;
          flex-shrink: 0;
        }

        /* Bottom sheet (mobile) */
        .sd-sheet-ov {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 4000;
          display: flex;
          align-items: flex-end;
          animation: sdFadeIn 0.2s ease;
        }
        @keyframes sdFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sd-sheet {
          width: 100%;
          background: #fff;
          border-radius: 20px 20px 0 0;
          padding: 8px 16px 24px;
          max-height: 70vh;
          overflow-y: auto;
          animation: sdSlideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @keyframes sdSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .sd-sheet-handle {
          width: 40px; height: 4px;
          background: #E5D8DE;
          border-radius: 2px;
          margin: 8px auto 12px;
        }
        .sd-sheet-title {
          font-size: 15px;
          font-weight: 800;
          color: #2D1F26;
          text-align: center;
          margin-bottom: 12px;
        }
        .sd-sheet-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .sd-sheet-item {
          all: unset;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.12s;
          width: 100%;
          box-sizing: border-box;
        }
        .sd-sheet-item:hover { background: #FAF8F5; }
        .sd-sheet-item--ativo {
          background: #FDF3F7;
          color: #831843;
        }
        .sd-sheet-item--ativo .sd-item-label { font-weight: 700; }
        .sd-sheet-item--ativo svg { color: #E85A8C; }
        .sd-sheet-item--extra {
          border-top: 1px solid #F0EBED;
          margin-top: 4px;
          padding-top: 14px;
          color: #E85A8C;
        }
        .sd-sheet-item--extra .sd-item-label { font-weight: 700; }
        .sd-sheet-item--extra .sd-item-icon {
          background: #FCE0E9;
          color: #E85A8C;
        }

        /* Popover (desktop) */
        .sd-popover {
          position: fixed;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 10px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.08);
          padding: 6px;
          z-index: 10050;
          max-height: 320px;
          overflow-y: auto;
          animation: sdPopIn 0.15s ease;
        }
        @keyframes sdPopIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sd-pop-item {
          all: unset;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 13.5px;
          color: #2D1F26;
          transition: background 0.12s;
          width: 100%;
          box-sizing: border-box;
        }
        .sd-pop-item:hover { background: #FAF8F5; }
        .sd-pop-item--ativo {
          background: #FDF3F7;
          color: #831843;
        }
        .sd-pop-item--ativo .sd-item-label { font-weight: 700; }
        .sd-pop-item--ativo svg { color: #E85A8C; }
        .sd-pop-item--extra {
          border-top: 1px solid #F0EBED;
          margin-top: 4px;
          padding-top: 10px;
          color: #E85A8C;
        }
        .sd-pop-item--extra .sd-item-label { font-weight: 700; }
        .sd-pop-item--extra .sd-item-icon {
          background: #FCE0E9;
          color: #E85A8C;
        }

        /* Item shared */
        .sd-item-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px; height: 26px;
          background: #FAF8F5;
          color: #6B5D64;
          border-radius: 6px;
          flex-shrink: 0;
        }
        .sd-item-label {
          flex: 1;
          font-size: 14px;
          display: flex;
          flex-direction: column;
        }
        .sd-item-hint {
          font-size: 11.5px;
          color: #9A8B93;
          font-weight: 500;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}

function PersonalizacaoStep({
  grupoMassas, grupoRecheios, grupoCoberturas, grupoSabores, grupoTamanhos,
  precoBase, quantidadeBase, formaVenda, onChange, onPrecoBaseChange, onFormaVendaChange,
  mobileMode, onGoToFill, onBackToChecklist, primeiroNome, produtoNome, produtoCategoria,
}: PersonalizacaoStepProps) {
  const [expandido, setExpandido] = useState<string | null>(null);
  // Bottom sheet "Escolher da biblioteca"
  const [bibSheetGrupo, setBibSheetGrupo] = useState<"massas" | "recheios" | "coberturas" | "sabores" | "tamanhos" | null>(null);
  const [infoTip, setInfoTip] = useState<string | null>(null);

  // Sugere modo de preço baseado em categoria + nome do produto
  const modoSugerido: "preco_fixo" | "por_peso" = (() => {
    const nome = (produtoNome || "").toLowerCase();
    const cat = (produtoCategoria || "").toLowerCase();
    // Regras "por peso" (categoria/nome forte pra kg)
    if (cat.includes("bolo") || cat.includes("torta")) return "por_peso";
    if (/\b(bolo|torta|pão|panetone|rocambole)\b/.test(nome)) return "por_peso";
    // Padrão seguro
    return "preco_fixo";
  })();

  // Auto-marca a sugestão quando o card está ativo e usuário ainda não escolheu
  useEffect(() => {
    if (!grupoTamanhos.ativo) return;
    if (grupoTamanhos.modo_preco_tamanho) return; // já escolheu
    onChange({ grupo_tamanhos: { ...grupoTamanhos, modo_preco_tamanho: modoSugerido } } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoTamanhos.ativo, modoSugerido]);
  const [bibSheetSelected, setBibSheetSelected] = useState<Set<string>>(new Set());
  const abrirBibSheet = (grupo: "massas" | "recheios" | "coberturas" | "sabores" | "tamanhos") => {
    setBibSheetSelected(new Set());
    setBibSheetGrupo(grupo);
  };
  const toggleBibSelected = (nome: string) => {
    setBibSheetSelected(prev => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome); else next.add(nome);
      return next;
    });
  };
  const confirmarBibSheet = () => {
    if (!bibSheetGrupo) return;
    const selecionados = Array.from(bibSheetSelected);
    if (selecionados.length === 0) { setBibSheetGrupo(null); return; }

    if (bibSheetGrupo === "tamanhos") {
      // Constrói novos tamanhos evitando duplicatas
      const existentes = new Set(grupoTamanhos.opcoes.map((o: any) => o.nome.toLowerCase()));
      const novos = selecionados
        .map(n => titleCase(n.trim()))
        .filter(n => n && !existentes.has(n.toLowerCase()))
        .map(n => ({ id: gerarId(), nome: n, preco: 0 }));
      if (novos.length > 0) {
        onChange({ grupo_tamanhos: { ...grupoTamanhos, opcoes: [...grupoTamanhos.opcoes, ...novos] } } as any);
      }
    } else {
      const grupo = bibSheetGrupo as "massas" | "recheios" | "coberturas" | "sabores";
      const key = `grupo_${grupo}` as const;
      const atual = grupo === "massas" ? grupoMassas
        : grupo === "recheios" ? grupoRecheios
        : grupo === "sabores" ? grupoSabores
        : grupoCoberturas;
      const existentes = new Set(atual.opcoes.map(o => o.nome.toLowerCase()));
      const novos = selecionados
        .map(n => titleCase(n.trim()))
        .filter(n => n && !existentes.has(n.toLowerCase()))
        .map(n => ({ id: gerarId(), nome: n, adicional: 0 }));
      if (novos.length > 0) {
        onChange({ [key]: { ...atual, opcoes: [...atual.opcoes, ...novos] } } as any);
        // Salva cada um na biblioteca em paralelo (fire-and-forget)
        novos.forEach(n => { salvarNaBiblioteca(grupo, n.nome, 0); });
      }
    }
    setBibSheetGrupo(null);
    setBibSheetSelected(new Set());
  };
  const [avancadoOpen, setAvancadoOpen] = useState<Record<string, boolean>>({});
  const [showInfo, setShowInfo] = useState(false);
  const [showUnidade, setShowUnidade] = useState(false);
  const [biblioteca, setBiblioteca] = useState<Record<string, BibliotecaOpcao[]>>({
    massas: [], recheios: [], coberturas: [], sabores: [], tamanhos: []
  });

  // Carrega biblioteca ao ativar uma categoria pela primeira vez
  useEffect(() => {
    const carregarCategoria = async (cat: string, ativo: boolean) => {
      if (!ativo || biblioteca[cat].length > 0) return;
      const opcoes = await listarBiblioteca(cat);
      setBiblioteca(prev => ({ ...prev, [cat]: opcoes }));
    };
    carregarCategoria("massas", grupoMassas.ativo);
    carregarCategoria("recheios", grupoRecheios.ativo);
    carregarCategoria("coberturas", grupoCoberturas.ativo);
    carregarCategoria("sabores", grupoSabores.ativo);
    carregarCategoria("tamanhos", grupoTamanhos.ativo);
  }, [grupoMassas.ativo, grupoRecheios.ativo, grupoCoberturas.ativo, grupoSabores.ativo, grupoTamanhos.ativo]);

  useEffect(() => {
    if (!showInfo) return;
    const handler = () => setShowInfo(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [showInfo]);

  useEffect(() => {
    if (!showUnidade) return;
    const handler = () => setShowUnidade(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [showUnidade]);

  const formatPreco = (v: number) =>
    (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const parsePreco = (s: string): number => {
    const digits = s.replace(/\D/g, "");
    if (!digits) return 0;
    return parseInt(digits, 10) / 100;
  };

  // Mapeia forma_venda pra sufixo curto (/kg, /un, /cento, etc)
  const unidadeCurta = (fv: string): string => {
    const map: Record<string, string> = {
      "unidade": "un",
      "fatia": "fatia",
      "kg": "kg",
      "cento": "cento",
      "tamanho": "",
      "caixa": "caixa",
      "kit-festa": "kit",
      "sob-encomenda": "",
      "outros": "",
    };
    return map[fv] ?? "";
  };
  const sufixo = unidadeCurta(formaVenda);

  const toggleAtivo = (grupo: "massas" | "recheios" | "coberturas" | "sabores" | "tamanhos", ativo: boolean) => {
    const key = `grupo_${grupo}` as const;
    const atual = grupo === "tamanhos" ? grupoTamanhos : (
      grupo === "massas" ? grupoMassas :
      grupo === "recheios" ? grupoRecheios :
      grupo === "sabores" ? grupoSabores :
      grupoCoberturas
    );
    // Defaults inteligentes por categoria ao ativar
    let min = atual.min, max = atual.max;
    if (ativo) {
      if (grupo === "recheios") { min = 1; max = 99; } // Recheios permite múltiplos
      else { min = 1; max = 1; } // Massa/Cobertura/Sabor/Tamanho — sempre 1
    }
    onChange({ [key]: { ...atual, ativo, min, max } } as any);
    if (ativo) setExpandido(grupo);
  };

  const addOpcao = (grupo: "massas" | "recheios" | "coberturas" | "sabores", nome: string) => {
    const nomeLimpo = titleCase(nome.trim());
    if (!nomeLimpo) return;
    const key = `grupo_${grupo}` as const;
    const atual = grupo === "massas" ? grupoMassas
      : grupo === "recheios" ? grupoRecheios
      : grupo === "sabores" ? grupoSabores
      : grupoCoberturas;
    // Evita duplicata dentro do produto
    if (atual.opcoes.some(o => o.nome.toLowerCase() === nomeLimpo.toLowerCase())) return;
    onChange({
      [key]: {
        ...atual,
        opcoes: [...atual.opcoes, { id: gerarId(), nome: nomeLimpo, adicional: 0 }],
      },
    } as any);
    // Salva na biblioteca (fire-and-forget)
    salvarNaBiblioteca(grupo, nomeLimpo, 0).then(async () => {
      const opcoes = await listarBiblioteca(grupo);
      setBiblioteca(prev => ({ ...prev, [grupo]: opcoes }));
    });
  };

  const removeOpcao = (grupo: "massas" | "recheios" | "coberturas" | "sabores", id: string) => {
    const key = `grupo_${grupo}` as const;
    const atual = grupo === "massas" ? grupoMassas
      : grupo === "recheios" ? grupoRecheios
      : grupo === "sabores" ? grupoSabores
      : grupoCoberturas;
    onChange({ [key]: { ...atual, opcoes: atual.opcoes.filter(o => o.id !== id) } } as any);
  };

  // Reordenar opções (mover pra cima ou baixo)
  const moveOpcao = (grupo: "massas" | "recheios" | "coberturas" | "sabores", id: string, dir: -1 | 1) => {
    const key = `grupo_${grupo}` as const;
    const atual = grupo === "massas" ? grupoMassas
      : grupo === "recheios" ? grupoRecheios
      : grupo === "sabores" ? grupoSabores
      : grupoCoberturas;
    const idx = atual.opcoes.findIndex(o => o.id === id);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= atual.opcoes.length) return;
    const opcoes = [...atual.opcoes];
    [opcoes[idx], opcoes[newIdx]] = [opcoes[newIdx], opcoes[idx]];
    onChange({ [key]: { ...atual, opcoes } } as any);
  };

  const moveTamanho = (id: string, dir: -1 | 1) => {
    const idx = grupoTamanhos.opcoes.findIndex(o => o.id === id);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= grupoTamanhos.opcoes.length) return;
    const opcoes = [...grupoTamanhos.opcoes];
    [opcoes[idx], opcoes[newIdx]] = [opcoes[newIdx], opcoes[idx]];
    onChange({ grupo_tamanhos: { ...grupoTamanhos, opcoes } });
  };

  const updateAdicional = (grupo: "massas" | "recheios" | "coberturas" | "sabores", id: string, valor: number) => {
    const key = `grupo_${grupo}` as const;
    const atual = grupo === "massas" ? grupoMassas
      : grupo === "recheios" ? grupoRecheios
      : grupo === "sabores" ? grupoSabores
      : grupoCoberturas;
    onChange({
      [key]: {
        ...atual,
        opcoes: atual.opcoes.map(o => o.id === id ? { ...o, adicional: valor } : o),
      },
    } as any);
  };

  // Sabor específico: atualizar preço próprio
  const updateSaborPreco = (id: string, preco: number) => {
    onChange({
      grupo_sabores: {
        ...grupoSabores,
        opcoes: grupoSabores.opcoes.map(o => o.id === id ? { ...o, preco } : o),
      },
    } as any);
  };

  // Sabor específico: toggle preço próprio
  const toggleSaborPrecoProprio = (val: boolean) => {
    onChange({
      grupo_sabores: { ...grupoSabores, sabor_tem_preco_proprio: val },
    } as any);
  };

  const updateDistribuicao = (grupo: "recheios", modo: DistribuicaoModo) => {
    onChange({ grupo_recheios: { ...grupoRecheios, distribuicao: modo } } as any);
  };

  // Tamanhos
  const addTamanho = (nome: string, preco: number) => {
    // Tamanho preserva UPPERCASE curto (P, M, G) mas title case pra palavras longas
    const nomeTrim = nome.trim();
    if (!nomeTrim) return;
    const nomeLimpo = nomeTrim.length <= 3 ? nomeTrim.toUpperCase() : titleCase(nomeTrim);
    // Evita duplicata
    if (grupoTamanhos.opcoes.some(o => o.nome.toLowerCase() === nomeLimpo.toLowerCase())) return;
    onChange({
      grupo_tamanhos: {
        ...grupoTamanhos,
        opcoes: [...grupoTamanhos.opcoes, { id: gerarId(), nome: nomeLimpo, preco: preco || 0 }],
      },
    });
    // Salva na biblioteca
    salvarNaBiblioteca("tamanhos", nomeLimpo, 0).then(async () => {
      const opcoes = await listarBiblioteca("tamanhos");
      setBiblioteca(prev => ({ ...prev, tamanhos: opcoes }));
    });
  };

  // Gera tamanhos em intervalo (0,5 a 10 de 0,5 em 0,5 = 20 tamanhos) — pra modo por_peso
  const gerarTamanhosPadrao = (deKg: number = 0.5, ateKg: number = 5, passoKg: number = 0.5) => {
    const existentes = new Set(grupoTamanhos.opcoes.map(o => o.nome.toLowerCase()));
    const novos: { id: string; nome: string; preco: number }[] = [];
    // Trabalha com inteiros (× 100) pra evitar erros de ponto flutuante do JS
    const deI = Math.round(deKg * 100);
    const ateI = Math.round(ateKg * 100);
    const passoI = Math.round(passoKg * 100);
    if (passoI <= 0 || deI > ateI) return;
    for (let pesoI = deI; pesoI <= ateI; pesoI += passoI) {
      const peso = pesoI / 100;
      const nome = peso % 1 === 0 ? `${peso}kg` : `${peso.toString().replace(".", ",")}kg`;
      if (existentes.has(nome.toLowerCase())) continue;
      novos.push({ id: gerarId(), nome, preco: 0 });
    }
    if (novos.length === 0) return;
    onChange({
      grupo_tamanhos: {
        ...grupoTamanhos,
        opcoes: [...grupoTamanhos.opcoes, ...novos],
      },
    });
  };

  const removeTamanho = (id: string) => {
    onChange({ grupo_tamanhos: { ...grupoTamanhos, opcoes: grupoTamanhos.opcoes.filter(o => o.id !== id) } });
  };

  // ── State pra inputs de "adicionar nova opção" ─────────────────
  const [novoMassa, setNovoMassa] = useState("");
  const [novoRecheio, setNovoRecheio] = useState("");
  const [novoCobertura, setNovoCobertura] = useState("");
  const [novoSaborInput, setNovoSaborInput] = useState("");
  const [novoTamanhoNome, setNovoTamanhoNome] = useState("");
  const [novoTamanhoPreco, setNovoTamanhoPreco] = useState("");
  // 2️⃣ Cadastro manual: chip de unidade selecionada
  type UnidadeTam = "kg" | "cm" | "un" | "fatia";
  const [novoTamanhoUnid, setNovoTamanhoUnid] = useState<UnidadeTam>("kg");
  // 1️⃣ Modal do "gerar tamanhos"
  const [gerarModalAberto, setGerarModalAberto] = useState(false);
  const [gerarDe, setGerarDe] = useState("0,5");
  const [gerarAte, setGerarAte] = useState("5");
  const [gerarPasso, setGerarPasso] = useState(0.5);

  const grupos: Array<{
    key: "massas" | "recheios" | "coberturas" | "sabores" | "tamanhos";
    icone: React.ReactNode;
    titulo: string;
    subtitulo: string;
    dados: GrupoPersonalizacao | GrupoTamanhos | GrupoSabores;
  }> = [
    {
      key: "massas",
      icone: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10z"/>
          <path d="M4 14h16"/>
          <path d="M8 10V6a4 4 0 0 1 8 0v4"/>
        </svg>
      ),
      titulo: "Massas",
      subtitulo: "Baunilha, chocolate, red velvet...",
      dados: grupoMassas,
    },
    {
      key: "recheios",
      icone: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
        </svg>
      ),
      titulo: "Recheios",
      subtitulo: "Brigadeiro, ninho, doce de leite...",
      dados: grupoRecheios,
    },
    {
      key: "coberturas",
      icone: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z"/>
        </svg>
      ),
      titulo: "Coberturas",
      subtitulo: "Chantilly, ganache, pasta americana...",
      dados: grupoCoberturas,
    },
    {
      key: "sabores",
      icone: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C10 6 6 8 6 12a6 6 0 0 0 12 0c0-4-4-6-6-10z"/>
        </svg>
      ),
      titulo: "Sabores",
      subtitulo: "Tradicional, chocolate, ninho...",
      dados: grupoSabores,
    },
    {
      key: "tamanhos",
      icone: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h20"/>
          <path d="M6 8v8"/>
          <path d="M10 6v12"/>
          <path d="M14 8v8"/>
          <path d="M18 10v4"/>
        </svg>
      ),
      titulo: grupoTamanhos.nome_exibicao || "Tamanhos e Pesos",
      subtitulo: (grupoTamanhos.nome_exibicao === "Quantidades")
        ? "50 un, 100 un, 200 un — cada um com seu preço"
        : "P, M, G — cada um com seu preço",
      dados: grupoTamanhos,
    },
  ];

  // ── Preview do preço mínimo e máximo ────────────────────────────
  /**
   * Calcula faixa de preço (min-max) que o cliente pode pagar.
   * Considera:
   * - Preço base ou tamanhos (o menor vira base)
   * - Promoção percentual (aplicada no final)
   * - Regra de conflito Sabor × Tamanho
   * - Adicionais obrigatórios (Massa=1, Cobertura=1) somam min
   * - Recheios respeitam min/max de seleção
   * - Sabores obrigatórios (padrão: min=1) somam pelo menos o menor
   */
  const calcularFaixaPreco = (): { min: number; max: number } => {
    let base = precoBase;
    // Se tamanhos ativos, o menor preço vira o base
    if (grupoTamanhos.ativo && grupoTamanhos.opcoes.length > 0) {
      const precos = grupoTamanhos.opcoes.map(o => o.preco).filter(p => p > 0);
      if (precos.length > 0) base = Math.min(...precos);
    }
    let precoMin = base;
    let precoMax = grupoTamanhos.ativo && grupoTamanhos.opcoes.length > 0
      ? Math.max(...grupoTamanhos.opcoes.map(o => o.preco).filter(p => p > 0), base)
      : base;

    // Massa e Cobertura: sempre 1 (obrigatório) — soma min e max
    [grupoMassas, grupoCoberturas].forEach(g => {
      if (g.ativo && g.opcoes.length > 0) {
        const adicionais = g.opcoes.map(o => o.adicional);
        precoMin += Math.min(...adicionais);
        precoMax += Math.max(...adicionais);
      }
    });

    // Sabores: 3 comportamentos possíveis
    if (grupoSabores.ativo && grupoSabores.opcoes.length > 0) {
      const temPrecoProprio = !!grupoSabores.sabor_tem_preco_proprio;
      const temConflito = temPrecoProprio && grupoTamanhos.ativo &&
        grupoTamanhos.opcoes.some(o => o.preco > 0);

      if (temConflito) {
        // Aplica regra de conflito Sabor × Tamanho
        const regra = grupoSabores.regra_conflito_tamanho || "preco_tamanho";
        const precosT = grupoTamanhos.opcoes.map(o => o.preco).filter(p => p > 0);
        const precosS = grupoSabores.opcoes.map((o: any) => o.preco || 0).filter((p: number) => p > 0);

        if (regra === "preco_sabor" && precosS.length > 0) {
          precoMin = Math.min(...precosS);
          precoMax = Math.max(...precosS);
        } else if (regra === "tamanho_base_sabor_adicional" && precosT.length > 0 && precosS.length > 0) {
          precoMin = Math.min(...precosT) + Math.min(...precosS);
          precoMax = Math.max(...precosT) + Math.max(...precosS);
        }
        // "preco_tamanho" (default): mantém o cálculo do tamanho já feito
      } else if (temPrecoProprio) {
        // Sabor com preço próprio, sem conflito com tamanho — substitui base
        const precos = grupoSabores.opcoes.map((o: any) => o.preco || 0).filter((p: number) => p > 0);
        if (precos.length > 0) {
          precoMin = Math.min(...precos);
          precoMax = Math.max(...precos);
        }
      } else {
        // Adicional (sabor é obrigatório: min=1, então soma pelo menos o menor)
        const adicionais = grupoSabores.opcoes.map(o => o.adicional);
        precoMin += Math.min(...adicionais);
        precoMax += Math.max(...adicionais);
      }
    }

    // Recheios: multiplo, min = min * min_escolhas, max = max * max_escolhas
    if (grupoRecheios.ativo && grupoRecheios.opcoes.length > 0) {
      const adicionais = grupoRecheios.opcoes.map(o => o.adicional).sort((a, b) => a - b);
      const min = grupoRecheios.min || 0;
      const max = Math.min(grupoRecheios.max || 1, adicionais.length);
      if (min > 0) precoMin += adicionais.slice(0, min).reduce((s, v) => s + v, 0);
      precoMax += adicionais.slice(-max).reduce((s, v) => s + v, 0);
    }

    return { min: precoMin, max: precoMax };
  };

  const faixa = calcularFaixaPreco();
  const algumGrupoAtivo = [grupoMassas, grupoRecheios, grupoCoberturas, grupoSabores, grupoTamanhos].some(g => g.ativo && g.opcoes.length > 0);

  // Calcula adicional máximo de um grupo (pra badge)
  const adicionalMaxGrupo = (g: GrupoPersonalizacao | GrupoTamanhos | GrupoSabores, isTamanho: boolean): number => {
    if (g.opcoes.length === 0) return 0;
    if (isTamanho) {
      const precos = (g as GrupoTamanhos).opcoes.map(o => o.preco).filter(p => p > 0);
      return precos.length > 0 ? Math.max(...precos) : 0;
    }
    return Math.max(...(g as GrupoPersonalizacao).opcoes.map(o => o.adicional));
  };

  return (
    <div className="pv3-root">
      <div className="pv3-header">
        <div className="pv3-title">Vamos montar as opções</div>
        <div className="pv3-subtitle">
          Marque o que seu produto tem. Sabores, tamanhos, coberturas. Depois é só preencher.
        </div>
        {algumGrupoAtivo && faixa.max > faixa.min && (
          <div className="pv3-faixa-info">
            💰 Faixa de adicionais: <b>R$ {formatPreco(faixa.min - precoBase)} – R$ {formatPreco(faixa.max - precoBase)}</b> além do preço base
          </div>
        )}
      </div>

      {/* MOBILE — Etapa 1: Checklist (marcar categorias). Etapa 2: mostrar botão voltar */}
      {mobileMode === "checklist" && (
        <div className="prod-mchk-wrap">
          <div className="prod-mchk-list">
            {grupos.map(g => {
              const ativo = g.dados.ativo;
              return (
                <label key={g.key} className={`prod-mchk-item ${ativo ? "prod-mchk-item--on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={e => toggleAtivo(g.key, e.target.checked)}
                    className="prod-mchk-checkbox"
                  />
                  <div className="prod-mchk-check-visual">
                    {ativo && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <span className="prod-mchk-ico">{g.icone}</span>
                  <div className="prod-mchk-text">
                    <p className="prod-mchk-item-title">{g.titulo}</p>
                    <p className="prod-mchk-item-sub">{g.subtitulo}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop OU mobileMode === "fill": renderiza os grupos. No fill filtra só ativos */}
      {mobileMode !== "checklist" && grupos.filter(g => mobileMode === "fill" ? g.dados.ativo : true).map(g => {
        const aberto = expandido === g.key || mobileMode === "fill";
        const ativo = g.dados.ativo;
        const qtdOpcoes = g.dados.opcoes.length;
        const isTamanho = g.key === "tamanhos";
        const adicMax = ativo ? adicionalMaxGrupo(g.dados, isTamanho) : 0;

        return (
          <div key={g.key} className={`pv3-card ${ativo ? "pv3-card--ativo" : ""} ${ativo && aberto ? "pv3-card--aberto" : ""}`}>
            {/* Header do card com toggle */}
            <div className="pv3-card-head">
              <button
                type="button"
                className="pv3-card-head-btn"
                onClick={() => setExpandido(aberto ? null : g.key)}
              >
                <span className="pv3-card-ico">{g.icone}</span>
                <div className="pv3-card-info">
                  <div className="pv3-card-titulo">{g.titulo}</div>
                  <div className="pv3-card-sub">
                    {ativo && qtdOpcoes > 0
                      ? `${qtdOpcoes} ${qtdOpcoes === 1 ? "opção" : "opções"}`
                      : g.subtitulo}
                  </div>
                </div>
                {ativo && qtdOpcoes > 0 && adicMax > 0 && (
                  <span className="pv3-badge-preco">
                    {isTamanho ? `até R$ ${formatPreco(adicMax)}` : `+até R$ ${formatPreco(adicMax)}`}
                  </span>
                )}
                {ativo && (
                  <svg className={`pv3-chevron ${aberto ? "pv3-chevron--up" : ""}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                )}
              </button>
              <label className="pv3-toggle" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={e => toggleAtivo(g.key, e.target.checked)}
                />
                <span className="pv3-toggle-slider"></span>
              </label>
            </div>

            {/* Corpo do card (só se ativo E aberto) */}
            {ativo && aberto && (
              <div className="pv3-card-body">
                {/* Toggle Sabor — cada sabor tem preço próprio? */}
                {g.key === "sabores" && (
                  <div className="pv3-sabor-modo">
                    <div className="pv3-sabor-modo-info">
                      <div className="pv3-sabor-modo-titulo">Cada sabor tem preço próprio?</div>
                      <div className="pv3-sabor-modo-sub">
                        {grupoSabores.sabor_tem_preco_proprio
                          ? "Cada sabor terá seu próprio preço (ex: Pudim de Chocolate R$ 45). Preços definidos na próxima etapa."
                          : "Sabores custam o preço base + adicional opcional"}
                      </div>
                    </div>
                    <label className="pv3-toggle" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!grupoSabores.sabor_tem_preco_proprio}
                        onChange={e => toggleSaborPrecoProprio(e.target.checked)}
                      />
                      <span className="pv3-toggle-slider"></span>
                    </label>
                  </div>
                )}
                {/* Distribuição — só pra recheios se for kit (quantidade_base > 1) */}
                {g.key === "recheios" && quantidadeBase && quantidadeBase > 1 && (
                  <div className="pv3-distribuicao pv3-distribuicao--standalone">
                    <div className="pv3-regras-label">Como dividir as {quantidadeBase} unidades?</div>
                    <div className="pv3-dist-opts">
                      {(["nenhuma", "igual", "livre"] as DistribuicaoModo[]).map(modo => (
                        <button
                          key={modo}
                          type="button"
                          className={`pv3-dist-btn ${grupoRecheios.distribuicao === modo ? "pv3-dist-btn--ativo" : ""}`}
                          onClick={() => updateDistribuicao("recheios", modo)}
                        >
                          {modo === "nenhuma" && "Não dividir"}
                          {modo === "igual" && "Dividir igual"}
                          {modo === "livre" && "Cliente decide"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista de opções */}
                {g.key !== "tamanhos" ? (
                  <>
                    {/* Botão pra abrir bottom sheet da biblioteca */}
                    {(() => {
                      const bibl = biblioteca[g.key] || [];
                      const opcoesAtuais = (g.dados as GrupoPersonalizacao).opcoes.map(o => o.nome.toLowerCase());
                      const sugestoes = bibl.filter(b => !opcoesAtuais.includes(b.nome.toLowerCase()));
                      if (sugestoes.length === 0) return null;
                      return (
                        <button
                          type="button"
                          className="pv3-bib-btn"
                          onClick={() => abrirBibSheet(g.key as any)}
                        >
                          <span className="pv3-bib-btn-txt">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                            Escolher da minha biblioteca
                          </span>
                          <span className="pv3-bib-btn-count">{sugestoes.length}</span>
                        </button>
                      );
                    })()}

                    <div className="pv3-opcoes-list">
                      {(g.dados as GrupoPersonalizacao).opcoes.map((op, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === (g.dados as GrupoPersonalizacao).opcoes.length - 1;
                        return (
                          <div key={op.id} className="pv3-opcao-row">
                            <div className="pv3-opcao-move">
                              <button
                                type="button"
                                className="pv3-opcao-move-btn"
                                disabled={isFirst}
                                onClick={() => moveOpcao(g.key as any, op.id, -1)}
                                aria-label="Mover pra cima"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                              </button>
                              <button
                                type="button"
                                className="pv3-opcao-move-btn"
                                disabled={isLast}
                                onClick={() => moveOpcao(g.key as any, op.id, 1)}
                                aria-label="Mover pra baixo"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                            </div>
                            <span className="pv3-opcao-nome">{op.nome}</span>
                            {g.key !== "sabores" && (
                              <div className="pv3-opcao-preco">
                                <span className="pv3-opcao-preco-prefix">+ R$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0,00"
                                  value={op.adicional > 0 ? op.adicional.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                                  onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, "");
                                    const valor = digits ? parseInt(digits, 10) / 100 : 0;
                                    updateAdicional(g.key as any, op.id, valor);
                                  }}
                                />
                              </div>
                            )}
                            <button
                              type="button"
                              className="pv3-opcao-del"
                              onClick={() => removeOpcao(g.key as any, op.id)}
                              aria-label="Remover"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
                            </button>
                          </div>
                        );
                      })}
                      {(g.dados as GrupoPersonalizacao).opcoes.length === 0 && (
                        <div className="pv3-empty" onClick={e => {
                          const input = (e.currentTarget.closest(".pv3-card-body")?.querySelector(".pv3-add-row input") as HTMLInputElement | null);
                          input?.focus();
                        }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          <div className="pv3-empty-txt">Cadastrar 1º {g.titulo.replace(/s$/i, "").toLowerCase()}</div>
                          <div className="pv3-empty-sub">{g.subtitulo}</div>
                        </div>
                      )}
                    </div>

                    <div className="pv3-add-row">
                      <input
                        type="text"
                        placeholder={`Digite o nome...`}
                        value={
                          g.key === "massas" ? novoMassa
                          : g.key === "recheios" ? novoRecheio
                          : g.key === "sabores" ? novoSaborInput
                          : novoCobertura
                        }
                        onChange={e => {
                          if (g.key === "massas") setNovoMassa(e.target.value);
                          else if (g.key === "recheios") setNovoRecheio(e.target.value);
                          else if (g.key === "sabores") setNovoSaborInput(e.target.value);
                          else setNovoCobertura(e.target.value);
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const nome =
                              g.key === "massas" ? novoMassa
                              : g.key === "recheios" ? novoRecheio
                              : g.key === "sabores" ? novoSaborInput
                              : novoCobertura;
                            addOpcao(g.key as any, nome);
                            if (g.key === "massas") setNovoMassa("");
                            else if (g.key === "recheios") setNovoRecheio("");
                            else if (g.key === "sabores") setNovoSaborInput("");
                            else setNovoCobertura("");
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="pv3-add-btn"
                        onClick={() => {
                          const nome =
                            g.key === "massas" ? novoMassa
                            : g.key === "recheios" ? novoRecheio
                            : g.key === "sabores" ? novoSaborInput
                            : novoCobertura;
                          addOpcao(g.key as any, nome);
                          if (g.key === "massas") setNovoMassa("");
                          else if (g.key === "recheios") setNovoRecheio("");
                          else if (g.key === "sabores") setNovoSaborInput("");
                          else setNovoCobertura("");
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Cadastrar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Fase 3: Modo de preço */}
                    <div style={{marginBottom: 16, marginTop: 4}}>
                      <div style={{fontSize: 12, fontWeight: 700, color: "#6B5D64", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.03em"}}>
                        Como calcular o preço?
                      </div>
                      <div style={{display: "flex", flexDirection: "column", gap: 10}}>
                        {([
                          { valor: "preco_fixo", label: "Preço fixo por opção", hint: "Cada tamanho tem seu próprio preço", tooltip: `${primeiroNome ? primeiroNome + ", " : ""}você define um preço específico pra cada tamanho. Por exemplo: 1kg = R$ 80, 2kg = R$ 150, 3kg = R$ 220. Ideal quando o preço não é proporcional ao peso.` },
                          { valor: "por_peso", label: "Calcular pelo peso × preço base", hint: "Preço base R$/kg × peso do tamanho", tooltip: `${primeiroNome ? primeiroNome + ", o" : "O"} preço do seu produto será calculado assim: peso da opção × preço base (R$/kg). Se você definir R$ 80/kg, o cliente vê 1kg = R$ 80, 2kg = R$ 160, e assim vai. Ideal pra bolos onde o preço cresce proporcional ao peso.` },
                        ] as const).map(({ valor, label, hint, tooltip }: any) => {
                          const ativo = grupoTamanhos.modo_preco_tamanho === valor;
                          return (
                            <label
                              key={valor}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 12,
                                padding: "14px 14px",
                                background: ativo ? "#FDF3F7" : "#fff",
                                border: `1.5px solid ${ativo ? "#E85A8C" : "#E5D8DE"}`,
                                borderRadius: 10,
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              <input
                                type="radio"
                                name="modo_preco_tamanho"
                                checked={ativo}
                                onChange={() => onChange({ grupo_tamanhos: { ...grupoTamanhos, modo_preco_tamanho: valor } })}
                                style={{marginTop: 3, accentColor: "#E85A8C", flexShrink: 0}}
                              />
                              <div style={{flex: 1, minWidth: 0}}>
                                <div style={{fontSize: 14, fontWeight: 700, color: "#2D1F26", lineHeight: 1.25, display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap"}}>
                                  {label}
                                  {valor === modoSugerido && (
                                    <span className="pv3-sugerido-badge">
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.5 6.5L21 9l-5 4.5 1.5 6.5L12 16.5 6.5 20 8 13.5 3 9l6.5-.5L12 2z"/></svg>
                                      Sugerido
                                    </span>
                                  )}
                                  {tooltip && (
                                    <span
                                      className="pv3-info-tip"
                                      title={tooltip}
                                      onClick={e => { e.preventDefault(); e.stopPropagation(); setInfoTip(tooltip); }}
                                      aria-label={tooltip}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                    </span>
                                  )}
                                </div>
                                <div style={{fontSize: 12.5, color: "#6B5D64", marginTop: 4, lineHeight: 1.4}}>{hint}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Botão gerar tamanhos padrão (só no modo por_peso) */}
                    {grupoTamanhos.modo_preco_tamanho === "por_peso" && (
                      <button
                        type="button"
                        className="pv3-gerar-tamanhos"
                        onClick={() => setGerarModalAberto(true)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                        Gerar tamanhos automaticamente
                      </button>
                    )}

                    {/* Modal Gerar Tamanhos (range editável) */}
                    {gerarModalAberto && (() => {
                      const parseNum = (s: string) => parseFloat(s.replace(",", ".")) || 0;
                      const de = parseNum(gerarDe);
                      const ate = parseNum(gerarAte);
                      const passo = gerarPasso;
                      let qtd = 0;
                      const listaPreview: string[] = [];
                      if (passo > 0 && de > 0 && ate >= de) {
                        const deI = Math.round(de * 100);
                        const ateI = Math.round(ate * 100);
                        const passoI = Math.round(passo * 100);
                        for (let p = deI; p <= ateI; p += passoI) {
                          qtd++;
                          const val = p / 100;
                          if (listaPreview.length < 6) {
                            const label = val % 1 === 0 ? `${val}kg` : `${val.toString().replace(".", ",")}kg`;
                            listaPreview.push(label);
                          }
                        }
                      }
                      const previewText = qtd === 0
                        ? "Valores inválidos"
                        : `Vai criar ${qtd} tamanho${qtd === 1 ? "" : "s"}: ${listaPreview.join(", ")}${qtd > 6 ? "..." : ""}`;
                      return (
                        <div className="pv3-gerar-overlay" onClick={() => setGerarModalAberto(false)}>
                          <div className="pv3-gerar-modal" onClick={e => e.stopPropagation()}>
                            <div className="pv3-gerar-hdr">
                              <p className="pv3-gerar-tit">Gerar tamanhos em kg</p>
                              <button className="pv3-gerar-close" onClick={() => setGerarModalAberto(false)} aria-label="Fechar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                            <p className="pv3-gerar-sub">Escolha o range e o passo. Ex: 0,5kg até 5kg com passo 0,5kg = 10 tamanhos.</p>

                            <div className="pv3-gerar-row">
                              <div className="pv3-gerar-field">
                                <div className="pv3-gerar-lbl">De</div>
                                <div className="pv3-gerar-input">
                                  <input type="text" inputMode="decimal" value={gerarDe} onChange={e => setGerarDe(e.target.value)} />
                                  <span>kg</span>
                                </div>
                              </div>
                              <span className="pv3-gerar-arr">→</span>
                              <div className="pv3-gerar-field">
                                <div className="pv3-gerar-lbl">Até</div>
                                <div className="pv3-gerar-input">
                                  <input type="text" inputMode="decimal" value={gerarAte} onChange={e => setGerarAte(e.target.value)} />
                                  <span>kg</span>
                                </div>
                              </div>
                            </div>

                            <div className="pv3-gerar-lbl">Passo</div>
                            <div className="pv3-gerar-chips">
                              {[0.1, 0.25, 0.5, 1].map(p => (
                                <button
                                  key={p}
                                  type="button"
                                  className={`pv3-gerar-chip ${gerarPasso === p ? "pv3-gerar-chip--on" : ""}`}
                                  onClick={() => setGerarPasso(p)}
                                >
                                  {p.toString().replace(".", ",")} kg
                                </button>
                              ))}
                            </div>

                            <div className="pv3-gerar-preview">{previewText}</div>

                            <div className="pv3-gerar-actions">
                              <button type="button" className="pv3-gerar-btn pv3-gerar-btn--sec" onClick={() => setGerarModalAberto(false)}>Cancelar</button>
                              <button
                                type="button"
                                className="pv3-gerar-btn pv3-gerar-btn--pri"
                                disabled={qtd === 0}
                                onClick={() => {
                                  gerarTamanhosPadrao(de, ate, passo);
                                  setGerarModalAberto(false);
                                }}
                              >
                                Gerar {qtd > 0 ? `${qtd} tamanhos` : ""}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sugestões da biblioteca — só se modo escolhido */}
                    {grupoTamanhos.modo_preco_tamanho && (() => {
                      const bibl = biblioteca.tamanhos || [];
                      const nomesAtuais = grupoTamanhos.opcoes.map(o => o.nome.toLowerCase());
                      const sugestoes = bibl.filter(b => !nomesAtuais.includes(b.nome.toLowerCase()));
                      if (sugestoes.length === 0) return null;
                      return (
                        <button
                          type="button"
                          className="pv3-bib-btn"
                          onClick={() => abrirBibSheet("tamanhos")}
                        >
                          <span className="pv3-bib-btn-txt">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                            Escolher da minha biblioteca
                          </span>
                          <span className="pv3-bib-btn-count">{sugestoes.length}</span>
                        </button>
                      );
                    })()}
                    <div className={`pv3-opcoes-list ${grupoTamanhos.modo_preco_tamanho !== "preco_fixo" ? "pv3-opcoes-list--grid" : ""}`}>
                      {grupoTamanhos.opcoes.map((op, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === grupoTamanhos.opcoes.length - 1;
                        return (
                          <div key={op.id} className="pv3-opcao-row">
                            <div className="pv3-opcao-move">
                              <button
                                type="button"
                                className="pv3-opcao-move-btn"
                                disabled={isFirst}
                                onClick={() => moveTamanho(op.id, -1)}
                                aria-label="Mover pra cima"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                              </button>
                              <button
                                type="button"
                                className="pv3-opcao-move-btn"
                                disabled={isLast}
                                onClick={() => moveTamanho(op.id, 1)}
                                aria-label="Mover pra baixo"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                            </div>
                            <span className="pv3-opcao-nome">{op.nome}</span>
                            {grupoTamanhos.modo_preco_tamanho === "preco_fixo" && (
                              <div className="pv3-opcao-preco">
                                <span className="pv3-opcao-preco-prefix">R$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0,00"
                                  value={op.preco > 0 ? op.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                                  onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, "");
                                    const valor = digits ? parseInt(digits, 10) / 100 : 0;
                                    onChange({ grupo_tamanhos: { ...grupoTamanhos, opcoes: grupoTamanhos.opcoes.map(o => o.id === op.id ? { ...o, preco: valor } : o) } } as any);
                                  }}
                                />
                              </div>
                            )}
                            <div className="pv3-opcao-serve" title="Quantas pessoas/porções serve (opcional)">
                              {(() => {
                                // Extrai número + unidade do valor atual (ex: "8 pessoas")
                                const raw = String(op.serve || "");
                                const m = raw.match(/^\s*([\d\s,-]*?)\s*(pessoas|porções|porcoes|fatias)?\s*$/i);
                                const num = m ? (m[1] || "") : raw;
                                let unid: "pessoas" | "porcoes" | "fatias" = "pessoas";
                                if (m && m[2]) {
                                  const u = m[2].toLowerCase();
                                  if (u.startsWith("por")) unid = "porcoes";
                                  else if (u.startsWith("fat")) unid = "fatias";
                                }
                                const update = (novoNum: string, novaUnid: typeof unid) => {
                                  const numLimpo = novoNum.slice(0, 8);
                                  const label = novaUnid === "porcoes" ? "porções" : novaUnid;
                                  const valor = numLimpo ? `${numLimpo.trim()} ${label}` : "";
                                  onChange({ grupo_tamanhos: { ...grupoTamanhos, opcoes: grupoTamanhos.opcoes.map(o => o.id === op.id ? { ...o, serve: valor } : o) } } as any);
                                };
                                return <>
                                  <input
                                    type="text"
                                    placeholder="Ex: 8"
                                    value={num}
                                    onChange={e => update(e.target.value, unid)}
                                  />
                                  <div className="pv3-serve-chips" role="tablist">
                                    {(["pessoas","porcoes","fatias"] as const).map(u => (
                                      <button
                                        key={u}
                                        type="button"
                                        role="tab"
                                        aria-selected={unid === u}
                                        className={`pv3-serve-chip ${unid === u ? "pv3-serve-chip--on" : ""}`}
                                        onClick={() => update(num, u)}
                                      >{u === "porcoes" ? "porções" : u}</button>
                                    ))}
                                  </div>
                                </>;
                              })()}
                            </div>
                            <button
                              type="button"
                              className="pv3-opcao-del"
                              onClick={() => removeTamanho(op.id)}
                              aria-label="Remover"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
                            </button>
                          </div>
                        );
                      })}
                      {grupoTamanhos.modo_preco_tamanho && grupoTamanhos.opcoes.length === 0 && (
                        <div className="pv3-empty" onClick={e => {
                          const input = (e.currentTarget.closest(".pv3-card-body")?.querySelector(".pv3-add-row input") as HTMLInputElement | null);
                          input?.focus();
                        }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          <div className="pv3-empty-txt">Cadastrar 1º tamanho</div>
                          <div className="pv3-empty-sub">Ex: P, M, G, 1kg, 2kg</div>
                        </div>
                      )}
                    </div>

                    {grupoTamanhos.modo_preco_tamanho && (
                    <div className="pv3-add-row">
                      <input
                        type="text"
                        placeholder="Ex: P, M, G, 1,5..."
                        value={novoTamanhoNome}
                        onChange={e => setNovoTamanhoNome(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const nome = novoTamanhoNome.trim();
                            if (!nome) return;
                            // Se é só número, concatena a unidade escolhida
                            const soNumero = /^[\d.,]+$/.test(nome);
                            const nomeFinal = soNumero ? `${nome} ${novoTamanhoUnid}` : nome;
                            addTamanho(nomeFinal, 0);
                            setNovoTamanhoNome("");
                          }
                        }}
                      />
                      <div className="pv3-unid-chips" role="tablist" aria-label="Unidade">
                        {(["kg","cm","un","fatia"] as const).map(u => (
                          <button
                            key={u}
                            type="button"
                            role="tab"
                            aria-selected={novoTamanhoUnid === u}
                            className={`pv3-unid-chip ${novoTamanhoUnid === u ? "pv3-unid-chip--on" : ""}`}
                            onClick={() => setNovoTamanhoUnid(u)}
                          >{u}</button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="pv3-add-btn"
                        onClick={() => {
                          const nome = novoTamanhoNome.trim();
                          if (!nome) return;
                          const soNumero = /^[\d.,]+$/.test(nome);
                          const nomeFinal = soNumero ? `${nome} ${novoTamanhoUnid}` : nome;
                          addTamanho(nomeFinal, 0);
                          setNovoTamanhoNome("");
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Cadastrar
                      </button>
                    </div>
                    )}
                  </>
                )}

                {/* ═══ Configurações avançadas — só quando confeiteira quer configurar min/max ═══ */}
                {g.dados.opcoes.length > 0 && (
                  <div style={{marginTop: 14, borderTop: "1px dashed #E5D8DE", paddingTop: 10}}>
                    <button
                      type="button"
                      onClick={() => setAvancadoOpen(prev => ({ ...prev, [g.key]: !prev[g.key] }))}
                      style={{
                        all: "unset",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#6B5D64",
                        cursor: "pointer",
                        padding: "6px 8px",
                        borderRadius: 6,
                        fontFamily: "inherit",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                      {avancadoOpen[g.key] ? "Ocultar avançado" : "Configurações avançadas"}
                    </button>

                    {avancadoOpen[g.key] && (
                      <div style={{
                        marginTop: 10,
                        padding: 12,
                        background: "#FAF8F5",
                        border: "1px solid #F0EBED",
                        borderRadius: 10,
                      }}>
                        <div style={{fontSize: 12.5, fontWeight: 700, color: "#2D1F26", marginBottom: 8}}>
                          Quantas opções o cliente pode escolher?
                        </div>
                        <div style={{display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap"}}>
                          <label style={{display: "inline-flex", flexDirection: "column", gap: 4}}>
                            <span style={{fontSize: 11, color: "#6B5D64", fontWeight: 700}}>Mínimo</span>
                            <input
                              type="number"
                              min={0}
                              max={g.dados.opcoes.length}
                              value={g.dados.min ?? 1}
                              onChange={e => {
                                const min = Math.max(0, Math.min(parseInt(e.target.value) || 0, g.dados.opcoes.length));
                                const campoKey = `grupo_${g.key}`;
                                onChange({ [campoKey]: { ...g.dados, min } } as any);
                              }}
                              style={{
                                width: 60, padding: "6px 8px", border: "1.5px solid #E5D8DE",
                                borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#2D1F26",
                                textAlign: "center", fontFamily: "inherit", outline: "none",
                              }}
                            />
                          </label>
                          <label style={{display: "inline-flex", flexDirection: "column", gap: 4}}>
                            <span style={{fontSize: 11, color: "#6B5D64", fontWeight: 700}}>Máximo</span>
                            <input
                              type="number"
                              min={1}
                              max={g.dados.opcoes.length || 99}
                              value={g.dados.max ?? 1}
                              onChange={e => {
                                const max = Math.max(1, Math.min(parseInt(e.target.value) || 1, g.dados.opcoes.length || 99));
                                const campoKey = `grupo_${g.key}`;
                                onChange({ [campoKey]: { ...g.dados, max } } as any);
                              }}
                              style={{
                                width: 60, padding: "6px 8px", border: "1.5px solid #E5D8DE",
                                borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#2D1F26",
                                textAlign: "center", fontFamily: "inherit", outline: "none",
                              }}
                            />
                          </label>
                          <span style={{fontSize: 11.5, color: "#6B5D64", flex: 1, minWidth: 120}}>
                            {g.dados.min === g.dados.max
                              ? `Cliente escolhe exatamente ${g.dados.min} ${g.dados.min === 1 ? "opção" : "opções"}`
                              : `Cliente escolhe de ${g.dados.min} a ${g.dados.max} opções`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Modal info (i) tooltip personalizado */}
      {infoTip && (
        <div className="pv3-info-ov" onClick={() => setInfoTip(null)}>
          <div className="pv3-info-modal" onClick={e => e.stopPropagation()}>
            <div className="pv3-info-modal-ico">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
            <p className="pv3-info-modal-txt">{infoTip}</p>
            <button className="pv3-info-modal-btn" onClick={() => setInfoTip(null)}>Entendi</button>
          </div>
        </div>
      )}

      {/* Bottom sheet: escolher da biblioteca */}
      {bibSheetGrupo && (() => {
        const bibl = biblioteca[bibSheetGrupo] || [];
        const opcoesAtuais = bibSheetGrupo === "tamanhos"
          ? grupoTamanhos.opcoes.map((o: any) => o.nome.toLowerCase())
          : bibSheetGrupo === "sabores"
          ? grupoSabores.opcoes.map((o: any) => o.nome.toLowerCase())
          : (({ massas: grupoMassas, recheios: grupoRecheios, coberturas: grupoCoberturas } as any)[bibSheetGrupo]).opcoes.map((o: any) => o.nome.toLowerCase());
        const sugestoes = bibl.filter(b => !opcoesAtuais.includes(b.nome.toLowerCase()));
        const gTitulo = ({ massas: "Massas", recheios: "Recheios", coberturas: "Coberturas", sabores: "Sabores", tamanhos: "Tamanhos" } as any)[bibSheetGrupo];
        const count = bibSheetSelected.size;
        return (
          <div className="pv3-bib-overlay" onClick={() => setBibSheetGrupo(null)}>
            <div className="pv3-bib-sheet" onClick={e => e.stopPropagation()}>
              <div className="pv3-bib-handle" />
              <div className="pv3-bib-header">
                <div>
                  <p className="pv3-bib-title">Da sua biblioteca</p>
                  <p className="pv3-bib-sub">Marque as que quer adicionar em {gTitulo}</p>
                </div>
                <button type="button" className="pv3-bib-close" onClick={() => setBibSheetGrupo(null)} aria-label="Fechar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="pv3-bib-list">
                {sugestoes.length === 0 && (
                  <p className="pv3-bib-empty">Nenhuma opção nova disponível na biblioteca</p>
                )}
                {sugestoes.map(sug => {
                  const sel = bibSheetSelected.has(sug.nome);
                  return (
                    <label key={sug.id} className={`pv3-bib-item ${sel ? "pv3-bib-item--on" : ""}`}>
                      <input type="checkbox" checked={sel} onChange={() => toggleBibSelected(sug.nome)} className="pv3-bib-checkbox" />
                      <div className="pv3-bib-check-visual">
                        {sel && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </div>
                      <p className="pv3-bib-item-name">{sug.nome}</p>
                    </label>
                  );
                })}
              </div>
              <div className="pv3-bib-footer">
                <button type="button" className="pv3-bib-btn-cancel" onClick={() => setBibSheetGrupo(null)}>Cancelar</button>
                <button type="button" className="pv3-bib-btn-add" onClick={confirmarBibSheet} disabled={count === 0}>
                  {count === 0 ? "Adicionar" : count === 1 ? "Adicionar 1 opção" : `Adicionar ${count} opções`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        .pv3-root { display: flex; flex-direction: column; gap: 12px; }
        .pv3-header { margin-bottom: 4px; text-align: center; }
        .pv3-eyebrow {
          font-size: 11px; color: #E85A8C; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .pv3-title {
          font-size: 20px;
          font-weight: 800;
          color: #4B5563;
          margin-top: 4px;
          line-height: 1.2;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .pv3-subtitle { font-size: 13px; color: #6B5D64; margin-top: 6px; line-height: 1.5; max-width: 480px; margin-left: auto; margin-right: auto; text-wrap: balance; }

        /* Modal do (i) tooltip — popover custom personalizado */
        .pv3-info-ov {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 10200;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: pv3InfoOv 0.2s ease-out;
        }
        @keyframes pv3InfoOv { from { opacity: 0; } to { opacity: 1; } }
        .pv3-info-modal {
          background: #fff;
          max-width: 380px;
          width: 100%;
          border-radius: 14px;
          padding: 24px 20px 20px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          animation: pv3InfoIn 0.25s cubic-bezier(0.32,0.72,0,1);
          font-family: 'Geist', sans-serif;
        }
        @keyframes pv3InfoIn { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .pv3-info-modal-ico {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px; height: 48px;
          background: #FCE0E9;
          color: #E85A8C;
          border-radius: 50%;
          margin: 0 auto 12px;
        }
        .pv3-info-modal-txt {
          margin: 0 0 20px;
          font-size: 14px;
          color: #2D1F26;
          line-height: 1.55;
          font-weight: 500;
        }
        .pv3-info-modal-btn {
          background: #E85A8C;
          color: #fff;
          border: none;
          padding: 11px 28px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 800;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 12px rgba(232,90,140,0.35);
          transition: background 0.15s;
        }
        .pv3-info-modal-btn:hover { background: #d54a7a; }
        .pv3-preco-base {
          margin-top: 10px; padding: 10px 12px; background: #FDF3F7; border-radius: 8px;
          font-size: 12.5px; color: #831843; border: 1px solid #FCE0E9;
          transition: all 0.2s;
        }
        .pv3-faixa-info {
          margin-top: 12px; padding: 10px 12px;
          background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px;
          font-size: 12.5px; color: #166534;
        }
        .pv3-faixa-info b { color: #059669; font-weight: 700; }
        .pv3-preco-base--tamanho {
          background: #F0FDF4;
          border-color: #BBF7D0;
          color: #166534;
        }
        .pv3-info-tip {
          all: unset;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #E85A8C;
          cursor: pointer;
          margin: 0 2px;
          padding: 2px;
          border-radius: 50%;
          transition: all 0.15s;
        }
        .pv3-info-tip:hover {
          color: #fff;
          background: #E85A8C;
        }

        /* Tooltip estilo Doonly — dark, cara de app */
        .pv3-tooltip {
          position: absolute;
          top: calc(100% + 12px);
          left: -8px;
          background: #1A1A1A;
          color: #fff;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.5;
          width: 260px;
          z-index: 100;
          box-shadow: 0 12px 32px rgba(0,0,0,0.25);
          animation: pv3TooltipIn 0.18s cubic-bezier(0.32, 0.72, 0, 1);
          font-family: inherit;
        }
        @keyframes pv3TooltipIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pv3-tooltip-arrow {
          position: absolute;
          top: -6px;
          left: 20px;
          width: 12px; height: 12px;
          background: #1A1A1A;
          transform: rotate(45deg);
          border-radius: 2px;
        }
        .pv3-tooltip-title {
          font-weight: 700;
          font-size: 12.5px;
          margin-bottom: 4px;
          color: #E85A8C;
          position: relative;
          z-index: 1;
        }
        .pv3-tooltip-body {
          color: #E5D8DE;
          font-weight: 400;
          position: relative;
          z-index: 1;
        }
        .pv3-tooltip-body b { color: #fff; font-weight: 700; }

        /* Dropdown de unidade de venda */
        .pv3-unidade-btn {
          all: unset;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 13px;
          color: #831843;
          font-weight: 700;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 8px;
          background: transparent;
          border: 1.5px dashed transparent;
          transition: all 0.15s;
          font-family: inherit;
        }
        .pv3-unidade-btn:hover {
          background: #FCE0E9;
          border-color: #E85A8C;
        }
        .pv3-unidade-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          background: #fff;
          border-radius: 10px;
          border: 1px solid #F0EBED;
          box-shadow: 0 12px 32px rgba(0,0,0,0.14);
          padding: 6px;
          min-width: 190px;
          z-index: 50;
          animation: pv3TooltipIn 0.15s ease;
        }
        .pv3-unidade-item {
          all: unset;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          color: #2D1F26;
          font-family: inherit;
          font-weight: 600;
        }
        .pv3-unidade-item:hover { background: #FAF8F5; }
        .pv3-unidade-item--ativo {
          background: #FDF3F7;
          color: #831843;
          font-weight: 700;
        }
        .pv3-card {
          background: #fff;
          border: 1.5px solid #F0EBED;
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .pv3-card--ativo { border-color: #E85A8C; }
        .pv3-card--aberto { min-height: 340px; }
        @media (max-width: 720px) {
          .pv3-card--aberto { min-height: 260px; }
        }
        .pv3-card-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 16px;
        }
        .pv3-card-head-btn {
          all: unset;
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          cursor: pointer;
          font-family: inherit;
        }
        .pv3-card-ico {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #FAF8F5;
          color: #6B5D64;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .pv3-card--ativo .pv3-card-ico {
          background: #FCE0E9;
          color: #E85A8C;
        }
        .pv3-card-info { flex: 1; }
        .pv3-card-titulo { font-size: 15px; font-weight: 800; color: #2D1F26; }
        .pv3-card-sub { font-size: 12px; color: #6B5D64; margin-top: 2px; }
        .pv3-chevron { color: #6B5D64; transition: transform 0.2s; }
        .pv3-chevron--up { transform: rotate(180deg); }
        .pv3-badge-preco {
          background: #F0FDF4;
          color: #059669;
          border: 1px solid #BBF7D0;
          font-size: 10.5px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Toggle switch */
        .pv3-toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .pv3-toggle input { opacity: 0; width: 0; height: 0; }
        .pv3-toggle-slider {
          position: absolute; cursor: pointer;
          inset: 0; background: #E5D8DE; border-radius: 999px;
          transition: 0.2s;
        }
        .pv3-toggle-slider:before {
          content: ""; position: absolute;
          width: 18px; height: 18px; left: 3px; bottom: 3px;
          background: #fff; border-radius: 50%;
          transition: 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .pv3-toggle input:checked + .pv3-toggle-slider { background: #E85A8C; }
        .pv3-toggle input:checked + .pv3-toggle-slider:before { transform: translateX(20px); }

        .pv3-card-body {
          padding: 0 16px 16px;
          border-top: 1px solid #F5F1F3;
          padding-top: 14px;
        }

        /* Regras */
        .pv3-regras {
          background: #FAF8F5; border-radius: 8px; padding: 12px; margin-bottom: 12px;
        }
        .pv3-regras-label {
          font-size: 11px; color: #6B5D64; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;
        }
        .pv3-regras-row {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .pv3-regras-row label { font-size: 12.5px; color: #2D1F26; font-weight: 700; }
        .pv3-regras-row input {
          width: 60px; padding: 6px 8px; border: 1.5px solid #E5D8DE;
          border-radius: 6px; font-size: 13px; font-family: inherit; text-align: center;
        }

        /* Distribuição */
        .pv3-distribuicao--standalone {
          background: #FAF8F5; border-radius: 8px; padding: 12px; margin-bottom: 12px;
        }
        /* ═══ Toggle "Cada sabor tem preço próprio?" ═══ */
        .pv3-sabor-modo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: linear-gradient(135deg, #FDF3F7 0%, #FCE0E9 100%);
          border: 1.5px solid #F0D0DC;
          border-radius: 10px;
          margin-bottom: 14px;
        }
        .pv3-sabor-modo-info { flex: 1; min-width: 0; }
        .pv3-sabor-modo-titulo {
          font-size: 14px;
          font-weight: 700;
          color: #2D1F26;
          margin-bottom: 3px;
        }
        .pv3-sabor-modo-sub {
          font-size: 12px;
          color: #6B5D64;
          line-height: 1.35;
        }
        /* ═══ Input de preço próprio (Sabor) inline na linha da opção ═══ */
        .pv3-opcao-preco-wrap {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #fff;
          border: 1.5px solid #E5D8DE;
          border-radius: 7px;
          padding: 4px 8px;
          margin-right: 6px;
        }
        .pv3-opcao-preco-wrap:focus-within {
          border-color: #E85A8C;
          box-shadow: 0 0 0 2px rgba(232, 90, 140, 0.1);
        }
        .pv3-opcao-preco-prefix {
          font-size: 11px;
          font-weight: 700;
          color: #6B5D64;
        }
        .pv3-opcao-preco-inp {
          all: unset;
          width: 60px;
          font-size: 13px;
          font-weight: 700;
          color: #2D1F26;
          text-align: right;
          font-family: inherit;
        }
        .pv3-distribuicao { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #E5D8DE; }
        .pv3-dist-opts { display: flex; gap: 6px; flex-wrap: wrap; }
        .pv3-dist-btn {
          all: unset;
          padding: 6px 12px; background: #fff; border: 1.5px solid #E5D8DE;
          border-radius: 6px; font-size: 12px; font-weight: 700; color: #6B5D64;
          cursor: pointer;
        }
        .pv3-dist-btn--ativo { background: #FDF3F7; color: #831843; border-color: #E85A8C; }

        /* Lista de opções */
        .pv3-opcoes-list { display: flex; flex-direction: column; gap: 8px; }
        /* Grid 2 colunas — quando modo é por_peso ou sob_consulta (sem input de preço) */
        .pv3-opcoes-list--grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .pv3-opcoes-list--grid .pv3-opcao-row {
          padding: 8px 10px;
        }
        .pv3-opcoes-list--grid .pv3-empty {
          grid-column: 1 / -1;
        }
        .pv3-opcao-row {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 14px; background: #fff; border: 1.5px solid #F0EBED;
          border-radius: 12px;
          transition: all 0.15s;
        }
        .pv3-opcao-row:hover {
          border-color: #E85A8C;
          box-shadow: 0 2px 8px rgba(232, 90, 140, 0.08);
        }
        .pv3-opcao-move {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex-shrink: 0;
        }
        @media (max-width: 720px) {
          .pv3-opcao-move { display: none; }
        }
        .pv3-opcao-move-btn {
          all: unset;
          width: 22px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 5px;
          color: #6B5D64;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pv3-opcao-move-btn:hover:not(:disabled) {
          background: #FCE0E9;
          color: #E85A8C;
        }
        .pv3-opcao-move-btn:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }
        .pv3-opcao-num {
          width: 26px; height: 26px; border-radius: 50%; background: #FCE0E9;
          color: #E85A8C; font-size: 12px; font-weight: 800;
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pv3-opcao-nome { flex: 1; font-size: 14.5px; font-weight: 700; color: #2D1F26; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pv3-opcao-preco {
          display: inline-flex; align-items: center; gap: 4px;
          background: #FDF3F7;
          border: 1.5px solid #F5B8CD;
          border-radius: 8px;
          padding: 4px 8px;
          flex-shrink: 0;
        }
        .pv3-opcao-serve {
          display: inline-flex; align-items: center; gap: 4px;
          background: #F5F3EF;
          border: 1.5px solid #E8E5DC;
          border-radius: 8px;
          padding: 4px 8px;
          flex-shrink: 0;
        }
        .pv3-opcao-serve:focus-within { border-color: #6B5D64; }
        .pv3-opcao-serve input {
          all: unset;
          width: 38px;
          font-size: 13px; font-weight: 700;
          color: #2D1F26;
          text-align: right;
        }
        .pv3-opcao-serve-suf { font-size: 11px; color: #6B7280; white-space: nowrap; font-weight: 600; }
        .pv3-opcao-preco:focus-within { border-color: #E85A8C; }
        .pv3-opcao-preco-prefix { font-size: 11.5px; font-weight: 800; color: #E85A8C; white-space: nowrap; }
        .pv3-opcao-preco input {
          all: unset;
          width: 62px;
          font-size: 13.5px; font-weight: 700;
          color: #2D1F26;
          text-align: right;
          font-family: inherit;
        }
        .pv3-opcao-preco input::placeholder { color: #C7B5BE; font-weight: 500; }
        .pv3-opcao-del {
          all: unset;
          cursor: pointer;
          color: #9A8B93;
          width: 32px; height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.15s;
        }
        .pv3-opcao-del:hover {
          color: #DC2626;
          background: #FEE2E2;
        }
        .pv3-empty {
          padding: 24px 16px;
          text-align: center;
          background: #FFF5F9;
          border-radius: 12px;
          border: 2px dashed #E85A8C;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pv3-empty:hover { background: #FCE0E9; }
        .pv3-empty svg {
          margin: 0 auto 10px;
          color: #E85A8C;
          background: #FCE0E9;
          border-radius: 50%;
          padding: 10px;
          width: 44px !important;
          height: 44px !important;
          opacity: 1;
          box-sizing: border-box;
        }
        .pv3-empty-txt {
          font-weight: 800;
          font-size: 14px;
          color: #E85A8C;
          margin-bottom: 4px;
        }
        .pv3-empty-sub {
          font-size: 11.5px;
          color: #6B5D64;
          margin-top: 2px;
          font-weight: 500;
        }

        /* Adicionar */
        .pv3-add-row {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          padding: 8px;
          background: #FAF8F5;
          border-radius: 10px;
          border: 1px dashed #E5D8DE;
        }
        .pv3-add-row input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #F0EBED;
          border-radius: 8px;
          font-size: 13px;
          background: #fff;
          font-family: inherit;
          outline: none;
          min-width: 0;
        }
        .pv3-add-row input:focus {
          border-color: #E85A8C;
        }
        .pv3-add-btn {
          all: unset;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #E85A8C;
          color: #fff;
          font-size: 12.5px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0 2px 0 #C33A6E;
          transition: transform 0.1s;
          white-space: nowrap;
          font-family: inherit;
        }
        .pv3-add-btn:hover { transform: translateY(-1px); }
        .pv3-add-btn:active { transform: translateY(1px); box-shadow: 0 0 0 #C33A6E; }

        .pv3-gerar-tamanhos {
          all: unset;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #FCE0E9;
          color: #E85A8C;
          border: 1.5px solid #E85A8C;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12.5px;
          cursor: pointer;
          font-family: inherit;
          margin-bottom: 10px;
          transition: all 0.15s ease;
        }
        .pv3-gerar-tamanhos:hover { background: #E85A8C; color: #fff; }

        /* ═══ Modal Gerar Tamanhos (range editável) ═══ */
        .pv3-gerar-overlay {
          position: fixed; inset: 0; z-index: 10001;
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: pv3-fade 0.2s ease-out;
        }
        .pv3-gerar-modal {
          background: #fff; width: 100%; max-width: 440px;
          border-radius: 14px; padding: 20px;
          font-family: 'Geist', sans-serif;
          animation: pv3-in 0.22s cubic-bezier(0.32,0.72,0,1);
        }
        @keyframes pv3-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pv3-in { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .pv3-gerar-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .pv3-gerar-tit { font-size: 15px; font-weight: 800; color: #2C1219; margin: 0; }
        .pv3-gerar-close { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #6B7280; }
        .pv3-gerar-close:hover { background: #F5F0F2; }
        .pv3-gerar-sub { font-size: 12px; color: #6B7280; margin: 0 0 16px; line-height: 1.45; }
        .pv3-gerar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .pv3-gerar-field { flex: 1; }
        .pv3-gerar-lbl { font-size: 10.5px; font-weight: 800; color: #6B7280; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
        .pv3-gerar-input { display: flex; align-items: center; background: #fff; border: 1.5px solid #F0EBED; border-radius: 8px; overflow: hidden; }
        .pv3-gerar-input input { flex: 1; padding: 10px 12px; border: none; outline: none; font-size: 14px; font-weight: 700; color: #2C1219; font-family: inherit; min-width: 0; }
        .pv3-gerar-input span { padding: 10px 12px; background: #F5F0F2; font-size: 12.5px; font-weight: 700; color: #C33A6E; }
        .pv3-gerar-arr { color: #6B7280; font-size: 16px; }
        .pv3-gerar-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
        .pv3-gerar-chip { all: unset; cursor: pointer; padding: 6px 12px; background: #fff; border: 1.5px solid #F0EBED; border-radius: 6px; font-size: 12px; font-weight: 700; color: #6B7280; font-family: inherit; }
        .pv3-gerar-chip--on { background: #E85A8C; color: #fff; border-color: #E85A8C; }
        .pv3-gerar-preview { background: #FFF5F9; border: 1px solid #F0D8DE; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #4B5563; line-height: 1.5; margin-bottom: 16px; }
        .pv3-gerar-actions { display: flex; gap: 8px; }
        .pv3-gerar-btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.12s ease; }
        .pv3-gerar-btn--sec { background: #F3F4F6; color: #4B5563; box-shadow: 0 3px 0 #D1D5DB; }
        .pv3-gerar-btn--sec:active { transform: translateY(2px); box-shadow: 0 1px 0 #D1D5DB; }
        .pv3-gerar-btn--pri { background: linear-gradient(135deg, #E85A8C, #C33A6E); color: #fff; box-shadow: 0 3px 0 #993556, 0 6px 14px rgba(232,90,140,0.3); flex: 2; }
        .pv3-gerar-btn--pri:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #993556; }
        .pv3-gerar-btn--pri:disabled { background: #E5E7EB; color: #9CA3AF; box-shadow: none; cursor: not-allowed; }

        /* ═══ Chips de unidade no cadastro manual ═══ */
        .pv3-unid-chips { display: inline-flex; padding: 3px; background: #F5F0F2; border-radius: 8px; gap: 2px; }
        .pv3-unid-chip { all: unset; cursor: pointer; padding: 6px 10px; font-size: 11.5px; font-weight: 700; color: #6B7280; border-radius: 6px; font-family: inherit; transition: all 0.12s; }
        .pv3-unid-chip--on { background: #fff; color: #E85A8C; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

        /* ═══ Chips de unidade no campo Serve ═══ */
        .pv3-serve-chips { display: inline-flex; padding: 2px; background: #F5F0F2; border-radius: 6px; gap: 2px; margin-left: 6px; }
        .pv3-serve-chip { all: unset; cursor: pointer; padding: 4px 8px; font-size: 10.5px; font-weight: 700; color: #6B7280; border-radius: 4px; font-family: inherit; transition: all 0.12s; }
        .pv3-serve-chip--on { background: #fff; color: #E85A8C; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }

        /* Badge "Sugerido" — pra opção que o sistema recomenda */
        .pv3-sugerido-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 7px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          color: #fff;
          border-radius: 4px;
          font-size: 9.5px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 2px 6px rgba(245,158,11,0.35);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Ícone (i) de info inline — abre alert com explicação ao clicar */
        .pv3-info-tip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #E85A8C;
          background: #FCE0E9;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .pv3-info-tip:hover {
          background: #E85A8C;
          color: #fff;
        }
        .pv3-info-tip svg { width: 12px; height: 12px; }

        /* Sub-toggle "Foto por opção" (PRO) */
        .pv3-sub-toggle {
          all: unset;
          margin-top: 14px;
          padding: 12px 14px;
          background: linear-gradient(135deg, #FEF3C7 0%, #FEF9E7 100%);
          border: 1.5px solid #FDE68A;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          box-sizing: border-box;
          width: 100%;
        }
        .pv3-sub-toggle:hover {
          border-color: #F59E0B;
        }
        .pv3-sub-toggle--on {
          background: linear-gradient(135deg, #FDF3F7 0%, #FCE0E9 100%);
          border-color: #E85A8C;
        }
        .pv3-sub-toggle-ico {
          width: 34px; height: 34px;
          background: #fff;
          color: #92400E;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pv3-sub-toggle--on .pv3-sub-toggle-ico {
          color: #E85A8C;
        }
        .pv3-sub-toggle-txt { flex: 1; min-width: 0; }
        .pv3-sub-toggle-titulo {
          font-size: 13px;
          font-weight: 700;
          color: #2D1F26;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pv3-sub-toggle-crown {
          width: 14px; height: 14px; object-fit: contain;
        }
        .pv3-sub-toggle-desc {
          font-size: 11.5px;
          color: #6B5D64;
          margin-top: 2px;
        }
        .pv3-mini-switch {
          width: 36px; height: 20px;
          background: #E5D8DE;
          border-radius: 999px;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .pv3-mini-switch--on { background: #E85A8C; }
        .pv3-mini-switch-thumb {
          width: 14px; height: 14px;
          background: #fff;
          border-radius: 50%;
          position: absolute;
          top: 3px; left: 3px;
          transition: left 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        .pv3-mini-switch--on .pv3-mini-switch-thumb { left: 19px; }

        /* Sugestões da biblioteca */
        /* Botão da biblioteca */
        .pv3-bib-btn {
          all: unset;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 11px 14px;
          background: #2C2C2A;
          border: none;
          border-radius: 10px;
          color: #fff;
          font-family: inherit;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 10px;
        }
        .pv3-bib-btn:hover { background: #1A1A1A; }
        .pv3-bib-btn-txt { display: inline-flex; align-items: center; gap: 8px; }
        .pv3-bib-btn-count {
          background: #E85A8C;
          color: #fff;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 800;
          min-width: 22px;
          text-align: center;
        }

        /* Bottom sheet biblioteca */
        .pv3-bib-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10100;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: pv3BibOverlayIn 0.2s ease-out;
        }
        @keyframes pv3BibOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .pv3-bib-sheet {
          background: #fff;
          width: 100%;
          max-width: 480px;
          max-height: 85vh;
          border-radius: 20px 20px 0 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: pv3BibSheetIn 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          font-family: 'Geist', sans-serif;
        }
        @media (min-width: 720px) {
          .pv3-bib-overlay { align-items: center; padding: 24px; }
          .pv3-bib-sheet { border-radius: 16px; max-height: 80vh; }
        }
        @keyframes pv3BibSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .pv3-bib-handle {
          width: 40px; height: 4px;
          background: #D1D5DB;
          border-radius: 2px;
          margin: 8px auto 4px;
          flex-shrink: 0;
        }
        .pv3-bib-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 20px 14px;
          border-bottom: 1px solid #F3F4F6;
          flex-shrink: 0;
        }
        .pv3-bib-title {
          margin: 0;
          font-size: 15px;
          font-weight: 800;
          color: #1F1F23;
        }
        .pv3-bib-sub {
          margin: 2px 0 0;
          font-size: 11.5px;
          color: #6B7280;
          font-weight: 500;
        }
        .pv3-bib-close {
          background: #F3F4F6;
          border: none;
          width: 32px; height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6B7280;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .pv3-bib-close:hover { background: #E5E7EB; }
        .pv3-bib-list {
          padding: 12px 14px;
          overflow-y: auto;
          flex: 1;
          -webkit-overflow-scrolling: touch;
        }
        .pv3-bib-empty {
          text-align: center;
          color: #9CA3AF;
          font-size: 13px;
          padding: 32px 12px;
          margin: 0;
        }
        .pv3-bib-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #fff;
          border: 1.5px solid #E5E7EB;
          border-radius: 10px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pv3-bib-item:hover { border-color: #F5B8CD; }
        .pv3-bib-item--on {
          background: #FFF5F9;
          border-color: #E85A8C;
        }
        .pv3-bib-checkbox { display: none; }
        .pv3-bib-check-visual {
          width: 22px; height: 22px;
          border-radius: 6px;
          border: 2px solid #D1D5DB;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .pv3-bib-item--on .pv3-bib-check-visual {
          background: #E85A8C;
          border-color: #E85A8C;
        }
        .pv3-bib-item-name {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #1F1F23;
          flex: 1;
        }
        .pv3-bib-footer {
          padding: 14px 16px;
          padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid #F3F4F6;
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .pv3-bib-btn-cancel {
          flex: 1;
          padding: 12px;
          background: #F3F4F6;
          color: #4B5563;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
        }
        .pv3-bib-btn-cancel:hover { background: #E5E7EB; }
        .pv3-bib-btn-add {
          flex: 2;
          padding: 12px;
          background: #E85A8C;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(232,90,140,0.4);
          font-family: inherit;
          transition: all 0.15s;
        }
        .pv3-bib-btn-add:hover:not(:disabled) { background: #d54a7a; }
        .pv3-bib-btn-add:disabled {
          background: #E5E7EB;
          color: #9CA3AF;
          box-shadow: none;
          cursor: not-allowed;
        }
        .pv3-sugestao-chip:active { transform: scale(0.95); }
      `}</style>
    </div>
  );
}

const FORMAS_VENDA = [
  { value: "unidade", label: "Por Unidade" },
  { value: "fatia", label: "Por Fatia" },
  { value: "kg", label: "Por Quilo (kg)" },
  { value: "cento", label: "Por Cento" },
  { value: "tamanho", label: "Por Tamanho (P/M/G)" },
  { value: "caixa", label: "Por Caixa" },
  { value: "kit-festa", label: "Kit Festa" },
  { value: "outros", label: "Outros" },
];
// Nota: "sob-encomenda" foi removido daqui — agora é controlado pelo toggle
// "Pronta entrega" (modo de produção separado da unidade de venda)

const EMPTY: Produto = {
  nome: "", descricao: "", preco_normal: 0,
  imagem_url: "", categoria: "", forma_venda: "unidade",
  disponivel: true, promocao: false,
  permite_personalizacao: false,
  massas_disponiveis: [], recheios_disponiveis: [], coberturas_disponiveis: [],
  tamanhos_disponiveis: [], precos_variacoes: {}, fotos_variacoes: {}, usar_foto_variacao: false, oferece_pacote: false, pronta_entrega: undefined,
  kit_itens: [], kit_serve_pessoas: "", kit_prazo_encomenda: "",
  zero_acucar: false,
  tem_vela: false, valor_vela: 0,
  tem_topo: false, valor_topo: 0,
  tem_papel_arroz: false, valor_papel_arroz: 0,
  tem_outro: false, titulo_outro: "", valor_outro: 0,
  tem_adicionais: false,
  adicionais: [],
  tipo_promocao: 'fixo' as const, desconto_percentual: 0,
  // V3
  tipo_produto: "simples",
  quantidade_base: null,
  usar_variacoes: false,
  variacoes: [],
  label_variacao: "Sabor",
  grupo_massas: { ...GRUPO_VAZIO },
  grupo_recheios: { ...GRUPO_VAZIO },
  grupo_coberturas: { ...GRUPO_VAZIO },
  grupo_sabores: { ...GRUPO_SABORES_VAZIO },
  grupo_tamanhos: { ...GRUPO_TAMANHOS_VAZIO },
};

export default function Produtos() {
  const location = useLocation();
  const navigate = useNavigate();
  // activeTab segue a URL: /produtos/categorias → "categorias", senão "produtos"
  const activeTab: "produtos" | "categorias" = location.pathname.startsWith("/produtos/categorias") ? "categorias" : "produtos";
  const setActiveTab = (tab: "produtos" | "categorias") => {
    navigate(tab === "categorias" ? "/produtos/categorias" : "/produtos");
  };
  const [userId, setUserId] = useState("");
  const [primeiroNome, setPrimeiroNome] = useState<string>("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  // Toast Doonly (substitui alerts nativos)
  const [toast, setToast] = useState<{ tipo: "success" | "error" | "info"; titulo: string; sub?: string } | null>(null);
  const showToast = (tipo: "success" | "error" | "info", titulo: string, sub?: string) => {
    setToast({ tipo, titulo, sub });
  };

  // ═══ Bulk selection (desktop) ═══
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const isSelected = (id: string) => selectedIds.has(id);
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selecionados = produtos.filter(p => p.id && selectedIds.has(p.id));

  /**
   * Gera o próximo nome pra cópia sem acumular "(cópia)".
   * - "Pudim"                → "Pudim (cópia)"
   * - "Pudim (cópia)"        → "Pudim (cópia 2)"
   * - "Pudim (cópia 2)"      → "Pudim (cópia 3)"
   */
  const proximoNomeCopia = (nome: string): string => {
    const semTag = nome.replace(/\s*\(cópia(?:\s*\d+)?\)\s*$/i, "").trim();
    // Procura maior N já usado nas cópias existentes
    const regex = new RegExp(`^${semTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(cópia(?:\\s*(\\d+))?\\)\\s*$`, "i");
    let maiorN = 0;
    let temCopiaSimples = false;
    produtos.forEach(p => {
      const m = p.nome.match(regex);
      if (m) {
        if (m[1]) maiorN = Math.max(maiorN, parseInt(m[1]));
        else temCopiaSimples = true;
      }
    });
    if (!temCopiaSimples && maiorN === 0) return `${semTag} (cópia)`;
    const proximo = Math.max(maiorN, temCopiaSimples ? 1 : 0) + 1;
    return `${semTag} (cópia ${proximo})`;
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  // Mobile: divide step 3 (personalização) em 2 sub-etapas: 'checklist' (só marca as categorias) → 'fill' (preenche)
  const [mobilePersonaStep, setMobilePersonaStep] = useState<"checklist" | "fill">("checklist");
  const [isMobileMain, setIsMobileMain] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileMain(window.innerWidth <= 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [wizardTipo, setWizardTipo] = useState<"simples" | "variacoes" | "personalizavel">("simples");
  const [wizardSubtipo, setWizardSubtipo] = useState<"sabores_e_tamanhos" | "so_sabores" | "so_tamanhos" | null>(null);
  const [editTab, setEditTab] = useState<"info" | "opcoes" | "preco" | "fotos">("info");
  const [confirmMudaSubtipo, setConfirmMudaSubtipo] = useState<{
    novoSubtipo: "sabores_e_tamanhos" | "so_sabores" | "so_tamanhos";
    quantidade: number;
    oQuePerde: "sabor" | "tamanho";
  } | null>(null);
  const [wizardOpts, setWizardOpts] = useState({ complementos: false, personalizacao: false, promocao: false });
  const [form, setForm] = useState<Produto>(EMPTY);

  // Auto-sync: se modo do tamanho é por_peso, forma_venda vira kg automaticamente
  useEffect(() => {
    const modo = form.grupo_tamanhos?.modo_preco_tamanho;
    if (modo === "por_peso" && form.forma_venda !== "kg") {
      setForm(f => ({ ...f, forma_venda: "kg" }));
    }
  }, [form.grupo_tamanhos?.modo_preco_tamanho]);

  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftSaveTimer = useRef<any>(null);
  const DRAFT_KEY = "doonly_produto_draft_v1";
  const [confirmDiscardProd, setConfirmDiscardProd] = useState(false);
  const [ordenarPor, setOrdenarPor] = useState<"recentes"|"alfabetica"|"categoria"|"preco">("recentes");
  const [showOrdenar, setShowOrdenar] = useState(false);
  const [filtroOrfaos, setFiltroOrfaos] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaCategoriaIcone, setNovaCategoriaIcone] = useState("");
  const [showCatInput, setShowCatInput] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewProduto, setPreviewProduto] = useState<Produto | null>(null);
  const [previewMenu, setPreviewMenu] = useState(false);
  const [showProIaModal, setShowProIaModal] = useState(false);
  const [showProFotosModal, setShowProFotosModal] = useState(false);
  const [novaOpcao, setNovaOpcao] = useState<{ massa: string; recheio: string; cobertura: string }>({ massa: "", recheio: "", cobertura: "" });
  const [novoTamanho, setNovoTamanho] = useState({ label: "", preco: "" });
  const [novoKitItem, setNovoKitItem] = useState({ nome: "", quantidade: "" });

  // ═══ BIBLIOTECA DE EXTRAS ═══
  const [novoAdicional, setNovoAdicional] = useState({ nome: "", valor: "" });
  const [biblioteca, setBiblioteca] = useState<BibliotecaExtra[]>([]);
  const [salvarBibliotecaAsk, setSalvarBibliotecaAsk] = useState<{ nome: string; valor: number; index: number } | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropSlot, setCropSlot] = useState(0);
  // Foto por variação (feature PRO)
  const [cropVariacaoIdx, setCropVariacaoIdx] = useState<number | null>(null);
  const cropVariacaoRef = useRef<HTMLInputElement>(null);
  // Editar variação inline
  const [editandoVariacao, setEditandoVariacao] = useState<number | null>(null);
  const [editVariacaoValor, setEditVariacaoValor] = useState("");
  // viewMode fixo em grid (Netflix) — modo lista removido
  const [buscaTexto, setBuscaTexto] = useState("");

  // Ficha técnica (CMV)
  type Insumo = { id: string; nome: string; unidade: string; custo_unitario: number; imagem_url?: string };
  type FichaItem = { insumo_id: string; quantidade: number; unidade_utilizada: string; insumo?: Insumo };
  const [insumosCadastrados, setInsumosCadastrados] = useState<Insumo[]>([]);
  const [fichaTecnica, setFichaTecnica] = useState<FichaItem[]>([]);
  const [buscaInsumo, setBuscaInsumo] = useState("");
  // Modal dedicado da ficha técnica
  const [fichaModalOpen, setFichaModalOpen] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState("");

  const imgRef = useRef<HTMLInputElement>(null);
  const img2Ref = useRef<HTMLInputElement>(null);
  const img3Ref = useRef<HTMLInputElement>(null);
  const { isPro } = usePlano();

  // Auto-abre cadastro quando vem de Pedidos
  useEffect(() => {
    if (!loading && (location.state as any)?.abrirCadastro) {
      setModal(true);
      window.history.replaceState({}, "");
    }
  }, [loading, location.state]);

  // Bloqueia scroll quando modal aberto
  useEffect(() => {
    if (modal || previewProduto) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        const y = document.body.style.top;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        window.scrollTo(0, y ? -parseInt(y, 10) : 0);
      };
    }
  }, [modal, previewProduto]);

  // Fecha menu do preview quando preview fecha
  useEffect(() => { if (!previewProduto) setPreviewMenu(false); }, [previewProduto]);

  // Fecha menu ao clicar fora
  useEffect(() => {
    if (!previewMenu) return;
    const handler = () => setPreviewMenu(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [previewMenu]);
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      // Buscar nome pra personalizar tooltips
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
      if (profile?.nome) setPrimeiroNome(profile.nome.trim().split(/\s+/)[0]);
      await loadProdutos(user.id);
      await loadCategorias(user.id);
      await loadInsumos(user.id);
      await loadBiblioteca(user.id);
      setLoading(false);
    };
    load();
  }, []);

  // ═══ BIBLIOTECA DE EXTRAS ═══
  const loadBiblioteca = async (uid: string) => {
    const { data } = await supabase.from("biblioteca_extras").select("*").eq("user_id", uid).order("nome");
    if (data) setBiblioteca(data as BibliotecaExtra[]);
  };

  // Migra campos hardcoded antigos (tem_vela/tem_topo/etc) para o array adicionais
  const migrarAdicionaisLegacy = (p: Produto): Produto => {
    if (p.adicionais && p.adicionais.length > 0) return p;
    const legacy: Adicional[] = [];
    if (p.tem_vela) legacy.push({ nome: "Vela", valor: p.valor_vela || 0 });
    if (p.tem_topo) legacy.push({ nome: "Topo de bolo", valor: p.valor_topo || 0 });
    if (p.tem_papel_arroz) legacy.push({ nome: "Papel de arroz", valor: p.valor_papel_arroz || 0 });
    if (p.tem_outro && p.titulo_outro) legacy.push({ nome: p.titulo_outro, valor: p.valor_outro || 0 });
    return { ...p, adicionais: legacy };
  };

  // Sugestões da biblioteca pra categoria atual (que não estão já no produto)
  const sugestoesBiblioteca = biblioteca.filter(b => {
    const noProdutoAtual = (form.adicionais || []).some(a => a.from_biblioteca === b.id);
    if (noProdutoAtual) return false;
    if (!form.categoria) return true;
    // Se o extra não tem categorias, mostra pra todos
    if (!b.categorias || b.categorias.length === 0) return true;
    return b.categorias.includes(form.categoria);
  });

  const loadInsumos = async (uid: string) => {
    const { data } = await supabase.from("insumos").select("id, nome, unidade, custo_unitario, imagem_url").eq("user_id", uid).order("nome");
    if (data) setInsumosCadastrados(data as Insumo[]);
  };

  const loadProdutos = async (uid: string) => {
    const { data } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, unidade_utilizada, insumos(custo_unitario, unidade))")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setProdutos(data as Produto[]);
  };

  /**
   * Calcula CMV (custo), lucro absoluto e margem % de um produto a partir
   * da ficha técnica embutida (produto_insumos).
   * Considera preço promocional quando o produto está em promoção,
   * para refletir o lucro REAL que a confeiteira terá na venda.
   */
  const calcularLucro = (p: any): {
    cmv: number;
    lucro: number;
    margem: number;
    temFicha: boolean;
    precoEfetivo: number;
  } => {
    const itens: any[] = p.produto_insumos || [];
    // Mapa de conversão para unidade base
    const toBaseFactor: Record<string, number> = { kg: 1, g: 0.001, L: 1, ml: 0.001, un: 1 };
    const cmv = itens.reduce((sum, pi) => {
      const qtd = Number(pi.quantidade) || 0;
      const custo = Number(pi.insumos?.custo_unitario) || 0;
      const unidadeUtilizada = pi.unidade_utilizada || pi.insumos?.unidade || "";
      const unidadeInsumo = pi.insumos?.unidade || "";
      const fU = toBaseFactor[unidadeUtilizada];
      const fI = toBaseFactor[unidadeInsumo];
      if (fU != null && fI != null && fI > 0) {
        return sum + (qtd * fU / fI) * custo;
      }
      return sum + qtd * custo;
    }, 0);
    const precoEfetivo = (p.promocao && p.preco_promocional && p.preco_promocional > 0)
      ? Number(p.preco_promocional)
      : Number(p.preco_normal) || 0;
    const lucro = precoEfetivo - cmv;
    const margem = precoEfetivo > 0 ? (lucro / precoEfetivo) * 100 : 0;
    return { cmv, lucro, margem, temFicha: itens.length > 0, precoEfetivo };
  };

  const loadCategorias = async (uid: string) => {
    const { data } = await supabase.from("categorias").select("nome").eq("user_id", uid).order("nome");
    if (data) setCategorias(data.map((c: any) => c.nome));
  };

  // ═══ Draft de produto (mobile - autosave em localStorage) ═══
  const hasDraft = (): boolean => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      return !!(d?.form?.nome?.trim() || d?.form?.descricao?.trim());
    } catch { return false; }
  };

  const salvarDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        form,
        wizardStep,
        wizardTipo,
        wizardSubtipo,
        wizardOpts,
        ts: Date.now(),
      }));
    } catch {}
  };

  const limparDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setShowDraftBanner(false);
  };

  const restaurarDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.form) setForm(d.form);
      if (typeof d?.wizardStep === "number") setWizardStep(d.wizardStep);
      if (d?.wizardTipo) setWizardTipo(d.wizardTipo);
      if (d?.wizardSubtipo !== undefined) setWizardSubtipo(d.wizardSubtipo);
      if (d?.wizardOpts) setWizardOpts(d.wizardOpts);
      setShowDraftBanner(false);
    } catch {}
  };

  // Autosave: salva o form no localStorage enquanto o modal está aberto e é NOVO produto (sem id)
  useEffect(() => {
    if (!modal || form.id) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      // Só salva se tem conteúdo minimamente relevante
      if (form.nome?.trim() || form.descricao?.trim() || form.preco_normal > 0) {
        salvarDraft();
      }
    }, 400);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, wizardStep, wizardTipo, wizardSubtipo, wizardOpts, modal]);

  const openNovo = () => {
    // Se tem rascunho, abre o modal vazio + mostra banner pra escolher
    if (hasDraft()) {
      setForm(EMPTY); setFichaTecnica([]); setWizardStep(2); setWizardTipo("personalizavel"); setWizardSubtipo(null); setWizardOpts({ complementos: false, personalizacao: false, promocao: false }); setMobilePersonaStep("checklist"); setModal(true);
      setShowDraftBanner(true);
      return;
    }
    setForm(EMPTY); setFichaTecnica([]); setWizardStep(2); setWizardTipo("personalizavel"); setWizardSubtipo(null); setWizardOpts({ complementos: false, personalizacao: false, promocao: false }); setMobilePersonaStep("checklist"); setModal(true);
  };
  const openEditar = async (p: Produto, limparCopiaTag = false) => {
    // Migração silenciosa: "sob-encomenda" era misturado no forma_venda,
    // agora é modo de produção separado (pronta_entrega=false)
    const pMigrado = { ...p };
    if (pMigrado.forma_venda === "sob-encomenda") {
      pMigrado.forma_venda = "unidade";
      pMigrado.pronta_entrega = false;
    }
    // Ao clicar em "Revisar e Publicar" (produto despublicado), remove a
    // tag "(cópia)" ou "(cópia N)" do nome pra a confeiteira digitar
    // o nome final antes de publicar.
    if (limparCopiaTag) {
      pMigrado.nome = pMigrado.nome.replace(/\s*\(cópia(?:\s*\d+)?\)\s*$/i, "").trim();
    }
    setForm(migrarAdicionaisLegacy({ ...EMPTY, ...pMigrado }));
    setFichaTecnica([]);
    // Detecta tipo baseado nos dados salvos
    if (p.tipo_produto === "personalizavel") {
      setWizardTipo("personalizavel");
    } else {
      const temVariacoes = (p.tamanhos_disponiveis && p.tamanhos_disponiveis.length > 0) ||
                          (p.kit_itens && p.kit_itens.length > 0);
      setWizardTipo(temVariacoes ? "variacoes" : "simples");
    }
    setWizardOpts({
      complementos: !!p.tem_adicionais || !!(p.adicionais && p.adicionais.length > 0),
      personalizacao: !!p.permite_personalizacao,
      promocao: !!p.promocao,
    });
    setWizardStep(2);
    setEditTab("info");
    setModal(true);
    if (p.id && userId) {
      const { data } = await supabase
        .from("produto_insumos")
        .select("insumo_id, quantidade, unidade_utilizada, insumos(id, nome, unidade, custo_unitario, imagem_url)")
        .eq("produto_id", p.id);
      if (data) {
        setFichaTecnica(data.map((d: any) => ({
          insumo_id: d.insumo_id,
          quantidade: Number(d.quantidade) || 0,
          unidade_utilizada: d.unidade_utilizada || (d.insumos as any)?.unidade || "",
          insumo: d.insumos as Insumo,
        })));
      }
    }
  };
  const fecharModal = () => { setModal(false); setForm(EMPTY); setFichaTecnica([]); setFichaModalOpen(false); setShowQuickAdd(false); setBuscaInsumo(""); setWizardStep(2); setWizardTipo("personalizavel"); setWizardSubtipo(null); setWizardOpts({ complementos: false, personalizacao: false, promocao: false }); setConfirmDiscardProd(false); };

  // Guard: verifica se o produto tem dados preenchidos (pra decidir se avisa antes de fechar)
  const hasProdData = (): boolean => {
    if (form.id) return true; // Editando → sempre confirma
    return !!(
      form.nome?.trim() ||
      form.descricao?.trim() ||
      (form.preco_normal && form.preco_normal > 0) ||
      form.categoria?.trim() ||
      form.imagem_url?.trim() ||
      (fichaTecnica && fichaTecnica.length > 0) ||
      (form.tamanhos_disponiveis && form.tamanhos_disponiveis.length > 0)
    );
  };
  const handleTryClose = () => {
    if (hasProdData()) setConfirmDiscardProd(true);
    else fecharModal();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: number = 0) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result as string); setCropSlot(slot); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleProductCropDone = async (blob: Blob) => {
    if (!userId) return;
    const isVariacao = cropVariacaoIdx !== null;
    const idxVar = cropVariacaoIdx;
    setCropSrc(null);
    setCropVariacaoIdx(null);
    setUploading(true);
    const suffix = isVariacao ? `var-${idxVar}` : `${cropSlot}`;
    const path = `produtos/${userId}-${Date.now()}-${suffix}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      if (isVariacao && idxVar !== null) {
        setForm(f => {
          const arr = [...(f.tamanhos_disponiveis || [])];
          if (arr[idxVar]) arr[idxVar] = { ...arr[idxVar], foto_url: url };
          return { ...f, tamanhos_disponiveis: arr };
        });
      } else {
        setForm(f => {
          const imgs = (f.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
          imgs[cropSlot] = url;
          return { ...f, imagem_url: imgs.join(",") };
        });
      }
    }
    setUploading(false);
  };

  const handleVariacaoFotoUpload = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result as string); setCropVariacaoIdx(idx); };
    reader.readAsDataURL(file);
    e.target.value = "";  };

  const removeVariacaoFoto = (idx: number) => {
    setForm(f => {
      const arr = [...(f.tamanhos_disponiveis || [])];
      if (arr[idx]) arr[idx] = { ...arr[idx], foto_url: undefined };
      return { ...f, tamanhos_disponiveis: arr };
    });
  };

  // Novo: upload de foto pra variação por chave (sabor|tamanho / sabor| / |tamanho)
  const uploadFotoVariacaoKey = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const safeName = key.replace(/[^a-zA-Z0-9]/g, "_");
    const path = `produtos/${userId}-${Date.now()}-v-${safeName}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => ({
        ...f,
        fotos_variacoes: { ...(f.fotos_variacoes || {}), [key]: url }
      }));
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeFotoVariacaoKey = (key: string) => {
    setForm(f => {
      const fotos = { ...(f.fotos_variacoes || {}) };
      delete fotos[key];
      return { ...f, fotos_variacoes: fotos };
    });
  };

  const removeImage = (slot: number) => {
    setForm(f => {
      const imgs = (f.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
      imgs[slot] = "";
      return { ...f, imagem_url: imgs.filter(Boolean).join(",") };
    });
  };

  // ═══ AÇÕES EM MASSA (bulk) ═══
  const handleBulkPublicar = async (publicar: boolean) => {
    if (selecionados.length === 0) return;
    setBulkLoading(true);
    const ids = selecionados.map(p => p.id!).filter(Boolean);
    const { error } = await supabase.from("produtos").update({ disponivel: publicar }).in("id", ids);
    setBulkLoading(false);
    if (error) { showToast("error", "Erro", error.message); return; }
    await loadProdutos(userId);
    clearSelection();
    showToast(
      "success",
      publicar
        ? `${ids.length} ${ids.length > 1 ? "produtos publicados" : "produto publicado"}`
        : `${ids.length} ${ids.length > 1 ? "produtos despublicados" : "produto despublicado"}`,
      publicar
        ? "Já aparecem no seu cardápio público."
        : "Ficaram ocultos do cardápio. Você pode publicar novamente quando quiser."
    );
  };

  const handleBulkDuplicar = async () => {
    if (selecionados.length === 0 || !userId) return;
    setBulkLoading(true);
    let ok = 0, falhas = 0;
    for (const p of selecionados) {
      const { id, created_at, updated_at, produto_insumos, user_id, ...limpo } = p as any;
      const novo = { ...limpo, nome: proximoNomeCopia(p.nome), user_id: userId, disponivel: false };
      const { data, error } = await supabase.from("produtos").insert(novo).select("id").single();
      if (error) { falhas++; continue; }
      // Duplica ficha técnica também
      if (id && data?.id) {
        const { data: insumos } = await supabase.from("produto_insumos")
          .select("insumo_id, quantidade, unidade_utilizada, quantidade_base")
          .eq("produto_id", id);
        if (insumos && insumos.length > 0) {
          await supabase.from("produto_insumos").insert(
            insumos.map((i: any) => ({ ...i, produto_id: data.id, user_id: userId }))
          );
        }
      }
      ok++;
    }
    setBulkLoading(false);
    await loadProdutos(userId);
    clearSelection();
    if (falhas > 0) {
      showToast("error", `${ok} ${ok > 1 ? "cópias criadas" : "cópia criada"}, ${falhas} ${falhas > 1 ? "falharam" : "falhou"}`, "As cópias que deram certo estão despublicadas — revise antes de publicar no cardápio.");
    } else {
      showToast("success", `${ok} ${ok > 1 ? "cópias criadas" : "cópia criada"}`, "As cópias estão despublicadas. Revise as informações antes de publicar no cardápio.");
    }
  };

  const handleBulkExcluir = async () => {
    if (selecionados.length === 0) return;
    setBulkLoading(true);
    const ids = selecionados.map(p => p.id!).filter(Boolean);
    const { error } = await supabase.from("produtos").delete().in("id", ids);
    setBulkLoading(false);
    setConfirmBulkDelete(false);
    if (error) { showToast("error", "Erro ao excluir", error.message); return; }
    await loadProdutos(userId);
    clearSelection();
    showToast("success", `${ids.length} ${ids.length > 1 ? "produtos removidos" : "produto removido"}`, "Essa ação é definitiva. Se precisar novamente, cadastre outra vez.");
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) return alert("Nome é obrigatório");
    if (!form.categoria.trim()) return alert("Categoria é obrigatória");

    // Validação específica pra variações
    const isVariacoes = wizardTipo === "variacoes" && !form.id;
    const isPersonalizavel = wizardTipo === "personalizavel" && !form.id;
    let precoBase = form.preco_normal;

    if (isVariacoes) {
      const precos = form.precos_variacoes || {};
      const valores = Object.values(precos).filter(v => v > 0);
      if (valores.length === 0) return alert("Adicione ao menos 1 preço nas variações");
      // preco_normal vira o MENOR preço (pra aparecer no cardápio como "a partir de")
      precoBase = Math.min(...valores);
    } else if (isPersonalizavel) {
      const grupos = [form.grupo_massas, form.grupo_recheios, form.grupo_coberturas, form.grupo_sabores, form.grupo_tamanhos];
      const algumAtivo = grupos.some(g => g?.ativo && (g.opcoes?.length || 0) > 0);
      if (!algumAtivo) return alert("Ative ao menos uma categoria de personalização com opções");
      // Se tem Tamanhos ativos, preço base vem do MENOR tamanho
      const gt = form.grupo_tamanhos;
      const gs = form.grupo_sabores;
      if (gt?.ativo && gt.opcoes.length > 0) {
        // Modo por_peso: preço vem do preco_normal (R$/kg), não dos tamanhos individuais
        if (gt.modo_preco_tamanho === "por_peso") {
          if (!form.preco_normal || form.preco_normal <= 0) return alert("Defina o preço por kg");
          precoBase = form.preco_normal;
        } else {
          const precosT = gt.opcoes.map(o => o.preco).filter(p => p > 0);
          if (precosT.length === 0) return alert("Adicione ao menos 1 preço nos tamanhos");
          precoBase = Math.min(...precosT);
        }
      } else if (gs?.ativo && gs.opcoes.length > 0 && gs.sabor_tem_preco_proprio) {
        const precosS = gs.opcoes.map((o: any) => o.preco || 0).filter((p: number) => p > 0);
        if (precosS.length === 0) return alert("Adicione ao menos 1 preço nos sabores");
        precoBase = Math.min(...precosS);
      } else {
        if (!form.preco_normal || form.preco_normal <= 0) return alert("Preço base deve ser maior que zero");
      }
    } else {
      if (!form.preco_normal || form.preco_normal <= 0) return alert("Preço deve ser maior que zero");
    }

    // Define tipo_produto
    let tipoProduto: TipoProduto = form.tipo_produto || "simples";
    if (!form.id) {
      if (isPersonalizavel) tipoProduto = "personalizavel";
      else if (isVariacoes) tipoProduto = "variacao";
      else tipoProduto = "simples";
    }

    setSaving(true);

    // ─── Adapter Passo 1: converte state antigo (grupo_massas/recheios/etc)
    // pra formato genérico `grupos_opcoes[]` e salva em ambos formatos
    // pra manter compatibilidade durante a transição.
    const gruposArray = carregarGruposDoBanco(form);
    const gruposPayload = salvarGruposParaBanco(gruposArray);

    // ─── Limpar campos que NÃO pertencem à tabela produtos ───
    // (evita Supabase rejeitar silenciosamente o update inteiro)
    const { produto_insumos, created_at, ...formLimpo } = form as any;

    const payload = {
      ...formLimpo,
      ...gruposPayload,
      preco_normal: precoBase,
      tipo_produto: tipoProduto,
      updated_at: new Date().toISOString(),
    };
    let produtoId = form.id;
    if (form.id) {
      const { error } = await supabase.from("produtos").update(payload).eq("id", form.id);
      if (error) {
        console.error("Erro ao atualizar produto:", error);
        showToast("error", "Erro ao salvar", error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data: novo, error } = await supabase.from("produtos").insert({ ...payload, user_id: userId }).select("id").single();
      if (error) {
        console.error("Erro ao criar produto:", error);
        showToast("error", "Erro ao criar", error.message);
        setSaving(false);
        return;
      }
      produtoId = novo?.id;
    }

    // Persistir ficha técnica
    if (produtoId && userId) {
      await supabase.from("produto_insumos").delete().eq("produto_id", produtoId);
      const itens = fichaTecnica
        .filter(f => f.insumo_id && f.quantidade > 0)
        .map(f => ({
          user_id: userId,
          produto_id: produtoId,
          insumo_id: f.insumo_id,
          quantidade: f.quantidade,
          unidade_utilizada: f.unidade_utilizada,
          quantidade_base: toBaseProd(f.quantidade, f.unidade_utilizada),
        }));
      if (itens.length > 0) {
        await supabase.from("produto_insumos").insert(itens);
      }
    }

    await loadProdutos(userId);
    setSaving(false);
    limparDraft();
    fecharModal();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("produtos").delete().eq("id", id);
    setProdutos(p => p.filter(x => x.id !== id));
    setDeleteConfirm(null);
  };

  const handleAdicionarCategoria = async (iconeOverride?: string) => {
    const nome = novaCategoria.trim();
    if (!nome || !userId) return;
    const icone = iconeOverride || novaCategoriaIcone || SYSTEM_ICONS[0];
    // Proteção: não deixa salvar nomes suspeitos (usuário deve ter colado o alerta)
    const nomeLower = nome.toLowerCase();
    if (nomeLower.includes("selecione") || nomeLower.includes("ícone") || nomeLower.includes("icone")) {
      return alert("Nome inválido. Digite o nome da sua categoria (ex: Pudins, Bolos, Doces)");
    }
    setSavingCat(true);
    await supabase.from("categorias").insert({
      nome,
      imagem_url: icone,
      ordem: categorias.length,
      user_id: userId
    });
    setCategorias(prev => [...prev, nome].sort());
    setForm(f => ({ ...f, categoria: nome }));
    setNovaCategoria(""); setNovaCategoriaIcone(""); setShowCatInput(false);
    setSavingCat(false);
  };

  const addOpcao = (campo: "massas_disponiveis" | "recheios_disponiveis" | "coberturas_disponiveis", key: "massa" | "recheio" | "cobertura") => {
    const val = novaOpcao[key].trim();
    if (!val) return;
    setForm(f => ({ ...f, [campo]: [...(f[campo] || []), val] }));
    setNovaOpcao(o => ({ ...o, [key]: "" }));
  };

  const removeOpcao = (campo: "massas_disponiveis" | "recheios_disponiveis" | "coberturas_disponiveis", idx: number) => {
    setForm(f => ({ ...f, [campo]: (f[campo] || []).filter((_: string, i: number) => i !== idx) }));
  };

  // ── Ficha técnica ─────────────────────────────────────────
  const adicionarInsumoFicha = (ins: Insumo) => {
    if (fichaTecnica.some(f => f.insumo_id === ins.id)) {
      alert("Esse insumo já está na ficha técnica");
      return;
    }
    setFichaTecnica(prev => [...prev, { insumo_id: ins.id, quantidade: 0, unidade_utilizada: getDefaultRecipeUnitProd(ins.unidade), insumo: ins }]);
    setBuscaInsumo("");
  };
  const removerInsumoFicha = (id: string) => {
    setFichaTecnica(prev => prev.filter(f => f.insumo_id !== id));
  };
  const atualizarQtdFicha = (id: string, qtd: number) => {
    setFichaTecnica(prev => prev.map(f => f.insumo_id === id ? { ...f, quantidade: qtd } : f));
  };
  const atualizarUnidadeFicha = (id: string, unidade: string) => {
    setFichaTecnica(prev => prev.map(f => f.insumo_id === id ? { ...f, unidade_utilizada: unidade } : f));
  };

  // Cadastro rápido de insumo (delega ao componente QuickAddInsumo)
  const abrirQuickAdd = (nomeInicial?: string) => {
    setQuickAddInitialName(nomeInicial || "");
    setShowQuickAdd(true);
  };
  const fecharQuickAdd = () => {
    setShowQuickAdd(false);
    setQuickAddInitialName("");
  };
  const handleInsumoSalvoRapido = (novoInsumo: Insumo) => {
    setInsumosCadastrados(prev => [...prev, novoInsumo]);
    setFichaTecnica(prev => [...prev, { insumo_id: novoInsumo.id, quantidade: 0, unidade_utilizada: getDefaultRecipeUnitProd(novoInsumo.unidade), insumo: novoInsumo }]);
    fecharQuickAdd();
  };

  const cmvProduto = fichaTecnica.reduce(
    (s, f) => s + calcCustoProd(f.quantidade, f.unidade_utilizada, f.insumo?.unidade || "", f.insumo?.custo_unitario || 0),
    0
  );
  const margemProduto = form.preco_normal > 0
    ? ((form.preco_normal - cmvProduto) / form.preco_normal) * 100
    : 0;

  const addTamanho = () => {
    if (!novoTamanho.label.trim() || !novoTamanho.preco) return;
    const preco = parseFloat(novoTamanho.preco.replace(",", "."));
    if (isNaN(preco)) return;
    setForm(f => ({ ...f, tamanhos_disponiveis: [...(f.tamanhos_disponiveis || []), { label: novoTamanho.label.trim(), preco }] }));
    setNovoTamanho({ label: "", preco: "" });
  };

  const removeTamanho = (idx: number) => {
    setForm(f => ({ ...f, tamanhos_disponiveis: (f.tamanhos_disponiveis || []).filter((_, i) => i !== idx) }));
  };

  const formatPreco = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parsePreco = (s: string) => (parseInt(s.replace(/\D/g, "")) || 0) / 100;

  const produtosFiltrados = (() => {
    let lista = [...produtos];
    if (buscaTexto.trim()) {
      const t = buscaTexto.toLowerCase();
      lista = lista.filter(p => p.nome.toLowerCase().includes(t) || p.descricao?.toLowerCase().includes(t));
    }
    switch (ordenarPor) {
      case "alfabetica":
        lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        break;
      case "categoria":
        lista.sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"));
        break;
      case "preco":
        lista.sort((a, b) => a.preco_normal - b.preco_normal);
        break;
      case "recentes":
      default:
        lista.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        break;
    }
    return lista;
  })();
  const todasCategorias = Array.from(new Set([...categorias, ...produtos.map(p => p.categoria).filter(Boolean)])).sort();

  const Toggle = ({ label, value, onChange, colorClass }: any) => (
    <div className={`prod-toggle-item${value ? ` ${colorClass}` : ""}`} onClick={() => onChange(!value)}>
      <div className={`prod-toggle-slider${value ? " active" : ""}`} style={{ background: value ? (colorClass === "active-green" ? "var(--success)" : "var(--primary)") : "var(--border)" }}>
        <div className="prod-toggle-thumb" style={{ transform: value ? "translateX(20px)" : "translateX(0)" }} />
      </div>
      <span>{label}</span>
    </div>
  );

  const TagList = ({ items, onRemove }: { items: string[], onRemove: (i: number) => void }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--primary-light)", color: "var(--primary-dark)", borderRadius: "50px", fontSize: "0.8rem", fontWeight: 600 }}>
          {item}
          <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary-dark)", padding: 0, lineHeight: 1, fontSize: "0.85rem" }}>×</button>
        </span>
      ))}
    </div>
  );

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}><span className="prod-spinner" /></div>;

  return (
    <>
    <AppPageHeader
      title="Meus Produtos"
      subtitle="Gerencie o que você vende"
      infoIcon="🎂"
      infoContent={
        <>
          <p>Aqui você <strong>cadastra e organiza tudo que vende</strong> na sua confeitaria — bolos, doces, cupcakes, kits de festa e mais.</p>
          <p>Cada produto pode ter foto, preço, descrição, sabores e variações. Você organiza por <strong>categorias</strong> pra ficar fácil de encontrar e mostrar no seu cardápio digital.</p>
        </>
      }
      infoTip={<>Clique em <strong>"+ Novo Produto"</strong> pra cadastrar. Depois é só compartilhar seu cardápio com os clientes.</>}
    />
    {cropSrc && (
      <ImageCropper
        imageSrc={cropSrc}
        cropShape="rect"
        aspect={1}
        onCancel={() => { setCropSrc(null); setCropVariacaoIdx(null); }}
        onCropDone={handleProductCropDone}
      />
    )}
    <div className="prod-root">


      {/* ── Tabs — só quando tem produtos ── */}
      {produtos.length > 0 && (
      <div className="prod-tabs-novo">
        <button className={`prod-tab-novo${activeTab==="produtos"?" active":""}`} onClick={()=>setActiveTab("produtos")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          Produtos
        </button>
        <button className={`prod-tab-novo${activeTab==="categorias"?" active":""}`} onClick={()=>setActiveTab("categorias")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          Categorias
        </button>
      </div>
      )}

      {activeTab === "categorias" && <Categorias />}

      {activeTab === "produtos" && <>

      {/* Header + Busca + Ordenar — só quando tem produtos */}
      {produtos.length > 0 && (
      <>
      {/* Botão Novo Produto à direita */}
      <div className="prod-header-novo" style={{ justifyContent: 'flex-end' }}>
        <BtnNovo label="Novo produto" onClick={openNovo} />
      </div>

      {/* Barra de pesquisa */}
      <div className="prod-busca-novo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          type="text"
          placeholder="Buscar produto..."
          value={buscaTexto}
          onChange={e => setBuscaTexto(e.target.value)}
        />
      </div>

      {/* Aviso de produtos sem categoria válida */}
      {(() => {
        const orfaos = produtos.filter(p => p.categoria && !categorias.includes(p.categoria));
        if (orfaos.length === 0) return null;
        return (
          <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "14px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#92400e", margin: "0 0 2px" }}>
                {orfaos.length} produto{orfaos.length !== 1 ? "s" : ""} com categoria inexistente
              </p>
              <p style={{ fontSize: "0.75rem", color: "#b45309", margin: 0 }}>
                Esses produtos aparecem apenas em "Todos" no cardápio. Edite-os e selecione uma categoria válida.
              </p>
            </div>
            <button onClick={() => setFiltroOrfaos(true)} style={{ padding: "5px 12px", background: "var(--warning)", color: "white", border: "none", borderRadius: "8px", fontFamily: "inherit", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              Ver {orfaos.length}
            </button>
          </div>
        );
      })()}

      {/* Ordenar por */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowOrdenar(!showOrdenar)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "0.4rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg-card)", fontFamily: "var(--font-base)", fontSize: "var(--font-helper)", fontWeight: "var(--fw-medium)", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M6 12h12M9 18h6"/></svg>
          {{ recentes: "Mais recentes", alfabetica: "Alfabética", categoria: "Categoria", preco: "Preço" }[ordenarPor]}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {showOrdenar && (
          <>
            <div onClick={() => setShowOrdenar(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "var(--bg-card)", border: "1.5px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, minWidth: "180px", overflow: "hidden" }}>
              {([
                { value: "recentes", label: "Mais recentes" },
                { value: "alfabetica", label: "Alfabética" },
                { value: "categoria", label: "Categoria" },
                { value: "preco", label: "Preço" },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setOrdenarPor(opt.value); setShowOrdenar(false); setFiltroOrfaos(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "0.6rem 0.85rem",
                    border: "none", background: ordenarPor === opt.value ? "var(--primary-light)" : "transparent",
                    fontFamily: "var(--font-base)", fontSize: "0.85rem", fontWeight: ordenarPor === opt.value ? 700 : 500,
                    color: ordenarPor === opt.value ? "var(--primary)" : "var(--text-primary)", cursor: "pointer", textAlign: "left",
                  }}
                >
                  {opt.label}
                  {ordenarPor === opt.value && <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      </>
      )}

      {loading ? (
        <div className="prod-loading-full">
          <span className="prod-spinner" />
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="prod-hero-split">
          {/* ── Lado esquerdo: texto + CTAs + dica ── */}
          <div className="prod-hero-left">
            <span className="prod-hero-eyebrow">✨ VAMOS COMEÇAR</span>
            <h1 className="prod-hero-title">Cadastre seu<br/>primeiro produto</h1>
            <p className="prod-hero-desc">
              Seu catálogo é a vitrine da sua confeitaria. Quanto mais completo,
              mais profissional ele será e mais clientes você conquista.
            </p>
            <div className="prod-hero-actions">
              <button className="prod-hero-btn-primary" onClick={openNovo}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                CADASTRAR PRODUTO
              </button>
              <button className="prod-hero-btn-ghost" onClick={() => alert("🎬 Vídeo em produção! Em breve disponível.")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Ver tutorial
              </button>
            </div>
            <div className="prod-hero-tip">
              <div className="prod-hero-tip-icon">💡</div>
              <div>
                <p className="prod-hero-tip-t">Dica: fotos boas vendem 3x mais</p>
                <p className="prod-hero-tip-d">Use luz natural, fundo branco, e mostre o produto de ângulos diferentes.</p>
              </div>
            </div>
          </div>

          {/* ── Lado direito: vídeo grande ── */}
          <aside className="prod-hero-right" aria-label="Vídeo tutorial">
            <div className="prod-hero-video-thumb">
              <button
                type="button"
                className="prod-hero-video-play"
                onClick={() => alert("🎬 Vídeo em produção! Em breve disponível.")}
                aria-label="Assistir tutorial"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
            <div className="prod-hero-video-footer">
              <span className="prod-hero-video-t">🎬 Tutorial completo</span>
              <span className="prod-hero-video-badge">EM BREVE</span>
            </div>
          </aside>
        </div>
      ) : (
        <div className="prod-grid">
          {(filtroOrfaos
            ? produtos.filter(p => p.categoria && !categorias.includes(p.categoria))
            : produtosFiltrados
          ).map(p => {
            const catInvalida = p.categoria && !categorias.includes(p.categoria);
            return (
            <div
              key={p.id}
              className={`prod-card ${p.id && isSelected(p.id) ? "prod-card--selected" : ""}`}
              style={{ outline: catInvalida ? "2px solid #fcd34d" : "none", cursor: "pointer", position: "relative" }}
              onClick={() => {
                // Se tem produtos selecionados, o clique adiciona/remove; senão, abre preview
                if (selectedIds.size > 0 && p.id) {
                  toggleSelect(p.id);
                } else {
                  setPreviewProduto(p);
                }
              }}
            >
              {/* Checkbox bulk — só desktop, canto sup esquerdo */}
              {p.id && (
                <div
                  className="prod-card-check"
                  onClick={e => toggleSelect(p.id!, e)}
                  role="checkbox"
                  aria-checked={isSelected(p.id)}
                >
                  {isSelected(p.id) ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : null}
                </div>
              )}
              <div className="prod-card-img">
                {p.imagem_url ? (
                  <img src={p.imagem_url.split(",")[0]} alt={p.nome} />
                ) : (
                  <div className="prod-card-sem-foto">
                    <div className="prod-card-sem-foto-icon">📸</div>
                    <div className="prod-card-sem-foto-title">Foto vende mais</div>
                    <div className="prod-card-sem-foto-cta">toque pra adicionar</div>
                  </div>
                )}
                {!p.disponivel && <div className="prod-card-indisponivel">Despublicado</div>}
                {p.promocao && <div className="prod-card-promo">🔥 Promoção</div>}
                {(p.tamanhos_disponiveis && p.tamanhos_disponiveis.length > 0) && (
                  <div className="prod-card-badge-var">
                    📏 {p.tamanhos_disponiveis.length === 1 ? p.tamanhos_disponiveis[0].label : `${p.tamanhos_disponiveis.length} opções`}
                  </div>
                )}
                {p.pronta_entrega === false && <div className="prod-card-encomenda">Encomenda</div>}
                {catInvalida && <div style={{ position: "absolute", top: "0.4rem", left: "0.4rem", background: "var(--warning)", color: "var(--text-inverse)", fontSize: "0.6rem", fontWeight: 700, padding: "2px 6px", borderRadius: "6px" }}>Sem categoria</div>}
              </div>
              <div className="prod-card-info">
                <p className="prod-card-cat" style={{ color: catInvalida ? "var(--warning)" : undefined }}>{catInvalida ? p.categoria : p.categoria}</p>
                <p className="prod-card-nome">{p.nome}</p>
                {p.promocao && p.preco_promocional && p.preco_promocional > 0 ? (
                  <p className="prod-card-preco" style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "nowrap" }}>
                    <span style={{ textDecoration: "line-through", color: "var(--text-muted)", fontWeight: "var(--fw-medium)" as any, fontSize: "0.75rem" }}>R$ {formatPreco(p.preco_normal)}</span>
                    <span>R$ {formatPreco(p.preco_promocional)}</span>
                  </p>
                ) : (
                  <p className="prod-card-preco">R$ {formatPreco(p.preco_normal)}</p>
                )}
                <div className="prod-card-bottom">
                {(() => {
                  const { lucro, margem, temFicha } = calcularLucro(p);
                  if (!temFicha) {
                    return (
                      <button
                        type="button"
                        className="prod-card-sem-ficha"
                        onClick={(e) => { e.stopPropagation(); navigate("/ficha-tecnica", { state: { produtoId: p.id } }); }}
                        title="Adicione insumos para ver o lucro por venda"
                      >
                        Configure a<br/>Ficha Técnica
                      </button>
                    );
                  }
                  const tier = margem >= 50 ? "alto" : margem >= 25 ? "medio" : "baixo";
                  return (
                    <div className={`prod-card-lucro prod-card-lucro--${tier}`}>
                      <span className="prod-card-lucro-label">Lucro/venda</span>
                      <strong>R$ {formatPreco(lucro)} <span className="prod-card-lucro-pct">({margem.toFixed(0)}%)</span></strong>
                    </div>
                  );
                })()}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="prod-modal-overlay" onClick={handleTryClose}>
          <div className="prod-modal prod-modal--novo" onClick={e => e.stopPropagation()}>
            {wizardStep >= 2 && (
            <div className="prod-modal-header-novo">
              {wizardStep > 2 && !form.id ? (
                <button className="prod-modal-back-novo" onClick={() => {
                  // Mobile: se está preenchendo personalização, volta pro checklist ao invés do step anterior
                  if (isMobileMain && !form.id && wizardStep === 3 && mobilePersonaStep === "fill") {
                    setMobilePersonaStep("checklist");
                    return;
                  }
                  setWizardStep(s => Math.max(2, s - 1) as 1 | 2 | 3 | 4 | 5);
                }} aria-label="Voltar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
              ) : <div style={{width: 36}} />}
              <div className="prod-modal-title-wrap">
                <div className="prod-modal-title-novo">
                  {form.id ? "Editar produto" : (() => {
                    if (wizardStep === 2) return "Informações do produto";
                    if (wizardStep === 3) return "";
                    if (wizardStep === 4) return "";
                    if (wizardStep === 5) return "";
                    return "";
                  })()}
                </div>
                {form.id && form.nome && (
                  <div className="prod-modal-edit-nome">{form.nome}</div>
                )}
              </div>
              <button className="prod-modal-close-novo" onClick={handleTryClose} aria-label="Fechar">✕</button>
            </div>
            )}

            {/* ══════ Tabs do MODO EDIÇÃO (V3 — 4 tabs espelhando o wizard) ══════ */}
            {form.id && (
              <div className="prod-edit-tabs">
                <button
                  className={`prod-edit-tab ${editTab === "info" ? "prod-edit-tab--ativo" : ""}`}
                  onClick={() => setEditTab("info")}
                >
                  <span className="prod-edit-tab-icon">📝</span> Info
                </button>
                <button
                  className={`prod-edit-tab ${editTab === "opcoes" ? "prod-edit-tab--ativo" : ""}`}
                  onClick={() => setEditTab("opcoes")}
                >
                  <span className="prod-edit-tab-icon">🎨</span> Opções
                </button>
                <button
                  className={`prod-edit-tab ${editTab === "preco" ? "prod-edit-tab--ativo" : ""}`}
                  onClick={() => setEditTab("preco")}
                >
                  <span className="prod-edit-tab-icon">💰</span> Preço
                </button>
                <button
                  className={`prod-edit-tab ${editTab === "fotos" ? "prod-edit-tab--ativo" : ""}`}
                  onClick={() => setEditTab("fotos")}
                >
                  <span className="prod-edit-tab-icon">📷</span> Fotos
                </button>
              </div>
            )}

            {/* ══════ WIZARD STEP 1 — Escolha do tipo (TELA CHEIA ROSA) ══════ */}
            {wizardStep === 1 && (
              <div className="wiz-step1-full">
                {/* Botão X */}
                <button className="wiz-step1-x" onClick={handleTryClose} aria-label="Fechar">✕</button>

                {/* Hero — pergunta */}
                <div className="wiz-step1-hero">
                  <h1 className="wiz-step1-title">Como é o seu produto?</h1>
                  <p className="wiz-step1-sub">Você pode mudar isso depois se precisar</p>
                </div>

                {/* 2 cards principais */}
                <div className="wiz-step1-cards">
                  <button
                    type="button"
                    data-tipo="simples"
                    className={`wiz-step1-card ${wizardTipo === "simples" ? "wiz-step1-card--ativo" : ""}`}
                    onClick={() => {
                      setWizardTipo("simples");
                      setWizardSubtipo(null);
                      setForm(f => ({ ...f, forma_venda: "unidade" }));
                    }}
                  >
                    <img src={`/categoriaicones/${encodeURIComponent("icone (3).png")}`} alt="" className="wiz-step1-card-icon" />
                    <div className="wiz-step1-card-title">Produto simples</div>
                    <div className="wiz-step1-card-desc">Um produto,<br/>um preço</div>
                  </button>

                  <button
                    type="button"
                    data-tipo="variacoes"
                    className={`wiz-step1-card ${wizardTipo === "variacoes" ? "wiz-step1-card--ativo" : ""}`}
                    onClick={() => setWizardTipo("variacoes")}
                  >
                    <img src={`/categoriaicones/${encodeURIComponent("icone (26).png")}`} alt="" className="wiz-step1-card-icon" />
                    <div className="wiz-step1-card-title">Com variações</div>
                    <div className="wiz-step1-card-desc">Sabores com<br/>foto e preço</div>
                  </button>
                  <button
                    type="button"
                    data-tipo="personalizavel"
                    className={`wiz-step1-card ${wizardTipo === "personalizavel" ? "wiz-step1-card--ativo" : ""}`}
                    onClick={() => setWizardTipo("personalizavel")}
                  >
                    <div className="wiz-step1-card-icon" style={{fontSize: 40, lineHeight: 1}}>🎂</div>
                    <div className="wiz-step1-card-title">
                      Personalizável
                      <span style={{background: "#E85A8C", color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 4, marginLeft: 6, letterSpacing: "0.03em", fontWeight: 700}}>NOVO</span>
                    </div>
                    <div className="wiz-step1-card-desc">Cliente monta<br/>o produto</div>
                  </button>
                </div>

                {/* 3 subtipos — só aparecem se "Com variações" */}
                {wizardTipo === "variacoes" && (
                  <>
                    <div className="wiz-step1-sub-label">
                      Que tipo de variação? <ReqTag />
                    </div>
                    <div className="wiz-step1-subcards">
                      <button
                        type="button"
                        className={`wiz-step1-subcard ${wizardSubtipo === "sabores_e_tamanhos" ? "wiz-step1-subcard--ativo" : ""}`}
                        onClick={() => setWizardSubtipo("sabores_e_tamanhos")}
                      >
                        <div className="wiz-step1-subcard-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
                            <line x1="12" y1="22" x2="12" y2="15.5"/>
                            <polyline points="22 8.5 12 15.5 2 8.5"/>
                          </svg>
                        </div>
                        <div className="wiz-step1-subcard-title">Sabores e tamanhos</div>
                        <div className="wiz-step1-subcard-desc">Ex.: bolo (sabor + P/M/G)</div>
                      </button>
                      <button
                        type="button"
                        className={`wiz-step1-subcard ${wizardSubtipo === "so_sabores" ? "wiz-step1-subcard--ativo" : ""}`}
                        onClick={() => setWizardSubtipo("so_sabores")}
                      >
                        <div className="wiz-step1-subcard-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2C6 8 6 13 6 16a6 6 0 0 0 12 0c0-3 0-8-6-14z"/>
                          </svg>
                        </div>
                        <div className="wiz-step1-subcard-title">Só sabores</div>
                        <div className="wiz-step1-subcard-desc">Ex.: brigadeiro (ninho, morango)</div>
                      </button>
                      <button
                        type="button"
                        className={`wiz-step1-subcard ${wizardSubtipo === "so_tamanhos" ? "wiz-step1-subcard--ativo" : ""}`}
                        onClick={() => setWizardSubtipo("so_tamanhos")}
                      >
                        <div className="wiz-step1-subcard-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v-3H3v3M21 12V9H3v3M21 9V6H3v3"/>
                          </svg>
                        </div>
                        <div className="wiz-step1-subcard-title">Só tamanhos</div>
                        <div className="wiz-step1-subcard-desc">Ex.: torta (fatia, inteira)</div>
                      </button>
                    </div>
                  </>
                )}

                {/* Botão avançar */}
                <div className="wiz-step1-footer">
                  <button
                    type="button"
                    className="wiz-step1-avancar"
                    disabled={wizardTipo === "variacoes" && !wizardSubtipo}
                    onClick={() => setWizardStep(2)}
                  >
                    Avançar <span style={{marginLeft: 6}}>→</span>
                  </button>
                </div>
              </div>
            )}

            {/* ══════ WIZARD STEP 2 (FORMULÁRIO) ══════ */}
            {/* ══════ WIZARD STEP 2 — IDENTIDADE (nome, categoria, descrição) ══════ */}
            {((wizardStep === 2 && !form.id) || (form.id && editTab === "info")) && (
            <div className="prod-modal-body">
              {showDraftBanner && !form.id && (
                <div className="prod-draft-banner">
                  <div className="prod-draft-banner-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>
                    </svg>
                  </div>
                  <div className="prod-draft-banner-text">
                    <p className="prod-draft-banner-title">Você tem um rascunho salvo</p>
                    <p className="prod-draft-banner-sub">Quer continuar de onde parou?</p>
                  </div>
                  <div className="prod-draft-banner-actions">
                    <button type="button" className="prod-draft-btn prod-draft-btn--secondary" onClick={limparDraft}>Descartar</button>
                    <button type="button" className="prod-draft-btn prod-draft-btn--primary" onClick={restaurarDraft}>Continuar</button>
                  </div>
                </div>
              )}
              <div className="prod-section">
                {/* 1. Nome */}
                <div className="prod-field">
                  <label className="prod-field-label-novo">Nome do produto <ReqTag /></label>
                  <input
                    type="text"
                    placeholder="Ex: Bolo de Morango"
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    onBlur={e => setForm(f => ({ ...f, nome: titleCase(e.target.value) }))}
                  />
                </div>

                {/* 2. Categoria */}
                <div className="prod-field">
                  <label className="prod-field-label-novo">Categoria <ReqTag /></label>
                  {!showCatInput ? (
                    <SelectDoonly
                      value={form.categoria}
                      onChange={v => setForm(f => ({ ...f, categoria: v }))}
                      options={todasCategorias.map(cat => ({ value: cat, label: cat }))}
                      placeholder={todasCategorias.length > 0 ? "Selecione uma categoria..." : "Nenhuma categoria cadastrada"}
                      title="Escolha a categoria"
                      extraOptionLabel={todasCategorias.length > 0 ? "Criar nova categoria" : "Criar primeira categoria"}
                      onExtraOption={() => setShowCatInput(true)}
                    />
                  ) : (
                    <div className="prod-cat-nova-form">
                      <p className="prod-cat-nova-hint">✨ Criar nova categoria</p>
                      <input
                        type="text"
                        placeholder="Ex: Bolos, Doces, Salgados..."
                        value={novaCategoria}
                        onChange={e => setNovaCategoria(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter" && novaCategoria.trim()) {
                            const icone = novaCategoriaIcone || SYSTEM_ICONS[0];
                            if (!novaCategoriaIcone) setNovaCategoriaIcone(icone);
                            handleAdicionarCategoria(icone);
                          }
                        }}
                      />
                      <div style={{display:'flex', gap:8, marginTop: 8}}>
                        <button
                          type="button"
                          onClick={() => { setShowCatInput(false); setNovaCategoria(""); setNovaCategoriaIcone(""); }}
                          className="prod-cat-cancel-btn"
                        >Cancelar</button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!novaCategoria.trim()) return;
                            const icone = novaCategoriaIcone || SYSTEM_ICONS[0];
                            if (!novaCategoriaIcone) setNovaCategoriaIcone(icone);
                            handleAdicionarCategoria(icone);
                          }}
                          disabled={!novaCategoria.trim() || savingCat}
                          className="prod-cat-criar-btn"
                        >
                          {savingCat ? "Criando..." : "Criar categoria"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Descrição — com CTA IA (V3) — gera ou melhora */}
                <div className="prod-field">
                  <div className="prod-desc-header">
                    <label className="prod-field-label-novo">Descrição</label>
                    <button
                      type="button"
                      className={`prod-btn-ia-novo ${!form.nome.trim() || !isPro ? "prod-btn-ia-novo--locked" : ""}`}
                      disabled={!form.nome.trim() || !isPro || form.descricao === "Gerando..." || form.descricao === "Melhorando..."}
                      onClick={async () => {
                        if (!form.nome.trim() || !isPro) return;
                        const textoAtual = (form.descricao || "").trim();
                        const ehMelhorar = textoAtual.length > 0 && textoAtual !== "Gerando..." && textoAtual !== "Melhorando...";
                        setForm(f => ({ ...f, descricao: ehMelhorar ? "Melhorando..." : "Gerando..." }));
                        try {
                          const prompt = ehMelhorar
                            ? `Melhore esta descrição de produto de confeitaria, mantendo a intenção e informações originais. Torne mais atraente, clara e profissional. Máximo 2 frases curtas (até 150 caracteres). Português brasileiro. Retorne APENAS a descrição melhorada, sem aspas, sem emojis, sem introdução.\n\nProduto: "${form.nome}"\nDescrição atual: "${textoAtual}"`
                            : `Crie uma descrição MUITO curta e atraente para um produto de confeitaria chamado "${form.nome}". MÁXIMO 2 frases curtas (até 100 caracteres no total). Português brasileiro, transmita qualidade e sabor. Retorne APENAS a descrição, sem aspas, sem emojis.`;
                          const res = await fetch("/api/gerar-descricao", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt })
                          });
                          const data = await res.json();
                          const desc = data.content?.[0]?.text?.trim() || "";
                          setForm(f => ({ ...f, descricao: desc || textoAtual }));
                        } catch {
                          setForm(f => ({ ...f, descricao: textoAtual }));
                        }
                      }}
                      title={!form.nome.trim() ? "Preencha o nome primeiro" : !isPro ? "Disponível no plano PRO" : (form.descricao?.trim() ? "Melhorar descrição atual" : "Gerar descrição automaticamente")}
                    >
                      <img src="/coroa.png" alt="" className="prod-btn-ia-novo-crown" />
                      {form.descricao === "Gerando..."
                        ? "Gerando..."
                        : form.descricao === "Melhorando..."
                        ? "Melhorando..."
                        : (form.descricao?.trim() ? "Melhorar com IA" : "Gerar com IA")}
                    </button>
                  </div>
                  <textarea
                    id="prod-desc-input"
                    placeholder={"Descreva como é seu produto\n\nExemplo:\n2 camadas de Mousse de chocolate (massa pão de ló de chocolate)\nCobertura Mousse Branco (tipo chantilly)"}
                    value={form.descricao === "Gerando..." || form.descricao === "Melhorando..." ? "" : form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    rows={5}
                    disabled={form.descricao === "Gerando..." || form.descricao === "Melhorando..."}
                    style={{fontFamily: 'inherit', resize: 'vertical'}}
                  />
                  {!isPro && (
                    <div className="prod-cta-pro-ia">
                      <span className="prod-cta-pro-ia-txt">
                        Com o <b>Doonly PRO</b>, você gera descrições que vendem com <b>IA em 1 clique</b>
                        <button
                          type="button"
                          className="prod-cta-pro-ia-info"
                          onClick={() => setShowProIaModal(true)}
                          aria-label="Saiba mais"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* ══════ WIZARD STEP 3 (UNIFICADO — PERSONALIZAÇÃO V3) ══════ */}
            {((wizardStep === 3 && !form.id) || (form.id && editTab === "opcoes")) && (
              <div className="prod-modal-body">
                <PersonalizacaoStep
                  grupoMassas={form.grupo_massas || GRUPO_VAZIO}
                  grupoRecheios={form.grupo_recheios || GRUPO_VAZIO}
                  grupoCoberturas={form.grupo_coberturas || GRUPO_VAZIO}
                  grupoSabores={form.grupo_sabores || GRUPO_SABORES_VAZIO}
                  grupoTamanhos={form.grupo_tamanhos || GRUPO_TAMANHOS_VAZIO}
                  precoBase={form.preco_normal || 0}
                  quantidadeBase={form.quantidade_base ?? null}
                  formaVenda={form.forma_venda || "unidade"}
                  onChange={(patch) => setForm(f => ({ ...f, ...patch }))}
                  onPrecoBaseChange={(v) => setForm(f => ({ ...f, preco_normal: v }))}
                  onFormaVendaChange={(v) => setForm(f => ({ ...f, forma_venda: v }))}
                  mobileMode={isMobileMain && !form.id ? mobilePersonaStep : undefined}
                  onGoToFill={() => setMobilePersonaStep("fill")}
                  onBackToChecklist={() => setMobilePersonaStep("checklist")}
                  primeiroNome={primeiroNome}
                  produtoNome={form.nome}
                  produtoCategoria={form.categoria}
                />
              </div>
            )}

            {/* ══════ WIZARD STEP 3 (SIMPLES) — VISUAL E PREÇO ══════ */}
            {/* Ou STEP 4 quando variações (visual + preço só de fotos) */}
            {(((wizardStep === 4 || wizardStep === 5) && !form.id) || (form.id && (editTab === "fotos" || editTab === "preco"))) && (
            <div className="prod-modal-body">

              {/* Título e subtítulo (mesmo padrão dos steps 3 e 4) */}
              {wizardStep === 5 && !form.id && (
                <div className="prod-step-header">
                  <div className="prod-step-title">Fotos e finalização</div>
                  <div className="prod-step-sub">
                    Adicione fotos que valorizam seu produto. Define modo de entrega e pronto. Já vai pro cardápio.
                  </div>
                </div>
              )}

              {/* Fotos — só em step 5 (Fotos e finalização) ou tab Fotos na edição */}
              {((wizardStep === 5 && !form.id) || (form.id && editTab === "fotos")) && (
              <>
              <div className="prod-section">
                <p className="prod-section-label prod-section-label--novo">Fotos do Produto</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  {[0, 1, 2].map(slot => {
                    const imgs = (form.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
                    const imgUrl = imgs[slot];
                    const isLocked = slot > 0 && !isPro;
                    const ref = slot === 0 ? imgRef : slot === 1 ? img2Ref : img3Ref;
                    // Foto principal: rosa. Extras (2 e 3) free: cinza claro. Locked (PRO): grafite Doonly.
                    const bgExtra = "#F1EEF0";
                    const borderExtra = "2px dashed #D8D1D5";
                    return (
                      <div key={slot} style={{ position: "relative" }}>
                        {slot > 0 && <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 700, display: "block", marginBottom: "6px", textAlign: "center" }}>Foto {slot + 1}</span>}
                        {slot === 0 && <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 700, display: "block", marginBottom: "6px", textAlign: "center" }}>Principal</span>}
                        <div
                          className={`prod-img-upload ${isLocked ? "prod-img-upload--locked" : ""}`}
                          onClick={() => {
                            if (isLocked) { setShowProFotosModal(true); return; }
                            if (!uploading) ref.current?.click();
                          }}
                          style={{
                            width: "100%",
                            height: "130px",
                            borderRadius: "14px",
                            cursor: "pointer",
                            position: "relative",
                            overflow: "hidden",
                            background: isLocked ? "linear-gradient(135deg, #2C1219 0%, #4A1F2D 100%)" : (slot > 0 ? bgExtra : undefined),
                            border: isLocked ? "none" : (slot > 0 ? borderExtra : undefined),
                            boxShadow: isLocked ? "0 4px 16px rgba(44,18,25,0.25)" : undefined,
                          }}
                        >
                          {imgUrl ? (
                            <>
                              <img src={imgUrl} alt={`foto ${slot + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              {!isLocked && <button className="prod-img-remove" onClick={e => { e.stopPropagation(); removeImage(slot); }}>✕</button>}
                            </>
                          ) : isLocked ? (
                            <>
                              {/* Tag PRO padrão Doonly no canto */}
                              <span className="prod-slot-pro-tag">
                                <img src="/coroa.png" alt="" className="coroa-badge" />
                                PRO
                              </span>
                              {/* Conteúdo central: cadeado rosa + texto */}
                              <div className="prod-slot-locked-body">
                                <div className="prod-slot-lock-circle">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E85A8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                  </svg>
                                </div>
                                <span className="prod-slot-lock-txt">
                                  <span className="prod-slot-lock-txt-rgb">Exclusivo</span> PRO
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="prod-img-placeholder">
                              {uploading ? <span className="prod-spinner" /> : (
                                <>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={slot === 0 ? "#818cf8" : "#9A8B93"} strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                  {slot === 0 && <span className="prod-img-cta">Selecionar</span>}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e, slot)} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fotos por opção (V3 unificado — PRO) */}
              {(() => {
                // Lista todos os grupos ativos com opções (pra oferecer o toggle)
                const gruposAtivos: Array<{ key: string; label: string; grupo: any }> = [];
                if (form.grupo_massas?.ativo && (form.grupo_massas.opcoes.length || 0) > 0) {
                  gruposAtivos.push({ key: "massas", label: "Massas", grupo: form.grupo_massas });
                }
                if (form.grupo_recheios?.ativo && (form.grupo_recheios.opcoes.length || 0) > 0) {
                  gruposAtivos.push({ key: "recheios", label: "Recheios", grupo: form.grupo_recheios });
                }
                if (form.grupo_coberturas?.ativo && (form.grupo_coberturas.opcoes.length || 0) > 0) {
                  gruposAtivos.push({ key: "coberturas", label: "Coberturas", grupo: form.grupo_coberturas });
                }
                if (form.grupo_sabores?.ativo && (form.grupo_sabores.opcoes.length || 0) > 0) {
                  gruposAtivos.push({ key: "sabores", label: "Sabores", grupo: form.grupo_sabores });
                }
                if (form.grupo_tamanhos?.ativo && (form.grupo_tamanhos.opcoes.length || 0) > 0) {
                  gruposAtivos.push({ key: "tamanhos", label: form.grupo_tamanhos.nome_exibicao || "Tamanhos", grupo: form.grupo_tamanhos });
                }
                if (gruposAtivos.length === 0) return null;

                const toggleFotoPorOpcao = (grupoKey: string, atual: any) => {
                  if (!isPro) {
                    setShowProFotosModal(true);
                    return;
                  }
                  const key = `grupo_${grupoKey}` as keyof Produto;
                  setForm(f => ({ ...f, [key]: { ...(f[key] as any), foto_por_opcao: !atual.foto_por_opcao } }));
                };

                const uploadOpcaoFoto = async (grupoKey: string, opcaoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const { data: userData } = await supabase.auth.getUser();
                  if (!userData.user) return;
                  const ext = file.name.split(".").pop();
                  const path = `${userData.user.id}/produto-opcao-${opcaoId}-${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage.from("produtos").upload(path, file, { upsert: true });
                  if (upErr) { alert("Erro ao enviar foto: " + upErr.message); return; }
                  const { data: pub } = supabase.storage.from("produtos").getPublicUrl(path);
                  const campo = `grupo_${grupoKey}` as keyof Produto;
                  setForm(f => ({
                    ...f,
                    [campo]: {
                      ...(f[campo] as any),
                      opcoes: (f[campo] as any).opcoes.map((o: any) => o.id === opcaoId ? { ...o, foto: pub.publicUrl } : o),
                    },
                  }));
                };

                const removeOpcaoFoto = (grupoKey: string, opcaoId: string) => {
                  const campo = `grupo_${grupoKey}` as keyof Produto;
                  setForm(f => ({
                    ...f,
                    [campo]: {
                      ...(f[campo] as any),
                      opcoes: (f[campo] as any).opcoes.map((o: any) => o.id === opcaoId ? { ...o, foto: undefined } : o),
                    },
                  }));
                };

                return (
                  <div className="prod-section">
                    <p className="prod-section-label prod-section-label--novo">
                      Fotos por opção
                      {!isPro && <img src="/coroa.png" alt="PRO" style={{width: 12, height: 12, objectFit: "contain", marginLeft: 6, verticalAlign: "middle"}} />}
                    </p>
                    <p style={{fontSize: 12, color: "#6B5D64", margin: "0 0 14px"}}>
                      Ative pra ter uma foto de cada opção. Cliente verá a foto ao escolher no cardápio.
                    </p>

                    {gruposAtivos.map(({ key, label, grupo }) => (
                      <div key={key} style={{marginBottom: 14}}>
                        <button
                          type="button"
                          className={`pv3-sub-toggle ${grupo.foto_por_opcao ? "pv3-sub-toggle--on" : ""}`}
                          onClick={() => toggleFotoPorOpcao(key, grupo)}
                        >
                          <div className="pv3-sub-toggle-ico">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          </div>
                          <div className="pv3-sub-toggle-txt">
                            <div className="pv3-sub-toggle-titulo">
                              Foto por {label.toLowerCase().slice(0, -1)}
                              {!isPro && <img src="/coroa.png" alt="PRO" className="pv3-sub-toggle-crown" style={{width: 14, height: 14, objectFit: "contain"}} />}
                            </div>
                            <div className="pv3-sub-toggle-desc">
                              {grupo.foto_por_opcao ? "✓ Ativo — adicione as fotos abaixo" : `${grupo.opcoes.length} opções cadastradas`}
                            </div>
                          </div>
                          <div className={`pv3-mini-switch ${grupo.foto_por_opcao ? "pv3-mini-switch--on" : ""}`}>
                            <div className="pv3-mini-switch-thumb" />
                          </div>
                        </button>

                        {/* Lista horizontal: cada opção com quadradinho de foto à esquerda */}
                        {grupo.foto_por_opcao && isPro && (
                          <div style={{marginTop: 10, display: "flex", flexDirection: "column", gap: 8}}>
                            {grupo.opcoes.map((op: any) => (
                              <label key={op.id} className="prod-opcao-foto-linha">
                                <div className="prod-opcao-foto-mini">
                                  {op.foto ? (
                                    <>
                                      <img src={op.foto} alt={op.nome} />
                                      <button
                                        type="button"
                                        className="prod-opcao-foto-mini-remove"
                                        onClick={e => { e.preventDefault(); removeOpcaoFoto(key, op.id); }}
                                        aria-label="Remover"
                                      >✕</button>
                                    </>
                                  ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B4A9AE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                  )}
                                </div>
                                <span className="prod-opcao-foto-linha-nome">{op.nome}</span>
                                <span className="prod-opcao-foto-linha-cta">
                                  {op.foto ? "Trocar foto" : "Adicionar foto"}
                                </span>
                                <input type="file" accept="image/*" style={{display: "none"}} onChange={e => uploadOpcaoFoto(key, op.id, e)} />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Fotos das variações — só quando variações */}
              {wizardTipo === "variacoes" && (() => {
                const sabores = form.recheios_disponiveis || [];
                const tamanhos = form.tamanhos_disponiveis || [];
                // Determina o modo pelo que tem
                const temSabores = sabores.length > 0;
                const temTamanhos = tamanhos.length > 0;
                if (!temSabores && !temTamanhos) return null;

                // Monta lista de variações com suas chaves
                const variacoes: { key: string; label: string }[] = [];
                if (temSabores && temTamanhos) {
                  // Combinações
                  sabores.forEach(s => tamanhos.forEach(t => {
                    variacoes.push({ key: `${s}|${t.label}`, label: `${s} × ${t.label}` });
                  }));
                } else if (temSabores) {
                  sabores.forEach(s => variacoes.push({ key: `${s}|`, label: s }));
                } else {
                  tamanhos.forEach(t => variacoes.push({ key: `|${t.label}`, label: t.label }));
                }

                const fotos = form.fotos_variacoes || {};

                return (
                  <div className="prod-section">
                    <p className="prod-section-label prod-section-label--novo">
                      Fotos das variações <span style={{fontSize: 11, fontWeight: 500, color: "#6B5D64", marginLeft: 6}}>(opcional)</span>
                    </p>
                    <p style={{fontSize: 12, color: "#6B5D64", margin: "0 0 12px"}}>
                      Adicione uma foto pra cada variação (mostrada no cardápio quando o cliente escolher).
                    </p>

                    {!isPro ? (
                      <div className="prod-var-fotos-lock">
                        <img src="/log.png" alt="Doonly" className="prod-var-fotos-lock-logo" />
                        <div>
                          <div style={{fontSize: 13, fontWeight: 700, color: "#2D1F26", display: "inline-flex", alignItems: "center", gap: 6}}>
                            Recurso PRO
                            <img src="/coroa.png" alt="" style={{width: 14, height: 14, objectFit: "contain"}} />
                          </div>
                          <div style={{fontSize: 12, color: "#6B5D64", marginTop: 2}}>Fotos personalizadas por variação — venda muito mais com fotos que valorizam cada opção.</div>
                        </div>
                      </div>
                    ) : (
                      <div className="prod-var-fotos-lista">
                        {variacoes.map(({ key, label }) => (
                          <div key={key} className="prod-var-foto-row">
                            <div className="prod-var-foto-thumb">
                              {fotos[key] ? (
                                <>
                                  <img src={fotos[key]} alt={label} />
                                  <button type="button" className="prod-var-foto-remove" onClick={() => removeFotoVariacaoKey(key)} aria-label="Remover">✕</button>
                                </>
                              ) : (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B4A9AE" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                              )}
                            </div>
                            <div className="prod-var-foto-label">{label}</div>
                            <label className="prod-var-foto-btn">
                              {fotos[key] ? "Trocar" : "Adicionar"}
                              <input type="file" accept="image/*" style={{display: "none"}} onChange={e => uploadFotoVariacaoKey(e, key)} />
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              </>
              )}

              {/* Preços por Tamanho — só se tem tamanhos ativos */}
              {((wizardStep === 4 && !form.id) || (form.id && editTab === "preco")) && form.grupo_tamanhos?.ativo && (form.grupo_tamanhos.opcoes.length || 0) > 0 && form.grupo_tamanhos.modo_preco_tamanho !== "sob_consulta" && form.grupo_tamanhos.modo_preco_tamanho !== "por_peso" && (
                <div className="prod-section">
                  <p className="prod-section-label prod-section-label--novo">
                    Preço por {(form.grupo_tamanhos.nome_exibicao || "Tamanhos").toLowerCase().slice(0, -1)} <ReqTag />
                  </p>
                  <p style={{fontSize: 12, color: "#6B5D64", margin: "0 0 12px"}}>
                    Defina o preço de cada opção. O menor vira o "a partir de" no cardápio.
                  </p>
                  <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                    {form.grupo_tamanhos.opcoes.map((op) => (
                      <div key={op.id} style={{display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#FAF8F5", border: "1px solid #F0EBED", borderRadius: 10}}>
                        <span style={{flex: 1, fontSize: 14, fontWeight: 700, color: "#2D1F26"}}>{op.nome}</span>
                        <div style={{display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1.5px solid #E85A8C", borderRadius: 8, padding: "6px 12px"}}>
                          <span style={{fontSize: 13, color: "#831843", fontWeight: 700}}>R$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatPreco(op.preco)}
                            onChange={e => {
                              const preco = parsePreco(e.target.value);
                              setForm(f => ({
                                ...f,
                                grupo_tamanhos: {
                                  ...(f.grupo_tamanhos || GRUPO_TAMANHOS_VAZIO),
                                  opcoes: (f.grupo_tamanhos?.opcoes || []).map(o => o.id === op.id ? { ...o, preco } : o),
                                },
                              }));
                            }}
                            placeholder="0,00"
                            style={{width: 80, border: "none", outline: "none", background: "transparent", fontSize: 15, fontWeight: 700, color: "#E85A8C", textAlign: "right", fontFamily: "inherit"}}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preços por Sabor — só se tem sabores ativos E sabor_tem_preco_proprio */}
              {((wizardStep === 4 && !form.id) || (form.id && editTab === "preco")) && form.grupo_sabores?.ativo && (form.grupo_sabores.opcoes.length || 0) > 0 && form.grupo_sabores.sabor_tem_preco_proprio && (
                <div className="prod-section">
                  <p className="prod-section-label prod-section-label--novo">
                    Preço por sabor <ReqTag />
                  </p>
                  <p style={{fontSize: 12, color: "#6B5D64", margin: "0 0 12px"}}>
                    Defina o preço de cada sabor. Ex: Pudim de Chocolate R$ 45.
                  </p>
                  <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                    {form.grupo_sabores.opcoes.map((op: any) => (
                      <div key={op.id} style={{display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#FAF8F5", border: "1px solid #F0EBED", borderRadius: 10}}>
                        <span style={{flex: 1, fontSize: 14, fontWeight: 700, color: "#2D1F26"}}>{op.nome}</span>
                        <div style={{display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1.5px solid #E85A8C", borderRadius: 8, padding: "6px 12px"}}>
                          <span style={{fontSize: 13, color: "#831843", fontWeight: 700}}>R$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={op.preco ? formatPreco(op.preco) : ""}
                            onChange={e => {
                              const preco = parsePreco(e.target.value);
                              setForm(f => ({
                                ...f,
                                grupo_sabores: {
                                  ...(f.grupo_sabores as GrupoSabores),
                                  opcoes: (f.grupo_sabores?.opcoes || []).map((o: any) => o.id === op.id ? { ...o, preco } : o),
                                },
                              }));
                            }}
                            placeholder="0,00"
                            style={{width: 80, border: "none", outline: "none", background: "transparent", fontSize: 15, fontWeight: 700, color: "#E85A8C", textAlign: "right", fontFamily: "inherit"}}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Título e subtítulo (mesmo estilo do step 3) */}
              {wizardStep === 4 && !form.id && (
                <div className="prod-step-header">
                  <div className="prod-step-title">Preço e venda</div>
                  <div className="prod-step-sub">
                    Define quanto seu produto vai custar. Preço cheio, promoção, extras. Simples e direto.
                  </div>
                </div>
              )}

              {/* ══════ SEÇÃO 1: Preço base + Forma de venda ══════ */}
              {/* Aparece quando: (a) não tem tamanho, OU (b) modo é por_peso (precisa do R$/kg) */}
              {((wizardStep === 4 && !form.id) || (form.id && editTab === "preco")) && (
                !(form.grupo_tamanhos?.ativo && (form.grupo_tamanhos.opcoes.length || 0) > 0) ||
                form.grupo_tamanhos?.modo_preco_tamanho === "por_peso"
              ) && (
                <div className="prod-section">
                  <p className="prod-section-label prod-section-label--novo">
                    {form.grupo_tamanhos?.modo_preco_tamanho === "por_peso" ? "Preço por kg" : "Preço base"} <ReqTag />
                  </p>
                  {form.grupo_tamanhos?.modo_preco_tamanho === "por_peso" && (
                    <p style={{margin:"0 0 10px", fontSize:12.5, color:"#6B5D64", lineHeight:1.5}}>
                      Define o preço de <b>1 kg</b>. Cada tamanho vai ser calculado automaticamente: <b>peso × preço</b>.
                    </p>
                  )}
                  <div className="prod-row-2">
                    <div className="prod-field">
                      <label>Preço cheio</label>
                      <div className="prod-preco-input prod-preco-input--big">
                        <span>R$</span>
                        <input type="text" placeholder="0,00" value={form.preco_normal ? formatPreco(form.preco_normal) : ""} onChange={e => setForm(f => ({ ...f, preco_normal: parsePreco(e.target.value) }))} />
                      </div>
                    </div>
                    <div className="prod-field">
                      <label>Preço promocional <span className="prod-field-hint">(opcional)</span></label>
                      <div className="prod-preco-input prod-preco-input--big prod-preco-input--promo">
                        <span>R$</span>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={form.preco_promocional && form.preco_promocional > 0 ? formatPreco(form.preco_promocional) : ""}
                          onChange={e => {
                            const v = parsePreco(e.target.value);
                            setForm(f => ({ ...f, preco_promocional: v, promocao: v > 0 && v < f.preco_normal, tipo_promocao: 'fixo' }));
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview do preço no cardápio */}
                  {form.preco_normal > 0 && form.preco_promocional && form.preco_promocional > 0 && form.preco_promocional < form.preco_normal && (() => {
                    // Sufixo vem do "Vendido por" — é a fonte de verdade da unidade
                    const sufixoMap: Record<string, string> = {
                      kg: "/kg", fatia: "/fatia", cento: "/cento", caixa: "/cx",
                    };
                    const sufixo = sufixoMap[form.forma_venda] || "";
                    return (
                      <div className="prod-promo-preview">
                        <span className="prod-promo-preview-label">Cliente verá no cardápio</span>
                        <div className="prod-promo-preview-precos">
                          <span className="prod-promo-preview-riscado">R$ {formatPreco(form.preco_normal)}</span>
                          <span className="prod-promo-preview-final">
                            R$ {formatPreco(form.preco_promocional)}
                            {sufixo && <span className="prod-promo-preview-sufixo">{sufixo}</span>}
                          </span>
                          <span className="prod-promo-preview-desconto">
                            -{Math.round((1 - form.preco_promocional / form.preco_normal) * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="prod-field" style={{marginTop: 14}}>
                    <label>Vendido por</label>
                    <SelectDoonly
                      value={form.forma_venda}
                      onChange={v => setForm(f => ({ ...f, forma_venda: v }))}
                      options={FORMAS_VENDA.map(fv => ({ value: fv.value, label: fv.label }))}
                      title="Como esse produto é vendido?"
                      big
                    />
                  </div>
                </div>
              )}

              {/* ══════ SEÇÃO 2: Adicionais das opções ══════ */}
              {((wizardStep === 4 && !form.id) || (form.id && editTab === "preco")) && (() => {
                const gruposComOpcoes = [
                  { key: "massas", label: "Massas", grupo: form.grupo_massas },
                  { key: "recheios", label: "Recheios", grupo: form.grupo_recheios },
                  { key: "coberturas", label: "Coberturas", grupo: form.grupo_coberturas },
                  { key: "sabores", label: "Sabores", grupo: form.grupo_sabores },
                ].filter(g => {
                  // Grupo precisa estar ativo com opções
                  if (!g.grupo?.ativo || (g.grupo.opcoes.length || 0) === 0) return false;
                  // Se sabor tem preço próprio, NÃO aparece em "Adicionais das opções"
                  // (já é tratado em "Preço por sabor" logo acima)
                  if (g.key === "sabores" && (g.grupo as GrupoSabores).sabor_tem_preco_proprio) return false;
                  return true;
                });
                if (gruposComOpcoes.length === 0) return null;

                return (
                  <div className="prod-section">
                    <p className="prod-section-label prod-section-label--novo">Adicionais das opções <span className="prod-field-req prod-field-req--opt">opcional</span></p>
                    <p style={{fontSize: 12, color: "#6B5D64", margin: "0 0 12px"}}>
                      Deixe R$ 0,00 se a opção não custa a mais. Ex: "Ninho +R$ 5" cobra extra pelo recheio.
                    </p>

                    {gruposComOpcoes.map(({ key, label, grupo }) => (
                      <div key={key} style={{marginBottom: 16}}>
                        <div style={{fontSize: 12, fontWeight: 700, color: "#831843", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8}}>{label}</div>
                        <div style={{display: "flex", flexDirection: "column", gap: 6}}>
                          {grupo!.opcoes.map(op => (
                            <div key={op.id} style={{display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#FAF8F5", border: "1px solid #F0EBED", borderRadius: 10}}>
                              <span style={{flex: 1, fontSize: 13.5, fontWeight: 700, color: "#2D1F26"}}>{op.nome}</span>
                              <div style={{display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", border: "1.5px solid #E5D8DE", borderRadius: 8, padding: "6px 10px"}}>
                                <span style={{fontSize: 12, color: "#6B5D64", fontWeight: 700}}>+ R$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={op.adicional > 0 ? formatPreco(op.adicional) : "0,00"}
                                  onChange={e => {
                                    const adicional = parsePreco(e.target.value);
                                    const campo = `grupo_${key}` as keyof Produto;
                                    setForm(f => ({
                                      ...f,
                                      [campo]: {
                                        ...(f[campo] as any),
                                        opcoes: (f[campo] as any).opcoes.map((o: any) => o.id === op.id ? { ...o, adicional } : o),
                                      },
                                    }));
                                  }}
                                  style={{width: 60, border: "none", outline: "none", background: "transparent", fontSize: 13.5, fontWeight: 700, color: op.adicional > 0 ? "#E85A8C" : "#9A8B93", textAlign: "right", fontFamily: "inherit"}}
                                />
                              </div>
                              {/* Mini-badge tipo_adicional — só quando adicional > 0. Por enquanto só "Fixo" (motor suporta 4, UI libera quando cardápio V3 estiver pronto) */}
                              {op.adicional > 0 && (
                                <span
                                  title="Tipo de cobrança: soma uma vez no pedido"
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: "#6B5D64",
                                    background: "#F0EBED",
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    letterSpacing: "0.02em",
                                    textTransform: "uppercase",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Fixo
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ══════ SEÇÃO 3: Regra de conflito Sabor × Tamanho ══════
                  Aparece SÓ quando há conflito real de preço (Passo 4) */}
              {((wizardStep === 4 && !form.id) || (form.id && editTab === "preco")) && (() => {
                const gs = form.grupo_sabores;
                const gt = form.grupo_tamanhos;
                const conflito = existeConflitoSaborTamanho({
                  sabor_ativo: !!gs?.ativo,
                  sabor_tem_preco_proprio: !!gs?.sabor_tem_preco_proprio,
                  sabor_tem_opcao_com_preco: !!gs?.opcoes?.some((o: any) => (o.preco || 0) > 0),
                  tamanho_ativo: !!gt?.ativo,
                  tamanho_tem_opcao_com_preco: !!gt?.opcoes?.some(o => (o.preco || 0) > 0),
                });
                if (!conflito) return null;

                const regraAtual = (gs?.regra_conflito_tamanho || REGRA_CONFLITO_DEFAULT) as RegraConflitoTamanho;
                const setRegra = (nova: RegraConflitoTamanho) => {
                  setForm(f => ({
                    ...f,
                    grupo_sabores: { ...(f.grupo_sabores as GrupoSabores), regra_conflito_tamanho: nova },
                  }));
                };

                return (
                  <div className="prod-section">
                    <div style={{
                      background: "linear-gradient(135deg, #FEF3C7 0%, #FEF9E7 100%)",
                      border: "1.5px solid #FCD34D",
                      borderRadius: 12,
                      padding: 16,
                    }}>
                      <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <div style={{fontSize: 12, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.05em"}}>
                          Conflito de preço detectado
                        </div>
                      </div>
                      <div style={{fontSize: 13.5, fontWeight: 700, color: "#2D1F26", marginBottom: 4}}>
                        Sabor e Tamanho estão com preço próprio
                      </div>
                      <div style={{fontSize: 12.5, color: "#6B5D64", marginBottom: 14, lineHeight: 1.4}}>
                        Como o preço deve ser calculado quando o cliente escolher ambos?
                      </div>
                      <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                        {(["preco_tamanho", "preco_sabor", "tamanho_base_sabor_adicional"] as RegraConflitoTamanho[]).map(regra => {
                          const ativo = regraAtual === regra;
                          return (
                            <label
                              key={regra}
                              style={{
                                display: "flex",
                                gap: 10,
                                padding: 12,
                                background: ativo ? "#fff" : "rgba(255,255,255,0.5)",
                                border: `1.5px solid ${ativo ? "#E85A8C" : "#E5D8DE"}`,
                                borderRadius: 10,
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              <input
                                type="radio"
                                name="regra_conflito_st"
                                checked={ativo}
                                onChange={() => setRegra(regra)}
                                style={{marginTop: 2, accentColor: "#E85A8C"}}
                              />
                              <div style={{flex: 1}}>
                                <div style={{fontSize: 13.5, fontWeight: 700, color: "#2D1F26"}}>
                                  {REGRA_CONFLITO_LABEL[regra]}
                                </div>
                                <div style={{fontSize: 12, color: "#6B5D64", marginTop: 2, lineHeight: 1.35}}>
                                  {REGRA_CONFLITO_HINT[regra]}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}


              {/* Kit Festa */}
              {form.forma_venda === "kit-festa" && (
                <div className="prod-section">
                  <p className="prod-section-label">Itens do Kit</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0" }}>Adicione cada item que estará incluso no kit festa</p>

                  {(form.kit_itens || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--primary-light)", borderRadius: "10px", marginBottom: "6px", border: "1px solid var(--primary-light)" }}>
                      <div>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{item.nome}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--primary)", marginLeft: "8px", fontWeight: 600 }}>× {item.quantidade}</span>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, kit_itens: (f.kit_itens || []).filter((_, idx) => idx !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: "1.1rem", padding: 0 }}>×</button>
                    </div>
                  ))}

                  <div className="prod-field" style={{ marginTop: "4px" }}>
                    <label>Nome do item</label>
                    <input type="text" placeholder="Ex: Bolo, Brigadeiros, Cupcakes..." value={novoKitItem.nome} onChange={e => setNovoKitItem(k => ({ ...k, nome: e.target.value }))} onKeyDown={e => e.key === "Enter" && (() => { if (!novoKitItem.nome.trim()) return; setForm(f => ({ ...f, kit_itens: [...(f.kit_itens || []), { nome: novoKitItem.nome.trim(), quantidade: novoKitItem.quantidade || "1" }] })); setNovoKitItem({ nome: "", quantidade: "" }); })()} />
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    <div className="prod-field" style={{ flex: 1 }}>
                      <label>Quantidade</label>
                      <input type="text" placeholder="Ex: 1 unidade, 30 pçs..." value={novoKitItem.quantidade} onChange={e => setNovoKitItem(k => ({ ...k, quantidade: e.target.value }))} />
                    </div>
                    <button onClick={() => {
                      if (!novoKitItem.nome.trim()) return;
                      setForm(f => ({ ...f, kit_itens: [...(f.kit_itens || []), { nome: novoKitItem.nome.trim(), quantidade: novoKitItem.quantidade || "1" }] }));
                      setNovoKitItem({ nome: "", quantidade: "" });
                    }} style={{ padding: "0.65rem 1rem", background: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "10px", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginBottom: "1px" }}>+ Adicionar</button>
                  </div>

                  <div className="prod-field">
                    <label>Serve quantas pessoas</label>
                    <input type="text" placeholder="Ex: 20 a 30 pessoas" value={form.kit_serve_pessoas || ""} onChange={e => setForm(f => ({ ...f, kit_serve_pessoas: e.target.value }))} />
                  </div>
                  <div className="prod-field">
                    <label>Prazo mínimo de encomenda</label>
                    <input type="text" placeholder="Ex: 5 dias de antecedência" value={form.kit_prazo_encomenda || ""} onChange={e => setForm(f => ({ ...f, kit_prazo_encomenda: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* [Removido V3] Bloco "Personalização" legado + Zero Açúcar
                  A etapa 2 (Opções do produto) já cobre toda personalização.
                  Restrições alimentares (sem açúcar/glúten/lactose/vegano)
                  virão na Fase 2 futura como chips. */}

              {/* ══════ Extras pagos (V3) — DESATIVADO temporariamente
                  Vai virar seção exclusiva de "Complementos" (já existe página /complementos)
                  Integração no cadastro de produto será feita em fase futura. ══════ */}
              {false && ((wizardStep === 4 && !form.id) || (form.id && editTab === "preco")) && (
              <>

              {/* Adicionais */}
              <div className="prod-section">
                <p className="prod-section-label prod-section-label--novo">Extras pagos</p>
                <Toggle label="Oferecer extras" value={form.tem_adicionais || false} onChange={(v: boolean) => setForm(f => ({ ...f, tem_adicionais: v }))} colorClass="active-pink" />

                {form.tem_adicionais && (
                  <>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0" }}>Itens extras que o cliente pode adicionar (vela, topo, embalagem…)</p>

                    {/* Sugestões da biblioteca */}
                    {sugestoesBiblioteca.length > 0 && (
                      <div className="prod-sugestoes">
                        <p className="prod-sugestoes-lbl">💡 Da sua biblioteca:</p>
                        <div className="prod-sugestoes-chips">
                          {sugestoesBiblioteca.map(b => (
                            <button
                              key={b.id}
                              type="button"
                              className="prod-sug-chip"
                              onClick={() => {
                                setForm(f => ({
                                  ...f,
                                  adicionais: [...(f.adicionais || []), { nome: b.nome, valor: b.valor, from_biblioteca: b.id }]
                                }));
                              }}
                            >
                              + {b.nome} · R$ {formatPreco(b.valor)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lista de adicionais deste produto */}
                    {(form.adicionais || []).length > 0 && (
                      <div className="prod-adic-lista">
                        {(form.adicionais || []).map((a, i) => (
                          <div key={i} className="prod-adic-item">
                            <div className="prod-adic-item-info">
                              <span className="prod-adic-nome">{a.nome}</span>
                              <span className="prod-adic-valor">+ R$ {formatPreco(a.valor)}</span>
                              {a.from_biblioteca && <span className="prod-adic-tag">📚</span>}
                            </div>
                            <button
                              type="button"
                              className="prod-adic-remove"
                              onClick={() => setForm(f => ({ ...f, adicionais: (f.adicionais || []).filter((_, idx) => idx !== i) }))}
                              aria-label="Remover"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Form pra adicionar novo */}
                    <div className="prod-adic-add">
                      <input
                        type="text"
                        placeholder="Ex: Vela decorativa"
                        value={novoAdicional.nome}
                        onChange={e => setNovoAdicional(a => ({ ...a, nome: e.target.value }))}
                        className="prod-add-input"
                        style={{ flex: 1.5, minWidth: 0 }}
                      />
                      <div className="prod-preco-input" style={{ flex: 1.1, minWidth: "110px", background: "var(--bg-card)" }}>
                        <span>R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={novoAdicional.valor ? formatPreco(parsePreco(novoAdicional.valor)) : novoAdicional.valor}
                          onChange={e => {
                            const raw = e.target.value;
                            // Se está vazio, deixa vazio (permite apagar)
                            if (!raw) { setNovoAdicional(a => ({ ...a, valor: "" })); return; }
                            // Aplica a máscara: converte pra número e formata BRL
                            const numero = parsePreco(raw);
                            setNovoAdicional(a => ({ ...a, valor: numero ? formatPreco(numero) : raw }));
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="prod-btn-3d"
                        onClick={() => {
                          const nome = novoAdicional.nome.trim();
                          const valor = parsePreco(novoAdicional.valor);
                          if (!nome) return;
                          const novoIndex = (form.adicionais || []).length;
                          setForm(f => ({ ...f, adicionais: [...(f.adicionais || []), { nome, valor }] }));
                          setNovoAdicional({ nome: "", valor: "" });
                          // Pergunta se quer salvar na biblioteca
                          setSalvarBibliotecaAsk({ nome, valor, index: novoIndex });
                        }}
                        disabled={!novoAdicional.nome.trim()}
                      >Adicionar</button>
                    </div>
                  </>
                )}
              </div>

              {/* Promoção — DESATIVADA: agora está inline no bloco "Preço cheio / Preço promocional" acima */}
              {false && ((wizardStep === 4 && !form.id) || (form.id && editTab === "preco")) && (
              <div className="prod-section">
                <p className="prod-section-label">Promoção</p>
                <Toggle label="Produto em promoção" value={form.promocao} onChange={(v: boolean) => setForm(f => ({ ...f, promocao: v }))} colorClass="active-pink" />

                {form.promocao && (
                  <>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => setForm(f => ({ ...f, tipo_promocao: 'fixo' }))}
                        style={{ flex: 1, padding: "8px", borderRadius: "10px", border: `2px solid ${form.tipo_promocao !== 'percentual' ? 'var(--primary)' : 'var(--border)'}`, background: form.tipo_promocao !== 'percentual' ? 'var(--primary-light)' : 'var(--bg-card)', fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, color: form.tipo_promocao !== 'percentual' ? 'var(--primary)' : 'var(--text-secondary)', cursor: "pointer" }}
                      >
                        💰 Preço fixo
                      </button>
                      <button
                        onClick={() => setForm(f => ({ ...f, tipo_promocao: 'percentual' }))}
                        style={{ flex: 1, padding: "8px", borderRadius: "10px", border: `2px solid ${form.tipo_promocao === 'percentual' ? 'var(--primary)' : 'var(--border)'}`, background: form.tipo_promocao === 'percentual' ? 'var(--primary-light)' : 'var(--bg-card)', fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, color: form.tipo_promocao === 'percentual' ? 'var(--primary)' : 'var(--text-secondary)', cursor: "pointer" }}
                      >
                        % Desconto
                      </button>
                    </div>

                    {form.tipo_promocao === 'percentual' ? (
                      <div className="prod-field">
                        <label>Percentual de desconto</label>
                        <div className="prod-preco-input">
                          <span style={{ color: "var(--primary)" }}>%</span>
                          <input
                            type="text"
                            placeholder="Ex: 10, 20, 50..."
                            value={form.desconto_percentual || ""}
                            onChange={e => {
                              const v = e.target.value.replace(/[^0-9]/g, "");
                              const num = Math.min(100, parseInt(v) || 0);
                              setForm(f => ({ ...f, desconto_percentual: num, preco_promocional: num > 0 ? parseFloat((f.preco_normal * (1 - num / 100)).toFixed(2)) : 0 }));
                            }}
                          />
                        </div>
                        {form.desconto_percentual > 0 && form.preco_normal > 0 && (
                          <div style={{ marginTop: "6px", padding: "8px 12px", background: "#dcfce7", borderRadius: "8px" }}>
                            <p style={{ fontSize: "0.78rem", color: "var(--success)", fontWeight: 600, margin: 0 }}>
                              Preço base: R$ {formatPreco(form.preco_normal)} → R$ {formatPreco(form.preco_normal * (1 - (form.desconto_percentual || 0) / 100))}
                            </p>
                            {(form.tamanhos_disponiveis || []).length > 0 && (
                              <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                {(form.tamanhos_disponiveis || []).map((t, i) => (
                                  <p key={i} style={{ fontSize: "0.72rem", color: "var(--success)", margin: 0 }}>
                                    {t.label}: R$ {formatPreco(t.preco)} → R$ {formatPreco(t.preco * (1 - (form.desconto_percentual || 0) / 100))}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="prod-field">
                        <label>Preço promocional</label>
                        <div className="prod-preco-input">
                          <span>R$</span>
                          <input type="text" placeholder="0,00" value={form.preco_promocional ? formatPreco(form.preco_promocional) : ""} onChange={e => setForm(f => ({ ...f, preco_promocional: parsePreco(e.target.value) }))} />
                        </div>
                        {form.preco_normal > 0 && form.preco_promocional > 0 && (
                          <p style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600, margin: "4px 0 0" }}>
                            Desconto de {Math.round((1 - form.preco_promocional / form.preco_normal) * 100)}%
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              )}

            </>
            )}

              {/* Status — só em step 5 (Fotos) ou tab Fotos na edição */}
              {((wizardStep === 5 && !form.id) || (form.id && editTab === "fotos")) && (
              <div className="prod-section">
                <p className="prod-section-label">Modo de entrega</p>
                <div className="prod-toggles prod-toggles--clean" style={{ flexDirection: "column", gap: "0.25rem" }}>
                  <Toggle
                    label="Pronta entrega"
                    value={form.pronta_entrega === true}
                    onChange={(v: boolean) => setForm(f => ({ ...(f as any), pronta_entrega: v ? true : undefined, antecedencia: v ? undefined : (f as any).antecedencia }))}
                    colorClass="active-green"
                  />
                  <Toggle
                    label="Necessário agendar com antecedência"
                    value={!!(form as any).antecedencia}
                    onChange={(v: boolean) => setForm(f => ({ ...(f as any), antecedencia: v ? "48h" : undefined, pronta_entrega: v ? false : (f as any).pronta_entrega }))}
                    colorClass="active-pink"
                  />
                </div>

                {/* Chips de dias — só se ativou "Necessário agendar" */}
                {!!(form as any).antecedencia && (
                  <div className="prod-field" style={{marginTop: 12}}>
                    <label>Quantos dias antes?</label>
                    <div className="prod-antecedencia-grid">
                      {[
                        { valor: "24h", label: "24 horas" },
                        { valor: "48h", label: "48 horas" },
                        { valor: "3d", label: "3 dias" },
                        { valor: "5d", label: "5 dias" },
                        { valor: "7d", label: "1 semana" },
                        { valor: "15d", label: "15 dias" },
                      ].map(opt => {
                        const ativo = (form as any).antecedencia === opt.valor;
                        return (
                          <button
                            key={opt.valor}
                            type="button"
                            className={`prod-antecedencia-chip ${ativo ? "prod-antecedencia-chip--on" : ""}`}
                            onClick={() => setForm(f => ({ ...(f as any), antecedencia: opt.valor }))}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{margin:"8px 0 0", fontSize:11.5, color:"#6B5D64"}}>Cliente verá no cardápio quantos dias antes precisa fazer o pedido.</p>
                  </div>
                )}
              </div>
              )}

            </div>
            )}


            {/* ══════ RODAPÉ (steps 2, 3, 4) ══════ */}
            {wizardStep >= 2 && (
            <div className="prod-modal-footer prod-modal-footer--novo">
              <button className="prod-btn-cancelar-novo" onClick={handleTryClose}>Cancelar</button>
              {(() => {
                // Validações por passo
                const canAdvance = (() => {
                  // Step 2: Informações — nome + categoria obrigatórios
                  if (wizardStep === 2) return form.nome.trim().length > 0 && form.categoria.trim().length > 0;
                  // Step 3: Opções — valida só as personalizações
                  //   Se ativou algum grupo, precisa ter pelo menos 1 opção nele
                  //   Se Tamanhos ativo, precisa pelo menos 1 tamanho com preço
                  //   Preço base é validado no step 4 (Fotos e finalização)
                  if (wizardStep === 3) {
                    const gm = form.grupo_massas, gr = form.grupo_recheios, gc = form.grupo_coberturas, gt = form.grupo_tamanhos;
                    // Mobile na etapa checklist: basta ter 1 grupo marcado (opcoes vem depois)
                    if (isMobileMain && !form.id && mobilePersonaStep === "checklist") {
                      const anyAtivo = [gm, gr, gc, gt, form.grupo_sabores].some(g => g?.ativo);
                      return anyAtivo;
                    }
                    const gruposAtivos = [gm, gr, gc, gt].filter(g => g?.ativo);
                    if (gruposAtivos.some(g => (g?.opcoes.length || 0) === 0)) return false;
                    return true;
                  }
                  // Step 4: Preço e venda — valida preço base OU preços dos tamanhos
                  if (wizardStep === 4) {
                    const gt = form.grupo_tamanhos;
                    const temTamanhoAtivo = gt?.ativo && gt.opcoes.length > 0;
                    if (temTamanhoAtivo) {
                      // Modo "por peso": preços dos tamanhos são calculados via preco_normal (R$/kg)
                      if (gt!.modo_preco_tamanho === "por_peso") {
                        return (form.preco_normal || 0) > 0;
                      }
                      // Modo "preço fixo": todos os tamanhos precisam ter preço próprio
                      return gt!.opcoes.every(o => o.preco > 0);
                    }
                    return (form.preco_normal || 0) > 0;
                  }
                  // Step 5: Fotos — sempre pode avançar (fotos opcionais)
                  if (wizardStep === 5) return true;
                  return true;
                })();
                const isLast = wizardStep === 5;
                const isEdit = !!form.id;

                if (isEdit) {
                  // Modo edição: salva direto em qualquer passo
                  return (
                    <button className="prod-btn-avancar-novo" onClick={handleSalvar} disabled={saving}>
                      {saving ? <span className="prod-spinner-sm" /> : "Salvar alterações"}
                    </button>
                  );
                }

                if (isLast) {
                  return (
                    <button className="prod-btn-avancar-novo" onClick={handleSalvar} disabled={saving}>
                      {saving ? <span className="prod-spinner-sm" /> : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{marginRight: 6}}><polyline points="20 6 9 17 4 12"/></svg>
                          Publicar produto
                        </>
                      )}
                    </button>
                  );
                }

                return (
                  <button
                    className="prod-btn-avancar-novo"
                    disabled={!canAdvance}
                    onClick={() => {
                      if (!canAdvance) return;
                      // Mobile: se está no checklist da personalização, primeiro avança pra fill (não pro próximo step)
                      if (isMobileMain && !form.id && wizardStep === 3 && mobilePersonaStep === "checklist") {
                        setMobilePersonaStep("fill");
                        return;
                      }
                      setWizardStep(s => (s + 1) as 1 | 2 | 3 | 4 | 5);
                    }}
                  >
                    Avançar
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" style={{marginLeft: 6}}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                );
              })()}
            </div>
            )}
          </div>

        </div>
      )}

      {/* ── Modal: perguntar se salva extra na biblioteca ── */}
      {salvarBibliotecaAsk && (
        <div className="prod-lib-overlay" onClick={() => setSalvarBibliotecaAsk(null)}>
          <div className="prod-lib-modal" onClick={e => e.stopPropagation()}>
            <div className="prod-lib-icon">📚</div>
            <h3 className="prod-lib-title">Salvar na sua biblioteca?</h3>
            <p className="prod-lib-desc">
              Você adicionou <b>"{salvarBibliotecaAsk.nome}"</b> {salvarBibliotecaAsk.valor > 0 && <>por <b>R$ {formatPreco(salvarBibliotecaAsk.valor)}</b> </>}
              como extra. Quer usar em outros produtos {form.categoria ? <>de <b>"{form.categoria}"</b></> : null}?
            </p>
            <div className="prod-lib-actions">
              <button
                type="button"
                className="prod-lib-btn-ghost"
                onClick={() => setSalvarBibliotecaAsk(null)}
              >Só neste produto</button>
              <button
                type="button"
                className="prod-btn-3d"
                style={{ flex: 1 }}
                onClick={async () => {
                  if (!userId) return;
                  const { data, error } = await supabase.from("biblioteca_extras").insert({
                    user_id: userId,
                    nome: salvarBibliotecaAsk.nome,
                    valor: salvarBibliotecaAsk.valor,
                    categorias: form.categoria ? [form.categoria] : []
                  }).select().single();
                  if (!error && data) {
                    setBiblioteca(b => [...b, data as BibliotecaExtra]);
                    // Vincula esse adicional ao id da biblioteca
                    setForm(f => ({
                      ...f,
                      adicionais: (f.adicionais || []).map((a, i) =>
                        i === salvarBibliotecaAsk.index ? { ...a, from_biblioteca: (data as BibliotecaExtra).id } : a
                      )
                    }));
                  }
                  setSalvarBibliotecaAsk(null);
                }}
              >Salvar {form.categoria ? `em "${form.categoria}"` : "na biblioteca"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal dedicado da Ficha Técnica (overlay duplo, fica por cima do modal do produto) ── */}
      {modal && fichaModalOpen && (
        <div className="ficha-modal-overlay" onClick={() => setFichaModalOpen(false)}>
          <div className="ficha-modal" onClick={e => e.stopPropagation()}>
            <button className="ficha-modal-close-x" onClick={() => setFichaModalOpen(false)} aria-label="Fechar">✕</button>
            {/* Header com imagem do produto + métricas */}
            <div className="ficha-modal-header">
              <div className="ficha-modal-header-inner">
                <button className="ficha-modal-back" onClick={() => setFichaModalOpen(false)} aria-label="Voltar">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  <span>Voltar</span>
                </button>
                <div className="ficha-modal-hero">
                  {form.imagem_url
                    ? <img src={form.imagem_url} alt={form.nome} className="ficha-modal-hero-img" />
                    : <div className="ficha-modal-hero-img ficha-modal-hero-img--placeholder">🧁</div>}
                  <div className="ficha-modal-hero-info">
                    <p className="ficha-modal-hero-label">Ficha técnica de</p>
                    <h2 className="ficha-modal-hero-nome">{form.nome || "Novo produto"}</h2>
                    <div className="ficha-modal-hero-metricas">
                      <div className="ficha-modal-metric">
                        <span>CMV</span>
                        <strong>R$ {cmvProduto.toFixed(2)}</strong>
                      </div>
                      <div className="ficha-modal-metric">
                        <span>Lucro</span>
                        <strong>R$ {(form.preco_normal - cmvProduto).toFixed(2)}</strong>
                      </div>
                      <div className={`ficha-modal-metric ficha-modal-metric--margem ficha-modal-metric--${margemProduto >= 50 ? "alto" : margemProduto >= 25 ? "medio" : "baixo"}`}>
                        <span>Margem</span>
                        <strong>{margemProduto.toFixed(0)}%</strong>
                      </div>
                    </div>
                  </div>
                </div>
                {margemProduto < 25 && form.preco_normal > 0 && fichaTecnica.length > 0 && (
                  <p className="ficha-modal-alerta">⚠️ Margem baixa. Considere reajustar o preço ou revisar a ficha.</p>
                )}
              </div>
            </div>

            {/* Corpo: lista de ingredientes + adicionar */}
            <div className="ficha-modal-body">
              {fichaTecnica.length === 0 ? (
                <div className="ficha-modal-empty">
                  <div className="ficha-modal-empty-icon">🥣</div>
                  <p className="ficha-modal-empty-title">Nenhum ingrediente ainda</p>
                  <p className="ficha-modal-empty-sub">Adicione abaixo os insumos usados pra fazer <strong>1 unidade</strong> deste produto.</p>
                </div>
              ) : (
                <div className="ficha-modal-list">
                  {fichaTecnica.map(f => {
                    const ins = f.insumo;
                    if (!ins) return null;
                    const custoLinha = calcCustoProd(f.quantidade, f.unidade_utilizada, ins.unidade, ins.custo_unitario || 0);
                    const compatibleUnits = getCompatibleUnitsProd(ins.unidade);
                    const hasUnitChoice = compatibleUnits.length > 1;
                    return (
                      <div key={f.insumo_id} className="ficha-modal-item">
                        {ins.imagem_url
                          ? <img src={ins.imagem_url} alt={ins.nome} className="ficha-modal-item-img" />
                          : <div className="ficha-modal-item-img ficha-modal-item-img--placeholder">🥣</div>}
                        <div className="ficha-modal-item-info">
                          <p className="ficha-modal-item-nome">{ins.nome}</p>
                          <p className="ficha-modal-item-sub">R$ {(ins.custo_unitario || 0).toFixed(2)} / {ins.unidade}</p>
                          <div className="ficha-modal-item-bottom">
                            <div className="ficha-modal-item-qtd">
                              <input
                                type="number"
                                value={f.quantidade || ""}
                                onChange={e => atualizarQtdFicha(f.insumo_id, parseFloat(e.target.value) || 0)}
                                step="any" min="0" placeholder="0"
                              />
                              {hasUnitChoice ? (
                                <select
                                  className="ficha-modal-unit-select"
                                  value={f.unidade_utilizada}
                                  onChange={e => atualizarUnidadeFicha(f.insumo_id, e.target.value)}
                                >
                                  {compatibleUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              ) : (
                                <span>{f.unidade_utilizada}</span>
                              )}
                            </div>
                            <div className="ficha-modal-item-custo">R$ {custoLinha.toFixed(2)}</div>
                          </div>
                        </div>
                        <button className="ficha-modal-item-del" onClick={() => removerInsumoFicha(f.insumo_id)} aria-label="Remover">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Adicionar ingrediente (combobox + quick-add) */}
              {!showQuickAdd ? (
                <div className="ficha-modal-add">
                  <div className="ficha-modal-add-label">Adicionar ingrediente</div>
                  <input
                    type="text"
                    className="ficha-modal-add-input"
                    placeholder="🔍 Buscar insumo cadastrado..."
                    value={buscaInsumo}
                    onChange={e => setBuscaInsumo(e.target.value)}
                  />
                  {buscaInsumo.trim() && (
                    <div className="ficha-modal-add-results">
                      {insumosCadastrados
                        .filter(i => !fichaTecnica.some(f => f.insumo_id === i.id))
                        .filter(i => i.nome.toLowerCase().includes(buscaInsumo.toLowerCase()))
                        .slice(0, 6)
                        .map(i => (
                          <button key={i.id} type="button" className="ficha-modal-add-result" onClick={() => adicionarInsumoFicha(i)}>
                            {i.imagem_url
                              ? <img src={i.imagem_url} alt={i.nome} className="ficha-modal-add-result-img" />
                              : <div className="ficha-modal-add-result-img ficha-modal-add-result-img--placeholder">🥣</div>}
                            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                              <p className="ficha-modal-item-nome">{i.nome}</p>
                              <p className="ficha-modal-item-sub">R$ {(i.custo_unitario || 0).toFixed(2)} / {i.unidade}</p>
                            </div>
                          </button>
                        ))}
                      <button type="button" className="ficha-modal-add-novo" onClick={() => abrirQuickAdd(buscaInsumo)}>
                        ➕ Cadastrar <strong>"{buscaInsumo}"</strong> como novo insumo
                      </button>
                    </div>
                  )}
                  {!buscaInsumo.trim() && (
                    <button type="button" className="ficha-modal-add-novo ficha-modal-add-novo--solo" onClick={() => abrirQuickAdd("")}>
                      ➕ Cadastrar novo insumo
                    </button>
                  )}
                </div>
              ) : (
                <QuickAddInsumo
                  userId={userId}
                  initialName={quickAddInitialName}
                  onSaved={handleInsumoSalvoRapido}
                  onCancel={fecharQuickAdd}
                />
              )}
            </div>

            {/* Rodapé */}
            <div className="ficha-modal-footer">
              <button className="ficha-modal-concluir" onClick={() => setFichaModalOpen(false)}>Concluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewProduto && (
        <div className="prod-preview-overlay" onClick={() => setPreviewProduto(null)}>
          <div className="prod-preview-modal" onClick={e => e.stopPropagation()}>
            <button className="prod-preview-close" onClick={() => setPreviewProduto(null)} aria-label="Fechar">✕</button>

            {/* Foto hero (com carousel dots se tiver mais) */}
            {(() => {
              const fotos = (previewProduto.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
              return fotos.length > 0 ? (
                <div className="prod-preview-img">
                  <img src={fotos[0]} alt={previewProduto.nome} />
                  {fotos.length > 1 && (
                    <div className="prod-preview-dots">
                      {fotos.map((_, i) => (
                        <span key={i} className={`prod-preview-dot ${i === 0 ? "prod-preview-dot--ativo" : ""}`}></span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="prod-preview-img prod-preview-img--placeholder">Sem imagem</div>
              );
            })()}

            <div className="prod-preview-body">
              {/* Categoria + Status */}
              <div className="prod-preview-eyebrow">
                {previewProduto.categoria && <span>{previewProduto.categoria}</span>}
                <span className="prod-preview-eyebrow-dot">·</span>
                <span className={previewProduto.disponivel !== false ? "prod-preview-status-on" : "prod-preview-status-off"}>
                  {previewProduto.disponivel !== false ? "Ativo" : "Inativo"}
                </span>
                {previewProduto.promocao && <>
                  <span className="prod-preview-eyebrow-dot">·</span>
                  <span className="prod-preview-status-promo">Promoção</span>
                </>}
              </div>

              {/* Nome grande */}
              <h3 className="prod-preview-nome">{previewProduto.nome}</h3>

              {/* Descrição */}
              {previewProduto.descricao && (
                <p className="prod-preview-desc">{previewProduto.descricao}</p>
              )}

              {/* Card destaque preço + vendas */}
              <div className="prod-preview-destaque">
                <div className="prod-preview-destaque-preco">
                  <div className="prod-preview-destaque-label">Preço</div>
                  {previewProduto.promocao && previewProduto.preco_promocional && previewProduto.preco_promocional > 0 ? (
                    <>
                      <div className="prod-preview-destaque-valor">R$ {formatPreco(previewProduto.preco_promocional)}</div>
                      <div className="prod-preview-destaque-sub" style={{textDecoration: "line-through"}}>R$ {formatPreco(previewProduto.preco_normal)}</div>
                    </>
                  ) : (
                    <>
                      <div className="prod-preview-destaque-valor">R$ {formatPreco(previewProduto.preco_normal)}</div>
                      <div className="prod-preview-destaque-sub">
                        {(() => {
                          const label = FORMAS_VENDA.find(f => f.value === previewProduto.forma_venda)?.label;
                          const temVariacoes = (previewProduto.tamanhos_disponiveis || []).length > 0 || (previewProduto.recheios_disponiveis || []).length > 0;
                          return `${label || "Por unidade"}${temVariacoes ? " · a partir de" : ""}`;
                        })()}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Grid 2 colunas: variações + cadastrado */}
              <div className="prod-preview-info-grid">
                <div className="prod-preview-info-box">
                  <div className="prod-preview-info-label">OPÇÕES</div>
                  <div className="prod-preview-info-valor">
                    {(() => {
                      // V3: lê dos grupos ativos
                      const partes: string[] = [];
                      const contar = (grupo: any, label: string, labelPlural: string) => {
                        if (grupo?.ativo && (grupo.opcoes?.length || 0) > 0) {
                          const n = grupo.opcoes.length;
                          partes.push(`${n} ${n === 1 ? label : labelPlural}`);
                        }
                      };
                      contar(previewProduto.grupo_massas, "massa", "massas");
                      contar(previewProduto.grupo_recheios, "recheio", "recheios");
                      contar(previewProduto.grupo_coberturas, "cobertura", "coberturas");
                      contar(previewProduto.grupo_sabores, "sabor", "sabores");
                      contar((previewProduto as any).grupo_tamanhos, "tamanho", "tamanhos");
                      if (partes.length === 0) return "Nenhuma";
                      if (partes.length === 1) return partes[0];
                      if (partes.length === 2) return partes.join(" + ");
                      return `${partes.length} categorias`;
                    })()}
                  </div>
                </div>
                <div className="prod-preview-info-box">
                  <div className="prod-preview-info-label">CADASTRADO</div>
                  <div className="prod-preview-info-valor">
                    {(() => {
                      if (!previewProduto.created_at) return "—";
                      const dias = Math.floor((Date.now() - new Date(previewProduto.created_at).getTime()) / (86400000));
                      if (dias === 0) return "Hoje";
                      if (dias === 1) return "Ontem";
                      if (dias < 30) return `Há ${dias} dias`;
                      const meses = Math.floor(dias / 30);
                      if (meses < 12) return `Há ${meses} ${meses === 1 ? "mês" : "meses"}`;
                      return new Date(previewProduto.created_at).toLocaleDateString("pt-BR");
                    })()}
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="prod-preview-actions">
                <button className="prod-preview-btn-editar" onClick={() => {
                  const ehRevisar = previewProduto.disponivel === false;
                  setPreviewProduto(null);
                  openEditar(previewProduto, ehRevisar);
                }}>
                  {previewProduto.disponivel !== false ? (
                    // Publicado → ícone lápis
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{marginRight: 6}}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      Editar
                    </>
                  ) : (
                    // Despublicado → ícone olho + call-to-action pra publicar
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Revisar e Publicar
                    </>
                  )}
                </button>
                <div className="prod-preview-menu-wrap">
                  <button
                    className="prod-preview-btn-icon"
                    onClick={e => { e.stopPropagation(); setPreviewMenu(v => !v); }}
                    title="Mais ações"
                    aria-label="Mais ações"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                  </button>
                  {previewMenu && (
                    <div className="prod-preview-menu" onClick={e => e.stopPropagation()}>
                      <button
                        className="prod-preview-menu-item"
                        onClick={async () => {
                          setPreviewMenu(false);
                          try {
                            await gerarFichaProduto(previewProduto, userId);
                          } catch (err) {
                            console.error("Erro ao gerar PDF:", err);
                            alert("Não foi possível gerar o PDF. Tente novamente.");
                          }
                        }}
                      >
                        <span className="prod-preview-menu-ico">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
                        </span>
                        <span>
                          <div className="prod-preview-menu-title">Ficha técnica (PDF)</div>
                          <div className="prod-preview-menu-sub">Baixa o PDF completo do produto</div>
                        </span>
                      </button>
                      <button
                        className="prod-preview-menu-item"
                        onClick={async () => {
                          setPreviewMenu(false);
                          if (!userId) return;
                          // Limpa TODOS os campos que não pertencem à tabela produtos
                          const {
                            id, created_at, updated_at, produto_insumos, user_id, ...limpo
                          } = previewProduto as any;
                          const novo = {
                            ...limpo,
                            nome: proximoNomeCopia(previewProduto.nome),
                            user_id: userId,
                            disponivel: false, // Cópia começa despublicada pra revisar antes
                          };
                          const { data, error } = await supabase
                            .from("produtos")
                            .insert(novo)
                            .select("id")
                            .single();
                          if (error) {
                            showToast("error", "Erro ao duplicar", error.message);
                            return;
                          }
                          // Se tinha ficha técnica, clona também
                          if (id && data?.id) {
                            const { data: insumos } = await supabase
                              .from("produto_insumos")
                              .select("insumo_id, quantidade, unidade_utilizada, quantidade_base")
                              .eq("produto_id", id);
                            if (insumos && insumos.length > 0) {
                              await supabase.from("produto_insumos").insert(
                                insumos.map((i: any) => ({ ...i, produto_id: data.id, user_id: userId }))
                              );
                            }
                          }
                          setPreviewProduto(null);
                          await loadProdutos(userId);
                          showToast("success", "Cópia criada", "Está despublicada. Revise as informações antes de publicar no cardápio.");
                        }}
                      >
                        <span className="prod-preview-menu-ico" style={{color: "#3B82F6"}}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </span>
                        <span>
                          <div className="prod-preview-menu-title">Duplicar</div>
                          <div className="prod-preview-menu-sub">Cria cópia idêntica (fica despublicada)</div>
                        </span>
                      </button>
                      <button
                        className="prod-preview-menu-item"
                        onClick={async () => {
                          setPreviewMenu(false);
                          const url = `${window.location.origin}/c/${userId}`;
                          try { await navigator.clipboard.writeText(url); alert("Link do cardápio copiado!"); }
                          catch { alert(url); }
                        }}
                      >
                        <span className="prod-preview-menu-ico" style={{color: "#059669"}}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        </span>
                        <span>
                          <div className="prod-preview-menu-title">Compartilhar link</div>
                          <div className="prod-preview-menu-sub">Copia o link do cardápio</div>
                        </span>
                      </button>
                      <button
                        className="prod-preview-menu-item"
                        onClick={async () => {
                          setPreviewMenu(false);
                          const novoDisponivel = !(previewProduto.disponivel !== false);
                          const { error } = await supabase.from("produtos").update({ disponivel: novoDisponivel }).eq("id", previewProduto.id!);
                          if (error) { showToast("error", "Erro", error.message); return; }
                          await loadProdutos(userId);
                          setPreviewProduto({ ...previewProduto, disponivel: novoDisponivel });
                          showToast(
                            "success",
                            novoDisponivel ? "Produto publicado" : "Produto despublicado",
                            novoDisponivel
                              ? "Já aparece no seu cardápio público."
                              : "Ficou oculto do cardápio. Você pode publicar novamente quando quiser."
                          );
                        }}
                      >
                        <span className="prod-preview-menu-ico" style={{color: previewProduto.disponivel !== false ? "#F59E0B" : "#059669"}}>
                          {previewProduto.disponivel !== false ? (
                            // Ícone olho fechado (despublicar)
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : (
                            // Ícone olho (publicar)
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </span>
                        <span>
                          <div className="prod-preview-menu-title">
                            {previewProduto.disponivel !== false ? "Despublicar" : "Publicar"}
                          </div>
                          <div className="prod-preview-menu-sub">
                            {previewProduto.disponivel !== false ? "Ocultar do cardápio" : "Voltar a exibir no cardápio"}
                          </div>
                        </span>
                      </button>
                      <div className="prod-preview-menu-divider"></div>
                      <button
                        className="prod-preview-menu-item prod-preview-menu-item--del"
                        onClick={() => { setPreviewMenu(false); setPreviewProduto(null); setDeleteConfirm(previewProduto.id!); }}
                      >
                        <span className="prod-preview-menu-ico">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </span>
                        <span>
                          <div className="prod-preview-menu-title">Excluir</div>
                          <div className="prod-preview-menu-sub">Remove permanentemente</div>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal empty-state PRO (IA descrições) ═══ */}
      {showProIaModal && (
        <div className="prod-pro-modal-ov" onClick={() => setShowProIaModal(false)}>
          <div className="prod-pro-modal" onClick={e => e.stopPropagation()}>
            <button className="prod-pro-modal-close" onClick={() => setShowProIaModal(false)} aria-label="Fechar">✕</button>
            <img src="/log.png" alt="Doonly" className="prod-pro-modal-logo" />
            <div className="prod-pro-modal-eyebrow">
              <img src="/coroa.png" alt="" style={{width: 14, height: 14, objectFit: "contain"}} />
              Doonly PRO
            </div>
            <div className="prod-pro-modal-title">Descrições que vendem, feitas em 1 clique</div>
            <p className="prod-pro-modal-sub">
              A IA do Doonly cria descrições profissionais pros seus produtos automaticamente, no tom certo pra confeitaria.
            </p>
            <div className="prod-pro-modal-beneficios">
              <div className="prod-pro-modal-item">
                <span className="prod-pro-modal-item-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div className="prod-pro-modal-item-txt">
                  <b>Descrições instantâneas</b> — digita o nome, IA gera o resto
                </div>
              </div>
              <div className="prod-pro-modal-item">
                <span className="prod-pro-modal-item-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div className="prod-pro-modal-item-txt">
                  <b>Fotos ilimitadas</b> por produto e por variação
                </div>
              </div>
              <div className="prod-pro-modal-item">
                <span className="prod-pro-modal-item-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div className="prod-pro-modal-item-txt">
                  <b>Ficha técnica em PDF</b> com custo, margem e ingredientes
                </div>
              </div>
              <div className="prod-pro-modal-item">
                <span className="prod-pro-modal-item-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div className="prod-pro-modal-item-txt">
                  <b>Cardápio ilimitado</b> e recursos avançados
                </div>
              </div>
            </div>
            <button
              className="prod-pro-modal-cta"
              onClick={() => { setShowProIaModal(false); navigate("/configuracoes"); }}
            >
              <img src="/coroa.png" alt="" style={{width: 16, height: 16, objectFit: "contain"}} />
              Quero conhecer o PRO
            </button>
            <button className="prod-pro-modal-later" onClick={() => setShowProIaModal(false)}>
              Agora não
            </button>
          </div>
        </div>
      )}

      {/* ═══ Modal empty-state PRO (Fotos por opção) ═══ */}
      {showProFotosModal && (
        <div className="prod-pro-modal-ov" onClick={() => setShowProFotosModal(false)}>
          <div className="prod-pro-modal" onClick={e => e.stopPropagation()}>
            <button className="prod-pro-modal-close" onClick={() => setShowProFotosModal(false)} aria-label="Fechar">✕</button>
            <img src="/log.png" alt="Doonly" className="prod-pro-modal-logo" />
            <div className="prod-pro-modal-eyebrow">
              <img src="/coroa.png" alt="" style={{width: 14, height: 14, objectFit: "contain"}} />
              Doonly PRO
            </div>
            <div className="prod-pro-modal-title">Encante o cliente com fotos profissionais</div>
            <p className="prod-pro-modal-sub">
              No Doonly PRO, cada opção do seu produto pode ter foto própria. Cliente vê exatamente o que vai receber.
            </p>
            <div className="prod-pro-modal-beneficios">
              <div className="prod-pro-modal-item">
                <span className="prod-pro-modal-item-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div className="prod-pro-modal-item-txt">
                  <b>Foto por opção</b> — cada massa, sabor ou tamanho com foto própria
                </div>
              </div>
              <div className="prod-pro-modal-item">
                <span className="prod-pro-modal-item-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div className="prod-pro-modal-item-txt">
                  <b>Fotos ilimitadas</b> por produto e por variação
                </div>
              </div>
              <div className="prod-pro-modal-item">
                <span className="prod-pro-modal-item-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div className="prod-pro-modal-item-txt">
                  <b>Galeria de fotos</b> — até 5 fotos principais por produto
                </div>
              </div>
              <div className="prod-pro-modal-item">
                <span className="prod-pro-modal-item-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div className="prod-pro-modal-item-txt">
                  <b>Vitrine profissional</b> no cardápio digital
                </div>
              </div>
            </div>
            <button
              className="prod-pro-modal-cta"
              onClick={() => { setShowProFotosModal(false); navigate("/configuracoes"); }}
            >
              <img src="/coroa.png" alt="" style={{width: 16, height: 16, objectFit: "contain"}} />
              Quero conhecer o PRO
            </button>
            <button className="prod-pro-modal-later" onClick={() => setShowProFotosModal(false)}>
              Agora não
            </button>
          </div>
        </div>
      )}

      {/* ═══ Modal aviso troca de subtipo (perde dados) ═══ */}
      {confirmMudaSubtipo && (
        <div className="st-confirm-overlay" onClick={() => setConfirmMudaSubtipo(null)}>
          <div className="st-confirm-modal" onClick={e => e.stopPropagation()}>
            <h3 className="st-confirm-title">
              <span className="st-confirm-icon">⚠</span>
              Confirmar alteração
            </h3>
            <p className="st-confirm-body">
              Ao mudar para <strong>{confirmMudaSubtipo.novoSubtipo === "so_sabores" ? "Só sabores" : confirmMudaSubtipo.novoSubtipo === "so_tamanhos" ? "Só tamanhos" : "Sabores e tamanhos"}</strong>, <strong>{confirmMudaSubtipo.quantidade} {confirmMudaSubtipo.oQuePerde}{confirmMudaSubtipo.quantidade !== 1 ? "s" : ""}</strong> {confirmMudaSubtipo.quantidade !== 1 ? "serão removidos" : "será removido"} ao salvar, incluindo os preços associados.
            </p>
            <p className="st-confirm-warning">Esta ação não pode ser desfeita após salvar.</p>
            <div className="st-confirm-btns">
              <button className="st-confirm-btn-cancel" onClick={() => setConfirmMudaSubtipo(null)}>Cancelar</button>
              <button className="st-confirm-btn-ok" onClick={() => {
                const novo = confirmMudaSubtipo.novoSubtipo;
                // Limpa dados do lado que vai ser oculto
                if (novo === "so_sabores") {
                  setForm(f => ({ ...f, tamanhos_disponiveis: [] }));
                } else if (novo === "so_tamanhos") {
                  setForm(f => ({ ...f, recheios_disponiveis: [] }));
                }
                // Limpa preços associados
                setForm(f => {
                  const precos = { ...(f.precos_variacoes || {}) };
                  if (novo === "so_sabores") {
                    Object.keys(precos).forEach(k => { if (!k.endsWith("|")) delete precos[k]; });
                  } else if (novo === "so_tamanhos") {
                    Object.keys(precos).forEach(k => { if (!k.startsWith("|")) delete precos[k]; });
                  }
                  return { ...f, precos_variacoes: precos };
                });
                setWizardSubtipo(novo);
                setConfirmMudaSubtipo(null);
              }}>Continuar</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal "Descartar cadastro?" ═══ */}
      {confirmDiscardProd && (
        <div className="prod-discard-ov" onClick={() => setConfirmDiscardProd(false)}>
          <div className="prod-discard-box" onClick={e => e.stopPropagation()}>
            <div className="prod-discard-icon">⚠️</div>
            <h3 className="prod-discard-title">{form.id ? "Descartar alterações?" : "Descartar cadastro?"}</h3>
            <p className="prod-discard-desc">Você preencheu dados que serão perdidos.</p>
            <div className="prod-discard-actions">
              <button className="prod-discard-btn prod-discard-btn--stay" onClick={() => setConfirmDiscardProd(false)}>
                Continuar preenchendo
              </button>
              <button className="prod-discard-btn prod-discard-btn--go" onClick={() => { limparDraft(); setConfirmDiscardProd(false); fecharModal(); }}>
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="prod-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="prod-confirm" onClick={e => e.stopPropagation()}>
            <p className="prod-confirm-title">Excluir produto?</p>
            <p className="prod-confirm-sub">Esta ação não pode ser desfeita.</p>
            <div className="prod-confirm-btns">
              <button onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ background: "var(--error)", color: "var(--text-inverse)" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      </>
      }

      <style>{`
        /* ── Tabs ── */
        .prod-tabs { display:flex; gap:0.25rem; background:var(--border); border-radius: var(--radius-md); padding:4px; width:fit-content; margin-bottom:0.5rem; }
        .prod-tab { display:flex; align-items:center; gap:0.4rem; padding:0.5rem 1.1rem; border-radius: var(--radius-md); border:none; background:transparent; font-family:'Geist',sans-serif; font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-secondary); cursor:pointer; transition:all 0.18s; white-space:nowrap; }
        .prod-tab:hover { color:var(--text-title); background:rgba(255,255,255,0.6); }
        .prod-tab--active { background:var(--bg-card); color:var(--primary); box-shadow:0 1px 4px rgba(0,0,0,0.08); }
        @media(max-width:640px) { .prod-tabs { width:100%; } .prod-tab { flex:1; justify-content:center; padding:0.5rem 0.25rem; font-size: var(--font-helper); } }

        .prod-root { font-family: var(--font-base); max-width:800px; display:flex; flex-direction:column; gap:1rem; }
        @media (min-width: 900px) {
          .prod-root {
            max-width: 1400px;
            min-height: calc(100vh - 5rem); /* menos padding do layout-main (3rem + 2rem) */
          }
        }
        .prod-root, .prod-root * { font-family: var(--font-base); }
        .prod-root button, .prod-root input, .prod-root select, .prod-root textarea { font-family: var(--font-base) !important; }

        /* ── Badge PRO (coroa + PRO, fundo preto) — igual perfil ── */
        .prod-pro-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--accent, #2D1F26);
          color: #fff;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: var(--fw-black, 800);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          line-height: 1;
          flex-shrink: 0;
        }
        .prod-pro-badge img {
          width: 12px; height: 12px;
          object-fit: contain;
        }
        .prod-pro-badge--inline {
          font-size: 9px;
          padding: 2px 6px;
        }
        .prod-pro-badge--inline img { width: 10px; height: 10px; }

        /* ── Botão IA Descrição ── */
        .prod-ia-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border: none;
          border-radius: 999px;
          font-size: 11px;
          font-weight: var(--fw-bold);
          cursor: pointer;
          white-space: nowrap;
          transition: transform var(--dur-fast), opacity var(--dur-fast);
        }
        .prod-ia-btn--active {
          background: var(--primary-gradient, linear-gradient(135deg, #E85A8C, #C33A6E));
          color: #fff;
        }
        .prod-ia-btn--active:hover { transform: translateY(-1px); }
        .prod-ia-btn--locked {
          background: var(--bg-subtle, #F0EBED);
          color: var(--text-secondary);
          cursor: not-allowed;
        }

        /* ── Botão 3D estilo Duolingo ── */
        .prod-btn-3d {
          padding: 10px 20px;
          background: var(--primary, #E85A8C);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: var(--fw-black);
          cursor: pointer;
          white-space: nowrap;
          letter-spacing: 0.02em;
          box-shadow: 0 4px 0 var(--primary-dark, #C33A6E);
          transition: transform 0.08s ease, box-shadow 0.08s ease;
          text-transform: uppercase;
          font-family: var(--font-base) !important;
        }
        .prod-btn-3d:hover {
          filter: brightness(1.05);
        }
        .prod-btn-3d:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark, #C33A6E);
        }
        .prod-btn-3d:disabled {
          background: #CFC5C9;
          box-shadow: 0 4px 0 #A8A0A4;
          cursor: not-allowed;
        }

        /* ── Row com inputs + botão Adicionar (tamanhos) ── */
        .prod-add-row {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          align-items: stretch;
        }

        /* ═══ SPLIT HERO (empty state) ═══ */
        .prod-loading-full {
          min-height: calc(100vh - 5rem);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .prod-hero-split {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        /* Mobile: vídeo NO TOPO + conteúdo empilhado */
        .prod-hero-left {
          display: flex; flex-direction: column;
          gap: var(--space-3);
          order: 2;
          text-align: center;
          align-items: center;
        }
        .prod-hero-right {
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, var(--accent), #4A3038);
          border-radius: var(--radius-lg);
          padding: var(--space-2);
          box-shadow: 0 10px 30px rgba(45, 31, 38, 0.2);
          order: 1;
        }
        .prod-hero-video-thumb {
          aspect-ratio: 16/10;
          max-height: 200px;
          background: linear-gradient(135deg, var(--primary) 0%, #7C3AED 100%);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .prod-hero-video-thumb::before {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.2) 100%);
        }
        .prod-hero-video-play {
          width: 50px; height: 50px;
          border-radius: var(--radius-full);
          background: rgba(255,255,255,0.95);
          border: none;
          display: flex; align-items: center; justify-content: center;
          color: var(--primary);
          cursor: pointer;
          box-shadow: 0 6px 24px rgba(0,0,0,0.35);
          transition: transform var(--dur-fast) var(--ease-out);
          position: relative;
          z-index: 2;
        }
        .prod-hero-video-play:hover { transform: scale(1.08); }
        .prod-hero-video-play svg { margin-left: 3px; }
        .prod-hero-video-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-3) var(--space-2) var(--space-1);
          color: var(--text-inverse);
        }
        .prod-hero-video-t {
          font-size: var(--text-sm);
          font-weight: var(--fw-bold);
        }
        .prod-hero-video-badge {
          background: var(--primary);
          color: var(--text-inverse);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-full);
          font-size: 0.625rem;
          font-weight: var(--fw-black);
          letter-spacing: 0.08em;
        }

        .prod-hero-eyebrow {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          color: var(--primary);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          line-height: 1;
        }
        .prod-hero-title {
          font-size: 2rem;
          font-weight: var(--fw-black);
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: var(--text-title);
          margin: var(--space-1) 0 0;
        }
        .prod-hero-desc {
          font-size: var(--text-md);
          color: var(--text-secondary);
          line-height: 1.55;
          margin: var(--space-2) 0 0;
          max-width: 480px;
        }
        .prod-hero-actions {
          display: flex; gap: var(--space-2); flex-wrap: wrap;
          margin-top: var(--space-3);
          justify-content: center;
        }
        .prod-hero-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          padding: var(--space-4) var(--space-6);
          border-radius: var(--radius-md);
          font-size: var(--text-md);
          font-weight: var(--fw-black);
          cursor: pointer;
          font-family: var(--font-base) !important;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          box-shadow: 0 4px 0 var(--primary-dark);
          transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
        }
        .prod-hero-btn-primary:hover { filter: brightness(1.05); }
        .prod-hero-btn-primary:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
        }
        .prod-hero-btn-ghost {
          display: none; /* Mobile: só o botão primário (já tem o card do vídeo em cima) */
        }

        .prod-hero-tip {
          display: flex;
          gap: var(--space-3);
          background: var(--primary-light);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          align-items: flex-start;
          margin-top: var(--space-4);
        }
        .prod-hero-tip-icon {
          font-size: var(--text-xl);
          line-height: 1;
          flex-shrink: 0;
        }
        .prod-hero-tip-t {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 var(--space-1);
        }
        .prod-hero-tip-d {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        /* ═══ Desktop: split 1fr / 1.2fr — vídeo vai pra direita ═══ */
        @media (min-width: 900px) {
          .prod-hero-split {
            min-height: calc(100vh - 5rem);
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: var(--space-6);
            padding: 0 var(--space-4);
          }
          .prod-hero-left {
            order: 1;
            gap: var(--space-4);
            flex: 1.3 1 440px;
            max-width: 560px;
            min-width: 0;
          }
          .prod-hero-right {
            order: 2;
            padding: var(--space-2);
            flex: 1 1 340px;
            max-width: 460px;
            min-width: 0;
          }
          .prod-hero-eyebrow { font-size: var(--text-sm); }
          .prod-hero-title { font-size: 2.5rem; line-height: 1.05; }
          .prod-hero-desc { font-size: var(--text-lg); }
          .prod-hero-tip-t { font-size: var(--text-sm); }
          .prod-hero-tip-d { font-size: var(--text-sm); }
          .prod-hero-btn-primary { padding: var(--space-4) var(--space-6); font-size: var(--text-md); }
          /* Desktop: volta alinhamento à esquerda (texto ao lado do vídeo) */
          .prod-hero-left { text-align: left; align-items: flex-start; }
          .prod-hero-actions { justify-content: flex-start; }
          .prod-hero-btn-ghost {
            display: inline-flex;
            align-items: center;
            gap: var(--space-2);
            background: var(--bg-subtle);
            color: var(--text-secondary);
            border: none;
            padding: var(--space-3) var(--space-5);
            border-radius: var(--radius-md);
            font-size: var(--text-sm);
            font-weight: var(--fw-bold);
            cursor: pointer;
            font-family: var(--font-base) !important;
            transition: background var(--dur-fast) var(--ease-out);
          }
          .prod-hero-btn-ghost:hover { background: var(--accent-light); }
          .prod-hero-video-play { width: 60px; height: 60px; }
          .prod-hero-video-play svg { width: 28px; height: 28px; }
          .prod-hero-video-t { font-size: var(--text-sm); }
        }

        /* ═══ EXTRAS / BIBLIOTECA ═══ */
        /* Sugestões da biblioteca */
        .prod-sugestoes {
          background: linear-gradient(135deg, #FFF9E5, #FFF3D6);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .prod-sugestoes-lbl {
          font-size: 11px;
          font-weight: 700;
          color: #92400E;
          margin: 0 0 8px;
          letter-spacing: 0.03em;
        }
        .prod-sugestoes-chips {
          display: flex; flex-wrap: wrap; gap: 6px;
        }
        .prod-sug-chip {
          background: #fff;
          border: 1.5px solid #FCD34D;
          color: #92400E;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--font-base);
          transition: all var(--dur-fast);
        }
        .prod-sug-chip:hover {
          background: #FCD34D;
          transform: translateY(-1px);
        }

        /* Lista de adicionais */
        .prod-adic-lista {
          display: flex; flex-direction: column;
          gap: 6px;
        }
        .prod-adic-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-subtle, #FBF4F6);
          border: 1.5px solid transparent;
          border-radius: 10px;
          padding: 10px 12px;
          gap: 8px;
        }
        .prod-adic-item-info {
          display: flex; align-items: center;
          gap: 8px; flex: 1; min-width: 0;
        }
        .prod-adic-nome {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-title);
        }
        .prod-adic-valor {
          font-size: 13px;
          font-weight: 700;
          color: var(--success, #15803D);
        }
        .prod-adic-tag {
          font-size: 12px;
          opacity: 0.6;
        }
        .prod-adic-remove {
          background: transparent;
          border: none;
          color: var(--error, #DC2626);
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          width: 24px; height: 24px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          transition: background var(--dur-fast);
        }
        .prod-adic-remove:hover { background: #FEE2E2; }

        /* Row de adicionar novo extra */
        .prod-adic-add {
          display: flex;
          gap: 8px;
          align-items: stretch;
          margin-top: 4px;
        }
        @media (max-width: 480px) {
          .prod-adic-add { flex-wrap: wrap; }
          .prod-adic-add .prod-btn-3d { width: 100%; }
        }

        /* ── Modal salvar na biblioteca ── */
        .prod-lib-overlay {
          position: fixed;
          inset: 0;
          background: rgba(45, 31, 38, 0.6);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: prodLibIn 0.2s ease;
        }
        @keyframes prodLibIn { from { opacity: 0; } to { opacity: 1; } }
        .prod-lib-modal {
          background: #fff;
          border-radius: 20px;
          padding: 26px 22px 20px;
          width: 100%;
          max-width: 380px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: prodLibScale 0.22s cubic-bezier(0.22, 1, 0.36, 1);
          font-family: var(--font-base);
        }
        @keyframes prodLibScale {
          from { transform: scale(0.94); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .prod-lib-icon {
          font-size: 44px;
          margin-bottom: 8px;
        }
        .prod-lib-title {
          font-size: 17px;
          font-weight: 800;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
          color: var(--text-title);
        }
        .prod-lib-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .prod-lib-desc b { color: var(--text-title); }
        .prod-lib-actions {
          display: flex; gap: 8px;
        }
        .prod-lib-btn-ghost {
          background: var(--bg-subtle, #F0EBED);
          border: none;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .prod-lib-btn-ghost:hover { background: var(--border); }
        .prod-add-input {
          padding: 10px 14px !important;
          border: 1.5px solid var(--border) !important;
          border-radius: 10px !important;
          font-size: 14px !important;
          font-family: var(--font-base) !important;
          outline: none !important;
          background: var(--bg-input, #fff) !important;
          transition: border-color var(--dur-fast) !important;
        }
        .prod-add-input:focus { border-color: var(--primary) !important; }
        @media (max-width: 480px) {
          .prod-add-row { flex-wrap: wrap; }
          .prod-add-row .prod-btn-3d { width: 100%; }
        }
        .prod-spinner { width:32px; height:32px; border:3px solid var(--primary-light); border-top-color:var(--primary); border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        .prod-spinner-sm { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        @keyframes pspin { to { transform:rotate(360deg); } }
        .prod-title { font-size: var(--font-page-title); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 0.15rem; }
        .prod-sub { font-size: var(--font-helper); color:var(--text-muted); margin:0; }
        .prod-btn-novo { display:flex; align-items:center; gap:0.4rem; padding:0.7rem 1.2rem; background:var(--primary-gradient); color:var(--text-inverse); border:none; border-radius: var(--radius-full); font-family: var(--font-base); font-size: var(--font-button); font-weight: var(--fw-bold); cursor:pointer; white-space:nowrap; }
        .prod-filtros { display:flex; gap:0.4rem; flex-wrap:wrap; }
        .prod-filtro-btn { padding:0.35rem 0.7rem; border:1.5px solid var(--border); border-radius: var(--radius-sm); background:var(--bg-card); font-family: var(--font-base); font-size: var(--font-helper); font-weight: var(--fw-medium); color:var(--text-secondary); cursor:pointer; }
        .prod-filtro-btn.active { border-color:var(--primary); color:var(--primary); background:var(--primary-light); font-weight: var(--fw-bold); }
        .prod-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.75rem; padding:3rem 1rem; text-align:center; }
        .prod-empty-title { font-size: var(--font-input); font-weight: var(--fw-bold); color:var(--text-title); margin:0; }
        .prod-empty-sub { font-size: var(--font-helper); color:var(--text-muted); margin:0; }
        /* Mobile: 2 colunas no grid. Desktop: auto-fill respirável */
        .prod-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.6rem;
        }
        @media (min-width: 720px) {
          .prod-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
        }
        @media (min-width: 1100px) {
          .prod-grid { grid-template-columns: repeat(4, 1fr); gap: 0.9rem; }
        }
        @media (min-width: 1400px) {
          .prod-grid { grid-template-columns: repeat(5, 1fr); }
        }
        .prod-list { display:flex; flex-direction:column; gap:0.5rem; }
        .prod-list-item { background:var(--bg-card); border-radius: var(--radius-lg); padding:0.65rem; display:flex; align-items:center; gap:0.85rem; box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); }
        .prod-list-img { width:64px; height:64px; border-radius: var(--radius-md); overflow:hidden; background:var(--primary-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative; cursor:pointer; }
        .prod-list-img img { width:100%; height:100%; object-fit:cover; }
        .prod-list-img-sem-foto {
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #FEF3C7, #FCE7F3);
          display: flex; align-items: center; justify-content: center;
        }
        .prod-list-info { flex:1; min-width:0; }
        .prod-card {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1.5px solid transparent;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          display: flex; flex-direction: column;
          transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out), border-color 0.18s var(--ease-out);
        }
        @media (hover: hover) {
          .prod-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 24px rgba(232, 90, 140, 0.15);
            border-color: var(--primary);
          }
        }
        .prod-card-img {
          aspect-ratio: 4/3;
          background: var(--bg-subtle);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .prod-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .prod-card-indisponivel {
          position: absolute; inset: 0;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(1px);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary);
          font-size: 0.7rem;
          font-weight: var(--fw-black);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .prod-card-promo {
          position: absolute;
          top: 8px; right: 8px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          color: var(--text-inverse);
          font-size: 0.6rem;
          font-weight: var(--fw-black);
          padding: 3px 8px;
          border-radius: 999px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .prod-card-badge-var {
          position: absolute;
          top: 8px; left: 8px;
          background: rgba(255,255,255,0.95);
          color: #1E40AF;
          font-size: 0.6rem;
          font-weight: var(--fw-black);
          padding: 3px 7px;
          border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        /* Placeholder motivador quando não tem foto */
        .prod-card-sem-foto {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 4px;
          padding: 8px;
          background: linear-gradient(135deg, #FEF3C7 0%, #FCE7F3 100%);
          text-align: center;
          transition: filter 0.2s;
        }
        .prod-card-sem-foto:hover { filter: brightness(1.03); }
        .prod-card-sem-foto-icon {
          font-size: 28px;
          line-height: 1;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08));
        }
        .prod-card-sem-foto-title {
          font-size: 0.72rem;
          font-weight: var(--fw-black);
          color: var(--primary-dark);
          line-height: 1.1;
          letter-spacing: -0.01em;
        }
        .prod-card-sem-foto-cta {
          font-size: 0.6rem;
          color: #92400E;
          font-weight: var(--fw-medium);
          line-height: 1.1;
        }
        .prod-card-encomenda { position:absolute; top:0.4rem; right:0.4rem; background:var(--warning); color:var(--text-inverse); font-size: var(--font-caption); font-weight: var(--fw-bold); padding:0.15rem 0.45rem; border-radius: var(--radius-xl); }
        .prod-card-info { padding:0.65rem 0.75rem; flex:1; display:flex; flex-direction:column; }
        .prod-card-bottom { margin-top:auto; }
        .prod-card-cat { font-size: 0.6rem; color:var(--text-muted); font-weight: var(--fw-medium); text-transform:uppercase; letter-spacing:0.04em; margin:0 0 0.15rem; }
        .prod-card-nome { font-size: var(--font-button); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 0.25rem; line-height:1.3; }
        .prod-card-preco { font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--success); margin:0; }

        /* ── Badge de lucro/margem por venda ── */
        .prod-card-lucro {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin-top: 6px;
          padding: 5px 8px;
          border-radius: var(--radius-sm);
          font-family: var(--font-base);
          line-height: 1.2;
        }
        .prod-card-lucro-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          opacity: 0.75;
        }
        .prod-card-lucro strong {
          font-size: var(--font-helper);
          font-weight: var(--fw-black);
        }
        .prod-card-lucro-pct {
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
          opacity: 0.8;
        }
        .prod-card-lucro--alto  { background:#dcfce7; color:#15803d; }
        .prod-card-lucro--medio { background:#fef3c7; color:#a16207; }
        .prod-card-lucro--baixo { background:#fee2e2; color:#b91c1c; }

        .prod-card-sem-ficha {
          margin-top: 6px;
          padding: 8px 10px;
          background: var(--primary-light);
          border: 1.5px dashed var(--primary);
          border-radius: var(--radius-sm);
          color: var(--primary-dark);
          font-family: var(--font-base);
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          cursor: pointer;
          text-align: center;
          width: 100%;
          line-height: 1.3;
          transition: background var(--dur-fast) var(--ease-out), transform var(--dur-fast);
        }
        .prod-card-sem-ficha:hover {
          background: #fce5ee;
          transform: translateY(-1px);
        }
        .prod-card-actions { display:flex; gap:0.4rem; padding:0.5rem 0.75rem; border-top:1px solid var(--border); }
        .prod-card-btn-edit { flex:1; padding:0.4rem; background:var(--bg-subtle); border:none; border-radius: var(--radius-sm); font-family: var(--font-base); font-size: var(--font-helper); font-weight: var(--fw-semibold); color:var(--text-primary); cursor:pointer; }
        .prod-card-btn-del { padding:0.4rem 0.6rem; background:#fff1f2; border:none; border-radius: var(--radius-sm); color:var(--error); cursor:pointer; display:flex; align-items:center; }
        /* ── Modal de Preview do Produto (abre ao clicar no card) ── */
        .prod-preview-overlay {
          position: fixed; inset: 0; z-index: 500;
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex; flex-direction: column;
          justify-content: flex-end;
          animation: prodOverlayIn 0.2s ease;
        }
        .prod-preview-modal {
          background: var(--bg-card);
          width: 100%;
          max-height: 92vh;
          display: flex; flex-direction: column;
          border-radius: 20px 20px 0 0;
          box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.18);
          animation: prodModalSlideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          position: relative;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .prod-preview-modal::before {
          content: '';
          display: block;
          width: 36px; height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.6);
          margin: 10px auto 0;
          flex-shrink: 0;
          position: absolute; top: 0; left: 50%;
          transform: translateX(-50%);
          z-index: 5;
        }
        @media (min-width: 720px) {
          .prod-preview-overlay { justify-content: center; align-items: center; padding: 24px; }
          .prod-preview-modal {
            max-width: 620px;
            max-height: 92vh;
            border-radius: 20px;
            animation: prodModalFadeIn 0.22s ease;
          }
          .prod-preview-modal::before { display: none; }
        }
        .prod-preview-close {
          position: absolute; top: 12px; right: 14px; z-index: 6;
          width: 34px; height: 34px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(6px);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-family: inherit;
          font-size: 16px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background var(--dur-fast), color var(--dur-fast);
        }
        .prod-preview-close:hover { background: var(--text-title); color: #fff; border-color: var(--text-title); }
        .prod-preview-img {
          width: 100%;
          height: 260px;
          overflow: hidden;
          background: var(--bg-subtle);
          flex-shrink: 0;
          border-radius: 20px 20px 0 0;
          position: relative;
          z-index: 1;
        }
        .prod-preview-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .prod-preview-img--placeholder {
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted);
          font-family: inherit;
          font-size: var(--font-helper);
        }
        .prod-preview-body {
          padding: 22px 22px 20px;
          overflow-y: visible;
          flex: 1;
          position: relative;
          z-index: 2;
        }

        /* Carousel dots na foto */
        .prod-preview-img { position: relative; }
        .prod-preview-dots {
          position: absolute;
          bottom: 10px;
          left: 12px;
          display: flex;
          gap: 4px;
          z-index: 3;
        }
        .prod-preview-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.5);
        }
        .prod-preview-dot--ativo { background: #fff; }

        /* Eyebrow (categoria · status · promo) */
        .prod-preview-eyebrow {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #E85A8C;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .prod-preview-eyebrow-dot { color: #B4A9AE; font-weight: 400; }
        .prod-preview-status-on { color: #10B981; }
        .prod-preview-status-off { color: #DC2626; }
        .prod-preview-status-promo { color: #F59E0B; }

        /* Nome */
        .prod-preview-nome {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 800;
          color: #2D1F26;
          font-family: inherit;
          line-height: 1.15;
          letter-spacing: -0.01em;
        }

        /* Descrição */
        .prod-preview-desc {
          margin: 0 0 14px;
          font-size: 13px;
          color: #6B5D64;
          line-height: 1.4;
          font-family: inherit;
        }

        /* Card destaque preço */
        .prod-preview-destaque {
          background: #FDF3F7;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 12px;
        }
        .prod-preview-destaque-label {
          font-size: 10.5px;
          color: #6B5D64;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .prod-preview-destaque-valor {
          font-size: 24px;
          font-weight: 800;
          color: #E85A8C;
          margin-top: 2px;
          font-family: inherit;
          line-height: 1.1;
        }
        .prod-preview-destaque-sub {
          font-size: 10.5px;
          color: #9A8B93;
          margin-top: 2px;
        }

        /* Grid info (variações + cadastrado) */
        .prod-preview-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 14px;
        }
        .prod-preview-info-box {
          background: #FAF8F5;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #F0EBED;
        }
        .prod-preview-info-label {
          font-family: var(--font-base);
          font-size: var(--font-caption);
          color: var(--text-secondary);
          font-weight: var(--fw-semibold);
          letter-spacing: 0.03em;
        }
        .prod-preview-info-valor {
          font-family: var(--font-base);
          font-size: var(--font-body);
          font-weight: var(--fw-medium);
          color: var(--text-primary);
          margin-top: 2px;
        }

        /* Ações */
        .prod-preview-actions {
          display: flex;
          gap: 8px;
          position: relative;
          z-index: 500;
        }
        .prod-preview-btn-editar {
          flex: 1;
          padding: 13px;
          background: #E85A8C;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 3px 0 #C33A6E;
          transition: transform 0.08s, filter 0.08s, box-shadow 0.08s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .prod-preview-btn-editar:hover { filter: brightness(1.05); }
        .prod-preview-btn-editar:active {
          transform: translateY(3px);
          box-shadow: 0 0 0 #C33A6E;
        }
        .prod-preview-btn-icon {
          padding: 13px 14px;
          background: #F5F1F3;
          color: #6B5D64;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .prod-preview-btn-icon:hover { background: #EBE6E9; color: #2D1F26; }
        .prod-preview-btn-del {
          padding: 13px 14px;
          background: #FEE2E2;
          color: #DC2626;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.12s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .prod-preview-btn-del:hover { background: #FECACA; }

        /* Menu dropdown ⋯ (lista suspensa) */
        .prod-preview-menu-wrap { position: relative; z-index: 1000; }
        .prod-preview-menu {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.16);
          border: 1px solid #F0EBED;
          padding: 8px;
          min-width: 300px;
          z-index: 1001;
          animation: prodMenuIn 0.14s ease;
        }
        @keyframes prodMenuIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .prod-preview-menu-item {
          all: unset;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 10px;
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
          transition: background 0.1s;
        }
        .prod-preview-menu-item:hover { background: #FAF8F5; }
        .prod-preview-menu-item--del:hover { background: #FEE2E2; }
        .prod-preview-menu-item--del .prod-preview-menu-title { color: #DC2626; }
        .prod-preview-menu-item--del .prod-preview-menu-ico { color: #DC2626; }
        .prod-preview-menu-ico {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #FAF8F5;
          color: #6B5D64;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .prod-preview-menu-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #2D1F26;
          font-family: inherit;
          line-height: 1.2;
        }
        .prod-preview-menu-sub {
          font-size: 11.5px;
          color: #6B5D64;
          font-family: inherit;
          margin-top: 3px;
          line-height: 1.3;
        }
        .prod-preview-menu-divider {
          height: 1px;
          background: #F0EBED;
          margin: 6px 8px;
        }

        /* ── Modal de Produto ── */
        .prod-modal-overlay {
          position: fixed; inset: 0; z-index: 500;
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          animation: prodOverlayIn 0.2s ease;
        }
        @keyframes prodOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .prod-modal {
          background: var(--bg-card);
          width: 100%;
          height: 90vh;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          font-family: var(--font-base);
          border-radius: 20px 20px 0 0;
          animation: prodModalSlideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          overflow: hidden;
          box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.18);
        }
        .prod-modal *, .prod-modal button, .prod-modal input,
        .prod-modal select, .prod-modal textarea {
          font-family: inherit;
        }
        @keyframes prodModalSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        /* Handle grip no topo (só mobile) */
        .prod-modal::before {
          content: none;
        }
        @media (min-width: 720px) {
          .prod-modal-overlay { justify-content: center; align-items: center; padding: 24px; }
          .prod-modal {
            max-width: 640px;
            height: 88vh;
            max-height: 88vh;
            border-radius: 20px;
            animation: prodModalFadeIn 0.22s ease;
          }
          .prod-modal::before { display: none; }
          @keyframes prodModalFadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to   { opacity: 1; transform: scale(1); }
          }
        }
        /* Desktop: overlay em row pra caber preview ao lado */
        @media (min-width: 900px) {
          .prod-modal-overlay {
            flex-direction: row !important;
            align-items: center !important;
            gap: 20px;
          }
        }
        .prod-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        /* ── Header v2: ícone + título + subtitle ── */
        .prod-modal-header--v2 {
          gap: 12px;
          padding: 16px 18px;
          background: linear-gradient(180deg, var(--primary-light), var(--bg-card));
        }
        .prod-modal-header-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(45,31,38,0.08);
        }
        .prod-modal-header-icon img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .prod-modal-header-text {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column; gap: 2px;
        }
        .prod-modal-header--v2 .prod-modal-title {
          font-size: 16px;
          font-weight: var(--fw-black);
          letter-spacing: -0.02em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .prod-modal-header-sub {
          margin: 0;
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.35;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Preview lateral (só desktop) ── */
        .prod-desk-preview { display: none; }

        @media (min-width: 900px) {
          .prod-modal-overlay {
            /* precisa reservar espaço pro preview lateral */
            gap: 16px;
          }
          .prod-desk-preview {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 260px;
            flex-shrink: 0;
            max-height: 88vh;
            background: transparent;
          }
          .prod-desk-preview-label {
            display: flex; align-items: center; gap: 6px;
            color: #fff;
            font-size: 11px;
            font-weight: var(--fw-bold);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            opacity: 0.9;
          }
          .prod-desk-preview-card {
            background: #fff;
            border-radius: 16px;
            width: 100%;
            overflow: hidden;
            box-shadow: 0 12px 40px rgba(0,0,0,0.25);
            display: flex; flex-direction: column;
          }
          .prod-desk-preview-img {
            aspect-ratio: 4/3;
            background: linear-gradient(135deg, var(--primary-light), var(--primary));
            display: flex; align-items: center; justify-content: center;
            overflow: hidden;
          }
          .prod-desk-preview-img img {
            width: 100%; height: 100%; object-fit: cover;
          }
          .prod-desk-preview-placeholder {
            font-size: 44px;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
          }
          .prod-desk-preview-body {
            padding: 12px 14px;
            display: flex; flex-direction: column; gap: 4px;
          }
          .prod-desk-preview-nome {
            font-size: 14px;
            font-weight: var(--fw-black);
            color: var(--text-title);
            letter-spacing: -0.01em;
          }
          .prod-desk-preview-desc {
            font-size: 10px;
            color: var(--text-secondary);
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .prod-desk-preview-preco-row {
            display: flex; align-items: baseline; gap: 6px;
            margin-top: 4px;
          }
          .prod-desk-preview-preco {
            font-size: 16px;
            font-weight: var(--fw-black);
            color: var(--primary);
          }
          .prod-desk-preview-preco-old {
            font-size: 10px;
            color: var(--text-muted);
            text-decoration: line-through;
          }
          .prod-desk-preview-cta {
            background: var(--primary);
            color: #fff;
            text-align: center;
            padding: 8px;
            font-size: 11px;
            font-weight: var(--fw-black);
            letter-spacing: 0.03em;
          }
          .prod-desk-preview-hint {
            margin: 0;
            font-size: 10px;
            color: rgba(255,255,255,0.65);
            text-align: center;
            font-style: italic;
          }
        }
        .prod-modal-title {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-bold);
          line-height: var(--lh-tight);
          color: var(--text-title);
          margin: 0;
          flex: 1;
          min-width: 0;
          font-family: inherit;
        }
        .prod-modal-close {
          background: rgba(45, 31, 38, 0.1);
          border: 1.5px solid rgba(45, 31, 38, 0.15);
          border-radius: 50%;
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: var(--text-title);
          font-size: 18px;
          font-weight: 800;
          font-family: inherit;
          flex-shrink: 0;
          transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
        }
        .prod-modal-close:hover {
          background: var(--accent, #2D1F26);
          color: #fff;
          border-color: var(--accent, #2D1F26);
        }
        .prod-modal-back {
          background: var(--bg-subtle);
          border: none;
          border-radius: 50%;
          width: 34px; height: 34px;
          cursor: pointer;
          color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
        }
        .prod-modal-back:hover { background: var(--border); color: var(--text-title); }
        .prod-modal-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: var(--space-4);
          display: flex; flex-direction: column;
          gap: var(--gap-section);
          overscroll-behavior: contain;
        }

        /* ═══ PROPOSTA A: Espaçamento + fontes maiores ═══ */
        .prod-modal-body {
          padding: 8px 32px 24px !important;
          gap: 22px !important;
          /* min-height REMOVIDO — estava empurrando o footer pra fora
             do overflow:hidden do modal quando conteúdo era grande */
        }
        @media (max-width: 640px) {
          .prod-modal-body { padding: 8px 16px 20px !important; }
        }
        /* Divisores entre seções */
        .prod-section + .prod-section {
          padding-top: 22px;
        }
        /* Label de seção com barrinha rosa lateral */
        .prod-section-label {
          font-size: 13px !important;
          font-weight: 700 !important;
          letter-spacing: 0.06em !important;
          display: flex !important;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px !important;
        }
        .prod-section-label::before {
          content: "";
          width: 3px;
          height: 16px;
          background: var(--primary);
          border-radius: 2px;
          flex-shrink: 0;
        }
        /* Inputs maiores e mais respiráveis */
        .prod-field label {
          font-size: 14px !important;
          font-weight: 700 !important;
          color: var(--text-title);
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .prod-field label em {
          font-size: 11px !important;
          font-style: normal;
          color: var(--text-muted);
          font-weight: 500 !important;
          text-transform: lowercase;
        }
        .prod-field input,
        .prod-field select,
        .prod-field textarea {
          padding: 14px 16px !important;
          font-size: 14px !important;
          border-radius: 12px !important;
        }
        .prod-preco-input { border-radius: 12px !important; }
        .prod-preco-input span { font-size: 14px !important; }
        .prod-preco-input input { padding: 14px 8px 14px 0 !important; font-size: 14px !important; }
        /* Fotos maiores */
        .prod-img-upload {
          width: 100% !important;
          aspect-ratio: 1 !important;
          height: auto !important;
          border-radius: 14px !important;
        }
        .prod-imgs-row {
          display: grid !important;
          grid-template-columns: 1fr 1fr 1fr !important;
          gap: 10px !important;
        }
        .prod-img-placeholder p { font-size: 12px !important; font-weight: 700 !important; }
        .prod-img-placeholder span { font-size: 10px !important; }
        .prod-img-cta {
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #6366F1 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 4px;
        }
        /* Toggle maior */
        .prod-toggle-item {
          padding: 14px 16px !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          border-radius: 12px !important;
        }
        /* ═══ FIM PROPOSTA A ═══ */
        .prod-modal-footer {
          padding: var(--space-3) var(--space-4);
          padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
          display: flex;
          gap: var(--gap-stack);
          flex-shrink: 0;
          background: var(--bg-card);
        }
        .prod-section { display: flex; flex-direction: column; gap: var(--gap-stack); }
        .prod-section-label { font-size: var(--font-section-label); font-weight: var(--fw-bold); line-height: var(--lh-normal); letter-spacing: var(--ls-wide); text-transform: uppercase; color: var(--primary); margin: 0; }
        .prod-img-upload { width: 120px; height: 120px; border-radius: var(--radius-lg); border: 2px dashed var(--primary-light); background: var(--primary-light); cursor: pointer; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; transition: border-color var(--dur-fast) var(--ease-out); }
        .prod-img-placeholder { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); padding: var(--space-3); text-align: center; }
        .prod-img-placeholder p { font-size: var(--font-helper); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-primary); margin: 0; }
        .prod-img-placeholder span { font-size: var(--font-caption); font-weight: var(--fw-regular); color: var(--text-muted); }
        .prod-img-remove { position: absolute; top: var(--space-1); right: var(--space-1); background: rgba(0,0,0,0.5); border: none; border-radius: 50%; width: 22px; height: 22px; color: var(--text-inverse); font-size: var(--font-caption); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .prod-field { display: flex; flex-direction: column; gap: var(--space-1); }
        .prod-field label { font-size: var(--font-field-label); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-secondary); }
        .prod-field input, .prod-field select, .prod-field textarea { padding: var(--pad-input); border: 1.5px solid var(--border); border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-medium); line-height: var(--lh-normal); color: var(--text-title); background: var(--bg-input); outline: none; transition: border-color var(--dur-fast) var(--ease-out); width: 100%; box-sizing: border-box; }
        .prod-field input:focus, .prod-field select:focus, .prod-field textarea:focus { border-color: var(--border-focus); }
        .prod-field textarea { resize: none; }
        .prod-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-stack); }
        .prod-preco-input { display: flex; align-items: center; border: 1.5px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-input); transition: border-color var(--dur-fast) var(--ease-out); }
        .prod-preco-input span { padding: 0 var(--space-3); font-weight: var(--fw-bold); color: var(--success); font-size: var(--font-input); flex-shrink: 0; }
        .prod-preco-input input { border: none !important; border-radius: 0 !important; flex: 1; padding: var(--space-3) var(--space-2) var(--space-3) 0 !important; outline: none !important; box-shadow: none !important; }
        .prod-preco-input:focus-within { border-color: var(--border-focus); }
        .prod-nova-cat { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
        .prod-nova-cat input { flex: 1; padding: var(--space-2) var(--space-3); border: 1.5px solid var(--primary); border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-medium); outline: none; }
        .prod-nova-cat button { padding: var(--space-2) var(--space-3); background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); cursor: pointer; white-space: nowrap; transition: opacity var(--dur-fast) var(--ease-out); }
        .prod-toggles { display: flex; gap: var(--gap-stack); flex-wrap: wrap; }
        .prod-toggle-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--bg-subtle); cursor: pointer; font-size: var(--font-button); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-primary); transition: all var(--dur-normal) var(--ease-out); flex: 1; min-width: 100px; }
        .prod-toggle-item.active-green { background: #dcfce7; color: #15803d; }
        /* Modifier: sem background nos toggles (usado em "Disponível" e "Pronta entrega") */
        .prod-toggles--clean .prod-toggle-item,
        .prod-toggles--clean .prod-toggle-item.active-green {
          background: transparent !important;
          padding: 8px 0 !important;
          color: #2D1F26;
        }

        /* Chips de antecedência (quando "Pronta entrega" está OFF) */
        .prod-antecedencia-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin-top: 4px;
        }
        .prod-antecedencia-chip {
          all: unset;
          box-sizing: border-box;
          text-align: center;
          padding: 10px 6px;
          background: #fff;
          border: 1.5px solid #E5D8DE;
          border-radius: 10px;
          font-size: 12.5px;
          font-weight: 700;
          color: #6B5D64;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .prod-antecedencia-chip:hover { border-color: #F5B8CD; }
        .prod-antecedencia-chip--on {
          background: #FDF3F7;
          border-color: #E85A8C;
          color: #C33A6E;
        }
        .prod-toggle-item.active-pink { background: var(--primary-light); color: var(--primary-dark); }
        .prod-toggle-slider { width: 40px; height: 22px; border-radius: var(--radius-md); background: var(--border); position: relative; flex-shrink: 0; transition: background var(--dur-normal) var(--ease-out); }
        .prod-toggle-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--bg-card); position: absolute; top: 2px; left: 2px; transition: transform var(--dur-normal) var(--ease-out); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        .prod-btn-cancelar {
          flex: 1; padding: var(--space-3);
          background: #6B5D64;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-base) !important;
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          line-height: var(--lh-normal);
          color: #FFFFFF;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          box-shadow: 0 4px 0 #4A3E44;
          transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.08s;
        }
        .prod-btn-cancelar:hover { background: #5A4E55; }
        .prod-btn-cancelar:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 #4A3E44;
        }
        .prod-btn-salvar {
          flex: 2; padding: var(--space-3);
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-base) !important;
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          line-height: var(--lh-normal);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          box-shadow: 0 4px 0 var(--primary-dark);
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .prod-btn-salvar:hover:not(:disabled) { filter: brightness(1.05); }
        .prod-btn-salvar:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
        }
        .prod-btn-salvar:disabled {
          opacity: 0.5; cursor: not-allowed;
          box-shadow: 0 4px 0 var(--primary-dark);
        }

        /* ── Wizard ── */
        .wiz-subtitle { font-size: var(--font-button); color: var(--text-secondary); margin: 0; line-height: var(--lh-relaxed); }
        .wiz-reassurance { font-size: var(--font-helper); color: var(--text-muted); margin: var(--space-1) 0 0; font-style: italic; }
        .wiz-step-label { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-muted); margin: 0 0 var(--space-1); text-transform: uppercase; letter-spacing: var(--ls-wide); }
        .wiz-progress { display: flex; gap: var(--space-2); }
        .wiz-progress-bar { flex: 1; height: 4px; border-radius: 2px; background: var(--border); }
        .wiz-progress-bar--active { background: var(--primary); }
        .wiz-section-title { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); margin: var(--space-2) 0 0; }
        .wiz-micro { font-size: var(--font-helper); color: var(--text-muted); margin: 0; line-height: var(--lh-normal); }
        .wiz-tipo-list { display: flex; flex-direction: column; gap: var(--gap-stack); }
        .wiz-tipo-card {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
          padding: var(--space-5) var(--space-4); border-radius: var(--radius-xl); cursor: pointer;
          border: 2px solid var(--border); background: var(--bg-card);
          font-family: var(--font-base); text-align: center; transition: all var(--dur-fast) var(--ease-out);
          position: relative;
        }
        .wiz-tipo-card--active { border-width: 2.5px; }

        /* ══════ Override: layout HORIZONTAL (mockup mobile) ══════ */
        .wiz-hero { margin: 4px 0; }
        .wiz-hero-title {
          font-size: 18px;
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.02em;
          margin: 0 0 3px;
          line-height: 1.15;
        }
        .wiz-hero-sub {
          font-size: 11px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.4;
        }
        .wiz-optional {
          display: inline-block;
          margin-left: 6px;
          font-size: 9px;
          font-weight: var(--fw-bold);
          color: #6B5D64;
          background: #F0EBED;
          padding: 2px 6px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        /* ═══ Tags marketing (Aumente Lucro / Opcional) ═══ */
        .wiz-opt-title-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 2px;
        }
        .wiz-opt-tag {
          display: inline-block;
          font-size: 9px;
          font-weight: var(--fw-black);
          padding: 3px 7px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          line-height: 1;
          white-space: nowrap;
        }
        .wiz-opt-tag--money {
          background: linear-gradient(135deg, #DCFCE7, #BBF7D0);
          color: #14532D;
          border: 1px solid #86EFAC;
        }
        .wiz-opt-tag--neutral {
          background: #F0EBED;
          color: #6B5D64;
        }
        .wiz-opt-card--active .wiz-opt-tag--money {
          background: rgba(255,255,255,0.9);
          color: #14532D;
          border-color: transparent;
        }
        .wiz-opt-card--active .wiz-opt-tag--neutral {
          background: rgba(255,255,255,0.85);
          color: #4a3b42;
        }
        /* ═══ Header seção com badge do tipo ═══ */
        .prod-section-hdr-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .prod-tipo-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: var(--fw-black);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          line-height: 1;
        }
        .prod-tipo-badge--simples {
          background: #FEF3C7;
          color: #92400E;
        }
        .prod-tipo-badge--variacoes {
          background: #DBEAFE;
          color: #1E40AF;
        }
        /* ═══ Preço grande no modo simples ═══ */
        .prod-preco-input--big {
          padding: 8px 14px !important;
        }
        .prod-preco-input--big input {
          font-size: 22px !important;
          font-weight: var(--fw-black) !important;
          padding: 8px 4px !important;
        }
        .prod-preco-input--big span {
          font-size: 18px !important;
          font-weight: var(--fw-black) !important;
        }
        /* Título e subtítulo dos steps (mesmo padrão do Vamos montar as opções) */
        .prod-step-header {
          margin-bottom: 20px;
          text-align: center;
        }
        .prod-step-title {
          font-size: 20px;
          font-weight: 800;
          color: #4B5563;
          line-height: 1.2;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .prod-step-sub {
          font-size: 13px;
          color: #6B5D64;
          margin-top: 6px;
          line-height: 1.5;
          max-width: 480px;
          margin-left: auto;
          margin-right: auto;
          text-wrap: balance;
        }

        /* Input de preço promocional — usa paleta rosa Doonly */
        .prod-preco-input--promo {
          border-color: #E85A8C !important;
          background: #FFF5F9 !important;
        }
        .prod-preco-input--promo input {
          background: transparent !important;
        }
        .prod-preco-input--promo:focus-within {
          border-color: #C33A6E !important;
        }
        .prod-preco-input--promo span, .prod-preco-input--promo input {
          color: #C33A6E !important;
        }
        .prod-preco-input--promo input::placeholder {
          color: #F5B8CD !important;
        }
        .prod-field-hint {
          font-size: 11px;
          font-weight: 500;
          color: #9CA3AF;
          margin-left: 4px;
        }
        /* Preview de como o cliente vê o preço no cardápio */
        .prod-promo-preview {
          margin-top: 12px;
          padding: 16px 18px;
          background: #2C1219;
          border-radius: 12px;
        }
        .prod-promo-preview-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #F5B8CD;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
        }
        .prod-promo-preview-precos {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }
        .prod-promo-preview-riscado {
          font-size: 15px;
          color: #9CA3AF;
          text-decoration: line-through;
          font-weight: 500;
        }
        .prod-promo-preview-final {
          font-size: 26px;
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.02em;
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
        }
        .prod-promo-preview-sufixo {
          font-size: 13px;
          font-weight: 700;
          color: #F5B8CD;
          letter-spacing: 0;
        }
        .prod-promo-preview-desconto {
          padding: 4px 10px;
          background: #E85A8C;
          color: #fff;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.03em;
          align-self: center;
        }
        /* ═══ Botão "+ Adicionar variação" (dentro da seção simples) ═══ */
        .prod-btn-add-variacao {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 14px;
          margin-top: 12px;
          background: linear-gradient(135deg, #FCE7F3, #FBCFE8);
          color: var(--primary-dark);
          border: 2px dashed var(--primary);
          border-radius: 12px;
          font-family: var(--font-base) !important;
          font-size: 14px;
          font-weight: var(--fw-black);
          cursor: pointer;
          text-transform: none;
          letter-spacing: 0;
          transition: transform 0.08s, filter 0.08s;
        }
        .prod-btn-add-variacao:hover {
          filter: brightness(1.05);
          transform: translateY(-1px);
        }
        .prod-btn-add-variacao:active {
          transform: translateY(0);
        }
        /* ═══ Botão "← Voltar para simples" ═══ */
        .prod-btn-back-simples {
          display: block;
          margin: 10px auto 0;
          padding: 8px 14px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: var(--fw-bold);
          cursor: pointer;
          font-family: var(--font-base) !important;
          text-decoration: underline;
        }
        .prod-btn-back-simples:hover {
          color: var(--text-title);
        }


        /* ═══ WIZARD STEP 3 — CATEGORIA ═══ */
        .wiz-cat-hero {
          text-align: center;
          padding: var(--space-2) 0 var(--space-4);
        }
        .wiz-cat-icon {
          font-size: 44px;
          margin-bottom: 6px;
          filter: drop-shadow(0 4px 12px rgba(232, 90, 140, 0.2));
        }
        .wiz-cat-title {
          font-size: 18px;
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 4px;
          letter-spacing: -0.02em;
        }
        .wiz-cat-sub {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          max-width: 320px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.4;
        }
        .wiz-cat-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          margin-bottom: 12px;
        }
        @media (min-width: 720px) {
          .wiz-cat-list { grid-template-columns: 1fr 1fr; }
        }
        .wiz-cat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: #fff;
          border: 2px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          font-family: var(--font-base) !important;
          text-align: left;
          transition: all 0.15s;
        }
        .wiz-cat-item:hover {
          background: #F5F1F3;
          border-color: #D1CACD;
        }
        .wiz-cat-item--active {
          background: var(--accent, #2D1F26) !important;
          border-color: var(--accent, #2D1F26) !important;
          box-shadow: 0 4px 12px rgba(45, 31, 38, 0.25);
        }
        .wiz-cat-item--active:hover {
          background: var(--accent, #2D1F26) !important;
        }
        .wiz-cat-item-radio {
          width: 20px; height: 20px;
          border-radius: 50%;
          border: 2px solid #D1CACD;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #fff;
        }
        .wiz-cat-item--active .wiz-cat-item-radio {
          background: var(--primary);
          border-color: var(--primary);
        }
        .wiz-cat-item-nome {
          font-size: 14px;
          font-weight: var(--fw-black);
          color: var(--text-title);
        }
        .wiz-cat-item--active .wiz-cat-item-nome { color: #fff; }
        .wiz-cat-nova-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #FCE7F3, #FBCFE8);
          color: var(--primary-dark);
          border: 2px dashed var(--primary);
          border-radius: 12px;
          font-family: var(--font-base) !important;
          font-size: 14px;
          font-weight: var(--fw-black);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: filter 0.1s, transform 0.1s;
        }
        .wiz-cat-nova-btn:hover { filter: brightness(1.05); transform: translateY(-1px); }
        .wiz-cat-nova-form {
          padding: 16px;
          background: var(--primary-light);
          border-radius: 14px;
          border: 1.5px dashed var(--primary);
        }
        .wiz-cat-nova-label {
          font-size: 13px;
          font-weight: var(--fw-black);
          color: var(--primary);
          margin: 0 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .wiz-cat-nova-input {
          width: 100%;
          padding: 12px 14px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          font-family: var(--font-base) !important;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          background: var(--bg-card);
        }
        .wiz-cat-nova-input:focus { border-color: var(--primary); }
        .wiz-cat-icones-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          max-height: 160px;
          overflow-y: auto;
          padding: 2px;
        }
        .wiz-cat-icone-btn {
          aspect-ratio: 1;
          border-radius: 8px;
          border: 2px solid transparent;
          background: rgba(255,255,255,0.7);
          padding: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .wiz-cat-icone-btn img { width: 100%; height: 100%; object-fit: contain; }
        .wiz-cat-icone-btn--active {
          border-color: var(--primary);
          background: var(--bg-card);
        }
        .wiz-cat-cancel {
          flex: 1;
          padding: 12px;
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: 10px;
          font-family: var(--font-base) !important;
          font-size: 13px;
          font-weight: var(--fw-bold);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .wiz-cat-criar {
          flex: 2;
          padding: 12px;
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: var(--font-base) !important;
          font-size: 13px;
          font-weight: var(--fw-black);
          cursor: pointer;
        }
        .wiz-cat-criar:disabled { opacity: 0.5; cursor: not-allowed; }


        /* ═══════════════════════════════════════════════════════════
           VARIAÇÕES DE QUANTIDADE — Toggle PRO + Design D/V3
           ═══════════════════════════════════════════════════════════ */

        /* ── Toggle PRO ── */
        .prod-var-toggle {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; margin-bottom: 12px;
          background: linear-gradient(135deg, #FEF3C7 0%, #FCE7F3 100%);
          border: 1.5px solid #F59E0B;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-base);
        }
        .prod-var-toggle:hover { transform: translateY(-1px); }
        .prod-var-toggle--on {
          background: linear-gradient(135deg, #DCFCE7 0%, #F0FDF4 100%);
          border-color: #16A34A;
        }
        .prod-var-toggle--locked {
          background: #F5F1F3;
          border-color: #E5DFE1;
          opacity: 0.95;
          cursor: default;
        }
        .prod-var-toggle--locked:hover { transform: none; }
        .prod-var-toggle-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.7);
          font-size: 20px; flex-shrink: 0;
        }
        .prod-var-toggle-info { flex: 1; min-width: 0; }
        .prod-var-toggle-title {
          font-size: 13px; font-weight: 800; color: #2D1F26;
          display: flex; align-items: center; gap: 6px;
          flex-wrap: wrap; line-height: 1.25;
        }
        .prod-var-toggle-pro {
          display: inline-flex; align-items: center;
          background: #2D1F26; color: #fff;
          padding: 2px 7px; border-radius: 6px;
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.05em;
        }
        .prod-var-toggle-desc {
          font-size: 11px; color: #6B5D64;
          margin-top: 2px; line-height: 1.35;
        }
        /* Switch iOS */
        .prod-var-switch {
          position: relative;
          width: 42px; height: 24px;
          background: #D1CACD; border-radius: 999px;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .prod-var-switch--on { background: #16A34A; }
        .prod-var-switch--locked {
          opacity: 0.6;
          position: relative;
        }
        .prod-var-switch--locked::after {
          content: "🔒";
          position: absolute;
          top: -3px; right: -6px;
          font-size: 11px;
        }
        .prod-var-switch-thumb {
          position: absolute;
          top: 3px; left: 3px;
          width: 18px; height: 18px;
          background: #fff; border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: left 0.2s;
        }
        .prod-var-switch--on .prod-var-switch-thumb { left: 21px; }

        /* ── Item da lista (design D) ── */
        .prod-var-item {
          display: flex; align-items: stretch;
          background: #fff; border: 1.5px solid #F0EBED;
          border-radius: 10px; margin-bottom: 6px;
          overflow: hidden;
          transition: border-color 0.15s ease;
        }
        .prod-var-item:hover { border-color: #E85A8C; }

        /* Design D — etiqueta rosa gigante */
        .prod-var-item--d .prod-var-tag-side {
          background: linear-gradient(135deg, #E85A8C, #C33A6E);
          color: #fff; padding: 10px 14px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          min-width: 76px;
        }
        .prod-var-tag-num {
          font-size: 20px; font-weight: 800; line-height: 1;
        }
        .prod-var-tag-un {
          font-size: 8px; font-weight: 800;
          margin-top: 3px; letter-spacing: 0.08em; opacity: 0.95;
          text-align: center;
        }
        .prod-var-body {
          flex: 1; padding: 10px 12px;
          display: flex; justify-content: space-between;
          align-items: center; gap: 8px;
          min-width: 0;
        }
        .prod-var-body-info { min-width: 0; flex: 1; }
        .prod-var-preco-big {
          font-size: 16px; font-weight: 800; color: #16A34A;
          line-height: 1.1;
        }
        .prod-var-preco-un-mini {
          font-size: 10px; color: #6B5D64; font-weight: 700;
          margin-top: 2px;
        }

        /* Design V3 — avatar circular (com foto) */
        .prod-var-item--v3 {
          align-items: center; gap: 12px;
          padding: 10px 12px;
        }
        .prod-var-avatar {
          width: 52px; height: 52px; border-radius: 12px;
          background: linear-gradient(135deg, #B45309, #7C2D12);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
          border: 3px solid #E85A8C;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.12s ease;
        }
        .prod-var-avatar:hover { transform: scale(1.05); }
        .prod-var-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .prod-var-avatar--empty {
          background: #FCE7F3;
          color: #E85A8C;
          border-style: dashed;
        }
        .prod-var-avatar-icon { font-size: 20px; }
        .prod-var-avatar-cam {
          position: absolute;
          bottom: -4px; right: -4px;
          background: #E85A8C; color: #fff;
          width: 20px; height: 20px; border-radius: 50%;
          font-size: 9px;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #fff;
        }
        .prod-var-avatar-x {
          position: absolute;
          top: 2px; right: 2px;
          background: rgba(0,0,0,0.65); color: #fff;
          border: none; width: 18px; height: 18px;
          border-radius: 50%;
          font-size: 10px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-family: var(--font-base);
        }
        .prod-var-avatar-x:hover { background: #DC2626; }
        .prod-var-info { flex: 1; min-width: 0; }
        .prod-var-info-top {
          display: flex; align-items: baseline; gap: 6px;
          flex-wrap: wrap;
        }
        .prod-var-num-inline {
          font-size: 17px; font-weight: 800; color: #2D1F26;
          line-height: 1;
        }
        .prod-var-tag-inline {
          display: inline-block;
          background: #F5EEF0; color: #E85A8C;
          font-size: 9px; font-weight: 800;
          padding: 2px 7px; border-radius: 999px;
          letter-spacing: 0.05em;
        }
        .prod-var-preco-row {
          display: flex; align-items: baseline; gap: 6px;
          margin-top: 4px; flex-wrap: wrap;
        }
        .prod-var-preco {
          font-size: 14px; font-weight: 800; color: #16A34A;
        }
        .prod-var-preco-un {
          font-size: 10px; color: #6B5D64; font-weight: 600;
        }

        /* Botões editar/excluir */
        .prod-var-actions {
          display: flex; gap: 4px; flex-shrink: 0;
        }
        .prod-var-btn-mini {
          width: 30px; height: 30px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          background: #F5EEF0; color: #6B5D64;
          border: none; cursor: pointer; font-size: 13px;
          font-family: var(--font-base);
          transition: all 0.12s;
        }
        .prod-var-btn-mini:hover { background: #FCE7F3; color: #E85A8C; }
        .prod-var-btn-mini--del:hover { background: #FEE2E2; color: #DC2626; }

        /* Edição inline do preço */
        .prod-var-edit-row {
          display: flex; align-items: center; gap: 4px;
          border: 1.5px solid #E85A8C; border-radius: 8px;
          background: #fff; padding: 4px 8px;
          max-width: 130px;
        }
        .prod-var-edit-rs {
          font-size: 12px; font-weight: 700; color: #6B5D64;
        }
        .prod-var-edit-input {
          flex: 1; min-width: 0;
          border: none; outline: none;
          font-family: var(--font-base) !important;
          font-size: 14px; font-weight: 800;
          color: #16A34A;
          background: transparent;
          padding: 2px 0;
        }

        /* ── Input V1 — Tag "UNIDADES" colada ── */
        .prod-var-add-row {
          display: flex; gap: 6px; align-items: stretch;
          margin-top: 8px;
        }
        .prod-var-input-group {
          display: flex; align-items: stretch;
          border: 1.5px solid #E5DFE1; border-radius: 10px;
          background: #fff; overflow: hidden;
          flex: 1.4; min-width: 0;
          transition: border-color 0.15s ease;
        }
        .prod-var-input-group:focus-within { border-color: #E85A8C; }
        .prod-var-input {
          flex: 1; padding: 12px 12px; border: none; outline: none;
          font-family: var(--font-base) !important;
          font-size: 15px; font-weight: 700;
          min-width: 0; color: #2D1F26;
          background: transparent;
        }
        .prod-var-input::placeholder {
          font-weight: 500; color: #9A8B93;
        }
        .prod-var-input-tag {
          background: #F5EEF0;
          color: #E85A8C;
          font-size: 10px;
          font-weight: 800;
          padding: 0 12px;
          display: flex; align-items: center;
          letter-spacing: 0.08em;
          border-left: 1px solid #E5DFE1;
          white-space: nowrap;
          font-family: var(--font-base);
        }
        .prod-var-preco-input {
          flex: 1; min-width: 100px;
          display: flex; align-items: center;
          border: 1.5px solid #E5DFE1; border-radius: 10px;
          background: #fff; padding-left: 10px;
          transition: border-color 0.15s ease;
        }
        .prod-var-preco-input:focus-within { border-color: #E85A8C; }
        .prod-var-preco-input span {
          color: #6B5D64; font-weight: 700; font-size: 13px;
          margin-right: 2px;
        }
        .prod-var-preco-input input {
          flex: 1; padding: 12px 12px 12px 0; border: none; outline: none;
          font-family: var(--font-base) !important;
          font-size: 15px; font-weight: 700;
          background: transparent; min-width: 0; color: #2D1F26;
        }
        .prod-var-preco-input input::placeholder {
          font-weight: 500; color: #9A8B93;
        }
        .prod-var-btn-add {
          padding: 12px 16px; background: #E85A8C; color: #fff;
          border: none; border-radius: 10px;
          font-family: var(--font-base) !important;
          font-size: 13px; font-weight: 800;
          box-shadow: 0 3px 0 #C33A6E;
          cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          white-space: nowrap;
          transition: transform 0.08s, box-shadow 0.08s;
        }
        .prod-var-btn-add:hover { filter: brightness(1.05); }
        .prod-var-btn-add:active {
          transform: translateY(3px);
          box-shadow: 0 0 0 #C33A6E;
        }

        /* ── Responsivo: mobile ── */
        @media (max-width: 640px) {
          .prod-var-add-row {
            flex-wrap: wrap;
          }
          .prod-var-input-group {
            flex: 1 1 60%;
            min-width: 0;
          }
          .prod-var-preco-input {
            flex: 1 1 35%;
            min-width: 100px;
          }
          .prod-var-btn-add {
            flex: 1 1 100%;
            justify-content: center;
            padding: 12px;
          }
          .prod-var-toggle {
            padding: 10px 12px;
          }
          .prod-var-toggle-icon {
            width: 36px; height: 36px;
            font-size: 18px;
          }
          .prod-var-item--d .prod-var-tag-side {
            min-width: 66px;
            padding: 8px 10px;
          }
          .prod-var-tag-num { font-size: 18px; }
          .prod-var-preco-big { font-size: 14px; }
          .prod-var-item--v3 {
            padding: 8px 10px;
            gap: 10px;
          }
          .prod-var-avatar {
            width: 46px; height: 46px;
          }
        }

        /* ═══════════════════════════════════════════════════════════
           WIZARD STEP 1 — TELA CHEIA ROSA (escolha do tipo)
           ═══════════════════════════════════════════════════════════ */

        /* Modal em modo step 1: sem overlay escuro, sem cantos, tela cheia */
        .wiz-step1-full {
          background: #FAF8F5;
          color: #2D1F26;
          width: 100%;
          display: flex;
          flex-direction: column;
          font-family: var(--font-base);
          border-radius: inherit;
          position: relative;
        }

        /* X escuro discreto no canto */
        .wiz-step1-x {
          position: absolute;
          top: 16px; right: 16px;
          width: 36px; height: 36px;
          border-radius: 50%;
          background: #FFFFFF;
          color: #2D1F26;
          border: 1.5px solid #E5D8DE;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          z-index: 3;
          font-family: var(--font-base);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          transition: background 0.15s, transform 0.1s;
        }
        .wiz-step1-x:hover { background: #F5F1F3; }
        .wiz-step1-x:active { transform: scale(0.94); }

        /* Hero — título e subtítulo (próximo dos cards) */
        .wiz-step1-hero {
          padding: 32px 24px 20px;
          text-align: center;
          position: relative;
        }
        .wiz-step1-title {
          font-size: 22px;
          font-weight: 800;
          color: #2D1F26;
          letter-spacing: -0.02em;
          line-height: 1.15;
          margin-bottom: 6px;
        }
        .wiz-step1-sub {
          font-size: 13.5px;
          color: #6B5D64;
          line-height: 1.4;
          margin: 0;
        }

        /* Cards */
        /* v3.1 — 3 colunas alinhadas (força redeploy) */
        .wiz-step1-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding: 0 24px 8px;
          max-width: 640px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .wiz-step1-card {
          all: unset;
          padding: 22px 10px;
          border-radius: 16px;
          text-align: center;
          box-sizing: border-box;
          border: 2px solid transparent;
          cursor: pointer;
          font-family: var(--font-base);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 220px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.06);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .wiz-step1-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
        .wiz-step1-card:active { transform: translateY(0); }

        /* Simples — gradiente rosa */
        .wiz-step1-card[data-tipo="simples"] {
          background: linear-gradient(160deg, #FDF3F7 0%, #FAE8EF 100%);
        }
        .wiz-step1-card[data-tipo="simples"] .wiz-step1-card-title,
        .wiz-step1-card[data-tipo="simples"] .wiz-step1-card-desc { color: #831843; }

        /* Variações — gradiente amarelo */
        .wiz-step1-card[data-tipo="variacoes"] {
          background: linear-gradient(160deg, #FEF3C7 0%, #FDE68A 100%);
        }
        .wiz-step1-card[data-tipo="variacoes"] .wiz-step1-card-title,
        .wiz-step1-card[data-tipo="variacoes"] .wiz-step1-card-desc { color: #78350F; }

        /* Personalizável — gradiente rosa escuro */
        .wiz-step1-card[data-tipo="personalizavel"] {
          background: linear-gradient(160deg, #F5F3EF 0%, #E8E5DC 100%);
        }
        .wiz-step1-card[data-tipo="personalizavel"] .wiz-step1-card-title,
        .wiz-step1-card[data-tipo="personalizavel"] .wiz-step1-card-desc { color: #2D1F26; }

        /* Ativo — borda + halo colorido */
        .wiz-step1-card[data-tipo="simples"].wiz-step1-card--ativo {
          border-color: #E85A8C;
          box-shadow: 0 6px 20px rgba(232,90,140,0.28);
        }
        .wiz-step1-card[data-tipo="variacoes"].wiz-step1-card--ativo {
          border-color: #D97706;
          box-shadow: 0 6px 20px rgba(217,119,6,0.28);
        }
        .wiz-step1-card[data-tipo="personalizavel"].wiz-step1-card--ativo {
          border-color: #E85A8C;
          box-shadow: 0 6px 20px rgba(232,90,140,0.28);
          background: linear-gradient(160deg, #FDF3F7 0%, #FAE8EF 100%);
        }
        .wiz-step1-card[data-tipo="personalizavel"].wiz-step1-card--ativo .wiz-step1-card-title,
        .wiz-step1-card[data-tipo="personalizavel"].wiz-step1-card--ativo .wiz-step1-card-desc { color: #831843; }

        /* ─── Label subtipo ─── */
        .wiz-step1-sub-label {
          text-align: center;
          font-size: 11.5px;
          font-weight: 700;
          color: #6B5D64;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin: 22px 0 12px;
        }
        .wiz-step1-sub-star {
          color: #E85A8C;
          font-weight: 800;
          font-size: 13px;
        }

        /* ─── Subcards (3 subtipos) ─── */
        .wiz-step1-subcards {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          padding: 0 24px 8px;
          max-width: 560px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 640px) {
          .wiz-step1-subcards { padding: 0 16px 8px; gap: 8px; }
        }
        .wiz-step1-subcard {
          all: unset;
          padding: 16px 10px;
          border-radius: 12px;
          text-align: center;
          box-sizing: border-box;
          border: 1.5px solid #E5D8DE;
          background: #FAF8F5;
          cursor: pointer;
          font-family: var(--font-base);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
        }
        .wiz-step1-subcard:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .wiz-step1-subcard--ativo {
          border-color: #E85A8C;
          background: #FDF3F7;
          box-shadow: 0 4px 14px rgba(232,90,140,0.2);
        }
        .wiz-step1-subcard-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #F0EBED;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6B5D64;
          transition: background 0.12s, color 0.12s;
        }
        .wiz-step1-subcard--ativo .wiz-step1-subcard-icon {
          background: #FCE0E9;
          color: #E85A8C;
        }
        .wiz-step1-subcard-title {
          font-size: 12px;
          font-weight: 700;
          color: #2D1F26;
          line-height: 1.25;
        }
        .wiz-step1-subcard-desc {
          font-size: 10.5px;
          color: #6B5D64;
          line-height: 1.3;
          font-weight: 500;
        }

        /* ─── Footer com botão avançar ─── */
        .wiz-step1-footer {
          padding: 20px 24px 24px;
          display: flex;
          justify-content: center;
        }
        .wiz-step1-avancar {
          all: unset;
          padding: 14px 32px;
          background: #E85A8C;
          color: #fff;
          font-family: var(--font-base) !important;
          font-size: 14px;
          font-weight: 700;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 3px 0 #C33A6E;
          transition: transform 0.08s, filter 0.08s, box-shadow 0.08s;
          display: inline-flex;
          align-items: center;
          min-width: 180px;
          justify-content: center;
        }
        .wiz-step1-avancar:hover:not(:disabled) { filter: brightness(1.05); }
        .wiz-step1-avancar:active:not(:disabled) {
          transform: translateY(3px);
          box-shadow: 0 0 0 #C33A6E;
        }
        .wiz-step1-avancar:disabled {
          background: #F5DCE6;
          box-shadow: 0 3px 0 #E8C4D2;
          cursor: not-allowed;
        }

        .wiz-step1-card-icon {
          width: 62px;
          height: 62px;
          object-fit: contain;
        }
        .wiz-step1-card-title {
          font-size: 15.5px;
          font-weight: 800;
          letter-spacing: -0.01em;
          line-height: 1.2;
        }
        .wiz-step1-card-desc {
          font-size: 12.5px;
          font-weight: 600;
          line-height: 1.4;
          opacity: 0.85;
        }

        /* Hint no fim */
        .wiz-step1-hint {
          text-align: center;
          padding: 12px 24px 24px;
          font-size: 12px;
          color: #9A8B93;
          font-style: italic;
          margin: 0;
        }

        /* Responsivo mobile */
        @media (max-width: 640px) {
          .wiz-step1-hero { padding: 24px 16px 16px; }
          .wiz-step1-title { font-size: 20px; }
          .wiz-step1-sub { font-size: 13px; }
          .wiz-step1-cards {
            padding: 0 16px 8px;
            gap: 10px;
            grid-template-columns: 1fr 1fr;
          }
          .wiz-step1-card[data-tipo="personalizavel"] {
            grid-column: 1 / -1;
          }
          .wiz-step1-card {
            padding: 20px 12px;
            min-height: 170px;
            border-radius: 14px;
            gap: 10px;
          }
          .wiz-step1-card[data-tipo="personalizavel"] {
            min-height: auto;
            padding: 18px 16px;
            flex-direction: row;
            text-align: left;
            gap: 14px;
          }
          .wiz-step1-card[data-tipo="personalizavel"] .wiz-step1-card-icon {
            width: 44px; height: 44px;
            flex-shrink: 0;
          }
          .wiz-step1-card[data-tipo="personalizavel"] .wiz-step1-card-title { font-size: 14px; }
          .wiz-step1-card[data-tipo="personalizavel"] .wiz-step1-card-desc { font-size: 11.5px; margin-top: 2px; }
          .wiz-step1-card-icon { width: 48px; height: 48px; }
          .wiz-step1-card-title { font-size: 13.5px; }
          .wiz-step1-card-desc { font-size: 11.5px; }
        }



        /* ═══════════════════════════════════════════════════════════
           WIZARD NOVO — Design limpo com progresso, header e rodapé
           ═══════════════════════════════════════════════════════════ */

        /* Modal com cantos menos arredondados */
        .prod-modal--novo {
          border-radius: 18px !important;
          max-width: 780px !important;
          height: 90vh !important;
          max-height: 90vh !important;
        }
        @media (max-width: 640px) {
          .prod-modal--novo {
            border-radius: 14px !important;
            max-width: 100% !important;
            height: 92vh !important;
            max-height: 92vh !important;
          }
        }

        /* ═══ Header limpo com eyebrow ═══ */
        .prod-modal-header-novo {
          display: flex;
          align-items: center;
          padding: 28px 32px 12px;
          background: #fff;
          font-family: var(--font-base);
          gap: 12px;
          flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .prod-modal-header-novo { padding: 16px 16px 8px; }
        }
        .prod-modal-back-novo {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: transparent;
          color: #6B5D64;
          border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.12s;
          flex-shrink: 0;
        }
        .prod-modal-back-novo:hover {
          background: #F5EEF0;
          color: #E85A8C;
        }
        .prod-modal-title-wrap {
          flex: 1;
          text-align: center;
          font-family: var(--font-base);
        }
        .prod-modal-eyebrow {
          font-size: 11px;
          font-weight: 700;
          color: #9A8B93;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .prod-modal-title-novo {
          font-size: 18px;
          font-weight: 800;
          color: #2D1F26;
          letter-spacing: -0.01em;
        }
        @media (max-width: 640px) {
          .prod-modal-title-novo { font-size: 16px; }
        }
        .prod-modal-close-novo {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: #F5F1F3;
          color: #6B5D64;
          border: none;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          font-family: var(--font-base);
          flex-shrink: 0;
        }
        .prod-modal-close-novo:hover { background: #E5D8DE; color: #2D1F26; }

        /* ═══ Progresso — barra fina gradient ═══ */
        .prod-progresso-bar-wrap {
          height: 4px;
          background: #F0EBED;
          border-radius: 999px;
          margin: 12px 32px 24px;
          overflow: hidden;
          font-family: var(--font-base);
        }
        @media (max-width: 640px) {
          .prod-progresso-bar-wrap { margin: 12px 16px 18px; }
        }

        /* ═══ Nome do produto na edição (sob o título) ═══ */
        .prod-modal-edit-nome {
          font-size: 12.5px;
          color: #6B5D64;
          font-weight: 600;
          margin-top: 2px;
        }

        /* ═══ Tabs do modo edição ═══ */
        .prod-edit-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          margin: 12px 24px 16px;
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          align-self: flex-start;
          max-width: calc(100% - 48px);
          box-sizing: border-box;
          flex-shrink: 0;
        }
        @media (max-width: 720px) {
          .prod-edit-tabs {
            margin: 10px 16px 14px;
            max-width: calc(100% - 32px);
            width: calc(100% - 32px);
          }
        }
        .prod-edit-tab {
          /* Reset controlado do botão nativo (sem 'all: unset') */
          appearance: none;
          border: none;
          background: transparent;
          box-sizing: border-box;

          /* Layout estável — altura fixa evita jump */
          min-height: 34px;
          padding: 0 14px;
          flex-shrink: 0;

          /* Tipografia */
          font-family: var(--font-base);
          font-size: 12.5px;
          font-weight: 700;
          color: #6B5D64;
          line-height: 1;

          cursor: pointer;
          border-radius: 8px;
          white-space: nowrap;
          transition: background 0.15s ease, color 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;

          /* Sombra transparente reservada — evita jump quando fica ativo */
          box-shadow: 0 2px 6px rgba(232, 90, 140, 0);
        }
        .prod-edit-tab:focus {
          outline: none;
        }
        .prod-edit-tab:focus-visible {
          outline: 2px solid rgba(232, 90, 140, 0.4);
          outline-offset: 1px;
        }
        .prod-edit-tab:hover:not(.prod-edit-tab--ativo) {
          color: #2D1F26;
          background: #F0EBED;
        }
        .prod-edit-tab--ativo {
          color: #fff;
          background: #E85A8C;
          box-shadow: 0 2px 6px rgba(232, 90, 140, 0.25);
        }
        .prod-edit-tab-icon {
          font-size: 14px;
          line-height: 1;
        }
        .prod-progresso-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #E85A8C 0%, #C33A6E 100%);
          border-radius: 999px;
          transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ═══ Rodapé — botões 3D estilo NovaVenda ═══ */
        .prod-modal-footer--novo {
          background: #fff !important;
          padding: 16px 32px 24px !important;
          padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)) !important;
          border-top: 1px solid #F0EBED !important;
          display: flex !important;
          gap: 12px !important;
          align-items: center;
          flex-shrink: 0 !important;
        }
        @media (max-width: 640px) {
          .prod-modal-footer--novo { padding: 12px 16px 16px !important; }
        }
        .prod-btn-cancelar-novo {
          all: unset;
          padding: 13px 18px;
          background: transparent;
          color: #6B5D64;
          font-family: var(--font-base) !important;
          font-size: 13.5px;
          font-weight: 700;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.12s;
          text-align: center;
          box-sizing: border-box;
        }
        .prod-btn-cancelar-novo:hover { background: #F5F1F3; }

        .prod-btn-avancar-novo {
          all: unset;
          flex: 1;
          padding: 14px 20px;
          background: #E85A8C;
          color: #fff;
          border-radius: 10px;
          font-family: var(--font-base) !important;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.01em;
          text-align: center;
          box-shadow: 0 3px 0 #C33A6E;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-sizing: border-box;
          transition: transform 0.08s, filter 0.08s, box-shadow 0.08s;
        }
        .prod-btn-avancar-novo:hover:not(:disabled) { filter: brightness(1.05); }
        .prod-btn-avancar-novo:active:not(:disabled) {
          transform: translateY(3px);
          box-shadow: 0 0 0 #C33A6E;
        }
        .prod-btn-avancar-novo:disabled {
          background: #F5DCE6;
          color: #fff;
          box-shadow: 0 3px 0 #E8C4D2;
          cursor: not-allowed;
        }

        /* ═══ Labels novo estilo ═══ */
        .prod-field-label-novo {
          display: flex !important;
          align-items: center;
          gap: 4px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #2D1F26 !important;
          margin-bottom: 6px !important;
          font-family: var(--font-base) !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
        }
        .prod-field-label-novo::before {
          display: none !important;
        }
        .prod-field-star {
          color: #E85A8C;
          font-weight: 800;
          font-size: 14px;
          line-height: 1;
        }
        .prod-field-req {
          display: inline-block;
          margin-left: 6px;
          color: #E85A8C;
          background: #FCE0E9;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          text-transform: lowercase;
          letter-spacing: 0.02em;
          vertical-align: middle;
        }
        .prod-field-req--opt {
          color: #6B5D64;
          background: #F0EBED;
        }

        /* ═══ Header da descrição (label + botão IA colados) ═══ */
        .prod-desc-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }
        .prod-desc-header .prod-field-label-novo {
          margin-bottom: 0 !important;
        }

        /* ═══ Botão Gerar com IA — preto discreto ═══ */
        .prod-btn-ia-novo {
          all: unset;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          background: #1A1A1A;
          color: #fff;
          font-family: var(--font-base) !important;
          font-size: 11.5px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          transition: transform 0.08s, box-shadow 0.12s, filter 0.12s;
          white-space: nowrap;
        }
        .prod-btn-ia-novo:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          filter: brightness(1.15);
        }
        .prod-btn-ia-novo:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .prod-btn-ia-novo--locked {
          opacity: 0.5;
          cursor: not-allowed !important;
        }
        .prod-btn-ia-novo-crown {
          width: 15px;
          height: 15px;
          object-fit: contain;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }
        .prod-desc-ia-hint {
          font-size: 11px;
          color: #9A8B93;
          margin: 6px 0 0;
          font-style: italic;
        }

        /* CTA PRO IA — banner discreto abaixo da descrição */
        .prod-cta-pro-ia {
          padding: 10px 14px;
          background: linear-gradient(135deg, #FDF3F7 0%, #FCE0E9 100%);
          border: 1px solid #FCE0E9;
          border-radius: 10px;
          margin-top: 10px;
        }
        .prod-cta-pro-ia-txt {
          font-size: 12.5px;
          color: #831843;
          line-height: 1.4;
        }
        .prod-cta-pro-ia-txt b { color: #E85A8C; font-weight: 700; }
        .prod-cta-pro-ia-info {
          all: unset;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px; height: 20px;
          border-radius: 50%;
          color: #E85A8C;
          cursor: pointer;
          margin-left: 6px;
          vertical-align: middle;
          transition: all 0.15s;
        }
        .prod-cta-pro-ia-info:hover {
          background: #E85A8C;
          color: #fff;
        }

        /* Modal empty-state PRO */
        .prod-pro-modal-ov {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 3000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: prodProModalFadeIn 0.2s ease;
        }
        @keyframes prodProModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .prod-pro-modal {
          background: #fff;
          border-radius: 20px;
          padding: 32px 28px 24px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          animation: prodProModalIn 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          position: relative;
        }
        @keyframes prodProModalIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .prod-pro-modal-close {
          all: unset;
          position: absolute;
          top: 14px; right: 14px;
          width: 32px; height: 32px;
          border-radius: 50%;
          background: #FAF8F5;
          color: #6B5D64;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: 16px;
          font-weight: 700;
          transition: all 0.15s;
        }
        .prod-pro-modal-close:hover { background: #E5D8DE; color: #2D1F26; }
        .prod-pro-modal-logo {
          width: 72px; height: 72px;
          margin: 0 auto 14px;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 4px 12px rgba(232,90,140,0.25));
        }
        .prod-pro-modal-eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: #E85A8C;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 4px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          justify-content: center;
        }
        .prod-pro-modal-title {
          font-size: 22px;
          font-weight: 800;
          color: #2D1F26;
          margin: 4px 0 8px;
          line-height: 1.2;
        }
        .prod-pro-modal-sub {
          font-size: 13.5px;
          color: #6B5D64;
          line-height: 1.5;
          margin: 0 0 20px;
        }
        .prod-pro-modal-beneficios {
          background: #FAF8F5;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .prod-pro-modal-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .prod-pro-modal-item-check {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #FCE0E9;
          color: #E85A8C;
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .prod-pro-modal-item-txt {
          font-size: 12.5px;
          color: #2D1F26;
          line-height: 1.4;
        }
        .prod-pro-modal-item-txt b { color: #831843; }
        .prod-pro-modal-cta {
          display: block;
          width: 100%;
          padding: 14px;
          background: #1A1A1A;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-sizing: border-box;
        }
        .prod-pro-modal-cta:hover { background: #E85A8C; }
        .prod-pro-modal-later {
          all: unset;
          display: block;
          text-align: center;
          margin-top: 10px;
          font-size: 12px;
          color: #6B5D64;
          cursor: pointer;
          padding: 6px;
          font-family: inherit;
        }
        .prod-pro-modal-later:hover { color: #2D1F26; }
        /* ═══ SABORES E TAMANHOS STEP (variações) ═══ */
        .st-hint-topo {
          font-size: 12.5px;
          color: #6B5D64;
          margin: 0 0 16px;
          line-height: 1.4;
        }
        .st-subtipo-wrap {
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 20px;
        }
        .st-subtipo-label {
          font-size: 12px;
          font-weight: 700;
          color: #2D1F26;
          margin-bottom: 10px;
        }
        .st-subcards {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        @media (max-width: 640px) {
          .st-subcards { grid-template-columns: 1fr; gap: 6px; }
        }
        .st-subcard {
          all: unset;
          padding: 12px 8px;
          border-radius: 10px;
          text-align: center;
          box-sizing: border-box;
          border: 1.5px solid #E5D8DE;
          background: #fff;
          cursor: pointer;
          font-family: var(--font-base);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
        }
        .st-subcard:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.06); }
        .st-subcard--ativo {
          border-color: #E85A8C;
          background: #FDF3F7;
          box-shadow: 0 3px 10px rgba(232,90,140,0.18);
        }
        .st-subcard-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #F0EBED;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6B5D64;
          transition: background 0.12s, color 0.12s;
        }
        .st-subcard--ativo .st-subcard-icon {
          background: #FCE0E9;
          color: #E85A8C;
        }
        .st-subcard-title { font-size: 11.5px; font-weight: 700; color: #2D1F26; line-height: 1.2; }
        .st-subcard-desc { font-size: 10px; color: #6B5D64; line-height: 1.3; }

        /* Seções (Sabores / Tamanhos) */
        .st-secao {
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .st-secao-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .st-secao-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          font-weight: 700;
          color: #2D1F26;
        }
        .st-secao-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .st-secao-dot--rosa { background: #E85A8C; }
        .st-secao-dot--azul { background: #3B82F6; }
        .st-secao-count {
          font-size: 10.5px;
          font-weight: 700;
          color: #E85A8C;
          background: #FCE0E9;
          padding: 2px 7px;
          border-radius: 999px;
          margin-left: 6px;
        }

        .st-add-row {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
        }
        .st-add-input {
          flex: 1;
          padding: 10px 12px;
          border: 1.5px solid #E5D8DE;
          border-radius: 8px;
          font-family: var(--font-base);
          font-size: 13px;
          outline: none;
          transition: border-color 0.12s;
        }
        .st-add-input:focus { border-color: #E85A8C; }
        .st-add-btn {
          all: unset;
          width: 40px;
          height: 40px;
          background: #1A1A1A;
          color: #fff;
          border-radius: 8px;
          font-size: 20px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: filter 0.12s;
          flex-shrink: 0;
        }
        .st-add-btn:hover:not(:disabled) { filter: brightness(1.15); }
        .st-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .st-empty {
          text-align: center;
          padding: 24px 16px;
          background: #FAF8F5;
          border: 1.5px dashed #E5D8DE;
          border-radius: 10px;
          color: #9A8B93;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .st-lista {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .st-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 8px;
        }
        .st-item-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #FCE0E9;
          color: #E85A8C;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .st-item-label {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: #2D1F26;
        }
        .st-item-remove {
          all: unset;
          cursor: pointer;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          color: #9A8B93;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s, color 0.12s;
        }
        .st-item-remove:hover { background: #FEE2E2; color: #DC2626; }

        .st-hint {
          font-size: 10.5px;
          color: #9A8B93;
          margin: 8px 0 0;
          font-style: italic;
        }

        /* Grid de preços */
        .st-grid-wrap {
          overflow-x: auto;
          border: 1px solid #F0EBED;
          border-radius: 10px;
        }
        .st-grid {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-base);
        }
        .st-grid thead th {
          background: #FAF8F5;
          padding: 10px 8px;
          font-size: 11.5px;
          font-weight: 700;
          color: #2D1F26;
          text-align: center;
          border-bottom: 1px solid #F0EBED;
        }
        .st-grid-corner {
          text-align: left !important;
          padding-left: 14px !important;
          color: #6B5D64 !important;
        }
        .st-grid tbody td {
          padding: 8px;
          border-bottom: 1px solid #F5F1F3;
        }
        .st-grid tbody tr:last-child td { border-bottom: none; }
        .st-grid-sabor {
          padding-left: 14px !important;
          font-size: 12.5px;
          font-weight: 700;
          color: #2D1F26;
          white-space: nowrap;
        }
        .st-grid-cell {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border: 1px solid #E5D8DE;
          border-radius: 6px;
          background: #fff;
          transition: border-color 0.12s;
        }
        .st-grid-cell:focus-within { border-color: #E85A8C; }
        .st-grid-rs {
          font-size: 10.5px;
          font-weight: 700;
          color: #059669;
        }
        .st-grid-input {
          all: unset;
          width: 60px;
          font-size: 12.5px;
          font-weight: 600;
          color: #2D1F26;
          text-align: right;
        }
        .st-grid-input::-webkit-outer-spin-button,
        .st-grid-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        /* Lista de preços simples (só sabores ou só tamanhos) */
        .st-preco-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 8px;
          margin-bottom: 6px;
        }
        .st-preco-label {
          flex: 1;
          font-size: 13px;
          font-weight: 700;
          color: #2D1F26;
        }
        .st-preco-input-wrap {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border: 1.5px solid #E5D8DE;
          border-radius: 8px;
          background: #fff;
          transition: border-color 0.12s;
        }
        .st-preco-input-wrap:focus-within { border-color: #E85A8C; }
        .st-preco-input {
          all: unset;
          width: 80px;
          font-size: 13px;
          font-weight: 700;
          color: #2D1F26;
          text-align: right;
        }
        .st-preco-input::-webkit-outer-spin-button,
        .st-preco-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        .st-cross-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          background: #FEF3C7;
          border: 1px solid #FDE68A;
          border-radius: 10px;
          color: #78350F;
          font-size: 12.5px;
          font-weight: 600;
          margin-bottom: 14px;
        }

        /* ═══ Header preços com toggle grid/lista ═══ */
        .st-precos-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .st-precos-toggle {
          display: inline-flex;
          background: #F5F1F3;
          border-radius: 8px;
          padding: 2px;
          gap: 2px;
        }
        .st-precos-toggle-btn {
          all: unset;
          cursor: pointer;
          width: 30px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          color: #9A8B93;
          transition: background 0.12s, color 0.12s;
        }
        .st-precos-toggle-btn:hover { color: #6B5D64; }
        .st-precos-toggle-btn--ativo {
          background: #fff;
          color: #E85A8C;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .st-precos-tip {
          font-size: 11px;
          color: #78350F;
          background: #FEF9C3;
          border: 1px solid #FEF08A;
          border-radius: 6px;
          padding: 6px 10px;
          margin-bottom: 10px;
        }

        /* ═══ Modo lista de combinações ═══ */
        .st-combo-lista {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .st-combo-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 8px;
        }
        .st-combo-labels {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .st-combo-sabor {
          font-size: 13px;
          font-weight: 700;
          color: #2D1F26;
        }
        .st-combo-sep {
          font-size: 12px;
          color: #B4A9AE;
          font-weight: 600;
        }
        .st-combo-tam {
          font-size: 12.5px;
          font-weight: 600;
          color: #6B5D64;
          padding: 2px 8px;
          background: #F0EBED;
          border-radius: 6px;
        }

        /* ═══ Modal aviso troca subtipo ═══ */
        .st-confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: var(--font-base);
        }
        .st-confirm-modal {
          background: #fff;
          border-radius: 14px;
          max-width: 420px;
          width: 100%;
          padding: 24px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
        }
        .st-confirm-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 800;
          color: #78350F;
          margin: 0 0 12px;
        }
        .st-confirm-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #FEF3C7;
          color: #D97706;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .st-confirm-body {
          font-size: 13.5px;
          color: #2D1F26;
          line-height: 1.5;
          margin: 0 0 8px;
        }
        .st-confirm-warning {
          font-size: 12px;
          color: #6B5D64;
          margin: 0 0 20px;
        }
        .st-confirm-btns {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .st-confirm-btn-cancel {
          all: unset;
          padding: 10px 18px;
          border-radius: 8px;
          border: 1.5px solid #E5D8DE;
          background: #fff;
          color: #2D1F26;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s;
        }
        .st-confirm-btn-cancel:hover { background: #FAF8F5; }
        .st-confirm-btn-ok {
          all: unset;
          padding: 10px 20px;
          border-radius: 8px;
          background: #D97706;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: filter 0.12s;
        }
        .st-confirm-btn-ok:hover { filter: brightness(1.1); }

        /* ═══ Slot de foto bloqueado (PRO) ═══ */
        .prod-slot-pro-corner {
          position: absolute;
          top: 6px;
          right: 6px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 6px;
          background: #1A1A1A;
          color: #fff;
          font-family: var(--font-base);
          font-size: 9px;
          font-weight: 700;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          z-index: 2;
          letter-spacing: 0.03em;
        }
        .prod-slot-pro-corner img {
          width: 9px;
          height: 9px;
          object-fit: contain;
        }
        /* Novo: slot PRO grafite Doonly */
        .prod-slot-pro-tag {
          position: absolute;
          top: 8px;
          right: 8px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: #2D1F26;
          color: #fff;
          font-family: var(--font-base);
          font-size: 10px;
          font-weight: 800;
          border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          z-index: 2;
          letter-spacing: 0.1em;
          line-height: 1;
          text-transform: uppercase;
        }
        .prod-slot-pro-tag .coroa-badge {
          width: 10px;
          height: 10px;
          object-fit: contain;
        }
        .prod-slot-locked-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          gap: 8px;
        }
        .prod-slot-lock-circle {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          background: rgba(232,90,140,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .prod-slot-lock-txt {
          font-size: 10.5px;
          color: #F5B8CD;
          font-weight: 600;
          font-family: var(--font-base);
          letter-spacing: 0.02em;
        }
        .prod-slot-lock-txt-rgb {
          background: linear-gradient(90deg, #F5B8CD, #C4B5FD, #93C5FD, #86EFAC, #FCD34D, #F5B8CD);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          font-weight: 800;
          animation: prodRgbFlow 6s linear infinite;
        }
        @keyframes prodRgbFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        .prod-img-upload--locked {
          transition: transform 0.15s ease;
        }
        .prod-img-upload--locked:hover {
          transform: translateY(-2px);
        }
        /* Antigos — mantidos por compatibilidade */
        .prod-slot-lock-icon {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #F0EBED;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .prod-slot-lock-icon svg { width: 12px; height: 12px; }
        .prod-slot-locked-txt {
          font-size: 10px;
          color: #6B5D64;
          font-weight: 700;
          font-family: var(--font-base);
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        /* ═══ Sub-toggle "Foto por opção" (global — usado no step 4) ═══ */
        .pv3-sub-toggle {
          all: unset;
          padding: 12px 14px;
          background: linear-gradient(135deg, #FEF3C7 0%, #FEF9E7 100%);
          border: 1.5px solid #FDE68A;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          box-sizing: border-box;
          width: 100%;
        }
        .pv3-sub-toggle:hover { border-color: #F59E0B; }
        .pv3-sub-toggle--on {
          background: linear-gradient(135deg, #FDF3F7 0%, #FCE0E9 100%);
          border-color: #E85A8C;
        }
        .pv3-sub-toggle-ico {
          width: 34px !important; height: 34px !important;
          background: #fff;
          color: #92400E;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pv3-sub-toggle-ico svg { width: 18px; height: 18px; }
        .pv3-sub-toggle--on .pv3-sub-toggle-ico { color: #E85A8C; }
        .pv3-sub-toggle-txt { flex: 1; min-width: 0; text-align: left; }
        .pv3-sub-toggle-titulo {
          font-size: 13px;
          font-weight: 700;
          color: #2D1F26;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pv3-sub-toggle-crown {
          width: 14px !important;
          height: 14px !important;
          object-fit: contain;
          display: inline-block;
          flex-shrink: 0;
        }
        .pv3-sub-toggle-desc {
          font-size: 11.5px;
          color: #6B5D64;
          margin-top: 2px;
        }
        .pv3-mini-switch {
          width: 36px !important; height: 20px !important;
          background: #E5D8DE;
          border-radius: 999px;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .pv3-mini-switch--on { background: #E85A8C; }
        .pv3-mini-switch-thumb {
          width: 14px; height: 14px;
          background: #fff;
          border-radius: 50%;
          position: absolute;
          top: 3px; left: 3px;
          transition: left 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        .pv3-mini-switch--on .pv3-mini-switch-thumb { left: 19px; }

        /* Linha de foto por opção (quadradinho + nome + CTA) */
        .prod-opcao-foto-linha {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: #fff;
          border: 1.5px solid #F0EBED;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .prod-opcao-foto-linha:hover {
          border-color: #E85A8C;
          box-shadow: 0 2px 8px rgba(232, 90, 140, 0.08);
        }
        .prod-opcao-foto-mini {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          background: #FAF8F5;
          border: 2px dashed #E5D8DE;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
        }
        .prod-opcao-foto-mini img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .prod-opcao-foto-mini-remove {
          position: absolute;
          top: 2px; right: 2px;
          width: 18px; height: 18px;
          background: rgba(0,0,0,0.75);
          color: #fff;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 9px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .prod-opcao-foto-linha-nome {
          flex: 1;
          font-size: 14px;
          font-weight: 700;
          color: #2D1F26;
        }
        .prod-opcao-foto-linha-cta {
          font-size: 12px;
          font-weight: 700;
          color: #E85A8C;
          background: #FDF3F7;
          padding: 6px 10px;
          border-radius: 6px;
          flex-shrink: 0;
        }

        /* ═══ Cards de foto por opção (V3 PRO) ═══ */
        .prod-opcao-foto-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
        }
        .prod-opcao-foto-slot {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 12px;
          background: #FAF8F5;
          border: 2px dashed #E5D8DE;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          position: relative;
          transition: all 0.15s;
        }
        .prod-opcao-foto-card:hover .prod-opcao-foto-slot {
          border-color: #E85A8C;
          background: #FDF3F7;
        }
        .prod-opcao-foto-slot img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .prod-opcao-foto-remove {
          position: absolute;
          top: 6px; right: 6px;
          width: 24px; height: 24px;
          background: rgba(0,0,0,0.7);
          color: #fff;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .prod-opcao-foto-remove:hover { background: #DC2626; }
        .prod-opcao-foto-nome {
          font-size: 12.5px;
          font-weight: 700;
          color: #2D1F26;
          margin-top: 6px;
          text-align: center;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ═══ Fotos das variações (step 4) ═══ */
        .prod-var-fotos-lock {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: #FAF8F5;
          border: 1.5px dashed #E5D8DE;
          border-radius: 12px;
        }
        .prod-var-fotos-lock-logo {
          width: 44px;
          height: 44px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .prod-var-fotos-lista {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .prod-var-foto-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: #FAF8F5;
          border: 1px solid #F0EBED;
          border-radius: 10px;
        }
        .prod-var-foto-thumb {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          background: #F0EBED;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
        }
        .prod-var-foto-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .prod-var-foto-remove {
          all: unset;
          position: absolute;
          top: 2px;
          right: 2px;
          background: rgba(0,0,0,0.6);
          color: #fff;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .prod-var-foto-label {
          flex: 1;
          font-size: 13px;
          font-weight: 700;
          color: #2D1F26;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .prod-var-foto-btn {
          padding: 6px 12px;
          background: #1A1A1A;
          color: #fff;
          font-family: var(--font-base);
          font-size: 11.5px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          transition: filter 0.12s;
          flex-shrink: 0;
        }
        .prod-var-foto-btn:hover { filter: brightness(1.15); }

        /* Labels rosa (legado — mantidos pra outros steps) */
        .prod-field-label--rosa {
          color: #E85A8C !important;
          font-weight: 700 !important;
        }
        .prod-field-obrig {
          font-size: 11px !important;
          font-style: normal !important;
          color: #9A8B93 !important;
          font-weight: 500 !important;
          margin-left: 4px;
        }

        /* CTA IA no textarea vazio (V3) */
        .prod-desc-empty-cta {
          padding: 20px 16px;
          background: linear-gradient(135deg, #FDFAFF 0%, #FDF7FA 100%);
          border: 1.5px dashed #E5DBEB;
          border-radius: 10px;
          text-align: center;
          transition: all 0.15s;
        }
        .prod-desc-empty-cta:hover {
          border-color: #A855F7;
          background: linear-gradient(135deg, #FAF0FF 0%, #FDF7FA 100%);
        }
        .prod-desc-empty-icon {
          font-size: 24px;
          margin-bottom: 6px;
          line-height: 1;
        }
        .prod-desc-empty-txt {
          font-size: 12px;
          color: #6B5D64;
          margin-bottom: 12px;
          line-height: 1.4;
        }
        .prod-desc-empty-txt b {
          color: #A855F7;
          font-weight: 800;
        }
        .prod-desc-empty-hint {
          font-size: 10px;
          color: #9A8B93;
          margin-top: 8px;
          font-style: italic;
        }
        .prod-desc-btn-write {
          padding: 8px 14px;
          background: #fff;
          border: 1.5px solid #E5DFE1;
          color: #6B5D64;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.12s;
        }
        .prod-desc-btn-write:hover {
          border-color: #E85A8C;
          color: #E85A8C;
        }
        .prod-desc-btn-ia {
          padding: 8px 14px;
          background: linear-gradient(135deg, #A855F7, #EC4899);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          box-shadow: 0 2px 8px rgba(168, 85, 247, 0.3);
          transition: transform 0.08s, filter 0.08s;
        }
        .prod-desc-btn-ia:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        .prod-desc-btn-ia--locked {
          background: linear-gradient(135deg, #A855F7, #EC4899) !important;
          opacity: 0.55;
          cursor: not-allowed;
        }
        .prod-desc-btn-ia-crown {
          width: 12px;
          height: 12px;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }

        /* Categoria compacta */
        .prod-cat-nova-btn {
          padding: 11px 14px;
          background: #FCE7F3;
          color: #E85A8C;
          border: 1.5px dashed #E85A8C;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          display: flex; align-items: center; gap: 4px;
          white-space: nowrap;
        }
        .prod-cat-nova-btn:hover { background: #FBCFE8; }
        .prod-cat-nova-form {
          padding: 12px;
          background: #FDF7FA;
          border: 1.5px dashed #E85A8C;
          border-radius: 10px;
        }
        .prod-cat-nova-hint {
          font-size: 11px;
          font-weight: 800;
          color: #E85A8C;
          margin: 0 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .prod-cat-nova-form input {
          width: 100%;
          padding: 11px 12px;
          border: 1.5px solid #E5DFE1;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 14px;
          outline: none;
          background: #fff;
          box-sizing: border-box;
        }
        .prod-cat-nova-form input:focus { border-color: #E85A8C; }
        .prod-cat-cancel-btn {
          flex: 1;
          padding: 10px;
          background: #fff;
          border: 1.5px solid #E5DFE1;
          color: #6B5D64;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .prod-cat-criar-btn {
          flex: 2;
          padding: 10px;
          background: #E85A8C;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-family: var(--font-base) !important;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .prod-cat-criar-btn:disabled { opacity: 0.5; cursor: not-allowed; }



        /* ═══════════════════════════════════════════════════════════
           TOGGLE "OFEREÇO DESCONTO POR PACOTE?" + PREÇO COM TAG
           ═══════════════════════════════════════════════════════════ */

        /* Tag "/UNIDADE" colada dentro do input R$ */
        .prod-preco-input--taginline { overflow: hidden; }
        .prod-preco-input-tag {
          background: #F5EEF0;
          color: #E85A8C;
          font-size: 10px;
          font-weight: 800;
          padding: 0 12px;
          display: flex; align-items: center;
          letter-spacing: 0.08em;
          border-left: 1px solid #E5DFE1;
          align-self: stretch;
          white-space: nowrap;
          font-family: var(--font-base);
        }

        /* Toggle desconto por pacote */
        .prod-pacote-toggle {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; margin-bottom: 12px;
          background: linear-gradient(135deg, #FEF3C7 0%, #FCE7F3 100%);
          border: 1.5px solid #F59E0B;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-base);
        }
        .prod-pacote-toggle:hover { transform: translateY(-1px); }
        .prod-pacote-toggle--on {
          background: linear-gradient(135deg, #DCFCE7 0%, #F0FDF4 100%);
          border-color: #16A34A;
        }
        .prod-pacote-toggle-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.7);
          font-size: 20px; flex-shrink: 0;
        }
        .prod-pacote-toggle-info { flex: 1; min-width: 0; }
        .prod-pacote-toggle-title {
          font-size: 13px; font-weight: 800; color: #2D1F26;
          line-height: 1.25;
        }
        .prod-pacote-toggle-desc {
          font-size: 11px; color: #6B5D64;
          margin-top: 2px; line-height: 1.35;
        }
        .prod-pacote-switch {
          position: relative;
          width: 42px; height: 24px;
          background: #D1CACD; border-radius: 999px;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .prod-pacote-switch--on { background: #16A34A; }
        .prod-pacote-switch-thumb {
          position: absolute;
          top: 3px; left: 3px;
          width: 18px; height: 18px;
          background: #fff; border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: left 0.2s;
        }
        .prod-pacote-switch--on .prod-pacote-switch-thumb { left: 21px; }

        /* Economia % badge */
        .prod-var-eco {
          display: inline-flex; align-items: center;
          background: #DCFCE7; color: #14532D;
          font-size: 10px; font-weight: 800;
          padding: 2px 8px; border-radius: 999px;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        /* Linha adicional: R$/un · sem desconto R$ X */
        .prod-var-preco-un-row {
          display: flex; align-items: baseline; gap: 4px;
          flex-wrap: wrap;
          margin-top: 2px;
        }
        .prod-var-preco-tachado {
          font-size: 10px; color: #9A8B93;
          text-decoration: line-through;
          font-weight: 600;
        }

        /* Responsivo mobile pro toggle */
        @media (max-width: 640px) {
          .prod-pacote-toggle {
            padding: 10px 12px;
          }
          .prod-pacote-toggle-icon {
            width: 36px; height: 36px;
            font-size: 18px;
          }
          .prod-preco-input-tag {
            padding: 0 10px;
            font-size: 9px;
          }
        }

        .prod-discard-ov {
          position: fixed; inset: 0; z-index: 2500;
          background: rgba(45, 31, 38, 0.75);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
          animation: prodDiscOvIn 0.2s ease;
          font-family: var(--font-base);
        }
        @keyframes prodDiscOvIn { from { opacity: 0; } to { opacity: 1; } }
        .prod-discard-box {
          background: var(--bg-card);
          border-radius: var(--radius-xl);
          padding: var(--space-5) var(--space-4);
          max-width: 360px; width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: prodDiscBoxIn 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes prodDiscBoxIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .prod-discard-box, .prod-discard-box * { font-family: var(--font-base) !important; }
        .prod-discard-icon {
          font-size: 32px;
          margin-bottom: var(--space-2);
          filter: drop-shadow(0 2px 8px rgba(232,90,140,0.3));
        }
        .prod-discard-title {
          font-size: var(--text-lg);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 var(--space-2);
          letter-spacing: -0.01em;
        }
        .prod-discard-desc {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin: 0 0 var(--space-4);
          line-height: 1.5;
        }
        .prod-discard-actions {
          display: flex; flex-direction: column;
          gap: var(--space-2);
        }
        .prod-discard-btn {
          padding: 12px;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          font-family: var(--font-base) !important;
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .prod-discard-btn--stay {
          background: var(--primary);
          color: var(--text-inverse);
          box-shadow: 0 4px 0 var(--primary-dark);
        }
        .prod-discard-btn--stay:hover { filter: brightness(1.05); }
        .prod-discard-btn--stay:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
        }
        /* ═══ Mobile Checklist (Etapa 1 Personalização) ═══ */
        .prod-mchk-wrap {
          padding: 6px 4px 20px;
          animation: prod-mchk-in 0.3s ease-out;
        }
        @keyframes prod-mchk-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .prod-mchk-head { margin-bottom: 16px; }
        .prod-mchk-title {
          margin: 0 0 4px;
          font-size: 17px;
          font-weight: 800;
          color: #1F1F23;
          letter-spacing: -0.01em;
        }
        .prod-mchk-sub {
          margin: 0;
          font-size: 13px;
          color: #6B7280;
          line-height: 1.4;
        }
        .prod-mchk-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .prod-mchk-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: #fff;
          border: 2px solid #E5E7EB;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }
        .prod-mchk-item:hover { border-color: #E85A8C; }
        .prod-mchk-item--on {
          border-color: #E85A8C;
          background: #FFF5F9;
          box-shadow: 0 2px 8px rgba(232, 90, 140, 0.15);
        }
        .prod-mchk-checkbox { display: none; }
        .prod-mchk-check-visual {
          width: 22px; height: 22px;
          border-radius: 6px;
          border: 2px solid #D1D5DB;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .prod-mchk-item--on .prod-mchk-check-visual {
          background: #E85A8C;
          border-color: #E85A8C;
        }
        .prod-mchk-ico {
          width: 36px; height: 36px;
          background: #F3F4F6;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: #6B7280;
          flex-shrink: 0;
        }
        .prod-mchk-item--on .prod-mchk-ico {
          background: #FCE0E9;
          color: #E85A8C;
        }
        .prod-mchk-text { flex: 1; min-width: 0; }
        .prod-mchk-item-title {
          margin: 0 0 2px;
          font-size: 14px;
          font-weight: 700;
          color: #1F1F23;
        }
        .prod-mchk-item-sub {
          margin: 0;
          font-size: 11.5px;
          color: #6B7280;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .prod-mchk-continue {
          width: 100%;
          padding: 14px 20px;
          background: #E85A8C;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 14px rgba(232, 90, 140, 0.4);
          transition: all 0.15s ease;
        }
        .prod-mchk-continue:hover { background: #d54a7a; transform: translateY(-1px); }
        .prod-mchk-continue:disabled {
          background: #E5E7EB;
          color: #9CA3AF;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
        .prod-mchk-hint {
          text-align: center;
          font-size: 12px;
          color: #9CA3AF;
          margin: 8px 0 0;
        }
        .prod-mchk-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #F3F4F6;
          color: #4B5563;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          margin-bottom: 14px;
          transition: background 0.15s ease;
        }
        .prod-mchk-back:hover { background: #E5E7EB; }

        /* ═══ Banner Rascunho Salvo (mobile) ═══ */
        .prod-draft-banner {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 14px;
          margin: 0 0 16px;
          background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
          border-left: 4px solid #F59E0B;
          border-radius: 10px;
          animation: prod-draft-in 0.35s ease-out;
        }
        @keyframes prod-draft-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .prod-draft-banner-icon {
          color: #B45309;
          flex-shrink: 0;
        }
        .prod-draft-banner-text { flex: 1; min-width: 0; }
        .prod-draft-banner-title {
          margin: 0;
          font-size: 13.5px;
          font-weight: 800;
          color: #78350F;
          line-height: 1.2;
        }
        .prod-draft-banner-sub {
          margin: 2px 0 0;
          font-size: 11.5px;
          font-weight: 500;
          color: #92400E;
          line-height: 1.3;
        }
        .prod-draft-banner-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .prod-draft-btn {
          padding: 7px 12px;
          border-radius: 8px;
          border: none;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .prod-draft-btn--secondary {
          background: rgba(120, 53, 15, 0.1);
          color: #78350F;
        }
        .prod-draft-btn--secondary:hover { background: rgba(120, 53, 15, 0.18); }
        .prod-draft-btn--primary {
          background: #F59E0B;
          color: #fff;
          box-shadow: 0 2px 6px rgba(245, 158, 11, 0.4);
        }
        .prod-draft-btn--primary:hover { background: #D97706; }
        @media (max-width: 480px) {
          .prod-draft-banner {
            flex-wrap: wrap;
          }
          .prod-draft-banner-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }

        .prod-discard-btn--go {
          background: transparent;
          color: #DC2626;
          border: 1.5px solid #FEE2E2;
        }
        .prod-discard-btn--go:hover {
          background: #FEE2E2;
          border-color: #DC2626;
        }

        .wiz-tipo-ex {
          font-size: 12px;
          color: var(--text-muted);
          font-style: italic;
          margin: 3px 0 0;
          line-height: 1.3;
        }
        .wiz-tipo-list, .wiz-opts-list { gap: 8px !important; }
        .wiz-tipo-card, .wiz-opt-card {
          flex-direction: row !important;
          align-items: center !important;
          text-align: left !important;
          gap: 14px !important;
          padding: 16px 16px !important;
          border-radius: 12px !important;
          background: #fff !important;
          border: 2px solid var(--border) !important;
          box-shadow: 0 1px 3px rgba(45,31,38,0.06);
        }
        /* Hover: cinza bem sutil, NÃO rosa */
        .wiz-tipo-card:hover, .wiz-opt-card:hover {
          background: #F5F1F3 !important;
          border-color: #D1CACD !important;
        }
        /* Hover no card JÁ SELECIONADO: mantém cinza escuro fixo (não muda) */
        .wiz-tipo-card--active:hover, .wiz-opt-card--active:hover {
          background: var(--accent, #2D1F26) !important;
          border-color: var(--accent, #2D1F26) !important;
        }
        /* No touch (mobile), remove hover pra não ficar "sticky" após tap */
        @media (hover: none) {
          .wiz-tipo-card:hover, .wiz-opt-card:hover {
            background: #fff !important;
          }
          .wiz-tipo-card--active:hover, .wiz-opt-card--active:hover {
            background: var(--accent, #2D1F26) !important;
          }
        }
        .wiz-tipo-card--active, .wiz-opt-card--active {
          background: var(--accent, #2D1F26) !important;
          border-color: var(--accent, #2D1F26) !important;
          box-shadow: 0 4px 12px rgba(45, 31, 38, 0.25);
        }
        .wiz-tipo-icon {
          font-size: 32px !important;
          line-height: 1;
          flex-shrink: 0;
        }
        .wiz-tipo-info {
          flex: 1;
          min-width: 0;
          display: flex; flex-direction: column; gap: 1px;
        }
        .wiz-tipo-title {
          font-size: 15px !important;
          font-weight: var(--fw-black) !important;
          color: var(--text-title) !important;
          margin: 0 !important;
          letter-spacing: -0.01em;
        }
        .wiz-tipo-desc {
          font-size: 12px !important;
          color: var(--text-secondary) !important;
          margin: 0 !important;
          line-height: 1.35 !important;
        }
        /* Estado ativo: texto branco no fundo cinza escuro */
        .wiz-tipo-card--active .wiz-tipo-title,
        .wiz-tipo-card--active .wiz-tipo-desc,
        .wiz-opt-card--active .wiz-tipo-title,
        .wiz-opt-card--active .wiz-tipo-desc {
          color: #FFFFFF !important;
        }
        .wiz-tipo-card--active .wiz-tipo-ex,
        .wiz-opt-card--active .wiz-tipo-ex {
          color: rgba(255,255,255,0.75) !important;
        }
        /* Radio/check no active */
        .wiz-tipo-card--active .wiz-tipo-radio,
        .wiz-opt-card--active .wiz-opt-check {
          background: var(--primary) !important;
          border-color: var(--primary) !important;
        }
        .wiz-tipo-radio {
          width: 20px; height: 20px;
          border-radius: 50%;
          border: 2px solid #D1CACD;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #fff;
        }
        .wiz-tipo-radio--active {
          background: var(--primary);
          border-color: var(--primary);
        }
        .wiz-opt-check {
          width: 20px; height: 20px;
          border-radius: 6px;
          border: 2px solid #D1CACD;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #fff;
        }
        .wiz-opt-check--active {
          background: var(--primary) !important;
          border-color: var(--primary) !important;
        }
        .wiz-section-title {
          font-size: 12px !important;
          font-weight: var(--fw-bold) !important;
          color: var(--text-title) !important;
          margin: 6px 0 0 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
        }
        .wiz-step-label {
          color: var(--primary) !important;
          font-weight: var(--fw-black) !important;
          font-size: 10px !important;
        }
        .wiz-progress-bar { height: 3px !important; border-radius: 999px !important; background: #F0EBED !important; }
        .wiz-progress-bar--active { background: linear-gradient(90deg, var(--primary), var(--primary-dark)) !important; }
        .wiz-footer {
          display: flex; gap: 8px;
          padding-top: 12px;
          margin-top: 4px;
        }
        .wiz-card-check {
          position: absolute; top: var(--space-3); right: var(--space-3);
          width: 24px; height: 24px; border-radius: 50%;
          background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center;
        }
        .wiz-tipo-icon { font-size: var(--text-2xl); }
        .wiz-tipo-title { font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); margin: 0; }
        .wiz-tipo-desc { font-size: var(--font-helper); color: var(--text-secondary); margin: 0; line-height: var(--lh-normal); }
        .wiz-tipo-example { font-size: var(--font-caption); color: var(--text-muted); margin: var(--space-1) 0 0; font-style: italic; }
        .wiz-tipo-card--active .wiz-tipo-title { color: var(--text-inverse); }
        .wiz-tipo-card--active .wiz-tipo-desc { color: rgba(255,255,255,0.8); }
        .wiz-tipo-card--active .wiz-tipo-example { color: rgba(255,255,255,0.6); }
        .wiz-opts-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .wiz-opt-card {
          display: flex; align-items: flex-start; gap: var(--gap-stack); width: 100%;
          padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); cursor: pointer;
          border: 2px solid var(--border); background: var(--bg-card);
          font-family: var(--font-base); text-align: left; transition: all var(--dur-fast) var(--ease-out);
        }
        .wiz-opt-card--active { border-color: var(--primary); border-width: 2.5px; background: var(--primary-light); }
        .wiz-opt-check {
          width: 22px; height: 22px; border-radius: var(--radius-sm); flex-shrink: 0;
          border: 2px solid var(--border); background: transparent;
          display: flex; align-items: center; justify-content: center; margin-top: 2px;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .wiz-opt-check--active { border-color: var(--primary); background: var(--primary); }
        .wiz-opt-title { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-primary); margin: 0 0 2px; display: flex; align-items: center; gap: var(--space-2); }
        .wiz-opt-desc { font-size: var(--font-helper); color: var(--text-secondary); margin: 0; line-height: var(--lh-normal); }
        .wiz-opt-example { font-size: var(--font-caption); color: var(--text-muted); margin: 2px 0 0; font-style: italic; }
        .wiz-footer { display: flex; gap: var(--gap-stack); padding-top: var(--space-2); }

        /* ── Confirmação de exclusão de produto ── */
        .prod-confirm { background: var(--bg-card); border-radius: var(--radius-lg); padding: var(--space-6); width: 90%; max-width: 320px; margin: auto; }
        .prod-confirm-title { font-size: var(--font-modal-title); font-weight: var(--fw-bold); line-height: var(--lh-tight); color: var(--text-title); margin: 0 0 var(--space-2); }
        .prod-confirm-sub { font-size: var(--font-helper); font-weight: var(--fw-regular); line-height: var(--lh-normal); color: var(--text-muted); margin: 0 0 var(--space-5); }
        .prod-confirm-btns { display: flex; gap: var(--gap-stack); }
        .prod-confirm-btns button { flex: 1; padding: var(--space-3); border: none; border-radius: var(--radius-full); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal); cursor: pointer; background: var(--bg-body); color: var(--text-secondary); transition: opacity var(--dur-fast) var(--ease-out); }

        /* ════════════════════════════════════════════════════════════════ */
        /* IDENTIDADE DOONLY - PRODUTOS MOBILE                              */
        /* ════════════════════════════════════════════════════════════════ */

        .prod-root {
          display: flex;
          flex-direction: column;
          gap: var(--gap-stack);
          padding: var(--space-5) var(--space-4) 6rem;
          font-family: var(--font-base);
          max-width: 800px;
        }
        @media (min-width: 900px) {
          .prod-root {
            max-width: 1400px;
            min-height: calc(100vh - 5rem);
            padding-bottom: var(--space-4);
            margin: 0 auto;
          }
          /* Quando página está em empty state (só o hero), zera padding/gap
             pra o hero ocupar tudo e centralizar de verdade */
          .prod-root:has(> .prod-hero-split) {
            padding: 0;
            gap: 0;
          }
        }

        /* ── Tabs Produtos / Categorias ── */
        .prod-tabs-novo {
          display: flex;
          gap: 0.5rem;
          background: var(--bg-subtle);
          padding: 4px;
          border-radius: var(--radius-md);
        }
        /* Desktop: tabs escondidas — navegação vem da sidebar (sub-item Categorias) */
        @media (min-width: 900px) {
          .prod-tabs-novo { display: none; }
        }
        .prod-tab-novo {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0.6rem 0.75rem;
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .prod-tab-novo.active {
          background: var(--bg-card);
          color: var(--text-title);
          box-shadow: 0 2px 6px rgba(61, 26, 36, 0.08);
        }

        /* ── Header título + botão ── */
        .prod-header-novo {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .prod-title-novo {
          font-size: var(--text-2xl);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: -0.02em;
        }
        .prod-sub-novo {
          font-size: var(--font-helper);
          color: var(--text-muted);
          margin: 0.1rem 0 0;
        }

        /* ── Barra de busca ── */
        .prod-busca-novo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.6rem 0.9rem;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .prod-busca-novo:focus-within {
          border-color: var(--text-title);
        }
        .prod-busca-novo > svg:first-child {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .prod-busca-novo input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: var(--font-button);
          color: var(--text-title);
          min-width: 0;
        }
        .prod-busca-novo input::placeholder {
          color: var(--text-muted);
        }

        /* ── Filtros categoria ── */
        .prod-filtros {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 4px;
          margin: 0 -1rem;
          padding-left: 1rem;
          padding-right: 1rem;
          scrollbar-width: none;
        }
        .prod-filtros::-webkit-scrollbar { display: none; }
        .prod-filtro-btn {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-full);
          padding: 0.45rem 0.95rem;
          font-family: inherit;
          font-size: var(--font-helper);
          font-weight: var(--fw-semibold);
          color: var(--text-secondary);
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .prod-filtro-btn:hover {
          border-color: var(--text-title);
          color: var(--text-title);
        }
        .prod-filtro-btn.active {
          background: var(--text-title);
          border-color: var(--text-title);
          color: var(--text-inverse);
        }

        /* ── Lista / Grid de produtos (responsivo) ── */
        .prod-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.6rem;
        }
        @media (min-width: 720px) {
          .prod-grid { grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
        }
        @media (min-width: 1000px) {
          .prod-grid { grid-template-columns: repeat(4, 1fr); gap: 0.85rem; }
        }
        @media (min-width: 1300px) {
          .prod-grid { grid-template-columns: repeat(5, 1fr); }
        }
        .prod-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        /* ── Ficha técnica (CMV) ── */
        .ficha-empty {
          display:flex; flex-direction:column; align-items:center; gap:0.5rem;
          padding:1.1rem 0.95rem; background:var(--bg-body);
          border-radius: var(--radius-md); border:1.5px dashed var(--border);
          text-align:center;
        }
        .ficha-empty-icon { font-size: var(--text-2xl); }
        .ficha-empty-text { margin:0; font-size: var(--font-helper); color:var(--text-secondary); line-height:1.45; max-width:300px; }
        .ficha-empty-text strong { color:var(--primary); font-weight: var(--fw-bold); }

        .ficha-list { display:flex; flex-direction:column; gap:0.4rem; }
        .ficha-row {
          display:flex; align-items:center; gap:0.55rem;
          padding:0.55rem 0.65rem; background:var(--bg-card);
          border:1px solid var(--border); border-radius: var(--radius-md);
        }
        .ficha-row-img {
          width:34px; height:34px; border-radius: var(--radius-md);
          object-fit:cover; flex-shrink:0;
          background:var(--bg-body);
        }
        .ficha-row-img--placeholder { display:flex; align-items:center; justify-content:center; font-size: var(--font-input); }
        .ficha-row-info { flex:1; min-width:0; }
        .ficha-row-nome {
          font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-title);
          margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .ficha-row-sub { font-size: var(--font-caption); color:var(--text-muted); margin:1px 0 0; }
        .ficha-row-qtd {
          display:flex; align-items:center; gap:4px;
          padding:5px 8px; background:var(--bg-body);
          border-radius: var(--radius-sm); border:1.5px solid var(--border);
          transition:border-color 0.15s;
        }
        .ficha-row-qtd:focus-within { border-color:var(--primary); }
        .ficha-row-qtd input {
          width:54px; border:none; outline:none; background:transparent;
          font-family:inherit; font-size: var(--font-button); font-weight: var(--fw-bold);
          color:var(--text-title); text-align:right;
          -moz-appearance:textfield;
        }
        .ficha-row-qtd input::-webkit-outer-spin-button,
        .ficha-row-qtd input::-webkit-inner-spin-button {
          -webkit-appearance:none; margin:0;
        }
        .ficha-row-qtd span { font-size: var(--font-caption); color:var(--text-secondary); font-weight: var(--fw-semibold); }
        .ficha-row-custo {
          font-size: var(--font-button); font-weight: var(--fw-black);
          color:var(--primary-dark);
          min-width:64px; text-align:right;
          font-variant-numeric:tabular-nums;
        }
        .ficha-row-del {
          width:26px; height:26px; border-radius:50%;
          background:var(--bg-body); border:none;
          color:var(--text-muted);
          cursor:pointer; font-size: var(--font-caption);
          transition:all 0.15s; flex-shrink:0;
        }
        .ficha-row-del:hover { background:#fee2e2; color:var(--error); }

        .ficha-no-insumos {
          padding:0.85rem; background:var(--primary-light);
          border-radius: var(--radius-md); text-align:center;
          font-size: var(--font-helper); color:var(--text-secondary);
        }
        .ficha-no-insumos p { margin:0; }

        .ficha-btn-add {
          display:inline-flex; align-items:center; gap:5px;
          align-self:flex-start;
          padding:0.55rem 1rem;
          background:var(--primary-light);
          color:var(--primary);
          border:1.5px dashed var(--primary);
          border-radius: var(--radius-full);
          font-family:inherit; font-size: var(--font-helper); font-weight: var(--fw-bold);
          cursor:pointer; transition:all 0.15s;
        }
        .ficha-btn-add:hover {
          background:var(--primary); color:#fff; border-style:solid;
          box-shadow:0 3px 10px rgba(255,111,169,0.3);
        }

        .ficha-picker {
          display:flex; flex-direction:column; gap:0.55rem;
          padding:0.85rem; background:var(--primary-light);
          border:1.5px solid var(--primary); border-radius: var(--radius-lg);
        }
        .ficha-picker-search {
          width:100%; padding:0.55rem 0.85rem;
          border:1.5px solid var(--border); border-radius: var(--radius-md);
          font-family:inherit; font-size: var(--font-button); outline:none;
          background:var(--bg-card); box-sizing:border-box;
        }
        .ficha-picker-search:focus { border-color:var(--primary); }
        .ficha-picker-list {
          display:flex; flex-direction:column; gap:4px;
          max-height:200px; overflow-y:auto;
        }
        .ficha-picker-item {
          display:flex; align-items:center; gap:0.55rem;
          padding:0.55rem 0.65rem;
          background:var(--bg-card);
          border:1.5px solid transparent; border-radius: var(--radius-md);
          cursor:pointer; text-align:left;
          font-family:inherit; transition:all 0.15s;
        }
        .ficha-picker-item:hover {
          border-color:var(--primary);
          transform:translateY(-1px);
          box-shadow:0 3px 10px rgba(255,111,169,0.15);
        }
        .ficha-picker-close {
          align-self:flex-end;
          padding:0.4rem 1rem;
          background:var(--bg-card);
          border:1px solid var(--border); border-radius: var(--radius-full);
          font-family:inherit; font-size: var(--font-helper); font-weight: var(--fw-semibold);
          color:var(--text-secondary); cursor:pointer;
        }

        .ficha-resumo {
          padding:0.85rem 1rem;
          background:linear-gradient(135deg, #FFE4F0 0%, #FFF1F7 100%);
          border:1px solid rgba(255,111,169,0.25);
          border-radius: var(--radius-lg);
          display:flex; flex-direction:column; gap:0.4rem;
        }
        .ficha-resumo-row {
          display:flex; justify-content:space-between; align-items:center;
          font-size: var(--font-helper); color:var(--text-primary);
        }
        .ficha-resumo-row strong {
          color:var(--text-title); font-weight: var(--fw-black);
          font-variant-numeric:tabular-nums;
        }
        .ficha-resumo-margem {
          display:flex; justify-content:space-between; align-items:center;
          padding:0.55rem 0.85rem; margin-top:0.25rem;
          border-radius: var(--radius-md);
          font-size: var(--font-button); font-weight: var(--fw-bold);
        }
        .ficha-resumo-margem strong { font-size: var(--font-modal-title); font-weight: var(--fw-black); }
        .ficha-resumo-margem--alto { background:#dcfce7; color:#15803d; }
        .ficha-resumo-margem--medio { background:#fef3c7; color:#a16207; }
        .ficha-resumo-margem--baixo { background:#fee2e2; color:#b91c1c; }
        .ficha-alerta {
          margin:0; padding:0.55rem 0.85rem;
          background:#fef3c7; color:#92400e;
          border-radius: var(--radius-md); font-size: var(--font-helper); font-weight: var(--fw-semibold);
        }

        /* ── Botão-resumo (trigger do modal da ficha) ── */
        .ficha-trigger {
          width:100%; display:flex; align-items:center; gap:0.75rem;
          padding:0.85rem 1rem;
          background:var(--bg-body);
          border:1.5px solid var(--border); border-radius: var(--radius-lg);
          cursor:pointer; transition: all var(--dur-normal) var(--ease-out); text-align:left;
        }
        .ficha-trigger:hover {
          border-color:var(--primary);
          background:#FFF5F9;
          transform:translateY(-1px);
        }
        .ficha-trigger-icon {
          font-size: var(--text-xl); flex-shrink:0;
          width:42px; height:42px; display:flex; align-items:center; justify-content:center;
          background:#fff; border-radius: var(--radius-md);
        }
        .ficha-trigger-info { flex:1; min-width:0; }
        .ficha-trigger-title {
          margin:0; font-size: var(--font-button); font-weight: var(--fw-bold);
          color:var(--text-primary);
        }
        .ficha-trigger-sub {
          margin:2px 0 0; font-size: var(--font-caption);
          color:var(--text-secondary); font-weight: var(--fw-medium);
        }
        .ficha-trigger-arrow {
          font-size: var(--font-page-title); color:var(--text-muted); font-weight: 400;
        }
        .ficha-trigger-badge {
          padding:0.3rem 0.65rem; border-radius: var(--radius-full);
          font-size: var(--font-helper); font-weight: var(--fw-black);
        }
        .ficha-trigger-badge--alto { background:#dcfce7; color:#15803d; }
        .ficha-trigger-badge--medio { background:#fef3c7; color:#a16207; }
        .ficha-trigger-badge--baixo { background:#fee2e2; color:#b91c1c; }

        /* ── Ficha técnica em TELA CHEIA (100% via design tokens) ── */
        .ficha-modal-overlay {
          position: fixed; inset: 0; z-index: 1100;
          background: rgba(45, 31, 38, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          animation: fichaFadeIn var(--dur-normal) var(--ease-out);
        }
        @keyframes fichaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .ficha-modal {
          width: 100%;
          max-height: 92vh;
          background: var(--bg-card);
          border-radius: 20px 20px 0 0;
          display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.18);
          animation: fichaSlideIn 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          position: relative;
        }
        @keyframes fichaSlideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .ficha-modal::before {
          content: '';
          display: block;
          width: 36px; height: 4px;
          border-radius: 2px;
          background: var(--border);
          margin: 10px auto 0;
          flex-shrink: 0;
        }
        .ficha-modal-close-x {
          position: absolute;
          top: 12px; right: 14px;
          z-index: 5;
          width: 34px; height: 34px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(6px);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 16px;
          font-weight: 700;
          font-family: inherit;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background var(--dur-fast), color var(--dur-fast);
        }
        .ficha-modal-close-x:hover { background: var(--text-title); color: #fff; border-color: var(--text-title); }
        @media (min-width: 720px) {
          .ficha-modal-overlay { justify-content: center; align-items: center; padding: 24px; }
          .ficha-modal {
            max-width: 760px;
            max-height: 88vh;
            border-radius: 20px;
            animation: fichaFadeScale 0.22s ease;
          }
          .ficha-modal::before { display: none; }
          @keyframes fichaFadeScale {
            from { opacity: 0; transform: scale(0.96); }
            to   { opacity: 1; transform: scale(1); }
          }
        }

        /* Header com imagem grande do produto */
        .ficha-modal-header {
          padding: var(--space-4);
          background: linear-gradient(180deg, var(--primary-light) 0%, var(--bg-card) 100%);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        @media (min-width: 640px) {
          .ficha-modal-header { padding: var(--space-6) var(--space-7) var(--space-4); }
        }
        .ficha-modal-header-inner {
          max-width: 720px; margin: 0 auto; width: 100%;
        }
        .ficha-modal-back {
          display: inline-flex; align-items: center; gap: var(--space-2);
          background: transparent; border: none; cursor: pointer;
          padding: var(--space-1) var(--space-2) var(--space-1) 0;
          margin-bottom: var(--space-3);
          color: var(--text-secondary);
          font-size: var(--font-button); font-weight: var(--fw-semibold); line-height: var(--lh-normal);
          border-radius: var(--radius-sm);
          transition: color var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-back:hover { color: var(--primary); }
        .ficha-modal-hero { display: flex; gap: var(--space-3); align-items: flex-start; }
        .ficha-modal-hero-img {
          width: 88px; height: 88px; border-radius: var(--radius-lg);
          object-fit: cover; flex-shrink: 0;
          box-shadow: var(--shadow-sm);
        }
        @media (min-width: 640px) {
          .ficha-modal-hero-img { width: 104px; height: 104px; }
        }
        .ficha-modal-hero-img--placeholder {
          background: var(--bg-card); display: flex; align-items: center; justify-content: center;
          font-size: 2.4rem;
        }
        .ficha-modal-hero-info { flex: 1; min-width: 0; }
        .ficha-modal-hero-label {
          margin: 0; font-size: var(--font-caption); text-transform: uppercase;
          letter-spacing: var(--ls-wide); color: var(--text-muted); font-weight: var(--fw-bold);
        }
        .ficha-modal-hero-nome {
          margin: 2px 0 var(--space-2);
          font-size: var(--font-card-title); font-weight: var(--fw-black);
          color: var(--text-primary); line-height: var(--lh-tight);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ficha-modal-hero-metricas { display: flex; gap: var(--space-2); }
        .ficha-modal-metric {
          flex: 1; padding: var(--space-2);
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-md); min-width: 0;
        }
        .ficha-modal-metric span {
          display: block; font-size: var(--font-stat-label); text-transform: uppercase;
          letter-spacing: var(--ls-wide); color: var(--text-muted); font-weight: var(--fw-bold);
        }
        .ficha-modal-metric strong {
          display: block; font-size: var(--font-button); font-weight: var(--fw-black);
          color: var(--text-primary); margin-top: 1px;
        }
        .ficha-modal-metric--margem strong { font-size: var(--font-input); }
        .ficha-modal-metric--alto { background: #dcfce7; border-color: #bbf7d0; }
        .ficha-modal-metric--alto strong { color: #15803d; }
        .ficha-modal-metric--medio { background: #fef3c7; border-color: #fde68a; }
        .ficha-modal-metric--medio strong { color: #a16207; }
        .ficha-modal-metric--baixo { background: #fee2e2; border-color: #fecaca; }
        .ficha-modal-metric--baixo strong { color: #b91c1c; }
        .ficha-modal-alerta {
          margin: var(--space-3) 0 0; padding: var(--space-2) var(--space-3);
          background: #fef3c7; color: #92400e;
          border-radius: var(--radius-md); font-size: var(--font-helper); font-weight: var(--fw-semibold); line-height: var(--lh-normal);
        }

        /* Body */
        .ficha-modal-body {
          flex: 1; overflow-y: auto;
          padding: var(--space-4);
          display: flex; flex-direction: column; gap: var(--gap-stack);
        }
        @media (min-width: 640px) {
          .ficha-modal-body { padding: var(--space-6) var(--space-7); max-width: 720px; width: 100%; margin: 0 auto; }
        }
        .ficha-modal-empty {
          padding: var(--space-6) var(--space-4); text-align: center;
          background: var(--bg-body); border-radius: var(--radius-lg);
          border: 1.5px dashed var(--border);
        }
        .ficha-modal-empty-icon { font-size: 2.2rem; }
        .ficha-modal-empty-title {
          margin: var(--space-1) 0 var(--space-1); font-size: var(--font-input); font-weight: var(--fw-bold); line-height: var(--lh-tight);
          color: var(--text-primary);
        }
        .ficha-modal-empty-sub {
          margin: 0; font-size: var(--font-helper); font-weight: var(--fw-regular); line-height: var(--lh-relaxed);
          color: var(--text-secondary);
        }
        .ficha-modal-empty-sub strong { color: var(--primary); font-weight: var(--fw-bold); }

        .ficha-modal-list { display: flex; flex-direction: column; gap: var(--gap-tight); }
        .ficha-modal-item {
          display: flex; gap: var(--space-3); padding: var(--space-3);
          background: var(--bg-card); border: 1.5px solid var(--border);
          border-radius: var(--radius-md); position: relative;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-item-img {
          width: 54px; height: 54px; border-radius: var(--radius-md);
          object-fit: cover; flex-shrink: 0; background: var(--bg-body);
        }
        .ficha-modal-item-img--placeholder {
          display: flex; align-items: center; justify-content: center; font-size: var(--font-page-title);
        }
        .ficha-modal-item-info { flex: 1; min-width: 0; padding-right: var(--space-6); }
        .ficha-modal-item-nome {
          margin: 0; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal);
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ficha-modal-item-sub {
          margin: 2px 0 var(--space-2); font-size: var(--font-caption);
          color: var(--text-muted); font-weight: var(--fw-medium); line-height: var(--lh-normal);
        }
        .ficha-modal-item-bottom {
          display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
        }
        .ficha-modal-item-qtd {
          display: flex; align-items: center; gap: var(--space-1);
          background: var(--bg-body); border: 1.5px solid transparent;
          border-radius: var(--radius-md); padding: var(--space-1) var(--space-2); max-width: 130px;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-item-qtd:focus-within { border-color: var(--primary); background: var(--bg-card); }
        .ficha-modal-item-qtd input {
          width: 60px; border: none; background: transparent; outline: none;
          font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-primary);
        }
        .ficha-modal-item-qtd input::-webkit-outer-spin-button,
        .ficha-modal-item-qtd input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .ficha-modal-item-qtd span {
          font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--text-secondary);
        }
        .ficha-modal-unit-select {
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          background: var(--bg-card); color: var(--text-primary);
          font-family: inherit; font-size: var(--font-caption); font-weight: var(--fw-semibold);
          padding: 2px 4px; cursor: pointer; outline: none; min-width: 38px;
        }
        .ficha-modal-unit-select:focus { border-color: var(--primary); }
        .ficha-modal-item-custo {
          font-size: var(--font-button); font-weight: var(--fw-black); color: var(--primary);
        }
        .ficha-modal-item-del {
          position: absolute; top: 8px; right: 8px;
          width: 24px; height: 24px; border-radius: var(--radius-sm);
          background: transparent; border: none;
          color: var(--text-muted); cursor: pointer;
          font-size: var(--font-button);
          display: flex; align-items: center; justify-content: center;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-item-del:hover { background: #fee2e2; color: #b91c1c; }

        /* Adicionar ingrediente */
        .ficha-modal-add {
          background: var(--bg-body);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-3);
        }
        .ficha-modal-add-label {
          font-size: var(--font-section-label); font-weight: var(--fw-bold); line-height: var(--lh-normal);
          color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: var(--ls-wide);
          margin-bottom: var(--space-2);
        }
        .ficha-modal-add-input {
          width: 100%; padding: var(--pad-input);
          background: var(--bg-card); border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          font-size: var(--font-input); font-weight: var(--fw-medium); line-height: var(--lh-normal);
          color: var(--text-title); outline: none;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-add-input:focus { border-color: var(--primary); }
        .ficha-modal-add-results {
          margin-top: var(--space-2); display: flex; flex-direction: column; gap: var(--space-1);
          max-height: 260px; overflow-y: auto;
        }
        .ficha-modal-add-result {
          display: flex; gap: var(--space-2); align-items: center;
          padding: var(--space-2); background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-md); cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out); text-align: left;
        }
        .ficha-modal-add-result:hover { border-color: var(--primary); background: var(--primary-light); }
        .ficha-modal-add-result-img {
          width: 38px; height: 38px; border-radius: var(--radius-sm);
          object-fit: cover; flex-shrink: 0; background: var(--bg-body);
        }
        .ficha-modal-add-result-img--placeholder {
          display: flex; align-items: center; justify-content: center; font-size: var(--font-modal-title);
        }
        .ficha-modal-add-novo {
          margin-top: var(--space-1); padding: var(--space-2) var(--space-3);
          background: var(--bg-card); border: 1.5px dashed var(--primary);
          border-radius: var(--radius-md); cursor: pointer;
          font-size: var(--font-button); color: var(--primary); font-weight: var(--fw-semibold); line-height: var(--lh-normal);
          transition: all var(--dur-fast) var(--ease-out); text-align: left;
        }
        .ficha-modal-add-novo:hover { background: var(--primary-light); }
        .ficha-modal-add-novo strong { font-weight: var(--fw-black); }
        .ficha-modal-add-novo--solo { margin-top: var(--space-2); width: 100%; text-align: center; }

        /* Footer */
        .ficha-modal-footer {
          padding: var(--space-3) var(--space-4);
          border-top: 1px solid var(--border);
          background: var(--bg-card); flex-shrink: 0;
        }
        @media (min-width: 640px) {
          .ficha-modal-footer { padding: var(--space-4) var(--space-7); }
          .ficha-modal-footer > * { max-width: 720px; margin: 0 auto; display: block; }
        }
        .ficha-modal-concluir {
          width: 100%; padding: var(--space-3);
          background: var(--text-primary); color: var(--text-inverse);
          border: none; border-radius: var(--radius-md);
          font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal);
          cursor: pointer;
          transition: opacity var(--dur-fast) var(--ease-out);
        }
        .ficha-modal-concluir:hover { opacity: 0.88; }

        /* ═══ BULK SELECTION (Desktop only) ═══ */
        .prod-card-check {
          position: absolute;
          top: 10px;
          left: 10px;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.92);
          border: 1.8px solid rgba(153, 53, 86, 0.35);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 5;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          box-shadow: 0 2px 6px rgba(0,0,0,0.12);
        }
        .prod-card-check:hover {
          border-color: #E85A8C;
          transform: scale(1.05);
        }
        /* Só aparece em desktop */
        @media (min-width: 900px) {
          .prod-card:hover .prod-card-check { display: flex; }
          /* Se algum selecionado, todos ficam com checkbox visível */
          body:has(.prod-card--selected) .prod-card-check { display: flex; }
          .prod-card--selected .prod-card-check {
            background: #E85A8C;
            border-color: #E85A8C;
            display: flex;
          }
          .prod-card--selected {
            outline: 2px solid #E85A8C !important;
            outline-offset: -2px;
            border-radius: var(--radius-md, 12px);
          }
        }

        /* ═══ BARRA FLUTUANTE (Desktop only) ═══ */
        .bulk-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: #1F1418;
          color: #fff;
          border-radius: 16px;
          padding: 10px 12px 10px 20px;
          display: none;
          align-items: center;
          gap: 16px;
          z-index: 9500;
          box-shadow: 0 12px 32px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.15);
          animation: bulk-bar-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          font-family: var(--font-base);
        }
        @keyframes bulk-bar-in {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @media (min-width: 900px) {
          .bulk-bar.bulk-bar--visible { display: flex; }
        }
        .bulk-bar-count {
          font-size: 13.5px;
          font-weight: 700;
          padding-right: 12px;
          border-right: 1px solid rgba(255,255,255,0.15);
          white-space: nowrap;
        }
        .bulk-bar-actions {
          display: flex;
          gap: 4px;
        }
        .bulk-bar-btn {
          background: transparent;
          border: none;
          color: #fff;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease;
        }
        .bulk-bar-btn:hover { background: rgba(255,255,255,0.10); }
        .bulk-bar-btn--danger { color: #FCA5A5; }
        .bulk-bar-btn--danger:hover { background: rgba(220, 38, 38, 0.20); }
        .bulk-bar-close {
          margin-left: 4px;
          padding-left: 12px;
          border-left: 1px solid rgba(255,255,255,0.15);
        }
        .bulk-bar-close .bulk-bar-btn {
          padding: 6px 10px;
          color: rgba(255,255,255,0.7);
        }

        /* ═══ MODAL CONFIRMAÇÃO EXCLUIR ═══ */
        .bulk-confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(30, 15, 20, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 10001;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: doonly-overlay-in 0.2s ease;
        }
        .bulk-confirm-modal {
          background: #fff;
          border-radius: 20px;
          padding: 28px 24px 24px;
          max-width: 380px;
          width: 100%;
          text-align: center;
          box-shadow: 0 24px 60px rgba(220, 38, 38, 0.20);
          animation: doonly-toast-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
          font-family: var(--font-base);
        }
        .bulk-confirm-icon {
          width: 60px; height: 60px;
          border-radius: 50%;
          background: #FEF2F2;
          color: #DC2626;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
        }
        .bulk-confirm-titulo {
          font-size: 18px;
          font-weight: 700;
          color: #2D1F26;
          margin: 0 0 8px;
        }
        .bulk-confirm-sub {
          font-size: 13.5px;
          color: #6B5D64;
          line-height: 1.5;
          margin: 0 0 22px;
        }
        .bulk-confirm-actions {
          display: flex;
          gap: 10px;
        }
        .bulk-confirm-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.1s ease, opacity 0.1s ease;
        }
        .bulk-confirm-btn--cancelar {
          background: #F0EBED;
          color: #6B5D64;
        }
        .bulk-confirm-btn--cancelar:hover { background: #E5D8DE; }
        .bulk-confirm-btn--excluir {
          background: #DC2626;
          color: #fff;
          box-shadow: 0 3px 0 #991B1B;
        }
        .bulk-confirm-btn--excluir:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #991B1B; }
        .bulk-confirm-btn--excluir:active { transform: translateY(2px); box-shadow: 0 1px 0 #991B1B; }
        .bulk-confirm-btn:disabled { opacity: 0.6; cursor: wait; }

        /* ═══ TOAST DOONLY ═══ */
        .doonly-toast-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          padding: 20px;
          background: rgba(30, 15, 20, 0.35);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          animation: doonly-overlay-in 0.2s ease;
        }
        @keyframes doonly-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .doonly-toast {
          background: #fff;
          border-radius: 20px;
          padding: 28px 24px 24px;
          box-shadow: 0 24px 60px rgba(153, 53, 86, 0.22), 0 6px 16px rgba(0,0,0,0.10);
          width: 100%;
          max-width: 360px;
          text-align: center;
          animation: doonly-toast-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1px solid rgba(232, 90, 140, 0.08);
          position: relative;
          pointer-events: auto;
        }
        @keyframes doonly-toast-in {
          from { opacity: 0; transform: translateY(-12px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .doonly-toast-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
        }
        .doonly-toast-icon-wrap--success { background: linear-gradient(135deg, #FDF3F7 0%, #FCE0E9 100%); color: #E85A8C; }
        .doonly-toast-icon-wrap--error   { background: #FEF2F2; color: #DC2626; }
        .doonly-toast-icon-wrap--info    { background: #EFF6FF; color: #2563EB; }
        .doonly-toast-titulo {
          font-family: var(--font-base);
          font-size: 17px;
          font-weight: 700;
          color: #2D1F26;
          line-height: 1.3;
          margin: 0 0 6px;
        }
        .doonly-toast-sub {
          font-family: var(--font-base);
          font-size: 13.5px;
          color: #6B5D64;
          margin: 0;
          line-height: 1.5;
          padding: 0 6px;
        }
        .doonly-toast-btn {
          margin-top: 18px;
          padding: 10px 24px;
          border: none;
          background: #E85A8C;
          color: #fff;
          border-radius: 10px;
          font-family: var(--font-base);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 3px 0 #C33A6E;
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .doonly-toast-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #C33A6E; }
        .doonly-toast-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #C33A6E; }

      `}</style>

      {/* ═══ Barra flutuante de ações em massa (Desktop) ═══ */}
      <div className={`bulk-bar ${selectedIds.size > 0 ? "bulk-bar--visible" : ""}`}>
        <div className="bulk-bar-count">
          {selectedIds.size} {selectedIds.size === 1 ? "selecionado" : "selecionados"}
        </div>
        <div className="bulk-bar-actions">
          <button className="bulk-bar-btn" onClick={() => handleBulkPublicar(true)} disabled={bulkLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            Publicar
          </button>
          <button className="bulk-bar-btn" onClick={() => handleBulkPublicar(false)} disabled={bulkLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            Despublicar
          </button>
          <button className="bulk-bar-btn" onClick={handleBulkDuplicar} disabled={bulkLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Duplicar
          </button>
          <button className="bulk-bar-btn bulk-bar-btn--danger" onClick={() => setConfirmBulkDelete(true)} disabled={bulkLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
            </svg>
            Excluir
          </button>
        </div>
        <div className="bulk-bar-close">
          <button className="bulk-bar-btn" onClick={clearSelection} title="Fechar seleção">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ Modal confirmação excluir em massa ═══ */}
      {confirmBulkDelete && (
        <div className="bulk-confirm-overlay" onClick={() => !bulkLoading && setConfirmBulkDelete(false)}>
          <div className="bulk-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="bulk-confirm-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <p className="bulk-confirm-titulo">Excluir {selectedIds.size} produto{selectedIds.size > 1 ? "s" : ""}?</p>
            <p className="bulk-confirm-sub">
              Esta ação é <b>permanente</b> e não pode ser desfeita. Os produtos serão removidos do cardápio público imediatamente.
            </p>
            <div className="bulk-confirm-actions">
              <button className="bulk-confirm-btn bulk-confirm-btn--cancelar" onClick={() => setConfirmBulkDelete(false)} disabled={bulkLoading}>
                Cancelar
              </button>
              <button className="bulk-confirm-btn bulk-confirm-btn--excluir" onClick={handleBulkExcluir} disabled={bulkLoading}>
                {bulkLoading ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Toast Doonly ═══ */}
      {toast && (
        <div className="doonly-toast-overlay" onClick={() => setToast(null)}>
          <div className="doonly-toast" onClick={e => e.stopPropagation()}>
            <div className={`doonly-toast-icon-wrap doonly-toast-icon-wrap--${toast.tipo}`}>
              {toast.tipo === "success" && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {toast.tipo === "error" && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              )}
              {toast.tipo === "info" && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              )}
            </div>
            <p className="doonly-toast-titulo">{toast.titulo}</p>
            {toast.sub && <p className="doonly-toast-sub">{toast.sub}</p>}
            <button className="doonly-toast-btn" onClick={() => setToast(null)}>Entendi</button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
