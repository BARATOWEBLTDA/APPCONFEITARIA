# Design Tokens do Doonly

Guia rápido de referência. Sempre consulte antes de chutar valores manualmente em CSS.

## Arquitetura

```
┌─────────────────────────────────────┐
│  SEMÂNTICOS                          │  ← componentes consomem ESTES
│  "qual papel esse elemento exerce?" │
└──────────────┬──────────────────────┘
               │ derivam de
               ▼
┌─────────────────────────────────────┐
│  PRIMITIVOS                          │  ← escala bruta, agnóstica
│  "qual valor numérico bruto?"       │
└─────────────────────────────────────┘
```

**Regra de ouro:** componentes consomem **semânticos** quando existirem. Primitivos só se nenhum semântico cobrir o caso.

---

## 1. Tipografia

### Primitivos — Tamanhos

| Token | Valor | px |
|---|---|---|
| `--text-xs` | 0.75rem | 12 |
| `--text-sm` | 0.875rem | 14 |
| `--text-md` | 1rem | 16 |
| `--text-lg` | 1.125rem | 18 |
| `--text-xl` | 1.25rem | 20 |
| `--text-2xl` | 1.5rem | 24 |
| `--text-3xl` | 1.75rem | 28 |

### Primitivos — Pesos
`--fw-regular` (400) · `--fw-medium` (500) · `--fw-semibold` (600) · `--fw-bold` (700) · `--fw-black` (800)

### Primitivos — Altura de linha
`--lh-tight` (1.2) · `--lh-normal` (1.4) · `--lh-relaxed` (1.6)

### Primitivos — Letter-spacing
`--ls-tight` (-0.01em) · `--ls-normal` (0) · `--ls-wide` (0.04em)

### Semânticos

| Token | Valor | Quando usar |
|---|---|---|
| `--font-page-title` | 24px | h1 do topo de página |
| `--font-page-subtitle` | 14px | Subtítulo logo abaixo do h1 |
| `--font-modal-title` | 18px | Título dentro de modais |
| `--font-section-label` | 12px | Rótulo de agrupamento ("DADOS BÁSICOS") |
| `--font-card-title` | 16px | Título dentro de cards |
| `--font-field-label` | 14px | Label acima do input |
| `--font-input` | 16px | Valor digitado (16px = sem zoom iOS) |
| `--font-body` | 16px | Parágrafos, texto comum |
| `--font-helper` | 12px | Texto auxiliar abaixo do input |
| `--font-button` | 14px | Texto dos botões |
| `--font-caption` | 12px | Legendas, metadados |
| `--font-stat-value` | 24px | Números grandes em dashboards |
| `--font-stat-label` | 12px | Legenda do número de stat |

### Classes utilitárias (typography.css)
Disponíveis pra uso direto no JSX: `.tp-page-title`, `.tp-modal-title`, `.tp-card-title`, `.tp-section-label`, `.tp-field-label`, `.tp-input`, `.tp-body`, `.tp-helper`, `.tp-caption`, `.tp-button`, `.tp-stat-value`, `.tp-stat-label`.

---

## 2. Espaçamento

### Primitivos (escala 4px)

| Token | Valor | px |
|---|---|---|
| `--space-1` | 0.25rem | 4 |
| `--space-2` | 0.5rem | 8 |
| `--space-3` | 0.75rem | 12 |
| `--space-4` | 1rem | 16 |
| `--space-5` | 1.25rem | 20 |
| `--space-6` | 1.5rem | 24 |
| `--space-7` | 2rem | 32 |
| `--space-8` | 2.5rem | 40 |
| `--space-9` | 3rem | 48 |

### Semânticos

| Token | Valor | Quando usar |
|---|---|---|
| `--gap-tight` | 8px | Chips, badges, botões em linha |
| `--gap-stack` | 12px | Campos empilhados em form |
| `--gap-section` | 24px | Entre seções de modal/página |
| `--pad-input` | 12px 16px | Padding interno de input |
| `--pad-card` | 16px | Padding interno de card |
| `--pad-modal` | 20px | Padding interno de modal |
| `--pad-page` | 16px | Padding lateral da página (mobile) |
| `--margin-header` | 20px | Espaço depois do header da página |

---

## 3. Raios (border-radius)

### Primitivos

| Token | Valor | Quando |
|---|---|---|
| `--radius-sm` | 6px | Tags, badges pequenos, botões secundários compactos |
| `--radius-md` | 10px | Inputs, botões padrão, cards internos |
| `--radius-lg` | 14px | Cards principais, modais |
| `--radius-xl` | 20px | Hero cards, destaque |
| `--radius-full` | 999px | Pílulas, avatares, botões redondos |

### Semânticos (legados, ainda em uso)

| Token | Aponta para | Uso |
|---|---|---|
| `--radius-card` | `--radius-lg` (14px) | Cards e modais |
| `--radius-btn` | `--radius-full` | Botões pill |
| `--radius-input` | `--radius-full` | Inputs pill |

---

## 4. Motion (animações)

### Durations

| Token | Valor | Quando |
|---|---|---|
| `--dur-fast` | 120ms | Hover, foco, micro-interações |
| `--dur-normal` | 200ms | Dropdown, troca de aba, accordions |
| `--dur-slow` | 300ms | Abertura de modal, drawer |

### Easings

| Token | Valor | Quando |
|---|---|---|
| `--ease-out` | cubic-bezier(0.2, 0.8, 0.2, 1) | Entradas (padrão) |
| `--ease-in` | cubic-bezier(0.4, 0, 1, 1) | Saídas |
| `--ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Transições contínuas |

### Uso típico

```css
transition: color var(--dur-fast) var(--ease-out);
transition: all var(--dur-fast) var(--ease-out);
transition: transform var(--dur-normal) var(--ease-out);
```

---

## Regras de manutenção

1. **Não adicione novos tokens sem justificativa.** Antes de criar, pergunte: "esse uso já é coberto por algum existente?"
2. **Componentes consomem semânticos.** Primitivos só quando nenhum semântico cobre.
3. **Variantes de cor/estado NÃO viram classes utilitárias.** Use `style={{ color: 'var(--error)' }}` no ponto de uso.
4. **Se um padrão se repete em 3+ componentes, considere virar token semântico.** Se está só em 1 lugar, mantenha local.
5. **Tema escuro NÃO duplica esses tokens.** Só cores variam entre temas. Tipografia/spacing/radius/motion são iguais nos dois.

---

## Cobertura atual

| Eixo | Status |
|---|---|
| Cores | ✅ Sistema completo (claro/escuro) |
| Tipografia | ✅ Primitivos + semânticos + classes `.tp-*` |
| Espaçamento | ✅ Primitivos + semânticos |
| Raios | ✅ Primitivos + semânticos legados |
| Motion | ✅ Durations + easings |
| Sombras | ✅ Pré-existente (4 níveis) |
| Z-index | ⏳ Adiar — criar quando der primeiro bug |
| Breakpoints | ⏳ Adiar — CSS vars não funcionam em `@media` nativamente |
| Opacity/Borders | ⏳ Adiar — sem dor real |
