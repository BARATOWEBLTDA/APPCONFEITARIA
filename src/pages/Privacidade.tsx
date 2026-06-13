export default function Privacidade() {
  return (
    <div style={{ fontFamily: 'inherit', maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem', color: 'var(--text-primary, #374151)', lineHeight: '1.7' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-title, #1F2937)', marginBottom: '0.25rem' }}>Política de Privacidade</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #9CA3AF)', marginBottom: '2rem' }}>Última atualização: junho de 2026</p>

      <p>A <strong>Doonly Tecnologia Ltda</strong> leva sua privacidade a sério. Esta política explica como coletamos, usamos e protegemos suas informações ao usar o Doonly.</p>

      <h2>1. Dados que Coletamos</h2>
      <p><strong>Dados de cadastro:</strong> nome, e-mail e senha ao criar sua conta.</p>
      <p><strong>Dados do negócio:</strong> nome da loja, telefone, endereço, fotos, descrições de produtos e configurações do cardápio.</p>
      <p><strong>Dados de uso:</strong> informações sobre como você usa a plataforma para melhorarmos o serviço.</p>

      <h2>2. Como Usamos seus Dados</h2>
      <ul>
        <li>Fornecer e manter o serviço Doonly</li>
        <li>Exibir seu cardápio público para seus clientes</li>
        <li>Enviar comunicações importantes sobre sua conta</li>
        <li>Melhorar a plataforma com base no uso</li>
        <li>Cumprir obrigações legais</li>
      </ul>

      <h2>3. Compartilhamento de Dados</h2>
      <p>Não vendemos seus dados pessoais. Podemos compartilhá-los apenas com:</p>
      <ul>
        <li><strong>Provedores de serviço:</strong> como Supabase (banco de dados) e Vercel (hospedagem), que nos ajudam a operar a plataforma</li>
        <li><strong>Autoridades legais:</strong> quando exigido por lei</li>
      </ul>

      <h2>4. Cardápio Público</h2>
      <p>As informações que você cadastra no cardápio (nome da loja, produtos, fotos, descrições) são exibidas publicamente para seus clientes através do link do seu cardápio. Você tem controle total sobre essas informações.</p>

      <h2>5. Segurança</h2>
      <p>Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia de senhas e conexões seguras (HTTPS). Nenhum sistema é 100% seguro, mas nos comprometemos a proteger suas informações.</p>

      <h2>6. Seus Direitos (LGPD)</h2>
      <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
      <ul>
        <li>Acessar seus dados pessoais</li>
        <li>Corrigir dados incorretos</li>
        <li>Solicitar a exclusão de seus dados</li>
        <li>Revogar o consentimento a qualquer momento</li>
      </ul>
      <p>Para exercer esses direitos, entre em contato: <a href="mailto:contato@doonly.com.br" style={{ color: 'var(--primary, #FF6FA9)' }}>contato@doonly.com.br</a></p>

      <h2>7. Cookies</h2>
      <p>Usamos cookies essenciais para manter sua sessão ativa. Não usamos cookies de rastreamento ou publicidade.</p>

      <h2>8. Retenção de Dados</h2>
      <p>Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento da conta, os dados são removidos em até 90 dias, exceto quando a retenção for exigida por lei.</p>

      <h2>9. Menores de Idade</h2>
      <p>O Doonly não é destinado a menores de 18 anos. Não coletamos intencionalmente dados de menores.</p>

      <h2>10. Alterações nesta Política</h2>
      <p>Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas por e-mail ou dentro da plataforma.</p>

      <h2>11. Contato</h2>
      <p>Dúvidas sobre privacidade? Entre em contato: <a href="mailto:contato@doonly.com.br" style={{ color: 'var(--primary, #FF6FA9)' }}>contato@doonly.com.br</a></p>

      <style>{`
        h2 { font-size: 1rem; font-weight: 700; color: var(--text-title, #1F2937); margin: 1.75rem 0 0.5rem; }
        ul { padding-left: 1.5rem; margin: 0.5rem 0; }
        li { margin-bottom: 0.25rem; }
        p { margin-bottom: 0.75rem; }
      `}</style>
    </div>
  )
}
