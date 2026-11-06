import { useEffect, useState } from 'react'
import { CalendarX, Island, Plus } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { Botao, CaixasEscolha, Janela, avisar } from '@/components/base'
import CampoData from '@/components/CampoData'
import { explicarErro } from '@/lib/erros'
import { deIso, expediente } from '@/lib/agendaCardapio'
import {
  type DiaFechado, AVISO_PADRAO, avisarDe, ddmm, textoAviso, diaDaSemana, diaDeVolta, fechadoEm, fechadosAtivos, hojeBr, lerFechados, proximosFeriados, salvarFechados, textoPeriodo,
} from '@/lib/diasFechados'
import './ferias.css'

/**
 * (6.179) Modo férias: períodos (e feriados) em que a loja não entrega nem retira.
 * Salva na hora (cada "Marcar" e cada "Tirar"); o cardápio risca os dias e mostra o aviso, e o banco recusa pedido para eles.
 */
export function FeriasLoja({ uid }: { uid: string }) {
  const { profile, refetch } = useProfile()
  const [lista, setLista] = useState<DiaFechado[] | null>(null)
  const [janela, setJanela] = useState(false)
  const [tipo, setTipo] = useState<'ferias' | 'folga'>('ferias')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [aviso, setAviso] = useState<string>(String(AVISO_PADRAO))
  // (6.180) tocar num período abre a mesma janela para alterar
  const [editando, setEditando] = useState<DiaFechado | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const hoje = hojeBr()

  useEffect(() => {
    let vivo = true
    supabase.from('profiles').select('dias_fechados').eq('id', uid).maybeSingle().then(({ data, error }) => {
      if (!vivo) return
      setLista(error ? [] : fechadosAtivos(lerFechados((data as { dias_fechados?: unknown } | null)?.dias_fechados)))
    })
    return () => { vivo = false }
  }, [uid])

  // pedidos já marcados para os dias que fechou: avisa (não cancela nada)
  const conferirPedidos = async (f: DiaFechado) => {
    const { count } = await supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('user_id', uid)
      .gte('data_entrega', f.inicio).lt('data_entrega', diaDeVolta(f)).not('status', 'in', '(cancelado,recusado,entregue)')
    if (count && count > 0) avisar(`Atenção: você tem ${count} ${count === 1 ? 'pedido marcado' : 'pedidos marcados'} para ${f.inicio === f.fim ? 'esse dia' : 'esses dias'}. Confira na agenda.`, { tipo: 'erro' })
  }

  const gravar = async (chave: string, mudar: (l: DiaFechado[]) => DiaFechado[], ok: string, novo?: DiaFechado) => {
    if (salvando) return false
    setSalvando(chave)
    const r = await salvarFechados(uid, mudar)
    setSalvando(null)
    if (!r.ok) {
      const semColuna = /dias_fechados/i.test(String(r.erro || ''))
      avisar(semColuna ? 'Falta um ajuste no banco para marcar férias (SQL 6.179).' : explicarErro({ message: r.erro }, 'Não deu para salvar agora. Tente de novo.'), { tipo: 'erro' })
      return false
    }
    setLista(r.lista)
    void refetch()
    avisar(ok, { tipo: 'ok' })
    if (novo) void conferirPedidos(novo)
    return true
  }

  const abrirJanela = (f?: DiaFechado) => {
    setEditando(f || null)
    setTipo(f && f.inicio === f.fim ? 'folga' : 'ferias'); setInicio(f?.inicio || ''); setFim(f && f.inicio !== f.fim ? f.fim : '')
    setAviso(String(f ? avisarDe(f) : AVISO_PADRAO)); setJanela(true)
  }
  const mesmo = (a: DiaFechado, b: DiaFechado) => a.inicio === b.inicio && a.fim === b.fim
  const fimReal = tipo === 'folga' ? inicio : fim
  const erro = !inicio ? '' : tipo === 'ferias' && fim && fim < inicio ? 'O último dia precisa ser depois do primeiro.' : ''
  const podeSalvar = !!inicio && !!fimReal && !erro
  const salvarJanela = async () => {
    if (!podeSalvar) return
    const nome = editando && editando.inicio === inicio && editando.fim === fimReal ? editando.nome : tipo === 'folga' ? 'Folga' : undefined
    const novo: DiaFechado = { inicio, fim: fimReal, tipo: tipo === 'ferias' && fimReal !== inicio ? 'ferias' : 'feriado', ...(nome ? { nome } : {}), avisar: Number(aviso) }
    const ok = await gravar('janela', l => [...l.filter(x => !editando || !mesmo(x, editando)), novo],
      editando ? 'Pronto, alterado no cardápio.' : novo.inicio === novo.fim ? `Pronto, dia ${ddmm(novo.inicio)} fechado no cardápio.` : `Pronto, férias de ${textoPeriodo(novo)} no cardápio.`, novo)
    if (ok) setJanela(false)
  }
  const tirar = (f: DiaFechado) => gravar(`tirar_${f.inicio}`, l => l.filter(x => !(x.inicio === f.inicio && x.fim === f.fim)),
    f.inicio === f.fim ? `Dia ${ddmm(f.inicio)} aberto de novo.` : 'Férias tiradas. O cardápio voltou a aceitar esses dias.')
  const fecharFeriado = (data: string, nome: string) => {
    const novo: DiaFechado = { inicio: data, fim: data, tipo: 'feriado', nome, avisar: 7 }
    return gravar(`fer_${data}`, l => [...l, novo], `Pronto, dia ${ddmm(data)} fechado no cardápio.`, novo)
  }

  if (lista === null) return <div className="fl"><p className="fl-apoio">Carregando…</p></div>
  // só os feriados em dia que a loja abre (domingo fechado não precisa perguntar)
  const horario = (profile as { horario?: unknown } | null)?.horario
  const feriados = proximosFeriados(hoje, 120).filter(x => !horario || !!expediente(deIso(x.data), horario) || !!fechadoEm(x.data, lista)).slice(0, 4)
  return (
    <div className="fl">
      <p className="fl-apoio">Nesses dias o cardápio avisa que a loja está fechada e não deixa marcar entrega nem retirada. Os outros dias seguem normais.</p>
      {lista.length > 0 ? (
        <ul className="fl-lista">
          {lista.map(f => {
            const agora = f.inicio <= hoje
            const um = f.inicio === f.fim
            const Ic = um ? CalendarX : Island
            return (
              <li key={`${f.inicio}_${f.fim}`} className={agora ? 'agora' : ''}>
                <span className="fl-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span>
                <button type="button" className="fl-tx fl-tx--bt" aria-label={`Alterar ${um ? `o dia ${ddmm(f.inicio)}` : `as férias de ${textoPeriodo(f)}`}`} onClick={() => abrirJanela(f)}>
                  <b>{um ? `${f.nome || 'Fechado'} · ${ddmm(f.inicio)}` : `Férias · ${textoPeriodo(f)}`}</b>
                  <small>{agora ? `Fechada agora · volta dia ${ddmm(diaDeVolta(f))}` : textoAviso(f)}</small>
                </button>
                <Botao variante="secundario" tamanho="m" carregando={salvando === `tirar_${f.inicio}`} onClick={() => tirar(f)}>Tirar</Botao>
              </li>
            )
          })}
        </ul>
      ) : <p className="fl-vazio">Nenhum dia fechado marcado.</p>}
      <Botao variante="secundario" cheio icone={<Plus size={18} weight="bold" />} onClick={() => abrirJanela()}>Marcar férias ou folga</Botao>

      {feriados.length > 0 && (<>
        <h3 className="fl-t">Próximos feriados</h3>
        <ul className="fl-fer">
          {feriados.map(x => {
            const fechado = !!fechadoEm(x.data, lista)
            return (
              <li key={x.data}>
                <span className="fl-tx"><b>{x.nome}</b><small>{ddmm(x.data)} · {diaDaSemana(x.data)}</small></span>
                {fechado ? <em className="fl-tag">Fechado</em>
                  : <Botao variante="secundario" tamanho="m" carregando={salvando === `fer_${x.data}`} onClick={() => fecharFeriado(x.data, x.nome)}>Vou fechar</Botao>}
              </li>
            )
          })}
        </ul>
      </>)}

      <Janela aberta={janela} aoFechar={() => setJanela(false)} tipo="conteudo" titulo={editando ? "Alterar dias fechados" : "Fechar a loja"}
        acoes={<><Botao variante="secundario" onClick={() => setJanela(false)}>Cancelar</Botao><Botao disabled={!podeSalvar} carregando={salvando === 'janela'} onClick={salvarJanela}>Salvar</Botao></>}>
        <div className="fl-form">
          <CaixasEscolha rotulo="Quanto tempo" valor={tipo} onMudar={v => { setTipo(v); if (v === 'folga') setFim('') }} opcoes={[
            { v: 'ferias', t: 'Férias', sub: 'Vários dias seguidos' },
            { v: 'folga', t: 'Um dia só', sub: 'Feriado, folga ou evento' },
          ]} />
          <div className={`fl-datas${tipo === 'folga' ? ' um' : ''}`}>
            <label><span>{tipo === 'folga' ? 'Dia' : 'Primeiro dia'}</span>
              <CampoData valor={inicio} min={hoje} titulo={tipo === 'folga' ? 'Dia fechado' : 'Primeiro dia fechado'} curto onChange={d => { setInicio(d); if (fim && fim < d) setFim('') }} /></label>
            {tipo === 'ferias' && <label><span>Último dia</span>
              <CampoData valor={fim} min={inicio || hoje} titulo="Último dia fechado" curto onChange={setFim} /></label>}
          </div>
          {erro ? <p className="fl-erro">{erro}</p>
            : null}
          {!erro && inicio && fimReal ? <p className="fl-dica">{fimReal === inicio ? `Dia ${ddmm(inicio)} fechado. ` : `Fechada de ${ddmm(inicio)} a ${ddmm(fimReal)}. `}O cardápio volta a aceitar pedidos para o dia {ddmm(diaDeVolta({ inicio, fim: fimReal, tipo: 'ferias' }))}.</p> : null}
          {(!inicio || inicio > hoje) && (<>
            <span className="fl-rot" id="fl-aviso">Aviso no topo do cardápio</span>
            <CaixasEscolha rotuloId="fl-aviso" valor={aviso} onMudar={setAviso} opcoes={[
              { v: '999', t: 'Desde já', sub: 'As clientes se programam antes' },
              { v: '15', t: '15 dias antes', sub: 'Dá tempo de encomendar antes' },
              { v: '7', t: '7 dias antes', sub: 'Uma semana antes de fechar' },
              { v: '0', t: 'Só quando fechar', sub: 'Antes disso ninguém vê o aviso' },
            ]} />
          </>)}
        </div>
      </Janela>
    </div>
  )
}

/** Linha curta pro resumo (lista da Dados da loja / Minha loja) */
export function resumoFerias(bruto: unknown): string {
  const l = fechadosAtivos(lerFechados(bruto))
  if (!l.length) return 'Nenhum dia fechado'
  const f = l[0], hoje = hojeBr()
  if (f.inicio <= hoje) return f.inicio === f.fim ? 'Fechada hoje' : `De férias até ${ddmm(f.fim)}`
  return f.inicio === f.fim ? `Fechada dia ${ddmm(f.inicio)}` : `Férias de ${textoPeriodo(f)}`
}
