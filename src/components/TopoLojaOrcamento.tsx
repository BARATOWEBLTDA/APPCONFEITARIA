// ── TopoLojaOrcamento.tsx ────────────────────────────────────────────────────
// (6.82) Topo das páginas públicas de orçamento (pedir e ver a proposta): a foto e o nome da loja.
// Tocando, abre "Sobre a loja" igual ao do cardápio (WhatsApp, endereço, horário e pagamento).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { CaretRight, Storefront } from '@phosphor-icons/react'
import { SobreLoja } from '@/components/cardapio/SobreLoja'
import { getCardapioByCodigo } from '@/services/cardapio'
import type { Configuracoes, DesignSettings } from '@/types/database'

export default function TopoLojaOrcamento({ nome, logo, codigo, linha }: { nome: string; logo?: string | null; codigo?: string | null; linha?: string }) {
  const [dados, setDados] = useState<{ design: DesignSettings; config: Configuracoes | null } | null>(null)
  const [aberta, setAberta] = useState(false)
  const [carregando, setCarregando] = useState(false)

  const abrir = async () => {
    if (!codigo) return
    if (dados) { setAberta(true); return }
    setCarregando(true)
    try {
      const r = await getCardapioByCodigo(codigo.toLowerCase())
      if (r.design) { setDados({ design: r.design, config: r.config }); setAberta(true) }
    } catch { /* sem os dados: o topo continua só com o nome */ }
    setCarregando(false)
  }

  const conteudo = (<>
    {logo ? <img src={logo} alt="" /> : <span className="orp-ini"><Storefront size={22} weight="bold" /></span>}
    <span className="orp-topo-tx"><b>{nome}</b><small>{linha || 'Ver dados da loja'}</small></span>
    {codigo && (carregando ? <span className="ui-gira orp-topo-seta" aria-label="Abrindo" /> : <CaretRight size={18} weight="bold" className="orp-topo-seta" aria-hidden="true" />)}
  </>)

  return (<>
    {codigo
      ? <button type="button" className="orp-topo orp-topo--bt" onClick={() => void abrir()} aria-label={`${nome}: ver dados da loja`}>{conteudo}</button>
      : <header className="orp-topo">{conteudo}</header>}
    {dados && <SobreLoja aberta={aberta} fechar={() => setAberta(false)} design={dados.design} config={dados.config} />}
  </>)
}
