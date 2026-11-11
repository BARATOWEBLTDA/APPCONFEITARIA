import { BotaoFechar } from "@/components/base";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MagnifyingGlass, House, ClipboardText, Plus, CalendarBlank, Sparkle, Cake, Tag, Stack, Basket, ListChecks, Users, ShoppingBag, Palette, Storefront, ArrowSquareOut, CurrencyDollar, ArrowsDownUp, HandCoins, CalendarCheck, Receipt, ChartLineUp, Coins, CreditCard, Buildings, Newspaper, Gear, Crown, SpeakerHigh, ChatCircleText, Bug, Lightbulb, FileText, WhatsappLogo, PauseCircle, PixLogo, Clock, Truck, MapPin, Money, WarningCircle, BellRinging, Wrench, DeviceMobile, Eye, Hourglass } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Ticket, Target, Scales, Sliders } from "@phosphor-icons/react";
import { useProfile, getCardapioUrl } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { useSobreposicao } from "@/components/base/useSobreposicao";
import { abrirDooIA } from "@/components/MenuContaItens";
import { getInstallPrompt, isStandalone, promptInstall } from "@/lib/installPrompt";
import { WHATSAPP_EQUIPE } from "@/components/billing/EquipeMonta";
import "./buscaRapida.css";

/**
 * (22/10) Busca rápida, como na Dora: "Buscar tela ou o que você quer fazer".
 * Abre pelo campo do topo (computador), pelo campo do Início (celular) ou com Ctrl+K / ⌘K.
 * Setas pra navegar, Enter pra abrir, Esc pra fechar. Busca também por palavras (pix, horário, senha, cupom…).
 */
type Item = { g: string; t: string; ic: Icon; rota?: string; estado?: Record<string, unknown>; fazer?: () => void; chaves?: string; pro?: boolean };

const sem = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** (6.110) a palavra sem o plural: "notificações" e "notificação" viram "notificacao"; "mensagens" vira "mensagen"… */
const raiz = (w: string) => { const x = sem(w).replace(/oes$/, "ao").replace(/aes$/, "ao").replace(/ns$/, "m"); return x.length > 3 && x.endsWith("s") ? x.slice(0, -1) : x; };
/** Pontos do item para a busca (0 = não acha). Todas as palavras precisam achar; o nome conta mais que as palavras-chave. */
function pontos(i: Item, termos: string[]): number {
  const titulo = sem(i.t).split(/[^a-z0-9]+/).filter(Boolean).map(raiz);
  const chaves = sem(i.chaves || "").split(/[^a-z0-9]+/).filter(Boolean).map(raiz);
  let total = 0;
  for (const [k, t0] of termos.entries()) {
    const t = raiz(t0);
    if (k === 0 && titulo[0]?.startsWith(t)) total += 6;
    else if (titulo.some(w => w.startsWith(t))) total += 4;
    else if (chaves.some(w => w.startsWith(t))) total += 2;
    else if (sem(`${i.t} ${i.chaves || ""}`).includes(sem(t0))) total += 1;
    else return 0;
  }
  return total;
}

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

  // (6.110) os mesmos grupos do Menu; telas, partes de tela e ações (pix, horário, taxa, pausar, senha, sair…)
  const itens: Item[] = useMemo(() => {
    const link = profile ? getCardapioUrl(profile) : "";
    const DIA = "Dia a dia", PROD = "Produção e preço", LOJA = "Minha loja", DIN = "Dinheiro", DIV = "Divulgar", CONTA = "Conta e ajuda";
    const zap = () => window.open(`https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent("Olá! Preciso de ajuda com o Doonly.")}`, "_blank", "noopener");
    return [
      { g: DIA, t: "Início", ic: House, rota: "/inicio", chaves: "resumo dia hoje" },
      { g: DIA, t: "Pedidos", ic: ClipboardText, rota: "/pedidos", chaves: "encomendas pronta entrega quadro aceitar status cancelar" },
      { g: DIA, t: "Pedidos para aceitar", ic: Hourglass, rota: "/pedidos?filtro=aguardando", chaves: "novos aguardando aceitar pagamento" },
      { g: DIA, t: "Pedidos atrasados", ic: WarningCircle, rota: "/pedidos?filtro=atrasados", chaves: "atrasado passou hora" },
      { g: DIA, t: "Nova venda", ic: Plus, rota: "/vendas/novo", chaves: "novo pedido vender registrar venda balcao encomenda" },
      { g: DIA, t: "Agenda", ic: CalendarBlank, rota: "/agenda", chaves: "calendario entregas dia producao semana imprimir folha pdf" },
      { g: DIA, t: "Orçamentos", ic: FileText, rota: "/orcamentos", pro: true, chaves: "orcamento proposta aprovar festa casamento evento" },
      { g: DIA, t: "Clientes", ic: Users, rota: "/clientes", chaves: "cliente aniversario contatos importar historico" },
      { g: DIA, t: "Mensagens do WhatsApp", ic: ChatCircleText, rota: "/configuracoes/mensagens", chaves: "mensagem whatsapp zap whats texto pronto recado aniversario parabens" },
      { g: DIA, t: "Doo", ic: Sparkle, fazer: () => abrirDooIA(), pro: true, chaves: "assistente ia inteligencia artificial perguntar topo bolo legenda instagram calcular preco imagem arte logo" },
      { g: PROD, t: "Produtos", ic: Cake, rota: "/produtos", chaves: "produto bolo doce salgado preco foto esgotado tamanho destaque promocao" },
      { g: PROD, t: "Novo produto", ic: Plus, rota: "/produtos", estado: { abrirCadastro: true }, chaves: "cadastrar produto criar" },
      { g: PROD, t: "Categorias", ic: Tag, rota: "/categorias", chaves: "categoria ordem cardapio secao grupo" },
      { g: PROD, t: "Adicionais", ic: Stack, rota: "/complementos", pro: true, chaves: "complementos extras topo vela escrita" },
      { g: PROD, t: "Ingredientes", ic: Basket, rota: "/insumos", chaves: "insumo ingrediente materia prima compra mercado embalagem preco" },
      { g: PROD, t: "Ficha técnica", ic: ListChecks, rota: "/ficha-tecnica", chaves: "receita custo lucro margem preco sugerido rendimento" },
      { g: PROD, t: "Conversor de medidas", ic: Scales, rota: "/ferramentas/medidas", chaves: "ferramentas xicara colher gramas converter medida peso" },
      { g: PROD, t: "Simulador de preço", ic: Sliders, rota: "/ferramentas/simulador", chaves: "ferramentas simular preco lucro margem quanto cobrar calculadora" },
      { g: PROD, t: "Produtos sem ficha técnica", ic: ListChecks, rota: "/ficha-tecnica", estado: { abrir: "sem-ficha" }, chaves: "falta ficha" },
      { g: PROD, t: "Custos", ic: Receipt, rota: "/custos", chaves: "custo fixos variaveis despesa gasto aluguel luz gas" },
      { g: PROD, t: "Mão de obra", ic: Wrench, rota: "/custos", estado: { abrir: "mao" }, chaves: "salario hora jornada trabalho" },
      { g: PROD, t: "Custos invisíveis", ic: Receipt, rota: "/custos", estado: { abrir: "invisiveis" }, chaves: "gas forno perdas descartaveis porcentagem" },
      { g: PROD, t: "Cadastrar custo fixo", ic: Buildings, rota: "/custos", estado: { abrir: "fixo" }, chaves: "aluguel luz internet agua conta mensal" },
      { g: PROD, t: "Taxa da maquininha", ic: CreditCard, rota: "/custos", estado: { abrir: "maquininha" }, chaves: "cartao credito debito" },
      { g: LOJA, t: "Minha loja", ic: ShoppingBag, rota: "/cardapio", chaves: "cardapio digital link visitas compartilhar qr code divulgar" },
      { g: LOJA, t: "Pausar pedidos", ic: PauseCircle, rota: "/cardapio", chaves: "pausar fechar abrir loja fechada aberta parar ferias" },
      ...(link ? [
        { g: LOJA, t: "Ver meu cardápio", ic: ArrowSquareOut, fazer: () => window.open(link, "_blank", "noopener,noreferrer"), chaves: "abrir como cliente" },
        { g: LOJA, t: "Copiar o link do cardápio", ic: ShoppingBag, fazer: () => { void navigator.clipboard?.writeText(link); }, chaves: "link copiar compartilhar divulgar" },
      ] : []),
      { g: LOJA, t: "Ver como fica", ic: Eye, rota: "/cardapio-preview", chaves: "previa visualizar cliente" },
      { g: LOJA, t: "Aparência", ic: Palette, rota: "/cardapio-design", chaves: "logo cores cor banner capa foto topo visual" },
      { g: LOJA, t: "Métricas do cardápio", ic: ChartLineUp, rota: "/cardapio-metricas", chaves: "metricas visitas acessos quantas pessoas desempenho mais pedidos vendidos conversao estatisticas" },
      { g: LOJA, t: "Dados da loja", ic: Storefront, rota: "/cardapio-config", estado: { abrir: "loja" }, chaves: "nome descricao sobre whatsapp telefone" },
      { g: LOJA, t: "Horário de funcionamento", ic: Clock, rota: "/cardapio-config", estado: { abrir: "horario" }, chaves: "horario aberto fechado dias semana abrir fechar expediente" },
      { g: LOJA, t: "Entrega e taxa de entrega", ic: Truck, rota: "/cardapio-config", estado: { secao: "entrega" }, chaves: "taxa entrega frete delivery retirada bairro raio km mapa motoboy" },
      { g: LOJA, t: "Formas de pagamento", ic: Money, rota: "/cardapio-config", estado: { abrir: "pag" }, chaves: "pagamento dinheiro cartao credito debito troco" },
      { g: LOJA, t: "Pix pelo cardápio", ic: PixLogo, rota: "/cardapio-config", estado: { abrir: "pix" }, chaves: "pix chave sinal pagamento online qr" },
      { g: LOJA, t: "Endereço da loja", ic: MapPin, rota: "/cardapio-config", estado: { abrir: "endereco" }, chaves: "endereco cep rua cidade mapa localizacao" },
      { g: LOJA, t: "Redes sociais", ic: Storefront, rota: "/cardapio-config", estado: { abrir: "redes" }, chaves: "instagram facebook redes" },
      { g: DIN, t: "Financeiro", ic: CurrencyDollar, rota: "/financeiro", chaves: "visao geral caixa dinheiro relatorio faturamento resultado mes" },
      { g: DIN, t: "Lançar uma saída", ic: ArrowsDownUp, rota: "/financeiro", estado: { abrir: "saida" }, chaves: "despesa gasto saida paguei compra" },
      { g: DIN, t: "Lançar uma entrada", ic: ArrowsDownUp, rota: "/financeiro", estado: { abrir: "entrada" }, chaves: "entrada recebi venda avulsa" },
      { g: DIN, t: "Nova conta a pagar", ic: CalendarCheck, rota: "/financeiro", estado: { abrir: "apagar" }, chaves: "boleto vencimento conta fornecedor" },
      { g: DIN, t: "Extrato", ic: ArrowsDownUp, rota: "/financeiro/transacoes", chaves: "transacoes entradas saidas receitas despesas planilha excel exportar" },
      { g: DIN, t: "A receber", ic: HandCoins, rota: "/financeiro/a-receber", chaves: "sinal falta receber cobrar fiado devendo" },
      { g: DIN, t: "A pagar", ic: CalendarCheck, rota: "/financeiro/a-pagar", chaves: "contas boletos fornecedor vencimento despesa" },
      { g: DIN, t: "Lucro por produto", ic: ChartLineUp, rota: "/lucratividade", pro: true, chaves: "lucratividade lucro margem ponto de equilibrio relatorio produto" },
      { g: DIN, t: "Informar o saldo do caixa", ic: Coins, rota: "/financeiro", estado: { abrir: "saldo" }, chaves: "dinheiro gaveta banco" },
      { g: DIV, t: "Cupons", ic: Ticket, rota: "/cupons", pro: true, chaves: "cupom desconto promocao codigo" },
      { g: DIV, t: "Pixel", ic: Target, rota: "/pixel", pro: true, chaves: "facebook instagram meta google tiktok anuncio" },
      { g: CONTA, t: isPro ? "Minha assinatura" : "Assinar o PRO", ic: Crown, rota: isPro ? "/minha-assinatura" : "/assinar", chaves: "plano pro assinatura pagamento mensalidade cancelar testar gratis" },
      { g: CONTA, t: "Configurações", ic: Gear, rota: "/configuracoes", chaves: "conta senha email foto perfil sair atualizar versao excluir termos privacidade" },
      { g: CONTA, t: "Notificações e sons", ic: BellRinging, rota: "/configuracoes/notificacoes", chaves: "notificacao som aviso alerta push celular toque" },
      ...(!isStandalone() ? [{ g: CONTA, t: "Instalar o app", ic: DeviceMobile, fazer: () => { if (getInstallPrompt()) void promptInstall(); else navigate("/configuracoes"); }, chaves: "instalar app tela inicial atalho" }] : []),
      { g: CONTA, t: "Falar com o suporte", ic: WhatsappLogo, fazer: zap, chaves: "suporte atendimento whatsapp ajuda falar" },
      { g: CONTA, t: "Novidades", ic: Newspaper, rota: "/noticias", chaves: "dicas avisos o que mudou" },
      { g: CONTA, t: "Relatar um problema", ic: Bug, rota: "/relatar-problema", chaves: "erro bug nao funciona travou" },
      { g: CONTA, t: "Sugerir uma melhoria", ic: Lightbulb, rota: "/solicitar-recurso", chaves: "ideia sugestao pedir recurso" },
    ];
  }, [profile, isPro, navigate]);

  const lista = useMemo(() => {
    const termos = sem(q).split(/\s+/).filter(Boolean);
    if (!termos.length) return itens;
    // (6.110) não busca pelo nome do grupo ("conta" trazia o grupo inteiro) e ordena pelos pontos
    return itens.map(i => [i, pontos(i, termos)] as const).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).map(([i]) => i);
  }, [q, itens]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listaRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  // (27/10) voltar do Android e Esc fecham só a busca (antes saíam da tela ou fechavam o app)
  const caixaRef = useRef<HTMLDivElement>(null);
  useSobreposicao(aberta, () => setAberta(false), caixaRef);
  if (!aberta) return null;

  const abrir = (i: Item) => {
    const substituir = !!(window.history.state as { uiJanela?: boolean } | null)?.uiJanela; // a busca guardou uma entrada pro "voltar"
    setAberta(false);
    if (i.fazer) { i.fazer(); return; }
    if (i.rota) navigate(i.rota, { ...(i.estado ? { state: i.estado } : {}), replace: substituir });
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
      <div ref={caixaRef} tabIndex={-1} className="br" role="dialog" aria-modal="true" aria-label="Buscar no app">
        <div className="br-campo">
          <MagnifyingGlass size={20} aria-hidden="true" />
          <input ref={inputRef} type="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={aoTeclar}
            placeholder="Buscar tela ou o que fazer…" aria-label="Buscar tela ou o que você quer fazer" autoComplete="off"
            role="combobox" aria-expanded="true" aria-controls="br-lista" aria-activedescendant={lista[sel] ? `br-i-${sel}` : undefined} />
          <BotaoFechar rotulo="Fechar a busca" className="br-fechar" onClick={() => setAberta(false)} />
        </div>
        <div className="br-lista" id="br-lista" role="listbox" ref={listaRef}>
          {lista.length === 0 && <p className="br-nada">Nada encontrado para “{q}”</p>}
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
                  {i.pro && !isPro ? <em className="br-pro">PRO</em> : atual(i) && <em className="br-atual">atual</em>}
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
