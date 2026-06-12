import { Search } from 'lucide-react'
export function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--bg-body)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Search style={{ width: '40px', height: '40px', color: 'var(--text-muted)' }} />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '8px' }}>Nenhum produto encontrado</h3>
      <p style={{ color: 'var(--text-secondary)' }}>Tente buscar por outro termo</p>
    </div>
  )
}
