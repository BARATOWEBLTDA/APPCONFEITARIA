import { useEffect, useState } from 'react'
import { PauseCircle, Storefront } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { avisar } from '@/components/base'
import { explicarErro } from '@/lib/erros'
import { useLojaPronta } from '@/lib/primeirosPassos'
import { horaTexto, situacaoDaLoja } from '@/lib/agendaCardapio'
import './loja.css'

/**
 * Pausar pedidos (4.27) · abre e fecha a loja na hora, sem mexer no horário.
 * Pausada: o cardápio mostra "Pedidos pausados no momento" e não deixa enviar pedido (o banco também barra).
 */
export function PausarPedidos({ compacto = false, escuro = false }: { compacto?: boolean; escuro?: boolean }) {
  const { profile, refetch } = useProfile()
  const [salvando, setSalvando] = useState(false)
  const [local, setLocal] = useState<boolean | null>(null)
  const pronta = useLojaPronta(profile?.id)
  // (22/10) menu do computador: a situação muda com o relógio (abre às 20:00, fecha às 21:00), confere a cada minuto
  const [, setTique] = useState(0)
  useEffect(() => {
    if (!escuro) return
    const t = window.setInterval(() => setTique(n => n + 1), 60000)
    return () => window.clearInterval(t)
  }, [escuro])
  if (!profile?.id) return null
  // (15/10) ainda não sabe se a loja está pronta (primeira vez neste aparelho): não mostra nada em vez de piscar "Recebendo pedidos"
  if (pronta === null) return null
  // (13/10) conta nova sem os primeiros passos: não diz "Loja aberta · Recebendo pedidos" com o cardápio vazio
  if (pronta === false) return (
    <div className={`lj-pausa lj-pausa--montando${compacto ? ' compacto' : ''}${escuro ? ' escuro' : ''}`}>
      <span className="lj-pausa-luz" aria-hidden="true" />
      <span className="lj-pausa-tx"><b>Loja em montagem</b><small>Termine os primeiros passos</small></span>
    </div>
  )
  const pausada = local ?? ((profile as any).loja_pausada === true)
  // (4.29) celular: o cartão inteiro em verde (aberta) ou vermelho (pausada)
  const cheio = !compacto && !escuro

  const alternar = async () => {
    if (salvando) return
    const novo = !pausada
    setSalvando(true); setLocal(novo)
    const { error } = await supabase.from('profiles').update({ loja_pausada: novo }).eq('id', profile.id)
    setSalvando(false)
    if (error) {
      setLocal(null)
      const semColuna = /loja_pausada/i.test(String(error.message || '')) || error.code === 'PGRST204' || error.code === '42703'
      avisar(semColuna ? 'Falta um ajuste no banco para pausar os pedidos (SQL 4.27).' : explicarErro(error, 'Não deu para mudar agora. Tente de novo.'), { tipo: 'erro' })
      return
    }
    await refetch()
    setLocal(null)
    avisar(novo ? 'Pedidos pausados. O cardápio avisa os clientes.' : 'Loja aberta. O cardápio voltou a receber pedidos.', { tipo: 'ok' })
  }

  // (22/10) menu do computador: 1ª linha a mesma situação do cardápio (aberta, fechada ou pausada); 2ª linha a chave de receber pedidos.
  // Antes dizia "Loja aberta" (a chave) enquanto o cardápio dizia "Fechado" (o horário): parecia contradição.
  if (escuro) {
    const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
    const s = situacaoDaLoja((profile as any).horario)
    const tom = pausada ? 'pausada' : !s || s.aberto ? 'aberta' : 'fechada'
    const linha = pausada ? 'Pedidos pausados'
      : !s ? 'Recebendo pedidos'
      : s.aberto ? `Aberta · fecha ${horaTexto(s.fecha)}`
      : !s.abre ? 'Fechada'
      : `Fechada · abre ${s.abre.dias === 0 ? horaTexto(s.abre.minutos) : s.abre.dias === 1 ? 'amanhã' : DIAS[s.abre.diaSemana]}`
    const dica = pausada ? 'O cardápio não aceita pedidos' : s && !s.aberto ? 'Fora do horário o cardápio ainda aceita encomendas' : 'O cardápio está aceitando pedidos'
    return (
      <div className={`lj-pausa escuro lj-sb${pausada ? ' pausada' : ''}`}>
        <span className="lj-sb-st" title={dica}><i className={`lj-sb-luz ${tom}`} aria-hidden="true" />{linha}</span>
        <span className="lj-sb-l2">
          <span>Receber pedidos</span>
          <button type="button" role="switch" aria-checked={!pausada} aria-label={pausada ? 'Voltar a receber pedidos' : 'Pausar os pedidos'}
            className="lj-chave" disabled={salvando} onClick={alternar}><span /></button>
        </span>
      </div>
    )
  }

  return (
    <div className={`lj-pausa${pausada ? ' pausada' : ''}${compacto ? ' compacto' : ''}${escuro ? ' escuro' : ''}${cheio ? ' cheio' : ''}`}>
      {cheio && <span className="lj-pausa-ic" aria-hidden="true">{pausada ? <PauseCircle size={24} /> : <Storefront size={24} />}</span>}
      {!cheio && <span className="lj-pausa-luz" aria-hidden="true" />}
      <span className="lj-pausa-tx">
        <b>{cheio && <span className="lj-pausa-luz" aria-hidden="true" />}{escuro ? (pausada ? 'Loja pausada' : 'Loja aberta') : pausada ? 'Pedidos pausados' : 'Recebendo pedidos'}</b>
        <small>{escuro ? (pausada ? 'Sem pedidos pelo cardápio' : 'Recebendo pedidos') : cheio ? (pausada ? 'O cardápio mostra a loja fechada. Ligue de novo para voltar a receber.' : 'Seu cardápio está aberto. Pause em um dia de folga ou com a agenda cheia.') : pausada ? 'O cardápio mostra a loja fechada e não aceita pedidos.' : 'Pause em um dia de folga ou com a agenda cheia.'}</small>
      </span>
      <button type="button" role="switch" aria-checked={!pausada} aria-label={pausada ? 'Abrir a loja' : 'Pausar os pedidos'}
        className="lj-chave" disabled={salvando} onClick={alternar}><span /></button>
    </div>
  )
}
