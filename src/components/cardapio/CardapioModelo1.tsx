import { LacoNatal } from '@/components/tema/Natal'
import { SeloVerificado } from './SeloVerificado'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Lightning, CalendarBlank, Truck, Storefront, CaretRight } from '@phosphor-icons/react'
import { DesignSettings, Configuracoes } from '@/types/database'
import { seloEntrega, horasAntecedencia, rotuloAntecedencia } from '@/lib/entregaProduto'
import { situacaoDaLoja, horaTexto } from '@/lib/agendaCardapio'
import './cardapioModelo1.css'
import { Vouchers } from './Vouchers'
import { topoEscurecido } from '@/lib/coresCardapio'

// ─────────────────────────────────────────────────────────────
// CardapioModelo1 — topo do cardápio no celular (o padrão de todas as lojas)
// 08/10 · 3.28: etiquetas de verdade (vêm do que a loja marcou), "aberto agora" com a bolinha
// piscando, endereço do jeito que ela escolheu em Dados da loja, logo maior e selo novo.
// ─────────────────────────────────────────────────────────────

interface CardapioModeloProps {
  design: DesignSettings
  config: Configuracoes | null
  verificada?: boolean
  produtos?: any[]
}

const DIAS_LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
// (24:00 aparece como "00:00" / "0h")
const curtoHora = (m: number) => `${Math.floor(m / 60) % 24}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`

type Status = { aberto: boolean; msg: string; curto: string }

// (11/10) a situação vem de UMA conta só (lib/agendaCardapio), a mesma do selo do modelo padrão e da Visão geral
export function getStatusLoja(horarioJson: any): Status | null {
  const s = situacaoDaLoja(horarioJson)
  if (!s) return null
  if (s.aberto) return { aberto: true, msg: `Aberto agora · até ${horaTexto(s.fecha)}`, curto: `Aberto · até ${curtoHora(s.fecha)}` }
  if (!s.abre) return { aberto: false, msg: 'Fechado', curto: 'Fechado' }
  const ab = s.abre.minutos
  if (s.abre.dias === 0) return { aberto: false, msg: `Fechado · abre hoje às ${horaTexto(ab)}`, curto: `Fechado · abre ${curtoHora(ab)}` }
  const label = s.abre.dias === 1 ? 'amanhã' : DIAS_LABEL[s.abre.diaSemana]
  return { aberto: false, msg: `Fechado · abre ${label} às ${horaTexto(ab)}`, curto: `Fechado · abre ${label} ${curtoHora(ab)}` }
}

/** Endereço do jeito que a loja escolheu em Dados da loja (Completo · Só a cidade · Não mostrar) */
export function getEnderecoData(config: Configuracoes | null): { linha: string; completo: string; cidade: string } | null {
  if (!config?.endereco) return null
  const c: any = config
  const modo = c.mostrar_localizacao ? 'completo' : c.mostrar_apenas_cidade ? 'cidade' : 'nada'
  if (modo === 'nada') return null
  try {
    const e = typeof config.endereco === 'string' ? JSON.parse(config.endereco) : config.endereco
    const cidadeUf = [e.cidade, e.estado].filter(Boolean).join(' - ')
    const cidade = String(e.cidade || '').trim() || cidadeUf
    if (modo === 'cidade') return cidadeUf ? { linha: cidadeUf, completo: cidadeUf, cidade } : null
    const rua = e.rua ? e.rua + (e.numero ? `, ${e.numero}` : '') + (e.complemento ? `, ${e.complemento}` : '') : '' // 13/10: + complemento
    const linha = [rua, e.bairro].filter(Boolean).join(' · ') || cidadeUf
    const completo = [rua, e.bairro, cidadeUf, e.cep].filter(Boolean).join(', ')
    return linha ? { linha, completo, cidade: cidade || linha } : null
  } catch { return null }
}

/** (20/10) Faixa com o que o cliente quer saber antes de pedir, com os dados que a loja já cadastrou:
 *  quanto custa a entrega, o menor prazo das encomendas e se tem pronta entrega. */
export function faixaDaLoja(config: Configuracoes | null, produtos: any[] = []) {
  const c: any = config || {}
  const formas: string[] = c.formas_entrega || []
  const propria = formas.includes('entrega_propria')
  const outra = formas.some(f => f === 'motoboy' || f === 'uber_flash')
  const retirada = formas.includes('retirada')
  const itens: { Ic: typeof Truck; v: string; t: string; ok?: boolean; igual?: boolean }[] = []
  // (20/10) entrega e retirada no mesmo card (sem valor nem "Grátis"); se a loja faz só uma, mostra só ela
  const entrega = propria || outra
  if (entrega && retirada) itens.push({ Ic: Truck, v: 'Entrega', t: 'e retirada', igual: true }) // as 2 linhas na mesma fonte e cor
  else if (entrega) itens.push({ Ic: Truck, v: 'Realiza', t: 'entregas' })
  else if (retirada) itens.push({ Ic: Storefront, v: 'Retirada', t: 'no local' })
  const prazos = produtos.map(p => String(p?.antecedencia || '')).filter(a => horasAntecedencia(a) > 0).sort((x, y) => horasAntecedencia(x) - horasAntecedencia(y))
  if (prazos.length) itens.push({ Ic: CalendarBlank, v: rotuloAntecedencia(prazos[0]), t: 'encomendas' })
  if (produtos.some(p => seloEntrega(p)?.tipo === 'pronta')) itens.push({ Ic: Lightning, v: 'Hoje', t: 'pronta entrega' })
  return itens
}

export function CardapioModelo1({ design, config, verificada = false, produtos = [], aoAbrirSobre }: CardapioModeloProps & { aoAbrirSobre?: () => void }) {
  const [modalEndereco, setModalEndereco] = useState(false)
  const accent = design.cor_borda || '#E85A8C' // (18/10) borda da logo
  const ehBranco = (c?: string | null) => !c || ['#fff', '#ffffff', '#fefefe', 'white', 'transparent'].includes(c.trim().toLowerCase())
  const corFaixa = topoEscurecido(!ehBranco(design.cor_navbar) ? design.cor_navbar! : (!ehBranco(design.cor_borda) ? design.cor_borda! : '#BF6B84')) // (20/10) escurecida
  const corIcone = !ehBranco(design.cor_botao) ? design.cor_botao! : '#EC4899'
  // (4.27) loja com os pedidos pausados aparece fechada, seja qual for o horário
  const status = (config as any)?.loja_pausada ? { aberto: false, msg: 'Pedidos pausados no momento', curto: 'Pedidos pausados' } : getStatusLoja(config?.horario || null)
  const endereco = getEnderecoData(config)
  const faixa = faixaDaLoja(config, produtos)

  const isColorLight = (hex: string): boolean => {
    const c = hex.replace('#', '')
    if (c.length < 6) return false
    const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
  }
  const rawCorNome = design.cor_nome || '#1f2937'
  // Sem cor escolhida pela confeiteira: escuro (o fundo é claro); cor clara some no fundo claro
  const corNome = rawCorNome && !isColorLight(rawCorNome) ? rawCorNome : '#2C1219' // (18/10) a cor do nome escolhida (clara demais vira chocolate)
  const fundo = design.cor_background && design.cor_background.toLowerCase() !== '#fef2f2' ? design.cor_background : '#F7F4F5'

  return (
    <div className="cm1-root">
      <div className={`cm1-hero${design.banner_topo_url ? ' cm1-hero--foto' : ''}`}>
        {design.banner_topo_url
          ? <div className="cm1-hero-img" style={{ backgroundImage: `url(${design.banner_topo_url})` }} />
          : <div className="cm1-hero-faixa" style={{ backgroundColor: corFaixa }}><span className="cm1-hero-pontos" /></div>}
      </div>

      <div className="cm1-content" style={{ background: fundo, ['--cm1-fundo' as any]: fundo }}>
        <div className="cm1-logo" style={{ borderColor: accent }}>
          {design.logo_url
            ? <img src={design.logo_url} alt={design.nome_loja || ''} />
            : <span style={{ background: design.cor_background || '#FCE0E9', color: accent }}>{(design.nome_loja || 'D').charAt(0).toUpperCase()}</span>}
        </div>
        {design.tema === 'natal' && design.tema_laco !== false && <LacoNatal className="cm1-enfeite" />}

        <h1 className="cm1-nome" style={{ color: corNome }}>
          {design.nome_loja || 'Minha Confeitaria'}{verificada && <SeloVerificado tamanho={22} />}
        </h1>
        {/* (20/10) embaixo do nome: "● Aberto agora · até 18:00" à esquerda e "Sobre a loja ›" à direita.
            Sem horário cadastrado, a cidade fica no lugar do status (abre o mapa). */}
        {(status || aoAbrirSobre || endereco) && (
          <div className="cm1-sl">
            {status ? (
              <span className={`cm1-sl-st${status.aberto ? ' aberto' : ''}`}>
                <i aria-hidden="true" /><b>{status.msg.split(' · ')[0]}</b>
                {/* no celular estreito, a versão curta ("abre sábado 9h") pra não cortar */}
                {status.msg.includes(' · ') && <span className="g"> · {status.msg.split(' · ').slice(1).join(' · ')}</span>}
                {status.curto.includes(' · ') && <span className="c"> · {status.curto.split(' · ').slice(1).join(' · ')}</span>}
              </span>
            ) : endereco ? (
              <button type="button" className="cm1-sl-cid" onClick={() => setModalEndereco(true)} aria-label={`Ver no mapa: ${endereco.completo}`}>
                <MapPin size={16} weight="bold" color={corIcone} aria-hidden="true" /><span>{endereco.cidade}</span>
              </button>
            ) : <span />}
            {aoAbrirSobre && <button type="button" className="cm1-sl-sobre" onClick={aoAbrirSobre} style={{ color: corIcone }}>Sobre a loja<CaretRight size={14} weight="bold" aria-hidden="true" /></button>}
          </div>
        )}
        {design.tema === 'natal' && design.tema_aviso && <p className="cm1-aviso-tema"><CalendarBlank size={16} weight="bold" aria-hidden="true" />{design.tema_aviso}</p>}
        {design.descricao_loja && <p className="cm1-descricao">{design.descricao_loja}</p>}

        {/* (20/10) faixa com entrega, prazo das encomendas e pronta entrega (antes: quadradinhos só com o nome) */}
        {/* (20/10) com cupom ativo, os cupons (vouchers) ficam no lugar da faixa */}
        {(config?.cupons_vitrine?.length || 0) > 0 ? <Vouchers cupons={config!.cupons_vitrine!} cor={corIcone} /> : faixa.length > 0 && (
          <ul className="cm1-faixa" aria-label="Como a loja atende">
            {faixa.map(({ Ic, v, t, ok, igual }) => (
              <li key={t}>
                <b className={ok ? 'ok' : undefined}><Ic size={16} weight="bold" color={ok ? '#16803C' : corIcone} aria-hidden="true" />{v}</b>
                <small className={igual ? 'igual' : undefined}>{t}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Endereço: mini mapa + Waze/Google Maps (o jeito de sempre) ── */}
      {modalEndereco && endereco && createPortal(
        <div className="cm1-mapa-veu" onClick={() => setModalEndereco(false)}>
          <div className="cm1-mapa" role="dialog" aria-modal="true" aria-label="Endereço da loja" onClick={e => e.stopPropagation()}>
            <iframe width="100%" height="200" style={{ border: 'none', display: 'block' }} title="Mapa"
              src={`https://www.google.com/maps?q=${encodeURIComponent(endereco.completo)}&output=embed`} allowFullScreen />
            <div className="cm1-mapa-corpo">
              <p className="cm1-mapa-end"><MapPin size={20} weight="bold" color={corIcone} aria-hidden="true" />{endereco.completo}</p>
              <div className="cm1-mapa-bts">
                <a className="waze" href={`https://waze.com/ul?q=${encodeURIComponent(endereco.completo)}`} target="_blank" rel="noopener noreferrer"><img src="/waze.png" alt="" />Waze</a>
                <a className="gmaps" href={`https://maps.google.com/?q=${encodeURIComponent(endereco.completo)}`} target="_blank" rel="noopener noreferrer"><img src="/google-maps.png" alt="" />Google Maps</a>
              </div>
              <button type="button" className="cm1-mapa-fechar" onClick={() => setModalEndereco(false)}>Fechar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
