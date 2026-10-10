import { ChartBar, Users, Heart, BookmarkSimple, FilePdf, TrendUp } from "@phosphor-icons/react";

const PLANOS = [
  { icone: <Users size={20} weight="bold" />, texto: "Novos usuários por período" },
  { icone: <Heart size={20} weight="bold" />, texto: "Receitas mais curtidas" },
  { icone: <BookmarkSimple size={20} weight="bold" />, texto: "Receitas mais salvas" },
  { icone: <FilePdf size={20} weight="bold" />, texto: "PDFs mais acessados" },
  { icone: <TrendUp size={20} weight="bold" />, texto: "Crescimento da plataforma" },
];

export default function AdminRelatorios() {
  return (
    <div className="ar-root">
      <h1 className="ar-h1">Relatórios</h1>
      <p className="ar-sub">Dados e métricas da plataforma.</p>

      <section className="ar-card">
        <span className="ar-ic" aria-hidden="true"><ChartBar size={30} /></span>
        <h2 className="ar-t">Em breve</h2>
        <p className="ar-x">Os relatórios detalhados vão aparecer aqui.</p>
        <ul className="ar-lista">
          {PLANOS.map(p => (
            <li key={p.texto}>
              <span className="ar-li-ic" aria-hidden="true">{p.icone}</span>
              <span>{p.texto}</span>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .ar-root { font-family: var(--font-base); color: var(--ui-texto); max-width: 1000px; }
        .ar-h1 { font-size: 22px; font-weight: 700; margin: 0; color: var(--ui-texto); }
        .ar-sub { font-size: 15px; font-weight: 500; color: var(--ui-texto-2); margin: 4px 0 20px; }
        .ar-card { padding: 24px 16px 16px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); text-align: center; }
        .ar-ic { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); margin-bottom: 12px; }
        .ar-t { font-size: 18px; font-weight: 700; margin: 0 0 4px; color: var(--ui-texto); }
        .ar-x { font-size: 15px; font-weight: 500; line-height: 1.5; color: var(--ui-texto-2); margin: 0 0 16px; }
        .ar-lista { list-style: none; max-width: 560px; margin: 0 auto; padding: 0; text-align: left; }
        .ar-lista li { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 4px; border-top: 1px solid var(--ui-linha); font-size: 15px; font-weight: 500; color: var(--ui-texto); }
        .ar-li-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ui-raio); background: var(--ui-cinza); color: var(--ui-cinza-texto); }
        @media (min-width: 600px) { .ar-card { padding: 32px 24px 20px; } }
      `}</style>
    </div>
  );
}
