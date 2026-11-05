// ── CartaoAcaoDoo.tsx ────────────────────────────────────────────────────────
// (6.86) Cartão de conferência das ações da Doo (cliente, produto, orçamento, loja, cupom):
// mostra o que ela entendeu, a confeiteira confirma e só então o app salva. Depois, "Abrir" leva à tela.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, X } from '@phosphor-icons/react'
import { executarAcaoDoo, resumoAcaoDoo, type AcaoDoo } from '@/lib/acoesDoo'

export default function CartaoAcaoDoo({ uid, acao, estado, feito, abrir, onFeito, aoAbrir }: {
  uid: string; acao: AcaoDoo; estado: 'pendente' | 'salvo' | 'cancelado'; feito?: string; abrir?: string
  onFeito: (estado: 'salvo' | 'cancelado', info?: { feito: string; abrir?: string }) => void
  aoAbrir?: () => void
}) {
  const navigate = useNavigate()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const { titulo, linhas } = resumoAcaoDoo(acao)

  const confirmar = async () => {
    setSalvando(true); setErro('')
    const r = await executarAcaoDoo(uid, acao)
    setSalvando(false)
    if (r.ok === false) { setErro(r.erro); return }
    onFeito('salvo', { feito: r.feito, abrir: r.abrir })
  }

  return (
    <div className={`dz-ac dz-ac--${estado}`}>
      <p className="dz-ac-t">{titulo}</p>
      <dl className="dz-ac-l">
        {linhas.map(([r, v]) => <div key={r}><dt>{r}</dt><dd>{v}</dd></div>)}
      </dl>
      {estado === 'pendente' && <>
        {erro && <p className="dz-ac-erro">{erro}</p>}
        <div className="dz-ac-bts">
          <button type="button" className="dz-ac-nao" disabled={salvando} onClick={() => onFeito('cancelado')}><X size={16} weight="bold" />Cancelar</button>
          <button type="button" className="dz-ac-sim" disabled={salvando} onClick={() => void confirmar()}>{salvando ? 'Salvando…' : <><Check size={16} weight="bold" />Confirmar</>}</button>
        </div>
      </>}
      {estado === 'salvo' && (
        <div className="dz-ac-ok">
          <span><Check size={16} weight="bold" />{feito || 'Feito'}</span>
          {abrir && <button type="button" onClick={() => { aoAbrir?.(); navigate(abrir) }}>Abrir<ArrowRight size={14} weight="bold" /></button>}
        </div>
      )}
      {estado === 'cancelado' && <p className="dz-ac-can">Cancelado</p>}
    </div>
  )
}
