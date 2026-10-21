/* Perfil do cliente (08/10 · 3.31): dados, endereços e sair. Os pedidos ficam só na aba Pedidos. */
import { useEffect, useState } from 'react'
import { CaretRight, Clock, MapPin, PencilSimple, Plus, SignOut, Trash } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { linkWhatsApp } from '@/lib/telefone'
import { lojaAtualCheckout, lojaAtualNome, lojaAtualWhatsApp } from './lojaAtual'
import { getStatusLoja } from './CardapioModelo1'
import { Campo, Janela, avisar, confirmar } from '@/components/base'
import { JanelaEntrar, SemConta, guardarCliente, lerCliente, mascaraTel, type Cliente } from './contaCliente'
import { digitosTelefone } from '@/lib/telefone'

export type EnderecoSalvo = {
  rua: string; numero: string; complemento: string; bairro: string; cidade: string; cep: string
}

const VAZIO: EnderecoSalvo = { rua: '', numero: '', complemento: '', bairro: '', cidade: '', cep: '' }

export function PerfilTab({ accent, confeteiraUserId }: { accent: string; confeteiraUserId: string }) {
  const [cliente, setCliente] = useState<Cliente | null>(() => lerCliente(confeteiraUserId))
  const [entrar, setEntrar] = useState(false)
  const [enderecos, setEnderecos] = useState<EnderecoSalvo[]>([])
  const [novoAberto, setNovoAberto] = useState(false)
  const [novo, setNovo] = useState<EnderecoSalvo>(VAZIO)
  const [falta, setFalta] = useState(false)
  const [cepBuscando, setCepBuscando] = useState(false)
  // (21/10) editar o nome (o WhatsApp é a conta: pra trocar, sai e entra com o outro número)
  const [editando, setEditando] = useState(false)
  const [nomeNovo, setNomeNovo] = useState('')
  const salvarNome = () => {
    if (!cliente) return
    const n = nomeNovo.trim()
    if (!n) return avisar('Escreva o seu nome', { tipo: 'erro' })
    const c = { ...cliente, nome: n }
    guardarCliente(confeteiraUserId, c); setCliente(c); setEditando(false); avisar('Nome salvo', { tipo: 'ok' })
  }
  // (21/10) a loja: WhatsApp e horário (Sobre a loja)
  const loja = lojaAtualNome()
  const zapLoja = linkWhatsApp(lojaAtualWhatsApp(), 'Oi! Vim pelo cardápio.')
  const status = getStatusLoja((lojaAtualCheckout() as any)?.horario || null)

  // Os endereços ficam no aparelho, por loja e telefone (a sacola usa a mesma lista)
  const chaveEnd = (tel: string) => `enderecos_${confeteiraUserId}_${tel.replace(/\D/g, '')}`
  useEffect(() => {
    if (!cliente) { setEnderecos([]); return }
    try { const l = JSON.parse(localStorage.getItem(chaveEnd(cliente.telefone)) || '[]'); setEnderecos(Array.isArray(l) ? l : []) } catch { setEnderecos([]) }
  }, [cliente?.telefone]) // eslint-disable-line react-hooks/exhaustive-deps
  const salvarLista = (l: EnderecoSalvo[]) => {
    if (!cliente) return
    try { localStorage.setItem(chaveEnd(cliente.telefone), JSON.stringify(l)) } catch { /* sem localStorage */ }
    setEnderecos(l)
  }

  const buscarCep = async (v: string) => {
    const c = v.replace(/\D/g, '')
    if (c.length !== 8) return
    setCepBuscando(true)
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${c}/json/`)).json()
      if (!d.erro) setNovo(n => ({ ...n, rua: d.logradouro || n.rua, bairro: d.bairro || n.bairro, cidade: d.localidade || n.cidade }))
    } catch { /* segue sem o CEP */ }
    setCepBuscando(false)
  }

  const salvarNovo = () => {
    if (!novo.rua.trim() || !novo.numero.trim()) { setFalta(true); return }
    const e = { ...novo, rua: novo.rua.trim(), numero: novo.numero.trim() }
    salvarLista([e, ...enderecos.filter(x => x.rua !== e.rua || x.numero !== e.numero)].slice(0, 5))
    setNovoAberto(false); avisar('Endereço salvo', { tipo: 'ok' })
  }

  // o primeiro da lista é o principal (a finalizar já usa ele); tocar em outro passa ele pra principal
  const tornarPrincipal = (i: number) => {
    if (i === 0) return
    salvarLista([enderecos[i], ...enderecos.filter((_, j) => j !== i)])
    avisar('Endereço principal trocado', { tipo: 'ok' })
  }

  const tirar = async (i: number) => {
    const e = enderecos[i]
    const ok = await confirmar({ titulo: 'Tirar esse endereço?', texto: `${e.rua}, ${e.numero}`, rotulo: 'Tirar', perigo: true })
    if (ok) salvarLista(enderecos.filter((_, j) => j !== i))
  }

  const sair = async () => {
    const ok = await confirmar({ titulo: 'Sair da conta?', texto: 'Seus pedidos continuam salvos. É só entrar de novo com o WhatsApp.', rotulo: 'Sair', icone: 'alerta' })
    if (!ok) return
    // (11/10) os endereços salvos desse telefone também saem do aparelho (antes ficavam e apareciam pra quem digitasse o número)
    try {
      const prefixo = `enderecos_${confeteiraUserId}_`
      const meu = digitosTelefone(cliente?.telefone)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefixo) && digitosTelefone(k.slice(prefixo.length)) === meu) localStorage.removeItem(k)
      }
    } catch { /* sem localStorage */ }
    guardarCliente(confeteiraUserId, null); setCliente(null)
  }

  return (
    <div className="cc">
      <div className="cc-topo"><span><h2>Minha conta</h2></span></div>

      <div className="cc-rolo">
        {!cliente ? (
          <SemConta cor={accent} titulo="Entre na sua conta" texto="Com o seu WhatsApp, você acompanha os pedidos e salva endereços pra pedir mais rápido." aoEntrar={() => setEntrar(true)} />
        ) : (
          <>
            <div className="cc-eu">
              <span className="cc-av" style={{ background: accent }}>{(cliente.nome || '?').trim().charAt(0).toUpperCase()}</span>
              <span><b>{cliente.nome}</b><small>{mascaraTel(cliente.telefone || '')}</small></span>
              <button type="button" className="cc-editar" style={{ color: accent }} onClick={() => { setNomeNovo(cliente.nome || ''); setEditando(true) }}><PencilSimple size={16} weight="bold" />Editar</button>
            </div>

            <h3 className="cc-grupo">Endereços de entrega</h3>
            <div className="cc-cartao">
              {enderecos.length === 0 && <p className="cc-nada">Os endereços dos seus pedidos com entrega aparecem aqui.</p>}
              {enderecos.map((e, i) => (
                <div key={i} className="cc-lin">
                  <button type="button" className="cc-lin-bt" onClick={() => tornarPrincipal(i)} aria-label={i === 0 ? `${e.rua}, ${e.numero} (principal)` : `Usar ${e.rua}, ${e.numero} como principal`}>
                    <span className="cc-lin-ic" style={{ color: accent, background: `${accent}14` }}><MapPin size={20} weight="bold" /></span>
                    <span className="cc-lin-tx"><b><span className="cc-lin-nome">{e.rua}{e.numero ? `, ${e.numero}` : ''}</span></b><small>{i === 0 && <em className="cc-principal">Principal</em>}<span className="cc-lin-nome">{[e.complemento, e.bairro, e.cidade].filter(Boolean).join(' · ')}</span></small></span>
                  </button>
                  <button type="button" className="cc-bt-ic" aria-label={`Tirar o endereço ${e.rua}, ${e.numero}`} onClick={() => tirar(i)}><Trash size={20} weight="bold" /></button>
                </div>
              ))}
              {enderecos.length < 5 && (
                <button type="button" className="cc-lin cc-lin-bt cc-lin--add" onClick={() => { setNovo(VAZIO); setFalta(false); setNovoAberto(true) }}>
                  <span className="cc-lin-ic cc-lin-ic--add" style={{ color: accent, borderColor: `${accent}66` }}><Plus size={20} weight="bold" /></span>
                  <span className="cc-lin-tx"><b style={{ color: accent }}>Adicionar endereço</b><small>Até 5 endereços salvos</small></span>
                </button>
              )}
            </div>

            {(zapLoja || status) && <>
              <h3 className="cc-grupo">{loja || 'A loja'}</h3>
              <div className="cc-cartao">
                {zapLoja && (
                  <a className="cc-lin cc-lin-bt" href={zapLoja} target="_blank" rel="noreferrer">
                    <span className="cc-lin-ic cc-lin-ic--zap"><IconeWhatsApp size={20} /></span>
                    <span className="cc-lin-tx"><b>Falar com a loja</b><small>Chamar no WhatsApp</small></span>
                    <CaretRight size={18} weight="bold" className="cc-lin-seta" />
                  </a>
                )}
                <button type="button" className="cc-lin cc-lin-bt" onClick={() => window.dispatchEvent(new Event('doonly:sobre-loja'))}>
                  <span className="cc-lin-ic" style={{ color: accent, background: `${accent}14` }}><Clock size={20} weight="bold" /></span>
                  <span className="cc-lin-tx"><b>Horário e pagamento</b><small>{status?.msg || 'Dias, horários e formas de pagamento'}</small></span>
                  <CaretRight size={18} weight="bold" className="cc-lin-seta" />
                </button>
              </div>
            </>}

            <button type="button" className="cc-sair" onClick={sair}><SignOut size={20} weight="bold" />Sair da conta</button>
            <p className="cc-sair-dica">Seus pedidos continuam salvos ao sair.</p>
          </>
        )}
      </div>

      <JanelaEntrar aberta={entrar} aoFechar={() => setEntrar(false)} loja={confeteiraUserId} cor={accent} aoEntrar={setCliente} />

      <Janela aberta={editando} aoFechar={() => setEditando(false)} tipo="conteudo" titulo="Seus dados" umaAcao
        acoes={<button type="button" className="cc-bt" style={{ background: accent }} onClick={salvarNome}>Salvar</button>}>
        <div className="cc-form">
          <Campo rotulo="Nome" autoComplete="name" value={nomeNovo} onChange={ev => setNomeNovo(ev.target.value)} />
          <div className="cc-zap-fixo"><span>WhatsApp</span><b>{mascaraTel(cliente?.telefone || '')}</b><small>Pra usar outro número, saia e entre com ele.</small></div>
        </div>
      </Janela>

      <Janela aberta={novoAberto} aoFechar={() => setNovoAberto(false)} tipo="conteudo" titulo="Novo endereço" umaAcao
        acoes={<button type="button" className="cc-bt" style={{ background: accent }} onClick={salvarNovo}>Salvar endereço</button>}>
        <div className="cc-form">
          <div className="cc-form-2">
            <Campo rotulo="CEP" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={novo.cep}
              dica={cepBuscando ? 'Procurando…' : undefined}
              onChange={ev => { const v = ev.target.value.replace(/\D/g, '').slice(0, 8); setNovo(n => ({ ...n, cep: v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v })); buscarCep(v) }} />
            <Campo rotulo="Número" inputMode="numeric" value={novo.numero} onChange={ev => setNovo(n => ({ ...n, numero: ev.target.value }))}
              erro={falta && !novo.numero.trim() ? 'Falta o número' : undefined} />
          </div>
          <Campo rotulo="Rua" autoComplete="address-line1" value={novo.rua} onChange={ev => setNovo(n => ({ ...n, rua: ev.target.value }))}
            erro={falta && !novo.rua.trim() ? 'Falta a rua' : undefined} />
          <Campo rotulo="Complemento" opcional placeholder="Apto, bloco…" value={novo.complemento} onChange={ev => setNovo(n => ({ ...n, complemento: ev.target.value }))} />
          <div className="cc-form-2">
            <Campo rotulo="Bairro" value={novo.bairro} onChange={ev => setNovo(n => ({ ...n, bairro: ev.target.value }))} />
            <Campo rotulo="Cidade" value={novo.cidade} onChange={ev => setNovo(n => ({ ...n, cidade: ev.target.value }))} />
          </div>
        </div>
      </Janela>
    </div>
  )
}
