interface Category { name: string; icon: string; imagem_url?: string }
interface Props {
  categories: Category[]
  selectedCategory: string | null
  onCategorySelect: (c: string | null) => void
  categoryIcons?: { [key: string]: string }
  categoryImages?: { [key: string]: string }
}

// SVG inline pra "Todos" (grid de 4 quadradinhos)
const IconTodos = ({ color = '#fff' }: { color?: string }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.2"/>
    <rect x="14" y="3" width="7" height="7" rx="1.2"/>
    <rect x="3" y="14" width="7" height="7" rx="1.2"/>
    <rect x="14" y="14" width="7" height="7" rx="1.2"/>
  </svg>
)

// SVG inline fallback pra categorias sem ícone (tag/etiqueta)
const IconTag = ({ color = '#fff' }: { color?: string }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
)

export function CategoryFilter({ categories, selectedCategory, onCategorySelect, categoryIcons = {}, categoryImages = {} }: Props) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', gap: '12px', padding: '4px 24px', marginLeft: '-24px', marginRight: '-24px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const isSelected = cat.name === 'Todos' ? selectedCategory === null : selectedCategory === cat.name
          const imgUrl = cat.name === 'Todos' ? null : (categoryImages[cat.name] || null)
          const iconUrl = cat.name === 'Todos' ? null : (categoryIcons[cat.name] || null)
          const iconColor = isSelected ? '#fff' : '#fff'

          return (
            <button
              key={cat.name}
              onClick={() => onCategorySelect(cat.name === 'Todos' ? null : cat.name)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0,
              }}
            >
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                backgroundColor: isSelected ? '#2E2E2E' : '#fe62a6',
                border: '3px solid var(--border)', outline: '3px solid var(--bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', transition: 'all 0.2s',
                boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
              }}>
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={cat.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : iconUrl ? (
                  <img
                    src={iconUrl}
                    alt={cat.name}
                    style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                  />
                ) : cat.name === 'Todos' ? (
                  <IconTodos color={iconColor} />
                ) : (
                  <IconTag color={iconColor} />
                )}
              </div>
              <span style={{
                fontSize: '0.65rem', fontWeight: isSelected ? 700 : 500,
                color: isSelected ? 'var(--text-title)' : 'var(--text-secondary)',
                maxWidth: '64px', textAlign: 'center',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{cat.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
