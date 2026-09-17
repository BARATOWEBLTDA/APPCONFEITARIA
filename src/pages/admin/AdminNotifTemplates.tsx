/**
 * AdminNotifTemplates — Configura templates de notificações automáticas.
 *
 * Templates disparados automaticamente por eventos:
 *  - indicacao_cadastro: alguém se cadastrou pelo link
 *  - indicacao_pro:      indicado(a) virou PRO
 *
 * Placeholders suportados no título/corpo:
 *  - {nome}:   nome de quem se cadastrou/virou PRO
 *  - {codigo}: código de indicação usado
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import useSom from "@/hooks/useSom";

type Som = "notificacao" | "pedido" | "nenhum";
interface Template {
  evento: string;
  titulo: string;
  corpo: string;
  som: Som;
  ativo: boolean;
  updated_at?: string;
}

const EVENTOS_META = [
  {
    evento: "indicacao_cadastro",
    emoji: "🎉",
    label: "INDICAÇÃO — CADASTRO",
    titulo: "Alguém se cadastrou pelo seu link",
    descricao: "Disparado quando uma pessoa cria conta usando o link de indicação",
    cor: "#993556",
    bg: "#FCE0E9",
  },
  {
    evento: "indicacao_pro",
    emoji: "👑",
    label: "INDICAÇÃO — VIROU PRO",
    titulo: "Indicado(a) assinou o PRO",
    descricao: "Disparado quando alguém que você indicou vira PRO (conta pra meta)",
    cor: "#166534",
    bg: "#DCFCE7",
  },
];

export default function AdminNotifTemplates() {
  const { tocar } = useSom();
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("notif_templates").select("*");
      if (error) {
        alert("Erro ao carregar templates:\n" + error.message);
        return;
      }
      const map: Record<string, Template> = {};
      (data || []).forEach(t => { map[t.evento] = t as Template; });
      setTemplates(map);
      setLoading(false);
    };
    load();
  }, []);

  const editar = (evento: string, campo: keyof Template, valor: any) => {
    setTemplates(t => ({ ...t, [evento]: { ...t[evento], [campo]: valor } }));
    setDirty(d => ({ ...d, [evento]: true }));
  };

  const salvar = async (evento: string) => {
    const t = templates[evento];
    if (!t.titulo.trim() || !t.corpo.trim()) {
      alert("Título e corpo são obrigatórios.");
      return;
    }
    setSaving(s => ({ ...s, [evento]: true }));
    const { error } = await supabase.from("notif_templates").update({
      titulo: t.titulo,
      corpo: t.corpo,
      som: t.som,
      ativo: t.ativo,
      updated_at: new Date().toISOString(),
    }).eq("evento", evento);
    setSaving(s => ({ ...s, [evento]: false }));
    if (error) return alert("Erro ao salvar:\n" + error.message);
    setDirty(d => ({ ...d, [evento]: false }));
  };

  const testarSom = (som: Som) => {
    if (som === "nenhum") return;
    tocar(som);
  };

  if (loading) {
    return <div style={{ padding: "2rem", color: "#888" }}>Carregando templates...</div>;
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#2C2C2A", letterSpacing: "-0.01em", margin: 0 }}>Templates automáticos</h1>
        <p style={{ fontSize: 13, color: "#888780", marginTop: 4 }}>
          Configure as notificações que são enviadas automaticamente quando eventos acontecem no app.
        </p>
      </div>

      {EVENTOS_META.map(meta => {
        const t = templates[meta.evento];
        if (!t) return null;
        const isDirty = dirty[meta.evento];
        const isSaving = saving[meta.evento];
        const preview = {
          titulo: t.titulo.replace(/\{nome\}/g, "Maria Silva").replace(/\{codigo\}/g, "MARI123"),
          corpo: t.corpo.replace(/\{nome\}/g, "Maria Silva").replace(/\{codigo\}/g, "MARI123"),
        };
        return (
          <div key={meta.evento} style={{ background: "#fff", border: "1px solid #F0EBED", borderRadius: 12, padding: 20, marginBottom: 14, fontFamily: "system-ui, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: meta.bg, color: meta.cor, fontSize: 11, fontWeight: 800, borderRadius: 999, letterSpacing: "0.03em", marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>{meta.emoji}</span> {meta.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#2C2C2A" }}>{meta.titulo}</div>
                <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>{meta.descricao}</div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: t.ativo ? "#166534" : "#B4B2A9", fontWeight: 700 }}>{t.ativo ? "ATIVO" : "INATIVO"}</span>
                <div style={{ width: 36, height: 20, background: t.ativo ? "#166534" : "#B4B2A9", borderRadius: 999, position: "relative", transition: "background 0.2s ease" }}>
                  <div style={{ width: 16, height: 16, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: t.ativo ? 18 : 2, transition: "left 0.2s ease" }} />
                </div>
                <input type="checkbox" checked={t.ativo} onChange={e => editar(meta.evento, "ativo", e.target.checked)} style={{ display: "none" }} />
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>Título</label>
                <input
                  type="text"
                  value={t.titulo}
                  onChange={e => editar(meta.evento, "titulo", e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#FAF8F5", border: "1.5px solid #E8E5DC", borderRadius: 8, fontSize: 14, color: "#2C2C2A", marginTop: 4, outline: "none", fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>Corpo da mensagem</label>
                <textarea
                  rows={2}
                  value={t.corpo}
                  onChange={e => editar(meta.evento, "corpo", e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#FAF8F5", border: "1.5px solid #E8E5DC", borderRadius: 8, fontSize: 14, color: "#2C2C2A", marginTop: 4, resize: "vertical", fontFamily: "inherit", outline: "none" }}
                />
                <div style={{ fontSize: 10.5, color: "#888780", marginTop: 4 }}>
                  Placeholders: <code style={{ background: "#F0EBED", padding: "1px 5px", borderRadius: 3, fontFamily: "monospace" }}>{"{nome}"}</code> · <code style={{ background: "#F0EBED", padding: "1px 5px", borderRadius: 3, fontFamily: "monospace" }}>{"{codigo}"}</code>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>Som</label>
                  <select
                    value={t.som}
                    onChange={e => editar(meta.evento, "som", e.target.value as Som)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#FAF8F5", border: "1.5px solid #E8E5DC", borderRadius: 8, fontSize: 14, color: "#2C2C2A", marginTop: 4, outline: "none", fontFamily: "inherit", cursor: "pointer" }}
                  >
                    <option value="notificacao">🔔 Notificação (padrão)</option>
                    <option value="pedido">🛎️ Pedido (sino de caixa)</option>
                    <option value="nenhum">🔕 Sem som</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    onClick={() => testarSom(t.som)}
                    disabled={t.som === "nenhum"}
                    style={{ all: "unset", cursor: t.som === "nenhum" ? "not-allowed" : "pointer", padding: "10px 14px", background: "transparent", border: "1.5px solid #E8E5DC", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#5F5E5A", width: "100%", textAlign: "center", boxSizing: "border-box", opacity: t.som === "nenhum" ? 0.5 : 1 }}
                  >
                    🔊 Testar som
                  </button>
                </div>
              </div>
            </div>

            <div style={{ background: "#FAF8F5", borderRadius: 10, padding: "12px 14px", marginTop: 16, border: "1px dashed #E8E5DC" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>📱 Preview da notificação</div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: "#fff", borderRadius: 8, border: "1px solid #F0EBED" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#E85A8C", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>D</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2C2C2A" }}>{preview.titulo}</div>
                  <div style={{ fontSize: 11.5, color: "#5F5E5A", marginTop: 2, lineHeight: 1.35 }}>{preview.corpo}</div>
                  <div style={{ fontSize: 10, color: "#B4B2A9", marginTop: 4 }}>Doonly · agora</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => salvar(meta.evento)}
                disabled={!isDirty || isSaving}
                style={{ all: "unset", cursor: (!isDirty || isSaving) ? "not-allowed" : "pointer", padding: "10px 20px", background: isDirty ? "#E85A8C" : "#F0EBED", color: isDirty ? "#fff" : "#888780", fontSize: 13, fontWeight: 700, borderRadius: 8, opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? "Salvando..." : isDirty ? "Salvar alterações" : "Salvo ✓"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
