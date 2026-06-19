import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'

export default function CardapioResumo() {
  const { profile } = useProfile()
  const [visitas, setVisitas] = useState(0)
  const [pedidos, setPedidos] = useState(0)
  const [produtoTop, setProdutoTop] = useState<{ nome: string; qtd: number; imagem?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [periodo, setPeriodo] = useState<'hoje' | '7d' | '30d' | 'tudo'>('hoje')

  const link = profile?.slug ? `${window.location.origin}/cardapio/${profile.slug}` : ''

  useEffect(() => {
    if (!profile?.id) return
    carregarDados()
  }, [profile?.id, periodo])

  const carregarDados = async () => {
    setLoading(true)
    try {
      const dataLimite = new Date()
      if (periodo === 'hoje') dataLimite.setHours(0, 0, 0, 0)
      else if (periodo === '7d') dataLimite.setDate(dataLimite.getDate() - 7)
      else if (periodo === '30d') dataLimite.setDate(dataLimite.getDate() - 30)
      else dataLimite.setFullYear(2000)

      // Visitas
      const { count: visitasCount } = await supabase
        .from('cardapio_visitas')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile!.id)
        .gte('created_at', dataLimite.toISOString())

      // Pedidos vindos do cardápio
      const { data: pedidosCardapio } = await supabase
        .from('pedidos')
        .select('id, pedido_itens(nome_produto, quantidade, produtos(imagem_url))')
        .eq('user_id', profile!.id)
        .eq('origem', 'cardapio')
        .gte('created_at', dataLimite.toISOString())

      setVisitas(visitasCount || 0)
      setPedidos(pedidosCardapio?.length || 0)

      // Produto mais pedido
      const contagem: Record<string, { qtd: number; imagem?: string }> = {}
      pedidosCardapio?.forEach(p => {
        p.pedido_itens?.forEach((item: any) => {
          if (!contagem[item.nome_produto]) contagem[item.nome_produto] = { qtd: 0, imagem: item.produtos?.imagem_url }
          contagem[item.nome_produto].qtd += item.quantidade
        })
      })
      const top = Object.entries(contagem).sort((a, b) => b[1].qtd - a[1].qtd)[0]

      // Fallback: se o item não tinha produto_id vinculado, tenta casar pelo nome
      let imagemTop = top?.[1]?.imagem
      if (top && !imagemTop) {
        const { data: prodMatch } = await supabase
          .from('produtos')
          .select('imagem_url')
          .eq('user_id', profile!.id)
          .ilike('nome', top[0])
          .maybeSingle()
        imagemTop = prodMatch?.imagem_url
      }

      setProdutoTop(top ? { nome: top[0], qtd: top[1].qtd, imagem: imagemTop } : null)
    } catch (err) {
      console.error('Erro ao carregar resumo do cardápio:', err)
    }
    setLoading(false)
  }

  const conversaoRaw = visitas > 0 ? (pedidos / visitas) * 100 : 0
  const conversao = Math.min(conversaoRaw, 100).toFixed(1)

  const copiarLink = () => {
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div style={{ padding: '1.25rem 1rem 5.5rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-title,#431524)' }}>Visão Geral do Cardápio</h1>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted,#C39EAA)' }}>Como seu cardápio está performando</p>

      {/* Link de compartilhamento — destaque */}
      <div style={{ background: 'linear-gradient(135deg, var(--primary,#986274), var(--primary-dark,#6E3548))', borderRadius: 16, padding: '1.25rem', marginBottom: '1rem', color: '#fff' }}>
        <p style={{ margin: '0 0 8px', fontSize: '0.78rem', fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Seu link do cardápio</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px' }}>
          <span style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link || 'Configure seu cardápio primeiro'}</span>
          <button onClick={copiarLink} disabled={!link}
            style={{ background: '#fff', color: 'var(--primary,#986274)', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: '0.78rem', cursor: link ? 'pointer' : 'not-allowed', flexShrink: 0, fontFamily: 'inherit' }}>
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Filtro de período */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
        {([['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['tudo', 'Tudo']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setPeriodo(key)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid var(--border,#ECC2D0)', background: periodo === key ? 'var(--primary,#986274)' : '#fff', color: periodo === key ? '#fff' : 'var(--text-secondary,#6E3548)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted,#C39EAA)' }}>Carregando...</div>
      ) : (
        <>
          {/* Cards de métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
            <div style={{ background: '#fff', border: '1.5px solid var(--border,#ECC2D0)', borderRadius: 14, padding: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted,#C39EAA)', fontWeight: 600 }}>Visitas</p>
              <p style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-title,#431524)' }}>{visitas}</p>
            </div>
            <div style={{ background: '#fff', border: '1.5px solid var(--border,#ECC2D0)', borderRadius: 14, padding: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted,#C39EAA)', fontWeight: 600 }}>Pedidos</p>
              <p style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-title,#431524)' }}>{pedidos}</p>
            </div>
          </div>

          {/* Taxa de conversão */}
          <div style={{ background: '#fff', border: '1.5px solid var(--border,#ECC2D0)', borderRadius: 14, padding: '1.1rem', marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 6px', fontSize: '0.78rem', color: 'var(--text-muted,#C39EAA)', fontWeight: 600 }}>Taxa de conversão</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary,#986274)' }}>{conversao}%</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted,#C39EAA)' }}>de visitas viraram pedido</span>
            </div>
            <div style={{ marginTop: 8, height: 6, background: 'var(--bg-subtle,#F7EEF1)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(parseFloat(conversao), 100)}%`, background: 'var(--primary,#986274)', borderRadius: 4 }} />
            </div>
            {visitas < pedidos && (
              <p style={{ margin: '8px 0 0', fontSize: '0.7rem', color: 'var(--text-muted,#C39EAA)' }}>
                O contador de visitas começou recentemente — os números vão ficar mais precisos com o tempo.
              </p>
            )}
          </div>

          {/* Produto mais pedido */}
          <div style={{ background: '#fff', border: '1.5px solid var(--border,#ECC2D0)', borderRadius: 14, padding: '1.1rem' }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: 'var(--text-muted,#C39EAA)', fontWeight: 600 }}>Produto mais pedido</p>
            {produtoTop ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--bg-subtle,#F7EEF1)', border: '1px solid var(--border,#ECC2D0)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  {produtoTop.imagem ? <img src={produtoTop.imagem} alt={produtoTop.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎂'}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-title,#431524)' }}>{produtoTop.nome}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary,#986274)', background: 'var(--bg-subtle,#F7EEF1)', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{produtoTop.qtd}x pedido{produtoTop.qtd > 1 ? 's' : ''}</span>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted,#C39EAA)' }}>Nenhum pedido no período selecionado</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
