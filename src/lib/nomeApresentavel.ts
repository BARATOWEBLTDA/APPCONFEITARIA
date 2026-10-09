/**
 * Primeiro nome pronto pra aparecer em destaque (09/10 · 3.76), como na primeira tela das boas-vindas.
 * Devolve "" quando não dá pra confiar no nome: vazio, curto demais, com número ou símbolo, letra repetida,
 * teclado batido ("asdf"), palavra de teste ou brincadeira ("teste", "kkk") ou palavrão/ofensa.
 * Nesses casos, quem chama mostra a marca do Doonly no lugar do nome.
 */

// comparação sem acento e em minúsculas
const limpar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// palavras que, sozinhas, não são nome de verdade (teste, brincadeira, cargo, "ninguém")
const NAO_E_NOME = new Set([
  'teste', 'testes', 'test', 'testando', 'tst', 'asdf', 'asd', 'qwerty', 'qwe', 'abc', 'xyz', 'xxx', 'aaa', 'zzz',
  'admin', 'adm', 'usuario', 'usuaria', 'user', 'cliente', 'confeiteira', 'confeiteiro', 'loja', 'doceria', 'confeitaria',
  'fulano', 'fulana', 'ciclano', 'ciclana', 'beltrano', 'beltrana', 'ninguem', 'nada', 'nome', 'sem', 'eu', 'voce', 'oi', 'ola',
  'kkk', 'kkkk', 'kkkkk', 'rsrs', 'rsrsrs', 'haha', 'hahaha', 'hehe', 'hehehe', 'lol', 'blz', 'sla', 'nao', 'sim', 'null', 'undefined',
  'doonly', 'gmail', 'hotmail', 'email', 'xpto',
])

// ofensas e palavrões: palavra inteira (curtas, que aparecem dentro de nomes reais, ficam só aqui)
const OFENSA_INTEIRA = new Set([
  'cu', 'pau', 'rola', 'puta', 'puto', 'burro', 'burra', 'corno', 'corna', 'bunda', 'peido', 'lixo', 'feio', 'feia', 'bicha',
  'gay', 'viado', 'veado', 'ass', 'sex', 'sexo', 'anus', 'penis', 'vagina', 'diabo', 'demonio', 'macaco', 'macaca', 'mongol',
  'boiola', 'baitola', 'sapatao', 'traveco', 'gorda', 'gordo', 'baleia', 'nazi', 'hitler', 'satanas', 'capeta',
])
// ofensas e palavrões: em qualquer parte (longas o bastante pra não pegar nome de verdade)
const OFENSA_DENTRO = [
  'porra', 'caralh', 'buceta', 'boceta', 'merda', 'bosta', 'foda', 'fuder', 'foder', 'piroca', 'pinto', 'xoxota', 'xereca',
  'cacete', 'arromb', 'otari', 'idiota', 'imbecil', 'vagabund', 'vadia', 'safad', 'escrot', 'desgrac', 'retardad', 'babaca',
  'putinha', 'punheta', 'siririca', 'cuzao', 'fdp', 'pqp', 'vsf', 'tnc', 'fuck', 'shit', 'bitch', 'dick', 'cock', 'pussy', 'porn',
]

export function nomeApresentavel(nomeCompleto?: string | null): string {
  const primeiro = String(nomeCompleto || '').trim().split(/\s+/)[0] || ''
  if (primeiro.length < 2 || primeiro.length > 20) return ''
  // só letras (com acento), hífen e apóstrofo: número, símbolo e emoji ficam de fora
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(primeiro)) return ''
  const n = limpar(primeiro)
  if (!/[aeiouy]/.test(n)) return ''              // sem vogal não é nome ("xpto", "hjkl")
  if (/(.)\1\1/.test(n)) return ''                 // três letras iguais seguidas ("aaaa", "kkk")
  if (/^(ha|he|hi|hu|ah|eh|rs|ka|ke|kk)+$/.test(n)) return '' // risada ("haha", "rsrs", "kaka"); "Lili" e "Juju" passam
  if (NAO_E_NOME.has(n) || OFENSA_INTEIRA.has(n)) return ''
  if (OFENSA_DENTRO.some(p => n.includes(p))) return ''
  // "jULIANA" ou "JULIANA" vira "Juliana"; nome composto com hífen mantém as duas partes ("Ana-Clara")
  return primeiro.toLocaleLowerCase('pt-BR').replace(/(^|[-'’])(\p{L})/gu, (_, sep, l) => sep + l.toLocaleUpperCase('pt-BR'))
}
