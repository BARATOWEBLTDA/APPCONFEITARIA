/**
 * Editar perfil (Configurações). 09/10 (3.55): na Janela do app, com Campo e Botao do guia.
 * Foto, nome, WhatsApp, e-mail (só leitura) e "Trocar a senha" (abre embaixo, pede a senha atual).
 * Os dados e as ações vêm do Configuracoes.tsx.
 */
import { useEffect, useState } from "react";
import { Camera, CaretDown, LockSimple } from "@phosphor-icons/react";
import { Botao, Campo, Janela } from "@/components/base";
import "./editarPerfil.css";

interface Props {
  open: boolean;
  onClose: () => void;
  nome: string;
  telefone: string;
  email: string;
  fotoPreview: string | null;
  inicial: string;
  onNomeChange: (v: string) => void;
  onTelefoneChange: (v: string) => void;
  onFotoClick: () => void;
  onSave: () => Promise<void> | void;
  saving: boolean;
  uploading: boolean;
  senhaAtual: string;
  novaSenha: string;
  confirmSenha: string;
  senhaMsg: string;
  savingSenha: boolean;
  onSenhaAtualChange: (v: string) => void;
  onNovaSenhaChange: (v: string) => void;
  onConfirmSenhaChange: (v: string) => void;
  onAlterarSenha: () => Promise<void> | void;
  saveError?: string;
  saveSuccess?: boolean;
}

export default function EditarPerfilModal({
  open, onClose, nome, telefone, email, fotoPreview, inicial,
  onNomeChange, onTelefoneChange, onFotoClick, onSave, saving, uploading,
  senhaAtual, novaSenha, confirmSenha, senhaMsg, savingSenha,
  onSenhaAtualChange, onNovaSenhaChange, onConfirmSenhaChange, onAlterarSenha, saveError,
}: Props) {
  const [showSenha, setShowSenha] = useState(false);
  useEffect(() => { if (!open) { const t = setTimeout(() => setShowSenha(false), 300); return () => clearTimeout(t); } }, [open]);
  const senhaOk = /alterada/i.test(senhaMsg);

  return (
    <Janela aberta={open} aoFechar={onClose} tipo="conteudo" titulo="Editar perfil"
      acoes={<><Botao variante="secundario" onClick={onClose}>Cancelar</Botao><Botao onClick={() => onSave()} carregando={saving} disabled={uploading}>Salvar</Botao></>}>
      <div className="ep9">
        <button type="button" className="ep9-foto" onClick={() => !uploading && onFotoClick()} aria-label={fotoPreview ? "Trocar a foto" : "Colocar uma foto"}>
          <span className="ep9-av">{fotoPreview ? <img src={fotoPreview} alt="" /> : <b>{inicial}</b>}</span>
          <i aria-hidden="true">{uploading ? <span className="ui-gira" /> : <Camera size={16} weight="bold" />}</i>
          <small>{fotoPreview ? "Trocar a foto" : "Colocar uma foto"}</small>
        </button>

        <Campo rotulo="Nome" placeholder="Seu nome" value={nome} autoComplete="name" onChange={e => onNomeChange(e.target.value)} />
        <Campo rotulo="WhatsApp" type="tel" inputMode="tel" placeholder="(41) 99999-8888" value={telefone} autoComplete="tel" onChange={e => onTelefoneChange(e.target.value)} />
        <Campo rotulo="E-mail" type="email" value={email} disabled dica="Pra trocar o e-mail, fale com o suporte." onChange={() => {}} />
        {saveError && <p className="ep9-erro" role="alert">{saveError}</p>}

        <div className="ep9-senha">
          <button type="button" className="ep9-senha-bt" aria-expanded={showSenha} onClick={() => setShowSenha(s => !s)}>
            <LockSimple size={20} weight="bold" /><span>Trocar a senha</span><CaretDown size={18} weight="bold" className={showSenha ? "aberto" : ""} />
          </button>
          {showSenha && (
            <div className="ep9-senha-c">
              <Campo rotulo="Senha atual" type="password" autoComplete="current-password" value={senhaAtual} onChange={e => onSenhaAtualChange(e.target.value)} />
              <Campo rotulo="Nova senha" type="password" autoComplete="new-password" placeholder="Pelo menos 6 letras ou números" value={novaSenha} onChange={e => onNovaSenhaChange(e.target.value)} />
              <Campo rotulo="Repita a nova senha" type="password" autoComplete="new-password" value={confirmSenha} onChange={e => onConfirmSenhaChange(e.target.value)} />
              {senhaMsg && <p className={senhaOk ? "ep9-ok" : "ep9-erro"} role="status">{senhaMsg}</p>}
              <Botao variante="secundario" cheio carregando={savingSenha} onClick={() => onAlterarSenha()}>Trocar a senha</Botao>
            </div>
          )}
        </div>
      </div>
    </Janela>
  );
}
