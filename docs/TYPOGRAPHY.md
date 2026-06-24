# Sistema Tipográfico do Doonly

Guia rápido de quando usar cada token. Sempre que criar um componente novo, consulte este arquivo antes de chutar `font-size` manualmente.

## Arquitetura em 2 camadas

```
┌─────────────────────────────────────┐
│  SEMÂNTICOS  (--font-*)             │  ← componentes consomem ESTES
│  "qual papel esse texto tem?"       │
└──────────────┬──────────────────────┘
               │ derivam de
               ▼
┌─────────────────────────────────────┐
│  PRIMITIVOS  (--text-*, --fw-*...)  │  ← escala bruta, agnóstica
│  "qual tamanho/peso/altura?"        │
└─────────────────────────────────────┘
```

**Regra de ouro:** componentes nunca usam primitivos diretamente. Sempre semânticos.

## Tabela de uso

| Token | Tamanho | Onde usar |
|---|---|---|
| `--font-page-title` | 24px | `<h1>` do topo de página (ex: "Insumos", "Produtos") |
| `--font-page-subtitle` | 14px | Subtítulo logo abaixo do h1 ("3 insumos cadastrados") |
| `--font-modal-title` | 18px | Título de qualquer modal ("Editar produto", "Cadastrar insumo") |
| `--font-section-label` | 12px | Rótulo de agrupamento uppercase ("DADOS BÁSICOS") |
| `--font-card-title` | 16px | Título dentro de cards (nome do produto/insumo) |
| `--font-field-label` | 14px | Label acima do input ("Nome do insumo *") |
| `--font-input` | 16px | Valor digitado no input. **16px é importante: evita zoom no iOS** |
| `--font-body` | 16px | Parágrafos, texto comum |
| `--font-helper` | 12px | Texto auxiliar abaixo do input ("Custo unitário: R$ X") |
| `--font-button` | 14px | Texto dos botões |
| `--font-caption` | 12px | Legendas, metadados, "Cancelar", timestamps |
| `--font-stat-value` | 24px | Números grandes em dashboards |
| `--font-stat-label` | 12px | Legenda uppercase abaixo do número de stat |

## Pesos (`--fw-*`)

| Token | Valor | Quando |
|---|---|---|
| `--fw-regular` | 400 | Corpo de texto longo |
| `--fw-medium` | 500 | Inputs, texto neutro |
| `--fw-semibold` | 600 | Labels, captions, ênfase suave |
| `--fw-bold` | 700 | Títulos, botões |
| `--fw-black` | 800 | Destaques fortes (valores em preview, números de stat) |

## Altura de linha (`--lh-*`)

| Token | Valor | Quando |
|---|---|---|
| `--lh-tight` | 1.2 | Títulos (h1, modal title, stat value) |
| `--lh-normal` | 1.4 | Labels, botões, textos curtos |
| `--lh-relaxed` | 1.6 | Parágrafos longos |

## Letter-spacing (`--ls-*`)

| Token | Valor | Quando |
|---|---|---|
| `--ls-tight` | -0.01em | Títulos grandes (visualmente mais apertados) |
| `--ls-normal` | 0 | Default |
| `--ls-wide` | 0.04em | Labels uppercase ("DADOS BÁSICOS", stat labels) |

## Duas formas de consumir

### Opção A — Direto na classe local do componente (recomendado para componentes existentes)

```css
.minha-classe {
  font-size: var(--font-modal-title);
  font-weight: var(--fw-bold);
  line-height: var(--lh-tight);
  color: var(--text-title);
}
```

### Opção B — Classe utilitária `.tp-*` (recomendado para componentes novos)

```jsx
<h2 className="tp-modal-title" style={{ color: 'var(--text-title)' }}>
  Cadastrar insumo
</h2>
```

Classes disponíveis em `src/styles/typography.css`:

- `.tp-page-title`, `.tp-page-subtitle`
- `.tp-modal-title`
- `.tp-card-title`
- `.tp-section-label`
- `.tp-field-label`
- `.tp-input`
- `.tp-body`, `.tp-helper`, `.tp-caption`
- `.tp-button`
- `.tp-stat-value`, `.tp-stat-label`

**Nota:** as classes `.tp-*` definem só tipografia (size, weight, line-height, letter-spacing). **Cor e layout ficam fora** — você define no contexto.

## Regras de manutenção

1. **Não adicione novos `--font-*` sem justificativa.** Antes de criar, pergunte: "esse uso já é coberto por algum dos existentes?"
2. **Variantes de cor/estado NÃO viram classes utilitárias.** Não crie `.tp-modal-title-danger`. Use `style={{ color: 'var(--error)' }}` no ponto de uso.
3. **Se um padrão se repete em 3+ componentes, vire classe `.tp-*`.** Se está só em 1 lugar, mantenha local.
4. **Tema escuro não duplica tipografia.** Tamanhos, pesos, lh e ls são iguais nos dois temas. Só cores variam.
