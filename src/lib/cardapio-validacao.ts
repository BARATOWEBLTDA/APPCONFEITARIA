/**
 * ═══════════════════════════════════════════════════════════════════
 * CARDAPIO VALIDACAO — check se cardápio tem essenciais pra publicar
 * ═══════════════════════════════════════════════════════════════════
 *
 * Regra de "cardápio pronto pra publicar":
 * - Nome da loja preenchido
 * - Alguma info de localização (cidade OU endereço)
 * - Horário configurado (dias + horário abre/fecha)
 *
 * Retorna a lista do que falta, pra mostrar mensagem clara pra confeiteira.
 * ═══════════════════════════════════════════════════════════════════
 */

export interface CardapioValidacao {
  completo: boolean;
  faltando: string[];
  mensagem: string;
}

export function validarCardapio(profile: any): CardapioValidacao {
  const faltando: string[] = [];

  const nomeLoja = (profile?.nome_loja || "").trim();
  if (!nomeLoja) faltando.push("Nome da loja");

  const temLocalizacao =
    (profile?.cidade || "").trim() ||
    (profile?.endereco || "").trim() ||
    (profile?.cep || "").trim();
  if (!temLocalizacao) faltando.push("Localização (cidade ou endereço)");

  // Horário: verifica se tem pelo menos 1 dia + horário abre/fecha
  const horario = profile?.horario || null;
  const temHorario =
    horario &&
    Array.isArray(horario.dias) &&
    horario.dias.length > 0 &&
    (horario.abertura || "").trim() &&
    (horario.fechamento || "").trim();
  if (!temHorario) faltando.push("Horário de funcionamento");

  let mensagem = "";
  if (faltando.length === 0) {
    mensagem = "Cardápio pronto pra publicar!";
  } else if (faltando.length === 1) {
    mensagem = `Falta preencher: ${faltando[0]}`;
  } else {
    const ultimo = faltando[faltando.length - 1];
    const anteriores = faltando.slice(0, -1).join(", ");
    mensagem = `Falta preencher: ${anteriores} e ${ultimo}`;
  }

  return {
    completo: faltando.length === 0,
    faltando,
    mensagem,
  };
}
