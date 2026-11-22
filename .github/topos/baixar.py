import json, os, re, urllib.request, urllib.parse, zipfile, unicodedata
BASE = "https://epixsranjplmltzmdsbo.supabase.co/functions/v1/topos-zip-tmp"; K = os.environ["K"]
def pega(url, tent=4):
    for i in range(tent):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "backup-topos"}), timeout=180) as r: return r.read()
        except Exception:
            if i == tent - 1: raise
def limpo(s):
    s = unicodedata.normalize("NFC", s or "").strip()
    return re.sub(r'[\\/:*?"<>|]+', "-", s)[:80] or "sem-nome"
topos = json.loads(pega(f"{BASE}?k={K}&lista=1"))
print("topos:", len(topos))
usados, total, falhas, n = set(), 0, [], 0
with zipfile.ZipFile("topos-doonly.zip", "w", zipfile.ZIP_STORED) as z:
    linhas = ["codigo;categoria;titulo;arquivo no zip;arquivo original"]
    for t in topos:
        base = f"{limpo(t['t'])} ({t.get('c') or 's-cod'})"
        itens = [(a.get("caminho"), a.get("nome") or "", None) for a in t.get("a", []) if a.get("caminho")]
        if t.get("capa"): itens.append((None, "capa.webp", t["capa"]))
        for caminho, nome, url in itens:
            ext = (nome.rsplit(".", 1)[-1] if "." in nome else "bin").lower()
            pasta = "webp" if url else ext
            destino = f"{pasta}/{limpo(t['cat'])}/{base}.{ext}"; k = 2
            while destino in usados: destino = f"{pasta}/{limpo(t['cat'])}/{base} {k}.{ext}"; k += 1
            usados.add(destino)
            try:
                dados = pega(url or f"{BASE}?k={K}&p={urllib.parse.quote(caminho, safe='')}")
                z.writestr(destino, dados); total += len(dados); n += 1
                linhas.append(";".join([t.get("c") or "", t["cat"], t["t"], destino, nome]))
            except Exception as e:
                falhas.append(f"{destino}: {type(e).__name__}")
    z.writestr("lista.csv", "﻿" + "\n".join(linhas))
print("arquivos:", n, "MB:", round(total / 1048576, 1), "falhas:", len(falhas))
for f in falhas: print("FALHA", f)
open("resumo.txt", "w").write(f"arquivos={n} mb={round(total/1048576,1)} falhas={len(falhas)}\n" + "\n".join(falhas))
