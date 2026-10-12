import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { avisar } from '@/components/base'
import { explicarErro } from '@/lib/erros'
import './loja.css'

/**
 * Pausar pedidos (4.27) · abre e fecha a loja na hora, sem mexer no horário.
 * Pausada: o cardápio mostra "Pedidos pausados no momento" e não deixa enviar pedido (o banco também barra).
 */
export function PausarPedidos({ compacto = false, escuro = false }: { compacto?: boolean; escuro?: boolean }) {
  const { profile, refetch } = useProfile()
  const [salvando, setSalvando] = useState(false)
  const [local, setLocal] = useState<boolean | null>(null)
  if (!profile?.id) return null
  const pausada = local ?? ((profile as any).loja_pausada === true)

  const alternar = async () => {
    if (salvando) return
    const novo = !pausada
    setSalvando(true); setLocal(novo)
    const { error } = await supabase.from('profiles').update({ loja_pausada: novo }).eq('id', profile.id)
    setSalvando(false)
    if (error) {
      setLocal(null)
      const semColuna = /loja_pausada/i.test(String(error.message || '')) || error.code === 'PGRST204' || error.code === '42703'
      avisar(semColuna ? 'Falta um ajuste no banco pra pausar os pedidos (SQL 4.27).' : explicarErro(error, 'Não deu pra mudar agora. Tente de novo.'), { tipo: 'erro' })
      return
    }
    await refetch()
    setLocal(null)
    avisar(novo ? 'Pedidos pausados. O cardápio avisa os clientes.' : 'Loja aberta. O cardápio voltou a receber pedidos.', { tipo: 'ok' })
  }

  return (
    <div className={`lj-pausa${pausada ? ' pausada' : ''}${compacto ? ' compacto' : ''}${escuro ? ' escuro' : ''}`}>
      <span className="lj-pausa-luz" aria-hidden="true" />
      <span className="lj-pausa-tx">
        <b>{escuro ? (pausada ? 'Loja pausada' : 'Loja aberta') : pausada ? 'Pedidos pausados' : 'Recebendo pedidos'}</b>
        <small>{escuro ? (pausada ? 'Sem pedidos pelo cardápio' : 'Recebendo pedidos') : pausada ? 'O cardápio mostra a loja fechada e não aceita pedidos.' : 'Pause num dia de folga ou com a agenda cheia.'}</small>
      </span>
      <button type="button" role="switch" aria-checked={!pausada} aria-label={pausada ? 'Abrir a loja' : 'Pausar os pedidos'}
        className="lj-chave" disabled={salvando} onClick={alternar}><span /></button>
    </div>
  )
}
