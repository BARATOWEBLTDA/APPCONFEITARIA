export default function AdminNotificacoes() {
  return (
    <div>
      <h1 className="adm-page-title">🔔 Notificações</h1>
      <p className="adm-page-sub">Envie comunicados para os usuários</p>

      <div className="adm-coming-soon">
        <div className="adm-cs-icon">🔔</div>
        <h2>Em breve</h2>
        <p>O sistema de notificações será implementado em breve. Você poderá enviar comunicados para todos os usuários ou usuários específicos.</p>
        <div className="adm-cs-features">
          <div className="adm-cs-item">📢 Notificação para todos os usuários</div>
          <div className="adm-cs-item">🎯 Notificação para usuários específicos</div>
          <div className="adm-cs-item">📄 Divulgar novos PDFs</div>
          <div className="adm-cs-item">👩‍🍳 Divulgar novas receitas</div>
          <div className="adm-cs-item">📣 Comunicados da plataforma</div>
        </div>
      </div>

      <style>{`
        .adm-page-title { font-size:1.5rem; font-weight:700; color:#1f2937; margin:0 0 0.25rem; }
        .adm-page-sub { font-size:0.88rem; color:#9ca3af; margin:0 0 1.5rem; }
        .adm-coming-soon { background:white; border-radius:16px; padding:3rem 2rem; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.06); max-width:500px; }
        .adm-cs-icon { font-size:3rem; margin-bottom:1rem; }
        .adm-coming-soon h2 { font-size:1.25rem; font-weight:700; color:#1f2937; margin:0 0 0.5rem; }
        .adm-coming-soon p { font-size:0.88rem; color:#6b7280; margin:0 0 1.5rem; line-height:1.6; }
        .adm-cs-features { display:flex; flex-direction:column; gap:0.5rem; text-align:left; }
        .adm-cs-item { background:#f9fafb; border-radius:8px; padding:0.65rem 1rem; font-size:0.85rem; color:#374151; font-family:'Inter',sans-serif; }
      `}</style>
    </div>
  );
}
