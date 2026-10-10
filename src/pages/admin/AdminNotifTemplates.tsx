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
import type { ReactNode } from "react";
import { Botao, Campo, CampoArea, TelaVazia, Titulo, avisar } from "@/components/base";
import { BellSlash, Check, Crown, SpeakerHigh, UserPlus, WarningCircle } from "@phosphor-icons/react";
import "./adminNotifTemplates.css";

type Som = "notificacao" | "pedido" | "nenhum";
interface Template {
  evento: string;
  titulo: string;
  corpo: string;
  som: Som;
  ativo: boolean;
  updated_at?: string;
}

const EVENTOS_META: { evento: string; icone: ReactNode; label: string; titulo: string; descricao: string; tom: "rosa" | "verde" }[] = [
  {
    evento: "indicacao_cadastro",
    icone: <UserPlus size={14} weight="bold" />,
    label: "Indicação · cadastro",
    titulo: "Alguém se cadastrou pelo seu link",
    descricao: "Vai quando uma pessoa cria a conta pelo link de indicação.",
    tom: "rosa",
  },
  {
    evento: "indicacao_pro",
    icone: <Crown size={14} weight="bold" />,
    label: "Indicação · virou PRO",
    titulo: "Indicado(a) assinou o PRO",
    descricao: "Vai quando alguém que você indicou vira PRO (conta pra meta).",
    tom: "verde",
  },
];

export default function AdminNotifTemplates() {
  const { tocar } = useSom();
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("notif_templates").select("*");
      if (error) {
        setErroCarregar(error.message);
        setLoading(false);
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
      avisar("Preencha o título e a mensagem.", { tipo: "erro" });
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
    if (error) return avisar("Não deu pra salvar: " + error.message, { tipo: "erro" });
    setDirty(d => ({ ...d, [evento]: false }));
    avisar("Modelo salvo.");
  };

  const testarSom = (som: Som) => {
    if (som === "nenhum") return;
    tocar(som);
  };

  if (loading) {
    return <div className="ant"><p className="ant-carregando">Carregando modelos…</p></div>;
  }

  const titulo = <Titulo nivel="tela" apoio="Avisos que o app manda sozinho quando algo acontece.">Notificações automáticas</Titulo>;
  const temAlgum = EVENTOS_META.some(meta => !!templates[meta.evento]);

  if (erroCarregar) {
    return (
      <div className="ant">
        {titulo}
        <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu pra carregar os modelos"
          texto={`Confira a internet e recarregue a página. Se continuar, a tabela de notificações pode não existir ainda (erro: ${erroCarregar}).`} />
      </div>
    );
  }

  if (!temAlgum) {
    return (
      <div className="ant">
        {titulo}
        <TelaVazia caixa icone={<BellSlash size={30} />} titulo="Nenhum modelo de notificação encontrado"
          texto="Rode o SQL de configuração das notificações e recarregue esta página." />
      </div>
    );
  }

  return (
    <div className="ant">
      {titulo}

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
          <section key={meta.evento} className="ant-card">
            <div className="ant-cab">
              <div className="ant-cab-tx">
                <i className={`ant-selo ant-selo--${meta.tom}`}>{meta.icone}{meta.label}</i>
                <b>{meta.titulo}</b>
                <small>{meta.descricao}</small>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={t.ativo}
                aria-label={t.ativo ? "Desligar esta notificação" : "Ligar esta notificação"}
                className={`ant-chave${t.ativo ? " on" : ""}`}
                onClick={() => editar(meta.evento, "ativo", !t.ativo)}
              >
                <span>{t.ativo ? "Ligada" : "Desligada"}</span>
                <i aria-hidden="true"><em /></i>
              </button>
            </div>

            <div className="ant-campos">
              <Campo rotulo="Título" value={t.titulo} onChange={e => editar(meta.evento, "titulo", e.target.value)} />
              <CampoArea
                rotulo="Mensagem"
                rows={2}
                value={t.corpo}
                onChange={e => editar(meta.evento, "corpo", e.target.value)}
                dica="Use {nome} pro nome da pessoa e {codigo} pro código de indicação."
              />
              <div className="ant-som">
                <label className="ant-som-c">
                  <span>Som</span>
                  <select value={t.som} onChange={e => editar(meta.evento, "som", e.target.value as Som)}>
                    <option value="notificacao">Notificação (padrão)</option>
                    <option value="pedido">Pedido (sino de caixa)</option>
                    <option value="nenhum">Sem som</option>
                  </select>
                </label>
                <Botao variante="secundario" icone={<SpeakerHigh size={20} weight="bold" />} onClick={() => testarSom(t.som)} disabled={t.som === "nenhum"}>Testar som</Botao>
              </div>
            </div>

            <div className="ant-prev">
              <p className="ant-prev-r">Como vai aparecer</p>
              <div className="ant-prev-l">
                <span className="ant-prev-ic" aria-hidden="true">D</span>
                <div className="ant-prev-tx">
                  <b>{preview.titulo}</b>
                  <p>{preview.corpo}</p>
                  <small>Doonly · agora</small>
                </div>
              </div>
            </div>

            <div className="ant-pe">
              <Botao
                tamanho="m"
                variante={isDirty ? "principal" : "secundario"}
                icone={!isDirty && !isSaving ? <Check size={18} weight="bold" /> : undefined}
                carregando={isSaving}
                disabled={!isDirty || isSaving}
                onClick={() => salvar(meta.evento)}
              >
                {isDirty || isSaving ? "Salvar alterações" : "Salvo"}
              </Botao>
            </div>
          </section>
        );
      })}
    </div>
  );
}
