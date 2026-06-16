import { useState, useRef } from 'react'
import { DatePickerField } from '@/components/DatePickerField'
import { TimePickerField } from '@/components/TimePickerField'
import { type Pedido, ORIGENS, formatTelefone } from '@/pages/pedidoFormTypes'

type Props = {
  pedido: Pedido
  set: (field: keyof Pedido, value: any) => void
  clientes: any[]
  onNovoCliente: (nome: string) => Promise<void>
  onNext: () => void
}

export default function StepCliente({ pedido, set, clientes, onNovoCliente, onNext }: Props) {
  const [busca, setBusca] = useState(pedido.cliente_nome || '')
  const [showDrop, setShowDrop] = useState(false)
  const [showOrigem, setShowOrigem] = useState(!!pedido.origem)
  const [showEndereco, setShowEndereco] = useState(pedido.tipo_entrega === 'entrega')
  const [criando, setCriando] = useState(false)
  const [tocado, setTocado] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const clienteSelecionado = !!(pedido.cliente_id && busca === pedido.cliente_nome)
  const filtrados = busca.length >= 2
    ? clientes.filter(c => c.nome?.toLowerCase().includes(busca.toLowerCase())).slice(0, 5)
    : []

  const selecionarCliente = (c: any) => {
    let endereco: Record<string, string> = {}
    try { endereco = typeof c.endereco === 'string' ? JSON.parse(c.endereco) : (c.endereco || {}) } catch { /* ok */ }
    setBusca(c.nome)
    setShowDrop(false)
    set('cliente_id', c.id)
    set('cliente_nome', c.nome)
    set('cliente_telefone', formatTelefone(c.telefone || ''))
    set('cliente_whatsapp', formatTelefone(c.whatsapp || c.telefone || ''))
    if (endereco.rua) {
      set('endereco_cep', endereco.cep || '')
      set('endereco_rua', endereco.rua || '')
      set('endereco_numero', endereco.numero || '')
      set('endereco_complemento', endereco.complemento || '')
      set('endereco_bairro', endereco.bairro || '')
      set('endereco_cidade', endereco.cidade || '')
    }
  }

  const handleCriarCliente = async () => {
    if (!busca.trim() || criando) return
    setCriando(true)
    await onNovoCliente(busca.trim())
    setCriando(false)
    setShowDrop(false)
  }

  const canNext = !!pedido.cliente_nome && !!pedido.data_entrega

  return (
    <div className="step-root">

      {/* ── Bloco: Cliente ── */}
      <div className="pf2-card">
        <p className="pf2-card-eyebrow">Quem está pedindo?</p>

        {/* Busca de cliente */}
        <div className="pf2-field" style={{ position: 'relative' }}>
          <label className="pf2-label">
            Nome do cliente
            <span className="pf2-required">*</span>
            {clienteSelecionado && <span className="pf2-badge pf2-badge--ok">✓ Cadastrado</span>}
            {!clienteSelecionado && pedido.cliente_nome && <span className="pf2-badge pf2-badge--new">Novo</span>}
          </label>
          <input
            className={`pf2-input${tocado && !pedido.cliente_nome ? ' pf2-input--error' : ''}`}
            placeholder="Digite o nome..."
            value={busca}
            onChange={e => {
              const v = e.target.value
              setBusca(v)
              set('cliente_nome', v)
              set('cliente_id', undefined)
              setShowDrop(v.length >= 2)
            }}
            onBlur={() => { setTocado(true); setTimeout(() => setShowDrop(false), 180) }}
            onFocus={() => { if (busca.length >= 2) setShowDrop(true) }}
            autoComplete="off"
          />
          {tocado && !pedido.cliente_nome && (
            <span className="pf2-error-msg">Campo obrigatório</span>
          )}

          {showDrop && (
            <div className="pf2-dropdown" ref={dropRef} onMouseDown={e => e.preventDefault()}>
              {filtrados.map(c => (
                <button key={c.id} className="pf2-drop-item" onMouseDown={() => selecionarCliente(c)}>
                  <span className="pf2-drop-name">{c.nome}</span>
                  {(c.whatsapp || c.telefone) && (
                    <span className="pf2-drop-sub">{formatTelefone(c.whatsapp || c.telefone)}</span>
                  )}
                </button>
              ))}
              {filtrados.length === 0 && busca.length >= 2 && (
                <div className="pf2-drop-empty">Nenhum resultado</div>
              )}
              <button className="pf2-drop-new" onMouseDown={handleCriarCliente} disabled={criando}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {criando ? 'Cadastrando...' : <>Cadastrar <strong>"{busca}"</strong></>}
              </button>
            </div>
          )}
        </div>

        {/* WhatsApp */}
        <div className="pf2-field" style={{ marginTop: '0.75rem' }}>
          <label className="pf2-label">WhatsApp</label>
          <input
            className="pf2-input"
            placeholder="(41) 9 9999-0000"
            value={pedido.cliente_whatsapp}
            onChange={e => set('cliente_whatsapp', formatTelefone(e.target.value))}
            inputMode="numeric"
            maxLength={16}
          />
        </div>

        {/* Opcional: Origem */}
        <div className="pf2-optional-toggle" onClick={() => { setShowOrigem(v => !v); if (showOrigem) set('origem', '') }}>
          <div className={`pf2-check${showOrigem ? ' pf2-check--on' : ''}`}>
            {showOrigem && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span className="pf2-opt-label">Como conheceu / origem do pedido</span>
          {pedido.origem && !showOrigem && <span className="pf2-opt-badge">{pedido.origem}</span>}
        </div>
        {showOrigem && (
          <div className="pf2-optional-body">
            <select className="pf2-input" value={pedido.origem} onChange={e => set('origem', e.target.value)}>
              <option value="">Selecionar...</option>
              {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Bloco: Entrega ── */}
      <div className="pf2-card">
        <p className="pf2-card-eyebrow">Quando e como entregar?</p>

        <div className="pf2-row">
          <div className="pf2-field" style={{ flex: 2 }}>
            <DatePickerField
              label="Data de entrega"
              value={pedido.data_entrega}
              onChange={v => set('data_entrega', v)}
              required
              minDate={new Date()}
              placeholder="Selecionar data"
            />
          </div>
          <div className="pf2-field">
            <TimePickerField
              label="Horário"
              value={pedido.horario_entrega}
              onChange={v => set('horario_entrega', v)}
              placeholder="--:--"
              minuteStep={10}
            />
          </div>
        </div>

        {/* Tipo de entrega */}
        <div className="pf2-toggle-group" style={{ marginTop: '0.25rem' }}>
          {[
            { value: 'retirada', label: 'Retirada' },
            { value: 'entrega', label: 'Entrega' },
          ].map(t => (
            <button
              key={t.value}
              type="button"
              className={`pf2-toggle-btn${pedido.tipo_entrega === t.value ? ' pf2-toggle-btn--on' : ''}`}
              onClick={() => {
                set('tipo_entrega', t.value)
                if (t.value === 'entrega') setShowEndereco(true)
              }}
            >
              {t.label}
              {pedido.tipo_entrega === t.value && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 4 }}><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
          ))}
        </div>

        {/* Opcional: Endereço */}
        {pedido.tipo_entrega === 'entrega' && (
          <>
            <div className="pf2-optional-toggle" onClick={() => setShowEndereco(v => !v)} style={{ marginTop: '0.5rem' }}>
              <div className={`pf2-check${showEndereco ? ' pf2-check--on' : ''}`}>
                {showEndereco && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span className="pf2-opt-label">Endereço de entrega</span>
              {pedido.endereco_rua && !showEndereco && <span className="pf2-opt-badge">{pedido.endereco_rua}, {pedido.endereco_numero}</span>}
            </div>
            {showEndereco && (
              <div className="pf2-optional-body">
                <div className="pf2-row">
                  <div className="pf2-field">
                    <label className="pf2-label">CEP</label>
                    <input className="pf2-input" placeholder="00000-000" value={pedido.endereco_cep} onChange={e => set('endereco_cep', e.target.value)} />
                  </div>
                  <div className="pf2-field" style={{ flex: 2 }}>
                    <label className="pf2-label">Rua / Avenida</label>
                    <input className="pf2-input" placeholder="Rua..." value={pedido.endereco_rua} onChange={e => set('endereco_rua', e.target.value)} />
                  </div>
                </div>
                <div className="pf2-row">
                  <div className="pf2-field">
                    <label className="pf2-label">Número</label>
                    <input className="pf2-input" placeholder="Nº" value={pedido.endereco_numero} onChange={e => set('endereco_numero', e.target.value)} />
                  </div>
                  <div className="pf2-field" style={{ flex: 2 }}>
                    <label className="pf2-label">Complemento</label>
                    <input className="pf2-input" placeholder="Apto, bloco..." value={pedido.endereco_complemento} onChange={e => set('endereco_complemento', e.target.value)} />
                  </div>
                </div>
                <div className="pf2-row">
                  <div className="pf2-field">
                    <label className="pf2-label">Bairro</label>
                    <input className="pf2-input" value={pedido.endereco_bairro} onChange={e => set('endereco_bairro', e.target.value)} />
                  </div>
                  <div className="pf2-field">
                    <label className="pf2-label">Cidade</label>
                    <input className="pf2-input" value={pedido.endereco_cidade} onChange={e => set('endereco_cidade', e.target.value)} />
                  </div>
                </div>
                <div className="pf2-field" style={{ maxWidth: '50%' }}>
                  <label className="pf2-label">Taxa de entrega</label>
                  <input
                    className="pf2-input"
                    placeholder="R$ 0,00"
                    inputMode="numeric"
                    value={pedido.taxa_entrega > 0 ? pedido.taxa_entrega.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '')
                      set('taxa_entrega', digits ? parseInt(digits, 10) / 100 : 0)
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Rodapé ── */}
      <div className="pf2-footer">
        <button className="pf2-btn-primary" onClick={onNext} disabled={!canNext}>
          Próximo: Produtos
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        {!canNext && (
          <p className="pf2-footer-hint">
            {!pedido.cliente_nome ? 'Informe o nome do cliente' : 'Informe a data de entrega'}
          </p>
        )}
      </div>
    </div>
  )
}
