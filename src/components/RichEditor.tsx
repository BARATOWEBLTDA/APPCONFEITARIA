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
import { avisar } from "@/components/base";
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
  addAttributes() {
    return {
      src: { default: null },
      filename: { default: "arquivo" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="arquivo"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-type": "arquivo", class: "rich-file" },
      ["a", { href: HTMLAttributes.src, download: HTMLAttributes.filename, target: "_blank" }, `📎 ${HTMLAttributes.filename || "Baixar arquivo"}`],
    ];
  },
});

export default function RichEditor({ content, onChange }: Props) {
  const imgRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
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
      avisar("Erro no upload: " + err.message, { tipo: "erro" });
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
      editor.chain().focus().insertContent(`<div data-type="arquivo" data-src="${url}" data-filename="${file.name}"></div><p></p>`).run();
    }
    e.target.value = "";
  };

  const addLink = () => {
    const url = window.prompt("URL do link:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
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

      <style>{`
        .rich-editor {
          background: #fff;
          border: 1.5px solid #F0EBED;
          border-radius: 10px;
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
        .rich-tool-btn:hover:not(:disabled) { background: #F0EBED; color: #2C1219; }
        .rich-tool-btn.active { background: #FCE7F3; color: #C33A6E; }
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
          background: #fff;
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
          border: 1.5px solid #fff;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
          cursor: pointer;
        }
        .rich-color-swatch:hover { transform: scale(1.15); }
        .rich-color-clear {
          grid-column: span 4;
          padding: 4px;
          border: none;
          background: #F5F0F2;
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
          color: #2C1219;
          min-height: 240px;
          outline: none;
        }
        .rich-content-editor:focus { outline: none; }
        .rich-content-editor h1 { font-size: 24px; font-weight: 800; margin: 20px 0 10px; line-height: 1.2; }
        .rich-content-editor h2 { font-size: 20px; font-weight: 800; margin: 18px 0 8px; line-height: 1.25; }
        .rich-content-editor h3 { font-size: 17px; font-weight: 700; margin: 14px 0 6px; }
        .rich-content-editor p { margin: 0 0 10px; }
        .rich-content-editor ul, .rich-content-editor ol { margin: 0 0 12px; padding-left: 22px; }
        .rich-content-editor li { margin-bottom: 4px; }
        .rich-content-editor blockquote {
          border-left: 3px solid #E85A8C;
          padding: 6px 0 6px 14px;
          margin: 12px 0;
          font-style: italic;
          color: #6B7280;
        }
        .rich-content-editor img {
          max-width: 100%; height: auto;
          border-radius: 10px;
          display: block; margin: 12px 0;
        }
        .rich-content-editor audio {
          width: 100%; margin: 10px 0;
        }
        .rich-content-editor .rich-file {
          display: inline-flex;
          padding: 10px 14px;
          background: #F5F0F2;
          border-radius: 8px;
          margin: 8px 0;
        }
        .rich-content-editor .rich-file a {
          color: #C33A6E;
          text-decoration: none;
          font-weight: 700;
          font-size: 13px;
        }
        .rich-content-editor a { color: #C33A6E; text-decoration: underline; }
        .rich-content-editor mark { background: #FEF3C7; padding: 1px 3px; border-radius: 3px; }
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
      StarterKit,
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
          color: #2C1219;
          outline: none;
        }
        .ProseMirror h1 { font-size: 26px; font-weight: 800; margin: 24px 0 12px; line-height: 1.2; letter-spacing: -0.02em; }
        .ProseMirror h2 { font-size: 20px; font-weight: 800; margin: 20px 0 10px; }
        .ProseMirror h3 { font-size: 17px; font-weight: 700; margin: 16px 0 8px; }
        .ProseMirror p { margin: 0 0 12px; }
        .ProseMirror ul, .ProseMirror ol { margin: 0 0 14px; padding-left: 22px; }
        .ProseMirror li { margin-bottom: 5px; }
        .ProseMirror blockquote {
          border-left: 3px solid #E85A8C;
          padding: 8px 0 8px 16px;
          margin: 14px 0;
          font-style: italic;
          color: #6B7280;
        }
        .ProseMirror img {
          max-width: 100%; height: auto;
          border-radius: 12px;
          display: block; margin: 16px 0;
        }
        .ProseMirror audio {
          width: 100%; margin: 12px 0;
        }
        .ProseMirror .rich-file {
          display: inline-flex;
          padding: 12px 16px;
          background: #F5F0F2;
          border-radius: 10px;
          margin: 10px 0;
        }
        .ProseMirror .rich-file a {
          color: #C33A6E;
          text-decoration: none;
          font-weight: 700;
          font-size: 14px;
        }
        .ProseMirror a { color: #C33A6E; text-decoration: underline; }
        .ProseMirror mark { background: #FEF3C7; padding: 1px 3px; border-radius: 3px; }
      `}</style>
    </>
  );
}
