interface Category { name: string; icon: string }
interface Props {
  categories: Category[]
  selectedCategory: string | null
  onCategorySelect: (c: string | null) => void
  categoryIcons?: { [key: string]: string }
}

const iconMap: { [key: string]: string } = {
  'Bolos': '/icons/1.png', 'Doces': '/icons/2.png', 'Salgados': '/icons/3.png',
  'Brigadeiros': '/icons/4.png', 'Cookies': '/icons/5.png', 'Todos': '/icons/TODOS.png'
}

export function CategoryFilter({ categories, selectedCategory, onCategorySelect, categoryIcons = {} }: Props) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', gap: '8px', padding: '4px 24px', marginLeft: '-24px', marginRight: '-24px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const isSelected = cat.name === 'Todos' ? selectedCategory === null : selectedCategory === cat.name
          const icon = cat.name === 'Todos' ? '/icons/TODOS.png' : (categoryIcons[cat.name] || iconMap[cat.name] || '/icons/1.png')
          return (
            <button key={cat.name} onClick={() => onCategorySelect(cat.name === 'Todos' ? null : cat.name)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', borderRadius: '50%', backgroundColor: isSelected ? '#2E2E2E' : '#fe62a6', border: '3px solid #DBDFE4', outline: '3px solid white', cursor: 'pointer', padding: '8px', flexShrink: 0, transition: 'all 0.2s' }}>
              <img src={icon} alt={cat.name} style={{ width: '36px', height: '36px', objectFit: 'contain' }} onError={e => (e.currentTarget.src = '/icons/1.png')} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
