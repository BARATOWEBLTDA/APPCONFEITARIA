/**
 * ═══════════════════════════════════════════════════════════════════
 * CARDAPIO VALIDACAO — check se cardápio tem essenciais pra publicar
 * ═══════════════════════════════════════════════════════════════════
 *
 * Regra de "cardápio pronto pra publicar":
 * - Nome da loja preenchido
 * - Endereço da loja: cidade + (rua ou CEP), a mesma regra da tela Dados da loja
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

  // (11/10) O endereço é guardado como JSON ({"rua":"","cidade":"",...}): o texto nunca é vazio,
  // então loja com o endereço em branco passava. Agora lê o JSON e usa a regra da tela Dados da loja:
  // cidade + (rua ou CEP).
  const txt = (v: unknown) => (v == null ? "" : String(v).trim());
  let end: any = profile?.endereco ?? null;
  let ruaSolta = "";
  if (typeof end === "string") {
    const bruto = end;
    try { end = JSON.parse(bruto); } catch { end = null; ruaSolta = bruto.trim(); } // endereço antigo, escrito direto
  }
  if (!end || typeof end !== "object") end = {};
  const cidade = txt(end.cidade) || txt(profile?.cidade);
  const rua = txt(end.rua) || ruaSolta;
  const cep = txt(end.cep) || txt(profile?.cep);
  const temLocalizacao = !!cidade && (!!rua || !!cep);
  if (!temLocalizacao) faltando.push("Endereço da loja (cidade e rua ou CEP)");

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
