export default function CardapioDesign() {
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      minHeight:"50vh", fontFamily:"Inter,sans-serif", textAlign:"center", gap:"0.75rem"
    }}>
      <span style={{fontSize:"2.5rem"}}>🎨</span>
      <h2 style={{fontSize:"1.1rem", fontWeight:700, color:"var(--text-primary,#1f2937)", margin:0}}>Design do Cardápio</h2>
      <p style={{fontSize:"0.85rem", color:"var(--text-muted,#9ca3af)", margin:0}}>Em breve...</p>
    </div>
  );
}
