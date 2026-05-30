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

export function DesktopCategoryFilter({ categories, selectedCategory, onCategorySelect, categoryIcons = {} }: Props) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', gap: '16px', padding: '8px 0', justifyContent: 'center', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const isSelected = cat.name === 'Todos' ? selectedCategory === null : selectedCategory === cat.name
          const icon = cat.name === 'Todos' ? '/icons/TODOS.png' : (categoryIcons[cat.name] || iconMap[cat.name] || '/icons/1.png')
          return (
            <button key={cat.name} onClick={() => onCategorySelect(cat.name === 'Todos' ? null : cat.name)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100px', height: '100px', borderRadius: '50%', backgroundColor: isSelected ? '#2E2E2E' : '#fe62a6', border: '4px solid #DBDFE4', outline: '4px solid white', cursor: 'pointer', padding: '12px', flexShrink: 0, transition: 'all 0.2s', boxShadow: isSelected ? '0 8px 25px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.1)' }}>
              <img src={icon} alt={cat.name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} onError={e => (e.currentTarget.src = '/icons/1.png')} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
