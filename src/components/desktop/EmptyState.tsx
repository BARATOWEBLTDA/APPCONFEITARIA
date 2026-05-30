import { Search } from 'lucide-react'
export function DesktopEmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ width: '80px', height: '80px', backgroundColor: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Search style={{ width: '40px', height: '40px', color: '#9ca3af' }} />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>Nenhum produto encontrado</h3>
      <p style={{ color: '#6b7280' }}>Tente buscar por outro termo</p>
    </div>
  )
}
