import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Botao, Campo, Janela, avisar } from "@/components/base";
import { explicarErro } from "@/lib/erros";
import {
  TextB, TextItalic, TextUnderline, TextStrikethrough,
  TextHOne, TextHTwo, TextHThree, ListBullets, ListNumbers,
  Quotes, Image as ImageIcon, LinkSimple, TextAlignLeft,
  TextAlignCenter, TextAlignRight, Paperclip, MusicNote,
  ArrowCounterClockwise, ArrowClockwise, Highlighter,
} from "@phosphor-icons/react";

interface Props {
  content: any;
  onChange: (json: any) => void;
  onUpload?: (file: File, tipo: "imagem" | "audio" | "arquivo") => Promise<string | null>;
}

const CORES = ["#2C1219", "#C33A6E", "#E85A8C", "#7C3AED", "#1D4ED8", "#15803D", "#B45309", "#B91C1C"];

// Extensão customizada pra áudio embed
const AudioExtension = Image.extend({
  name: "audio",
  addAttributes() {
    return {
      src: { default: null },
      title: { default: "Áudio" },
    };
  },
  parseHTML() {
    return [{ tag: "audio" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["audio", { controls: "true", ...HTMLAttributes }];
  },
});

// Extensão customizada pra arquivo (link download)
const FileExtension = Image.extend({
  name: "arquivo",
  // (11/10) O anexo era inserido como HTML com data-src/data-filename, mas o nó lia "src"/"filename": o endereço
  // se perdia e o link saía vazio. Agora os dois atributos sabem ler e escrever os data-* (e o link de dentro).
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-src") || el.getAttribute("src") || el.querySelector("a")?.getAttribute("href") || null,
        renderHTML: (attrs: Record<string, any>) => (attrs.src ? { "data-src": attrs.src } : {}),
      },
      filename: {
        default: "arquivo",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-filename") || el.getAttribute("filename") || el.querySelector("a")?.getAttribute("download") || "arquivo",
        renderHTML: (attrs: Record<string, any>) => ({ "data-filename": attrs.filename || "arquivo" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="arquivo"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const nome = String(node.attrs.filename || "") || "Baixar arquivo";
    const src = String(node.attrs.src || "");
    // o link do anexo só aceita https:// (nada de javascript: ou data:)
    const seguro = /^https:\/\//i.test(src) ? src : "";
    return [
      "div",
      { ...HTMLAttributes, "data-type": "arquivo", class: "rich-file" },
      seguro
        ? ["a", { href: seguro, download: nome, target: "_blank", rel: "noopener noreferrer" }, `📎 ${nome}`]
        : ["span", {}, `📎 ${nome}`],
    ];
  },
});

export default function RichEditor({ content, onChange }: Props) {
  const imgRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [linkAberto, setLinkAberto] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "rich-link" } }),
      TextStyle,
      Color,
      AudioExtension,
      FileExtension,
    ],
    content: content || { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: "rich-content-editor",
      },
    },
  });

  if (!editor) return <div>Carregando editor...</div>;

  const uploadArquivo = async (file: File, tipo: "imagem" | "audio" | "arquivo"): Promise<string | null> => {
    setUploading(tipo);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const fileName = `${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("noticias-anexos")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("noticias-anexos").getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err: any) {
      avisar(explicarErro(err, "Não deu para enviar o arquivo. Tente de novo."), { tipo: "erro" });
      return null;
    } finally {
      setUploading(null);
    }
  };

  const handleUploadImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadArquivo(file, "imagem");
    if (url) editor.chain().focus().setImage({ src: url }).run();
    e.target.value = "";
  };

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadArquivo(file, "audio");
    if (url) {
      editor.chain().focus().insertContent(`<audio controls src="${url}"></audio><p></p>`).run();
    }
    e.target.value = "";
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadArquivo(file, "arquivo");
    if (url) {
      // (11/10) entra como nó, com o endereço e o nome nos atributos (antes ia como HTML e o endereço se perdia)
      editor.chain().focus().insertContent([{ type: "arquivo", attrs: { src: url, filename: file.name } }, { type: "paragraph" }]).run();
    }
    e.target.value = "";
  };

  // (10/10) o endereço do link é pedido na janela do app (antes era a caixinha do navegador)
  const addLink = () => { setLinkUrl(editor.getAttributes("link").href || ""); setLinkAberto(true); };
  const salvarLink = () => {
    const url = linkUrl.trim();
    setLinkAberto(false);
    if (!url) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: /^(https?:|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}` }).run();
  };

  return (
    <div className="rich-editor">
      <div className="rich-toolbar">
        {/* Undo/Redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><ArrowCounterClockwise size={14} weight="bold" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer"><ArrowClockwise size={14} weight="bold" /></ToolBtn>
        <Sep />

        {/* Títulos */}
        <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título grande"><TextHOne size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título médio"><TextHTwo size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título pequeno"><TextHThree size={14} weight="bold" /></ToolBtn>
        <Sep />

        {/* Formatação */}
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito"><TextB size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico"><TextItalic size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado"><TextUnderline size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Riscado"><TextStrikethrough size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight({ color: "#FEF3C7" }).run()} title="Destacar (marca-texto)"><Highlighter size={14} weight="bold" /></ToolBtn>
        <Sep />

        {/* Cores */}
        <div className="rich-color-picker" title="Cor do texto">
          🎨
          <div className="rich-color-dropdown">
            {CORES.map(c => (
              <button
                key={c}
                className="rich-color-swatch"
                style={{ background: c }}
                onClick={() => editor.chain().focus().setColor(c).run()}
                title={c}
              />
            ))}
            <button className="rich-color-clear" onClick={() => editor.chain().focus().unsetColor().run()} title="Remover cor">↺</button>
          </div>
        </div>
        <Sep />

        {/* Alinhamento */}
        <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Alinhar esquerda"><TextAlignLeft size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Centralizar"><TextAlignCenter size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Alinhar direita"><TextAlignRight size={14} weight="bold" /></ToolBtn>
        <Sep />

        {/* Listas */}
        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista"><ListBullets size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListNumbers size={14} weight="bold" /></ToolBtn>
        <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quotes size={14} weight="bold" /></ToolBtn>
        <Sep />

        {/* Mídia */}
        <ToolBtn onClick={addLink} title="Link"><LinkSimple size={14} weight="bold" /></ToolBtn>
        <ToolBtn onClick={() => imgRef.current?.click()} title="Imagem" disabled={uploading === "imagem"}>
          {uploading === "imagem" ? "..." : <ImageIcon size={14} weight="bold" />}
        </ToolBtn>
        <ToolBtn onClick={() => audioRef.current?.click()} title="Áudio" disabled={uploading === "audio"}>
          {uploading === "audio" ? "..." : <MusicNote size={14} weight="bold" />}
        </ToolBtn>
        <ToolBtn onClick={() => fileRef.current?.click()} title="Arquivo" disabled={uploading === "arquivo"}>
          {uploading === "arquivo" ? "..." : <Paperclip size={14} weight="bold" />}
        </ToolBtn>

        <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUploadImg} />
        <input ref={audioRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleUploadAudio} />
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" style={{ display: "none" }} onChange={handleUploadFile} />
      </div>

      <div className="rich-content-wrap">
        <EditorContent editor={editor} />
      </div>

      <Janela aberta={linkAberto} aoFechar={() => setLinkAberto(false)} tipo="conteudo" titulo="Link"
        acoes={<><Botao variante="secundario" onClick={() => setLinkAberto(false)}>Cancelar</Botao><Botao onClick={salvarLink}>Salvar</Botao></>}>
        <Campo rotulo="Endereço do link" placeholder="https://" inputMode="url" autoCapitalize="off" autoCorrect="off" value={linkUrl}
          dica="Deixe vazio para tirar o link do texto." onChange={e => setLinkUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); salvarLink(); } }} />
      </Janela>

      <style>{`
        .rich-editor {
          background: var(--ui-branco);
          border: 1.5px solid #F0EBED;
          border-radius: var(--ui-raio-p);
          overflow: hidden;
        }
        .rich-toolbar {
          display: flex; flex-wrap: wrap; gap: 2px;
          padding: 8px;
          background: #FAFAFA;
          border-bottom: 1.5px solid #F0EBED;
        }
        .rich-tool-btn {
          width: 30px; height: 30px;
          background: transparent;
          border: none;
          border-radius: 5px;
          color: #4B5563;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .rich-tool-btn:hover:not(:disabled) { background: #F0EBED; color: var(--ui-texto); }
        .rich-tool-btn.active { background: #FCE7F3; color: var(--ui-rosa-escuro); }
        .rich-tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .rich-tool-sep {
          width: 1px;
          background: #E5E7EB;
          margin: 4px 4px;
        }

        .rich-color-picker {
          position: relative;
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: 14px;
          border-radius: 5px;
        }
        .rich-color-picker:hover { background: #F0EBED; }
        .rich-color-dropdown {
          position: absolute;
          top: 100%; left: 0;
          margin-top: 4px;
          background: var(--ui-branco);
          padding: 6px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: none;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
          z-index: 10;
        }
        .rich-color-picker:hover .rich-color-dropdown { display: grid; }
        .rich-color-swatch {
          width: 22px; height: 22px;
          border-radius: 4px;
          border: 1.5px solid var(--ui-branco);
          box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
          cursor: pointer;
        }
        .rich-color-swatch:hover { transform: scale(1.15); }
        .rich-color-clear {
          grid-column: span 4;
          padding: 4px;
          border: none;
          background: var(--ui-linha);
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          font-weight: 700;
        }

        .rich-content-wrap {
          padding: 16px 20px;
          max-height: 500px;
          overflow-y: auto;
        }
        .rich-content-editor {
          font-family: 'Geist', -apple-system, sans-serif;
          font-size: 14.5px;
          line-height: 1.65;
          color: var(--ui-texto);
          min-height: 240px;
          outline: none;
        }
        .rich-content-editor:focus { outline: none; }
        .rich-content-editor h1 { font-size: 24px; font-weight: 700; margin: 20px 0 10px; line-height: 1.2; }
        .rich-content-editor h2 { font-size: 20px; font-weight: 700; margin: 18px 0 8px; line-height: 1.25; }
        .rich-content-editor h3 { font-size: 17px; font-weight: 700; margin: 14px 0 6px; }
        .rich-content-editor p { margin: 0 0 10px; }
        .rich-content-editor ul, .rich-content-editor ol { margin: 0 0 12px; padding-left: 22px; }
        .rich-content-editor li { margin-bottom: 4px; }
        .rich-content-editor blockquote {
          border-left: 3px solid var(--ui-rosa);
          padding: 6px 0 6px 14px;
          margin: 12px 0;
          font-style: italic;
          color: #6B7280;
        }
        .rich-content-editor img {
          max-width: 100%; height: auto;
          border-radius: var(--ui-raio-p);
          display: block; margin: 12px 0;
        }
        .rich-content-editor audio {
          width: 100%; margin: 10px 0;
        }
        .rich-content-editor .rich-file {
          display: inline-flex;
          padding: 10px 14px;
          background: var(--ui-linha);
          border-radius: 8px;
          margin: 8px 0;
        }
        .rich-content-editor .rich-file a {
          color: var(--ui-rosa-escuro);
          text-decoration: none;
          font-weight: 700;
          font-size: 13px;
        }
        .rich-content-editor a { color: var(--ui-rosa-escuro); text-decoration: underline; }
        .rich-content-editor mark { background: var(--ui-laranja-fundo); padding: 1px 3px; border-radius: 3px; }
      `}</style>
    </div>
  );
}

// Sub-componentes
function ToolBtn({ children, onClick, active, disabled, title }: any) {
  return (
    <button
      type="button"
      className={`rich-tool-btn ${active ? "active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="rich-tool-sep" />;
}

// Renderer read-only (usado na página de leitura)
export function RichContent({ content }: { content: any }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: true, HTMLAttributes: { class: "rich-link", target: "_blank", rel: "noopener" } }),
      TextStyle,
      Color,
      AudioExtension,
      FileExtension,
    ],
    content: content || "",
    editable: false,
  });

  if (!editor) return null;

  return (
    <>
      <EditorContent editor={editor} />
      <style>{`
        .ProseMirror {
          font-family: 'Geist', -apple-system, sans-serif;
          font-size: 15px;
          line-height: 1.7;
          color: var(--ui-texto);
          outline: none;
        }
        .ProseMirror h1 { font-size: 26px; font-weight: 700; margin: 24px 0 12px; line-height: 1.2; letter-spacing: -0.02em; }
        .ProseMirror h2 { font-size: 20px; font-weight: 700; margin: 20px 0 10px; }
        .ProseMirror h3 { font-size: 17px; font-weight: 700; margin: 16px 0 8px; }
        .ProseMirror p { margin: 0 0 12px; }
        .ProseMirror ul, .ProseMirror ol { margin: 0 0 14px; padding-left: 22px; }
        .ProseMirror li { margin-bottom: 5px; }
        .ProseMirror blockquote {
          border-left: 3px solid var(--ui-rosa);
          padding: 8px 0 8px 16px;
          margin: 14px 0;
          font-style: italic;
          color: #6B7280;
        }
        .ProseMirror img {
          max-width: 100%; height: auto;
          border-radius: var(--ui-raio);
          display: block; margin: 16px 0;
        }
        .ProseMirror audio {
          width: 100%; margin: 12px 0;
        }
        .ProseMirror .rich-file {
          display: inline-flex;
          padding: 12px 16px;
          background: var(--ui-linha);
          border-radius: var(--ui-raio-p);
          margin: 10px 0;
        }
        .ProseMirror .rich-file a {
          color: var(--ui-rosa-escuro);
          text-decoration: none;
          font-weight: 700;
          font-size: 14px;
        }
        .ProseMirror a { color: var(--ui-rosa-escuro); text-decoration: underline; }
        .ProseMirror mark { background: var(--ui-laranja-fundo); padding: 1px 3px; border-radius: 3px; }
      `}</style>
    </>
  );
}
