interface Category { name: string; icon: string; imagem_url?: string }
interface Props {
  categories: Category[]
  selectedCategory: string | null
  onCategorySelect: (c: string | null) => void
  categoryIcons?: { [key: string]: string }
  categoryImages?: { [key: string]: string }
}

export function CategoryFilter({ categories, selectedCategory, onCategorySelect, categoryIcons = {}, categoryImages = {} }: Props) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', gap: '12px', padding: '4px 24px', marginLeft: '-24px', marginRight: '-24px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const isSelected = cat.name === 'Todos' ? selectedCategory === null : selectedCategory === cat.name
          const imgUrl = cat.name === 'Todos' ? null : (categoryImages[cat.name] || null)
          const iconUrl = cat.name === 'Todos' ? '/icons/TODOS.png' : (categoryIcons[cat.name] || '/icons/1.png')

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
                <img
                  src={imgUrl || iconUrl}
                  alt={cat.name}
                  style={{ width: imgUrl ? '100%' : '36px', height: imgUrl ? '100%' : '36px', objectFit: imgUrl ? 'cover' : 'contain' }}
                  onError={e => { e.currentTarget.src = '/icons/1.png' }}
                />
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
