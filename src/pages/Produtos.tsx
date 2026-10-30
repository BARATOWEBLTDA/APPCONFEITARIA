import { useState, useEffect, useRef, useMemo } from "react";
import { horasAntecedencia } from "@/lib/entregaProduto";
import { explicarErro } from "@/lib/erros";
import LimitePlano from "@/components/billing/LimitePlano";
import { LIMITE_PRODUTOS_GRATIS } from "@/lib/limitesPlano";
import { useLocation, useNavigate } from "react-router-dom";
import { faltaKit } from "@/components/produto/KitQuantidadeEditor";
import { Sparkle as SparkleIA } from "@phosphor-icons/react";
import { selecionarValorAoFocar } from "@/lib/moeda";
import PreviaCardapio from "@/components/produto/PreviaCardapio";
import { categoriaSugerida, tipoPeloNome, ehBoloNoPote, type TipoProduto as TipoCadastro } from "@/lib/tipoProduto";
import { avisarPassos, lerPassos, passosCompletos, useLojaPronta } from "@/lib/primeirosPassos";
import RevisaoProduto, { ResumoProduto } from "@/components/produto/RevisaoProduto";
import ResumoEdicao from "@/components/produto/ResumoEdicao";
import EscolhasProduto, { escolhasAtivas, faltaDaEscolha } from "@/components/produto/EscolhasProduto";
import { kitAtivo, precoMinKit, type KitQtdConfig } from "@/lib/kitQuantidade";
import SucessoProdutoTela from "@/components/produto/SucessoProdutoTela";
import { precoCardapioComPromocao, precosDosSabores, ehCentoLivre } from "@/lib/precoCardapio";
import { supabase } from "@/lib/supabase";
import { gravarInsumosDoProduto } from "@/lib/insumosDoo";
import { carregarGruposDoBanco, salvarGruposParaBanco } from "@/lib/produto-grupos";
import {
  REGRA_CONFLITO_DEFAULT,
  calcularCustoLucro,
  lerMaoObraConta,
  descontoPromocao,
  pesoKgDoNome,
  type MaoObraConta,
  type RegraConflitoTamanho, type CustoDaVenda, } from "@/lib/produto-precificacao";
import { taxaPctDaForma, fixoPorPedido } from "@/lib/painelFinanceiro";
import { useProfile, getCardapioUrl } from "@/hooks/useProfile";
import { gerarFichaProduto } from "@/lib/gerarFichaProduto";
import { usePlano } from "@/hooks/usePlano";
import { ImageCropper } from "@/components/ui/ImageCropper";
import Categorias from "@/pages/Categorias";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_PRODUTOS, TOUR_PRODUTOS } from "@/lib/comoTelas";
import { ArrowLeft as ArrowLeftIc, Camera, Check as CheckIc, ListChecks, MagnifyingGlass, PencilSimple, Plus as PlusIc, WarningCircle, Trash, X as XIc, DotsThreeVertical, Cake, Crown, Info, Sun, FrameCorners, Crop, TextTSlash, ArrowsClockwise, SealPercent, Lightning, CalendarBlank, Star } from "@phosphor-icons/react";
import { Botao, BotaoIcone, CaixasEscolha, Janela, Linha as LinhaUi, TelaVazia, Titulo as TituloUi, avisar, confirmar } from "@/components/base";
import { historicoAssentado, useSobreposicao } from "@/components/base/useSobreposicao";
import { sufixoVenda } from "@/lib/formaVenda";
import "./produtosLista.css";
import "@/components/produto/cadastroProduto.css";

/** "por kg", "o cento", "a caixa", "a unidade" — junto do preço na lista (08/10 · 3.21) */
const unidadeDoPreco = (fv?: string | null) => {
  const s = sufixoVenda(fv);
  return s === "kg" ? "por kg" : s === "cento" ? "o cento" : s === "caixa" ? "a caixa" : s === "fatia" ? "a fatia" : s === "kit" ? "o kit" : "a unidade";
};
/**
 * Preço do cartão na lista — mesma regra do cardápio (10/10): com tamanhos ou kit mostra
 * "a partir de R$ X" (o menor) e sem "por kg"; sem tamanhos mostra o preço e a unidade.
 */
/** (21/10) SKU que ainda não existe na loja: mesmo prefixo + 4 números (ex.: BOL-0427 → BOL-5812). */
const skuLivre = (base: string, usados: Set<string>): string => {
  const pre = (String(base || "PRD").toUpperCase().split("-")[0].replace(/[^A-Z0-9]/g, "").slice(0, 6) || "PRD");
  for (let t = 0; t < 200; t++) {
    const cod = `${pre}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    if (!usados.has(cod)) return cod;
  }
  return `${pre}-${Date.now().toString().slice(-6)}`;
};
const skusDe = (lista: any[]) => new Set(lista.map(p => String(p?.sku || "").trim().toUpperCase()).filter(Boolean));

const precoDaLista = (prod: any) => {
  // (11/10) pela função única do cardápio: mesma regra de promoção e mesmo arredondamento do cartão da cliente
  const pc = precoCardapioComPromocao(prod);
  const unidade = ehCentoLivre(prod) ? "o cento" : pc.aPartir || prod?.grupo_tamanhos?.ativo ? "" : unidadeDoPreco(prod?.forma_venda);
  return { de: pc.de, final: pc.final, unidade, aPartir: pc.aPartir };
};
import ReqTag, { OptTag } from "@/components/ReqTag";
import GavetaFiltro, { BotaoFiltro } from "@/components/base/GavetaFiltro";
import { apiFetch } from "@/lib/apiFetch";
import { reduzirFoto } from "@/lib/reduzirFoto";

// ── Helpers de conversão de unidades (ficha técnica) ──
const UNIT_FAMILIES_MAP: Record<string, { family: string; base: string; toBase: number }> = {
  kg: { family: "massa", base: "kg", toBase: 1 },
  g:  { family: "massa", base: "kg", toBase: 0.001 },
  L:  { family: "volume", base: "L", toBase: 1 },
  ml: { family: "volume", base: "L", toBase: 0.001 },
  un: { family: "unidade", base: "un", toBase: 1 },
};

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

/**
 * (14/10) Nome do produto: primeira letra de cada palavra maiúscula, e o resto minúsculo
 * ("BOLO DE MORANGO" e "bolo de morango" viram "Bolo de Morango"). "de", "com", "e"... ficam minúsculos
 * (menos se forem a primeira palavra). Palavra com letra maiúscula no meio ("iFood", "KitKat") e sigla curta
 * escrita em maiúscula num nome misto ficam como vieram. "2kg", "500g" ficam minúsculos.
 */
const MINUSCULAS_NOME = new Set(["a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "com", "sem", "em", "na", "no", "nas", "nos", "ao", "aos", "à", "às", "para", "pra", "por", "ou", "c/", "s/"]);
function nomeProduto(str: string): string {
  const t = String(str || "").trim().replace(/\s+/g, " ");
  if (!t) return t;
  const tudoMaiusculo = t === t.toUpperCase();
  return t.split(" ").map((p, i) => {
    if (!tudoMaiusculo && /[a-zà-ÿ].*[A-ZÀ-Ý]|^[A-ZÀ-Ý][a-zà-ÿ]+[A-ZÀ-Ý]/.test(p)) return p; // iFood, KitKat
    const min = p.toLocaleLowerCase("pt-BR");
    if (i > 0 && MINUSCULAS_NOME.has(min)) return min;
    if (/^\d/.test(min)) return min;
    return min.charAt(0).toLocaleUpperCase("pt-BR") + min.slice(1);
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

/** O que falta pra seguir no cadastro: a mensagem e o campo (seletor) pra onde rolar */
type FaltaCampo = { msg: string; alvo?: string } | null;

const SYSTEM_ICONS = Array.from({ length: 42 }, (_, i) => `/categoriaicones/icone (${i + 1}).png`);

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
  // (11/10) no celular a lista abre por cima: o "voltar" do Android fecha a lista (e não volta o passo do cadastro)
  const sheetRef = useRef<HTMLDivElement>(null);
  useSobreposicao(open && isMobile, () => setOpen(false), sheetRef);

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
          <div className="sd-sheet" ref={sheetRef} onClick={e => e.stopPropagation()}>
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
          background: var(--ui-branco);
          border: 1.5px solid #E5D8DE;
          border-radius: var(--ui-raio-p);
          font-size: 15px;
          font-weight: 700;
          color: #2D1F26;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .sd-trigger:hover { border-color: var(--ui-rosa); }
        .sd-trigger--open {
          border-color: var(--ui-rosa);
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
        .sd-trigger-text--placeholder { color: var(--text-muted); font-weight: 500; }
        .sd-trigger-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px; height: 24px;
          background: var(--primary-light);
          color: var(--ui-rosa);
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
          background: var(--ui-branco);
          border-radius: var(--ui-raio-janela) var(--ui-raio-janela) 0 0;
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
          font-weight: 700;
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
        .sd-sheet-item--ativo svg { color: var(--ui-rosa); }
        .sd-sheet-item--extra {
          border-top: 1px solid #F0EBED;
          margin-top: 4px;
          padding-top: 14px;
          color: var(--ui-rosa);
        }
        .sd-sheet-item--extra .sd-item-label { font-weight: 700; }
        .sd-sheet-item--extra .sd-item-icon {
          background: var(--primary-light);
          color: var(--ui-rosa);
        }

        /* Popover (desktop) */
        .sd-popover {
          position: fixed;
          background: var(--ui-branco);
          border: 1px solid #F0EBED;
          border-radius: var(--ui-raio-p);
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
        .sd-pop-item--ativo svg { color: var(--ui-rosa); }
        .sd-pop-item--extra {
          border-top: 1px solid #F0EBED;
          margin-top: 4px;
          padding-top: 10px;
          color: var(--ui-rosa);
        }
        .sd-pop-item--extra .sd-item-label { font-weight: 700; }
        .sd-pop-item--extra .sd-item-icon {
          background: var(--primary-light);
          color: var(--ui-rosa);
        }

        /* Item shared */
        .sd-item-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px; height: 26px;
          background: #FAF8F5;
          color: var(--ui-texto-2);
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
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 500;
          margin-top: 2px;
        }
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
  { value: "kit", label: "Por Kit" },
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
  // (24/10) produto novo vem como encomenda com 2 dias de antecedência marcado (antes vinha "Sem prazo")
  ...({ antecedencia: "48h" } as any),
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

/**
 * (24/10) "Quantos dias antes?" da encomenda: as opções principais (24h, 2 dias, 3 dias) e "Personalizado",
 * que abre um contador de dias (1 a 60). Grava no mesmo formato de antes ("24h", "48h", "3d", "10d").
 */
function PrazoEncomenda({ valor, aoMudar }: { valor: string | null; aoMudar: (v: string) => void }) {
  const PRINC = [{ v: "24h", r: "24 horas" }, { v: "48h", r: "2 dias" }, { v: "3d", r: "3 dias" }];
  const principal = PRINC.some(p => p.v === valor);
  const [perso, setPerso] = useState(!!valor && !principal);
  const dias = Math.max(1, Math.round(horasAntecedencia(valor) / 24) || 4);
  const mudarDias = (n: number) => aoMudar(`${Math.min(60, Math.max(1, n))}d`);
  return (
    <div className="prod-field" style={{ marginTop: 12 }}>
      <label>Quantos dias antes?</label>
      <div className="prod-prazo" role="radiogroup" aria-label="Quantos dias antes">
        {PRINC.map(p => (
          <button key={p.v} type="button" role="radio" aria-checked={!perso && valor === p.v} className={!perso && valor === p.v ? "on" : ""}
            onClick={() => { setPerso(false); aoMudar(p.v); }}>{p.r}</button>
        ))}
        <button type="button" role="radio" aria-checked={perso} className={perso ? "on" : ""}
          onClick={() => { setPerso(true); if (principal || !valor) mudarDias(principal ? Math.max(4, dias) : 4); }}>Personalizado</button>
      </div>
      {perso && (
        <div className="prod-prazo-n">
          <div className="prod-prazo-cont">
            <button type="button" aria-label="Menos um dia" onClick={() => mudarDias(dias - 1)} disabled={dias <= 1}>−</button>
            <b>{dias} {dias === 1 ? "dia" : "dias"}</b>
            <button type="button" aria-label="Mais um dia" onClick={() => mudarDias(dias + 1)} disabled={dias >= 60}>+</button>
          </div>
          <span>O cliente pede com {dias} {dias === 1 ? "dia" : "dias"} de antecedência</span>
        </div>
      )}
    </div>
  );
}

export default function Produtos() {
  const location = useLocation();
  const navigate = useNavigate();
  // activeTab segue a URL: /produtos/categorias → "categorias", senão "produtos"
  const activeTab: "produtos" | "categorias" = location.pathname.startsWith("/produtos/categorias") ? "categorias" : "produtos";
  const setActiveTab = (tab: "produtos" | "categorias") => {
    navigate(tab === "categorias" ? "/categorias" : "/produtos"); // 3.23: Categorias é uma tela só
  };
  const [userId, setUserId] = useState("");
  const [primeiroNome, setPrimeiroNome] = useState<string>("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  // Plano grátis: até 10 produtos (quem já tinha mais continua com tudo; só não cria novos)
  const [limiteAberto, setLimiteAberto] = useState(false);
  const [categorias, setCategorias] = useState<string[]>([]);
  // (15/10) avisos no padrão do app (avisar): antes era uma janela própria com "Entendi"
  const showToast = (tipo: "success" | "error" | "info", titulo: string, sub?: string) => {
    avisar(tipo === "error" && sub ? `${titulo}. ${sub}` : titulo, { tipo: tipo === "success" ? "ok" : tipo === "error" ? "erro" : "info" });
  };

  // ═══ Bulk selection (desktop) ═══
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // (21/10) celular: o símbolo de promoção ao lado do preço mostra uma frase curta ao tocar
  const [dicaPromo, setDicaPromo] = useState<string | null>(null);
  useEffect(() => { if (!dicaPromo) return; const t = window.setTimeout(() => setDicaPromo(null), 2600); return () => window.clearTimeout(t); }, [dicaPromo]);
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
  // (11/10) a lista não carregou: mostra o erro com "Tentar de novo" em vez da tela de conta nova
  const [erroCarga, setErroCarga] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // (11/10) IA escrevendo a descrição: estado próprio (antes o "Melhorando..." ficava dentro do campo e era salvo)
  const [gerandoDesc, setGerandoDesc] = useState<null | "gerar" | "melhorar">(null);
  // (11/10) muda a cada abrir/fechar do cadastro: resposta atrasada (foto subindo, IA) de outra abertura é descartada
  const abertura = useRef(0);
  const [modal, setModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  // (14/10) Escolhas em checklist: 0 = a lista; 1..n = a tela de cada escolha marcada
  const [escTela, setEscTela] = useState(0);
  // (30/10 · 5.27) o passo Preço tem duas telas: o preço e depois "Cardápio e entrega" (antes tudo junto e a janela rolava o dobro)
  const [entTela, setEntTela] = useState(false);
  useEffect(() => { if (wizardStep < 5) setEntTela(false); }, [wizardStep]);
  const [infoPasso, setInfoPasso] = useState(false);
  const lojaPronta = useLojaPronta(userId); // (14/10) "Ver no cardápio" na tela de sucesso só com a loja configurada // (14/10) (i) do header do cadastro
  const [kgPromo, setKgPromo] = useState(false); // (14/10) "Colocar em promoção" no preço por kg
  // Cadastro de bolo em 4 etapas (tipo "Bolos" no cadastro novo)
  const [tipoCadastro, setTipoCadastro] = useState<TipoCadastro | null>(null);
  // Cadastro: tentou continuar com algo faltando → mostra o que falta acima do botão (some ao trocar de tela)
  const [mostrarFalta, setMostrarFalta] = useState(false);
  useEffect(() => { setMostrarFalta(false); }, [wizardStep, modal, escTela]);
  useEffect(() => { if (!modal) { setEscTela(0); setKgPromo(false); } }, [modal]);
  // cada tela nova (passo ou escolha) começa do topo
  useEffect(() => { document.querySelectorAll<HTMLElement>(".prod-modal--novo .prod-modal-body").forEach(el => { el.scrollTop = 0; }); }, [wizardStep, escTela]);
  const [wizardTipo, setWizardTipo] = useState<"simples" | "variacoes" | "personalizavel">("simples");
  const [editTab, setEditTab] = useState<"resumo" | "info" | "opcoes" | "preco" | "fotos" | "entrega">("resumo");
  // (14/10) edição em resumo: guarda o produto como está salvo, pra saber se mudou algo e pra desfazer no "Voltar"
  const formSalvo = useRef<any>(null);
  const NOME_SECAO: Record<string, string> = { info: "Nome e descrição", opcoes: "Escolhas", fotos: "Fotos", preco: "Preço e promoção", entrega: "Cardápio e entrega" };
  useEffect(() => { setEscTela(0); }, [editTab]); // trocar de aba volta a lista das escolhas
  // Tela de sucesso depois de publicar um produto novo
  const [sucesso, setSucesso] = useState<null | { id?: string; nome: string; imagem?: string; primeiro: boolean; fora?: boolean; pronta?: boolean | null; semExtras?: boolean }>(null);
  const [form, setForm] = useState<Produto>(EMPTY);
  // (24/10) produto simples no cadastro novo (sem tamanhos, sem kit e sem preço pelo sabor): a promoção vem com a caixinha
  const simplesNovo = !form.id && !((form.grupo_tamanhos as any)?.ativo && ((form.grupo_tamanhos as any).opcoes?.length || 0) > 0) && !kitAtivo((form as any).kit_qtd) && !precosDosSabores(form);
  useEffect(() => { setEscTela(0); }, [form.id]); // (14/10) outro produto: as escolhas abrem na lista

  // Auto-sync: se modo do tamanho é por_peso, forma_venda vira kg automaticamente.
  // E se ela trocar de volta pra "Preço fixo por opção", desfaz (antes o produto ficava "por kg" pra sempre)
  const modoTamanhoAnterior = useRef<string | undefined>(undefined);
  const produtoCarregadoId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const modo = form.grupo_tamanhos?.modo_preco_tamanho;
    // Abrindo um produto já salvo pra editar: só registra o modo, não mexe na forma de venda
    // (antes, abrir um bolo "pelo peso" e salvar sem mexer virava "vendido por kg")
    if (form.id !== produtoCarregadoId.current) {
      produtoCarregadoId.current = form.id;
      modoTamanhoAnterior.current = modo;
      if (form.id) return;
    }
    // Bolo com tamanhos pelo peso continua "por unidade" (o cliente compra um bolo P/M/G, não quilos)
    if (modo === "por_peso" && form.forma_venda !== "kg" && !(tipoCadastro === "bolos" && !form.id)) {
      setForm(f => ({ ...f, forma_venda: "kg" }));
    } else if (modo !== "por_peso" && modoTamanhoAnterior.current === "por_peso" && form.forma_venda === "kg") {
      setForm(f => ({ ...f, forma_venda: "unidade" }));
    }
    modoTamanhoAnterior.current = modo;
  }, [form.grupo_tamanhos?.modo_preco_tamanho, form.id]);

  const DRAFT_KEY = "doonly_produto_draft_v1";
  const [ordenarPor, setOrdenarPor] = useState<"recentes"|"alfabetica"|"categoria"|"preco">("recentes");
  const [catsFiltro, setCatsFiltro] = useState<string[] | null>(null); // (24/10) null = todas as categorias
  const [filtroProdAberto, setFiltroProdAberto] = useState(false);
  const [filtroOrfaos, setFiltroOrfaos] = useState(false);
  // (27/10) Destaques do cardápio: até 6 (o banco também confere)
  const [soDestaques, setSoDestaques] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaCategoriaIcone, setNovaCategoriaIcone] = useState("");
  const [showCatInput, setShowCatInput] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewProduto, setPreviewProduto] = useState<Produto | null>(null);
  const [previewMenu, setPreviewMenu] = useState(false);
  const [novoKitItem, setNovoKitItem] = useState({ nome: "", quantidade: "" });
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropSlot, setCropSlot] = useState(0);
  // viewMode fixo em grid (Netflix) — modo lista removido
  const [buscaTexto, setBuscaTexto] = useState("");

  // Ficha técnica (CMV)
  type Insumo = { id: string; nome: string; unidade: string; custo_unitario: number; imagem_url?: string };
  type FichaItem = { insumo_id: string; quantidade: number; unidade_utilizada: string; insumo?: Insumo };
  const [fichaTecnica, setFichaTecnica] = useState<FichaItem[]>([]);
  // 10/10: a ficha só é regravada ao salvar se foi lida com sucesso pra ESTE produto (e se mudou).
  // Antes, se a leitura falhasse ou demorasse, salvar o produto apagava a ficha inteira.
  const fichaLida = useRef<{ produtoId: string; assinatura: string } | null>(null);
  const fichaPedida = useRef<string | null>(null);
  const assinaturaFicha = (itens: { insumo_id: string; quantidade: number; unidade_utilizada: string }[]) =>
    JSON.stringify(itens.filter(f => f.insumo_id && f.quantidade > 0).map(f => [f.insumo_id, Number(f.quantidade), f.unidade_utilizada || ""]));
  // Custos da conta (pra conta do lucro ser a mesma da Ficha técnica)
  const [maoConta, setMaoConta] = useState<MaoObraConta>(null);
  const [cvConta, setCvConta] = useState<number | null>(null);
  const [vendaConta, setVendaConta] = useState<CustoDaVenda | null>(null);

  const imgRef = useRef<HTMLInputElement>(null);
  const img2Ref = useRef<HTMLInputElement>(null);
  const img3Ref = useRef<HTMLInputElement>(null);
  const img4Ref = useRef<HTMLInputElement>(null); // (21/10) PRO: até 4 fotos por produto
  const { isPro } = usePlano();
  const { profile } = useProfile();

  // Auto-abre cadastro quando vem de Pedidos
  useEffect(() => {
    if (!loading && (location.state as any)?.abrirCadastro) {
      window.history.replaceState({ ...(window.history.state || {}), usr: null }, ""); // (11/10) mantém idx e key do roteador (o voltarOuIr usa)
      // Abre igual ao botão "Novo produto" (a escolha com imagens: bolos, doces, salgados…).
      // Antes abria a janela sem zerar e caía na tela antiga de tipo de cadastro.
      openNovo();
    }
  }, [loading, location.state]);

  // (11/10) a trava de rolagem do cadastro e do produto aberto agora é a do useSobreposicao (mais abaixo):
  // a trava manual daqui brigava com a das janelas abertas por cima e a lista voltava pro topo.

  // Fecha menu do preview quando preview fecha
  useEffect(() => { if (!previewProduto) setPreviewMenu(false); }, [previewProduto]);

  // Fecha menu ao clicar fora
  useEffect(() => {
    if (!previewMenu) return;
    const handler = () => setPreviewMenu(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [previewMenu]);
  // (11/10) se a lista de produtos não carregar, a tela mostra o erro com "Tentar de novo"
  // (antes aparecia "Cadastre seu primeiro produto" pra quem tinha produtos, ou o carregando ficava pra sempre)
  const carregarTudo = async () => {
    setLoading(true); setErroCarga("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErroCarga("Tente de novo em instantes."); setLoading(false); return; }
      setUserId(user.id);
      // Buscar nome pra personalizar tooltips
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
      if (profile?.nome) setPrimeiroNome(profile.nome.trim().split(/\s+/)[0]);
      const erroProdutos = await loadProdutos(user.id);
      if (erroProdutos) { setErroCarga(explicarErro(erroProdutos, "Tente de novo em instantes.")); setLoading(false); return; }
      await loadCategorias(user.id);
      await loadCustosConta(user.id);
    } catch (e) {
      setErroCarga(explicarErro(e, "Tente de novo em instantes."));
    }
    setLoading(false);
  };
  useEffect(() => { void carregarTudo(); }, []);

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

  // 10/10: custos invisíveis e mão de obra salvos na conta, lidos do mesmo jeito que a Ficha técnica lê
  // (cada um à parte: se a coluna ou a tabela não existir, vale o que está no produto)
  const loadCustosConta = async (uid: string) => {
    try {
      const [cv, mao, vars] = await Promise.all([
        supabase.from("profiles").select("custos_invisiveis_pct").eq("id", uid).maybeSingle(),
        lerMaoObraConta(uid).catch(() => null),
        supabase.from("custos_variaveis").select("*").eq("user_id", uid),
      ]);
      // (13/10) a mesma conta da Ficha técnica: taxa do crédito (pior caso) + custo fixo por pedido
      if (!vars.error) setVendaConta({ pct: taxaPctDaForma("credito", (vars.data as any[]) || []), fixo: fixoPorPedido((vars.data as any[]) || []) });
      const v = (cv.data as any)?.custos_invisiveis_pct;
      setCvConta(!cv.error && v != null ? Number(v) : null);
      setMaoConta(mao); // (16/10) fixos + salário, igual à tela Custos
    } catch { /* sem esses dados o lucro usa o que está salvo no produto */ }
  };

  // Devolve o erro da leitura (null = leu). Se falhar, a lista que está na tela continua como estava.
  const loadProdutos = async (uid: string): Promise<unknown> => {
    const { data, error } = await supabase
      .from("produtos")
      .select("*, produto_insumos(quantidade, unidade_utilizada, insumos(custo_unitario, unidade))")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data && !error) setProdutos(data as Produto[]);
    return error || (data ? null : new Error("sem dados"));
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
    // 10/10: mesma conta da Ficha técnica (ingredientes + custos invisíveis + mão de obra) e
    // preço com a promoção em valor ou em %. Antes aqui só saíam os ingredientes e o lucro aparecia maior.
    const c = calcularCustoLucro(p, maoConta, cvConta, vendaConta);
    return { cmv: c.cmv, lucro: c.lucro, margem: c.margemLucro, temFicha: c.temFicha, precoEfetivo: c.preco };
  };

  // (11/10) devolve os nomes lidos, ou null se a leitura falhou. `categoriasLidas` diz se a lista da tela é de verdade:
  // sem isso, uma leitura que falhou parecia "conta sem categorias" e o cadastro criava "Bolos" de novo.
  const categoriasLidas = useRef(false);
  const loadCategorias = async (uid: string): Promise<string[] | null> => {
    const { data, error } = await supabase.from("categorias").select("nome").eq("user_id", uid).order("nome");
    if (error || !data) return null;
    const nomes = data.map((c: any) => c.nome as string);
    categoriasLidas.current = true;
    setCategorias(nomes);
    return nomes;
  };

  // Rascunho automático DESLIGADO (causava bug: pulava a tela de tipos). Limpa o que ficou salvo.
  useEffect(() => { try { localStorage.removeItem(DRAFT_KEY); } catch {} }, []);

  // (27/10) Grátis: até 10 produtos NO CARDÁPIO ao mesmo tempo (os guardados fora do cardápio não contam)
  const ativosNoCardapio = produtos.filter(p => p.disponivel !== false).length;
  const passouDoLimite = (novos = 1) => !isPro && ativosNoCardapio + novos > LIMITE_PRODUTOS_GRATIS;
  const openNovo = () => {
    fichaLida.current = null; fichaPedida.current = null;
    abertura.current++; setGerandoDesc(null); setUploading(false);
    setForm(EMPTY); setFichaTecnica([]); setWizardStep(2); setWizardTipo("personalizavel"); setTipoCadastro(null); setModal(true);
  };
  // (14/10) sem a tela de tipo: a categoria é sugerida pelo nome e o tipo sai do nome/categoria ao continuar
  const sugCategoria = useMemo(() => categoriaSugerida(form.nome, categorias), [form.nome, categorias]);
  // (14/10) Tamanho (preço fixo) + "cada sabor tem o seu preço": ela escolhe de onde vem o preço, antes das tabelas
  const comboTamSabor = (f: any) => !kitAtivo(f.kit_qtd) && !!f.grupo_tamanhos?.ativo && (f.grupo_tamanhos.opcoes?.length || 0) > 0
    && (f.grupo_tamanhos.modo_preco_tamanho || "preco_fixo") === "preco_fixo" && !!f.grupo_sabores?.ativo && !!f.grupo_sabores?.sabor_tem_preco_proprio && (f.grupo_sabores.opcoes?.length || 0) > 0;
  const regraCombo = (f: any): RegraConflitoTamanho | null => !comboTamSabor(f) ? null
    : (f.grupo_sabores?.regra_conflito_tamanho || (f.id ? REGRA_CONFLITO_DEFAULT : null)) as RegraConflitoTamanho | null;
  // (14/10) a categoria sugerida já entra sozinha (sem a linha "Usar"); se ela trocar na mão, o app não mexe mais
  const [catAuto, setCatAuto] = useState<string | null>(null);
  const usarCategoriaSugerida = async (sugArg?: { nome: string; existe: boolean; icone: number | string } | null) => {
    const sug = sugArg || sugCategoria; if (!sug) return;
    setCatAuto(sug.nome);
    if (sug.existe) { setForm(f => ({ ...f, categoria: sug.nome })); return; }
    if (!userId) return;
    setSavingCat(true);
    const { error } = await supabase.from("categorias").insert({ nome: sug.nome, imagem_url: null /* (24/10) foto automática: a do primeiro produto */, ordem: categorias.length, user_id: userId })
      .then(r => r, (e: unknown) => ({ error: e }));
    setSavingCat(false);
    // 23505 = o banco já tem essa categoria (outro aparelho): vale como criada
    if (error && (error as { code?: string })?.code !== "23505") { avisar(explicarErro(error, `Não deu para criar a categoria ${sug.nome}.`), { tipo: "erro" }); return; }
    setCategorias(prev => (prev.includes(sug.nome) ? prev : [...prev, sug.nome].sort()));
    setForm(f => ({ ...f, categoria: sug.nome }));
  };
  const aoSairDoSobre = () => {
    if (form.id) return;
    const tp = tipoPeloNome(form.nome, form.categoria);
    setTipoCadastro(tp);
    // bolo (menos o de pote) começa por kg no Tamanho; o resto, preço fixo. Só enquanto o tamanho e o kit estão vazios.
    setForm(f => {
      if (f.grupo_tamanhos?.opcoes?.length || kitAtivo((f as any).kit_qtd) || !["kg", "unidade"].includes(f.forma_venda)) return f;
      const fv = tp === "bolos" && !ehBoloNoPote(f.nome) ? "kg" : "unidade";
      return fv === f.forma_venda ? f : { ...f, forma_venda: fv };
    });
  };
  // Liga/desliga e edita o kit (Tamanhos e Sabores saem quando o kit liga)
  const onKitChange = (k: KitQtdConfig) => setForm(f => {
    const ligando = k.ativo && !kitAtivo((f as any).kit_qtd);
    return {
      ...f,
      kit_qtd: k,
      ...(ligando ? {
        grupo_tamanhos: { ...(f.grupo_tamanhos || GRUPO_TAMANHOS_VAZIO), ativo: false },
        grupo_sabores: { ...(f.grupo_sabores || GRUPO_SABORES_VAZIO), ativo: false },
        forma_venda: "kit",
      } : {}),
      ...(k.ativo && precoMinKit(k) > 0 ? { preco_normal: precoMinKit(k) } : {}),
    } as any;
  });
  const openEditar = async (p: Produto) => {
    // Migração silenciosa: "sob-encomenda" era misturado no forma_venda,
    // agora é modo de produção separado (pronta_entrega=false)
    const pMigrado = { ...p };
    if (pMigrado.forma_venda === "sob-encomenda") {
      pMigrado.forma_venda = "unidade";
      pMigrado.pronta_entrega = false;
    }
    // Tamanhos ligados sem modo salvo = preço fixo (senão a tela de edição "sugere" pelo peso e muda os preços)
    const gtEd: any = (pMigrado as any).grupo_tamanhos;
    if (gtEd?.ativo && !gtEd.modo_preco_tamanho) (pMigrado as any).grupo_tamanhos = { ...gtEd, modo_preco_tamanho: "preco_fixo" };
    { const fm = migrarAdicionaisLegacy({ ...EMPTY, ...pMigrado }); setForm(fm); formSalvo.current = fm; }
    setFichaTecnica([]);
    // Detecta tipo baseado nos dados salvos
    if (p.tipo_produto === "personalizavel") {
      setWizardTipo("personalizavel");
    } else {
      const temVariacoes = (p.tamanhos_disponiveis && p.tamanhos_disponiveis.length > 0) ||
                          (p.kit_itens && p.kit_itens.length > 0);
      setWizardTipo(temVariacoes ? "variacoes" : "simples");
    }
    setWizardStep(2);
    setEditTab("resumo");
    setModal(true);
    abertura.current++; setGerandoDesc(null); setUploading(false);
    fichaLida.current = null;
    fichaPedida.current = p.id || null;
    if (p.id && userId) {
      const { data, error } = await supabase
        .from("produto_insumos")
        .select("insumo_id, quantidade, unidade_utilizada, insumos(id, nome, unidade, custo_unitario, imagem_url)")
        .eq("produto_id", p.id);
      // Resposta atrasada de outro produto (abriu um, fechou e abriu outro): descarta
      if (fichaPedida.current !== p.id) return;
      if (data && !error) {
        const itens = data.map((d: any) => ({
          insumo_id: d.insumo_id,
          quantidade: Number(d.quantidade) || 0,
          unidade_utilizada: d.unidade_utilizada || (d.insumos as any)?.unidade || "",
          insumo: d.insumos as Insumo,
        }));
        setFichaTecnica(itens);
        fichaLida.current = { produtoId: p.id, assinatura: assinaturaFicha(itens) };
      }
    }
  };
  const fecharModal = () => { fichaLida.current = null; fichaPedida.current = null; abertura.current++; setGerandoDesc(null); setCropSrc(null); setUploading(false); /* envio de foto que nunca respondeu não deixa o Salvar preso */ setSucesso(null); setModal(false); setForm(EMPTY); setFichaTecnica([]); setWizardStep(2); setWizardTipo("personalizavel"); };

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
  // 11/10: a pergunta "Descartar?" usa o confirmar(): ele só responde depois que a janela dele saiu do histórico,
  // então o cadastro fecha depois (uma janela de cada vez; fechar as duas juntas pedia dois "voltar" ao mesmo tempo).
  const perguntandoDescartar = useRef(false);
  const editMudou = () => !!form.id && JSON.stringify(form) !== JSON.stringify(formSalvo.current);
  const handleTryClose = async () => {
    if (!hasProdData() || (form.id && !editMudou())) { fecharModal(); return; }
    if (perguntandoDescartar.current) return;
    perguntandoDescartar.current = true;
    const vez = abertura.current;
    const ok = await confirmar({
      titulo: form.id ? "Descartar as alterações?" : "Descartar o cadastro?", texto: "O que você preencheu vai se perder.",
      rotulo: "Descartar", rotuloVoltar: "Continuar", perigo: true, icone: "alerta",
    });
    perguntandoDescartar.current = false;
    if (!ok || abertura.current !== vez) return;
    fecharModal();
  };

  // (14/10) "Voltar" de uma parte da edição: volta pro resumo (se mudou algo e não salvou, pergunta e desfaz)
  const voltarDaSecao = async () => {
    if (editTab === "opcoes" && escTela > 0) { setEscTela(0); return; }
    if (editMudou()) {
      const ok = await confirmar({ titulo: "Descartar as alterações?", texto: "O que você mudou aqui não vai ser salvo.", rotulo: "Descartar", rotuloVoltar: "Continuar", perigo: true, icone: "alerta" });
      if (!ok) return;
      setForm(formSalvo.current);
    }
    setEditTab("resumo");
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
    const slot = cropSlot;
    // (11/10) a foto é desta abertura do cadastro: se fechar ou abrir outro produto enquanto ela sobe, o resultado é descartado
    // (antes a foto caía no produto que estivesse aberto na hora em que o envio terminava)
    const vez = abertura.current;
    setCropSrc(null);
    setUploading(true);
    const path = `produtos/${userId}-${Date.now()}-${slot}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: 'image/jpeg' }).catch((e: unknown) => ({ error: e }));
    if (abertura.current !== vez) return;
    // 10/10: a falha no envio não avisava (a foto simplesmente não aparecia)
    if (error) avisar(explicarErro(error, "Não deu para enviar a foto. Tente de novo."), { tipo: "erro" });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => {
        const imgs = (f.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
        imgs[slot] = url;
        return { ...f, imagem_url: imgs.join(",") };
      });
    }
    setUploading(false);
  };

  // Novo: upload de foto pra variação por chave (sabor|tamanho / sabor| / |tamanho)
  const uploadFotoVariacaoKey = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    const vez = abertura.current; // (11/10) envio de outra abertura do cadastro é descartado
    setUploading(true);
    const safeName = key.replace(/[^a-zA-Z0-9]/g, "_");
    const path = `produtos/${userId}-${Date.now()}-v-${safeName}.jpg`;
    // (27/10) reduz e vira JPEG antes de enviar (foto de 10 MB ou HEIC do iPhone não abria no Android)
    let blob: Blob;
    try { blob = await (await fetch(await reduzirFoto(file, 1600, 0.85))).blob(); }
    catch { setUploading(false); avisar("Não deu para abrir essa foto. Tente outra.", { tipo: "erro" }); return; }
    const { error } = await supabase.storage.from("products").upload(path, blob, { upsert: true, contentType: "image/jpeg" }).catch((e: unknown) => ({ error: e }));
    if (abertura.current !== vez) { setUploading(false); return; }
    if (error) avisar(explicarErro(error, "Não deu para enviar a foto. Tente de novo."), { tipo: "erro" });
    if (!error) {
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => ({
        ...f,
        fotos_variacoes: { ...(f.fotos_variacoes || {}), [key]: url }
      }));
    }
    setUploading(false);
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

  // (17/10) Liga/desliga do cartão: um toque tira ou põe no cardápio, sem abrir o produto
  const MAX_DESTAQUES = 6;
  const qtdDestaques = (semId?: string) => produtos.filter(x => (x as any).destaque === true && x.id !== semId).length;
  // no cadastro aberto não tem o "Ver destaques" (fecharia a tela e perderia o que ela mexeu)
  const avisarLimiteDestaques = (comAcao = true) => avisar(`Já tem ${MAX_DESTAQUES} destaques`, {
    tipo: "erro", detalhe: "Tire um para destacar este.", ...(comAcao ? { acao: { rotulo: "Ver destaques", aoTocar: () => { setPreviewProduto(null); setSoDestaques(true); setFiltroOrfaos(false); } } } : {}) });
  const alternarDestaque = async (p: Produto) => {
    if (!p.id) return;
    const novo = (p as any).destaque !== true;
    if (novo && p.disponivel === false) { showToast("error", "Produto fora do cardápio", "Mostre o produto no cardápio para poder destacar."); return false; }
    if (novo && qtdDestaques(p.id) >= MAX_DESTAQUES) { avisarLimiteDestaques(); return false; }
    setProdutos(l => l.map(x => (x.id === p.id ? ({ ...x, destaque: novo } as any) : x)));
    const { error } = await supabase.from("produtos").update({ destaque: novo } as any).eq("id", p.id);
    if (error) {
      setProdutos(l => l.map(x => (x.id === p.id ? ({ ...x, destaque: !novo } as any) : x)));
      if (/limite_destaques/.test(`${error.message} ${(error as any).hint || ""}`)) avisarLimiteDestaques();
      else showToast("error", "Não deu certo", explicarErro(error));
      return false;
    }
    showToast("success", novo ? "Produto em destaque" : "Saiu dos destaques", novo ? "Aparece no topo do cardápio, em cartão grande." : "Continua no cardápio, na categoria dele.");
    return true;
  };
  const alternarNoCardapio = async (p: Produto) => {
    if (!p.id) return;
    const novo = p.disponivel === false;
    if (novo && passouDoLimite()) { setLimiteAberto(true); return; }
    // (27/10) fora do cardápio sai também dos destaques (o banco faz o mesmo)
    setProdutos(l => l.map(x => (x.id === p.id ? ({ ...x, disponivel: novo, ...(novo ? {} : { destaque: false }) } as any) : x)));
    const { error } = await supabase.from("produtos").update({ disponivel: novo }).eq("id", p.id);
    if (error) {
      setProdutos(l => l.map(x => (x.id === p.id ? { ...x, disponivel: !novo } : x)));
      showToast("error", "Não deu certo", explicarErro(error));
      return;
    }
    showToast("success", novo ? "Produto no cardápio" : "Produto fora do cardápio", novo ? "Os clientes já veem e podem pedir." : "Fica guardado só para você.");
  };

  // ═══ AÇÕES EM MASSA (bulk) ═══
  const handleBulkPublicar = async (publicar: boolean) => {
    if (selecionados.length === 0) return;
    setBulkLoading(true);
    const ids = selecionados.map(p => p.id!).filter(Boolean);
    if (publicar && passouDoLimite(selecionados.filter(p => p.disponivel === false).length)) { setBulkLoading(false); setLimiteAberto(true); return; }
    const { error } = await supabase.from("produtos").update({ disponivel: publicar }).in("id", ids);
    setBulkLoading(false);
    if (error) { showToast("error", "Não deu certo", explicarErro(error)); return; }
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

  // (11/10) Copia a ficha técnica de um produto pra cópia dele. Devolve false se a leitura ou a gravação falhar.
  const copiarFichaTecnica = async (deId: string, paraId: string): Promise<boolean> => {
    const { data: insumos, error: erroLer } = await supabase.from("produto_insumos")
      .select("insumo_id, quantidade, unidade_utilizada, quantidade_base")
      .eq("produto_id", deId);
    if (erroLer || !insumos) { console.error("[Doonly]", erroLer); return false; }
    if (insumos.length === 0) return true;
    const { error: erroGravar } = await supabase.from("produto_insumos").insert(
      insumos.map((i: any) => ({ ...i, produto_id: paraId, user_id: userId }))
    );
    if (erroGravar) { console.error("[Doonly]", erroGravar); return false; }
    return true;
  };

  const handleBulkDuplicar = async () => {
    if (selecionados.length === 0 || !userId) return;
    setBulkLoading(true);
    let ok = 0, falhas = 0, semFicha = 0;
    const usadosSku = skusDe(produtos); // (21/10) a cópia ganha um SKU novo (nunca repete)
    for (const p of selecionados) {
      const { id, created_at, updated_at, produto_insumos, user_id, ...limpo } = p as any;
      const sku = limpo.sku ? skuLivre(limpo.sku, usadosSku) : null;
      if (sku) usadosSku.add(sku);
      const novo = { ...limpo, sku, nome: proximoNomeCopia(p.nome), user_id: userId, disponivel: false };
      const { data, error } = await supabase.from("produtos").insert(novo).select("id").single();
      if (error) { falhas++; continue; }
      // Duplica ficha técnica também (11/10: confere a leitura e a gravação; antes dizia "cópia criada" sem a ficha)
      if (id && data?.id && !(await copiarFichaTecnica(id, data.id))) semFicha++;
      ok++;
    }
    setBulkLoading(false);
    await loadProdutos(userId);
    clearSelection();
    if (falhas > 0) {
      showToast("error", `${ok} ${ok > 1 ? "cópias criadas" : "cópia criada"}, ${falhas} ${falhas > 1 ? "falharam" : "falhou"}`, `As cópias que deram certo estão despublicadas — revise antes de publicar no cardápio.${semFicha > 0 ? ` ${semFicha === 1 ? "1 ficou" : `${semFicha} ficaram`} sem a ficha técnica.` : ""}`);
    } else if (semFicha > 0) {
      showToast("error", ok === 1 ? "Cópia criada, mas sem a ficha técnica." : `${ok} cópias criadas, ${semFicha} sem a ficha técnica.`, "Abra a cópia e monte a ficha técnica de novo.");
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
    if (error) { showToast("error", "Não deu para excluir", explicarErro(error)); return; }
    await loadProdutos(userId);
    clearSelection();
    showToast("success", `${ids.length} ${ids.length > 1 ? "produtos removidos" : "produto removido"}`, "Essa ação é definitiva. Se precisar novamente, cadastre outra vez.");
  };

  const handleSalvar = async () => {
    // 10/10: não salva com foto ainda subindo (o produto ia pro banco sem a foto)
    if (uploading) return avisar("Espere a foto terminar de enviar.", { tipo: "info" });
    // 11/10: nem com a IA ainda escrevendo a descrição
    if (gerandoDesc) return avisar("Espere a descrição ficar pronta.", { tipo: "info" });
    const eraPrimeiro = !form.id && produtos.length === 0;
    if (!form.nome.trim()) return avisar("Dê um nome ao produto", { tipo: "erro" });
    if (!(form.categoria || "").trim()) return avisar("Escolha a categoria do produto", { tipo: "erro" }); // (27/10) categoria vazia no banco vinha como null e travava o salvar
    // (14/10) todo produto diz se é pronta entrega ou encomenda (na edição fica na aba Fotos, em "Como o cliente recebe")
    if (!((form as any).pronta_entrega === true || (form as any).antecedencia)) {
      if (form.id) setEditTab("entrega");
      return avisar("Marque se o produto é pronta entrega ou encomenda.", { tipo: "erro" });
    }

    // Validação específica pra variações
    const isVariacoes = wizardTipo === "variacoes" && !form.id;
    // (15/10) na edição também confere pelas escolhas (tamanho, sabor, kit): produto antigo com o preço só nos tamanhos não salvava
    const isPersonalizavel = !isVariacoes && (wizardTipo === "personalizavel" || !!form.id);
    let precoBase = form.preco_normal;

    // (14/10) kit por quantidade: confere quantidades e preço também na edição (trocar pra "Ele escolhe" salvava o produto a R$ 0,00 no cardápio)
    if (kitAtivo((form as any).kit_qtd)) {
      const fk = faltaKit((form as any).kit_qtd);
      if (fk) {
        if (form.id) setEditTab(/preço/i.test(fk.msg) ? "preco" : "opcoes");
        return avisar(fk.msg, { tipo: "erro" });
      }
    }

    if (isVariacoes) {
      const precos = form.precos_variacoes || {};
      const valores = Object.values(precos).filter(v => v > 0);
      if (valores.length === 0) return avisar("Adicione ao menos 1 preço nas variações", { tipo: "erro" });
      // preco_normal vira o MENOR preço (pra aparecer no cardápio como "a partir de")
      precoBase = Math.min(...valores);
    } else if (isPersonalizavel) {
      const grupos = [form.grupo_massas, form.grupo_recheios, form.grupo_coberturas, form.grupo_sabores, form.grupo_tamanhos];
      const algumAtivo = grupos.some(g => g?.ativo && (g.opcoes?.length || 0) > 0) || kitAtivo((form as any).kit_qtd);
      // Produto simples (sem opções) também pode ser publicado — só precisa do preço
      if (!algumAtivo && !(form.preco_normal > 0) && !(tipoCadastro === "bolos" && !form.id)) { if (form.id) setEditTab("preco"); return avisar("Coloque o preço do produto", { tipo: "erro" }); }
      // Se tem Tamanhos ativos, preço base vem do MENOR tamanho
      const gt = form.grupo_tamanhos;
      const gs = form.grupo_sabores;
      if (gt?.ativo && gt.opcoes.length > 0) {
        // Modo por_peso: preço vem do preco_normal (R$/kg), não dos tamanhos individuais
        if (gt.modo_preco_tamanho === "por_peso") {
          if (!form.preco_normal || form.preco_normal <= 0) { if (form.id) setEditTab("preco"); return avisar("Coloque o preço do kg", { tipo: "erro" }); }
          precoBase = form.preco_normal;
        } else if (regraCombo(form) === "preco_sabor") {
          // (14/10) Tamanho + "só o sabor": o preço vem dos sabores; o tamanho é só o nome
          const precosS = (gs?.opcoes || []).map((o: any) => Number(o.preco) || 0).filter((p: number) => p > 0);
          if (precosS.length === 0) { if (form.id) setEditTab("preco"); return avisar("Coloque o preço dos sabores", { tipo: "erro" }); }
          precoBase = Math.min(...precosS);
        } else {
          const precosT = gt.opcoes.map(o => o.preco).filter(p => p > 0);
          if (precosT.length === 0) { if (form.id) setEditTab("preco"); return avisar("Coloque o preço dos tamanhos", { tipo: "erro" }); }
          precoBase = Math.min(...precosT);
        }
      } else if (gs?.ativo && gs.opcoes.length > 0 && gs.sabor_tem_preco_proprio) {
        const precosS = gs.opcoes.map((o: any) => o.preco || 0).filter((p: number) => p > 0);
        if (precosS.length === 0) { if (form.id) setEditTab("preco"); return avisar("Coloque o preço dos sabores", { tipo: "erro" }); }
        precoBase = Math.min(...precosS);
      } else if (!kitAtivo((form as any).kit_qtd)) { // o kit já foi conferido acima (preço de cada kit)
        if (!form.preco_normal || form.preco_normal <= 0) { if (form.id) setEditTab("preco"); return avisar("Coloque o preço do produto", { tipo: "erro" }); }
      }
    } else {
      if (!form.preco_normal || form.preco_normal <= 0) { if (form.id) setEditTab("preco"); return avisar("Coloque o preço do produto", { tipo: "erro" }); }
    }

    // ─── Tamanhos (10/10): as mesmas regras na criação e na edição ───
    // Antes só a criação conferia: na edição dava pra salvar tamanho sem nome, sem preço ou sem peso
    // (e o cardápio cobrava o menor preço, ou o preço de 1 kg).
    let formSalvar: Produto = form;
    const gtForm: any = form.grupo_tamanhos;
    if (gtForm?.ativo && !kitAtivo((form as any).kit_qtd)) {
      // Tamanhos ligados sem modo definido: é preço fixo por tamanho
      const modoT: string = gtForm.modo_preco_tamanho || "preco_fixo";
      // Linha em branco (sem nome, preço nem peso) sai sozinha
      let ops: OpcaoTamanho[] = (gtForm.opcoes || []).filter((o: any) => String(o?.nome || "").trim() || o?.preco > 0 || o?.peso_kg > 0);
      if (ops.some(o => !String(o.nome || "").trim())) {
        return avisar("Tem um tamanho sem nome. Coloque o nome ou apague esse tamanho.", { tipo: "erro" });
      }
      if (modoT === "preco_fixo" && regraCombo(form) === "preco_sabor") {
        // (14/10) "só o sabor": preço que sobrou nos tamanhos sai (senão o cardápio mostrava o preço do tamanho)
        ops = ops.map(o => ({ ...o, preco: 0 }));
      } else if (modoT === "preco_fixo") {
        // Exceção: o preço vem só do sabor (nenhum tamanho tem preço) — aí o tamanho é só um rótulo
        const gsForm: any = form.grupo_sabores;
        const saborDaPreco = !!gsForm?.ativo && !!gsForm.sabor_tem_preco_proprio && (gsForm.opcoes || []).some((o: any) => o?.preco > 0)
          && gsForm.regra_conflito_tamanho !== "tamanho_base_sabor_adicional"; // (14/10) "tamanho + sabor": o tamanho precisa de preço
        const semPreco = ops.find(o => !(o.preco > 0));
        if (semPreco && !(saborDaPreco && ops.every(o => !(o.preco > 0)))) {
          // (14/10) na edição, leva pra parte do preço (antes avisava em Escolhas, onde não tem o campo)
          if (form.id) setEditTab("preco");
          return avisar(`Coloque o preço do tamanho ${semPreco.nome}.`, { tipo: "erro" });
        }
      } else if (modoT === "por_peso") {
        // Tamanho sem peso gravado: lê do nome ("1 kg", "500 g"). Salvar um produto antigo já conserta os dados dele.
        // 11/10: pelo peso, o preço de cada tamanho é peso × preço do kg: o preço fixo que ficou de antes sai
        // (ele continuava gravado e o cardápio mostrava "P R$ 70,00" cobrando R$ 100)
        ops = ops.map(o => ({ ...o, preco: 0, peso_kg: Number(o.peso_kg) > 0 ? o.peso_kg : pesoKgDoNome(o.nome) }));
        const semPeso = ops.find(o => !(Number(o.peso_kg) > 0));
        if (semPeso) {
          if (form.id) setEditTab("opcoes");
          return avisar(`Coloque o peso do tamanho ${semPeso.nome} em Escolhas › Tamanho.`, { tipo: "erro" });
        }
      }
      formSalvar = { ...form, grupo_tamanhos: { ...gtForm, modo_preco_tamanho: modoT, opcoes: ops } };
    }

    // ─── Promoção em valor (11/10) ───
    // Preço promocional maior ou igual ao cheio não é promoção: avisa e não salva (antes gravava o valor com a promoção desligada).
    // Com kit ou tamanhos de preço fixo os campos da promoção em valor somem da tela, então o que ficou gravado antes sai
    // (no cardápio e na lista virava desconto em todos os tamanhos). Promoção em % continua como está.
    let ajustePromo: Partial<Produto> = {};
    if (form.tipo_promocao !== "percentual") {
      const pp = Number(form.preco_promocional) || 0;
      const gtS: any = formSalvar.grupo_tamanhos;
      const semPromoEmValor = kitAtivo((form as any).kit_qtd) || !!precosDosSabores(formSalvar) // (14/10) preço pelo sabor: promoção só em %
        || (!!gtS?.ativo && (gtS.modo_preco_tamanho || "preco_fixo") === "preco_fixo" && (gtS.opcoes || []).some((o: any) => o?.preco > 0));
      if (semPromoEmValor) {
        if (pp > 0 || form.promocao) ajustePromo = { promocao: false, preco_promocional: 0 };
      } else if (pp > 0 && pp >= (Number(form.preco_normal) || 0)) {
        // no cadastro de bolo a promoção tem um botão próprio: desligada, o valor antigo só sai
        // promoção desligada: o valor antigo só sai (produto antigo ficava sem salvar, às vezes com o campo fora da tela)
        if (!form.promocao) ajustePromo = { preco_promocional: 0 };
        else { if (form.id) setEditTab("preco"); return avisar("O preço promocional precisa ser menor que o preço cheio.", { tipo: "erro" }); }
      }
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
    // 10/10: usa o form já conferido (modo de preço definido e peso dos tamanhos preenchido).
    // O ajuste "sem modo = preço fixo" ficava depois daqui e não chegava a ser gravado.
    const gruposArray = carregarGruposDoBanco(formSalvar);
    const gruposPayload = salvarGruposParaBanco(gruposArray);

    // ─── Limpar campos que NÃO pertencem à tabela produtos ───
    // (evita Supabase rejeitar silenciosamente o update inteiro)
    const { produto_insumos, created_at, ...formLimpo } = formSalvar as any;

    // Edição: se mexeu nos preços dos tamanhos (preço fixo), o "a partir de" acompanha
    // (27/10) lê os tamanhos que vão ser gravados (com "só o sabor" os preços dos tamanhos já foram zerados)
    const gtSalvar = (formSalvar as any).grupo_tamanhos;
    if (form.id && gtSalvar?.ativo && (gtSalvar.modo_preco_tamanho || "preco_fixo") === "preco_fixo") {
      const pt = (gtSalvar.opcoes || []).map((o: any) => Number(o.preco)).filter((p: number) => p > 0);
      if (pt.length) precoBase = Math.min(...pt);
    }

    // Kit por quantidade: o preço base é o menor preço do kit
    if (kitAtivo((form as any).kit_qtd) && precoMinKit((form as any).kit_qtd) > 0) precoBase = precoMinKit((form as any).kit_qtd);

    // (14/10) SKU: só vai quando tem; se o banco ainda não tem a coluna (SQL 4.36), salva sem ele e avisa
    if (!String(formLimpo.sku || "").trim()) delete formLimpo.sku;
    else {
      // (21/10) o SKU não pode repetir na loja
      formLimpo.sku = String(formLimpo.sku).trim().toUpperCase();
      const dono = produtos.find((p: any) => p.id !== form.id && String(p.sku || "").trim().toUpperCase() === formLimpo.sku);
      if (dono) {
        showToast("error", "Esse SKU já está em uso", `O código ${formLimpo.sku} já está no produto "${dono.nome}". Escreva outro ou use Gerar.`);
        setSaving(false);
        return;
      }
    }
    const skuRepetido = (e: any) => /sku_repetido|SKU repetido/i.test(`${e?.message || ""} ${e?.hint || ""}`);
    const semColunaSku = (e: any) => /sku/i.test(String(e?.message || "")) && /column|coluna|schema/i.test(String(e?.message || ""));
    const payload = {
      ...formLimpo,
      nome: nomeProduto(String(formLimpo.nome || form.nome || "")),
      ...gruposPayload,
      ...ajustePromo,
      preco_normal: precoBase,
      tipo_produto: tipoProduto,
      updated_at: new Date().toISOString(),
    };
    let produtoId = form.id;
    if (form.id) {
      const estavaFora = produtos.find(x => x.id === form.id)?.disponivel === false;
      if (estavaFora && (payload as any).disponivel !== false && passouDoLimite()) { setSaving(false); setLimiteAberto(true); return; }
      let { error } = await supabase.from("produtos").update(payload).eq("id", form.id);
      if (error && semColunaSku(error)) { const { sku: _s, ...sem } = payload as any; void _s; ({ error } = await supabase.from("produtos").update(sem).eq("id", form.id)); if (!error) avisar("Salvo. O SKU fica guardado depois que o SQL 4.36 rodar.", { tipo: "info" }); }
      if (error && skuRepetido(error)) { showToast("error", "Esse SKU já está em uso", "Esse código já está em outro produto. Escreva outro ou use Gerar."); setSaving(false); return; }
      if (error && /limite_destaques/.test(`${error.message} ${(error as any).hint || ""}`)) { avisarLimiteDestaques(false); setSaving(false); return; }
      if (error) {
        console.error("Erro ao atualizar produto:", error);
        showToast("error", "Não deu para salvar", explicarErro(error));
        setSaving(false);
        return;
      }
    } else {
      if ((payload as any).disponivel !== false && passouDoLimite()) { setSaving(false); setLimiteAberto(true); return; }
      let { data: novo, error } = await supabase.from("produtos").insert({ ...payload, user_id: userId }).select("id").single();
      if (error && semColunaSku(error)) { const { sku: _s, ...sem } = payload as any; void _s; ({ data: novo, error } = await supabase.from("produtos").insert({ ...sem, user_id: userId }).select("id").single()); if (!error) avisar("Salvo. O SKU fica guardado depois que o SQL 4.36 rodar.", { tipo: "info" }); }
      if (error && skuRepetido(error)) { showToast("error", "Esse SKU já está em uso", "Esse código já está em outro produto. Escreva outro ou use Gerar."); setSaving(false); return; }
      if (error && /limite_destaques/.test(`${error.message} ${(error as any).hint || ""}`)) { avisarLimiteDestaques(false); setSaving(false); return; }
      if (error) {
        console.error("Erro ao criar produto:", error);
        showToast("error", "Não deu para criar", explicarErro(error));
        setSaving(false);
        return;
      }
      produtoId = novo?.id;
    }

    // Persistir ficha técnica
    // 10/10: na edição, só regrava se a ficha foi lida com sucesso pra este produto E mudou.
    // (Antes apagava e regravava sempre: se a leitura tivesse falhado, a ficha sumia.)
    let erroFicha: unknown = null;
    if (produtoId && userId) {
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
      const lida = fichaLida.current;
      if (!form.id) {
        // Produto novo: não tem ficha antiga pra apagar
        if (itens.length > 0) {
          const { error } = await supabase.from("produto_insumos").insert(itens);
          if (error) erroFicha = error;
        }
      } else if (lida && lida.produtoId === produtoId && assinaturaFicha(fichaTecnica) !== lida.assinatura) {
        // (28/10) grava os novos antes de tirar os antigos (antes apagava tudo e, se o insert falhasse, a ficha sumia)
        const { error: errIns } = await gravarInsumosDoProduto(produtoId, itens);
        if (errIns) erroFicha = errIns;
        if (!erroFicha) fichaLida.current = { produtoId, assinatura: assinaturaFicha(fichaTecnica) };
      } else if (form.id && !lida && itens.length > 0) {
        // a ficha não foi lida (falha de rede) e ela montou ingredientes: avisa em vez de descartar em silêncio
        erroFicha = new Error("A ficha técnica não foi carregada. Feche e abra o produto de novo.");
      }
    }

    await loadProdutos(userId);
    setSaving(false);
    if (erroFicha) {
      // O produto foi salvo; a ficha não. Na edição a janela fica aberta pra tentar de novo.
      avisar(explicarErro(erroFicha, form.id
        ? "O produto foi salvo, mas a ficha técnica não. Tente salvar de novo."
        : "O produto foi criado, mas os ingredientes não foram salvos. Monte a ficha técnica de novo."), { tipo: "erro" });
      if (form.id) return;
    }
    // Edição: aviso rápido e fecha
    if (form.id) {
      // (14/10) salvou uma parte: volta pro resumo (a janela continua aberta)
      formSalvo.current = form;
      setEditTab("resumo");
      avisar("Alterações salvas", { tipo: "ok" }); // (14/10) aviso rápido (a janela "Entendi" a cada parte cansava)
      return;
    }
    // Cadastro novo: tela de sucesso com os próximos passos
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    // (16/10) confere de novo DEPOIS de salvar: se o produto era o último passo, o cardápio já abriu (antes usava o que
    // sabia antes de salvar e mostrava "Terminar de abrir o cardápio" com a loja já pronta). E vê se ela já vende extras.
    avisarPassos();
    const [passosAgora, extras] = await Promise.all([
      userId ? lerPassos(userId).catch(() => null) : Promise.resolve(null),
      userId ? supabase.from("biblioteca_extras").select("id", { count: "exact", head: true }).eq("user_id", userId) : Promise.resolve(null),
    ]);
    // (15/10) o aviso de sucesso não mostra mais preço nem categoria: só o nome e o que falta (foto)
    setSucesso({
      pronta: passosAgora && !passosAgora.falhou ? passosCompletos(passosAgora) : null,
      semExtras: !!extras && !(extras as any).error && ((extras as any).count ?? 0) === 0,
      id: produtoId, nome: (payload as any).nome || form.nome,
      imagem: (form.imagem_url || "").split(",").map(x => x.trim()).filter(Boolean)[0],
      primeiro: eraPrimeiro, fora: form.disponivel === false,
    });
  };
  // (15/10) "Próximos passos" do aviso de sucesso: abre o produto recém-cadastrado direto na parte (fotos / informações)
  const abrirParteDoNovo = (parte: "fotos" | "info") => {
    const id = sucesso?.id;
    const p = (id && produtos.find(x => x.id === id)) || (id ? ({ ...form, id } as Produto) : null);
    setSucesso(null);
    if (!p) { fecharModal(); return; }
    void openEditar(p);
    setEditTab(parte);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    setDeleteConfirm(null);
    // 10/10: se o banco recusar, o produto continua na lista (antes sumia da tela e voltava ao recarregar)
    if (error) { showToast("error", "Não deu para excluir", explicarErro(error)); return; }
    setProdutos(p => p.filter(x => x.id !== id));
  };

  const handleAdicionarCategoria = async (iconeOverride?: string) => {
    const nome = novaCategoria.trim();
    if (!nome || !userId) return;
    const icone = iconeOverride || novaCategoriaIcone || SYSTEM_ICONS[0];
    // Proteção: não deixa salvar nomes suspeitos (usuário deve ter colado o alerta)
    const nomeLower = nome.toLowerCase();
    if (nomeLower.includes("selecione") || nomeLower.includes("ícone") || nomeLower.includes("icone")) {
      return avisar("Nome inválido. Digite o nome da sua categoria (ex: Pudins, Bolos, Doces)", { tipo: "erro" });
    }
    if (savingCat) return;
    setSavingCat(true);
    // 11/10: confere no banco se o nome já existe (sem diferenciar maiúsculas e acentos) e se gravou.
    // Antes criava categoria repetida e, se a gravação falhasse, o produto ia pra uma categoria que não existia.
    const igual = (a: string, b: string) => a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const lista = await loadCategorias(userId);
    if (!lista) {
      setSavingCat(false);
      return avisar("Não deu para criar a categoria. Confira a internet e tente de novo.", { tipo: "erro" });
    }
    const repetida = lista.find(c => igual(c, nome));
    if (repetida) {
      // já existe: usa a que existe em vez de criar outra
      setForm(f => ({ ...f, categoria: repetida }));
      setNovaCategoria(""); setNovaCategoriaIcone(""); setShowCatInput(false);
      setSavingCat(false);
      return avisar(`A categoria ${repetida} já existe. Ela foi escolhida.`, { tipo: "info" });
    }
    const { error } = await supabase.from("categorias").insert({
      nome,
      imagem_url: null /* (24/10) foto automática */,
      ordem: lista.length,
      user_id: userId
    }).then(r => r, (e: unknown) => ({ error: e }));
    setSavingCat(false);
    if (error && (error as { code?: string })?.code !== "23505") return avisar(explicarErro(error, "Não deu para criar a categoria. Tente de novo."), { tipo: "erro" });
    setCategorias(prev => (prev.includes(nome) ? prev : [...prev, nome].sort()));
    setForm(f => ({ ...f, categoria: nome }));
    setNovaCategoria(""); setNovaCategoriaIcone(""); setShowCatInput(false);
  };

  const formatPreco = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parsePreco = (s: string) => (parseInt(s.replace(/\D/g, "")) || 0) / 100;

  const produtosFiltrados = (() => {
    let lista = [...produtos];
    if (soDestaques) lista = lista.filter(p => (p as any).destaque === true);
    if (catsFiltro) lista = lista.filter(p => catsFiltro.includes(p.categoria || "__sem"));
    if (buscaTexto.trim()) {
      const t = buscaTexto.toLowerCase();
      lista = lista.filter(p => p.nome.toLowerCase().includes(t) || p.descricao?.toLowerCase().includes(t) || String((p as any).sku || "").toLowerCase().includes(t));
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

  // Voltar um passo no cadastro (o mesmo do botão do topo e do "Voltar" do rodapé · 08/10 · 3.22)
  const voltarPassoCadastro = () => {
                  if (wizardStep === 2) { handleTryClose(); return; } // (14/10) sem a tela de tipo: o 1º passo é o "Sobre o produto"
                  // (14/10) dentro das escolhas: volta uma tela; do passo 4 volta pra última escolha marcada
                  if (wizardStep === 3 && escTela > 0) { setEscTela(t => t - 1); return; }
                  if (wizardStep === 4) { setEscTela(escolhasAtivas(form).length); setWizardStep(3); return; }
                  if (wizardStep === 5 && entTela) { setEntTela(false); return; }
                  setWizardStep(s => Math.max(2, s - 1) as 1 | 2 | 3 | 4 | 5 | 6);
                };

  // ═══ "Voltar" do Android/navegador e Esc (11/10) ═══
  // O cadastro e o produto aberto são telas por cima da lista: o voltar saía de Produtos e perdia tudo.
  // Agora: no cadastro novo volta um passo; no primeiro passo (e na edição) pergunta antes de descartar.
  // A rolagem do fundo também é travada aqui (uma trava só, a mesma das janelas que abrem por cima).
  const caixaCadastro = useRef<HTMLDivElement>(null);
  const caixaPreview = useRef<HTMLDivElement>(null);
  const aoVoltarNoCadastro = () => {
    if (limiteAberto) { setLimiteAberto(false); return; }
    if (sucesso) { fecharModal(); return; }
    if (saving) return;
    if (!form.id && wizardStep >= 2) { voltarPassoCadastro(); return; }
    if (form.id && editTab !== "resumo") { voltarDaSecao(); return; }
    handleTryClose();
  };
  useSobreposicao(modal, aoVoltarNoCadastro, caixaCadastro);
  useSobreposicao(!!previewProduto, () => { if (previewMenu) setPreviewMenu(false); else setPreviewProduto(null); }, caixaPreview);
  // Fechar e ir pra outra tela: só navega depois que a entrada da janela saiu do histórico (senão o voltar dela desfaz a tela nova)
  const irDepoisDeFechar = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (modal || previewProduto || !irDepoisDeFechar.current) return;
    const ir = irDepoisDeFechar.current;
    irDepoisDeFechar.current = null;
    void historicoAssentado().then(ir);
  }, [modal, previewProduto]);
  // (11/10) ir pra outra tela de um aviso/botão de dentro da janela: fecha a janela antes (senão fica entrada velha no histórico).
  // Lê o estado de agora pela ref: o toque no aviso pode chegar depois que a janela já fechou.
  const abertos = useRef({ modal: false, preview: false });
  abertos.current = { modal, preview: !!previewProduto };
  const irFechandoJanela = (ir: () => void) => {
    const { modal: m, preview: pv } = abertos.current;
    if (!m && !pv) { ir(); return; }
    irDepoisDeFechar.current = ir;
    if (m) fecharModal();
    if (pv) setPreviewProduto(null);
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}><span className="prod-spinner" /></div>;

  return (
    <>
      {limiteAberto && <LimitePlano tipo="produtos" limite={LIMITE_PRODUTOS_GRATIS} onClose={() => setLimiteAberto(false)} />}
    <AppPageHeader
      title="Produtos" voltar="/cadastros"
      subtitle="O que aparece no seu cardápio" infoComo={COMO_PRODUTOS} infoTour={TOUR_PRODUTOS}
      infoIcon="🎂"
      infoContent={
        <>
          <p>Aqui você <strong>cadastra e organiza tudo que vende</strong> na sua confeitaria — bolos, doces, cupcakes, kits de festa e mais.</p>
          <p>Cada produto pode ter foto, preço, descrição, sabores e variações. Você organiza por <strong>categorias</strong> para ficar fácil de encontrar e mostrar no seu cardápio digital.</p>
        </>
      }
      infoTip={<>Clique em <strong>"Novo produto"</strong> para cadastrar. Depois é só compartilhar seu cardápio com os clientes.</>}
    />
    {cropSrc && (
      <ImageCropper
        imageSrc={cropSrc}
        cropShape="rect"
        aspect={4 / 3}
        onCancel={() => setCropSrc(null)}
        onCropDone={handleProductCropDone}
      />
    )}
    <div className="prod-root">


      {/* ── Tabs — só quando tem produtos ── */}
      {produtos.length > 0 && (
      <div className="prod-tabs-novo">
        <button type="button" className={`prod-tab-novo${activeTab==="produtos"?" active":""}`} aria-pressed={activeTab==="produtos"} onClick={()=>setActiveTab("produtos")}>Produtos</button>
        <button type="button" className={`prod-tab-novo${activeTab==="categorias"?" active":""}`} aria-pressed={activeTab==="categorias"} onClick={()=>setActiveTab("categorias")}>Categorias</button>
      </div>
      )}

      {activeTab === "categorias" && <Categorias />}

      {activeTab === "produtos" && <>

      {/* Header + Busca + Ordenar — só quando tem produtos */}
      {produtos.length > 0 && (
      <>
      {/* Busca + Novo produto (08/10 · 3.21: campo de 48px e o botão do lado) */}
      <div className="pl-topo">
        <div className="ui-campo-c pl-busca" onClick={e => { if (e.target === e.currentTarget) (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus(); }}>
          <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
          <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" aria-label="Buscar produto" placeholder="Buscar" value={buscaTexto} onChange={e => setBuscaTexto(e.target.value)} />
          {buscaTexto && <BotaoIcone variante="limpo" tamanho="p" rotulo="Limpar a busca" onClick={() => setBuscaTexto("")}><XIc size={20} weight="bold" /></BotaoIcone>}
        </div>
        {/* (24/10) filtro padrão do app: ordenar e categoria na lateral */}
        <BotaoFiltro className="pl-filtro" ativos={(ordenarPor !== "recentes" ? 1 : 0) + (catsFiltro ? 1 : 0)} onClick={() => setFiltroProdAberto(true)} />
        <Botao icone={<PlusIc size={20} weight="bold" />} onClick={openNovo} className="pl-novo"><span className="pl-novo-g">Novo produto</span><span className="pl-novo-c">Novo</span></Botao>
      </div>
      {filtroProdAberto && (() => {
        const cats = [...todasCategorias, ...(produtos.some(p => !p.categoria) ? ["__sem"] : [])];
        const nCat = (c: string) => produtos.filter(p => (p.categoria || "__sem") === c).length;
        return <GavetaFiltro valor={{ ordem: ordenarPor, cats: catsFiltro || cats }} padrao={{ ordem: "recentes", cats }}
          grupos={[
            { id: "ordem", titulo: "Ordenar", tipo: "radio", opcoes: [{ k: "recentes", label: "Mais recentes" }, { k: "alfabetica", label: "Nome (A a Z)" }, { k: "categoria", label: "Categoria" }, { k: "preco", label: "Menor preço" }] },
            { id: "cats", titulo: "Categoria", tipo: "check", todas: true, opcoes: cats.map(c => ({ k: c, label: c === "__sem" ? "Sem categoria" : c, n: nCat(c) })) },
          ]}
          contar={v => produtos.filter(p => (v.cats as string[]).includes(p.categoria || "__sem")).length}
          rotulo={n => n === 0 ? "Nenhum produto" : `Ver ${n} ${n === 1 ? "produto" : "produtos"}`}
          aoAplicar={v => { setOrdenarPor(v.ordem); setCatsFiltro((v.cats as string[]).length === cats.length ? null : v.cats); setFiltroOrfaos(false); }}
          aoFechar={() => setFiltroProdAberto(false)} />;
      })()}

      {/* (27/10) "Ver destaques": a lista só com os produtos em destaque */}
      {soDestaques && (
        <div className="pl-aviso pl-aviso--dq" role="status">
          <Star size={20} weight="fill" aria-hidden="true" />
          <p><b>Destaques: {qtdDestaques()} de {MAX_DESTAQUES}.</b> Aparecem no topo do cardápio.</p>
          <Botao variante="link" onClick={() => setSoDestaques(false)}>Ver todos</Botao>
        </div>
      )}
      {/* Aviso de produtos sem categoria válida */}
      {(() => {
        const orfaos = produtos.filter(p => p.categoria && !categorias.includes(p.categoria));
        if (orfaos.length === 0) return null;
        return (
          <div className="pl-aviso" role="status">
            <WarningCircle size={20} weight="bold" aria-hidden="true" />
            {filtroOrfaos
              ? <p>Mostrando só os <b>{orfaos.length} sem categoria.</b> Abra cada um e escolha uma categoria.</p>
              : <p><b>{orfaos.length} produto{orfaos.length !== 1 ? "s" : ""} sem categoria.</b> No cardápio {orfaos.length !== 1 ? "eles" : "ele"} só aparece{orfaos.length !== 1 ? "m" : ""} em "Todos".</p>}
            <Botao variante="link" onClick={() => setFiltroOrfaos(v => !v)}>{filtroOrfaos ? "Ver todos" : "Arrumar"}</Botao>
          </div>
        );
      })()}

      {/* Seus produtos (24/10: o ordenar foi para o filtro da lateral) */}
      <div className="pl-ord">
        <TituloUi contagem={filtroOrfaos ? produtos.filter(p => p.categoria && !categorias.includes(p.categoria)).length : produtosFiltrados.length}>Seus produtos</TituloUi>
      </div>
      </>
      )}

      {loading ? (
        <div className="prod-loading-full">
          <span className="prod-spinner" />
        </div>
      ) : erroCarga ? (
        <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para carregar os produtos" texto={erroCarga}
          acao={<Botao onClick={() => void carregarTudo()}>Tentar de novo</Botao>} />
      ) : produtos.length > 0 && produtosFiltrados.length === 0 ? (
        // (11/10) busca sem resultado não é conta nova (antes aparecia "Cadastre seu primeiro produto")
        <TelaVazia caixa icone={<MagnifyingGlass size={30} />} titulo="Nenhum produto com esse nome" texto="Confira a busca."
          acao={<Botao variante="secundario" onClick={() => setBuscaTexto("")}>Limpar a busca</Botao>} />
      ) : produtosFiltrados.length === 0 ? (
        <div className="prod-hero-split">
          {/* ── Lado esquerdo: texto + CTAs + dica ── */}
          <div className="prod-hero-left">
            <span className="prod-hero-eyebrow">Vamos começar</span>
            <h1 className="prod-hero-title">Cadastre seu<br/>primeiro produto</h1>
            <p className="prod-hero-desc">
              Seu catálogo é a vitrine da sua confeitaria. Quanto mais completo,
              mais profissional ele será e mais clientes você conquista.
            </p>
            <div className="prod-hero-actions">
              <button className="prod-hero-btn-primary" onClick={openNovo}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Cadastrar produto
              </button>
              {/* 13/10: o "Ver tutorial" saiu: o vídeo ainda não existe e o botão só avisava "chega em breve" */}
            </div>
            {/* (24/10) a dica da foto saiu daqui (fica no cadastro do produto) */}
          </div>

          {/* (27/10) o "vídeo tutorial · Em breve" (roxo, não abria nada) virou o mascote com a caixa */}
          <div className="prod-hero-right prod-hero-masc" aria-hidden="true">
            <img src="/Sistema/produtos-vazio.webp" alt="" width={200} height={200} />
          </div>
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
              className={`prod-card${p.id && isSelected(p.id) ? " prod-card--selected" : ""}${p.disponivel === false ? " desativado" : ""}`}
              style={{ cursor: "pointer", position: "relative" }}
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
                    <Camera size={24} weight="bold" aria-hidden="true" />
                    <div className="prod-card-sem-foto-title">Adicionar foto</div>
                  </div>
                )}
                {/* Etiquetas empilhadas (antes ficavam uma em cima da outra no mesmo canto).
                    (15/10) "Fora do cardápio" entra na mesma pilha: no cartão estreito batia na "Encomenda" */}
                <div className="prod-card-tags prod-card-tags--dir">
                </div>
                <div className="prod-card-tags prod-card-tags--esq">
                  {catInvalida && <div className="prod-card-semcat">Sem categoria</div>}
                  {(p.tamanhos_disponiveis && p.tamanhos_disponiveis.length > 0) && (
                    <div className="prod-card-badge-var">
                      {p.tamanhos_disponiveis.length === 1 ? p.tamanhos_disponiveis[0].label : `${p.tamanhos_disponiveis.length} opções`}
                    </div>
                  )}
                </div>
              </div>
              <div className="prod-card-info">
                <p className={`prod-card-nome${(p as any).destaque === true ? " prod-card-nome--dq" : ""}`} title={(p as any).destaque === true ? `${p.nome} (em destaque)` : p.nome}>{p.nome}</p>
                {/* (21/10) celular: lista, uma informação por linha (preço ativo, tipo, lucro estimado ou Criar ficha) */}
                {(() => {
                  const pl = precoDaLista(p);
                  const unid = pl.aPartir || !pl.unidade || pl.unidade === "a unidade" ? "" : pl.unidade.replace(/^por /, "o ");
                  const promo = pl.de > 0;
                  const { lucro, margem, temFicha } = calcularLucro(p);
                  const tier = margem >= 50 ? "alto" : margem >= 25 ? "medio" : "baixo";
                  return (
                    <div className="pl-lin">
                      <div className="pl-lin-preco">
                        {pl.aPartir && <small>a partir de</small>}
                        <b className={promo ? "promo" : ""}>R$&nbsp;{formatPreco(pl.final)}</b>
                        {unid && <small>{unid}</small>}
                        {promo && (
                          <button type="button" className="pl-cupom" aria-label="Esse produto está em promoção atualmente"
                            onClick={e => { e.stopPropagation(); setDicaPromo(d => d === p.id ? null : (p.id || null)); }}>
                            <SealPercent size={18} weight="regular" aria-hidden="true" />
                          </button>
                        )}
                        {dicaPromo === p.id && <span className="pl-dica" role="status">Esse produto está em promoção atualmente</span>}
                        <button type="button" role="switch" aria-checked={p.disponivel !== false} aria-label={`Mostrar ${p.nome} no cardápio`}
                          className="pl-chave pl-lin-chave" onClick={e => { e.stopPropagation(); void alternarNoCardapio(p); }}><span /></button>
                      </div>
                      <p className="pl-lin-tipo">{(p as any).antecedencia ? "Encomenda" : "Pronta entrega"}</p>
                      {temFicha
                        ? <p className={`pl-lin-lucro pl-lin-lucro--${tier}`}>Lucro estimado R$&nbsp;{formatPreco(lucro)} ({margem.toFixed(0)}%)</p>
                        : <button type="button" className="pl-lin-ficha" onClick={e => { e.stopPropagation(); navigate("/ficha-tecnica", { state: { produtoId: p.id } }); }}>Criar ficha técnica</button>}
                    </div>
                  );
                })()}
                {/* (17/10) Fichinha: preço cheio, promoção e tipo em linhas (as etiquetas da foto saíram) */}
                {(() => {
                  const pl = precoDaLista(p);
                  // unidade vira o rótulo ("O kg", "O cento"…), pra o valor caber numa linha; "a unidade" fica só "Preço"
                  const rotulo = pl.aPartir ? "A partir de" : !pl.unidade || pl.unidade === "a unidade" ? "Preço" : `Preço ${pl.unidade.replace(/^por /, "o ").replace(/^o /, "do ").replace(/^a /, "da ")}`; // (24/10) "Preço do kg", "Preço do cento" (antes "O kg")
                  const cheio = pl.de > 0 ? pl.de : pl.final;
                  return (
                    <dl className="pl-ficha">
                      <div><dt>{rotulo}</dt><dd>R$&nbsp;{formatPreco(cheio)}</dd></div>
                      {/* (24/10) sem promoção a linha fica reservada (vazia) no computador: Tipo e Cardápio ficam na mesma altura em todos os cartões */}
                      {pl.de > 0 ? <div><dt>Promoção</dt><dd className="pl-ficha-promo">R$&nbsp;{formatPreco(pl.final)}</dd></div> : <div className="pl-ficha-vaga" aria-hidden="true" />}
                      {/* Mesma regra do cardápio: só é encomenda quando tem antecedência marcada */}
                      <div><dt>Tipo</dt><dd>{(p as any).antecedencia ? "Encomenda" : "Pronta entrega"}</dd></div>
                      <div className="pl-ficha-on"><dt>Cardápio</dt><dd>
                        <button type="button" role="switch" aria-checked={p.disponivel !== false} aria-label={`Mostrar ${p.nome} no cardápio`}
                          className="pl-chave" onClick={e => { e.stopPropagation(); void alternarNoCardapio(p); }}><span /></button>
                      </dd></div>
                    </dl>
                  );
                })()}
                <div className="prod-card-bottom">
                {(() => {
                  const { lucro, margem, temFicha } = calcularLucro(p);
                  if (!temFicha) {
                    return (
                      <button type="button" className="pl-sem-ficha"
                        onClick={e => { e.stopPropagation(); navigate("/ficha-tecnica", { state: { produtoId: p.id } }); }}>
                        <ListChecks size={16} weight="bold" aria-hidden="true" />Criar ficha<span className="pl-sem-ficha-x">técnica</span>
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
        <div className={`prod-modal-overlay${sucesso ? " prod-modal-overlay--sucesso" : ""}`} onClick={sucesso ? fecharModal : handleTryClose}>
          {/* a janela do limite do plano abre por cima sem entrar na pilha: nessa hora o foco não fica preso aqui */}
          <div className={`prod-modal prod-modal--novo${sucesso ? " prod-modal--aviso" : ""}${!form.id && wizardStep === 5 && !sucesso ? " prod-modal--largo" : ""}`} ref={limiteAberto ? undefined : caixaCadastro} onClick={e => e.stopPropagation()} onFocusCapture={selecionarValorAoFocar} onClickCapture={selecionarValorAoFocar}>
            {sucesso ? (
              <SucessoProdutoTela primeiro={sucesso.primeiro} nome={sucesso.nome} foraDoCardapio={sucesso.fora}
                semFoto={!sucesso.imagem}
                semDescricao={!(form.descricao || "").trim()}
                onFechar={fecharModal}
                onOutro={() => { setSucesso(null); openNovo(); }}
                onCusto={() => { const id = sucesso.id; irDepoisDeFechar.current = () => { navigate("/ficha-tecnica", { state: { produtoId: id } }); setTimeout(() => window.scrollTo(0, 0), 0); }; fecharModal(); }}
                onFoto={() => abrirParteDoNovo("fotos")}
                onDescricao={() => abrirParteDoNovo("info")}
                lojaPronta={sucesso.pronta ?? lojaPronta}
                semExtras={sucesso.semExtras}
                onExtras={() => { irDepoisDeFechar.current = () => { navigate("/complementos"); setTimeout(() => window.scrollTo(0, 0), 0); }; fecharModal(); }}
                onTerminarLoja={() => { irDepoisDeFechar.current = () => { navigate("/"); setTimeout(() => window.scrollTo(0, 0), 0); }; fecharModal(); }} />
            ) : (<>
            {wizardStep >= 2 && (() => {
              // (14/10) header rosa no padrão das telas: foto (ou ícone), título, (i) e o passo; barra fina embaixo
              const ativasH = escolhasAtivas(form);
              const nEsc = ativasH.length;
              const total = 6 + nEsc; // (14/10) + a Revisão no fim · (30/10) + Cardápio e entrega
              const atual = wizardStep <= 2 ? 1 : wizardStep === 3 ? 2 + escTela : wizardStep === 4 ? 3 + nEsc : wizardStep === 5 ? 4 + nEsc + (entTela ? 1 : 0) : 6 + nEsc;
              const ROT: Record<string, string> = { tamanho: "Tamanho", massa: "Massa", recheio: "Recheio", cobertura: "Cobertura", sabor: "Sabor", quantidade: "Quantidade" };
              const escAtual = wizardStep === 3 && escTela > 0 ? ativasH[escTela - 1] : null;
              const nomePasso = wizardStep <= 2 ? "Sobre o produto" : wizardStep === 3 ? (escAtual ? ROT[escAtual] : "Escolhas") : wizardStep === 4 ? "Fotos" : wizardStep === 5 ? (entTela ? "Cardápio e entrega" : "Preço") : "Revisão";
              const foto = (form.imagem_url || "").split(",").map(x => x.trim()).filter(Boolean)[0];
              return (
              <div className="prod-modal-header-novo pcab">
                {((wizardStep >= 3 && !form.id) || (form.id && editTab !== "resumo")) && (
                  <button type="button" className="pcab-bt" onClick={form.id ? voltarDaSecao : voltarPassoCadastro} aria-label="Voltar"><ArrowLeftIc size={22} weight="bold" aria-hidden="true" /></button>
                )}
                {/* numa parte da edição o título é maior ("Cardápio e entrega"): fica só a seta, sem a foto */}
                {!(form.id && editTab !== "resumo") && <span className="pcab-foto" aria-hidden="true">{foto ? <img src={foto} alt="" /> : <Cake size={22} weight="bold" />}</span>}
                <div className="pcab-txt">
                  <div className="pcab-linha">
                    <h2 className="pcab-t">{form.id ? (editTab === "resumo" ? "Editar produto" : NOME_SECAO[editTab] || "Editar produto") : "Novo produto"}</h2>
                    <button type="button" className="pcab-i" onClick={() => setInfoPasso(true)} aria-label="Sobre este passo" aria-haspopup="dialog"><Info size={20} weight="bold" aria-hidden="true" /></button>
                  </div>
                  <p className="pcab-s" aria-label={form.id ? undefined : `Passo ${atual} de ${total}: ${nomePasso}`}>{form.id ? (form.nome || "Produto") : `${atual} de ${total} · ${nomePasso}`}</p>
                </div>
                <button type="button" className="pcab-bt" onClick={handleTryClose} aria-label="Fechar"><XIc size={22} weight="bold" aria-hidden="true" /></button>
                {!form.id && <div className="pcab-barra" aria-hidden="true"><i style={{ width: `${Math.round((atual / total) * 100)}%` }} /></div>}
                <Janela aberta={infoPasso} aoFechar={() => setInfoPasso(false)} titulo={form.id ? "Editar produto" : nomePasso}
                  icone={<Info size={32} />} umaAcao acoes={<Botao onClick={() => setInfoPasso(false)} data-foco-inicial>Entendi</Botao>}>
                  <p className="pcab-info">{form.id ? "Use Editar na parte que quer mudar e depois Salvar. O cardápio atualiza na hora."
                    : wizardStep <= 2 ? "O nome e a categoria são o que o cliente vê primeiro. A descrição ajuda a vender: conte o que vem no produto."
                    : escAtual ? `Cadastre as opções de ${ROT[escAtual].toLowerCase()}. No cardápio, o cliente escolhe entre elas ao fazer o pedido.`
                    : wizardStep === 3 ? "Marque o que o cliente escolhe ao pedir, como tamanho ou sabor. Cada escolha marcada vira uma tela para você cadastrar as opções."
                    : wizardStep === 4 ? "A foto principal é a que aparece no cardápio. Produto com foto vende mais."
                    : wizardStep === 5 && entTela ? "Diga se o produto é pronta entrega ou sob encomenda e como ele aparece no cardápio."
                    : wizardStep === 5 ? "Coloque o preço e, se quiser, uma promoção."
                    : "Veja como o produto aparece no cardápio e confira tudo antes de publicar."}</p>
                </Janela>
              </div>
              );
            })()}

            {/* (14/10) edição: abre num resumo com "Editar" em cada parte (as abas saíram) */}
            {form.id && editTab === "resumo" && (
              <div className="prod-modal-body">
                <ResumoEdicao form={form} isPro={isPro} onEditar={(t: any) => setEditTab(t)} />
              </div>
            )}

            {/* ══════ WIZARD STEP 2 (FORMULÁRIO) ══════ */}
            {/* ══════ WIZARD STEP 2 — IDENTIDADE (nome, categoria, descrição) ══════ */}
            {((wizardStep === 2 && !form.id) || (form.id && editTab === "info")) && (
            <div className="prod-modal-body">
              <div className="prod-section">
                {/* 1. Nome */}
                <div className="prod-field">
                  <label className="prod-field-label-novo">Nome do produto <ReqTag /></label>
                  <input
                    id="prod-nome-input"
                    type="text"
                    placeholder="Ex.: bolo de morango"
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    onBlur={e => {
                      setForm(f => ({ ...f, nome: nomeProduto(e.target.value) }));
                      // (14/10) preenche a categoria pelo nome: só se estiver vazia ou se foi o próprio app que escolheu
                      if (form.id || showCatInput) return;
                      if (form.categoria && form.categoria !== catAuto) return;
                      const sug = categoriaSugerida(e.target.value, categorias);
                      if (sug && sug.nome !== form.categoria) void usarCategoriaSugerida(sug);
                    }}
                  />
                </div>

                {/* 3. Descrição — com CTA IA (V3) — gera ou melhora */}
                <div className="prod-field">
                  <label className="prod-field-label-novo" htmlFor="prod-desc-input">Descrição</label>
                  {/* (13/10) o botão da IA fica dentro da caixa, no canto de baixo */}
                  <div className="prod-desc-caixa">
                    <textarea
                      id="prod-desc-input"
                      placeholder={"Ex.: Massa de baunilha, recheio de ninho com morango e cobertura de chantilly. Serve 15 fatias."}
                      value={form.descricao}
                      onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      rows={5}
                      disabled={!!gerandoDesc}
                      aria-busy={!!gerandoDesc}
                      style={{fontFamily: 'inherit', resize: 'none'}}
                    />
                      <button
                        type="button"
                        className="prod-btn-ia-novo prod-btn-ia-dentro"
                        disabled={!!gerandoDesc}
                        onClick={async () => {
                          if (gerandoDesc) return;
                          // (13/10) liberado no grátis também (limite por dia no servidor)
                          if (!form.nome.trim()) { avisar("Dê um nome ao produto primeiro.", { tipo: "info" }); document.getElementById("prod-nome-input")?.focus(); return; }
                          const textoAtual = (form.descricao || "").trim();
                          const ehMelhorar = textoAtual.length > 0;
                          // 11/10: o "gerando" fica num estado próprio e o campo continua com o texto dele.
                          // Antes o campo virava "Melhorando..." e, salvando nessa hora, essa era a descrição gravada.
                          // A resposta só entra se o cadastro ainda for o mesmo (não fechou nem abriu outro produto).
                          const vez = abertura.current;
                          setGerandoDesc(ehMelhorar ? "melhorar" : "gerar");
                          try {
                            const prompt = ehMelhorar
                              ? `Melhore esta descrição de produto de confeitaria, mantendo a intenção e informações originais. Torne mais atraente, clara e profissional. Máximo 2 frases curtas (até 150 caracteres). Português brasileiro. Retorne APENAS a descrição melhorada, sem aspas, sem emojis, sem introdução.\n\nProduto: "${form.nome}"\nDescrição atual: "${textoAtual}"`
                              : `Crie uma descrição MUITO curta e atraente para um produto de confeitaria chamado "${form.nome}". MÁXIMO 2 frases curtas (até 100 caracteres no total). Português brasileiro, transmita qualidade e sabor. Retorne APENAS a descrição, sem aspas, sem emojis.`;
                            const res = await apiFetch("/api/gerar-descricao", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ prompt }),
                              signal: AbortSignal.timeout(30000), // (11/10) a IA pendurada travava o Salvar
                            });
                            const data = await res.json();
                            if (abertura.current !== vez) return;
                            if (data?.error === "limite_diario") { avisar(data.message || "Você chegou ao limite de hoje. Amanhã libera de novo.", { tipo: "info" }); return; }
                            const desc = data.content?.[0]?.text?.trim() || "";
                            if (desc) setForm(f => ({ ...f, descricao: desc }));
                            else avisar("Não deu para gerar a descrição. Tente de novo.", { tipo: "erro" });
                          } catch (e) {
                            if (abertura.current === vez) avisar(explicarErro(e, "Não deu para gerar a descrição. Tente de novo."), { tipo: "erro" });
                          } finally {
                            if (abertura.current === vez) setGerandoDesc(null);
                          }
                        }}
                        title={!form.nome.trim() ? "Preencha o nome primeiro" : (form.descricao?.trim() ? "Melhorar descrição atual" : "Gerar descrição automaticamente")}
                      >
                        <SparkleIA size={16} weight="fill" className="prod-btn-ia-novo-crown" aria-hidden="true" />
                        {gerandoDesc === "gerar"
                          ? "Gerando…"
                          : gerandoDesc === "melhorar"
                          ? "Melhorando…"
                          : (form.descricao?.trim() ? "Melhorar com IA" : "Gerar com IA")}
                      </button>
                  </div>
                </div>
                {/* 2. Categoria */}
                <div className="prod-field" id="prod-categoria-campo">
                  <label className="prod-field-label-novo">Categoria <ReqTag /></label>
                  {!showCatInput ? (
                    <SelectDoonly
                      value={form.categoria}
                      onChange={v => { setCatAuto(null); setForm(f => ({ ...f, categoria: v })); }}
                      options={todasCategorias.map(cat => ({ value: cat, label: cat }))}
                      placeholder={todasCategorias.length > 0 ? "Escolha uma categoria…" : "Nenhuma categoria cadastrada"}
                      title="Escolha a categoria"
                      extraOptionLabel={todasCategorias.length > 0 ? "Criar nova categoria" : "Criar primeira categoria"}
                      onExtraOption={() => setShowCatInput(true)}
                    />
                  ) : (
                    <div className="prod-cat-nova-form">
                      <p className="prod-cat-nova-hint">Criar nova categoria</p>
                      <input
                        type="text"
                        placeholder="Ex.: bolos, doces, salgados"
                        value={novaCategoria}
                        onChange={e => setNovaCategoria(e.target.value)}
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
                          {savingCat ? "Criando…" : "Criar categoria"}
                        </button>
                      </div>
                    </div>
                  )}
                  {/* (14/10) categoria escolhida sozinha pelo nome ("Pudim" → Sobremesas); um aviso pequeno diz que foi automático */}
                  {!form.id && !showCatInput && catAuto && form.categoria === catAuto && (
                    <p className="prod-cat-auto">Escolhida pelo nome do produto</p>
                  )}
                </div>
                {/* (14/10) SKU: código pra organizar os produtos (opcional), com "Gerar" · (27/10) só na edição: no cadastro novo era um termo técnico logo no 1º passo */}
                {form.id && <div className="prod-field">
                  <label className="prod-field-label-novo" htmlFor="prod-sku-input">SKU <OptTag /></label>
                  <div className="prod-sku">
                    <input id="prod-sku-input" placeholder="Ex.: BOL-0427" value={(form as any).sku || ""} maxLength={24} autoCapitalize="characters"
                      onChange={e => setForm(f => ({ ...(f as any), sku: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") }))} />
                    <button type="button" onClick={() => {
                      const pre = (String(form.categoria || form.nome || "PRD").normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3) || "PRD").toUpperCase().padEnd(3, "X");
                      setForm(f => ({ ...(f as any), sku: skuLivre(pre, skusDe(produtos)) }));
                    }}>Gerar</button>
                  </div>
                </div>}
              </div>
            </div>
            )}

            {/* ══════ WIZARD STEP 3 (UNIFICADO — PERSONALIZAÇÃO V3) ══════ */}
            {/* (13/10) Escolhas: a mesma tela pra todos os tipos, no cadastro e na edição */}
            {((wizardStep === 3 && !form.id) || (form.id && editTab === "opcoes")) && (
              <div className="prod-modal-body">
                <EscolhasProduto form={form} setForm={setForm as any} tipo={form.id ? null : tipoCadastro} onKitChange={onKitChange} outros={produtos.filter(p => p.id !== form.id)} tela={escTela} setTela={setEscTela} edicao={!!form.id} />
              </div>
            )}

            {/* ══════ WIZARD STEP 3 (SIMPLES) — VISUAL E PREÇO ══════ */}
            {/* Ou STEP 4 quando variações (visual + preço só de fotos) */}
            {((wizardStep >= 4 && !form.id) || (form.id && (editTab === "fotos" || editTab === "preco" || editTab === "entrega"))) && (
            <div className={`prod-modal-body${!form.id && wizardStep === 5 ? " prod-body--2col" : ""}`}>


              {/* Fotos — só em step 5 (Fotos e finalização) ou tab Fotos na edição */}
              {((wizardStep === 4 && !form.id) || (form.id && editTab === "fotos")) && (
              <>
              {/* (14/10) Foto principal grande no formato do cardápio; 2, 3 e 4 (PRO, 21/10) menores embaixo; dicas no fim */}
              {(() => {
                const imgs = (form.imagem_url || "").split(",").map(s => s.trim()).filter(Boolean);
                const principal = imgs[0];
                const escolher = (slot: number) => {
                  if (slot > 0 && !isPro) { avisar("Mais fotos por produto é do plano PRO.", { tipo: "info" }); return; }
                  if (!uploading) (slot === 0 ? imgRef : slot === 1 ? img2Ref : slot === 2 ? img3Ref : img4Ref).current?.click();
                };
                return (
                  <div className="prod-section prod-fotos">
                    <div className={`prod-foto-pri${principal ? " tem" : ""}`}>
                      {principal ? (
                        <img src={principal} alt="Foto principal" />
                      ) : (
                        <button type="button" className="prod-foto-pri-vazia" onClick={() => escolher(0)} disabled={uploading}>
                          {uploading ? <span className="prod-spinner" /> : <>
                            <span className="prod-foto-pri-ic" aria-hidden="true"><Camera size={28} weight="bold" /></span>
                            <b>Tirar foto ou escolher da galeria</b>
                            <small>É a que aparece no cardápio</small>
                          </>}
                        </button>
                      )}
                    </div>
                    {principal && (
                      <div className="prod-foto-acoes">
                        <button type="button" onClick={() => escolher(0)} disabled={uploading}><ArrowsClockwise size={16} weight="bold" aria-hidden="true" />{uploading ? "Carregando…" : "Trocar"}</button>
                        <button type="button" onClick={() => removeImage(0)}><Trash size={16} weight="bold" aria-hidden="true" />Remover foto</button>
                      </div>
                    )}
                    <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e, 0)} />

                    <div className="prod-foto-extras">
                      {[1, 2, 3].map(slot => {
                        const url = imgs[slot];
                        const trava = !isPro;
                        return (
                          <div key={slot} className={`prod-foto-ex${trava ? " trava" : ""}${url ? " tem" : ""}`}>
                            <button type="button" onClick={() => escolher(slot)} aria-label={trava ? `Foto ${slot + 1}: no PRO` : `Foto ${slot + 1}`}>
                              {url ? <img src={url} alt={`Foto ${slot + 1}`} />
                                : trava ? <><Crown size={18} weight="fill" aria-hidden="true" /><b>Foto {slot + 1}</b><small>No PRO</small></>
                                : <><PlusIc size={20} weight="bold" aria-hidden="true" /><b>Foto {slot + 1}</b></>}
                            </button>
                            {url && !trava && <button type="button" className="prod-img-remove" aria-label="Tirar a foto" onClick={() => removeImage(slot)}><XIc size={16} weight="bold" aria-hidden="true" /></button>}
                            <input ref={slot === 1 ? img2Ref : slot === 2 ? img3Ref : img4Ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e, slot)} />
                          </div>
                        );
                      })}
                    </div>

                    <p className="prod-section-label prod-dicas-t">Dicas para a foto que vende</p>
                    <ul className="prod-dicas">
                      <li><Sun size={18} weight="bold" aria-hidden="true" />Luz de janela, sem flash</li>
                      <li><FrameCorners size={18} weight="bold" aria-hidden="true" />Fundo limpo, sem bagunça</li>
                      <li><Camera size={18} weight="bold" aria-hidden="true" />Foto de cima ou de lado</li>
                      <li><Cake size={18} weight="bold" aria-hidden="true" />Mostre o recheio: fatia cortada</li>
                      <li><Crop size={18} weight="bold" aria-hidden="true" />Em pé ou quadrada, no centro</li>
                      <li><TextTSlash size={18} weight="bold" aria-hidden="true" />Sem texto ou filtro por cima</li>
                    </ul>
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
                      Fotos das variações <span style={{fontSize: 12, fontWeight: 500, color: "#6B5D64", marginLeft: 6}}>(opcional)</span>
                    </p>
                    <p style={{fontSize: 12, color: "#6B5D64", margin: "0 0 12px"}}>
                      Adicione uma foto para cada variação (mostrada no cardápio quando o cliente escolher).
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
                                  <button type="button" className="prod-var-foto-remove" onClick={() => removeFotoVariacaoKey(key)} aria-label="Remover"><XIc size={14} weight="bold" aria-hidden="true" /></button>
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

              {/* Título e subtítulo (mesmo estilo do step 3) */}

              {/* (14/10) de onde vem o preço quando tem Tamanho e cada sabor tem o seu preço (antes: caixa amarela de "conflito" depois das tabelas) */}
              {((wizardStep === 5 && !entTela && !form.id) || (form.id && editTab === "preco")) && comboTamSabor(form) && (() => {
                const atual = regraCombo(form);
                const OPC: [RegraConflitoTamanho, string, string][] = [
                  ["preco_sabor", "Só o sabor", "O tamanho não muda o preço"],
                  ["preco_tamanho", "Só o tamanho", "O sabor não muda o preço"],
                  ["tamanho_base_sabor_adicional", "Tamanho + sabor", "Os dois preços somados"],
                ];
                return (
                  <div className="prod-section">
                    <p className="prod-section-label prod-section-label--novo">De onde vem o preço?</p>
                    <div className="prod-opcs" role="radiogroup" aria-label="De onde vem o preço">
                      {OPC.map(([k, t, sub]) => (
                        <button key={k} type="button" role="radio" aria-checked={atual === k} className={`prod-opc${atual === k ? " on" : ""}`}
                          onClick={() => setForm(f => ({ ...f, grupo_sabores: { ...(f.grupo_sabores as GrupoSabores), regra_conflito_tamanho: k } }))}>
                          <i aria-hidden="true">{atual === k && <CheckIc size={14} weight="bold" />}</i>
                          <span><b>{t}</b><small>{sub}</small></span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Preços por Tamanho — só se tem tamanhos ativos */}
              {((wizardStep === 5 && !entTela && !form.id) || (form.id && editTab === "preco")) && !(comboTamSabor(form) && regraCombo(form) !== "preco_tamanho" && regraCombo(form) !== "tamanho_base_sabor_adicional") && form.grupo_tamanhos?.ativo && (form.grupo_tamanhos.opcoes.length || 0) > 0 && form.grupo_tamanhos.modo_preco_tamanho !== "sob_consulta" && form.grupo_tamanhos.modo_preco_tamanho !== "por_peso" && (
                <div className="prod-section">
                  <p className="prod-section-label prod-section-label--novo">
                    {/* 10/10: antes cortava a última letra do nome do grupo ("tamanhos e peso", "tamanhos do comb") */}
                    Preço por {form.grupo_tamanhos.nome_exibicao === "Quantidades" ? "quantidade" : "tamanho"}
                  </p>
                  {/* (14/10) tabelinha: Tamanho | Preço (editável) | À venda (só na edição: desmarcado = esgotado) */}
                  <div className={`prod-dtab prod-ptab${form.id ? " prod-ptab--3" : ""}`} role="table" aria-label="Preço por tamanho">
                    <div className="prod-dtab-l prod-dtab-h" role="row"><span role="columnheader">{form.grupo_tamanhos?.nome_exibicao === "Quantidades" ? "Quantidade" : "Tamanho"}</span><span role="columnheader">Preço</span>{form.id && <span role="columnheader">À venda</span>}</div>
                    {form.grupo_tamanhos.opcoes.map((op: any) => {
                      const esg = !!op.esgotado;
                      return (
                        <div className={`prod-dtab-l${esg ? " esg" : ""}`} role="row" key={op.id}>
                          <span role="cell">{op.nome}{esg && <small> · esgotado</small>}</span>
                          <span role="cell">
                            <label className="prod-ptab-in"><span>R$</span>
                              <input type="text" inputMode="numeric" value={formatPreco(op.preco)} aria-label={`Preço de ${op.nome}`} placeholder="0,00"
                                onChange={e => { const preco = parsePreco(e.target.value); setForm(f => ({ ...f, grupo_tamanhos: { ...(f.grupo_tamanhos || GRUPO_TAMANHOS_VAZIO), opcoes: (f.grupo_tamanhos?.opcoes || []).map(o => o.id === op.id ? { ...o, preco } : o) } })); }} />
                            </label>
                          </span>
                          {form.id && <span role="cell">
                            <button type="button" className={`prod-ptab-ck${esg ? "" : " on"}`} role="checkbox" aria-checked={!esg} aria-label={`${op.nome} à venda`}
                              onClick={() => setForm(f => ({ ...f, grupo_tamanhos: { ...(f.grupo_tamanhos || GRUPO_TAMANHOS_VAZIO), opcoes: (f.grupo_tamanhos?.opcoes || []).map((o: any) => o.id === op.id ? { ...o, esgotado: esg ? undefined : true } : o) } }))}>
                              {!esg && <CheckIc size={14} weight="bold" />}
                            </button>
                          </span>}
                        </div>
                      );
                    })}
                  </div>
                {/* (14/10) promoção em % pros tamanhos de preço fixo (antes não tinha onde pôr) */}
                {!kitAtivo((form as any).kit_qtd) && (() => {
                  const pct = Number(form.desconto_percentual) || 0;
                  const on = !!form.promocao && form.tipo_promocao === "percentual";
                  return (<>
                    <p className="prod-section-label prod-section-label--novo prod-lbl-sep">Promoção</p>
                    {!form.id && <p className="prod-kg-promo-t">{primeiroNome ? `${primeiroNome}, gostaria` : "Gostaria"} de colocar uma promoção?</p>}
                    <button type="button" className={`prod-opc${on ? " on" : ""}`} role="checkbox" aria-checked={on}
                      onClick={() => setForm(f => ({ ...f, promocao: !on, tipo_promocao: "percentual", desconto_percentual: !on ? (Number(f.desconto_percentual) || 10) : 0, preco_promocional: 0 }))}>
                      <i aria-hidden="true">{on && <CheckIc size={14} weight="bold" />}</i>
                      <span><b>Colocar em promoção</b><small>O preço antigo aparece riscado</small></span><em className="prod-selo-rec">Recomendado</em>
                    </button>
                    {on && (<>
                      <div className="kitp-pct">
                        <span>Desconto de</span>
                        <input inputMode="numeric" value={pct || ""} placeholder="10" aria-label="Desconto em porcentagem"
                          onChange={e => { const n = Math.min(90, Math.max(0, parseInt(e.target.value.replace(/\D/g, "")) || 0)); setForm(f => ({ ...f, desconto_percentual: n })); }} />
                        <span>% em todos</span>
                      </div>
                      {/* (14/10) tabela com linhas em volta, tipo planilha */}
                      {pct > 0 && (
                        <div className="prod-dtab" role="table" aria-label="Preços com desconto">
                          <div className="prod-dtab-l prod-dtab-h" role="row"><span role="columnheader">{form.grupo_tamanhos?.nome_exibicao === "Quantidades" ? "Quantidade" : "Tamanho"}</span><span role="columnheader">Preço</span><span role="columnheader">Com {pct}%</span></div>
                          {form.grupo_tamanhos!.opcoes.map(op => (
                            <div className="prod-dtab-l" role="row" key={op.id}>
                              <span role="cell">{op.nome}</span>
                              <span role="cell">R$ {formatPreco(op.preco || 0)}</span>
                              <b role="cell">R$ {formatPreco(Math.round((op.preco || 0) * (100 - pct)) / 100)}</b>
                            </div>
                          ))}
                        </div>
                      )}
                    </>)}
                  </>);
                })()}
                </div>
              )}

              {/* Preços por Sabor — só se tem sabores ativos E sabor_tem_preco_proprio */}
              {((wizardStep === 5 && !entTela && !form.id) || (form.id && editTab === "preco")) && !(comboTamSabor(form) && regraCombo(form) !== "preco_sabor" && regraCombo(form) !== "tamanho_base_sabor_adicional") && form.grupo_sabores?.ativo && (form.grupo_sabores.opcoes.length || 0) > 0 && form.grupo_sabores.sabor_tem_preco_proprio && (
                <div className="prod-section">
                  <p className="prod-section-label prod-section-label--novo">Preço por sabor</p>
                  {precosDosSabores(form) && (
                    <div className="esc-aviso"><span className="esc-aviso-ic" aria-hidden="true">i</span>
                      <p><b>Aqui o preço é pelo sabor</b>Coloque todos os sabores que você vende e o preço de cada um. O cardápio mostra a partir do mais barato.</p></div>
                  )}
                  {/* (14/10) tabelinha igual à dos tamanhos; com promoção em %, ganha a coluna "Com X%" */}
                  {(() => {
                    const pctS = Number(form.desconto_percentual) || 0;
                    const promoS = !!precosDosSabores(form) && !!form.promocao && form.tipo_promocao === "percentual" && pctS > 0;
                    return (
                  <div className={`prod-dtab prod-ptab${promoS ? " prod-ptab--promo" : ""}`} role="table" aria-label="Preço por sabor">
                    <div className="prod-dtab-l prod-dtab-h" role="row"><span role="columnheader">Sabor</span><span role="columnheader">Preço</span>{promoS && <span role="columnheader">Com {pctS}%</span>}</div>
                    {form.grupo_sabores.opcoes.map((op: any) => (
                      <div className="prod-dtab-l" role="row" key={op.id}>
                        <span role="cell">{op.nome}</span>
                        <span role="cell"><label className="prod-ptab-in"><span>R$</span>
                          <input type="text" inputMode="numeric" placeholder="0,00" aria-label={`Preço de ${op.nome}`} value={op.preco ? formatPreco(op.preco) : ""}
                            onChange={e => { const preco = parsePreco(e.target.value); setForm(f => ({ ...f, grupo_sabores: { ...(f.grupo_sabores as GrupoSabores), opcoes: (f.grupo_sabores?.opcoes || []).map((o: any) => o.id === op.id ? { ...o, preco } : o) } })); }} />
                        </label></span>
                        {promoS && <b role="cell">{op.preco > 0 ? `R$ ${formatPreco(Math.round(op.preco * (100 - pctS)) / 100)}` : "—"}</b>}
                      </div>
                    ))}
                  </div>
                    );
                  })()}
                  {/* (14/10) promoção no preço pelo sabor: % em todos os sabores (o cardápio, a sacola e o pedido já fazem essa conta) */}
                  {precosDosSabores(form) && (() => {
                    const pct = Number(form.desconto_percentual) || 0;
                    const on = !!form.promocao && form.tipo_promocao === "percentual";
                    return (<>
                      <p className="prod-section-label prod-section-label--novo prod-lbl-sep">Promoção</p>
                      {!form.id && <p className="prod-kg-promo-t">{primeiroNome ? `${primeiroNome}, gostaria` : "Gostaria"} de colocar uma promoção?</p>}
                      <button type="button" className={`prod-opc${on ? " on" : ""}`} role="checkbox" aria-checked={on}
                        onClick={() => setForm(f => ({ ...f, promocao: !on, tipo_promocao: "percentual", desconto_percentual: !on ? (Number(f.desconto_percentual) || 10) : 0, preco_promocional: 0 }))}>
                        <i aria-hidden="true">{on && <CheckIc size={14} weight="bold" />}</i>
                        <span><b>Colocar em promoção</b><small>O preço antigo aparece riscado</small></span><em className="prod-selo-rec">Recomendado</em>
                      </button>
                      {on && (
                        <div className="kitp-pct">
                          <span>Desconto de</span>
                          <input inputMode="numeric" value={pct || ""} placeholder="10" aria-label="Desconto em porcentagem"
                            onChange={e => { const n = Math.min(90, Math.max(0, parseInt(e.target.value.replace(/\D/g, "")) || 0)); setForm(f => ({ ...f, desconto_percentual: n })); }} />
                          <span>% em todos</span>
                        </div>
                      )}
                    </>);
                  })()}
                </div>
              )}

              {/* ══════ SEÇÃO 1: Preço base + Forma de venda ══════ */}
              {/* Aparece quando: (a) não tem tamanho, OU (b) modo é por_peso (precisa do R$/kg) */}
              {/* Kit (02/10): sem "preço base" — o preço vem dos kits montados. Fica só a promoção. */}
              {((wizardStep === 5 && !entTela && !form.id) || (form.id && editTab === "preco")) && kitAtivo((form as any).kit_qtd) && (() => {
                const kq: any = (form as any).kit_qtd;
                const pct = Number(form.desconto_percentual) || 0;
                const promoOn = !!form.promocao && form.tipo_promocao === "percentual";
                return (
                  <div className="prod-section">
                    {/* (14/10) o preço dos kits agora é aqui (antes ficava em Escolhas › Quantidade) */}
                    <p className="prod-section-label prod-section-label--novo">{kq?.modo === "livre" ? "Preço do cento" : "Preço dos kits"}</p>
                    {kq?.modo === "livre" ? (
                      <>
                        <div className="prod-field"><div className="prod-preco-input prod-preco-input--big">
                          <span>R$</span>
                          <input type="text" inputMode="numeric" placeholder="0,00" aria-label="Preço do cento" value={kq.livre?.preco_cento ? formatPreco(kq.livre.preco_cento) : ""}
                            onChange={e => { const v = parsePreco(e.target.value); onKitChange({ ...kq, livre: { ...kq.livre, preco_cento: v } }); }} />
                        </div></div>
                        <p className="kitp-dica">O cliente pede de {kq.livre?.min || 0} a {kq.livre?.max || 0} unidades. O preço sai pelo cento.</p>
                      </>
                    ) : (
                      <div className="prod-dtab prod-ptab" role="table" aria-label="Preço dos kits">
                        <div className="prod-dtab-l prod-dtab-h" role="row"><span role="columnheader">Kit</span><span role="columnheader">Preço</span></div>
                        {(kq?.kits || []).filter((x: any) => (x.qtd || 0) > 0).sort((x: any, y: any) => x.qtd - y.qtd).map((x: any) => (
                          <div className="prod-dtab-l" role="row" key={x.id}>
                            <span role="cell">Kit de {x.qtd} un.</span>
                            <span role="cell"><label className="prod-ptab-in"><span>R$</span>
                              <input type="text" inputMode="numeric" placeholder="0,00" aria-label={`Preço do kit de ${x.qtd}`} value={x.preco ? formatPreco(x.preco) : ""}
                                onChange={e => { const v = parsePreco(e.target.value); onKitChange({ ...kq, kits: kq.kits.map((y: any) => y.id === x.id ? { ...y, preco: v } : y) }); }} />
                            </label></span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="prod-section-label prod-section-label--novo prod-lbl-sep">Promoção</p>
                      {!form.id && <p className="prod-kg-promo-t">{primeiroNome ? `${primeiroNome}, gostaria` : "Gostaria"} de colocar uma promoção?</p>}
<div className="prod-opcs">
                      <button type="button" className={`prod-opc${promoOn ? " on" : ""}`} role="checkbox" aria-checked={promoOn}
                        onClick={() => setForm(f => ({ ...f, promocao: !promoOn, tipo_promocao: "percentual", desconto_percentual: !promoOn ? (f.desconto_percentual || 10) : 0, preco_promocional: 0 }))}>
                        <i aria-hidden="true">{promoOn && <CheckIc size={14} weight="bold" />}</i>
                        <span><b>Colocar em promoção</b><small>O preço antigo aparece riscado</small></span><em className="prod-selo-rec">Recomendado</em>
                      </button>
                      </div>
                      {promoOn && (
                        <div className="kitp-pct">
                          <span>Desconto de</span>
                          <input inputMode="numeric" value={pct || ""} placeholder="10" aria-label="Desconto em porcentagem"
                            onChange={e => { const n = Math.min(90, Math.max(0, parseInt(e.target.value.replace(/\D/g, "")) || 0)); setForm(f => ({ ...f, desconto_percentual: n })); }} />
                          <span>% em todos os kits</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {((wizardStep === 5 && !entTela && !form.id) || (form.id && editTab === "preco")) && !kitAtivo((form as any).kit_qtd) && (
                !(form.grupo_tamanhos?.ativo && (form.grupo_tamanhos.opcoes.length || 0) > 0) ||
                form.grupo_tamanhos?.modo_preco_tamanho === "por_peso"
              ) && (
                <div className="prod-section">
                  {/* o título "Qual o preço?" já diz; só o por quilo precisa do rótulo */}
                  {/* (14/10) produto sem tamanho: título como nos outros passos (antes começava direto no "Preço cheio") */}
                  {!form.id && !(form.grupo_tamanhos?.ativo && (form.grupo_tamanhos.opcoes?.length || 0) > 0) && !precosDosSabores(form) && <p className="prod-section-label prod-section-label--novo">Qual é o preço?</p>}
                  {form.id && form.grupo_tamanhos?.modo_preco_tamanho === "por_peso" && <p className="prod-section-label prod-section-label--novo">Preço por kg</p>}
                  {/* (14/10) no cadastro novo o preço do kg vem aqui no fim (igual ao preço fixo): preço, tabela dos pesos e promoção */}
                  {!form.id && form.grupo_tamanhos?.ativo && form.grupo_tamanhos?.modo_preco_tamanho === "por_peso" && (() => {
                    const kgCheio = Number(form.preco_normal) || 0;
                    const kgPromoV = Number(form.preco_promocional) || 0;
                    const promoOnKg = kgPromo || kgPromoV > 0;
                    const comPromo = promoOnKg && kgPromoV > 0 && kgPromoV < kgCheio;
                    const pesosT = (form.grupo_tamanhos!.opcoes || []).filter((o: any) => Number(o.peso_kg) > 0);
                    const r = (v: number) => Math.round(v * 100) / 100;
                    return (<>
                      <p className="prod-section-label prod-section-label--novo">Qual é o preço base do kg?</p>
                      <p className="prod-kg-sub">Os pesos são calculados a partir dele.</p>
                      <div className="prod-field"><div className="prod-preco-input prod-preco-input--big">
                        <span>R$</span>
                        <input type="text" inputMode="numeric" placeholder="0,00" aria-label="Preço cheio" value={kgCheio ? formatPreco(kgCheio) : ""}
                          onChange={e => { const n = parsePreco(e.target.value); setForm(f => { const pp = Number(f.preco_promocional) || 0; return pp > 0 ? { ...f, preco_normal: n, promocao: pp < n } : { ...f, preco_normal: n }; }); }} />
                      </div></div>
                      {pesosT.length > 0 && (
                        <div className="prod-dtab" role="table" aria-label="Preço de cada peso">
                          <div className={`prod-dtab-l prod-dtab-h${comPromo ? "" : " prod-dtab-l--2"}`} role="row"><span role="columnheader">Peso</span><span role="columnheader">Preço</span>{comPromo && <span role="columnheader">Promoção</span>}</div>
                          {pesosT.map((o: any) => (
                            <div className={`prod-dtab-l${comPromo ? "" : " prod-dtab-l--2"}`} role="row" key={o.id}>
                              <span role="cell">{o.nome}</span>
                              <span role="cell">R$ {formatPreco(r(Number(o.peso_kg) * kgCheio))}</span>
                              {comPromo && <b role="cell">R$ {formatPreco(r(Number(o.peso_kg) * kgPromoV))}</b>}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="prod-section-label prod-section-label--novo prod-lbl-sep">Promoção</p>
                      <p className="prod-kg-promo-t">{primeiroNome ? `${primeiroNome}, gostaria` : "Gostaria"} de colocar uma promoção?</p>
                      <button type="button" className={`prod-opc${promoOnKg ? " on" : ""}`} role="checkbox" aria-checked={promoOnKg}
                        onClick={() => { setKgPromo(!promoOnKg); if (promoOnKg) setForm(f => ({ ...f, preco_promocional: 0, promocao: false })); }}>
                        <i aria-hidden="true">{promoOnKg && <CheckIc size={14} weight="bold" />}</i>
                        <span><b>Colocar em promoção</b><small>O preço antigo aparece riscado</small></span><em className="prod-selo-rec">Recomendado</em>
                      </button>
                    </>);
                  })()}
                  {/* (14/10) preço cheio e promocional lado a lado; "Vendido por" embaixo, numa linha só dele */}
                  {/* (14/10) preço pelo sabor: sem preço cheio; o preço de cada sabor vem na tabela abaixo */}
                  {precosDosSabores(form) ? null : <div className={`prod-row-2${simplesNovo ? " prod-row-1" : ""}`}>
                    {!(!form.id && form.grupo_tamanhos?.ativo && form.grupo_tamanhos?.modo_preco_tamanho === "por_peso") && <div className="prod-field">
                      <label>Preço cheio</label>
                      <div className="prod-preco-input prod-preco-input--big">
                        <span>R$</span>
                        <input type="text" inputMode="numeric" placeholder="0,00" aria-label="Preço cheio" value={form.preco_normal ? formatPreco(form.preco_normal) : ""} onChange={e => {
                          const n = parsePreco(e.target.value);
                          // 10/10: a promoção em valor acompanha o preço cheio (antes só era conferida ao digitar o promocional)
                          setForm(f => {
                            const pp = Number(f.preco_promocional) || 0;
                            if (f.tipo_promocao === "percentual" || !(pp > 0)) return { ...f, preco_normal: n };
                            return { ...f, preco_normal: n, promocao: pp < n };
                          });
                        }} />
                      </div>
                    </div>}
                    {!simplesNovo && (form.id || !(form.grupo_tamanhos?.ativo && form.grupo_tamanhos?.modo_preco_tamanho === "por_peso") || kgPromo || Number(form.preco_promocional) > 0) && <div className="prod-field">
                      <label>{!form.id && form.grupo_tamanhos?.ativo && form.grupo_tamanhos?.modo_preco_tamanho === "por_peso" ? "Preço promocional do kg" : "Preço promocional"}</label>
                      <div className={`prod-preco-input prod-preco-input--big prod-preco-input--promo${Number(form.preco_promocional) > 0 ? " prod-promo-tem" : ""}`}>
                        <span>R$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          aria-label="Preço promocional"
                          value={form.preco_promocional && form.preco_promocional > 0 ? formatPreco(form.preco_promocional) : ""}
                          onChange={e => {
                            const v = parsePreco(e.target.value);
                            setForm(f => ({ ...f, preco_promocional: v, promocao: v > 0 && v < f.preco_normal, tipo_promocao: 'fixo' }));
                          }}
                        />
                      </div>
                      {/* (24/10) o desconto embaixo do campo, em texto (a % no canto do campo ficava estranha) */}
                      {(() => {
                        const cheio = Number(form.preco_normal) || 0, pp = Number(form.preco_promocional) || 0;
                        const pct = cheio > 0 && pp > 0 && pp < cheio ? Math.round((1 - pp / cheio) * 100) : 0;
                        return pct > 0 ? <small className="prod-promo-info">{pct}% de desconto</small> : pp > 0 && pp >= cheio && cheio > 0 ? <small className="prod-promo-info prod-promo-info--erro">Precisa ser menor que o cheio</small> : null;
                      })()}
                    </div>}
                  </div>}
                  {!(form.grupo_tamanhos?.ativo && form.grupo_tamanhos?.modo_preco_tamanho === "por_peso") && (
                    <div className="prod-field" style={{ marginTop: 14 }}>
                      <label>Vendido por</label>
                      <select className="prod-vendido-s" value={form.forma_venda} aria-label="Vendido por"
                          onChange={e => setForm(f => ({ ...f, forma_venda: e.target.value }))}>
                          {[["unidade", "Por unidade"], ["kg", "Por quilo (kg)"], ["fatia", "Por fatia"], ["cento", "Por cento"], ["caixa", "Por caixa"]]
                            .concat(["unidade", "kg", "fatia", "cento", "caixa"].includes(form.forma_venda) ? [] : [[form.forma_venda, FORMAS_VENDA.find(x => x.value === form.forma_venda)?.label || form.forma_venda]])
                            .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>
                  )}
                  {/* (24/10) produto simples: a promoção no mesmo jeito do kg, dos tamanhos e do kit (pergunta + caixinha + preço) */}
                  {simplesNovo && (() => {
                    const pp = Number(form.preco_promocional) || 0, cheio = Number(form.preco_normal) || 0;
                    const ligada = kgPromo || pp > 0;
                    const pct = cheio > 0 && pp > 0 && pp < cheio ? Math.round((1 - pp / cheio) * 100) : 0;
                    return (<>
                      <p className="prod-section-label prod-section-label--novo prod-lbl-sep">Promoção</p>
                      <p className="prod-kg-promo-t">{primeiroNome ? `${primeiroNome}, gostaria` : "Gostaria"} de colocar uma promoção?</p>
                      <button type="button" className={`prod-opc${ligada ? " on" : ""}`} role="checkbox" aria-checked={ligada}
                        onClick={() => { setKgPromo(!ligada); if (ligada) setForm(f => ({ ...f, preco_promocional: 0, promocao: false })); }}>
                        <i aria-hidden="true">{ligada && <CheckIc size={14} weight="bold" />}</i>
                        <span><b>Colocar em promoção</b><small>O preço antigo aparece riscado</small></span><em className="prod-selo-rec">Recomendado</em>
                      </button>
                      {ligada && (
                        <div className="prod-field" style={{ marginTop: 12 }}>
                          <label>Preço promocional</label>
                          <div className={`prod-preco-input prod-preco-input--big prod-preco-input--promo${pp > 0 ? " prod-promo-tem" : ""}`}>
                            <span>R$</span>
                            <input type="text" inputMode="numeric" placeholder="0,00" aria-label="Preço promocional" value={pp > 0 ? formatPreco(pp) : ""}
                              onChange={e => { const v = parsePreco(e.target.value); setForm(f => ({ ...f, preco_promocional: v, promocao: v > 0 && v < f.preco_normal, tipo_promocao: 'fixo' })); }} />
                          </div>
                          {pct > 0 ? <small className="prod-promo-info">{pct}% de desconto</small> : pp > 0 && pp >= cheio && cheio > 0 ? <small className="prod-promo-info prod-promo-info--erro">Precisa ser menor que o cheio</small> : null}
                        </div>
                      )}
                    </>);
                  })()}


                </div>
              )}

              {/* (14/10) esgotar um tamanho só (na edição): no cardápio ele aparece apagado e não dá pra escolher */}
              {form.id && editTab === "preco" && !kitAtivo((form as any).kit_qtd) && form.grupo_tamanhos?.ativo && form.grupo_tamanhos.modo_preco_tamanho === "por_peso" && (form.grupo_tamanhos.opcoes.length || 0) > 0 && (
                <div className="prod-section">
                  <p className="prod-section-label prod-section-label--novo">Tamanhos à venda</p>
                  <div className="prod-opcs">
                    {form.grupo_tamanhos.opcoes.map((op: any) => {
                      const aVenda = !op.esgotado;
                      return (
                        <button key={op.id} type="button" className={`prod-opc${aVenda ? " on" : ""}`} role="checkbox" aria-checked={aVenda}
                          onClick={() => setForm(f => ({ ...f, grupo_tamanhos: { ...(f.grupo_tamanhos || GRUPO_TAMANHOS_VAZIO), opcoes: (f.grupo_tamanhos?.opcoes || []).map((o: any) => o.id === op.id ? { ...o, esgotado: aVenda ? true : undefined } : o) } }))}>
                          <i aria-hidden="true">{aVenda && <CheckIc size={14} weight="bold" />}</i>
                          <span><b>{op.nome}</b><small>{aVenda ? "À venda" : "Esgotado: aparece apagado no cardápio"}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Kit Festa */}
              {form.forma_venda === "kit-festa" && (
                <div className="prod-section">
                  <p className="prod-section-label">Itens do Kit</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0" }}>Adicione cada item que estará incluso no kit festa</p>

                  {(form.kit_itens || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--primary-light)", borderRadius: "10px", marginBottom: "6px", border: "1px solid var(--primary-light)" }}>
                      <div>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{item.nome}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--primary)", marginLeft: "8px", fontWeight: 500 }}>× {item.quantidade}</span>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, kit_itens: (f.kit_itens || []).filter((_, idx) => idx !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: "1.1rem", padding: 0 }}>×</button>
                    </div>
                  ))}

                  <div className="prod-field" style={{ marginTop: "4px" }}>
                    <label>Nome do item</label>
                    <input type="text" placeholder="Ex.: bolo, brigadeiros, cupcakes" value={novoKitItem.nome} onChange={e => setNovoKitItem(k => ({ ...k, nome: e.target.value }))} onKeyDown={e => e.key === "Enter" && (() => { if (!novoKitItem.nome.trim()) return; setForm(f => ({ ...f, kit_itens: [...(f.kit_itens || []), { nome: novoKitItem.nome.trim(), quantidade: novoKitItem.quantidade || "1" }] })); setNovoKitItem({ nome: "", quantidade: "" }); })()} />
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    <div className="prod-field" style={{ flex: 1 }}>
                      <label>Quantidade</label>
                      <input type="text" placeholder="Ex.: 1 unidade, 30 peças" value={novoKitItem.quantidade} onChange={e => setNovoKitItem(k => ({ ...k, quantidade: e.target.value }))} />
                    </div>
                    <button onClick={() => {
                      if (!novoKitItem.nome.trim()) return;
                      setForm(f => ({ ...f, kit_itens: [...(f.kit_itens || []), { nome: novoKitItem.nome.trim(), quantidade: novoKitItem.quantidade || "1" }] }));
                      setNovoKitItem({ nome: "", quantidade: "" });
                    }} style={{ padding: "0.65rem 1rem", background: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "10px", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginBottom: "1px" }}>+ Adicionar</button>
                  </div>

                  <div className="prod-field">
                    <label>Serve quantas pessoas</label>
                    <input type="text" placeholder="Ex.: 20 a 30 pessoas" value={form.kit_serve_pessoas || ""} onChange={e => setForm(f => ({ ...f, kit_serve_pessoas: e.target.value }))} />
                  </div>
                  <div className="prod-field">
                    <label>Prazo mínimo de encomenda</label>
                    <input type="text" placeholder="Ex.: 5 dias de antecedência" value={form.kit_prazo_encomenda || ""} onChange={e => setForm(f => ({ ...f, kit_prazo_encomenda: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* [Removido V3] Bloco "Personalização" legado + Zero Açúcar
                  A etapa 2 (Opções do produto) já cobre toda personalização.
                  Restrições alimentares (sem açúcar/glúten/lactose/vegano)
                  virão na Fase 2 futura como chips. */}

              {/* (14/10) cadastro novo: uma seção só com as opções, cada uma com caixinha e explicação */}
              {((wizardStep === 5 && entTela && !form.id) || (form.id && editTab === "entrega")) && (() => {
                const enc = !!(form as any).antecedencia;
                const op = (on: boolean, t: string, sub: string, fn: () => void) => (
                  <button type="button" className={`prod-opc${on ? " on" : ""}`} role="checkbox" aria-checked={on} onClick={fn}>
                    <i aria-hidden="true">{on && <CheckIc size={14} weight="bold" />}</i>
                    <span><b>{t}</b><small>{sub}</small></span>
                  </button>
                );
                return (
                  <div className="prod-section prod-sec-ent">
                    {/* (30/10 · 5.27) tela própria: como vende (escolha única, igual ao celular) e, embaixo, o que aparece no cardápio */}
                    <p className="prod-section-label prod-section-label--novo">Como você vende</p>
                    {/* (22/10) celular: escolha única Pronta entrega | Sob encomenda (antes eram duas caixinhas e dava pra desmarcar as duas, B6) */}
                    <div className="prod-so-cel">
                      <div className="prod-tipo" role="radiogroup" aria-label="Como você vende este produto">
                        <button type="button" role="radio" aria-checked={form.pronta_entrega === true} className={form.pronta_entrega === true ? "on" : ""}
                          onClick={() => setForm(f => ({ ...(f as any), pronta_entrega: true, antecedencia: null }))}><span className="prod-tipo-ic" aria-hidden="true"><Lightning size={22} weight="fill" /></span><b>Pronta entrega</b><small>Tem feito, sai na hora</small></button>
                        <button type="button" role="radio" aria-checked={form.pronta_entrega !== true} className={form.pronta_entrega !== true ? "on" : ""}
                          onClick={() => setForm(f => ({ ...(f as any), pronta_entrega: false, antecedencia: (f as any).pronta_entrega || !(f as any).antecedencia ? "48h" : (f as any).antecedencia }))}><span className="prod-tipo-ic" aria-hidden="true"><CalendarBlank size={22} weight="fill" /></span><b>Sob encomenda</b><small>O cliente pede antes</small></button>
                      </div>
                      {form.pronta_entrega !== true && <PrazoEncomenda valor={(form as any).antecedencia ?? null} aoMudar={v => setForm(f => ({ ...(f as any), antecedencia: v }))} />}
                    </div>
                    <div className="prod-so-pc">
                      <CaixasEscolha rotulo="Como você vende este produto" valor={(form.pronta_entrega === true ? "pronta" : enc ? "encomenda" : "") as "pronta" | "encomenda"}
                        opcoes={[{ v: "pronta", t: "Pronta entrega", sub: "Tem feito, sai na hora" }, { v: "encomenda", t: "Sob encomenda", sub: "O cliente pede com antecedência" }]}
                        onMudar={v => setForm(f => ({ ...(f as any), pronta_entrega: v === "pronta", antecedencia: v === "pronta" ? null : (f as any).antecedencia || "48h" }))} />
                      {enc && form.pronta_entrega !== true && <PrazoEncomenda valor={(form as any).antecedencia ?? null} aoMudar={v => setForm(f => ({ ...(f as any), antecedencia: v }))} />}
                    </div>
                    <p className="prod-section-label prod-section-label--novo prod-lbl-sep">No cardápio</p>
                    <div className="prod-opcs">
                      {op(form.disponivel !== false, "Mostrar no cardápio", form.disponivel !== false ? "Os clientes veem e podem pedir" : "Fica guardado só para você", () => setForm(f => ({ ...f, disponivel: f.disponivel === false, ...(f.disponivel !== false ? { destaque: false } : {}) } as any)))}
                      {/* (27/10) Destaques: até 6, no topo do cardápio em cartão grande */}
                      {op((form as any).destaque === true, "Destacar no cardápio", `${qtdDestaques(form.id) + ((form as any).destaque === true ? 1 : 0)} de ${MAX_DESTAQUES} · no topo, em cartão grande`, () => {
                        const ligar = (form as any).destaque !== true;
                        if (ligar && form.disponivel === false) { avisar("Mostre o produto no cardápio para poder destacar.", { tipo: "erro" }); return; }
                        if (ligar && qtdDestaques(form.id) >= MAX_DESTAQUES) { avisarLimiteDestaques(false); return; }
                        setForm(f => ({ ...(f as any), destaque: ligar }));
                      })}
                      {/* (19/10) foto de referência só nos produtos que pedem (personalizados, topos de bolo) */}
                      {op((form as any).aceita_referencia === true, "Aceita foto de referência", "O cliente manda a foto do modelo", () => setForm(f => ({ ...(f as any), aceita_referencia: !(f as any).aceita_referencia })))}
                    </div>
                    {/* (24/10) quando usar a foto de referência */}
                    <p className="prod-ref-dica">
                      {(form as any).aceita_referencia === true
                        ? <>No pedido aparece um campo para o cliente <b>anexar uma foto de referência</b>. Ela chega junto com o pedido para você ver.</>
                        : <>Ligue em produtos <b>personalizados</b>, como bolos decorados, topos de bolo e kits temáticos. Em produtos de linha, deixe desligado.</>}
                    </p>
                  </div>
                );
              })()}

              {/* (19/10) computador, passo Preço: a prévia do cardápio ao vivo na coluna da direita (no celular ela fica só na Revisão) */}
              {wizardStep === 5 && !form.id && <div className="prod-prev-col"><PreviaCardapio form={form} /></div>}
              {/* (13/10) Revisão: como o cliente vê, pedido de exemplo e o que falta */}
              {/* (14/10) a prévia e, por último (colado no Publicar), o que falta arrumar */}
              {/* (14/10) passo 6 · Revisão: a prévia no topo, todas as informações e, por último, o que falta arrumar */}
              {wizardStep === 6 && !form.id && <div className="prod-section"><PreviaCardapio form={form} /></div>}
              {/* (15/10) informações + "Antes de publicar" na mesma seção: o aviso fica logo embaixo da tabela */}
              {wizardStep === 6 && !form.id && <div className="prod-section"><ResumoProduto form={form} /><RevisaoProduto form={form} /></div>}
            </div>
            )}


            {/* ══════ RODAPÉ (steps 2, 3, 4) ══════ */}
            {wizardStep >= 2 && (
            <div className={`prod-modal-footer prod-modal-footer--novo${form.id && editTab === "resumo" ? " prod-modal-footer--resumo" : ""}`}>
              {form.id
                ? (editTab !== "resumo" ? <button className="prod-btn-cancelar-novo" onClick={voltarDaSecao}>Voltar</button> : null)
                : wizardStep >= 3
                ? <button className="prod-btn-cancelar-novo" onClick={voltarPassoCadastro}>Voltar</button>
                : <button className="prod-btn-cancelar-novo" onClick={handleTryClose}>Cancelar</button>}
              {(() => {
                // Validações por passo (10/10: além de saber se pode seguir, diz O QUE falta e onde está o campo)
                const falta: FaltaCampo = (() => {
                  // Step 2: Informações — nome + categoria obrigatórios
                  if (wizardStep === 2) {
                    if (!form.nome.trim()) return { msg: "Dê um nome ao produto", alvo: "#prod-nome-input" };
                    if (!(form.categoria || "").trim()) return { msg: "Escolha a categoria do produto", alvo: "#prod-categoria-campo" };
                    return null;
                  }
                  // Step 3: Opções — valida só as personalizações
                  //   Se ativou algum grupo, precisa ter pelo menos 1 opção nele
                  //   Preço base é validado no step 4
                  if (wizardStep === 3) {
                    // (14/10) no checklist não falta nada; em cada tela, só o que é daquela escolha
                    if (escTela === 0) return null;
                    const c = escolhasAtivas(form)[escTela - 1];
                    return c ? faltaDaEscolha(form, c) : null;
                  }
                  // (14/10) Preço é o último passo (5): valida preço base OU preços dos tamanhos
                  // (14/10) passo 5 (Preço) e 6 (Revisão): preço certo e "pronta entrega ou encomenda" marcado
                  if (wizardStep >= 5) {
                    const fPreco = ((): FaltaCampo => {
                    // Kit por quantidade: o preço vem dos kits
                    if (kitAtivo((form as any).kit_qtd)) { const kq: any = (form as any).kit_qtd; const semP = kq.modo === "livre" ? !(kq.livre?.preco_cento > 0) : (kq.kits || []).find((x: any) => (x.qtd || 0) > 0 && !(x.preco > 0)); return !semP ? null : kq.modo === "livre" ? { msg: "Coloque o preço do cento", alvo: 'input[aria-label="Preço do cento"]' } : { msg: `Coloque o preço do kit de ${(semP as any).qtd}`, alvo: `input[aria-label="Preço do kit de ${(semP as any).qtd}"]` }; }
                    const gt = form.grupo_tamanhos;
                    const temTamanhoAtivo = gt?.ativo && gt.opcoes.length > 0;
                    // 11/10: preço promocional maior ou igual ao cheio não é promoção: avisa e não avança
                    // (antes seguia calado e gravava o valor com a promoção desligada)
                    const ppFalta = Number(form.preco_promocional) || 0;
                    const promoMaior: FaltaCampo = form.tipo_promocao !== "percentual" && ppFalta > 0 && ppFalta >= (form.preco_normal || 0)
                      ? { msg: "O preço promocional precisa ser menor que o preço cheio", alvo: 'input[aria-label="Preço promocional"]' } : null;
                    // (14/10) Tamanho + preço por sabor: primeiro escolhe de onde vem o preço
                    if (comboTamSabor(form)) {
                      const r = regraCombo(form);
                      if (!r) return { msg: "Escolha de onde vem o preço", alvo: '[aria-label="De onde vem o preço"]' };
                      if (r === "preco_sabor") {
                        const semS = (form.grupo_sabores?.opcoes || []).find((o: any) => !(Number(o.preco) > 0));
                        return semS ? { msg: `Coloque o preço de ${semS.nome}`, alvo: `input[aria-label="Preço de ${String(semS.nome).replace(/(["\\])/g, "\\$1")}"]` } : null;
                      }
                    }
                    if (temTamanhoAtivo) {
                      // Modo "por peso": preços dos tamanhos são calculados via preco_normal (R$/kg)
                      if (gt!.modo_preco_tamanho === "por_peso") {
                        return (form.preco_normal || 0) > 0 ? promoMaior : { msg: "Coloque o preço do kg", alvo: 'input[aria-label="Preço cheio"]' };
                      }
                      // Modo "preço fixo": todos os tamanhos precisam ter preço próprio
                      const semPreco = gt!.opcoes.find(o => !(o.preco > 0));
                      return semPreco ? { msg: String(semPreco.nome || "").trim() ? `Coloque o preço de ${semPreco.nome}` : "Tem um tamanho sem preço", alvo: `input[aria-label="Preço de ${String(semPreco.nome || "").replace(/(["\\])/g, "\\$1")}"]` } : null;
                    }
                    // (14/10) preço pelo sabor: todo sabor precisa de preço; não pede preço cheio
                    if (precosDosSabores(form)) {
                      const semS = (form.grupo_sabores?.opcoes || []).find((o: any) => !(Number(o.preco) > 0));
                      return semS ? { msg: `Coloque o preço de ${semS.nome}`, alvo: `input[aria-label="Preço de ${String(semS.nome).replace(/(["\\])/g, "\\$1")}"]` } : null;
                    }
                    return (form.preco_normal || 0) > 0 ? promoMaior : { msg: "Coloque o preço do produto", alvo: 'input[aria-label="Preço cheio"]' };
                    })();
                    if (fPreco) return fPreco;
                    if ((wizardStep === 6 || entTela) && !((form as any).pronta_entrega === true || (form as any).antecedencia)) return { msg: "Marque pronta entrega ou sob encomenda", alvo: ".prod-sec-ent" };
                    return null;
                  }
                  // Passo 4: Fotos — sempre pode avançar (fotos opcionais)
                  return null;
                })();
                const canAdvance = !falta;
                // Rola até o campo que falta e põe o cursor nele
                const irParaFalta = () => {
                  setMostrarFalta(true);
                  if (!falta?.alvo) return;
                  const raiz = document.querySelector(".prod-modal--novo") || document;
                  let el: Element | null = null;
                  try { el = raiz.querySelector(falta.alvo); } catch { el = null; }
                  if (!el) return;
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  const campo = (el.matches("input, textarea, button") ? el : el.querySelector("input, textarea, button")) as HTMLElement | null;
                  setTimeout(() => campo?.focus({ preventScroll: true }), 250);
                };
                const avisoFalta = mostrarFalta && falta && !form.id ? (
                  <p className="prod-falta-aviso" role="alert"><WarningCircle size={18} weight="bold" aria-hidden="true" /><span>{falta.msg}</span></p>
                ) : null;
                const isLast = wizardStep === 6; // (14/10) a Revisão é o último passo
                const isEdit = !!form.id;

                if (isEdit) {
                  // Modo edição: salva direto em qualquer passo
                  return (
                    editTab === "resumo"
                      ? <button className="prod-btn-cancelar-novo prod-btn-fechar-ed" onClick={handleTryClose}>Fechar</button>
                      : <button className="prod-btn-avancar-novo" onClick={handleSalvar} disabled={saving || uploading || !!gerandoDesc}>
                          {saving ? <span className="prod-spinner-sm" /> : "Salvar"}
                        </button>
                  );
                }

                if (isLast) {
                  return (<>
                    {avisoFalta}
                    <button className="prod-btn-avancar-novo" onClick={() => { if (!canAdvance) { irParaFalta(); return; } handleSalvar(); }} disabled={saving || uploading || !!gerandoDesc}>
                      {saving ? <span className="prod-spinner-sm" /> : (
                        <>
                          <CheckIc size={20} weight="bold" aria-hidden="true" />
                          {form.disponivel !== false ? "Publicar produto" : "Guardar produto"}
                        </>
                      )}
                    </button>
                  </>);
                }

                return (<>
                  {avisoFalta}
                  <button
                    className="prod-btn-avancar-novo"
                    aria-disabled={!canAdvance}
                    onClick={() => {
                      if (!canAdvance) { irParaFalta(); return; }
                      // (14/10) escolhas: lista → cada escolha marcada → passo 4
                      if (wizardStep === 3 && escTela < escolhasAtivas(form).length) { setEscTela(t => t + 1); return; }
                      if (wizardStep === 2) aoSairDoSobre();
                      if (wizardStep === 5 && !entTela) { setEntTela(true); return; }
                      setWizardStep(s => (s + 1) as 1 | 2 | 3 | 4 | 5 | 6);
                    }}
                  >
                    Continuar
                  </button>
                </>);
              })()}
            </div>
            )}
            </>)}
          </div>

        </div>
      )}

      {/* Preview Modal */}
      {previewProduto && (
        <div className="prod-preview-overlay" onClick={() => setPreviewProduto(null)}>
          <div className="prod-preview-modal" ref={caixaPreview} onClick={e => e.stopPropagation()}>
            <BotaoIcone className="prod-preview-close" variante="limpo" rotulo="Fechar" onClick={() => setPreviewProduto(null)}><XIc size={20} weight="bold" /></BotaoIcone>

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
                <div className="prod-preview-img prod-preview-img--placeholder"><Camera size={30} weight="bold" aria-hidden="true" /><span>Sem foto</span></div>
              );
            })()}

            <div className="prod-preview-body">
              {/* 08/10 · 3.21: rótulo + texto (antes "PREÇO", "OPÇÕES" e "CADASTRADO" em caixa alta) */}
              <h3 className="prod-preview-nome">{previewProduto.nome}</h3>
              {previewProduto.descricao && (
                <p className="prod-preview-desc">{previewProduto.descricao}</p>
              )}
              {(() => {
                const pv = previewProduto;
                const catOk = !!pv.categoria && categorias.includes(pv.categoria);
                const temVariacoes = (pv.tamanhos_disponiveis || []).length > 0 || (pv.recheios_disponiveis || []).length > 0;
                const promo = descontoPromocao(pv) > 0; // 10/10: vale também pra promoção em %
                const partes: string[] = [];
                const contar = (grupo: any, label: string, labelPlural: string) => {
                  if (grupo?.ativo && (grupo.opcoes?.length || 0) > 0) { const n = grupo.opcoes.length; partes.push(`${n} ${n === 1 ? label : labelPlural}`); }
                };
                contar(pv.grupo_massas, "massa", "massas");
                contar(pv.grupo_recheios, "recheio", "recheios");
                contar(pv.grupo_coberturas, "cobertura", "coberturas");
                contar(pv.grupo_sabores, "sabor", "sabores");
                contar((pv as any).grupo_tamanhos, "tamanho", "tamanhos");
                const opcoes = partes.length === 0 ? "Nenhuma" : partes.length <= 2 ? partes.join(" e ") : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
                const { temFicha, lucro, margem } = calcularLucro(pv);
                const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
                const cad = pv.created_at ? new Date(pv.created_at) : null;
                return (
                  <>
                    <div className="prod-preview-linhas">
                      <LinhaUi rotulo="Situação" tom={pv.disponivel !== false ? "verde" : "laranja"}>{pv.disponivel !== false ? "No cardápio" : "Fora do cardápio"}{promo ? " · em promoção" : ""}</LinhaUi>
                      {cad && <LinhaUi rotulo="Cadastrado em">{cad.getDate()} de {MESES[cad.getMonth()]}{cad.getFullYear() !== new Date().getFullYear() ? ` de ${cad.getFullYear()}` : ""}</LinhaUi>}
                      <LinhaUi rotulo="Categoria" tom={catOk ? undefined : "laranja"}>{catOk ? pv.categoria : "Sem categoria"}</LinhaUi>
                      <LinhaUi rotulo="Preço">
                        {(() => { const pl = precoDaLista(pv); return <>{pl.de > 0 && <><s className="prod-preview-de">R$ {formatPreco(pl.de)}</s> </>}{pl.aPartir || (temVariacoes && !(pv as any).grupo_tamanhos?.ativo) ? "a partir de " : ""}R$ {formatPreco(pl.final)}{pl.unidade ? ` ${pl.unidade}` : ""}</>; })()}
                      </LinhaUi>
                      <LinhaUi rotulo="Opções">{opcoes}</LinhaUi>
                      <LinhaUi rotulo="Ficha técnica" tom={temFicha ? "verde" : "laranja"}>{temFicha ? `Lucro de R$ ${formatPreco(lucro)} por venda (${margem.toFixed(0)}%)` : "Ainda não montada"}</LinhaUi>
                    </div>
                    {!temFicha && pv.id && (
                      <Botao variante="suave" cheio icone={<ListChecks size={20} weight="bold" />} className="prod-preview-ficha"
                        onClick={() => { const id = pv.id; irDepoisDeFechar.current = () => navigate("/ficha-tecnica", { state: { produtoId: id } }); setPreviewProduto(null); }}>
                        Montar a ficha técnica
                      </Botao>
                    )}
                  </>
                );
              })()}

              {/* Ações */}
              <div className="prod-preview-actions">
                <button className="prod-preview-btn-editar" onClick={() => {
                  setPreviewProduto(null);
                  openEditar(previewProduto);
                }}>
                  {previewProduto.disponivel !== false ? (
                    // Publicado → ícone lápis
                    <>
                      <PencilSimple size={20} weight="bold" aria-hidden="true" />
                      Editar produto
                    </>
                  ) : (
                    // Despublicado → ícone olho + call-to-action pra publicar
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Revisar e publicar
                    </>
                  )}
                </button>
                <div className="prod-preview-menu-wrap">
                  <button
                    className="prod-preview-btn-icon"
                    onClick={e => { e.stopPropagation(); setPreviewMenu(v => !v); }}
                    aria-label="Mais ações do produto"
                    aria-expanded={previewMenu}
                  >
                    <DotsThreeVertical size={20} weight="bold" aria-hidden="true" />Mais
                  </button>
                  {previewMenu && (
                    <div className="prod-preview-menu" onClick={e => e.stopPropagation()}>
                      <button
                        className="prod-preview-menu-item"
                        onClick={async () => {
                          setPreviewMenu(false);
                          // Ficha técnica em PDF é recurso PRO (relatórios em PDF)
                          if (!isPro) { avisar("A ficha técnica em PDF é do plano PRO.", { tipo: "info", acao: { rotulo: "Ver o PRO", aoTocar: () => irFechandoJanela(() => navigate("/assinar")) } }); return; }
                          try {
                            await gerarFichaProduto(previewProduto, userId);
                          } catch (err) {
                            console.error("Erro ao gerar PDF:", err);
                            avisar("Não foi possível gerar o PDF. Tente novamente.", { tipo: "erro" });
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
                            sku: limpo.sku ? skuLivre(limpo.sku, skusDe(produtos)) : null, // (21/10) a cópia ganha um SKU novo
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
                            showToast("error", "Não deu para duplicar", explicarErro(error));
                            return;
                          }
                          // Se tinha ficha técnica, clona também (11/10: confere se copiou)
                          const fichaOk = !(id && data?.id) || await copiarFichaTecnica(id, data.id);
                          setPreviewProduto(null);
                          await loadProdutos(userId);
                          if (fichaOk) avisar("Cópia criada, fora do cardápio", { tipo: "ok" }); // (14/10) aviso rápido (a janela "Entendi" aparecia por cima da próxima tela)
                          else showToast("error", "Cópia criada, mas sem a ficha técnica.", "Está despublicada. Abra a cópia e monte a ficha técnica de novo.");
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
                          // 10/10: o link usa o código público do cardápio, como no resto do app (com o id da conta não abria)
                          const url = getCardapioUrl(profile);
                          if (!url) {
                            avisar("Seu cardápio ainda não tem link. Publique o cardápio primeiro.", { tipo: "info", acao: { rotulo: "Ir para o cardápio", aoTocar: () => irFechandoJanela(() => navigate("/cardapio")) } });
                            return;
                          }
                          try { await navigator.clipboard.writeText(url); avisar("Link do cardápio copiado!", { tipo: "ok" }); }
                          catch { avisar(url, { tipo: "info" }); }
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
                          const ok = await alternarDestaque(previewProduto);
                          if (ok) setPreviewProduto({ ...previewProduto, destaque: (previewProduto as any).destaque !== true } as any);
                        }}
                      >
                        <span className="prod-preview-menu-ico" style={{ color: "#E8A23A" }}><Star size={18} weight={(previewProduto as any).destaque === true ? "regular" : "fill"} /></span>
                        <span>
                          <div className="prod-preview-menu-title">{(previewProduto as any).destaque === true ? "Tirar do destaque" : "Destacar no cardápio"}</div>
                          <div className="prod-preview-menu-sub">{(previewProduto as any).destaque === true ? "Continua no cardápio, na categoria" : `No topo do cardápio · ${qtdDestaques(previewProduto.id)} de ${MAX_DESTAQUES}`}</div>
                        </span>
                      </button>
                      <button
                        className="prod-preview-menu-item"
                        onClick={async () => {
                          setPreviewMenu(false);
                          const novoDisponivel = !(previewProduto.disponivel !== false);
                          if (novoDisponivel && passouDoLimite()) { setPreviewProduto(null); setLimiteAberto(true); return; }
                          const { error } = await supabase.from("produtos").update({ disponivel: novoDisponivel }).eq("id", previewProduto.id!);
                          if (error) { showToast("error", "Não deu certo", explicarErro(error)); return; }
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
                            {previewProduto.disponivel !== false ? "Tirar do cardápio" : "Mostrar no cardápio"}
                          </div>
                          <div className="prod-preview-menu-sub">
                            {previewProduto.disponivel !== false ? "Fica guardado, sem aparecer para os clientes" : "Volta a aparecer para os clientes"}
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

      {/* "Descartar o cadastro?" agora é o confirmar() do handleTryClose (11/10) */}

      <Janela aberta={!!deleteConfirm} aoFechar={() => setDeleteConfirm(null)} icone={<Trash size={32} />} tom="vermelho"
        titulo="Excluir o produto?" texto="Ele sai do cardápio e da sua lista. Pedidos antigos não mudam."
        acoes={<><Botao variante="secundario" onClick={() => setDeleteConfirm(null)}>Cancelar</Botao><Botao variante="perigo" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Excluir</Botao></>} />

      </>
      }

      <style>{`
        /* ── Tabs ── */

        .prod-root { font-family: var(--font-base); max-width:800px; display:flex; flex-direction:column; gap:1rem; }
        @media (min-width: 900px) {
          .prod-root {
            max-width: 1400px;
            min-height: calc(100vh - 5rem); /* menos padding do layout-main (3rem + 2rem) */
          }
        }
        .prod-root, .prod-root * { font-family: var(--font-base); }
        .prod-root button, .prod-root input, .prod-root select, .prod-root textarea { font-family: var(--font-base) !important; }

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
        .prod-hero-masc { background: none !important; box-shadow: none !important; padding: 0 !important; align-items: center; }
        .prod-hero-masc img { width: 200px; height: auto; display: block; margin: 0 auto; }
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
          font-size: 0.75rem;
          font-weight: var(--fw-black);
        }

        .prod-hero-eyebrow {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          color: var(--primary);
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
          font-weight: 700;
          cursor: pointer;
          font-family: var(--font-base) !important;
          letter-spacing: 0;
          box-shadow: 0 4px 0 var(--primary-dark);
          transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
        }
        .prod-hero-btn-primary:hover { filter: brightness(1.05); }
        .prod-hero-btn-primary:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
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

        /* (24/10) vídeo em pé (o tutorial vai ser gravado no celular) e menor */
        .prod-hero-right { align-self: center; width: 156px; padding: 6px; border-radius: 18px; }
        .prod-hero-video-thumb { aspect-ratio: 9 / 16; max-height: none; border-radius: 13px; }
        .prod-hero-video-play { width: 44px; height: 44px; }
        .prod-hero-video-footer { gap: 6px; padding: 8px 4px 2px; }
        .prod-hero-video-t { font-size: 12.5px; white-space: nowrap; }
        .prod-hero-video-badge { padding: 2px 6px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; }

        /* ═══ Desktop: split 1fr / 1.2fr — vídeo vai para direita ═══ */
        @media (min-width: 900px) {
          .prod-hero-split {
            min-height: calc(100dvh - 2rem - 61px);
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
            padding: 8px;
            flex: 0 0 220px;
            width: 220px;
            max-width: 220px;
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
          .prod-hero-video-play { width: 60px; height: 60px; }
          .prod-hero-video-play svg { width: 28px; height: 28px; }
          .prod-hero-video-t { font-size: var(--text-sm); }
        }

        /* ── Modal salvar na biblioteca ── */
        @keyframes prodLibIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes prodLibScale {
          from { transform: scale(0.94); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .prod-spinner { width:32px; height:32px; border:3px solid var(--primary-light); border-top-color:var(--primary); border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        .prod-spinner-sm { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:pspin 0.7s linear infinite; display:inline-block; }
        @keyframes pspin { to { transform:rotate(360deg); } }
        .prod-filtro-btn.active { border-color:var(--primary); color:var(--primary); background:var(--primary-light); font-weight: var(--fw-bold); }
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
          font-size: 0.75rem;
          font-weight: 500;
        }
        .prod-card-promo {
          position: absolute;
          top: 8px; right: 8px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          color: var(--text-inverse);
          font-size: 0.75rem;
          font-weight: var(--fw-black);
          padding: 3px 8px;
          border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .prod-card-badge-var {
          position: absolute;
          top: 8px; left: 8px;
          background: rgba(255,255,255,0.95);
          color: #1E40AF;
          font-size: 0.75rem;
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
          background: linear-gradient(135deg, var(--ui-laranja-fundo) 0%, #FCE7F3 100%);
          text-align: center;
          transition: filter 0.2s;
        }
        .prod-card-sem-foto:hover { filter: brightness(1.03); }
        .prod-card-sem-foto-title {
          font-size: 0.75rem;
          font-weight: var(--fw-black);
          color: var(--primary-dark);
          line-height: 1.1;
          letter-spacing: -0.01em;
        }
        /* Tag PRO padrão do app (igual à do menu Mais: coroa + "PRO") */
        .prod-card-tags { position: absolute; top: 8px; display: flex; flex-direction: column; gap: 4px; z-index: 1; pointer-events: none; }
        .prod-card-tags--dir { right: 8px; align-items: flex-end; }
        .prod-card-tags--esq { left: 8px; align-items: flex-start; }
        .prod-card-tags > * { position: static !important; top: auto !important; left: auto !important; right: auto !important; }
        .prod-card-semcat { background: var(--warning); color: var(--text-inverse); font-size: 0.75rem; font-weight: 700; padding: 2px 6px; border-radius: 6px; }
        .prod-card-encomenda { position:absolute; top:0.4rem; right:0.4rem; background:var(--warning); color:var(--text-inverse); font-size: var(--font-caption); font-weight: var(--fw-bold); padding:0.15rem 0.45rem; border-radius: var(--radius-xl); }
        .prod-card-info { padding:0.65rem 0.75rem; flex:1; display:flex; flex-direction:column; }
        .prod-card-bottom { margin-top:auto; }
        .prod-card-cat { font-size: 0.75rem; color:var(--text-muted); font-weight: var(--fw-medium); margin:0 0 0.15rem; }
        .prod-card-nome { font-size: var(--font-button); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 0.25rem; line-height:1.3; }
        .prod-card-preco { font-size: var(--font-button); font-weight: 700; color:var(--success); margin:0; }
        /* 09/10: preço "de/por" não quebra mais no meio ("R$" em uma linha e o valor na outra) */
        .prod-card-preco { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; row-gap: 0; }
        .prod-card-por { white-space: nowrap; }
        .prod-card-por small { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .prod-card-de { white-space: nowrap; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); text-decoration: line-through; }

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
          font-weight: 500;
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
        .prod-card-lucro--alto  { background:var(--ui-verde-fundo); color:var(--ui-verde); }
        .prod-card-lucro--medio { background:var(--ui-laranja-fundo); color:#a16207; }
        .prod-card-lucro--baixo { background:var(--ui-vermelho-fundo); color:#b91c1c; }

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
          border-radius: var(--ui-raio-janela) var(--ui-raio-janela) 0 0;
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
            border-radius: var(--ui-raio-janela);
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
        .prod-preview-close:hover { background: var(--text-title); color: var(--ui-branco); border-color: var(--text-title); }
        .prod-preview-img {
          width: 100%;
          height: 260px;
          overflow: hidden;
          background: var(--bg-subtle);
          flex-shrink: 0;
          border-radius: var(--ui-raio-janela) var(--ui-raio-janela) 0 0;
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
        .prod-preview-dot--ativo { background: var(--ui-branco); }

        /* Nome */
        .prod-preview-nome {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 700;
          color: #2D1F26;
          font-family: inherit;
          line-height: 1.15;
          letter-spacing: -0.01em;
        }

        /* Descrição */
        .prod-preview-desc {
          margin: 0 0 14px;
          font-size: 13px;
          color: var(--ui-texto-2);
          line-height: 1.4;
          font-family: inherit;
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
          background: var(--ui-rosa);
          color: var(--ui-branco);
          border: none;
          border-radius: var(--ui-raio-p);
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 3px 0 var(--ui-rosa-escuro);
          transition: transform 0.08s, filter 0.08s, box-shadow 0.08s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .prod-preview-btn-editar:hover { filter: brightness(1.05); }
        .prod-preview-btn-editar:active {
          transform: translateY(3px);
          box-shadow: 0 0 0 var(--ui-rosa-escuro);
        }
        .prod-preview-btn-icon {
          padding: 13px 14px;
          background: #F5F1F3;
          color: var(--ui-texto-2);
          border: none;
          border-radius: var(--ui-raio-p);
          font-family: inherit;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .prod-preview-btn-icon:hover { background: #EBE6E9; color: #2D1F26; }

        /* Menu dropdown ⋯ (lista suspensa) */
        .prod-preview-menu-wrap { position: relative; z-index: 1000; }
        .prod-preview-menu {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          background: var(--ui-branco);
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
          border-radius: var(--ui-raio-p);
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
          transition: background 0.1s;
        }
        .prod-preview-menu-item:hover { background: #FAF8F5; }
        .prod-preview-menu-item--del:hover { background: var(--ui-vermelho-fundo); }
        .prod-preview-menu-item--del .prod-preview-menu-title { color: var(--ui-vermelho); }
        .prod-preview-menu-item--del .prod-preview-menu-ico { color: var(--ui-vermelho); }
        .prod-preview-menu-ico {
          width: 36px;
          height: 36px;
          border-radius: var(--ui-raio-p);
          background: #FAF8F5;
          color: var(--ui-texto-2);
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
          font-size: 13px;
          color: var(--ui-texto-2);
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
        @media (max-width: 767px) {
        /* iPhone com o teclado aberto: a janela encolhe até o teclado, e o "Avançar" do rodapé continua visível */
        html.teclado-aberto .prod-modal-overlay { bottom: var(--teclado, 0px); }
        }
        /* (15/10) sucesso = aviso rosa no meio da tela (a caixa do cadastro some, fica só o aviso) */
        body .prod-modal-overlay.prod-modal-overlay--sucesso { justify-content: center !important; align-items: center !important; padding: 16px max(16px, env(safe-area-inset-right, 0px)) calc(16px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)) !important; overflow-y: auto; }
        body .prod-modal-overlay--sucesso .prod-modal.prod-modal--aviso { width: 100% !important; max-width: 400px !important; height: auto !important; max-height: none !important; margin: auto !important; padding: 0 !important; border: 0 !important; border-radius: 20px !important; background: transparent !important; box-shadow: none !important; overflow: visible !important; animation: none !important; }
        @media (min-width: 640px) { body .prod-modal-overlay--sucesso .prod-modal.prod-modal--aviso { max-width: 580px !important; } } /* (30/10 · 5.27) aviso mais largo e baixo no PC */
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
          border-radius: var(--ui-raio-janela) var(--ui-raio-janela) 0 0;
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
          .prod-modal-overlay { justify-content: center; align-items: center; padding: 24px; background: rgba(24, 8, 14, .62); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); } /* (30/10) igual às outras janelas no PC */
          .prod-modal {
            max-width: 640px;
            height: 88vh;
            max-height: 88vh;
            border-radius: var(--ui-raio-janela);
            animation: prodModalFadeIn 0.22s ease;
          }
          .prod-modal::before { display: none; }
          @keyframes prodModalFadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to   { opacity: 1; transform: scale(1); }
          }
        }
        /* Desktop: overlay em row para caber preview ao lado */
        @media (min-width: 900px) {
          .prod-modal-overlay {
            flex-direction: row !important;
            align-items: center !important;
            gap: 20px;
          }
        }

        /* ── Preview lateral (só desktop) ── */

        @media (min-width: 900px) {
          .prod-modal-overlay {
            /* precisa reservar espaço para o preview lateral */
            gap: 16px;
          }
        }
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
          /* min-height REMOVIDO — estava empurrando o footer para fora
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
          font-weight: 700 !important; !important;
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
          font-size: 12px !important;
          font-style: normal;
          color: var(--text-muted);
          font-weight: 500 !important;
          text-transform: lowercase;
        }
        .prod-field input,
        .prod-field select,
        .prod-field textarea {
          padding: 14px 16px !important;
          font-size: 16px !important;
          border-radius: var(--ui-raio) !important;
        }
        .prod-preco-input { border-radius: var(--ui-raio) !important; }
        .prod-preco-input span { font-size: 14px !important; }
        .prod-preco-input input { padding: 14px 8px 14px 0 !important; font-size: 16px !important; }
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
        .prod-section-label { font-size: var(--font-section-label); font-weight: var(--fw-bold); line-height: var(--lh-normal); letter-spacing: var(--ls-wide); color: var(--primary); margin: 0; }
        .prod-img-remove { position: absolute; top: var(--space-1); right: var(--space-1); background: rgba(0,0,0,0.5); border: none; border-radius: 50%; width: 22px; height: 22px; color: var(--text-inverse); font-size: var(--font-caption); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .prod-field { display: flex; flex-direction: column; gap: var(--space-1); }
        .prod-field label { font-size: var(--font-field-label); font-weight: 500; line-height: var(--lh-normal); color: var(--text-secondary); }
        .prod-field input, .prod-field select, .prod-field textarea { padding: var(--pad-input); border: 1.5px solid var(--border); border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-medium); line-height: var(--lh-normal); color: var(--text-title); background: var(--bg-input); outline: none; transition: border-color var(--dur-fast) var(--ease-out); width: 100%; box-sizing: border-box; }
        .prod-field input:focus, .prod-field select:focus, .prod-field textarea:focus { border-color: var(--border-focus); }
        .prod-field textarea { resize: none; }
        .prod-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-stack); }
        .prod-row-2.prod-row-1 { grid-template-columns: 1fr; }
        .prod-preco-input { display: flex; align-items: center; border: 1.5px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-input); transition: border-color var(--dur-fast) var(--ease-out); }
        .prod-preco-input span { padding: 0 var(--space-3); font-weight: var(--fw-bold); color: var(--success); font-size: var(--font-input); flex-shrink: 0; }
        .prod-preco-input input { border: none !important; border-radius: 0 !important; flex: 1; padding: var(--space-3) var(--space-2) var(--space-3) 0 !important; outline: none !important; box-shadow: none !important; }
        .prod-preco-input:focus-within { border-color: var(--border-focus); }

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

        /* Input de preço promocional — usa paleta rosa Doonly */
        .prod-preco-input--promo {
          border-color: var(--ui-rosa) !important;
          background: #FFF5F9 !important;
        }
        .prod-preco-input--promo input {
          background: transparent !important;
        }
        .prod-preco-input--promo:focus-within {
          border-color: var(--ui-rosa-escuro) !important;
        }
        .prod-preco-input--promo span, .prod-preco-input--promo input {
          color: var(--ui-rosa-escuro) !important;
        }
        .prod-preco-input--promo input::placeholder {
          color: #F5B8CD !important;
        }

        /* ═══════════════════════════════════════════════════════════
           WIZARD NOVO — Design limpo com progresso, header e rodapé
           ═══════════════════════════════════════════════════════════ */

        /* Modal com cantos menos arredondados */
        .prod-modal--novo {
          border-radius: var(--ui-raio-janela) !important;
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
        .prod-wiz-dots i.on { background: var(--ui-rosa); }
        .prod-modal-header-novo {
          display: flex;
          align-items: center;
          padding: 28px 32px 12px;
          background: var(--ui-branco);
          font-family: var(--font-base);
          gap: 12px;
          flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .prod-modal-header-novo { padding: 16px 16px 8px; }
        }

        /* ═══ Rodapé — botões 3D estilo NovaVenda ═══ */
        .prod-modal-footer--novo {
          background: var(--ui-branco) !important;
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
          color: var(--ui-texto-2);
          font-family: var(--font-base) !important;
          font-size: 13.5px;
          font-weight: 700;
          border-radius: var(--ui-raio-p);
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
          background: var(--ui-rosa);
          color: var(--ui-branco);
          border-radius: var(--ui-raio-p);
          font-family: var(--font-base) !important;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.01em;
          text-align: center;
          box-shadow: 0 3px 0 var(--ui-rosa-escuro);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-sizing: border-box;
          transition: transform 0.08s, filter 0.08s, box-shadow 0.08s;
        }
        .prod-btn-avancar-novo:hover:not(:disabled) { filter: brightness(1.05); }
        .prod-btn-avancar-novo:active:not(:disabled) {
          transform: translateY(3px);
          box-shadow: 0 0 0 var(--ui-rosa-escuro);
        }
        .prod-btn-avancar-novo:disabled {
          background: #F5DCE6;
          color: var(--ui-branco);
          box-shadow: 0 3px 0 #E8C4D2;
          cursor: not-allowed;
        }

        .prod-row-2:has(.prod-preco-input--promo) { align-items: end; }

        /* ═══ Mobile: cadastro em TELA CHEIA (aprovado 28/09) ═══
           Sem cantos arredondados, sem fundo aparecendo, altura fixa (não pula entre etapas).
           O rodapé fica no vinho do menu inferior, com os botões do cadastro no lugar dele. */
        @media (max-width: 640px) {
          .prod-modal-overlay:has(.prod-modal--novo) { backdrop-filter: none; -webkit-backdrop-filter: none; }
          .prod-modal--novo {
            border-radius: 0 !important;
            height: 100vh !important; max-height: 100vh !important;
            height: 100dvh !important; max-height: 100dvh !important;
            box-shadow: none !important;
          }
          .prod-modal--novo .prod-modal-header-novo {
            padding-top: calc(env(safe-area-inset-top, 0px) + 14px);
          }
          /* Descrição: altura suficiente para o exemplo do placeholder aparecer inteiro */
          .prod-modal--novo #prod-desc-input { min-height: 176px !important; }
          .prod-modal--novo .prod-modal-footer--novo {
            background: var(--text-title) !important; /* mesma cor do menu de navegação do celular */
            border-top: none !important;
            padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .prod-modal--novo .prod-btn-cancelar-novo { color: rgba(255,255,255,0.78); }
          .prod-modal--novo .prod-btn-cancelar-novo:hover,
          .prod-modal--novo .prod-btn-cancelar-novo:active { background: rgba(255,255,255,0.08); }
          .prod-modal--novo .prod-btn-avancar-novo {
            background: var(--ui-branco); color: var(--ui-texto); box-shadow: none; font-weight: 700;
          }
          .prod-modal--novo .prod-btn-avancar-novo:active:not(:disabled) { transform: scale(0.98); box-shadow: none; }
          .prod-modal--novo .prod-btn-avancar-novo:disabled {
            background: rgba(255,255,255,0.16); color: rgba(255,255,255,0.5); box-shadow: none;
          }
          .prod-modal--novo .prod-btn-avancar-novo .prod-spinner-sm { border-color: rgba(44,18,25,0.25); border-top-color: var(--ui-texto); }
          /* "Vamos montar as opções": sem sobra embaixo que gerava rolagem à toa */
          .prod-modal--novo .prod-mchk-wrap { padding-bottom: 4px; }
          .prod-modal--novo .prod-mchk-list { margin-bottom: 0; }
        }
        /* Celulares mais baixos (ou com barra do navegador): aperta o checklist para caber sem rolar */
        @media (max-width: 640px) and (max-height: 760px) {
          .prod-modal--novo .pv3-header { margin-top: 10px; margin-bottom: 14px; }
          .prod-modal--novo .prod-mchk-list { gap: 8px; }
          .prod-modal--novo .prod-mchk-item { padding: 11px 12px; }
          .prod-modal--novo .prod-mchk-ico { width: 32px; height: 32px; }
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

        /* ═══ Header da descrição (label + botão IA colados) ═══ */
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
          color: var(--ui-branco);
          font-family: var(--font-base) !important;
          font-size: 13px;
          font-weight: 700;
          border-radius: var(--ui-raio-p);
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
        .prod-btn-ia-novo-crown {
          width: 15px;
          height: 15px;
          object-fit: contain;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }

        /* Modal empty-state PRO */
        @keyframes prodProModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes prodProModalIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Novo: slot PRO grafite Doonly */
        @keyframes prodRgbFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }

        /* Linha de foto por opção (quadradinho + nome + CTA) */
        .prod-opcao-foto-linha {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: var(--ui-branco);
          border: 1.5px solid #F0EBED;
          border-radius: var(--ui-raio-p);
          cursor: pointer;
          transition: all 0.15s;
        }
        .prod-opcao-foto-linha:hover {
          border-color: var(--ui-rosa);
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
          color: var(--ui-branco);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
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
          color: var(--ui-rosa);
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
          border-radius: var(--ui-raio);
          background: #FAF8F5;
          border: 2px dashed #E5D8DE;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          position: relative;
          transition: all 0.15s;
        }
        .prod-opcao-foto-card:hover .prod-opcao-foto-slot {
          border-color: var(--ui-rosa);
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
          color: var(--ui-branco);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .prod-opcao-foto-remove:hover { background: var(--ui-vermelho); }
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
          border-radius: var(--ui-raio);
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
          border-radius: var(--ui-raio-p);
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
          color: var(--ui-branco);
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 12px;
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
          color: var(--ui-branco);
          font-family: var(--font-base);
          font-size: 13px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          transition: filter 0.12s;
          flex-shrink: 0;
        }
        .prod-var-foto-btn:hover { filter: brightness(1.15); }

        /* Categoria compacta */
        .prod-cat-nova-form {
          padding: 12px;
          background: #FDF7FA;
          border: 1.5px dashed var(--ui-rosa);
          border-radius: var(--ui-raio-p);
        }
        .prod-cat-nova-hint {
          font-size: 12px;
          font-weight: 700;
          color: var(--ui-rosa);
          margin: 0 0 8px;
        }
        .prod-cat-nova-form input {
          width: 100%;
          padding: 11px 12px;
          border: 1.5px solid #E5DFE1;
          border-radius: var(--ui-raio);
          font-family: var(--font-base) !important;
          font-size: 16px;
          outline: none;
          background: var(--ui-branco);
          box-sizing: border-box;
        }
        .prod-cat-nova-form input:focus { border-color: var(--ui-rosa); }
        .prod-cat-cancel-btn {
          flex: 1;
          padding: 10px;
          background: var(--ui-branco);
          border: 1.5px solid #E5DFE1;
          color: var(--ui-texto-2);
          border-radius: var(--ui-raio-p);
          font-family: var(--font-base) !important;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .prod-cat-criar-btn {
          flex: 2;
          padding: 10px;
          background: var(--ui-rosa);
          color: var(--ui-branco);
          border: none;
          border-radius: var(--ui-raio-p);
          font-family: var(--font-base) !important;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .prod-cat-criar-btn:disabled { opacity: 0.5; cursor: not-allowed; }



        /* ═══════════════════════════════════════════════════════════
           TOGGLE "OFEREÇO DESCONTO POR PACOTE?" + PREÇO COM TAG
           ═══════════════════════════════════════════════════════════ */

        /* Responsivo mobile para o toggle */

        @keyframes prodDiscOvIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes prodDiscBoxIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        /* ═══ Mobile Checklist (Etapa 1 Personalização) ═══ */
        @keyframes prod-mchk-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .prod-modal .prod-mchk-item input.prod-mchk-checkbox {
          display: none !important; /* o visual é o .prod-mchk-check-visual — sem isso aparecia check duplo */
        }

        /* ═══ Banner Rascunho Salvo (mobile) ═══ */
        @keyframes prod-draft-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

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
             para o hero ocupar tudo e centralizar de verdade */
          .prod-root:has(> .prod-hero-split) {
            padding: 0;
            gap: 0;
            /* (30/10 · 5.26) a conta não tirava o cabeçalho (61px): sobrava uma barra de rolagem de 13px */
            min-height: calc(100dvh - 2rem - 61px);
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
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .prod-tab-novo.active {
          background: var(--bg-card);
          color: var(--text-title);
          box-shadow: 0 2px 6px rgba(61, 26, 36, 0.08);
        }

        /* ── Filtros categoria ── */
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

        /* ── Ficha técnica em TELA CHEIA (100% via design tokens) ── */
        @keyframes fichaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fichaSlideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (min-width: 720px) {
          @keyframes fichaFadeScale {
            from { opacity: 0; transform: scale(0.96); }
            to   { opacity: 1; transform: scale(1); }
          }
        }

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
          border-color: var(--ui-rosa);
          transform: scale(1.05);
        }
        /* Só aparece em desktop */
        @media (min-width: 900px) {
          .prod-card:hover .prod-card-check { display: flex; }
          /* Se algum selecionado, todos ficam com checkbox visível */
          body:has(.prod-card--selected) .prod-card-check { display: flex; }
          .prod-card--selected .prod-card-check {
            background: var(--ui-rosa);
            border-color: var(--ui-rosa);
            display: flex;
          }
          .prod-card--selected {
            outline: 2px solid var(--ui-rosa) !important;
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
          color: var(--ui-branco);
          border-radius: var(--ui-raio-cartao);
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
          color: var(--ui-branco);
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
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
          background: var(--ui-branco);
          border-radius: var(--ui-raio-janela);
          padding: 28px 24px 24px;
          max-width: 380px;
          width: 100%;
          text-align: center;
          box-shadow: 0 24px 60px rgba(220, 38, 38, 0.20);
          animation: doonly-toast-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
          font-family: var(--font-base);
        }
        @keyframes doonly-toast-in { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: none; } }
        .bulk-confirm-icon {
          width: 60px; height: 60px;
          border-radius: 50%;
          background: #FEF2F2;
          color: var(--ui-vermelho);
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
          color: var(--ui-texto-2);
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
          border-radius: var(--ui-raio-p);
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.1s ease, opacity 0.1s ease;
        }
        .bulk-confirm-btn--cancelar {
          background: #F0EBED;
          color: var(--ui-texto-2);
        }
        .bulk-confirm-btn--cancelar:hover { background: #E5D8DE; }
        .bulk-confirm-btn--excluir {
          background: var(--ui-vermelho);
          color: var(--ui-branco);
          box-shadow: 0 3px 0 var(--ui-vermelho-escuro);
        }
        .bulk-confirm-btn--excluir:hover { transform: translateY(-1px); box-shadow: 0 4px 0 var(--ui-vermelho-escuro); }
        .bulk-confirm-btn--excluir:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ui-vermelho-escuro); }
        .bulk-confirm-btn:disabled { opacity: 0.6; cursor: wait; }


      
        /* Preço do kit (02/10) */
        .kitp-dica { font-size: 12px; color: var(--ui-texto-3); margin: 8px 0 0; }
        .kitp-pct { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 14px; color: var(--ui-cinza-texto); }
        .kitp-pct input { width: 64px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio-p); padding: 8px; font-family: inherit; font-size: 16px; font-weight: 700; text-align: center; color: var(--ui-texto); }
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

    </div>
    </>
  );
}
