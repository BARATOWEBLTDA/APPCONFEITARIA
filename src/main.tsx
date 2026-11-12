import './lib/sessaoTemporaria' // 1º de tudo: "Lembrar de mim" desmarcado apaga a sessão ao reabrir o app
import { StrictMode } from 'react'
import { iniciarMedidaDoTeclado } from './lib/tecladoIphone'
import { iniciarAutoAtualizacao } from './lib/autoAtualizar'
import { iniciarAbertura } from './lib/abertura'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/cartoesConfig.css'
import './styles/themes.css'
import './styles/typography.css'
import './styles/pesosListas.css'
import './styles/avisosNav.css'
import { ThemeProvider } from './context/ThemeContext'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App.tsx'
import TelaDeErro from './components/sistema/TelaDeErro'
import { ensureServiceWorker } from './lib/notifications'
import { selecionarValorAoFocar } from './lib/moeda'
import './lib/installPrompt' // captura o convite de instalação do Chrome o quanto antes

// Registra o Service Worker cedo (não bloqueia render).
// Isso deixa o app pronto pra receber push notifications quando
// o usuário ativar no toggle "Ativar notificações".
if (typeof window !== "undefined") {
  window.addEventListener("load", () => { ensureServiceWorker(); });

  // Bloqueia menu de contexto (clique direito no desktop + long-press no mobile) dentro do app da confeiteira.
  // (6.115) Nas páginas do cliente (cardápio, orçamento) fica liberado: segurar a foto para salvar, compartilhar,
  // copiar o texto ou pesquisar com o Google Lens.
  const paginaDoCliente = () => /^\/(c|cardapio|o|orcamento)\//.test(window.location.pathname);
  window.addEventListener("contextmenu", (e) => { if (!paginaDoCliente()) e.preventDefault(); });

  // (10/11) em todo campo de valor (teclado numérico), tocar seleciona o valor inteiro e o que for digitado entra no lugar.
  // Antes só valia no cadastro de produto: no "Registrar recebimento" o valor já vinha preenchido (R$ 544,80) e
  // digitar 200 virava R$ 54.480.200,00
  document.addEventListener("focusin", selecionarValorAoFocar);
}

import { marcarAppAberto } from './lib/recarregarLimpo'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <TelaDeErro><App /></TelaDeErro>
      <SpeedInsights />
    </ThemeProvider>
  </StrictMode>,
)

// Abertura: some quando a primeira tela está pronta (sem espera fixa)
iniciarAbertura()
// (12/11) app da Play Store: links, atalhos do ícone e volta do login com o Google (no site nada disso carrega)
if (typeof navigator !== 'undefined' && /DoonlyApp/.test(navigator.userAgent || '')) import('./lib/nativoApp').then(m => m.iniciarNativo()).catch(() => {})

// iPhone: barras de botões sobem junto com o teclado
iniciarMedidaDoTeclado()

// App instalado: atualiza sozinho quando sai versão nova (num momento seguro)
iniciarAutoAtualizacao()
// (6.91) arquivo de uma tela que sumiu com a atualização (o Vite avisa antes de quebrar): recarrega uma vez e pega a versão nova
// (6.112) Campos do app sem "autocomplete": o Android abria em cima do teclado a barra de senhas, cartões e endereços
// (Google/Samsung). Todo campo de texto sem a marca ganha autocomplete="off"; os de login (e-mail, senha) têm a marca deles e ficam como estão.
{
  const marcar = (raiz: ParentNode) => {
    raiz.querySelectorAll?.('input:not([autocomplete]), textarea:not([autocomplete])').forEach(el => {
      const t = (el as HTMLInputElement).type
      if (t === 'password' || t === 'email' || t === 'file' || t === 'checkbox' || t === 'radio' || t === 'hidden') return
      el.setAttribute('autocomplete', 'off')
    })
  }
  const iniciar = () => {
    marcar(document)
    new MutationObserver(lista => { for (const m of lista) m.addedNodes.forEach(n => { if (n.nodeType === 1) { const e = n as Element; if (/^(INPUT|TEXTAREA)$/.test(e.tagName)) marcar(e.parentNode || document); else marcar(e) } }) })
      .observe(document.body, { childList: true, subtree: true })
  }
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar)
}

window.addEventListener('vite:preloadError', (e) => {
  try {
    const ult = Number(sessionStorage.getItem('doonly_recarga_arquivo') || 0)
    if (Date.now() - ult < 30000) return
    sessionStorage.setItem('doonly_recarga_arquivo', String(Date.now()))
  } catch { /* sem sessionStorage: recarrega mesmo assim */ }
  // (6.102) sem preventDefault: com ele o import "dava certo" vazio e a tela quebrava com "reading 'default'" (erro genérico)
  void e
  window.location.reload()
})
// (6.124) o app abriu (some o conserto automático do index.html)
setTimeout(marcarAppAberto, 3000)
