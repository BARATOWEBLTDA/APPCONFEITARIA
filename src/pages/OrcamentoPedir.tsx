/**
 * (24/10) Página pública "Pedir orçamento" (/o/:codigo): a cliente conta a ideia, sem escolher produto nem ver preço.
 * Vai para a confeiteira pela função orcamento_solicitar (ela recebe o aviso no celular).
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Camera, Check, Clock, X } from '@phosphor-icons/react'
import CampoData from '@/components/CampoData'
import HorarioSheet from '@/components/HorarioSheet'
import TopoLojaOrcamento from '@/components/TopoLojaOrcamento'
import { Campo, CampoArea, avisar } from '@/components/base'
import { supabase } from '@/lib/supabase'
import { explicarErro } from '@/lib/erros'
import { mascaraTelefone } from '@/lib/telefone'
import { hojeISO, reduzirFotoOrcamento } from '@/lib/orcamentos'
import './orcamentos.css'

type Loja = { id: string; codigo: string; nome: string; logo?: string | null; aceita: boolean }
const lerReais = (s: string) => { const d = s.replace(/\D/g, ''); return d ? parseInt(d, 10) / 100 : 0 }

/** O que a função do banco devolve */
type RespostaRpc = { ok?: boolean; erro?: string } | null

export default function OrcamentoPedir() {
  const { codigo } = useParams()
  const [loja, setLoja] = useState<Loja | null | undefined>(undefined)
  const [ocasiao, setOcasiao] = useState('')
  const [descricao, setDescricao] = useState('')
  const [pessoas, setPessoas] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [horaAberta, setHoraAberta] = useState(false)
  const [local, setLocal] = useState('')
  const [orcamento, setOrcamento] = useState(0)
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [carregandoFoto, setCarregandoFoto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    document.title = 'Pedir orçamento'
    supabase.rpc('orcamento_loja', { p_codigo: codigo }).then(({ data: d, error }) => setLoja(error ? null : ((d as Loja) || null)))
  }, [codigo])

  const addFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arqs = Array.from(e.target.files || []).slice(0, 3 - fotos.length)
    e.target.value = ''
    if (!arqs.length) return
    setCarregandoFoto(true)
    try {
      const novas: string[] = []
      for (const f of arqs) { if (!f.type || f.type.startsWith('image/')) novas.push(await reduzirFotoOrcamento(f)) }
      setFotos(x => [...x, ...novas].slice(0, 3))
    } catch { avisar('Não deu para usar essa foto. Tente outra.', { tipo: 'erro' }) }
    setCarregandoFoto(false)
  }

  const erroNome = tentou && !nome.trim() ? 'Falta o seu nome' : undefined
  const erroTel = tentou && tel.replace(/\D/g, '').length < 10 ? 'Coloque o WhatsApp com DDD' : undefined
  const erroDesc = tentou && !descricao.trim() ? 'Conte um pouco da sua ideia' : undefined

  const enviar = async () => {
    setTentou(true)
    if (!nome.trim() || tel.replace(/\D/g, '').length < 10 || !descricao.trim() || !loja) return
    setEnviando(true)
    try {
      const { data: r, error } = await supabase.rpc('orcamento_solicitar', {
        p_loja: loja.id,
        p_dados: { nome: nome.trim(), telefone: tel, ocasiao: ocasiao.trim() || null, descricao: descricao.trim(), pessoas: pessoas || null, data: data || null, horario: hora || null, local: local.trim() || null, orcamento: orcamento || null, fotos },
      })
      if (error) throw error
      if (!(r as RespostaRpc)?.ok) { avisar((r as RespostaRpc)?.erro || 'Não deu para enviar. Tente de novo.', { tipo: 'erro' }); return }
      setEnviado(true); window.scrollTo({ top: 0 })
    } catch (e) { avisar(explicarErro(e, 'Não deu para enviar. Confira a internet e tente de novo.'), { tipo: 'erro' }) }
    finally { setEnviando(false) }
  }

  // (6.82) o topo com a foto e o nome da loja; tocando, abre os dados da loja (igual ao cardápio)
  const topo = loja ? <TopoLojaOrcamento nome={loja.nome} logo={loja.logo} codigo={loja.codigo} /> : null

  if (loja === undefined) return <div className="orp"><div className="orc-carregando"><span className="ui-gira" aria-label="Carregando" /></div></div>
  if (!loja || !loja.aceita) return (
    <div className="orp"><div className="orp-box">
      {topo}
      <section className="orp-card orp-fim">
        <h1>{loja ? 'Esta loja não está recebendo orçamentos pelo link agora' : 'Link não encontrado'}</h1>
        <p>{loja ? 'Você ainda pode ver o cardápio e fazer o seu pedido.' : 'Confira o link com a confeitaria.'}</p>
        {loja && <a className="orp-bt" href={`/c/${loja.codigo}/cardapio`}>Ver o cardápio</a>}
      </section>
    </div></div>
  )

  // (6.82) enviado: só o aviso, no meio da tela (sem o "Ver o cardápio")
  if (enviado) return (
    <div className="orp orp--fim"><div className="orp-box">
      {topo}
      <section className="orp-fim orp-fim--solto">
        <span className="orp-ok" aria-hidden="true"><Check size={34} weight="bold" /></span>
        <h1>Pedido de orçamento enviado!</h1>
        <p>A {loja.nome} recebeu a sua ideia e vai te responder com o orçamento pelo WhatsApp.</p>
      </section>
    </div></div>
  )

  return (
    <div className="orp"><div className="orp-box">
      {topo}
      <section className="orp-card">
        <h1>Conte a sua ideia</h1>
        <p className="orp-sub">A {loja.nome} monta o orçamento e te responde pelo WhatsApp.</p>

        <div className="orp-campos">
          <Campo rotulo="Qual a ocasião?" value={ocasiao} maxLength={80} placeholder="Ex.: aniversário de 1 ano da Laura" onChange={e => setOcasiao(e.target.value)} />
          <CampoArea rotulo="Como você imagina?" rows={3} value={descricao} erro={erroDesc} maxLength={1500}
            placeholder="Ex.: bolo de 2 andares, tema jardim, e 100 docinhos" onChange={e => setDescricao(e.target.value)} />
          <div className="orp-2">
            <div className="ui-campo">
              <span className="ui-campo-r"><span>Data</span></span>
              <CampoData valor={data} onChange={setData} titulo="Data da festa" min={hojeISO()} placeholder="Escolher" curto />
            </div>
            <div className="ui-campo">
              <span className="ui-campo-r"><span>Horário</span></span>
              <button type="button" className="cdata" onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); setHoraAberta(true) }} aria-label={`Horário: ${hora || 'escolher'}`}>
                <Clock size={20} weight="bold" aria-hidden="true" /><span className={hora ? '' : 'ph'}>{hora || '--:--'}</span>
              </button>
            </div>
          </div>
          <div className="orp-2">
            <Campo rotulo="Pessoas" inputMode="numeric" autoComplete="off" value={pessoas} placeholder="Ex.: 40" onChange={e => setPessoas(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            <Campo rotulo="Quer gastar até" prefixo="R$" inputMode="numeric" autoComplete="off" placeholder="0,00"
              value={orcamento > 0 ? orcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''} onChange={e => setOrcamento(lerReais(e.target.value))} />
          </div>
          <Campo rotulo="Onde vai ser?" value={local} maxLength={200} autoComplete="off" placeholder="Ex.: salão de festas, bairro Água Verde" onChange={e => setLocal(e.target.value)} />

          <div>
            <p className="orp-rot">Fotos de referência</p>
            <div className="orp-fotos">
              {fotos.map((f, k) => (
                <span key={k} className="orp-foto"><img src={f} alt={`Foto ${k + 1}`} /><button type="button" aria-label={`Tirar a foto ${k + 1}`} onClick={() => setFotos(x => x.filter((_, j) => j !== k))}><X size={14} weight="bold" /></button></span>
              ))}
              {fotos.length < 3 && (
                <label className="orp-foto-add">{carregandoFoto ? <span className="ui-gira" /> : <Camera size={22} weight="bold" />}<small>{fotos.length ? 'Mais uma' : 'Enviar foto'}</small>
                  <input type="file" accept="image/*" multiple hidden onChange={addFoto} /></label>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="orp-card">
        <h2>Seus dados</h2>
        <div className="orp-campos">
          <Campo rotulo="Nome" value={nome} autoComplete="name" placeholder="Como você se chama?" erro={erroNome} onChange={e => setNome(e.target.value)} />
          <Campo rotulo="WhatsApp" value={tel} inputMode="tel" autoComplete="tel" placeholder="(41) 9 9999-0000" erro={erroTel} onChange={e => setTel(mascaraTelefone(e.target.value))} />
        </div>
      </section>

      {horaAberta && <HorarioSheet titulo="Horário da festa" value={hora} onChange={setHora} aoLimpar={hora ? () => setHora('') : undefined} onClose={() => setHoraAberta(false)} />}
      <div className="orp-pe"><button type="button" className="orp-bt" disabled={enviando} onClick={() => void enviar()}>{enviando ? 'Enviando…' : 'Pedir orçamento'}</button></div>
    </div></div>
  )
}
