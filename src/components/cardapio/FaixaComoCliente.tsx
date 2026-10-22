import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * (22/10) B11 · celular: "Ver cardápio" abre o cardápio de verdade (antes era uma moldura de celular dentro do celular,
 * que ficava em branco enquanto carregava). Esta faixa avisa que é a visão do cliente e leva de volta pro app.
 * Liga com ?comocliente=1 e vale enquanto a confeiteira estiver no cardápio (guardado nesta aba).
 */
const CHAVE = 'doonly_como_cliente'

export default function FaixaComoCliente() {
  const location = useLocation()
  const navigate = useNavigate()
  const [ligada, setLigada] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get('comocliente') === '1') { sessionStorage.setItem(CHAVE, '1'); return true }
      return sessionStorage.getItem(CHAVE) === '1'
    } catch { return false }
  })
  useEffect(() => {
    if (new URLSearchParams(location.search).get('comocliente') === '1') { try { sessionStorage.setItem(CHAVE, '1') } catch { /* sem armazenamento */ } setLigada(true) }
  }, [location.search])
  useEffect(() => {
    document.documentElement.classList.toggle('cp-como-cliente', ligada)
    return () => document.documentElement.classList.remove('cp-como-cliente')
  }, [ligada])
  if (!ligada) return null
  const voltar = () => {
    try { sessionStorage.removeItem(CHAVE) } catch { /* sem armazenamento */ }
    setLigada(false)
    if (((window.history.state as any)?.idx ?? 0) > 0) navigate(-1)
    else navigate('/inicio')
  }
  return (
    <div className="cp-cc" role="region" aria-label="Visão do cliente">
      <span>Você está vendo como cliente</span>
      <button type="button" onClick={voltar}>Voltar ao app</button>
      <style>{`
        .cp-cc { position: fixed; top: 0; left: 0; right: 0; z-index: 10050; display: flex; align-items: center; gap: 10px; height: calc(48px + env(safe-area-inset-top, 0px)); padding: env(safe-area-inset-top, 0px) 8px 0 14px; box-sizing: border-box; background: #2A1520; color: #fff; font-family: var(--font-base, system-ui); font-size: 13.5px; font-weight: 500; }
        .cp-cc span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cp-cc button { flex: none; height: 34px; padding: 0 14px; border: 0; border-radius: 999px; background: #fff; color: #2A1520; font-family: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; }
        html.cp-como-cliente body { padding-top: calc(48px + env(safe-area-inset-top, 0px)); }
        html.cp-como-cliente .cp-topo, html.cp-como-cliente .ic-presa { top: calc(48px + env(safe-area-inset-top, 0px)); }
      `}</style>
    </div>
  )
}
