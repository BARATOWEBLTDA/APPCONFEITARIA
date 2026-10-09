/* Perfil da cliente (08/10 · 3.31): dados, endereços e sair. Os pedidos ficam só na aba Pedidos. */
import { useEffect, useState } from 'react'
import { MapPin, Plus, SignOut, Trash } from '@phosphor-icons/react'
import { Campo, Janela, avisar, confirmar } from '@/components/base'
import { JanelaEntrar, SemConta, guardarCliente, lerCliente, mascaraTel, type Cliente } from './contaCliente'

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

  const tirar = async (i: number) => {
    const e = enderecos[i]
    const ok = await confirmar({ titulo: 'Tirar esse endereço?', texto: `${e.rua}, ${e.numero}`, rotulo: 'Tirar', perigo: true })
    if (ok) salvarLista(enderecos.filter((_, j) => j !== i))
  }

  const sair = async () => {
    const ok = await confirmar({ titulo: 'Sair da conta?', texto: 'Seus pedidos continuam salvos. É só entrar de novo com o WhatsApp.', rotulo: 'Sair', icone: 'alerta' })
    if (!ok) return
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
            </div>

            <h3 className="cc-sec">Endereços de entrega</h3>
            {enderecos.length === 0 && <p className="cc-nada">Nenhum endereço salvo. Os endereços dos seus pedidos com entrega aparecem aqui.</p>}
            {enderecos.map((e, i) => (
              <div key={i} className="cc-end">
                <MapPin size={22} weight="bold" />
                <span><b>{e.rua}{e.numero ? `, ${e.numero}` : ''}</b><small>{[e.complemento, e.bairro, e.cidade].filter(Boolean).join(' · ')}</small></span>
                <button type="button" className="cc-bt-ic" aria-label={`Tirar o endereço ${e.rua}, ${e.numero}`} onClick={() => tirar(i)}><Trash size={20} weight="bold" /></button>
              </div>
            ))}
            {enderecos.length < 5 && (
              <button type="button" className="cc-add" style={{ color: accent }} onClick={() => { setNovo(VAZIO); setFalta(false); setNovoAberto(true) }}>
                <Plus size={20} weight="bold" />Adicionar endereço
              </button>
            )}

            <button type="button" className="cc-sair" onClick={sair}><SignOut size={20} weight="bold" />Sair da conta</button>
          </>
        )}
      </div>

      <JanelaEntrar aberta={entrar} aoFechar={() => setEntrar(false)} loja={confeteiraUserId} cor={accent} aoEntrar={setCliente} />

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
