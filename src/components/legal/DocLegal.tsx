import { DOCS_LEGAIS } from './textosLegais'
import type { DocLegalId } from './textosLegais'
import './legal.css'

/** O texto de um documento (Termos ou Privacidade), com as seções numeradas. Usado na página e na janela. */
export function DocLegal({ doc, prefixo = 'lg' }: { doc: DocLegalId; prefixo?: string }) {
  const d = DOCS_LEGAIS[doc]
  return (
    <div className="lg-doc">
      <div className="lg-intro">{d.intro}</div>
      {d.secoes.map((s, i) => (
        <section className="lg-sec" key={s.titulo} id={`${prefixo}-${doc}-${i + 1}`} aria-labelledby={`${prefixo}-${doc}-${i + 1}-t`}>
          <h2 className="lg-sec-t" id={`${prefixo}-${doc}-${i + 1}-t`}><i aria-hidden="true">{i + 1}</i><span>{s.titulo}</span></h2>
          {s.corpo}
        </section>
      ))}
    </div>
  )
}
