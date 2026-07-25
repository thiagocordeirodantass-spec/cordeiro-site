// =============================================================================
//  pages/import.js — Importação interativa de XML (paste / upload / geração)
//  -----------------------------------------------------------------------------
//  Layout: 3 cards em grid (2 + 1 full-width), com drag & drop e preview
// =============================================================================
import { api, toast, el } from "../assets/app.js";

export async function render(root) {
  root.appendChild(el("div", { class: "topbar" },
    el("div", { class: "crumbs" },
      el("span", {}, "Início"),
      el("span", { class: "sep" }, "›"),
      el("strong", {}, "Importar XML"),
    ),
    el("div", { class: "topbar__actions" },
      el("a", { href: "https://www.nfe.fazenda.gov.br/portal/consulta.aspx", target: "_blank", rel: "noopener", class: "toolbar__btn toolbar__btn--ghost" },
        el("span", {}, "❓"), el("span", {}, "Onde acho o XML?")
      ),
    ),
  ));

  const grid = el("div", { class: "import-grid" });
  root.appendChild(grid);

  // ---- CARD 1: PASTE com preview ----
  const pasteArea = el("textarea", {
    class: "import-textarea",
    placeholder: "Cole aqui o conteúdo completo do XML (NFe ou CTe)…",
    spellcheck: "false",
  });
  const pasteBtn = el("button", { class: "toolbar__btn toolbar__btn--primary" },
    el("span", {}, "📋"), el("span", {}, "Importar XML colado"),
  );
  const pasteStatus = el("div", { class: "import-status" });
  const pastePreview = el("div", { class: "import-preview", id: "paste-preview" });
  const pasteClear = el("button", { class: "toolbar__btn toolbar__btn--ghost", style: "display:none", id: "paste-clear" },
    el("span", {}, "✕"), el("span", {}, "Limpar"),
  );

  function updatePastePreview() {
    const xml = pasteArea.value.trim();
    if (!xml) {
      pastePreview.style.display = "none";
      pasteClear.style.display = "none";
      return;
    }
    pasteClear.style.display = "";
    // Preview simples: mostra primeiras tags identificadas
    const rootMatch = xml.match(/<([a-zA-Z0-9]+)(?:\s|>|\\)[\s\S]*?>/);
    const numero = (xml.match(/<nNF>(\d+)<\/nNF>/) || xml.match(/<nCT>(\d+)<\/nCT>/) || [])[1];
    const tipo = /<CTe|<cte/i.test(xml) ? "CT-e" : /<NFe|<nfe/i.test(xml) ? "NF-e" : "?";
    const cnpj = (xml.match(/<CNPJ>(\d+)<\/CNPJ>/) || [])[1];
    const valor = (xml.match(/<vNF>(\d+[.,]\d+)<\/vNF>/) || xml.match(/<vTPrest>(\d+[.,]\d+)<\/vTPrest>/) || [])[1];

    pastePreview.innerHTML = "";
    pastePreview.style.display = "";
    pastePreview.appendChild(el("div", { class: "import-preview__head" },
      el("span", {}, "🔎 Preview"),
      el("span", { class: "import-preview__tipo" }, tipo),
    ));
    pastePreview.appendChild(el("div", { class: "import-preview__grid" },
      el("div", {}, el("span", {}, "Raiz"), el("strong", {}, rootMatch ? rootMatch[1] : "—")),
      numero ? el("div", {}, el("span", {}, "Número"), el("strong", {}, numero)) : null,
      cnpj ? el("div", {}, el("span", {}, "CNPJ"), el("strong", {}, cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"))) : null,
      valor ? el("div", {}, el("span", {}, "Valor"), el("strong", {}, "R$ " + Number(valor.replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))) : null,
    ));
  }
  pasteArea.oninput = updatePastePreview;
  pasteClear.onclick = () => { pasteArea.value = ""; updatePastePreview(); pasteStatus.className = "import-status"; pasteStatus.textContent = ""; };

  pasteBtn.onclick = async () => {
    const xml = pasteArea.value.trim();
    if (!xml) { pasteStatus.className = "import-status import-status--err"; pasteStatus.textContent = "Cole o XML primeiro."; return; }
    pasteBtn.disabled = true;
    try {
      const r = await api("/api/docs/import", { method: "POST", body: { xml, source: "paste" } });
      if (r.ok) {
        if (r.duplicate) {
          pasteStatus.className = "import-status import-status--warn";
          pasteStatus.textContent = `⚠ Já importado — ${r.kind} chave ${r.chave} (atualizado)`;
          toast("Documento já existia, dados atualizados", "ok");
        } else {
          pasteStatus.className = "import-status import-status--ok";
          pasteStatus.textContent = `✓ Importado — ${r.kind} número ${r.summary?.numero || "?"} (chave ${r.chave})`;
          toast("Documento importado!");
          pasteArea.value = "";
          updatePastePreview();
        }
      } else {
        pasteStatus.className = "import-status import-status--err";
        pasteStatus.textContent = r.error || "Falha ao importar.";
      }
    } catch (e) {
      pasteStatus.className = "import-status import-status--err";
      pasteStatus.textContent = e.message;
    }
    pasteBtn.disabled = false;
  };

  grid.appendChild(card("📋 Colar XML", "Cole o conteúdo completo do XML exportado pelo seu ERP ou portal SEFAZ.", el("div", {},
    pasteArea,
    el("div", { style: "display:flex; gap:8px; margin-top:10px; flex-wrap:wrap" },
      pasteBtn,
      pasteClear,
      el("span", { style: "flex:1" }),
      pasteStatus,
    ),
    pastePreview,
  )));

  // ---- CARD 2: UPLOAD com drag & drop ----
  const fileInput = el("input", { type: "file", multiple: "true", accept: ".xml", id: "import-file", style: "display:none" });
  const dropZone = el("div", { class: "import-dropzone" },
    el("div", { class: "import-dropzone__icon" }, "📂"),
    el("div", { class: "import-dropzone__title" }, "Arraste arquivos .xml aqui"),
    el("div", { class: "import-dropzone__sub" }, "ou clique para selecionar"),
    fileInput,
  );
  const fileList = el("div", { class: "import-file-list", id: "import-file-list" });
  const uploadBtn = el("button", { class: "toolbar__btn toolbar__btn--primary", disabled: "true", id: "import-upload-btn" },
    el("span", {}, "📤"), el("span", {}, "Enviar arquivos selecionados"),
  );
  const uploadStatus = el("div", { class: "import-status", id: "import-status" });

  function updateFileList() {
    const files = Array.from(fileInput.files || []);
    fileList.innerHTML = "";
    if (!files.length) {
      uploadBtn.disabled = true;
      fileList.appendChild(el("div", { class: "import-empty" }, "Nenhum arquivo selecionado"));
      return;
    }
    for (const f of files) {
      fileList.appendChild(el("div", { class: "import-file" },
        el("span", { class: "import-file__icon" }, "📄"),
        el("span", { class: "import-file__name" }, f.name),
        el("span", { class: "import-file__size" }, (f.size / 1024).toFixed(1) + " KB"),
      ));
    }
    uploadBtn.disabled = false;
  }

  dropZone.onclick = () => fileInput.click();
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add("is-drag"); };
  dropZone.ondragleave = () => dropZone.classList.remove("is-drag");
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove("is-drag");
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updateFileList();
    }
  };
  fileInput.onchange = updateFileList;

  uploadBtn.onclick = async () => {
    const files = fileInput.files;
    if (!files.length) return;
    uploadBtn.disabled = true;
    uploadStatus.className = "import-status";
    uploadStatus.textContent = `⏳ Enviando ${files.length} arquivo(s)…`;
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    try {
      const r = await api("/api/docs/upload", { method: "POST", body: fd });
      const items = r.processed || [];
      const ok = items.filter((x) => x.ok).length;
      const fail = items.length - ok;
      const dups = items.filter((x) => x.ok && x.duplicate);
      if (fail === 0) {
        uploadStatus.className = "import-status import-status--ok";
        uploadStatus.textContent = `✓ ${ok} arquivo(s) importado(s).`;
      } else {
        uploadStatus.className = "import-status import-status--warn";
        uploadStatus.textContent = `⚠ ${ok} ok, ${fail} com erro.`;
      }
      if (dups.length) {
        const tail = el("div", { class: "import-dup" },
          `${dups.length} já estavam no banco (atualizados): ${dups.map((d) => d.fileName).slice(0, 5).join(", ")}${dups.length > 5 ? "…" : ""}`,
        );
        uploadStatus.appendChild(tail);
      }
      toast(`${ok} documentos processados`);
      fileInput.value = "";
      updateFileList();
    } catch (e) {
      uploadStatus.className = "import-status import-status--err";
      uploadStatus.textContent = e.message;
    }
    uploadBtn.disabled = false;
  };

  grid.appendChild(card("📤 Enviar arquivos", "Selecione ou arraste arquivos .xml exportados do seu ERP. Você pode enviar vários de uma vez.", el("div", {},
    dropZone,
    el("div", { style: "margin-top:12px" }, fileList),
    el("div", { style: "display:flex; gap:8px; margin-top:12px; align-items:center; flex-wrap:wrap" },
      uploadBtn,
      el("span", { style: "flex:1" }),
      uploadStatus,
    ),
  )));

  // ---- CARD 3: GERAR XML de exemplo (full-width) ----
  const num = el("input", { class: "input", type: "number", value: "1", placeholder: "Número" });
  const serie = el("input", { class: "input", type: "text", value: "1", placeholder: "Série" });
  const destino = el("select", { class: "select" },
    el("option", { value: "ambiente" }, "Ambiente (teste)"),
    el("option", { value: "producao" }, "Produção (apenas geração)"),
  );
  const genNfe = el("button", { class: "toolbar__btn toolbar__btn--primary" },
    el("span", {}, "📋"), el("span", {}, "Gerar XML NF-e"),
  );
  const genCte = el("button", { class: "toolbar__btn toolbar__btn--primary" },
    el("span", {}, "🚚"), el("span", {}, "Gerar XML CT-e"),
  );
  const out = el("textarea", { class: "import-textarea import-textarea--code", readonly: "true", placeholder: "O XML gerado aparecerá aqui…" });
  const chaveOut = el("div", { class: "import-status" });
  const copyBtn = el("button", { class: "toolbar__btn toolbar__btn--ghost", disabled: "true", id: "copy-xml-btn" },
    el("span", {}, "📑"), el("span", {}, "Copiar"),
  );
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(out.value);
      toast("✓ XML copiado");
    } catch { toast("Não foi possível copiar", "err"); }
  };
  out.oninput = () => { copyBtn.disabled = !out.value.trim(); };
  async function gen(kind) {
    try {
      const r = await api(`/api/generate/${kind}`, { method: "POST", body: { numero: Number(num.value) || 1, serie: serie.value || "1" } });
      out.value = r.xml;
      chaveOut.className = "import-status import-status--ok";
      chaveOut.textContent = `✓ Chave: ${r.chave}`;
      copyBtn.disabled = false;
    } catch (e) {
      chaveOut.className = "import-status import-status--err";
      chaveOut.textContent = "Erro: " + e.message;
    }
  }
  genNfe.onclick = () => gen("nfe");
  genCte.onclick = () => gen("cte");

  const genCard = card("⚙ Gerar XML de exemplo (não assina)", "Gera um XML pronto para teste. Não é assinado nem transmitido — apenas para você entender o formato esperado.", el("div", {},
    el("div", { class: "import-gen-form" },
      el("div", { class: "field" }, el("label", {}, "Tipo"), destino),
      el("div", { class: "field" }, el("label", {}, "Número"), num),
      el("div", { class: "field" }, el("label", {}, "Série"), serie),
    ),
    el("div", { style: "display:flex; gap:8px; margin-top:12px" }, genNfe, genCte),
    out,
    el("div", { style: "display:flex; gap:8px; margin-top:10px; align-items:center" },
      copyBtn,
      el("span", { style: "flex:1" }),
      chaveOut,
    ),
  ));
  grid.appendChild(genCard);
  genCard.classList.add("import-card--full");

  // Inicializa o estado
  updateFileList();
}

function card(title, sub, body) {
  return el("div", { class: "card card--mod", "data-mod": "import" },
    el("div", { class: "card__head" },
      el("h2", {}, title),
    ),
    el("div", { class: "card__body" },
      sub ? el("p", { class: "import-sub" }, sub) : null,
      body,
    ),
  );
}
