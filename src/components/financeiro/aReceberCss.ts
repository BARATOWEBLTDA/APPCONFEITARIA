/** (29/10 · 4.65) Visual da tela A receber, num arquivo só: a tela usa e a demonstração do tutorial também (fica igual ao app). */
export const CSS_A_RECEBER = `
  /* (24/10) busca + filtro da lateral */
  .far-bb { display: flex; gap: 8px; align-items: center; }
  .far-busca { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; height: 48px; background: var(--ui-branco); border: 1px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 0 12px; color: var(--ui-texto-3); box-sizing: border-box; }
  .far-busca input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 16px; color: var(--ui-texto); background: none; }
  .far-busca input::-webkit-search-cancel-button { display: none; }
  .far-busca button { border: 0; background: none; color: var(--ui-texto-3); display: flex; padding: 6px; cursor: pointer; }
  .far-semres { text-align: center; color: var(--ui-texto-2); font-size: 14px; margin: 8px 0; }

  .far-root { font-family: var(--font-base); }
  /* 10/10: mesma largura de conteúdo de Transações (antes 760px, em uma coluna estreita no PC) */
  .far-wrap { max-width: 980px; margin: 0 auto; padding: 22px 0 96px; display: flex; flex-direction: column; gap: 20px; }
  .far-resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .far-k { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 12px 10px; min-width: 0; container-type: inline-size; }
  .far-k small { display: block; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
  .far-k b { display: block; font-size: clamp(13.5px, 3.9vw, 17px); letter-spacing: -.02em; font-weight: 700; color: var(--ui-laranja); margin: 3px 0 1px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* 11/10: o valor cabe inteiro. A letra encolhe até caber na largura do cartão (--far-n = letras do maior valor;
     0,64 = largura média de cada letra de um valor em reais na Poppins Bold). Nunca passa do tamanho de antes nem fica menor que 10px. */
  .far-k b { font-size: max(10px, min(clamp(13.5px, 3.9vw, 17px), calc(100cqi / (var(--far-n, 11) * .64)))); }
  .far-k i { font-style: normal; font-size: 13px; color: #888780; }
  .far-k--atr { border-color: #FECACA; background: #FFF7F7; } .far-k--atr b { color: var(--ui-vermelho); }
  .far-k--zero b { color: var(--ui-texto-3); }
  .far-carregando { text-align: center; color: var(--ui-texto-3); font-size: 14px; padding: 30px 0; }
  .far-vazio { background: var(--ui-branco); border-radius: var(--ui-raio-cartao); padding: 30px 20px; text-align: center; border: 1px solid #F0EBED; }
  .far-vazio-ic { width: 64px; height: 64px; border-radius: 20px; background: #F0FDF4; color: #16A34A; display: inline-flex; align-items: center; justify-content: center; }
  .far-vazio b { display: block; font-size: 17px; font-weight: 700; margin-top: 12px; color: var(--ui-texto); }
  .far-vazio p { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 6px auto 0; max-width: 360px; text-wrap: balance; }
  .far-gt { margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); }
  .far-gt span { color: var(--ui-texto-2); }
  .far-lista { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .far-tab { display: none; }
  @media (min-width: 901px) {
    .far-grupo .far-lista { display: none; }
    .far-tab { display: block; overflow: hidden; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: 16px; box-shadow: var(--ui-sombra-cartao); }
    .far-tr { display: grid; grid-template-columns: minmax(0, 2.3fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr) 168px; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px; font-size: 13.5px; color: var(--ui-texto); }
    .far-tr + .far-tr { border-top: 1px solid var(--ui-linha); }
    .far-th { min-height: 38px; background: #FAFAFA; font-size: 12px; font-weight: 500; color: var(--ui-texto-2); }
    .far-td-p { display: flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; }
    .far-td-p b { overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .far-td-p em { flex: none; font-style: normal; font-size: 12.5px; color: var(--ui-texto-2); }
    .far-td-p .far-tg { flex: none; margin-left: 4px; }
    .far-td-pg { display: flex; flex-direction: column; gap: 4px; }
    .far-td-pg .far-bar { display: block; width: 90px; margin: 0; }
    .far-td-f { font-weight: 700; color: var(--ui-laranja); white-space: nowrap; }
    .far-tr .far-bts { justify-content: flex-end; }
  }
  @media (min-width: 900px) { .far-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .far-it { min-width: 0; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 14px; }
  .far-it-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .far-it-h b { font-size: 14.5px; font-weight: 700; color: var(--ui-texto); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .far-tg { flex-shrink: 0; font-size: 12px; font-weight: 700; color: #92400E; background: var(--ui-laranja-fundo); padding: 3px 8px; border-radius: 7px; }
  .far-tg--atr { color: var(--ui-vermelho-escuro); background: var(--ui-vermelho-fundo); }
  .far-it-v { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 6px; }
  .far-it-v small { font-size: 12.5px; color: #888780; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; } /* em uma linha só */
  .far-it-v b { font-size: 15.5px; font-weight: 700; color: var(--ui-laranja); white-space: nowrap; }
  .far-bar { height: 6px; border-radius: 9px; background: var(--ui-linha); margin-top: 9px; overflow: hidden; }
  .far-bar i { display: block; height: 100%; background: #22C55E; border-radius: 9px; }
  .far-it-a { display: flex; justify-content: space-between; align-items: center; margin-top: 11px; gap: 8px; }
  @media (max-width: 360px) { .far-ver span { display: none; } .far-ver { padding: 0; } }
  .far-it-a > span { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--ui-texto-2); }
  .far-bts { display: flex; gap: 6px; }
  .far-ver { min-width: 44px; height: 44px; padding: 0 12px; gap: 6px; font-family: inherit; font-size: 13.5px; font-weight: 700; flex-shrink: 0; border-radius: var(--ui-raio-p); border: 1.5px solid var(--ui-borda-campo); background: var(--ui-branco); color: var(--ui-texto-2); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .far-rec { border: none; border-radius: var(--ui-raio-p); padding: 0 16px; height: 44px; background: #16A34A; color: var(--ui-branco); font-family: inherit; font-weight: 700; font-size: 13.5px; cursor: pointer; }
  .far-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
  @media (min-width: 768px) { .far-ov { align-items: center; } }
  .far-sh { width: 100%; max-width: 460px; background: var(--ui-branco); border-radius: var(--ui-raio-janela) var(--ui-raio-janela) 0 0; padding: 10px 18px calc(20px + env(safe-area-inset-bottom, 0px)); max-height: 92dvh; overflow-y: auto; color: var(--ui-texto); animation: farSobe .22s ease; }
  @media (min-width: 768px) { .far-sh { border-radius: 22px; } }
  @keyframes farSobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  .far-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
  .far-sh-t { display: block; font-size: 19px; font-weight: 700; }
  .far-sh-s { display: block; font-size: 13px; color: var(--ui-texto-2); margin: 2px 0 12px; }
  .far-res { background: #FAF7F8; border-radius: var(--ui-raio); padding: 8px 12px; }
  .far-res div { display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; color: var(--ui-cinza-texto); }
  .far-res b { font-weight: 700; color: var(--ui-texto); } .far-res b.ok { color: var(--ui-verde); }
  .far-res .tt { border-top: 1px solid #F0EBED; margin-top: 4px; padding-top: 8px; font-size: 15px; }
  .far-lb { display: block; font-size: 13px; font-weight: 700; color: var(--ui-cinza-texto); margin: 14px 0 6px; }
  .far-in { display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--ui-rosa); border-radius: var(--ui-raio); padding: 0 12px; height: 52px; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .far-in span { font-size: 18px; color: var(--ui-texto-2); font-weight: 700; }
  .far-in input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 22px; font-weight: 700; color: var(--ui-texto); background: none; }
  .far-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .far-chips button { border: 1.5px solid var(--ui-borda-campo); background: var(--ui-branco); border-radius: var(--ui-raio-p); padding: 9px 13px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: var(--ui-texto); cursor: pointer; }
  .far-chips button.on { border-color: var(--ui-escolha); background: var(--ui-escolha-fundo); color: var(--ui-escolha); }
  .far-data { margin-top: 8px; width: 100%; min-width: 0; max-width: 100%; -webkit-appearance: none; appearance: none; background: var(--ui-branco); height: 46px; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 0 12px; font-family: inherit; font-size: 16px; }
  .far-prev { margin-top: 14px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--ui-raio); padding: 10px 12px; }
  .far-prev b { display: block; font-size: 14px; color: #92400E; } .far-prev small { font-size: 13px; color: #92400E; }
  .far-prev--ok { background: #F0FDF4; border-color: #BBF7D0; } .far-prev--ok b, .far-prev--ok small { color: #166534; }
  .far-erro { margin: 10px 0 0; font-size: 13px; font-weight: 700; color: var(--ui-vermelho); }
  .far-cta { margin-top: 16px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: var(--ui-raio-botao); padding: 15px; background: #16A34A; color: var(--ui-branco); font-family: inherit; font-size: 15.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(22,163,74,.3); }
  .far-cta:disabled { opacity: .6; cursor: default; }
  .far-toast { position: fixed; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1400; background: var(--ui-vinho-escuro); color: var(--ui-branco); padding: 12px 16px; border-radius: var(--ui-raio); font-size: 13.5px; font-weight: 700; box-shadow: 0 10px 26px rgba(0,0,0,.25); max-width: calc(100vw - 32px); }
`;
