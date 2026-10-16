/**
 * (16/10) A mensagem que vai junto com o link do cardápio, igual em todo lugar do app
 * (Início, Cardápio, prévia, passo a passo). O link fica sozinho na linha de baixo e vai dentro do texto:
 * se for separado, cada celular junta texto e link de um jeito (e às vezes o link aparecia duas vezes).
 */
export const textoCardapio = (link: string) => `Olá! Já dá pra fazer seu pedido pelo nosso cardápio online:\n${link}`;
