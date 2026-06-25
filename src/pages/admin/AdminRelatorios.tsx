export default function AdminRelatorios() {
  return (
    <div>
      <h1 className="adm-page-title">📈 Relatórios</h1>
      <p className="adm-page-sub">Dados e métricas da plataforma</p>

      <div className="adm-coming-soon">
        <div className="adm-cs-icon">📊</div>
        <h2>Em breve</h2>
        <p>Os relatórios detalhados estarão disponíveis em breve.</p>
        <div className="adm-cs-features">
          <div className="adm-cs-item">👥 Novos usuários por período</div>
          <div className="adm-cs-item">❤️ Receitas mais curtidas</div>
          <div className="adm-cs-item">⭐ Receitas mais salvas</div>
          <div className="adm-cs-item">📄 PDFs mais acessados</div>
          <div className="adm-cs-item">📈 Crescimento da plataforma</div>
        </div>
      </div>

      <style>{`
        .adm-page-title { font-size: var(--text-xl); font-weight: var(--fw-bold); color:#1f2937; margin:0 0 0.25rem; }
        .adm-page-sub { font-size: var(--font-button); color:#9ca3af; margin:0 0 1.5rem; }
        .adm-coming-soon { background:white; border-radius: var(--radius-lg); padding:3rem 2rem; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.06); max-width:500px; }
        .adm-cs-icon { font-size:3rem; margin-bottom:1rem; }
        .adm-coming-soon h2 { font-size: var(--font-modal-title); font-weight: var(--fw-bold); color:#1f2937; margin:0 0 0.5rem; }
        .adm-coming-soon p { font-size: var(--font-button); color:#6b7280; margin:0 0 1.5rem; line-height:1.6; }
        .adm-cs-features { display:flex; flex-direction:column; gap:0.5rem; text-align:left; }
        .adm-cs-item { background:#f9fafb; border-radius: var(--radius-sm); padding:0.65rem 1rem; font-size: var(--font-button); color:#374151; font-family:'Geist', sans-serif; }
      `}</style>
    </div>
  );
}
