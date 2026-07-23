// =============================================================================
//  pages/documents-list.js — lista com filtros
// =============================================================================
import { api, apiDownload, fmtMoney, fmtDate, statusBadge, showModal, toast, el } from "../assets/app.js";

let cache = [];

export async function render(root) {
  root.appendChild(el("div", { class: "topbar" },
    el("div", { class: "crumbs" }, el("strong", {}, "Documentos")),
    el("div", { class: "topbar__actions" },
      el("button", { class: "btn", onClick: load }, "Atualizar"),
    ),
  ));

  // filtros
  const f_kind = el("select", { class: "select" },
    el("option", { value: "" }, "Todos os tipos"),
    el("option", { value: "NFE" }, "NF-e"),
    el("option", { value: "CTE" }, "CT-e"),
  );
  const f_status = el("select", { class: "select" },
    el("option", { value: "" }, "Todos os status"),
    el("option", { value: "autorizado" }, "Autorizado"),
    el("option", { value: "cancelado" }, "Cancelado"),
    el("option", { value: "denegado" }, "Denegado"),
    el("option", { value: "rejeitado" }, "Rejeitado"),
    el("option", { value: "pendente" }, "Pendente"),
  );
  const f_uf = el("input", { class: "input", placeholder: "UF (ex: SP)" });
  const f_from = el("input", { class: "input", type: "date", title: "De" });
  const f_to = el("input", { class: "input", type: "date", title: "Até" });
  const f_q = el("input", { class: "input", placeholder: "Buscar (nome, doc, chave, número)" });
  const f_source = el("select", { class: "select" },
    el("option", { value: "" }, "Todas as origens"),
    el("option", { value: "upload" }, "Upload manual"),
    el("option", { value: "paste" }, "Colar XML"),
    el("option", { value: "sefaz-cert" }, "SEFAZ (cert A1)"),
    el("option", { value: "sefaz-cert-periodo" }, "SEFAZ (período/NSU)"),
    el("option", { value: "sefaz-provedor" }, "SEFAZ (provedor)"),
    el("option", { value: "generated" }, "Gerados pelo sistema"),
  );

  // ---- Filtros novos (item 9) ----
  const f_emitCnpj = el("input", { class: "input", placeholder: "CNPJ do Emitente" });
  const f_emitRazao = el("input", { class: "input", placeholder: "Razão Social do Emitente" });
  const f_emitFantasia = el("input", { class: "input", placeholder: "Nome Fantasia do Emitente" });
  const f_destNome = el("input", { class: "input", placeholder: "Destinatário / Tomador" });
  const f_destDoc = el("input", { class: "input", placeholder: "Doc. Destinatário" });
  const f_chave = el("input", { class: "input", placeholder: "Chave de Acesso" });
  const f_tipoDoc = el("select", { class: "select" },
    el("option", { value: "" }, "Todos os tipos"),
    el("option", { value: "entrada" }, "Entrada"),
    el("option", { value: "saida" }, "Saída"),
  );
  const f_finalidade = el("select", { class: "select" },
    el("option", { value: "" }, "Todas as finalidades"),
    el("option", { value: "normal" }, "Normal"),
    el("option", { value: "complementar" }, "Complementar"),
    el("option", { value: "ajuste" }, "Ajuste"),
    el("option", { value: "devolucao" }, "Devolução"),
  );
  const f_cancelados = el("select", { class: "select" },
    el("option", { value: "" }, "Cancelados: todos"),
    el("option", { value: "1" }, "Somente cancelados"),
    el("option", { value: "0" }, "Somente não cancelados"),
  );
  const f_dataCancFrom = el("input", { class: "input", type: "date", title: "Cancelados de" });
  const f_dataCancTo = el("input", { class: "input", type: "date", title: "Cancelados até" });
  const f_registrada = el("select", { class: "select" },
    el("option", { value: "" }, "Registrada no ERP: todos"),
    el("option", { value: "1" }, "Somente registradas"),
    el("option", { value: "0" }, "Somente não registradas"),
  );
  const f_dataRegFrom = el("input", { class: "input", type: "date", title: "Registradas de" });
  const f_dataRegTo = el("input", { class: "input", type: "date", title: "Registradas até" });
  const f_registrosInvalidos = el("select", { class: "select" },
    el("option", { value: "" }, "Registros inválidos: todos"),
    el("option", { value: "1" }, "Somente inválidos"),
  );
  const f_invalidado = el("select", { class: "select" },
    el("option", { value: "" }, "Invalidado: todos"),
    el("option", { value: "1" }, "Somente invalidados"),
  );
  const f_assinaturaInvalida = el("select", { class: "select" },
    el("option", { value: "" }, "Assinatura: todos"),
    el("option", { value: "1" }, "Somente assinatura inválida"),
  );
  const f_schemaInvalido = el("select", { class: "select" },
    el("option", { value: "" }, "Schema: todos"),
    el("option", { value: "1" }, "Somente schema inválido"),
  );
  const f_terceiros = el("select", { class: "select" },
    el("option", { value: "" }, "Terceiros: todos"),
    el("option", { value: "1" }, "Somente terceiros"),
    el("option", { value: "0" }, "Somente próprios"),
  );
  const f_cartaCorrecao = el("select", { class: "select" },
    el("option", { value: "" }, "Carta de Correção: todos"),
    el("option", { value: "1" }, "Somente com carta de correção"),
  );
  const f_ultimaManifestacao = el("select", { class: "select" },
    el("option", { value: "" }, "Última Manifestação: todas"),
    el("option", { value: "ciencia" }, "Ciência"),
    el("option", { value: "confirmacao" }, "Confirmação"),
    el("option", { value: "desconhecimento" }, "Desconhecimento"),
    el("option", { value: "nao_realizada" }, "Não realizada"),
  );
  const f_dataManifFrom = el("input", { class: "input", type: "date", title: "Manifestação de" });
  const f_dataManifTo = el("input", { class: "input", type: "date", title: "Manifestação até" });
  const f_semManifestacao = el("select", { class: "select" },
    el("option", { value: "" }, "Sem Manifestação: todos"),
    el("option", { value: "1" }, "Somente sem manifestação"),
  );
  const f_dataValidFrom = el("input", { class: "input", type: "date", title: "Validação de" });
  const f_dataValidTo = el("input", { class: "input", type: "date", title: "Validação até" });
  const f_regraValidacao = el("input", { class: "input", placeholder: "Regra de Validação" });
  const f_regraViolada = el("input", { class: "input", placeholder: "Regra Violada" });

  const advancedFilters = el("div", { class: "row", style: "margin-top:10px; flex-wrap:wrap" },
    el("div", { class: "field" }, el("label", {}, "CNPJ Emitente"), f_emitCnpj),
    el("div", { class: "field" }, el("label", {}, "Razão Social Emitente"), f_emitRazao),
    el("div", { class: "field" }, el("label", {}, "Nome Fantasia"), f_emitFantasia),
    el("div", { class: "field" }, el("label", {}, "Destinatário/Tomador"), f_destNome),
    el("div", { class: "field" }, el("label", {}, "Doc. Destinatário"), f_destDoc),
    el("div", { class: "field" }, el("label", {}, "Chave de Acesso"), f_chave),
    el("div", { class: "field" }, el("label", {}, "Tipo de Documento"), f_tipoDoc),
    el("div", { class: "field" }, el("label", {}, "Finalidade Emissão"), f_finalidade),
    el("div", { class: "field" }, el("label", {}, "Cancelados"), f_cancelados),
    el("div", { class: "field" }, el("label", {}, "Data Cancelamento de"), f_dataCancFrom),
    el("div", { class: "field" }, el("label", {}, "Data Cancelamento até"), f_dataCancTo),
    el("div", { class: "field" }, el("label", {}, "Registrada no ERP"), f_registrada),
    el("div", { class: "field" }, el("label", {}, "Data Reg. ERP de"), f_dataRegFrom),
    el("div", { class: "field" }, el("label", {}, "Data Reg. ERP até"), f_dataRegTo),
    el("div", { class: "field" }, el("label", {}, "Registros Inválidos"), f_registrosInvalidos),
    el("div", { class: "field" }, el("label", {}, "Invalidado"), f_invalidado),
    el("div", { class: "field" }, el("label", {}, "Assinatura Inválida"), f_assinaturaInvalida),
    el("div", { class: "field" }, el("label", {}, "Schema Inválido"), f_schemaInvalido),
    el("div", { class: "field" }, el("label", {}, "Documentos de Terceiros"), f_terceiros),
    el("div", { class: "field" }, el("label", {}, "Carta de Correção"), f_cartaCorrecao),
    el("div", { class: "field" }, el("label", {}, "Última Manifestação"), f_ultimaManifestacao),
    el("div", { class: "field" }, el("label", {}, "Data Manifestação de"), f_dataManifFrom),
    el("div", { class: "field" }, el("label", {}, "Data Manifestação até"), f_dataManifTo),
    el("div", { class: "field" }, el("label", {}, "Sem Manifestação"), f_semManifestacao),
    el("div", { class: "field" }, el("label", {}, "Validação Regra de"), f_dataValidFrom),
    el("div", { class: "field" }, el("label", {}, "Validação Regra até"), f_dataValidTo),
    el("div", { class: "field" }, el("label", {}, "Regra de Validação"), f_regraValidacao),
    el("div", { class: "field" }, el("label", {}, "Regra Violada"), f_regraViolada),
  );
  advancedFilters.style.display = "none"; // começa oculto

  const toggleAdvanced = el("button", {
    class: "btn btn--sm",
    type: "button",
    onClick: () => {
      const isOpen = advancedFilters.style.display !== "none";
      advancedFilters.style.display = isOpen ? "none" : "flex";
      toggleAdvanced.textContent = isOpen ? "▾ Filtros avançados" : "▴ Ocultar filtros avançados";
    },
  }, "▾ Filtros avançados");

  const applyBtn = el("button", { class: "btn btn--primary", onClick: load }, "Filtrar");
  const clearBtn = el("button", { class: "btn", onClick: () => {
    const all = [
      f_kind, f_status, f_uf, f_from, f_to, f_q, f_source,
      f_emitCnpj, f_emitRazao, f_emitFantasia, f_destNome, f_destDoc, f_chave,
      f_tipoDoc, f_finalidade, f_cancelados, f_dataCancFrom, f_dataCancTo,
      f_registrada, f_dataRegFrom, f_dataRegTo, f_registrosInvalidos,
      f_invalidado, f_assinaturaInvalida, f_schemaInvalido, f_terceiros,
      f_cartaCorrecao, f_ultimaManifestacao, f_dataManifFrom, f_dataManifTo,
      f_semManifestacao, f_dataValidFrom, f_dataValidTo, f_regraValidacao, f_regraViolada,
    ];
    all.forEach((i) => { i.value = ""; });
    load();
  } }, "Limpar");

  // Suporta deep-link tipo #/documents?source=sefaz-cert
  const hash = location.hash.split("?")[1];
  if (hash) {
    const sp = new URLSearchParams(hash);
    if (sp.get("source")) f_source.value = sp.get("source");
  }

  const filterCard = el("div", { class: "card" },
    el("div", { class: "card__body" },
      el("div", { class: "row" },
        el("div", { class: "field" }, el("label", {}, "Tipo"), f_kind),
        el("div", { class: "field" }, el("label", {}, "Status"), f_status),
        el("div", { class: "field" }, el("label", {}, "UF"), f_uf),
        el("div", { class: "field" }, el("label", {}, "De"), f_from),
        el("div", { class: "field" }, el("label", {}, "Até"), f_to),
        el("div", { class: "field" }, el("label", {}, "Origem"), f_source),
        el("div", { class: "field" }, el("label", {}, "Buscar"), f_q),
        el("div", { class: "row--inline" }, applyBtn, clearBtn, toggleAdvanced),
      ),
      advancedFilters,
    ),
  );
  root.appendChild(filterCard);

  // tabela
  const tableHost = el("div", { class: "card", style: "margin-top:16px" });
  root.appendChild(tableHost);

  async function load() {
    const params = new URLSearchParams();
    if (f_kind.value) params.set("kind", f_kind.value);
    if (f_status.value) params.set("status", f_status.value);
    if (f_uf.value) params.set("uf", f_uf.value);
    if (f_from.value) params.set("dateFrom", f_from.value);
    if (f_to.value) params.set("dateTo", f_to.value);
    if (f_q.value) params.set("q", f_q.value);
    if (f_source.value) params.set("source", f_source.value);
    // Filtros novos
    if (f_emitCnpj.value) params.set("emitenteCnpj", f_emitCnpj.value);
    if (f_emitRazao.value) params.set("emitenteRazaoSocial", f_emitRazao.value);
    if (f_emitFantasia.value) params.set("emitenteNomeFantasia", f_emitFantasia.value);
    if (f_destNome.value) params.set("destinatarioNome", f_destNome.value);
    if (f_destDoc.value) params.set("destinatarioDoc", f_destDoc.value);
    if (f_chave.value) params.set("chaveAcesso", f_chave.value);
    if (f_tipoDoc.value) params.set("tipoDocumento", f_tipoDoc.value);
    if (f_finalidade.value) params.set("finalidadeEmissao", f_finalidade.value);
    if (f_cancelados.value) params.set("cancelados", f_cancelados.value);
    if (f_dataCancFrom.value) params.set("dataCancelamentoFrom", f_dataCancFrom.value);
    if (f_dataCancTo.value) params.set("dataCancelamentoTo", f_dataCancTo.value);
    if (f_registrada.value) params.set("registrada", f_registrada.value);
    if (f_dataRegFrom.value) params.set("dataRegistroFrom", f_dataRegFrom.value);
    if (f_dataRegTo.value) params.set("dataRegistroTo", f_dataRegTo.value);
    if (f_registrosInvalidos.value) params.set("registrosInvalidos", f_registrosInvalidos.value);
    if (f_invalidado.value) params.set("invalidado", f_invalidado.value);
    if (f_assinaturaInvalida.value) params.set("assinaturaInvalida", f_assinaturaInvalida.value);
    if (f_schemaInvalido.value) params.set("schemaInvalido", f_schemaInvalido.value);
    if (f_terceiros.value) params.set("terceiros", f_terceiros.value);
    if (f_cartaCorrecao.value) params.set("cartaCorrecao", f_cartaCorrecao.value);
    if (f_ultimaManifestacao.value) params.set("ultimaManifestacao", f_ultimaManifestacao.value);
    if (f_dataManifFrom.value) params.set("dataUltimaManifestacaoFrom", f_dataManifFrom.value);
    if (f_dataManifTo.value) params.set("dataUltimaManifestacaoTo", f_dataManifTo.value);
    if (f_semManifestacao.value) params.set("semManifestacao", f_semManifestacao.value);
    if (f_dataValidFrom.value) params.set("dataValidacaoRegraFrom", f_dataValidFrom.value);
    if (f_dataValidTo.value) params.set("dataValidacaoRegraTo", f_dataValidTo.value);
    if (f_regraValidacao.value) params.set("regraValidacao", f_regraValidacao.value);
    if (f_regraViolada.value) params.set("regraViolada", f_regraViolada.value);
    try {
      const rows = await api("/api/docs?" + params.toString());
      cache = rows;
      renderTable(tableHost, rows);
    } catch (e) { toast(e.message, "err"); }
  }
  await load();
}

function renderTable(host, rows) {
  host.innerHTML = "";
  if (!rows.length) {
    host.appendChild(el("div", { class: "card__body empty" }, "Nenhum documento encontrado com os filtros atuais."));
    return;
  }
  const t = el("table", { class: "table" },
    el("thead", {}, el("tr", {},
      el("th", {}, "Tipo"), el("th", {}, "Número"), el("th", {}, "Série"),
      el("th", {}, "Chave"), el("th", {}, "Emissão"),
      el("th", {}, "UF"), el("th", {}, "Remetente"), el("th", {}, "Destinatário"),
      el("th", { class: "num" }, "Valor"), el("th", {}, "Status"),
      el("th", {}, "Origem"),
      el("th", {}, "Ações"),
    )),
    el("tbody", {}, ...rows.map((r) => row(r))),
  );
  host.appendChild(t);
}

function row(r) {
  const tr = el("tr", { "data-doc-id": r.id },
    el("td", {}, r.kind === "NFE" ? "NF-e" : r.kind === "CTE" ? "CT-e" : r.kind || "-"),
    el("td", {}, cleanNum(r.numero)),
    el("td", {}, cleanNum(r.serie)),
    el("td", { class: "mono", style: "font-size:11.5px" }, (r.chave || "").replace(/^(\d{4}).*?(\d{4})$/, "$1…$2") || "-"),
    el("td", {}, fmtDate(r.data_emissao)),
    el("td", {}, `${r.uf_emitente || "-"}/${r.uf_destino || "-"}`),
    el("td", {}, r.remetente_nome || "-"),
    el("td", {}, r.destinatario_nome || "-"),
    el("td", { class: "num" }, fmtMoney(r.valor_total)),
    el("td", { html: statusBadge(r.status) }),
    el("td", { class: "kv__label" }, origemLabel(r.source)),
    el("td", {},
      el("button", { class: "btn btn--sm", onClick: () => showDetail(r) }, "Detalhes"),
      " ",
      el("button", { class: "btn btn--sm", onClick: () => downloadPdf(r) }, "PDF"),
      r.chave ? " " + el("button", { class: "btn btn--sm", onClick: () => consultarMeuDANFe(r) }, "🔍 MeuDANFe") : "",
      " ",
      podeExcluir() ? el("button", { class: "btn btn--sm btn--danger", onClick: () => excluirDocumento(r) }, "🗑 Excluir") : null,
    ),
  );
  return tr;
}

function podeExcluir() {
  const u = window.__CORDEIRO_USER__;
  return u && (u.role === "admin" || u.role === "operador");
}

async function excluirDocumento(r) {
  try {
    await api(`/api/docs/${r.id}`, { method: "DELETE" });
    toast("✓ Documento excluído");
    // remove a linha da tabela sem precisar recarregar tudo
    const tr = document.querySelector(`[data-doc-id="${r.id}"]`);
    if (tr) tr.remove();
    else carregarTabela();
  } catch (e) { toast(e.message, "err"); }
}

function consultarMeuDANFe(r) {
  if (!r.chave) { toast("Documento sem chave de acesso", "err"); return; }
  const url = `https://meudanfe.com.br/?chave=${encodeURIComponent(r.chave)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  toast("Abrindo MeuDANFe em nova aba…");
}

function origemLabel(s) {
  const map = {
    "upload": "Upload", "paste": "Colar", "generated": "Gerado",
    "sefaz-cert": "SEFAZ cert", "sefaz-cert-periodo": "SEFAZ NSU",
    "sefaz-provedor": "SEFAZ prov.",
  };
  return map[s] || s || "-";
}

function cleanNum(v) { v = String(v ?? ""); return /^\d+\.0$/.test(v) ? v.slice(0, -2) : v; }

async function showDetail(r) {
  let detail;
  try { detail = await api(`/api/docs/${r.id}`); } catch (e) { toast(e.message, "err"); return; }
  const body = el("div", {},
    el("div", { class: "detail-grid" },
      kv("Tipo", detail.kind === "NFE" ? "NF-e" : detail.kind === "CTE" ? "CT-e" : detail.kind),
      kv("Número", cleanNum(detail.numero)),
      kv("Série", cleanNum(detail.serie)),
      kv("Modelo", detail.modelo || "-"),
      kv("Data emissão", fmtDate(detail.data_emissao)),
      kv("UF", `${detail.uf_emitente || "-"} → ${detail.uf_destino || "-"}`),
      kv("Status", detail.status || "-"),
      kv("Protocolo", cleanNum(detail.protocolo) || "-"),
      kv("Remetente", detail.remetente_nome || "-"),
      kv("Doc. Remetente", cleanNum(detail.remetente_doc) || "-"),
      kv("Destinatário", detail.destinatario_nome || "-"),
      kv("Doc. Destinatário", cleanNum(detail.destinatario_doc) || "-"),
      kv("Valor total", fmtMoney(detail.valor_total)),
      kv("Origem", detail.source || "-"),
      kv("Chave", detail.chave || "-"),
    ),
    el("div", { style: "margin-top:14px" },
      el("label", { style: "font-size:11.5px; color:var(--muted); text-transform:uppercase" }, "XML"),
      el("textarea", { readonly: "true", style: "min-height:200px; font-size:11.5px" }, detail.xml || "(XML não encontrado)"),
    ),
  );
  showModal({
    title: `Documento ${detail.chave || detail.id}`,
    body,
    wide: true,
    footer: [
      el("button", { class: "btn", onClick: () => downloadXml(detail) }, "Baixar XML"),
      detail.chave ? el("button", { class: "btn", onClick: () => consultarMeuDANFe(detail) }, "🔍 Consultar no MeuDANFe") : null,
      el("button", { class: "btn btn--primary", onClick: () => downloadPdf(detail) }, "Baixar PDF"),
    ].filter(Boolean),
  });
}

function kv(label, value) {
  return el("div", { class: "kv" }, el("div", { class: "kv__label" }, label), el("div", { class: "kv__value" }, String(value || "-")));
}

function downloadPdf(r) { apiDownload(`/api/docs/${r.id}/pdf`, `${r.kind}-${cleanNum(r.numero) || r.chave || r.id}.pdf`); }
function downloadXml(r) { apiDownload(`/api/docs/${r.id}/xml`, `${r.chave || r.id}.xml`); }
