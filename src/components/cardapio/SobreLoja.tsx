import { useEffect, useState } from 'react'
import { MapPin, Package, Moped } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { Janela } from '@/components/base'
import { linkWhatsApp } from '@/lib/telefone'
import { expediente, horaTexto, situacaoDaLoja } from '@/lib/agendaCardapio'
import { formatCurrency } from '@/utils/helpers'
import { getEnderecoData } from '@/components/cardapio/CardapioModelo1'
import { linkInstagram, linkFacebook, arrobaInstagram, nomeFacebook } from '@/lib/redesSociais'
import type { Configuracoes, DesignSettings } from '@/types/database'
import './sobreLoja.css'

/**
 * Sobre a loja (4.25) · janela com 3 abas, no celular e no computador:
 *   Sobre (descrição, redes sociais, WhatsApp, endereço) · Horário (a semana) · Pagamento (formas e como receber).
 * Instagram e Facebook só aparecem quando a loja preencheu em Dados da loja.
 */

type Aba = 'sobre' | 'horario' | 'pagamento'

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const PAGAMENTO: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Cartão de crédito', debito: 'Cartão de débito' }

function semana(horario: any): { dia: string; texto: string; hoje: boolean }[] {
  const agora = new Date()
  const hojeIdx = (agora.getDay() + 6) % 7 // segunda = 0
  return DIAS.map((dia, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + (i - hojeIdx))
    const ex = expediente(d, horario)
    return { dia, texto: ex ? `${horaTexto(ex.abre)} às ${horaTexto(ex.fecha % (24 * 60))}` : 'Fechado', hoje: i === hojeIdx }
  })
}

const IconeInstagram = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)
const IconeFacebook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z" />
  </svg>
)

export function SobreLoja({ aberta, fechar, design, config, abaInicial = 'sobre' }: {
  aberta: boolean; fechar: () => void; design: DesignSettings; config: Configuracoes | null; abaInicial?: Aba
}) {
  const [aba, setAba] = useState<Aba>(abaInicial)
  useEffect(() => { if (aberta) setAba(abaInicial) }, [aberta, abaInicial])

  const cfg: any = config || {}
  const cor = design.cor_navbar || design.cor_borda || '#BF6B84' // (14/10) mesma cor do topo do cardápio
  const end = getEnderecoData(config)
  const zap = linkWhatsApp(config?.telefone)
  const insta = linkInstagram(cfg.instagram), face = linkFacebook(cfg.facebook)
  const status = situacaoDaLoja(cfg.horario)
  const dias = cfg.horario ? semana(cfg.horario) : []

  const pagamentos = ((cfg.formas_pagamento as string[]) || []).filter(k => PAGAMENTO[k])
  const formas: string[] = cfg.formas_entrega || []
  const retira = formas.includes('retirada')
  const entregaPropria = formas.includes('entrega_propria')
  const entregaOutra = formas.some(f => f === 'motoboy' || f === 'uber_flash' || f === 'combinar')
  const taxa = (cfg.entrega_por_bairro || []).length > 0 ? 'Taxa conforme o bairro'
    : Number(cfg.valor_entrega_propria) > 0 ? `Taxa de ${formatCurrency(Number(cfg.valor_entrega_propria))}` : 'Entrega grátis'

  return (
    <Janela aberta={aberta} aoFechar={fechar} tipo="conteudo" titulo={design.nome_loja || 'Sobre a loja'} umaAcao={!!zap}
      acoes={zap ? <a className="cp-zap" href={zap} target="_blank" rel="noopener noreferrer"><IconeWhatsApp size={20} />Chamar no WhatsApp</a> : undefined}>
      <div className="sl" style={{ ['--sl-cor' as any]: cor }}>
        <div className="sl-abas" role="tablist">
          {([['sobre', 'Sobre'], ['horario', 'Horário'], ['pagamento', 'Pagamento']] as const).map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}>{t}</button>
          ))}
        </div>

        {/* (14/10) as 3 abas ficam empilhadas: a janela tem o tamanho da maior e não muda ao trocar */}
        <div className="sl-paineis">
        {(
          <div className={`sl-corpo${aba === 'sobre' ? '' : ' sl-oculto'}`} role="tabpanel" aria-hidden={aba !== 'sobre'}>
            {(design.logo_url || design.descricao_loja) && (
              <div className="sl-apres">
                {design.logo_url && <img src={design.logo_url} alt="" />}
                {design.descricao_loja && <p>{design.descricao_loja}</p>}
              </div>
            )}
            {(insta || face) && (
              <div className="sl-redes">
                {insta && <a href={insta} target="_blank" rel="noopener noreferrer"><IconeInstagram />{arrobaInstagram(cfg.instagram)}</a>}
                {face && <a href={face} target="_blank" rel="noopener noreferrer"><IconeFacebook />{nomeFacebook(cfg.facebook)}</a>}
              </div>
            )}
            {end && (
              <div className="sl-bloco">
                <h3>Endereço</h3>
                <p className="sl-end"><MapPin size={18} aria-hidden="true" />{(() => {
                  // (14/10) o CEP vai numa linha só dele
                  const m = end.completo.match(/^(.*?),\s*(\d{5}-?\d{3})\s*$/);
                  return m ? <span>{m[1]}<small className="sl-cep">CEP {m[2]}</small></span> : end.completo;
                })()}</p>
                <div className="sl-mapa">
                  {/* (14/10) nas cores e com o ícone de cada app, igual no celular */}
                  <a className="gmaps" href={`https://maps.google.com/?q=${encodeURIComponent(end.completo)}`} target="_blank" rel="noopener noreferrer"><img src="/google-maps.png" alt="" />Google Maps</a>
                  <a className="waze" href={`https://waze.com/ul?q=${encodeURIComponent(end.completo)}`} target="_blank" rel="noopener noreferrer"><img src="/waze.png" alt="" />Waze</a>
                </div>
              </div>
            )}
            {!design.descricao_loja && !insta && !face && !end && <p className="sl-vazio">A loja ainda não contou mais sobre ela.</p>}
          </div>
        )}

        {(
          <div className={`sl-corpo${aba === 'horario' ? '' : ' sl-oculto'}`} role="tabpanel" aria-hidden={aba !== 'horario'}>
            {cfg.loja_pausada ? <p className="sl-status"><i aria-hidden="true" />Pedidos pausados no momento</p>
              : status && <p className={`sl-status${status.aberto ? ' aberto' : ''}`}><i aria-hidden="true" />{status.aberto ? 'Aberto agora' : 'Fechado agora'}</p>}
            {dias.length > 0 ? (
              <ul className="sl-dias">
                {dias.map(d => <li key={d.dia} className={d.hoje ? 'hoje' : ''}><span>{d.dia}{d.hoje && <small>hoje</small>}</span><span>{d.texto}</span></li>)}
              </ul>
            ) : <p className="sl-vazio">A loja não informou o horário. Chame no WhatsApp pra combinar.</p>}
            {cfg.horario_retirada && <p className="sl-nota">Retirada: {cfg.horario_retirada}</p>}
          </div>
        )}

        {(
          <div className={`sl-corpo${aba === 'pagamento' ? '' : ' sl-oculto'}`} role="tabpanel" aria-hidden={aba !== 'pagamento'}>
            <div className="sl-bloco">
              <h3>Formas de pagamento</h3>
              <ul className="sl-lista sl-lista--2">{(pagamentos.length ? pagamentos : ['pix']).map(k => <li key={k}>{PAGAMENTO[k]}</li>)}</ul>
            </div>
            {(retira || entregaPropria || entregaOutra) && (
              <div className="sl-bloco">
                <h3>Como receber</h3>
                <ul className="sl-lista">
                  {retira && <li className="sl-ic"><Package size={22} weight="duotone" aria-hidden="true" /><span>Retirada na loja{cfg.endereco_retirada && cfg.mostrar_localizacao ? <small>{cfg.endereco_retirada}</small> : null}</span></li>}
                  {entregaPropria && <li className="sl-ic"><Moped size={22} weight="duotone" aria-hidden="true" /><span>Entrega<small>{taxa}</small></span></li>}
                  {!entregaPropria && entregaOutra && <li className="sl-ic"><Moped size={22} weight="duotone" aria-hidden="true" /><span>Entrega<small>Taxa combinada pelo WhatsApp</small></span></li>}
                </ul>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </Janela>
  )
}
