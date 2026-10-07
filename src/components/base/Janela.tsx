import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ArrowCounterClockwise, CheckCircle, Info, WarningCircle, X, XCircle } from '@phosphor-icons/react'
import { Botao, BotaoIcone } from './Botao'
import { Titulo } from './Titulo'
import { useFase, useSobreposicao } from './useSobreposicao'
import './base.css'

/**
 * Janela do Doonly (07/10 · guia v2, A9 e C · Janelas).
 * No celular sobe de baixo; a partir de 768px aparece no centro.
 * Fecha no X, tocando fora, no Esc e no "voltar" do Android. A tela de trás não rola.
 *
 *   tipo "aviso" (padrão): ícone no círculo, título e texto no centro, botões embaixo.
 *   tipo "conteudo": título à esquerda com o X, e o que você colocar dentro (um formulário curto).
 *
 * Pra perguntar ou avisar sem montar nada na tela, use confirmar() e informar() (no fim do arquivo).
 */
export type TomJanela = 'rosa' | 'verde' | 'laranja' | 'vermelho'

type PropsJanela = {
  aberta: boolean
  aoFechar: () => void
  titulo: string
  tipo?: 'aviso' | 'conteudo'
  /** aviso: a frase embaixo do título (a consequência) */
  texto?: ReactNode
  /** aviso: Phosphor de 32px, peso regular */
  icone?: ReactNode
  tom?: TomJanela
  children?: ReactNode
  /** os botões de baixo: um <Botao> ou dois (o da direita é o principal) */
  acoes?: ReactNode
  /** quantos botões tem embaixo (1 ocupa a largura toda) */
  umaAcao?: boolean
  /** tocar fora não fecha (use quando fechar perde o que foi digitado) */
  travada?: boolean
}

export function Janela({ aberta, aoFechar, titulo, tipo = 'aviso', texto, icone, tom = 'rosa', children, acoes, umaAcao = false, travada = false }: PropsJanela) {
  const caixa = useRef<HTMLDivElement>(null)
  const idTitulo = useId()
  const fase = useFase(aberta)
  useSobreposicao(aberta, aoFechar, caixa)
  if (!aberta && fase === 'fechada') return null
  const aviso = tipo === 'aviso'
  return createPortal(
    <div className={`ui-veu ui-veu--centro${aberta ? '' : ' ui-veu--saindo'}`} onClick={travada ? undefined : aoFechar}>
      <div
        ref={caixa} tabIndex={-1} className={`ui-janela ui-janela--${tipo}`}
        role={aviso ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={idTitulo}
        onClick={e => e.stopPropagation()}
      >
        <span className="ui-janela-alca" aria-hidden="true" />
        {aviso ? (
          <div className="ui-janela-corpo">
            {icone ? <span className={`ui-janela-ic ui-janela-ic--${tom}`} aria-hidden="true">{icone}</span> : null}
            <h2 className="ui-janela-t" id={idTitulo}>{titulo}</h2>
            {texto ? <p className="ui-janela-x">{texto}</p> : null}
            {children}
          </div>
        ) : (
          <>
            <div className="ui-janela-cab">
              <Titulo nivel="janela" id={idTitulo}>{titulo}</Titulo>
              <BotaoIcone rotulo="Fechar" variante="limpo" onClick={aoFechar}><X size={20} weight="bold" /></BotaoIcone>
            </div>
            <div className="ui-janela-corpo">{children}</div>
          </>
        )}
        {acoes ? <div className={`ui-janela-pe${umaAcao ? ' ui-janela-pe--um' : ''}`}>{acoes}</div> : <div className="ui-janela-fim" />}
      </div>
    </div>,
    document.body,
  )
}

/* ───────── confirmar() e informar(): no lugar do confirm() e do alert() do navegador ───────── */

export type IconeJanela = 'info' | 'alerta' | 'erro' | 'ok' | 'estorno'
const ICONES: Record<IconeJanela, { el: ReactNode; tom: TomJanela }> = {
  info: { el: <Info size={32} />, tom: 'rosa' },
  alerta: { el: <WarningCircle size={32} />, tom: 'laranja' },
  erro: { el: <XCircle size={32} />, tom: 'vermelho' },
  ok: { el: <CheckCircle size={32} />, tom: 'verde' },
  estorno: { el: <ArrowCounterClockwise size={32} />, tom: 'vermelho' },
}

export type OpcoesJanela = {
  /** a pergunta, com o verbo: "Excluir o pedido #214?" */
  titulo: string
  /** a consequência: "Ele some da lista, da agenda e do financeiro." */
  texto?: string
  icone?: IconeJanela
  /** o texto do botão principal, com o verbo: "Excluir" */
  rotulo?: string
  /** o texto do botão de sair sem fazer nada */
  rotuloVoltar?: string
  /** botão principal em vermelho (excluir, estornar) */
  perigo?: boolean
}

function abrir(o: OpcoesJanela, pergunta: boolean): Promise<boolean> {
  return new Promise(resolve => {
    const lugar = document.createElement('div')
    document.body.appendChild(lugar)
    const raiz = createRoot(lugar)
    let respondido = false
    function Caixa() {
      const [aberta, setAberta] = useState(true)
      const responder = (sim: boolean) => {
        if (respondido) return
        respondido = true
        setAberta(false)
        resolve(sim)
        window.setTimeout(() => { raiz.unmount(); lugar.remove() }, 320)
      }
      const ic = ICONES[o.icone || (o.perigo ? 'erro' : 'info')]
      return (
        <Janela
          aberta={aberta} aoFechar={() => responder(false)} titulo={o.titulo} texto={o.texto} icone={ic.el} tom={ic.tom} umaAcao={!pergunta}
          acoes={pergunta ? (
            <>
              <Botao variante="secundario" onClick={() => responder(false)}>{o.rotuloVoltar || 'Voltar'}</Botao>
              <Botao variante={o.perigo ? 'perigo' : 'principal'} onClick={() => responder(true)} data-foco-inicial>{o.rotulo || 'Confirmar'}</Botao>
            </>
          ) : (
            <Botao onClick={() => responder(true)} data-foco-inicial>{o.rotulo || 'Entendi'}</Botao>
          )}
        />
      )
    }
    raiz.render(<Caixa />)
  })
}

/**
 * Pergunta antes de fazer algo que não dá pra desfazer.
 *   if (!(await confirmar({ titulo: 'Excluir o pedido #214?', texto: '…', rotulo: 'Excluir', perigo: true }))) return
 */
export function confirmar(opcoes: OpcoesJanela): Promise<boolean> {
  return abrir(opcoes, true)
}

/** Avisa algo que a pessoa precisa ler antes de continuar (um botão só: "Entendi"). */
export function informar(opcoes: OpcoesJanela): Promise<void> {
  return abrir(opcoes, false).then(() => undefined)
}
