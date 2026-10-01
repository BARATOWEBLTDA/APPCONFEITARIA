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
  // A tela "Dados da loja" grava o horário como texto (JSON): lê dos dois jeitos.
  // E quem abre só no fim de semana também conta (antes exigia dia útil).
  let horario: any = profile?.horario || null;
  if (typeof horario === "string") { try { horario = JSON.parse(horario); } catch { horario = null; } }
  const temHorario = !!horario && (
    (Array.isArray(horario.dias) && horario.dias.length > 0 && (horario.abertura || "").trim() && (horario.fechamento || "").trim()) ||
    (horario.abre_sabado && (horario.sabado_abertura || "").trim()) ||
    (horario.abre_domingo && (horario.domingo_abertura || "").trim())
  );
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
