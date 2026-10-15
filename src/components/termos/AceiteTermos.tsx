import { useState } from 'react'
import { Check, CreditCard, ShieldCheck, Storefront } from '@phosphor-icons/react'
import { Botao, avisar } from '@/components/base'
import TermosModal from '@/components/TermosModal'
import { supabase } from '@/lib/supabase'
import { explicarErro } from '@/lib/erros'
import { TERMOS_VERSAO } from '@/lib/termos'
import { Mascote } from '@/components/marca/Mascote'
import './termos.css'

/**
 * Aceite dos termos (4.26) · aparece depois de criar a conta (e-mail ou Google) e, pra quem já tinha conta,
 * uma vez na próxima entrada. O banco guarda a data (do servidor) e a versão aceita. Mudou a versão
 * (src/lib/termos.ts), a tela volta pra pedir o aceite de novo.
 */
export function AceiteTermos({ userId, aoAceitar }: { userId: string; aoAceitar: () => void }) {
  const [marcado, setMarcado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [doc, setDoc] = useState<null | 'termos' | 'privacidade'>(null)

  const aceitar = async () => {
    if (!marcado) { avisar('Marque que você leu e concorda pra continuar.', { tipo: 'erro' }); return }
    setSalvando(true)
    const r = await supabase.rpc('aceitar_termos', { p_versao: TERMOS_VERSAO })
    const semFuncao = !!r.error && (r.error.code === 'PGRST202' || r.error.code === '42883' || /could not find the function/i.test(String(r.error.message || '')))
    if (r.error && !semFuncao) {
      setSalvando(false)
      avisar(explicarErro(r.error, 'Não deu pra registrar o aceite. Tente de novo.'), { tipo: 'erro' })
      return
    }
    try { localStorage.setItem(`doonly_termos_${userId}`, TERMOS_VERSAO) } catch { /* sem storage */ }
    setSalvando(false)
    aoAceitar()
  }

  return (
    <div className="tm-root" role="dialog" aria-modal="true" aria-labelledby="tm-titulo">
      <div className="tm-corpo">
        {/* (15/10) sem a etiqueta "Último passo" (depois ainda vêm a conta ativa e a apresentação); mascote só no celular */}
        <Mascote pose="acenando" className="tm-masc" />
        <h1 id="tm-titulo">Tudo combinado antes de começar</h1>
        <p className="tm-sub">As regras do Doonly em poucas palavras: sua loja, os pedidos e os seus dados.</p>
        <div className="tm-cards">
          <div className="tm-card"><Storefront size={22} aria-hidden="true" /><span><b>Sua loja, suas regras</b><small>Você define produtos, preços e entregas. O Doonly organiza.</small></span></div>
          <div className="tm-card"><CreditCard size={22} aria-hidden="true" /><span><b>Pedidos e pagamentos</b><small>Os pedidos chegam pelo cardápio. O dinheiro das vendas vai direto pra você.</small></span></div>
          <div className="tm-card"><ShieldCheck size={22} aria-hidden="true" /><span><b>Seus dados protegidos</b><small>Os seus dados e os dos seus clientes ficam seguros e não são vendidos.</small></span></div>
        </div>
      </div>
      <div className="tm-base">
        <label className="tm-chk">
          <input type="checkbox" checked={marcado} onChange={e => setMarcado(e.target.checked)} />
          <span className="tm-box" aria-hidden="true">{marcado && <Check size={16} weight="bold" />}</span>
          <span>Li e concordo com os Termos de uso e a Política de privacidade do Doonly</span>
        </label>
        <div className="tm-links">
          <button type="button" onClick={() => setDoc('termos')}>Ler os termos</button>
          <button type="button" onClick={() => setDoc('privacidade')}>Ler a privacidade</button>
        </div>
        <Botao cheio carregando={salvando} aria-disabled={!marcado} className={marcado ? '' : 'tm-bt-off'} onClick={aceitar}>Aceitar e continuar</Botao>
        <p className="tm-nota">Se os termos mudarem, pedimos o seu aceite de novo.</p>
      </div>
      <TermosModal open={!!doc} initialTab={doc || 'termos'} onClose={() => setDoc(null)} paginaNoComputador />
    </div>
  )
}
