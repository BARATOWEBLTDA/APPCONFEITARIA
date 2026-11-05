import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSobreposicao } from "@/components/base/useSobreposicao";

// (6.161) saiu de Produtos.tsx para ser usado também no cadastro de ingrediente
// SelectDoonly — Seletor custom (mobile: bottom sheet, desktop: popover)
// ═══════════════════════════════════════════════════════════════
interface SelectDoonlyOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
}
interface SelectDoonlyProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectDoonlyOption[];
  placeholder?: string;
  title?: string;
  extraOptionLabel?: string;
  onExtraOption?: () => void;
  big?: boolean;
}
export default function SelectDoonly({
  value, onChange, options, placeholder = "Selecione...", title = "Escolha uma opção", extraOptionLabel, onExtraOption, big = false
}: SelectDoonlyProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pop, setPop] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // (11/10) no celular a lista abre por cima: o "voltar" do Android fecha a lista (e não volta o passo do cadastro)
  const sheetRef = useRef<HTMLDivElement>(null);
  useSobreposicao(open && isMobile, () => setOpen(false), sheetRef);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Calcula posição do popover (position: fixed baseado no trigger)
    if (!isMobile && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const espacoAbaixo = window.innerHeight - r.bottom;
      const alturaEstimada = Math.min(320, options.length * 34 + 30);
      // Se não cabe embaixo, abre pra cima
      const abrePraCima = espacoAbaixo < alturaEstimada + 20 && r.top > alturaEstimada;
      setPop({
        top: abrePraCima ? r.top - alturaEstimada - 6 : r.bottom + 6,
        left: r.left,
        width: r.width,
      });
    }
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false);
    };
    // Só fecha se scroll for FORA do popover (permite rolar categorias por dentro)
    // No mobile o dropdown vira bottom sheet fixed — não deve fechar em nenhum scroll
    const onScroll = (e: Event) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const t = setTimeout(() => {
      window.addEventListener("click", handler);
      if (!isMobile) window.addEventListener("scroll", onScroll, true);
    }, 10);
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", handler);
      if (!isMobile) window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, isMobile, options.length]);

  const selected = options.find(o => o.value === value);

  return (
    <div className="sd-wrap">
      <button
        ref={btnRef}
        type="button"
        className={`sd-trigger ${open ? "sd-trigger--open" : ""} ${big ? "sd-trigger--big" : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className={`sd-trigger-text ${!selected ? "sd-trigger-text--placeholder" : ""}`}>
          {selected ? (
            <>
              {selected.icon && <span className="sd-trigger-icon">{selected.icon}</span>}
              {selected.label}
            </>
          ) : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none"}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && isMobile && (
        <div className="sd-sheet-ov" onClick={() => setOpen(false)}>
          <div className="sd-sheet" ref={sheetRef} onClick={e => e.stopPropagation()}>
            <div className="sd-sheet-handle" />
            <div className="sd-sheet-title">{title}</div>
            <div className="sd-sheet-list">
              {options.map(op => (
                <button
                  key={op.value}
                  type="button"
                  className={`sd-sheet-item ${op.value === value ? "sd-sheet-item--ativo" : ""}`}
                  onClick={() => { onChange(op.value); setOpen(false); }}
                >
                  {op.icon && <span className="sd-item-icon">{op.icon}</span>}
                  <span className="sd-item-label">
                    {op.label}
                    {op.hint && <span className="sd-item-hint">{op.hint}</span>}
                  </span>
                  {op.value === value && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>
              ))}
              {extraOptionLabel && onExtraOption && (
                <button
                  type="button"
                  className="sd-sheet-item sd-sheet-item--extra"
                  onClick={() => { onExtraOption(); setOpen(false); }}
                >
                  <span className="sd-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </span>
                  <span className="sd-item-label">{extraOptionLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* (6.164) a lista vai pro body: dentro de uma janela (que tem transform) o position: fixed saía deslocado */}
      {open && !isMobile && pop && createPortal(
        <div
          ref={popRef}
          className="sd-popover"
          style={{ top: pop.top, left: pop.left, width: pop.width }}
          onClick={e => e.stopPropagation()}
        >
          {options.map(op => (
            <button
              key={op.value}
              type="button"
              className={`sd-pop-item ${op.value === value ? "sd-pop-item--ativo" : ""}`}
              onClick={() => { onChange(op.value); setOpen(false); }}
            >
              {op.icon && <span className="sd-item-icon">{op.icon}</span>}
              <span className="sd-item-label">
                {op.label}
                {op.hint && <span className="sd-item-hint">{op.hint}</span>}
              </span>
              {op.value === value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </button>
          ))}
          {extraOptionLabel && onExtraOption && (
            <button
              type="button"
              className="sd-pop-item sd-pop-item--extra"
              onClick={() => { onExtraOption(); setOpen(false); }}
            >
              <span className="sd-item-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
              <span className="sd-item-label">{extraOptionLabel}</span>
            </button>
          )}
        </div>, document.body
      )}

      <style>{`
        .sd-wrap { position: relative; width: 100%; }
        .sd-trigger {
          all: unset;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
          padding: 14px 14px;
          background: var(--ui-branco);
          border: 1.5px solid #E5D8DE;
          border-radius: var(--ui-raio-p);
          font-size: 15px;
          font-weight: 600;
          color: #2D1F26;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .sd-trigger:hover { border-color: var(--ui-rosa); }
        .sd-trigger--open {
          border-color: var(--ui-rosa);
          box-shadow: 0 0 0 3px rgba(232, 90, 140, 0.1);
        }
        .sd-trigger--big {
          padding: 20px 14px;
          font-size: 16px;
        }
        .sd-trigger-text {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sd-trigger-text--placeholder { color: var(--text-muted); font-weight: 500; }
        .sd-trigger-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px; height: 24px;
          background: var(--primary-light);
          color: var(--ui-rosa);
          border-radius: 6px;
          flex-shrink: 0;
        }

        /* Bottom sheet (mobile) */
        .sd-sheet-ov {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 4000;
          display: flex;
          align-items: flex-end;
          animation: sdFadeIn 0.2s ease;
        }
        @keyframes sdFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sd-sheet {
          width: 100%;
          background: var(--ui-branco);
          border-radius: var(--ui-raio-janela) var(--ui-raio-janela) 0 0;
          padding: 8px 16px 24px;
          max-height: 70vh;
          overflow-y: auto;
          animation: sdSlideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @keyframes sdSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .sd-sheet-handle {
          width: 40px; height: 4px;
          background: #E5D8DE;
          border-radius: 2px;
          margin: 8px auto 12px;
        }
        .sd-sheet-title {
          font-size: 15px;
          font-weight: 600;
          color: #2D1F26;
          text-align: center;
          margin-bottom: 12px;
        }
        .sd-sheet-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .sd-sheet-item {
          all: unset;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.12s;
          width: 100%;
          box-sizing: border-box;
        }
        .sd-sheet-item:hover { background: #FAF8F5; }
        .sd-sheet-item--ativo {
          background: #FDF3F7;
          color: #831843;
        }
        .sd-sheet-item--ativo .sd-item-label { font-weight: 600; }
        .sd-sheet-item--ativo svg { color: var(--ui-rosa); }
        .sd-sheet-item--extra {
          border-top: 1px solid #F0EBED;
          margin-top: 4px;
          padding-top: 14px;
          color: var(--ui-rosa);
        }
        .sd-sheet-item--extra .sd-item-label { font-weight: 600; }
        .sd-sheet-item--extra .sd-item-icon {
          background: var(--primary-light);
          color: var(--ui-rosa);
        }

        /* Popover (desktop) */
        .sd-popover {
          position: fixed;
          background: var(--ui-branco);
          border: 1px solid #F0EBED;
          border-radius: var(--ui-raio-p);
          box-shadow: 0 12px 32px rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.08);
          padding: 6px;
          z-index: 10300;
          max-height: 320px;
          overflow-y: auto;
          animation: sdPopIn 0.15s ease;
        }
        @keyframes sdPopIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sd-pop-item {
          all: unset;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 13.5px;
          color: #2D1F26;
          transition: background 0.12s;
          width: 100%;
          box-sizing: border-box;
        }
        .sd-pop-item:hover { background: #FAF8F5; }
        .sd-pop-item--ativo {
          background: #FDF3F7;
          color: #831843;
        }
        .sd-pop-item--ativo .sd-item-label { font-weight: 600; }
        .sd-pop-item--ativo svg { color: var(--ui-rosa); }
        .sd-pop-item--extra {
          border-top: 1px solid #F0EBED;
          margin-top: 4px;
          padding-top: 10px;
          color: var(--ui-rosa);
        }
        .sd-pop-item--extra .sd-item-label { font-weight: 600; }
        .sd-pop-item--extra .sd-item-icon {
          background: var(--primary-light);
          color: var(--ui-rosa);
        }

        /* Item shared */
        .sd-item-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px; height: 26px;
          background: #FAF8F5;
          color: var(--ui-texto-2);
          border-radius: 6px;
          flex-shrink: 0;
        }
        .sd-item-label {
          flex: 1;
          font-size: 14px;
          display: flex;
          flex-direction: column;
        }
        .sd-item-hint {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 500;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
