import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MagnifyingGlass, X, House, ClipboardText, Plus, CalendarBlank, Sparkle, SquaresFour, Cake, Tag, Stack, Basket, ListChecks, Users,
  ShoppingBag, Palette, Storefront, ArrowSquareOut, CurrencyDollar, ArrowsDownUp, HandCoins, CalendarCheck, Receipt, ChartLineUp,
  Coins, CreditCard, Buildings, Megaphone, Newspaper, Bell, Gear, Crown, SpeakerHigh, ChatCircleText, Bug, Lightbulb,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useProfile, getCardapioUrl } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import "./buscaRapida.css";

/**
 * (22/10) Busca rápida, como na Dora: "Buscar tela ou o que você quer fazer".
 * Abre pelo campo do topo (computador), pelo campo do Início (celular) ou com Ctrl+K / ⌘K.
 * Setas pra navegar, Enter pra abrir, Esc pra fechar. Busca também por palavras (pix, horário, senha, cupom…).
 */
type Item = { g: string; t: string; ic: Icon; rota?: string; estado?: Record<string, unknown>; fazer?: () => void; chaves?: string };

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function abrirBuscaRapida() { window.dispatchEvent(new Event("doonly:busca")); }

export default function BuscaRapida() {
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile } = useProfile();
  const { isPro } = usePlano();
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abrir = () => { setQ(""); setSel(0); setAberta(true); };
    const tecla = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); setAberta(a => { if (!a) { setQ(""); setSel(0); } return !a; }); }
    };
    window.addEventListener("doonly:busca", abrir);
    window.addEventListener("keydown", tecla);
    return () => { window.removeEventListener("doonly:busca", abrir); window.removeEventListener("keydown", tecla); };
  }, []);
  // (22/10) só no computador o cursor já entra no campo; no celular o teclado só abre quando ela tocar no campo
  useEffect(() => { if (aberta && window.matchMedia("(min-width: 901px)").matches) window.setTimeout(() => inputRef.current?.focus(), 30); }, [aberta]);
  // fecha ao trocar de tela
  useEffect(() => { setAberta(false); }, [pathname]);

  const itens: Item[] = useMemo(() => {
    const link = profile ? getCardapioUrl(profile as any) : "";
    return [
      { g: "Principal", t: "Início", ic: House, rota: "/inicio", chaves: "resumo dia" },
      { g: "Principal", t: "Pedidos", ic: ClipboardText, rota: "/pedidos", chaves: "encomendas pronta entrega quadro aceitar" },
      { g: "Principal", t: "Nova venda", ic: Plus, rota: "/vendas/novo", chaves: "novo pedido vender registrar venda" },
      { g: "Principal", t: "Agenda", ic: CalendarBlank, rota: "/agenda", chaves: "calendario entregas dia" },
      { g: "Principal", t: "Doo IA", ic: Sparkle, fazer: () => window.dispatchEvent(new Event("doonly:abrir-doo")), chaves: "assistente ajuda inteligencia artificial perguntar" },
      { g: "Cadastros", t: "Cadastros", ic: SquaresFour, rota: "/cadastros" },
      { g: "Cadastros", t: "Produtos", ic: Cake, rota: "/produtos", chaves: "bolo doce salgado preco foto" },
      { g: "Cadastros", t: "Novo produto", ic: Plus, rota: "/produtos", estado: { abrirCadastro: true }, chaves: "cadastrar produto criar" },
      { g: "Cadastros", t: "Categorias", ic: Tag, rota: "/categorias", chaves: "ordem cardapio" },
      { g: "Cadastros", t: "Complementos", ic: Stack, rota: "/complementos", chaves: "sabores recheios adicionais topo vela" },
      { g: "Cadastros", t: "Ingredientes", ic: Basket, rota: "/insumos", chaves: "insumos compras mercado" },
      { g: "Cadastros", t: "Ficha técnica", ic: ListChecks, rota: "/ficha-tecnica", chaves: "receita custo lucro margem" },
      { g: "Cadastros", t: "Clientes", ic: Users, rota: "/clientes", chaves: "aniversario contatos" },
      { g: "Cardápio digital", t: "Cardápio digital", ic: ShoppingBag, rota: "/cardapio", chaves: "link qr code visitas compartilhar" },
      { g: "Cardápio digital", t: "Aparência do cardápio", ic: Palette, rota: "/cardapio-design", chaves: "cores logo banner foto tema natal" },
      { g: "Cardápio digital", t: "Dados da loja", ic: Storefront, rota: "/cardapio-config", chaves: "pix chave horario endereco entrega taxa whatsapp telefone nome loja redes instagram facebook pagamento retirada" },
      ...(link ? [{ g: "Cardápio digital", t: "Ver meu cardápio", ic: ArrowSquareOut, fazer: () => window.open(link, "_blank", "noopener,noreferrer"), chaves: "abrir como cliente" }] : []),
      { g: "Financeiro", t: "Financeiro", ic: CurrencyDollar, rota: "/financeiro", chaves: "visao geral caixa dinheiro" },
      { g: "Financeiro", t: "Transações", ic: ArrowsDownUp, rota: "/financeiro/transacoes", chaves: "extrato entradas saidas exportar" },
      { g: "Financeiro", t: "A receber", ic: HandCoins, rota: "/financeiro/a-receber", chaves: "sinal falta receber cobrar" },
      { g: "Financeiro", t: "A pagar", ic: CalendarCheck, rota: "/financeiro/a-pagar", chaves: "contas boletos fornecedor vencimento" },
      { g: "Financeiro", t: "Custos", ic: Receipt, rota: "/custos", chaves: "fixos variaveis salario mao de obra aluguel luz gas" },
      { g: "Financeiro", t: "Lucratividade", ic: ChartLineUp, rota: "/lucratividade", chaves: "lucro margem ponto de equilibrio" },
      { g: "Financeiro", t: "Informar o saldo do caixa", ic: Coins, rota: "/financeiro", estado: { abrir: "saldo" }, chaves: "dinheiro gaveta" },
      { g: "Financeiro", t: "Cadastrar custo fixo", ic: Buildings, rota: "/custos", estado: { abrir: "fixo" }, chaves: "aluguel luz internet" },
      { g: "Financeiro", t: "Taxa da maquininha", ic: CreditCard, rota: "/custos", estado: { abrir: "maquininha" }, chaves: "cartao credito debito" },
      { g: "Mais", t: "Marketing", ic: Megaphone, rota: "/marketing", chaves: "cupom desconto pixel facebook" },
      { g: "Mais", t: "Novidades", ic: Newspaper, rota: "/noticias", chaves: "dicas tutoriais" },
      { g: "Mais", t: "Notificações", ic: Bell, rota: "/notificacoes", chaves: "avisos" },
      { g: "Conta e ajuda", t: "Configurações", ic: Gear, rota: "/configuracoes", chaves: "conta senha email sair instalar atualizar excluir termos privacidade" },
      { g: "Conta e ajuda", t: "Minha assinatura", ic: Crown, rota: isPro ? "/minha-assinatura" : "/assinar", chaves: "plano pro pagamento" },
      { g: "Conta e ajuda", t: "Notificações e sons", ic: SpeakerHigh, rota: "/configuracoes/notificacoes", chaves: "som aviso push celular" },
      { g: "Conta e ajuda", t: "Mensagens do WhatsApp", ic: ChatCircleText, rota: "/configuracoes/mensagens", chaves: "textos prontos" },
      { g: "Conta e ajuda", t: "Relatar um problema", ic: Bug, rota: "/relatar-problema", chaves: "erro bug suporte" },
      { g: "Conta e ajuda", t: "Sugerir uma melhoria", ic: Lightbulb, rota: "/solicitar-recurso", chaves: "ideia" },
    ];
  }, [profile, isPro]);

  const lista = useMemo(() => {
    const termos = sem(q).split(/\s+/).filter(Boolean);
    if (!termos.length) return itens;
    return itens
      .filter(i => { const alvo = sem(`${i.t} ${i.g} ${i.chaves || ""}`); return termos.every(t => alvo.includes(t)); })
      .sort((a, b) => Number(sem(b.t).startsWith(termos[0])) - Number(sem(a.t).startsWith(termos[0])));
  }, [q, itens]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listaRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  if (!aberta) return null;

  const abrir = (i: Item) => {
    setAberta(false);
    if (i.fazer) { i.fazer(); return; }
    if (i.rota) navigate(i.rota, i.estado ? { state: i.estado } : undefined);
  };
  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(lista.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (lista[sel]) abrir(lista[sel]); }
    else if (e.key === "Escape") { e.preventDefault(); setAberta(false); }
  };
  const atual = (i: Item) => !!i.rota && !i.estado && (pathname === i.rota);

  let grupo = "";
  return (
    <div className="br-fundo" onMouseDown={e => { if (e.target === e.currentTarget) setAberta(false); }}>
      <div className="br" role="dialog" aria-modal="true" aria-label="Buscar no app">
        <div className="br-campo">
          <MagnifyingGlass size={20} aria-hidden="true" />
          <input ref={inputRef} type="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={aoTeclar}
            placeholder="Buscar tela ou o que fazer…" aria-label="Buscar tela ou o que você quer fazer" autoComplete="off"
            role="combobox" aria-expanded="true" aria-controls="br-lista" aria-activedescendant={lista[sel] ? `br-i-${sel}` : undefined} />
          <button type="button" className="br-fechar" onClick={() => setAberta(false)} aria-label="Fechar a busca"><X size={18} weight="bold" /></button>
        </div>
        <div className="br-lista" id="br-lista" role="listbox" ref={listaRef}>
          {lista.length === 0 && <p className="br-nada">Nada encontrado pra “{q}”</p>}
          {lista.map((i, k) => {
            const cab = i.g !== grupo ? (grupo = i.g) : null;
            return (
              <div key={`${i.g}-${i.t}`}>
                {cab && !q && <p className="br-g">{cab}</p>}
                <button type="button" id={`br-i-${k}`} data-i={k} role="option" aria-selected={k === sel}
                  className={`br-it${k === sel ? " on" : ""}`} onMouseMove={() => setSel(k)} onClick={() => abrir(i)}>
                  <i.ic size={20} aria-hidden="true" />
                  <span className="br-it-t">{i.t}</span>
                  {q && <span className="br-it-g">{i.g}</span>}
                  {atual(i) && <em className="br-atual">atual</em>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="br-pe" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navegar</span><span><kbd>↵</kbd> Abrir</span><span><kbd>esc</kbd> Fechar</span>
        </div>
      </div>
    </div>
  );
}
