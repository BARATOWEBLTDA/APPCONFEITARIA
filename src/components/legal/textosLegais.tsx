import type { ReactNode } from 'react'

/**
 * Textos dos Termos de Uso e da Política de Privacidade (07/10).
 * São os mesmos textos de antes, palavra por palavra: só saíram das páginas pra um lugar só,
 * usado pela página (/termos, /privacidade) e pela janela que abre no login e nas Configurações.
 * Pra mudar um texto, mude aqui.
 */
export type DocLegalId = 'termos' | 'privacidade'
export type SecaoLegal = { titulo: string; corpo: ReactNode }
export type DocLegalDados = { titulo: string; curto: string; atualizado: string; intro: ReactNode; secoes: SecaoLegal[] }

export const DOCS_LEGAIS: Record<DocLegalId, DocLegalDados> = {
  termos: {
    titulo: 'Termos de uso',
    curto: 'Termos de Uso',
    atualizado: 'Última atualização: junho de 2026',
    intro: (
      <>
        <p>Bem-vindo ao <strong>Doonly</strong>. Ao criar uma conta e utilizar nosso serviço, você concorda com os seguintes Termos de Uso. Leia atentamente antes de usar a plataforma.</p>
      </>
    ),
    secoes: [
      {
        titulo: 'Sobre o serviço',
        corpo: (
          <>
        <p>O Doonly é uma plataforma de gestão para confeitarias que permite cadastrar produtos, criar cardápios digitais, gerenciar pedidos e configurar informações da loja. O serviço é fornecido pela <strong>Doonly Tecnologia Ltda</strong>.</p>
          </>
        ),
      },
      {
        titulo: 'Cadastro e conta',
        corpo: (
          <>
        <p>Para usar o Doonly, você deve criar uma conta com informações verdadeiras e atualizadas. Você é responsável por manter a segurança de sua senha e por todas as atividades realizadas em sua conta.</p>
          </>
        ),
      },
      {
        titulo: 'Uso permitido',
        corpo: (
          <>
        <p>Você pode usar o Doonly para fins legítimos relacionados à gestão de seu negócio de confeitaria. É proibido usar a plataforma para:</p>
        <ul>
        <li>Atividades ilegais ou fraudulentas</li>
        <li>Publicar conteúdo ofensivo, enganoso ou que viole direitos de terceiros</li>
        <li>Tentar acessar contas de outros usuários</li>
        <li>Sobrecarregar ou prejudicar a infraestrutura do serviço</li>
        </ul>
          </>
        ),
      },
      {
        titulo: 'Planos e pagamentos',
        corpo: (
          <>
        <p>O Doonly oferece planos gratuitos e pagos (PRO). Os recursos disponíveis em cada plano estão descritos na plataforma. Pagamentos são processados de forma segura e não reembolsáveis, salvo disposição contrária na legislação aplicável.</p>
          </>
        ),
      },
      {
        titulo: 'Conteúdo do usuário',
        corpo: (
          <>
        <p>Você mantém a propriedade do conteúdo que publica (fotos, descrições, informações de produtos). Ao enviar conteúdo, você concede ao Doonly uma licença limitada para exibi-lo e armazená-lo exclusivamente para o funcionamento do serviço.</p>
          </>
        ),
      },
      {
        titulo: 'Disponibilidade do serviço',
        corpo: (
          <>
        <p>Nos esforçamos para manter o Doonly disponível 24 horas por dia, mas não garantimos disponibilidade ininterrupta. Podemos realizar manutenções programadas com aviso prévio sempre que possível.</p>
          </>
        ),
      },
      {
        titulo: 'Encerramento de conta',
        corpo: (
          <>
        <p>Você pode encerrar sua conta a qualquer momento. Nos reservamos o direito de suspender ou encerrar contas que violem estes termos.</p>
          </>
        ),
      },
      {
        titulo: 'Limitação de responsabilidade',
        corpo: (
          <>
        <p>O Doonly não se responsabiliza por perdas de negócio, lucros cessantes ou danos indiretos decorrentes do uso ou impossibilidade de uso da plataforma.</p>
          </>
        ),
      },
      {
        titulo: 'Alterações nos termos',
        corpo: (
          <>
        <p>Podemos atualizar estes termos periodicamente. Notificaremos sobre mudanças significativas por e-mail ou dentro da plataforma. O uso continuado após as alterações implica aceitação dos novos termos.</p>
          </>
        ),
      },
      {
        titulo: 'Contato',
        corpo: (
          <>
        <p>Dúvidas sobre estes Termos de Uso? Entre em contato: <a href="mailto:contato@doonly.com.br">contato@doonly.com.br</a></p>
          </>
        ),
      },
    ],
  },
  privacidade: {
    titulo: 'Política de privacidade',
    curto: 'Privacidade',
    atualizado: 'Última atualização: junho de 2026',
    intro: (
      <>
        <p>A <strong>Doonly Tecnologia Ltda</strong> leva sua privacidade a sério. Esta política explica como coletamos, usamos e protegemos suas informações ao usar o Doonly.</p>
      </>
    ),
    secoes: [
      {
        titulo: 'Dados que coletamos',
        corpo: (
          <>
        <p><strong>Dados de cadastro:</strong> nome, e-mail e senha ao criar sua conta.</p>
        <p><strong>Dados do negócio:</strong> nome da loja, telefone, endereço, fotos, descrições de produtos e configurações do cardápio.</p>
        <p><strong>Dados de uso:</strong> informações sobre como você usa a plataforma para melhorarmos o serviço.</p>
          </>
        ),
      },
      {
        titulo: 'Como usamos seus dados',
        corpo: (
          <>
        <ul>
        <li>Fornecer e manter o serviço Doonly</li>
        <li>Exibir seu cardápio público para seus clientes</li>
        <li>Enviar comunicações importantes sobre sua conta</li>
        <li>Melhorar a plataforma com base no uso</li>
        <li>Cumprir obrigações legais</li>
        </ul>
          </>
        ),
      },
      {
        titulo: 'Compartilhamento de dados',
        corpo: (
          <>
        <p>Não vendemos seus dados pessoais. Podemos compartilhá-los apenas com:</p>
        <ul>
        <li><strong>Provedores de serviço:</strong> como Supabase (banco de dados) e Vercel (hospedagem), que nos ajudam a operar a plataforma</li>
        <li><strong>Autoridades legais:</strong> quando exigido por lei</li>
        </ul>
          </>
        ),
      },
      {
        titulo: 'Cardápio público',
        corpo: (
          <>
        <p>As informações que você cadastra no cardápio (nome da loja, produtos, fotos, descrições) são exibidas publicamente para seus clientes através do link do seu cardápio. Você tem controle total sobre essas informações.</p>
          </>
        ),
      },
      {
        titulo: 'Segurança',
        corpo: (
          <>
        <p>Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia de senhas e conexões seguras (HTTPS). Nenhum sistema é 100% seguro, mas nos comprometemos a proteger suas informações.</p>
          </>
        ),
      },
      {
        titulo: 'Seus direitos (LGPD)',
        corpo: (
          <>
        <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
        <ul>
        <li>Acessar seus dados pessoais</li>
        <li>Corrigir dados incorretos</li>
        <li>Solicitar a exclusão de seus dados</li>
        <li>Revogar o consentimento a qualquer momento</li>
        </ul>
        <p>Para exercer esses direitos, entre em contato: <a href="mailto:contato@doonly.com.br">contato@doonly.com.br</a></p>
          </>
        ),
      },
      {
        titulo: 'Cookies',
        corpo: (
          <>
        <p>Usamos cookies essenciais para manter sua sessão ativa. Não usamos cookies de rastreamento ou publicidade.</p>
          </>
        ),
      },
      {
        titulo: 'Retenção de dados',
        corpo: (
          <>
        <p>Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento da conta, os dados são removidos em até 90 dias, exceto quando a retenção for exigida por lei.</p>
          </>
        ),
      },
      {
        titulo: 'Menores de idade',
        corpo: (
          <>
        <p>O Doonly não é destinado a menores de 18 anos. Não coletamos intencionalmente dados de menores.</p>
          </>
        ),
      },
      {
        titulo: 'Alterações nesta política',
        corpo: (
          <>
        <p>Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas por e-mail ou dentro da plataforma.</p>
          </>
        ),
      },
      {
        titulo: 'Contato',
        corpo: (
          <>
        <p>Dúvidas sobre privacidade? Entre em contato: <a href="mailto:contato@doonly.com.br">contato@doonly.com.br</a></p>
          </>
        ),
      },
    ],
  },
}
