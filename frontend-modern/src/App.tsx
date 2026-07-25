import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  BarChart3,
  Bell,
  Building2,
  CloudDownload,
  FileDown,
  FileText,
  Files,
  Gauge,
  LayoutDashboard,
  Network,
  Link,
  Linkedin,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PackageSearch,
  Radar,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, Company, download, setCompany, User } from "./api";

type Page =
  | "dashboard"
  | "documents"
  | "import"
  | "reports"
  | "certificates"
  | "integrations"
  | "feedback"
  | "profile"
  | "companies"
  | "users";
type AppNotification = {
  id: number;
  title: string;
  text: string;
  createdAt: string;
  read?: boolean;
  kind: "success" | "error" | "news";
};
function storedNotifications(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem("cordeiro.notifications") || "[]");
  } catch {
    return [];
  }
}
const brl = (v: any) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const date = (v: any) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

function Brand() {
  return (
    <div className="brand">
      <span>
        <img
          src="/assets/cordeiro-mascote-v2.png"
          alt="Cordeirinho Cordeiro Fiscal"
        />
      </span>
      <b>
        Cordeiro<small>FISCAL</small>
      </b>
    </div>
  );
}
function Login({ done }: { done: (u: User) => void }) {
  const certificateInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"login" | "register" | "verify">("login"),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [devCode, setDevCode] = useState(""),
    [certificate, setCertificate] = useState<File | null>(null),
    [certificatePassword, setCertificatePassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function loginWithCertificate() {
    if (!certificate) {
      certificateInput.current?.click();
      return;
    }
    if (!certificatePassword) {
      setError("Informe a senha do certificado digital.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("certificate", certificate);
      form.append("password", certificatePassword);
      await api("/api/auth/certificate-login", { method: "POST", body: form });
      done((await api<{ user: User }>("/api/auth/me")).user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        await api("/api/auth/login", {
          method: "POST",
          body: { username, password },
        });
        done((await api<{ user: User }>("/api/auth/me")).user);
      } else if (mode === "register") {
        const response = await api<any>("/api/auth/register-start", {
          method: "POST",
          body: { nome: name, email, username, password },
        });
        setDevCode(response.codigoDev || "");
        setMode("verify");
      } else {
        const response = await api<any>("/api/auth/register-verify", {
          method: "POST",
          body: { email, codigo: code },
        });
        done(response.user);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-art">
        <Brand />
        <div>
          <span className="eyebrow">
            <Sparkles /> GESTÃO FISCAL INTELIGENTE
          </span>
          <h1>
            Seus documentos fiscais,<em> sob controle.</em>
          </h1>
          <p>
            Consulte, organize e transforme dados fiscais em decisões mais
            rápidas para sua empresa.
          </p>
          <small>
            <ShieldCheck /> Ambiente seguro e dados protegidos
          </small>
        </div>
      </section>
      <section className="login-side">
        <form className="auth-card" onSubmit={submit}>
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="eyebrow">
            {mode === "login"
              ? "BEM-VINDO"
              : mode === "register"
                ? "NOVA CONTA"
                : "VERIFICAÇÃO"}
          </span>
          <h2>
            {mode === "login"
              ? "Acesse sua conta"
              : mode === "register"
                ? "Crie seu acesso"
                : "Confirme seu e-mail"}
          </h2>
          <p>
            {mode === "login"
              ? "Informe suas credenciais para continuar."
              : mode === "register"
                ? "Preencha seus dados para começar."
                : `Enviamos um código de 6 dígitos para ${email}.`}
          </p>
          {mode === "register" && (
            <>
              <label>
                Nome completo
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                />
              </label>
              <label>
                E-mail
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                />
              </label>
            </>
          )}
          {mode !== "verify" && (
            <>
              <label>
                Usuário
                <input
                  autoFocus={mode === "login"}
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Digite seu usuário"
                />
              </label>
              <label>
                Senha
                <input
                  required
                  minLength={4}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </label>
            </>
          )}
          {mode === "verify" && (
            <label>
              Código de verificação
              <input
                autoFocus
                required
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
              />
              {devCode && (
                <small className="dev-code">
                  Ambiente local: use o código {devCode}
                </small>
              )}
            </label>
          )}
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={busy}>
            {busy ? (
              <RefreshCw className="spin" />
            ) : mode === "login" ? (
              "Entrar no sistema"
            ) : mode === "register" ? (
              "Criar conta"
            ) : (
              "Validar e entrar"
            )}
          </button>
          {mode === "login" && (
            <div className="mtls-login">
              <div className="auth-divider"><span>ou acesse com</span></div>
              <input
                ref={certificateInput}
                className="certificate-file-input"
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                onChange={(event) => {
                  setCertificate(event.target.files?.[0] || null);
                  setError("");
                }}
              />
              <button type="button" className="mtls-button" disabled={busy}
                onClick={loginWithCertificate}>
                <i><ShieldCheck /></i>
                <span><b>Certificado digital INTECOM</b>
                  <small>{certificate ? certificate.name : "Selecionar arquivo .PFX ou .P12"}</small></span>
                <span className="mtls-arrow">→</span>
              </button>
              {certificate && (
                <label className="certificate-password">
                  Senha do certificado
                  <input
                    type="password"
                    value={certificatePassword}
                    onChange={(event) => setCertificatePassword(event.target.value)}
                    placeholder="Digite a senha do certificado"
                  />
                </label>
              )}
              <p><ShieldCheck /> O arquivo é processado somente para validar o acesso e não é salvo no servidor.</p>
            </div>
          )}
          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setError("");
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            {mode === "login"
              ? "Ainda não tem usuário? Cadastre-se"
              : "Já possui uma conta? Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
const groups = [
  ["Visão operacional", [["dashboard", "Cockpit fiscal", Radar]]],
  [
    "Gestão documental",
    [
      ["documents", "Central de documentos", Files],
      ["import", "Central XML", UploadCloud],
      ["reports", "Inteligência fiscal", BarChart3],
      ["certificates", "Regularidade CND", ShieldCheck],
    ],
  ],
  ["Integrações", [["integrations", "Hub SEFAZ", Network]]],
  [
    "Governança",
    [
      ["companies", "Empresas", Building2],
      ["users", "Controle de acessos", UserRound],
    ],
  ],
] as any[];
function Head({
  tag,
  title,
  text,
  action,
}: {
  tag: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">{tag}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </header>
  );
}
function Panel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      {title && <h3>{title}</h3>}
      {children}
      {title === "Movimentação mensal" && <FiscalNews />}
    </section>
  );
}
function Empty() {
  return (
    <div className="empty">
      <PackageSearch />
      <b>Nenhum registro encontrado</b>
      <small>Os dados aparecerão aqui quando estiverem disponíveis.</small>
    </div>
  );
}

function TeamActivity(){
  const [items,setItems]=useState<any[]>([]);
  useEffect(()=>{api<any>("/api/activity").then(r=>setItems(r.items||[])).catch(()=>{})},[]);
  return <><Head tag="AUDITORIA COMPARTILHADA" title="Atividades da equipe"
    text="Inclusões e alterações realizadas pelos usuários desta empresa ou filial."/>
    <Panel>{items.length?<div className="activity-feed">{items.map(item=><article key={item.id}>
      <i><Activity/></i><div><b>{item.usuario_nome}</b><p>{item.acao} em {item.modulo}</p>
      <small>{new Date(item.created_at).toLocaleString("pt-BR")}{item.entidade_id?` · registro ${item.entidade_id}`:""}</small></div>
    </article>)}</div>:<Empty/>}</Panel></>;
}
function Dashboard() {
  const [k, setK] = useState<any>({}),
    [months, setMonths] = useState<any[]>([]),
    [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [a, b] = await Promise.all([
        api<any>("/api/dashboard/kpis"),
        api<any>("/api/dashboard/por-mes?ultimos=8"),
      ]);
      setK(a);
      setMonths(Array.isArray(b) ? b : b.items || b.data || []);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const cards = [
    ["Documentos", k.total ?? k.documentos ?? 0, FileText, "mint"],
    ["Valor movimentado", brl(k.valor_total ?? k.valor), Gauge, "violet"],
    ["Autorizados", k.autorizados ?? 0, ShieldCheck, "blue"],
    ["Este mês", k.mes_atual ?? k.no_mes ?? 0, Activity, "amber"],
  ] as any[];
  return (
    <>
      <Head
        tag="VISÃO GERAL"
        title="Dashboard"
        text="Acompanhe os principais indicadores da operação."
        action={
          <button className="secondary" onClick={load}>
            <RefreshCw className={busy ? "spin" : ""} />
            Atualizar
          </button>
        }
      />
      <div className="kpis">
        {cards.map(([label, value, Icon, tone]) => (
          <article className="kpi" key={label}>
            <i className={tone}>
              <Icon />
            </i>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <em>Dados atualizados</em>
            </div>
          </article>
        ))}
      </div>
      <Panel title="Movimentação mensal">
        <div className="chart">
          <ResponsiveContainer>
            <AreaChart data={months}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#16a37b" stopOpacity=".35" />
                  <stop offset="1" stopColor="#16a37b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Area
                dataKey="total"
                stroke="#16a37b"
                strokeWidth={3}
                fill="url(#fill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </>
  );
}
function FiscalNews() {
  const [items, setItems] = useState<any[]>([]),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    api<any>("/api/news")
      .then((r) =>
        setItems([...(r.externos || []), ...(r.curadas || [])].slice(0, 6)),
      )
      .finally(() => setBusy(false));
  }, []);
  return (
    <section className="news-section">
      <div className="section-title">
        <div>
          <span className="eyebrow">RADAR FISCAL</span>
          <h2>Notícias do mundo fiscal</h2>
          <p>
            Atualizações sobre tributação, NF-e, CT-e, SPED e Reforma
            Tributária.
          </p>
        </div>
      </div>
      <div className="news-grid">
        {busy ? (
          <div className="panel">
            <RefreshCw className="spin" />
          </div>
        ) : (
          items.map((n, i) => (
            <a
              className={`news-card ${i === 0 ? "featured" : ""}`}
              href={n.url}
              target="_blank"
              rel="noreferrer"
              key={n.id || n.url || i}
            >
              <span>{n.tagLabel || n.fonte || "NOTÍCIA"}</span>
              <h3>{n.titulo}</h3>
              <p>{n.resumo}</p>
              <footer>
                <b>{n.fonte || "Radar Fiscal"}</b>
                <small>{n.data ? date(n.data) : "Atualização recente"}</small>
              </footer>
            </a>
          ))
        )}
      </div>
    </section>
  );
}
const fiscalTextFilters = [
  ["emitenteCnpj", "CNPJ do emitente"],
  ["emitenteRazaoSocial", "Razão social do emitente"],
  ["emitenteNomeFantasia", "Nome fantasia do emitente"],
  ["destinatarioNome", "Destinatário/Tomador"],
  ["chaveAcesso", "Chave de acesso"],
  ["regraValidacao", "Regra de validação"],
  ["regraViolada", "Regra violada"],
  ["ultimaManifestacao", "Última manifestação/Eventos"],
  ["finalidadeEmissao", "Finalidade da emissão"],
  ["tipoOperacao", "Tipo de operação"],
];
const fiscalDateFilters = [
  ["dataCancelamentoFrom", "Cancelamento: de"],
  ["dataCancelamentoTo", "Cancelamento: até"],
  ["dataRegistroFrom", "Registro no ERP: de"],
  ["dataRegistroTo", "Registro no ERP: até"],
  ["dataUltimaManifestacaoFrom", "Manifestação: de"],
  ["dataUltimaManifestacaoTo", "Manifestação: até"],
  ["dataValidacaoRegraFrom", "Validação da regra: de"],
  ["dataValidacaoRegraTo", "Validação da regra: até"],
];
const fiscalBoolFilters = [
  ["cancelados", "Cancelados"],
  ["registrada", "Registrada no ERP"],
  ["registrosInvalidos", "Registros inválidos"],
  ["invalidado", "Invalidado"],
  ["assinaturaInvalida", "Assinatura inválida"],
  ["schemaInvalido", "Schema inválido"],
  ["terceiros", "Documentos de terceiros"],
  ["cartaCorrecao", "Carta de correção"],
  ["semManifestacao", "Sem manifestação"],
];

function FiscalFilters({
  filters,
  onChange,
  onClear,
  description,
}: {
  filters: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onClear: () => void;
  description: string;
}) {
  const active = Object.values(filters).filter(Boolean).length;
  return (
    <section className="advanced-filters">
      <header>
        <div>
          <b>Filtros fiscais avançados</b>
          <small>{description}</small>
        </div>
        <span className="filter-count">{active} ativo(s)</span>
        <button className="link" onClick={onClear} disabled={!active}>
          Limpar tudo
        </button>
      </header>
      <div>
        {fiscalTextFilters.map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              value={filters[name] || ""}
              onChange={(e) => onChange(name, e.target.value)}
            />
          </label>
        ))}
        <label>
          Tipo de documento
          <select
            value={filters.tipoDocumento || ""}
            onChange={(e) => onChange("tipoDocumento", e.target.value)}
          >
            <option value="">Todos</option>
            <option value="NFE">NF-e</option>
            <option value="CTE">CT-e</option>
            <option value="NFSE">NFS-e</option>
            <option value="MDFE">MDF-e</option>
          </select>
        </label>
        {fiscalDateFilters.map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              type="date"
              value={filters[name] || ""}
              onChange={(e) => onChange(name, e.target.value)}
            />
          </label>
        ))}
        {fiscalBoolFilters.map(([name, label]) => (
          <label key={name}>
            {label}
            <select
              value={filters[name] || ""}
              onChange={(e) => onChange(name, e.target.value)}
            >
              <option value="">Todos</option>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}

function Documents({ toast }: { toast: (s: string, e?: boolean) => void }) {
  const [items, setItems] = useState<any[]>([]),
    [q, setQ] = useState(""),
    [page,setPage]=useState(1),
    [total,setTotal]=useState(0),
    [pages,setPages]=useState(1),
    [busy, setBusy] = useState(true),
    [selected, setSelected] = useState<any>(null),
    [showFilters, setShowFilters] = useState(false),
    [filters, setFilters] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    setBusy(true);
    const params = new URLSearchParams({limit:"25",page:String(page),q,...filters});
    api<any>(`/api/docs?${params}`)
      .then((r) => {
        setItems(
          Array.isArray(r) ? r : r.items || r.docs || r.documentos || [],
        );
        setTotal(Array.isArray(r)?r.length:Number(r.total||0));
        setPages(Array.isArray(r)?1:Number(r.pages||1));
      })
      .catch((e) => toast(e.message, true))
      .finally(() => setBusy(false));
  }, [toast, filters,page,q]);
  useEffect(() => {
    load();
  }, [load]);
  const rows = items;
  const exportParams = new URLSearchParams(filters);
  const setFilter = (name: string, value: string) =>
    setFilters((current) => ({ ...current, [name]: value }));
  const textFilters = [
    ["emitenteCnpj", "CNPJ do Emitente"],
    ["emitenteRazaoSocial", "Razão Social do Emitente"],
    ["emitenteNomeFantasia", "Nome Fantasia do Emitente"],
    ["destinatarioNome", "Destinatário/Tomador"],
    ["chaveAcesso", "Chave de Acesso"],
    ["regraValidacao", "Regra de Validação"],
    ["regraViolada", "Regra Violada"],
    ["ultimaManifestacao", "Última Manifestação / Eventos"],
    ["finalidadeEmissao", "Finalidade da Emissão"],
    ["tipoOperacao", "Tipo de Operação"],
  ];
  const dateFilters = [
    ["dataCancelamentoFrom", "Cancelamento: de"],
    ["dataCancelamentoTo", "Cancelamento: até"],
    ["dataRegistroFrom", "Registro ERP: de"],
    ["dataRegistroTo", "Registro ERP: até"],
    ["dataUltimaManifestacaoFrom", "Manifestação: de"],
    ["dataUltimaManifestacaoTo", "Manifestação: até"],
    ["dataValidacaoRegraFrom", "Validação da regra: de"],
    ["dataValidacaoRegraTo", "Validação da regra: até"],
  ];
  const boolFilters = [
    ["cancelados", "Cancelados"],
    ["registrada", "Registrada no ERP"],
    ["registrosInvalidos", "Registros Inválidos"],
    ["invalidado", "Invalidado"],
    ["assinaturaInvalida", "Assinatura Inválida"],
    ["schemaInvalido", "Schema Inválido"],
    ["terceiros", "Documentos de Terceiros"],
    ["cartaCorrecao", "Carta de Correção"],
    ["semManifestacao", "Sem Manifestação"],
  ];
  async function view(id: number) {
    try {
      setSelected(await api(`/api/docs/${id}`));
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function remove(id: number) {
    if (!confirm("Excluir este documento e seu XML?")) return;
    try {
      await api(`/api/docs/${id}`, { method: "DELETE" });
      setSelected(null);
      toast("Documento excluído");
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  return (
    <>
      <Head
        tag="DOCUMENTOS"
        title="Documentos fiscais"
        text={`${total} registros encontrados · página ${page} de ${pages}`}
      />
      <Panel>
        <div className="document-downloads">
          <button
            className="secondary"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Search /> {showFilters ? "Ocultar filtros" : "Filtros avançados"}
          </button>
          <button
            className="secondary"
            onClick={() =>
              download(
                `/api/relatorio/lote?formato=xml&${exportParams}`,
                "documentos-xml.zip",
              )
            }
          >
            <FileDown /> Baixar XMLs
          </button>
          <button
            className="secondary"
            onClick={() =>
              download(
                `/api/relatorio/lote?formato=pdf&${exportParams}`,
                "documentos-pdf.zip",
              )
            }
          >
            <FileText /> Baixar PDFs
          </button>
          <button
            className="primary"
            onClick={() =>
              download(
                `/api/relatorio/xlsx?itens=1&${exportParams}`,
                "relatorio-documentos.xlsx",
              )
            }
          >
            <BarChart3 /> Relatório da tela
          </button>
        </div>
        {showFilters && (
          <FiscalFilters
            filters={filters}
            onChange={setFilter}
            onClear={() => setFilters({})}
            description="A listagem, os XMLs, PDFs e o relatório da tela respeitam estes filtros."
          />
        )}
        <div className="toolbar">
          <div>
            <Search />
            <input
              value={q}
              onChange={(e) => {setQ(e.target.value);setPage(1)}}
              placeholder="Buscar por chave, número, emitente ou CNPJ..."
            />
          </div>
          <button className="square" onClick={load}>
            <RefreshCw className={busy ? "spin" : ""} />
          </button>
        </div>
        <div className="doc-tabs">
          <button className="active">Todos</button>
          <button onClick={() => setQ("NFE")}>NF-e</button>
          <button onClick={() => setQ("CTE")}>CT-e</button>
          <button onClick={() => setQ("NFSE")}>NFS-e</button>
        </div>
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Emitente</th>
                <th>Emissão</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Incluído por</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => (
                <tr key={d.id || i}>
                  <td>
                    <b>
                      {d.kind || d.tipo || d.modelo || "NF-e"} #
                      {d.numero || "—"}
                    </b>
                    <small>{d.chave || d.chave_acesso || "Sem chave"}</small>
                  </td>
                  <td>
                    {d.emitente_razao_social ||
                      d.remetente_nome ||
                      d.emitente ||
                      "—"}
                    <small>
                      {d.emitente_cnpj || d.remetente_doc || d.cnpj}
                    </small>
                  </td>
                  <td>{date(d.data_emissao || d.emissao)}</td>
                  <td>
                    <b>{brl(d.valor_total || d.valor)}</b>
                  </td>
                  <td>
                    <span className="status">{d.status || "Autorizado"}</span>
                  </td>
                  <td>{d.created_by_name || "Sistema / SEFAZ"}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="square"
                        title="Visualizar documento completo"
                        onClick={() => view(d.id)}
                      >
                        <Search />
                      </button>
                      <button
                        className="square"
                        title="Baixar XML"
                        onClick={() =>
                          download(
                            `/api/docs/${d.id}/xml`,
                            `documento-${d.id}.xml`,
                          )
                        }
                      >
                        <FileDown />
                      </button>
                      <button
                        className="square danger"
                        title="Excluir"
                        onClick={() => remove(d.id)}
                      >
                        <X />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!busy && !rows.length && <Empty />}
        </div>
        {pages>1&&<nav className="pagination" aria-label="Paginação de documentos">
          <button className="secondary" disabled={page===1} onClick={()=>setPage(value=>value-1)}>← Anterior</button>
          <div>{Array.from({length:Math.min(7,pages)},(_,index)=>{
            const start=Math.max(1,Math.min(page-3,pages-6)),number=start+index;
            return <button className={number===page?"active":""} key={number} onClick={()=>setPage(number)}>{number}</button>;
          })}</div>
          <button className="secondary" disabled={page===pages} onClick={()=>setPage(value=>value+1)}>Próxima →</button>
        </nav>}
      </Panel>
      {selected && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <section className="document-modal">
            <header>
              <div>
                <span className="eyebrow">
                  {selected.kind || "DOCUMENTO FISCAL"}
                </span>
                <h2>Documento #{selected.numero || selected.id}</h2>
              </div>
              <button className="square" onClick={() => setSelected(null)}>
                <X />
              </button>
            </header>
            <div className="document-summary">
              {[
                ["Chave de acesso", selected.chave],
                [
                  "Emitente",
                  selected.emitente_razao_social || selected.remetente_nome,
                ],
                [
                  "CNPJ emitente",
                  selected.emitente_cnpj || selected.remetente_doc,
                ],
                [
                  "Destinatário",
                  selected.destinatario_tomador_nome ||
                    selected.destinatario_nome,
                ],
                ["Emissão", date(selected.data_emissao)],
                ["Valor total", brl(selected.valor_total)],
                ["Status", selected.status],
                ["Protocolo", selected.protocolo],
                ["Origem", selected.source],
                [
                  "UF",
                  `${selected.uf_emitente || "—"} → ${selected.uf_destino || "—"}`,
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <b>{v || "—"}</b>
                </div>
              ))}
            </div>
            <div className="xml-preview">
              <div>
                <b>XML completo</b>
                <small>Conteúdo original armazenado</small>
              </div>
              <pre>{selected.xml || "XML não disponível"}</pre>
            </div>
            <footer>
              <button
                className="danger-button"
                onClick={() => remove(selected.id)}
              >
                <X />
                Excluir documento
              </button>
              <button
                className="secondary"
                onClick={() =>
                  download(
                    `/api/docs/${selected.id}/pdf`,
                    `danfe-${selected.numero || selected.id}.pdf`,
                  )
                }
              >
                <FileText />
                Baixar DANFE
              </button>
              <button
                className="primary"
                onClick={() =>
                  download(
                    `/api/docs/${selected.id}/xml`,
                    `${selected.chave || selected.id}.xml`,
                  )
                }
              >
                <FileDown />
                Baixar XML
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
function Importer({ toast,done }: { toast: (s: string, e?: boolean) => void; done:()=>void }) {
  const [files, setFiles] = useState<File[]>([]),
    [drag, setDrag] = useState(false),
    [busy, setBusy] = useState(false),
    [progress,setProgress]=useState({current:0,total:0,imported:0});
  const add = (f: FileList | null) =>
    setFiles((v) => [
      ...v,
      ...Array.from(f || []).filter((x) =>
        x.name.toLowerCase().endsWith(".xml"),
      ),
    ]);
  async function send() {
    if(!files.length)return;
    const batches:File[][]=[];let current:File[]=[],size=0;
    for(const file of files){
      if(file.size>3_500_000){toast(`${file.name}: arquivo maior que 3,5 MB`,true);continue}
      if(size+file.size>3_500_000&&current.length){batches.push(current);current=[];size=0}
      current.push(file);size+=file.size;
    }
    if(current.length)batches.push(current);
    if(!batches.length)return;
    setBusy(true);
    setProgress({current:0,total:batches.length,imported:0});
    try {
      let imported=0;
      for(let index=0;index<batches.length;index++){
        const body=new FormData();
        batches[index].forEach(file=>body.append("files",file));
        const response=await api<any>("/api/docs/upload",{method:"POST",body});
        imported+=Number(response.importados??response.items?.length??0);
        setProgress({current:index+1,total:batches.length,imported});
      }
      toast(`${imported} documento(s) importado(s) e disponível(is) em Documentos`);
      setFiles([]);
      done();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Head
        tag="IMPORTAÇÃO"
        title="Importar documentos"
        text="Envie arquivos XML de NF-e, CT-e ou NFS-e para processamento."
      />
      <Panel>
        <label
          className={`drop ${drag ? "drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            add(e.dataTransfer.files);
          }}
        >
          <input
            type="file"
            accept=".xml"
            multiple
            onChange={(e) => add(e.target.files)}
          />
          <i>
            <UploadCloud />
          </i>
          <h3>Arraste seus arquivos XML aqui</h3>
          <p>ou clique para selecionar no computador</p>
          <small>Até 10.000 documentos por lote</small>
          <small>Grandes seleções são divididas e enviadas automaticamente em lotes seguros.</small>
        </label>
        {files.length > 0 && (
          <div className="queue">
            <div>
              <b>{files.length} arquivo(s) pronto(s)</b>
              <small>
                {(files.reduce((n, f) => n + f.size, 0) / 1024).toFixed(1)} KB
              </small>
            </div>
            <button className="link" onClick={() => setFiles([])}>
              Limpar
            </button>
            <button className="primary" onClick={send} disabled={busy}>
              {busy ? <RefreshCw className="spin" /> : <UploadCloud />}
              {busy?`Enviando ${progress.current}/${progress.total} · ${progress.imported} importados`:"Importar e abrir Documentos"}
            </button>
          </div>
        )}
      </Panel>
    </>
  );
}
function Reports({ toast }: { toast: (s: string, e?: boolean) => void }) {
  const [format, setFormat] = useState("xlsx"),
    [type, setType] = useState("todos");
  async function run() {
    try {
      const params = new URLSearchParams({
        tipo: type,
        itens: "1",
      });
      await download(
        `/api/relatorio/${format}?${params}`,
        `relatorio.${format}`,
      );
      toast("Relatório gerado com sucesso");
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  return (
    <>
      <Head
        tag="ANÁLISE"
        title="Central de relatórios"
        text="Configure filtros e colunas para gerar relatórios fiscais completos."
      />
      <div className="report-grid">
        <Panel title="Novo relatório">
          <div className="fields">
            <label>
              Tipo
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="nfe">NF-e</option>
                <option value="cte">CT-e</option>
              </select>
            </label>
            <label>
              Formato
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="xlsx">Excel</option>
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
          </div>
          <div className="report-actions">
            <button className="primary" onClick={run}>
              <FileDown />
              Gerar relatório
            </button>
          </div>
        </Panel>
        <article className="promo">
          <BarChart3 />
          <span className="eyebrow">INSIGHTS</span>
          <h2>Transforme dados em decisões.</h2>
          <p>
            Relatórios organizados para conferência fiscal e análise gerencial.
          </p>
        </article>
      </div>
    </>
  );
}

function Certificates({ toast }: { toast: (s: string, e?: boolean) => void }) {
  const emptyForm = {
    tipo: "federal",
    status: "negativa",
    dataEmissao: "",
    dataValidade: "",
    modoValidade: "data_direta",
    validadeDias: "",
    numeroCertidao: "",
    observacoes: "",
    alertaModo:"dias",
    alertaDias:10,
    alertaDiaSemana:1,
    alertaDiaMes:1,
  };
  const [items, setItems] = useState<any[]>([]),
    [stats, setStats] = useState<any>({}),
    [companies, setCompanies] = useState<any[]>([]),
    [cndConfig, setCndConfig] = useState<any>(null),
    [recipients, setRecipients] = useState<any[]>([]),
    [recipientCompany, setRecipientCompany] = useState(""),
    [recipientEmail, setRecipientEmail] = useState(""),
    [filter, setFilter] = useState(""),
    [cndPage,setCndPage]=useState(1),
    [form, setForm] = useState<any>(null),
    [cndPdf, setCndPdf] = useState<File | null>(null),
    [uploadId, setUploadId] = useState<number | null>(null),
    fileInput = useRef<HTMLInputElement>(null),
    smartInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const [rows, summary, companyResult, configResult] = await Promise.all([
        api<any[]>("/api/certidoes"),
        api<any>("/api/certidoes/stats"),
        api<any>("/api/empresas"),
        api<any>("/api/certidoes/config"),
      ]);
      setItems(rows);
      setStats(summary);
      setCompanies(companyResult.empresas || companyResult || []);
      setCndConfig(configResult.config);
      setRecipients(configResult.destinatarios || []);
    } catch (error) {
      toast((error as Error).message, true);
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const saved = await api<any>(
        form.id ? `/api/certidoes/${form.id}` : "/api/certidoes",
        {
          method: form.id ? "PUT" : "POST",
          body: {
            ...form,
            validadeDias: form.validadeDias
              ? Number(form.validadeDias)
              : undefined,
          },
        },
      );
      if (cndPdf) {
        const pdfBody = new FormData();
        pdfBody.set("pdf", cndPdf);
        await api(`/api/certidoes/${saved.id || form.id}/pdf`, {
          method: "POST",
          body: pdfBody,
        });
      }
      setForm(null);
      setCndPdf(null);
      toast(form.id ? "Certidão atualizada" : "Certidão registrada");
      load();
    } catch (error) {
      toast((error as Error).message, true);
    }
  }
  async function uploadPdf(file?: File) {
    if (!file || !uploadId) return;
    const body = new FormData();
    body.set("pdf", file);
    try {
      await api(`/api/certidoes/${uploadId}/pdf`, {
        method: "POST",
        body,
      });
      toast("PDF vinculado à certidão");
      load();
    } catch (error) {
      toast((error as Error).message, true);
    }
  }
  async function recognizePdf(files?: FileList | null) {
    if (!files?.length) return;
    let imported=0;
    for(const file of Array.from(files)){
      const body=new FormData(); body.set("pdf",file);
      try{await api<any>("/api/certidoes/recognize",{method:"POST",body});imported++}
      catch(error){toast(`${file.name}: ${(error as Error).message}`,true)}
    }
    if(imported)toast(`${imported} certidão(ões) importada(s) e vinculada(s) pelo CNPJ`);
    load();
    if (smartInput.current) smartInput.current.value = "";
  }
  async function saveConfig() {
    try {
      const saved=await api<any>("/api/certidoes/config",{method:"PUT",body:cndConfig});
      setCndConfig(saved); toast("Configurações de CND salvas");
    } catch(error) { toast((error as Error).message,true); }
  }
  async function addRecipient(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/certidoes/destinatarios",{method:"POST",body:{
        empresa_id:Number(recipientCompany),email:recipientEmail,
      }});
      setRecipientEmail(""); toast("Destinatário adicionado"); load();
    } catch(error) { toast((error as Error).message,true); }
  }
  async function removeRecipient(id:number) {
    try { await api(`/api/certidoes/destinatarios/${id}`,{method:"DELETE"}); load(); }
    catch(error) { toast((error as Error).message,true); }
  }
  const visible = items.filter((item) =>
    `${item.empresa_nome} ${item.tipo} ${item.numero_certidao} ${item.status}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const cndPages=Math.max(1,Math.ceil(visible.length/12));
  const visiblePage=visible.slice((cndPage-1)*12,cndPage*12);
  const typeLabel: Record<string, string> = {
    federal: "Federal",
    estadual: "Estadual",
    municipal: "Municipal",
    fgts: "FGTS",
    cndt: "CNDT",
    imobiliario: "Imobiliária",
  };
  return (
    <>
      <Head
        tag="REGULARIDADE FISCAL"
        title="Certidões CND"
        text="Controle vencimentos, situação fiscal, PDFs e histórico das certidões."
        action={
          <div className="cnd-head-actions">
            <button
              className="secondary"
              onClick={() => smartInput.current?.click()}
            >
              <Sparkles /> Ler PDF e gravar
            </button>
            <button className="primary" onClick={() => setForm(emptyForm)}>
              + Nova certidão
            </button>
            <input
              ref={smartInput}
              hidden
              type="file"
              multiple
              accept="application/pdf"
              onChange={(e) => recognizePdf(e.target.files)}
            />
          </div>
        }
      />
      <div className="cnd-stats">
        {[
          ["Total de CNDs", stats.total || 0, FileText, "blue"],
          ["Negativas", stats.negativas || 0, ShieldCheck, "mint"],
          ["Com efeitos de negativa", stats.com_efeitos || 0, Bell, "amber"],
          ["Positivas", stats.positivas || 0, Activity, "red"],
        ].map(([label, value, Icon, tone]: any) => (
          <article key={label}>
            <i className={tone}>
              <Icon />
            </i>
            <div>
              <small>{label}</small>
              <b>{value}</b>
            </div>
          </article>
        ))}
      </div>
      <div className="cnd-overview">
        <Panel title="Vencimento próximo">
          {items.filter((item)=>{
            if(!item.data_validade) return false;
            const days=Math.ceil((new Date(`${item.data_validade}T23:59:59`).getTime()-Date.now())/86400000);
            return days>=0 && days<=Number(cndConfig?.prazo_alerta||10);
          }).slice(0,5).map(item=><div className="cnd-overview-row" key={item.id}>
            <b>{item.empresa_nome}</b><span>{typeLabel[item.tipo]||item.tipo}</span>
            <small>Validade: {date(item.data_validade)}</small>
          </div>)}
          {!items.some((item)=>{
            const days=item.data_validade?Math.ceil((new Date(`${item.data_validade}T23:59:59`).getTime()-Date.now())/86400000):-1;
            return days>=0&&days<=Number(cndConfig?.prazo_alerta||10);
          }) && <p className="muted">Nenhuma certidão próxima do vencimento</p>}
        </Panel>
        <Panel title="Certidões positivas">
          {items.filter(item=>item.status==="positiva").slice(0,5).map(item=>
            <div className="cnd-overview-row" key={item.id}><b>{item.empresa_nome}</b>
              <span>{typeLabel[item.tipo]||item.tipo}</span><small>Validade: {date(item.data_validade)}</small>
            </div>)}
          {!items.some(item=>item.status==="positiva")&&<p className="muted">Nenhuma certidão positiva</p>}
        </Panel>
      </div>
      <Panel>
        <div className="cnd-toolbar">
          <Search />
          <input
            value={filter}
            onChange={(e) => {setFilter(e.target.value);setCndPage(1)}}
            placeholder="Buscar empresa, tipo, número ou status..."
          />
          <button className="secondary" onClick={load}>
            <RefreshCw /> Atualizar
          </button>
        </div>
        <div className="cnd-grid">
          {visiblePage.length ? (
            visiblePage.map((item) => {
              const days = item.data_validade
                ? Math.ceil(
                    (new Date(`${item.data_validade}T23:59:59`).getTime() -
                      Date.now()) /
                      86400000,
                  )
                : null;
              const expired = days != null && days < 0;
              return (
                <article
                  className={`cnd-card ${expired ? "expired" : ""}`}
                  key={item.id}
                >
                  <header>
                    <i>
                      <ShieldCheck />
                    </i>
                    <span
                      className={`status ${item.status === "positiva" ? "inactive" : ""}`}
                    >
                      {item.status === "negativa"
                        ? "Negativa"
                        : item.status === "positiva"
                          ? "Positiva"
                          : "Positiva com efeitos"}
                    </span>
                  </header>
                  <small>{typeLabel[item.tipo] || item.tipo}</small>
                  <h3>{item.empresa_nome}</h3>
                  <p>{item.numero_certidao || "Sem número informado"}</p>
                  <dl>
                    <div>
                      <dt>Emissão</dt>
                      <dd>{date(item.data_emissao)}</dd>
                    </div>
                    <div>
                      <dt>Validade</dt>
                      <dd>{date(item.data_validade)}</dd>
                    </div>
                    <div>
                      <dt>Situação</dt>
                      <dd className={expired ? "bad-text" : "ok-text"}>
                        {days == null
                          ? "Sem validade"
                          : expired
                            ? `Vencida há ${Math.abs(days)} dias`
                            : `${days} dias restantes`}
                      </dd>
                    </div>
                  </dl>
                  <footer>
                    <button
                      className="secondary"
                      onClick={() =>
                        setForm({
                          ...emptyForm,
                          ...item,
                          dataEmissao: item.data_emissao || "",
                          dataValidade: item.data_validade || "",
                        })
                      }
                    >
                      Editar
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setUploadId(item.id);
                        setTimeout(() => fileInput.current?.click());
                      }}
                    >
                      PDF
                    </button>
                    {item.pdf_url && (
                      <a
                        className="secondary"
                        href={item.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Visualizar
                      </a>
                    )}
                  </footer>
                </article>
              );
            })
          ) : (
            <Empty />
          )}
        </div>
        {cndPages>1&&<nav className="pagination" aria-label="Paginação de certidões">
          <button className="secondary" disabled={cndPage===1} onClick={()=>setCndPage(value=>value-1)}>← Anterior</button>
          <div>{Array.from({length:Math.min(7,cndPages)},(_,index)=>{
            const start=Math.max(1,Math.min(cndPage-3,cndPages-6)),number=start+index;
            return <button className={number===cndPage?"active":""} key={number} onClick={()=>setCndPage(number)}>{number}</button>;
          })}</div>
          <button className="secondary" disabled={cndPage===cndPages} onClick={()=>setCndPage(value=>value+1)}>Próxima →</button>
        </nav>}
        <input
          ref={fileInput}
          hidden
          type="file"
          accept="application/pdf"
          onChange={(e) => uploadPdf(e.target.files?.[0])}
        />
      </Panel>
      {false && cndConfig && <Panel title="Configurações e alertas por e-mail">
        <div className="cnd-settings">
          <section>
            <h4>Prazo de alerta de vencimento</h4>
            <p>Quantos dias antes do vencimento a certidão será marcada como “A Vencer”.</p>
            <label className="inline-field"><input type="number" min="1" max="365"
              value={cndConfig.prazo_alerta} onChange={e=>setCndConfig({...cndConfig,prazo_alerta:Number(e.target.value)})}/> dias</label>
            <label className="check"><input type="checkbox" checked={Boolean(cndConfig.alertas_ativos)}
              onChange={e=>setCndConfig({...cndConfig,alertas_ativos:e.target.checked})}/> Alertas por e-mail ativos</label>
            {[
              ["alerta_vencimento","Vencimento próximo"],
              ["alerta_vencidas","CNDs vencidas"],
              ["alerta_positivas","CNDs positivas"],
            ].map(([key,label])=><label className="check" key={key}><input type="checkbox"
              checked={Boolean(cndConfig[key])} onChange={e=>setCndConfig({...cndConfig,[key]:e.target.checked})}/>{label}</label>)}
            <label>Caixa de saída (remetente)<input type="email" value={cndConfig.remetente||""}
              onChange={e=>setCndConfig({...cndConfig,remetente:e.target.value})} placeholder="financeiro@empresa.com.br"/></label>
            <button className="primary" onClick={saveConfig}><Save/> Salvar</button>
          </section>
          <section>
            <h4>E-mails de destinatários</h4>
            <form className="recipient-form" onSubmit={addRecipient}>
              <select required value={recipientCompany} onChange={e=>setRecipientCompany(e.target.value)}>
                <option value="">Selecione a empresa ou filial</option>
                {companies.filter(c=>c.ativo!==false&&c.ativo!==0).map(c=>
                  <option key={c.id} value={c.id}>{c.nome}{c.empresa_matriz_id?" (Filial)":" (Matriz)"}</option>)}
              </select>
              <input required type="email" value={recipientEmail} onChange={e=>setRecipientEmail(e.target.value)}
                placeholder="e-mail do destinatário"/>
              <button className="secondary">Adicionar</button>
            </form>
            <div className="recipient-list">{recipients.map(r=><div key={r.id}>
              <span><b>{r.email}</b><small>{r.empresa_nome} {r.empresa_matriz_id?"(Filial)":"(Matriz)"} · Ativo</small></span>
              <button className="square" onClick={()=>removeRecipient(r.id)}><X/></button>
            </div>)}</div>
            <p><b>{recipients.filter(r=>r.ativo).length}</b> destinatário(s) ativo(s)</p>
            <button className="secondary" onClick={async()=>{try{const r=await api<any>("/api/certidoes/enviar-teste",{method:"POST"});toast(r.message)}
              catch(error){toast((error as Error).message,true)}}}><Send/> Enviar teste</button>
          </section>
        </div>
        <div className="cnd-info"><b>Tipos suportados:</b> Federal, Estadual, Municipal, FGTS, CNDT e Imobiliário.
          As certidões são classificadas como válida, a vencer ou vencida conforme o prazo configurado.</div>
      </Panel>}
      {form && (
        <div className="modal-backdrop">
          <form className="feedback-modal cnd-modal" onSubmit={save}>
            <header>
              <div>
                <span className="eyebrow">CERTIDÃO FISCAL</span>
                <h2>{form.id ? "Editar certidão" : "Nova certidão"}</h2>
              </div>
              <button
                type="button"
                className="square"
                onClick={() => {
                  setForm(null);
                  setCndPdf(null);
                }}
              >
                <X />
              </button>
            </header>
            <div className="fields">
              <label>
                Tipo
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  {Object.entries(typeLabel).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="negativa">Negativa</option>
                  <option value="positiva_com_efeitos_de_negativa">
                    Positiva com efeitos de negativa
                  </option>
                  <option value="positiva">Positiva</option>
                </select>
              </label>
              <label>
                Número da certidão
                <input
                  value={form.numeroCertidao ?? form.numero_certidao ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, numeroCertidao: e.target.value })
                  }
                />
              </label>
              <label>
                Data de emissão
                <input
                  type="date"
                  value={form.dataEmissao}
                  onChange={(e) =>
                    setForm({ ...form, dataEmissao: e.target.value })
                  }
                />
              </label>
              <label>
                Data de validade
                <input
                  type="date"
                  value={form.dataValidade}
                  onChange={(e) =>
                    setForm({ ...form, dataValidade: e.target.value })
                  }
                />
              </label>
              <label>
                Frequência do alerta
                <select value={form.alertaModo||form.alerta_modo||"dias"}
                  onChange={e=>setForm({...form,alertaModo:e.target.value})}>
                  <option value="dias">Dias antes do vencimento</option>
                  <option value="semanal">Semanal, em dia fixo</option>
                  <option value="mensal">Mensal, em dia fixo</option>
                </select>
              </label>
              {(form.alertaModo||form.alerta_modo||"dias")==="dias"&&<label>
                Antecedência em dias<input type="number" min="1" max="365"
                  value={form.alertaDias??form.alerta_dias??10}
                  onChange={e=>setForm({...form,alertaDias:Number(e.target.value)})}/>
              </label>}
              {(form.alertaModo||form.alerta_modo)==="semanal"&&<label>
                Dia da semana<select value={form.alertaDiaSemana??form.alerta_dia_semana??1}
                  onChange={e=>setForm({...form,alertaDiaSemana:Number(e.target.value)})}>
                  {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"].map((label,index)=>
                    <option value={index} key={label}>{label}</option>)}
                </select>
              </label>}
              {(form.alertaModo||form.alerta_modo)==="mensal"&&<label>
                Dia do mês<input type="number" min="1" max="28"
                  value={form.alertaDiaMes??form.alerta_dia_mes??1}
                  onChange={e=>setForm({...form,alertaDiaMes:Number(e.target.value)})}/>
              </label>}
            </div>
            <label>
              Observações
              <textarea
                rows={4}
                value={form.observacoes || ""}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
              />
            </label>
            <label className="cnd-pdf-field">
              Anexar PDF da certidão
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setCndPdf(e.target.files?.[0] || null)}
              />
              <small>
                {cndPdf
                  ? `${cndPdf.name} · ${(cndPdf.size / 1024 / 1024).toFixed(2)} MB`
                  : form.pdf_url
                    ? "PDF já vinculado. Selecione outro para substituir."
                    : "Arquivo PDF de até 15 MB."}
              </small>
            </label>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setForm(null);
                  setCndPdf(null);
                }}
              >
                Cancelar
              </button>
              <button className="primary">
                <Save /> Salvar certidão
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

function TurnstileBox({
  sitekey,
  onToken,
}: {
  sitekey: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    widget = useRef<string | number | null>(null);
  useEffect(() => {
    let timer: number;
    const render = () => {
      const ts = (window as any).turnstile;
      if (!ts || !ref.current) {
        timer = window.setTimeout(render, 250);
        return;
      }
      if (widget.current != null)
        try {
          ts.remove(widget.current);
        } catch {}
      widget.current = ts.render(ref.current, {
        sitekey,
        theme: "auto",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    if (sitekey) render();
    return () => {
      clearTimeout(timer);
      const ts = (window as any).turnstile;
      if (ts && widget.current != null)
        try {
          ts.remove(widget.current);
        } catch {}
    };
  }, [sitekey, onToken]);
  if (!sitekey)
    return (
      <div className="captcha-warning">
        <ShieldCheck />
        <div>
          <b>CAPTCHA aguardando configuração</b>
          <small>
            Cadastre o domínio atual no Cloudflare Turnstile e salve a sitekey
            pública abaixo.
          </small>
        </div>
      </div>
    );
  return (
    <div className="captcha-box">
      <div ref={ref} />
      <small>
        Conclua a verificação para liberar o download pelo MeuDANFE.
      </small>
    </div>
  );
}

function Integrations({ toast }: { toast: (s: string, e?: boolean) => void }) {
  const [key, setKey] = useState(""),
    [kind, setKind] = useState("nfe"),
    [provider, setProvider] = useState("auto"),
    [results, setResults] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [captchaToken, setCaptchaToken] = useState(""),
    [sitekey, setSitekey] = useState("0x4AAAAAAD9QFuEXmAjhoAuE"),
    [sitekeyInput, setSitekeyInput] = useState("0x4AAAAAAD9QFuEXmAjhoAuE");
  const keyInput = useRef<HTMLTextAreaElement>(null);
  const openConnector = (target: string) => {
    if (target === "query") {
      keyInput.current?.focus();
      keyInput.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (target === "portal") {
      window.open(
        "https://www.nfe.fazenda.gov.br/portal/principal.aspx",
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    document
      .getElementById(target)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  useEffect(() => {
    api<any>("/api/meudanfe/config")
      .then((c) => {
        const configured=c.turnstileSiteKey||"0x4AAAAAAD9QFuEXmAjhoAuE";
        setSitekey(configured);
        setSitekeyInput(configured);
      })
      .catch(() => {});
  }, []);
  async function saveSitekey() {
    try {
      const r = await api<any>("/api/meudanfe/config", {
        method: "POST",
        body: { turnstileSiteKey: sitekeyInput.trim() },
      });
      setSitekey(r.turnstileSiteKey || sitekeyInput.trim());
      setCaptchaToken("");
      toast("Configuração do CAPTCHA salva");
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function consult() {
    const keys = [
      ...new Set(
        key
          .split(/[\s,;]+/)
          .map((value) => value.replace(/\D/g, ""))
          .filter(Boolean),
      ),
    ];
    const invalid = keys.filter((value) => !/^\d{44}$/.test(value));
    if (!keys.length || invalid.length) {
      toast(
        invalid.length
          ? `${invalid.length} chave(s) inválida(s). Cada chave deve conter 44 dígitos.`
          : "Informe ao menos uma chave de acesso",
        true,
      );
      return;
    }
    if (keys.length > 100) {
      toast("O limite é de 100 chaves por consulta", true);
      return;
    }
    setBusy(true);
    setResults([]);
    try {
      const collected: any[] = [];
      for (let index = 0; index < keys.length; index += 5) {
        const batch = keys.slice(index, index + 5);
        const responses = await Promise.all(
          batch.map(async (accessKey) => {
            try {
              if (provider === "meudanfe" && !captchaToken)
                throw new Error(
                  "MeuDANFE requer a validação anti-bot antes da consulta",
                );
              if (
                provider === "meudanfe" ||
                (provider === "auto" && captchaToken)
              ) {
                try {
                  const data = await api(
                    `/api/meudanfe/chave/${accessKey}/importar`,
                    {
                      method: "POST",
                      body: { turnstileToken: captchaToken },
                    },
                  );
                  return {
                    key: accessKey,
                    ok: true,
                    data,
                    provider: "MeuDANFE",
                  };
                } catch (error) {
                  if (provider === "meudanfe") throw error;
                }
              }
              const data = await api(`/api/consulta/${kind}/${accessKey}`);
              return {
                key: accessKey,
                ok: Boolean((data as any)?.ok ?? true),
                data,
                provider:
                  provider === "sefaz" ? "Portal SEFAZ" : "Portal automático",
                error: (data as any)?.error,
              };
            } catch (error) {
              return {
                key: accessKey,
                ok: false,
                error: (error as Error).message,
              };
            }
          }),
        );
        collected.push(...responses);
        setResults([...collected]);
      }
      const found = collected.filter((item) => item.ok).length;
      toast(
        `Consulta concluída: ${found} localizado(s), ${collected.length - found} com erro`,
        found === 0,
      );
      if (provider !== "meudanfe")
        try {
          const sync = await fetch("/api/sefaz/cert/periodo-auto", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ultNSUInicial: "0" }),
          });
          if (!sync.ok) {
            let reason = `Erro ${sync.status}`;
            try {
              reason = (await sync.json()).error || reason;
            } catch {}
            throw new Error(reason);
          }
          const total = sync.headers.get("X-Sefaz-Total") || "0";
          const imported = sync.headers.get("X-Sefaz-Salvos") || "0";
          const lastNsu = sync.headers.get("X-Sefaz-UltNSU") || "";
          const contentType=sync.headers.get("content-type")||"";
          const blob = await sync.blob();
          if (blob.size > 0 && contentType.includes("application/zip")) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `sefaz-consulta-${new Date()
              .toISOString()
              .slice(0, 10)}.zip`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
          toast(
            `SEFAZ: ${total} arquivo(s) baixado(s), ${imported} integrado(s) em Documentos${lastNsu ? ` · NSU ${lastNsu}` : ""}`,
          );
        } catch (error) {
          toast(
            `Falha na sincronização SEFAZ: ${(error as Error).message}`,
            true,
          );
        }
    } finally {
      setBusy(false);
    }
  }
  async function xml(accessKey: string, data?: any, source?: string) {
    if (data?.xml) {
      const url = URL.createObjectURL(
        new Blob([data.xml], { type: "application/xml;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${kind}-${accessKey}.xml`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast("XML retornado pela SEFAZ");
      return;
    }
    if (source !== "MeuDANFE" && data?.provider !== "meudanfe") {
      try {
        const response=await fetch(`/api/docs/${accessKey}/xml`,{credentials:"same-origin"});
        if(!response.ok) throw new Error((await response.json()).error||"XML ainda não foi importado");
        const url=URL.createObjectURL(await response.blob()),anchor=document.createElement("a");
        anchor.href=url; anchor.download=`${kind}-${accessKey}.xml`; anchor.click();
        URL.revokeObjectURL(url); toast("XML importado baixado"); return;
      } catch(error) { toast((error as Error).message,true); return; }
    }
    if (!captchaToken) {
      toast("Conclua o CAPTCHA antes do download", true);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/meudanfe/chave/${accessKey}/xml`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: captchaToken }),
      });
      if (!response.ok)
        throw new Error((await response.json()).error || "Falha ao baixar XML");
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `${kind}-${accessKey}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      setCaptchaToken("");
      toast("XML baixado");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Head
        tag="DOCUMENTOS OFICIAIS"
        title="SEFAZ e NFS-e Nacional"
        text="Consulte chaves e baixe XML usando as integrações configuradas para a empresa."
      />
      <section className="sefaz-command">
        <div className="sefaz-command-icon">
          <CloudDownload />
        </div>
        <div>
          <span className="eyebrow">HUB DE INTEGRAÇÕES FISCAIS</span>
          <h2>Consulta segura e sincronização automática</h2>
          <p>
            Consulte até 100 chaves. O sistema escolhe a melhor fonte, baixa o
            retorno e integra os documentos automaticamente.
          </p>
        </div>
        <div className="sefaz-command-status">
          <span>
            <i /> mTLS protegido
          </span>
          <span>
            <i /> Integração ativa
          </span>
        </div>
      </section>
      <div className="fiscal-grid">
        <Panel title="Central de consulta por chave">
          <div className="query-box">
            <label>
              Documento
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="nfe">NF-e</option>
                <option value="cte">CT-e</option>
              </select>
            </label>
            <label>
              Origem da consulta
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="auto">Automático (com alternativa)</option>
                <option value="sefaz">SEFAZ / Distribuição DF-e</option>
                <option value="meudanfe">MeuDANFE</option>
              </select>
            </label>
            <label>
              Chave de acesso
              <textarea
                ref={keyInput}
                rows={3}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={
                  "Cole até 100 chaves, uma por linha\n00000000000000000000000000000000000000000000"
                }
              />
              <small>
                {
                  key
                    .split(/[\s,;]+/)
                    .map((value) => value.replace(/\D/g, ""))
                    .filter(Boolean).length
                }{" "}
                chave(s) informada(s)
              </small>
            </label>
            <button className="primary" onClick={consult} disabled={busy}>
              {busy ? <RefreshCw className="spin" /> : <CloudDownload />}Consultar e importar
            </button>
          </div>
          {results.length > 0 && (
            <div className="batch-query-results">
              <header>
                <b>Resultado da consulta em lote</b>
                <span>
                  {results.filter((item) => item.ok).length}/{results.length}{" "}
                  localizados
                </span>
              </header>
              {results.map((item) => (
                <div
                  className={`consult-result ${item.ok ? "" : "failed"}`}
                  key={item.key}
                >
                  {item.ok ? <ShieldCheck /> : <X />}
                  <div>
                    <b>
                      {item.ok
                        ? "Documento localizado"
                        : "Não foi possível consultar"}
                    </b>
                    <small>
                      {item.ok
                        ? item.data?.status ||
                          item.data?.situacao ||
                          "Consulta concluída"
                        : item.error}{" "}
                      {item.provider ? `· ${item.provider} ` : ""}· chave{" "}
                      {item.key.slice(0, 6)}…{item.key.slice(-6)}
                    </small>
                  </div>
                  {item.ok && (
                    <button
                      className="secondary"
                      onClick={() => xml(item.key, item.data, item.provider)}
                    >
                      <FileDown />
                      XML
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Verificação anti-bot">
        <div className="captcha-settings">
          <label>
            Sitekey pública do Cloudflare Turnstile
            <input
              value={sitekeyInput}
              onChange={(e) => setSitekeyInput(e.target.value)}
              placeholder="0x4AAAA..."
            />
          </label>
          <button className="secondary" onClick={saveSitekey}>
            <Save />
            Salvar sitekey
          </button>
        </div>
        <TurnstileBox sitekey={sitekey} onToken={setCaptchaToken} />
        {captchaToken && (
          <div className="captcha-ok">
            <ShieldCheck /> CAPTCHA validado. O download está liberado.
          </div>
        )}
      </Panel>
      <div className="official-note">
        <ShieldCheck />
        <div>
          <b>Integração segura por empresa</b>
          <p>
            NFS-e Nacional e distribuição DF-e exigem certificado digital A1
            válido e autorização do CNPJ. Credenciais ficam no backend e nunca
            são expostas ao navegador.
          </p>
        </div>
      </div>
      <div id="certificate-monitor">
        <FiscalOperations />
      </div>
    </>
  );
}

function SefazBatch({ toast }: { toast: (s: string, e?: boolean) => void }) {
  const [certs, setCerts] = useState<any[]>([]),
    [thumbprint, setThumbprint] = useState(""),
    [password, setPassword] = useState(""),
    [cnpj, setCnpj] = useState(""),
    [uf, setUf] = useState("SP"),
    [keys, setKeys] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<any>("/api/sefaz/cert/listar")
      .then((r) => {
        const list = r.certificados || [];
        setCerts(list);
        if (list[0]) setThumbprint(list[0].thumbprint);
      })
      .catch(() => {});
  }, []);
  async function run() {
    const valid = keys
      .split(/\r?\n/)
      .map((k) => k.replace(/\D/g, ""))
      .filter((k) => k.length === 44);
    if (!valid.length) {
      toast("Informe ao menos uma chave válida", true);
      return;
    }
    if (!thumbprint || !password || !cnpj) {
      toast("Selecione o certificado e informe senha e CNPJ", true);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("thumbprint", thumbprint);
      body.set("senha", password);
      body.set("cnpj", cnpj.replace(/\D/g, ""));
      body.set("uf", uf);
      body.set("chaves", valid.join("\n"));
      body.set("formato", "xml");
      body.set("salvarNoBanco", "1");
      const response = await fetch("/api/sefaz/cert/lote", {
        method: "POST",
        credentials: "same-origin",
        body,
      });
      if (!response.ok) {
        const j = await response.json();
        throw new Error(j.error || "Falha na consulta em lote");
      }
      const saved = response.headers.get("X-Sefaz-Salvos") || "0",
        ok = response.headers.get("X-Sefaz-Ok") || "0";
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `sefaz-lote-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`${ok} XML(s) baixados; ${saved} integrado(s) em Documentos`);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function runDestined() {
    if (!thumbprint || !password || !cnpj) {
      toast("Selecione o certificado e informe senha e CNPJ", true);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("thumbprint", thumbprint);
      body.set("senha", password);
      body.set("cnpj", cnpj.replace(/\D/g, ""));
      body.set("uf", uf);
      body.set("formato", "xml");
      body.set("salvarNoBanco", "1");
      body.set("ultNSUInicial", "0");
      const response = await fetch("/api/sefaz/cert/periodo", {
        method: "POST",
        credentials: "same-origin",
        body,
      });
      if (!response.ok) {
        const j = await response.json();
        throw new Error(j.error || "Falha ao consultar NFs destinadas");
      }
      const saved = response.headers.get("X-Sefaz-Salvos") || "0";
      const total = response.headers.get("X-Sefaz-Total") || "0";
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `nfs-destinadas-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(
        `${total} documento(s) destinado(s) obtidos; ${saved} integrado(s) em Documentos`,
      );
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function runAutomatic() {
    setBusy(true);
    try {
      const response = await fetch("/api/sefaz/cert/periodo-auto", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ultNSUInicial: "0" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Falha na consulta automática");
      }
      const total = response.headers.get("X-Sefaz-Total") || "0";
      const saved = response.headers.get("X-Sefaz-Salvos") || "0";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `nfs-destinadas-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`${total} XML(s) concluídos; ${saved} integrados em Documentos`);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="NFs destinadas — consulta automática">
      <div className="batch-intro">
        <ShieldCheck />
        <div>
          <b>Identificação automática por mTLS</b>
          <small>
            O CNPJ vem da empresa ativa e o certificado privado correspondente é
            localizado no repositório seguro do Windows. Nenhuma senha ou UF é
            solicitada na tela.
          </small>
        </div>
      </div>
      <button
        className="primary batch-button"
        onClick={runAutomatic}
        disabled={busy}
      >
        {busy ? <RefreshCw className="spin" /> : <CloudDownload />}
        Buscar, baixar e integrar NFs destinadas
      </button>
    </Panel>
  );
  /*
  return (
    <Panel title="Download de XML em lote">
      <div className="batch-intro">
        <CloudDownload />
        <div>
          <b>Baixe e integre em uma única operação</b>
          <small>
            Os XMLs encontrados são colocados no ZIP e cadastrados
            automaticamente na aba Documentos.
          </small>
        </div>
      </div>
      <div className="batch-form">
        <label>
          Certificado A1
          <select
            value={thumbprint}
            onChange={(e) => setThumbprint(e.target.value)}
          >
            <option value="">Selecione...</option>
            {certs.map((c) => (
              <option key={c.thumbprint} value={c.thumbprint}>
                {c.label || c.subject}
              </option>
            ))}
          </select>
        </label>
        <label>
          Senha do certificado
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          CNPJ vinculado
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </label>
        <label>
          UF
          <select value={uf} onChange={(e) => setUf(e.target.value)}>
            {[
              "AC",
              "AL",
              "AP",
              "AM",
              "BA",
              "CE",
              "DF",
              "ES",
              "GO",
              "MA",
              "MT",
              "MS",
              "MG",
              "PA",
              "PB",
              "PR",
              "PE",
              "PI",
              "RJ",
              "RN",
              "RS",
              "RO",
              "RR",
              "SC",
              "SP",
              "SE",
              "TO",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Chaves de acesso, uma por linha
        <textarea
          rows={6}
          value={keys}
          onChange={(e) => setKeys(e.target.value)}
          placeholder={"3526... (44 dígitos)\n3526... (44 dígitos)"}
        />
      </label>
      <div className="batch-actions">
        <button className="primary batch-button" onClick={run} disabled={busy}>
          {busy ? <RefreshCw className="spin" /> : <CloudDownload />}Baixar
          chaves e integrar
        </button>
        <button
          className="secondary batch-button"
          onClick={runDestined}
          disabled={busy}
        >
          <ShieldCheck />
          Buscar todas as NFs destinadas ao CNPJ
        </button>
      </div>
    </Panel>
  );
  */
}

function FiscalOperations() {
  const [monitor, setMonitor] = useState<any>(null),
    [certs, setCerts] = useState<any[]>([]),
    [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [m, c] = await Promise.all([
        api<any>("/api/sefaz-monitor"),
        api<any>("/api/sefaz/cert/listar"),
      ]);
      setMonitor(m);
      setCerts(Array.isArray(c) ? c : c.certificados || []);
    } catch {
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const visible = (monitor?.ufs || []).slice(0, 12);
  return (
    <section className="fiscal-ops">
      <div className="section-title">
        <div>
          <span className="eyebrow">OPERAÇÃO FISCAL</span>
          <h2>Monitor e certificado digital</h2>
          <p>Status dos serviços e credenciais disponíveis nesta máquina.</p>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw className={busy ? "spin" : ""} />
          Atualizar
        </button>
      </div>
      <div className="ops-kpis">
        <article>
          <small>Serviços online</small>
          <b className="ok-text">{monitor?.online ?? "—"}</b>
        </article>
        <article>
          <small>Serviços offline</small>
          <b className="bad-text">{monitor?.offline ?? "—"}</b>
        </article>
        <article>
          <small>Certificados A1</small>
          <b>{certs.length}</b>
        </article>
        <article>
          <small>Última verificação</small>
          <b>
            {monitor?.checkedAt
              ? new Date(monitor.checkedAt).toLocaleTimeString("pt-BR")
              : "—"}
          </b>
        </article>
      </div>
      <div className="status-grid">
        {visible.map((u: any, i: number) => (
          <article
            className={u.ok ? "online" : "offline"}
            key={`${u.env}-${u.uf}-${i}`}
          >
            <div>
              <b>{u.uf}</b>
              <small>{u.env}</small>
            </div>
            <span>{u.ok ? "● Online" : "● Offline"}</span>
          </article>
        ))}
      </div>
      <div className="certificate-list">
        {certs.length ? (
          certs.map((c: any) => (
            <article key={c.thumbprint}>
              <ShieldCheck />
              <div>
                <b>{c.label || c.subject}</b>
                <small>Emissor: {c.issuer}</small>
              </div>
              <span>Válido até {c.vence || date(c.notAfter)}</span>
            </article>
          ))
        ) : (
          <div className="cert-alert">
            <ShieldCheck />
            <div>
              <b>Nenhum certificado A1 detectado</b>
              <small>
                Instale o certificado no Windows ou carregue um arquivo PFX nas
                operações SEFAZ.
              </small>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Profile({
  user,
  onUpdate,
  toast,
}: {
  user: User;
  onUpdate: (u: User) => void;
  toast: (s: string, e?: boolean) => void;
}) {
  const [form, setForm] = useState({ ...user }),
    [busy, setBusy] = useState(false);
  const field =
    (name: keyof User) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((v) => ({ ...v, [name]: e.target.value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ user: User }>("/api/auth/me", {
        method: "PUT",
        body: form,
      });
      onUpdate(r.user);
      setForm({ ...r.user });
      toast("Perfil atualizado");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Selecione uma imagem válida", true);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("avatar", file);
      const r = await api<{ user: User }>("/api/auth/me/avatar", {
        method: "POST",
        body,
      });
      onUpdate(r.user);
      setForm({ ...r.user });
      toast("Foto do perfil atualizada");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function removeAvatar() {
    setBusy(true);
    try {
      await api("/api/auth/me/avatar", { method: "DELETE" });
      const r = await api<{ user: User }>("/api/auth/me");
      onUpdate(r.user);
      setForm({ ...r.user });
      toast("Foto removida");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Head
        tag="MINHA CONTA"
        title="Perfil profissional"
        text="Personalize como você aparece no Cordeiro e mantenha seus contatos atualizados."
      />
      <div className="profile-grid">
        <Panel>
          <form className="profile-form" onSubmit={save}>
            <div className="profile-hero">
              <div className="avatar-editor">
                <span className="profile-photo">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} />
                  ) : (
                    <img src="/assets/cordeiro-mascote-v2.png" />
                  )}
                </span>
                <label className="avatar-upload">
                  Alterar foto
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => uploadAvatar(e.target.files?.[0])}
                  />
                </label>
                {user.avatar_url && (
                  <button
                    type="button"
                    className="avatar-remove"
                    onClick={removeAvatar}
                  >
                    Remover
                  </button>
                )}
              </div>
              <div>
                <h2>{form.nome || user.username}</h2>
                <p>
                  {form.cargo || "Adicione seu cargo"} ·{" "}
                  {form.area_atuacao || "Área de atuação"}
                </p>
              </div>
            </div>
            <div className="fields">
              <label>
                Nome
                <input value={form.nome || ""} onChange={field("nome")} />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={field("email")}
                />
              </label>
              <label>
                Cargo
                <input
                  value={form.cargo || ""}
                  onChange={field("cargo")}
                  placeholder="Ex.: Analista fiscal"
                />
              </label>
              <label>
                Área de atuação
                <input
                  value={form.area_atuacao || ""}
                  onChange={field("area_atuacao")}
                  placeholder="Ex.: Contabilidade"
                />
              </label>
            </div>
            <label>
              Sobre você
              <textarea
                rows={4}
                value={form.bio || ""}
                onChange={field("bio")}
                placeholder="Conte um pouco sobre sua experiência..."
              />
            </label>
            <h3>Links e contato</h3>
            <div className="fields">
              <label>
                <Linkedin /> LinkedIn
                <input
                  value={form.linkedin_url || ""}
                  onChange={field("linkedin_url")}
                  placeholder="https://linkedin.com/in/..."
                />
              </label>
              <label>
                <Link /> Site
                <input
                  value={form.website_url || ""}
                  onChange={field("website_url")}
                  placeholder="https://..."
                />
              </label>
              <label>
                Instagram
                <input
                  value={form.instagram_url || ""}
                  onChange={field("instagram_url")}
                  placeholder="https://instagram.com/..."
                />
              </label>
              <label>
                Telefone
                <input
                  value={form.telefone || ""}
                  onChange={field("telefone")}
                  placeholder="(00) 00000-0000"
                />
              </label>
            </div>
            <button className="primary" disabled={busy}>
              {busy ? <RefreshCw className="spin" /> : <Save />}Salvar perfil
            </button>
          </form>
        </Panel>
        <article className="profile-preview">
          <span className="profile-photo large">
            <img src={user.avatar_url || "/assets/cordeiro-mascote-v2.png"} />
          </span>
          <span className="eyebrow">SEU CARTÃO</span>
          <h2>{form.nome || user.username}</h2>
          <b>
            {form.cargo || "Profissional"} · {form.area_atuacao || "Fiscal"}
          </b>
          <p>{form.bio || "Sua apresentação profissional aparecerá aqui."}</p>
          <div>
            {form.linkedin_url && (
              <a href={form.linkedin_url} target="_blank">
                <Linkedin />
                LinkedIn
              </a>
            )}
            {form.website_url && (
              <a href={form.website_url} target="_blank">
                <Link />
                Website
              </a>
            )}
          </div>
        </article>
      </div>
    </>
  );
}

function FeedbackPage({ toast }: { toast: (s: string, e?: boolean) => void }) {
  const [message, setMessage] = useState(""),
    [subject, setSubject] = useState(""),
    [category, setCategory] = useState("melhoria"),
    [statusFilter, setStatusFilter] = useState("todos"),
    [busy, setBusy] = useState(false),
    [items, setItems] = useState<any[]>([]),
    [isAdmin, setIsAdmin] = useState(false),
    [editing, setEditing] = useState<any>(null),
    [reply, setReply] = useState("");
  const load = useCallback(async () => {
    try {
      const all = await api<any[]>("/api/feedback");
      setItems(all);
      setIsAdmin(true);
    } catch {
      try {
        setItems(await api<any[]>("/api/feedback/me"));
        setIsAdmin(false);
      } catch (e) {
        toast((e as Error).message, true);
      }
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/feedback", {
        method: "POST",
        body: {
          categoria: category,
          assunto: subject,
          mensagem: message,
        },
      });
      setMessage("");
      setSubject("");
      toast("Chamado enviado para a equipe");
      load();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function saveEdit() {
    try {
      await api(`/api/feedback/${editing.id}`, {
        method: "PATCH",
        body: { status: editing.status, resposta: reply },
      });
      setEditing(null);
      setReply("");
      toast("Feedback atualizado");
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function remove(id: number) {
    if (!confirm("Excluir este feedback?")) return;
    try {
      await api(`/api/feedback/${id}`, { method: "DELETE" });
      toast("Feedback excluído");
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  return (
    <>
      <Head
        tag="SUPORTE"
        title={isAdmin ? "Central de atendimento" : "Central de suporte"}
        text={
          isAdmin
            ? "Gerencie chamados, responda usuários e acompanhe pendências."
            : "Abra um chamado e acompanhe todas as respostas da equipe."
        }
      />
      <div className="support-kpis">
        {[
          ["Total", items.length],
          [
            "Em aberto",
            items.filter((item) =>
              ["aberto", "em_analise"].includes(item.status),
            ).length,
          ],
          [
            "Resolvidos",
            items.filter((item) => item.status === "resolvido").length,
          ],
        ].map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <b>{value}</b>
          </article>
        ))}
      </div>
      <div className="feedback-grid">
        <Panel title="Abrir novo chamado">
          <form className="feedback-form" onSubmit={send}>
            <label>
              Categoria
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="melhoria">Melhoria</option>
                <option value="bug">Problema</option>
                <option value="duvida">Dúvida</option>
                <option value="implementacao">Nova função</option>
              </select>
            </label>
            <label>
              Assunto
              <input
                required
                maxLength={120}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Resumo do que você precisa"
              />
            </label>
            <label>
              Descrição
              <textarea
                rows={7}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva sua ideia, dúvida ou problema..."
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? <RefreshCw className="spin" /> : <Send />}
              Enviar chamado
            </button>
          </form>
        </Panel>
        <Panel title={isAdmin ? "Chamados recebidos" : "Meus chamados"}>
          <div className="support-filter">
            {["todos", "aberto", "em_analise", "resolvido"].map((status) => (
              <button
                className={statusFilter === status ? "active" : ""}
                onClick={() => setStatusFilter(status)}
                key={status}
              >
                {status === "todos"
                  ? "Todos"
                  : status === "em_analise"
                    ? "Em análise"
                    : status === "aberto"
                      ? "Abertos"
                      : "Resolvidos"}
              </button>
            ))}
          </div>
          <div className="feedback-list">
            {items.filter(
              (item) =>
                statusFilter === "todos" || item.status === statusFilter,
            ).length ? (
              items
                .filter(
                  (item) =>
                    statusFilter === "todos" || item.status === statusFilter,
                )
                .map((x) => (
                  <article key={x.id}>
                    <div className="feedback-head">
                      <span className="status">{x.status}</span>
                      {isAdmin && (
                        <span className="feedback-user">{x.username}</span>
                      )}
                    </div>
                    <b>{x.assunto || x.categoria}</b>
                    <p>{x.mensagem}</p>
                    {x.resposta && (
                      <small>
                        <strong>Resposta:</strong> {x.resposta}
                      </small>
                    )}
                    {isAdmin && (
                      <div className="feedback-actions">
                        <button
                          className="secondary"
                          onClick={() => {
                            setEditing({ ...x });
                            setReply(x.resposta || "");
                          }}
                        >
                          <Save />
                          Editar e responder
                        </button>
                        <button
                          className="danger-button"
                          onClick={() => remove(x.id)}
                        >
                          <X />
                          Excluir
                        </button>
                      </div>
                    )}
                  </article>
                ))
            ) : (
              <Empty />
            )}
          </div>
        </Panel>
      </div>
      {editing && (
        <div className="modal-backdrop">
          <section className="feedback-modal">
            <header>
              <div>
                <span className="eyebrow">ADMINISTRAÇÃO</span>
                <h2>Editar feedback #{editing.id}</h2>
              </div>
              <button className="square" onClick={() => setEditing(null)}>
                <X />
              </button>
            </header>
            <p>{editing.mensagem}</p>
            <label>
              Status
              <select
                value={editing.status}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
              >
                <option value="aberto">Aberto</option>
                <option value="em_analise">Em análise</option>
                <option value="resolvido">Resolvido</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
            </label>
            <label>
              Resposta
              <textarea
                rows={6}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Escreva uma resposta para o usuário..."
              />
            </label>
            <footer>
              <button className="secondary" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="primary" onClick={saveEdit}>
                <Save />
                Salvar alterações
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function Assistant() {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<any[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [aiEnabled, setAiEnabled] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      api<any>("/api/assistant/status")
        .then((status) => setAiEnabled(Boolean(status.ai)))
        .catch(() => setAiEnabled(false));
    }
    if (open && !items.length) {
      api<any>("/api/assistant/history")
        .then((r) => setItems(r.messages || []))
        .catch(() => {});
    }
  }, [open, items.length]);
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      messagesRef.current?.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [items, busy, open]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text;
    setItems((v) => [...v, { role: "user", content }]);
    setText("");
    setBusy(true);
    try {
      const r = await api<any>("/api/assistant/message", {
        method: "POST",
        body: { message: content },
      });
      setItems((v) => [...v, r.message]);
    } catch {
      setItems((value) => [
        ...value,
        {
          role: "assistant",
          content:
            "Não consegui responder agora. Tente novamente em alguns instantes.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="assistant-button" onClick={() => setOpen((v) => !v)}>
        {open ? (
          <X />
        ) : (
          <>
            <img src="/assets/cordeiro-mascote-v2.png" alt="" />
            <span>Ajuda</span>
          </>
        )}
      </button>
      {open && (
        <section className="assistant">
          <header>
            <img src="/assets/cordeiro-mascote-v2.png" alt="" />
            <div>
              <b>Assistente Cordeiro</b>
              <small>
                Online · {aiEnabled ? "IA fiscal ativada" : "ajuda fiscal"}
              </small>
            </div>
            <button onClick={() => setOpen(false)}>
              <X />
            </button>
          </header>
          <div className="messages" ref={messagesRef}>
            {!items.length && (
              <>
                <div className="assistant-welcome">
                  <i>
                    <Sparkles />
                  </i>
                  <b>Olá! Sou sua IA fiscal.</b>
                  <p>
                    Posso analisar dúvidas sobre documentos, SEFAZ, CNDs,
                    relatórios e operação do sistema.
                  </p>
                </div>
                <div className="assistant-suggestions">
                  {[
                    "Resuma meus documentos fiscais",
                    "Como consultar NF-e na SEFAZ?",
                    "Quais CNDs estão vencendo?",
                  ].map((suggestion) => (
                    <button
                      onClick={() => setText(suggestion)}
                      key={suggestion}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            )}
            {items.map((m, i) => (
              <div
                className={m.role === "user" ? "user-message" : "bot-message"}
                key={m.id || i}
              >
                {m.role !== "user" && (
                  <i>
                    <img src="/assets/cordeiro-mascote-v2.png" alt="" />
                  </i>
                )}
                <span>{m.content}</span>
              </div>
            ))}
            {busy && (
              <div className="bot-message typing">
                <i>
                  <img src="/assets/cordeiro-mascote-v2.png" alt="" />
                </i>
                <span>
                  <b />
                  <b />
                  <b />
                </span>
              </div>
            )}
          </div>
          <form onSubmit={send}>
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Pergunte à IA fiscal..."
            />
            <button disabled={busy || !text.trim()}>
              <Send />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
function NotificationCenter({
  items,
  markAllRead,
}: {
  items: AppNotification[];
  markAllRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const unread = items.filter((item) => !item.read).length;
  return (
    <div className="notification-center">
      <button
        className="notification-trigger"
        title="Notificações"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell />
        {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <section className="notification-panel">
          <header>
            <div>
              <b>Notificações</b>
              <small>Conclusões, pendências e atualizações</small>
            </div>
            <button onClick={markAllRead}>Marcar como lidas</button>
          </header>
          <div>
            {items.length ? (
              items.slice(0, 30).map((item) => (
                <article className={item.read ? "read" : ""} key={item.id}>
                  <i className={item.kind}>
                    {item.kind === "error" ? <X /> : <ShieldCheck />}
                  </i>
                  <div>
                    <b>{item.title}</b>
                    <p>{item.text}</p>
                    <small>
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <Empty />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Messenger() {
  const [open, setOpen] = useState(false),
    [users, setUsers] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [messages, setMessages] = useState<any[]>([]),
    [text, setText] = useState(""),
    [unread, setUnread] = useState(0);
  const loadUsers = useCallback(() => {
    api<any[]>("/api/messages/users")
      .then((rows) => {
        setUsers(rows);
        setUnread(rows.reduce((total, userItem) => total + userItem.unread, 0));
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadUsers();
    const timer = window.setInterval(loadUsers, 15000);
    return () => clearInterval(timer);
  }, [loadUsers]);
  const openThread = async (userItem: any) => {
    setSelected(userItem);
    try {
      setMessages(await api<any[]>(`/api/messages/thread/${userItem.id}`));
      loadUsers();
    } catch {}
  };
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !text.trim()) return;
    const message = await api<any>("/api/messages", {
      method: "POST",
      body: { recipientId: selected.id, content: text },
    });
    setMessages((current) => [...current, message]);
    setText("");
  }
  return (
    <div className="messenger-center">
      <button
        className="notification-trigger"
        title="Mensagens internas"
        onClick={() => {
          setOpen((value) => !value);
          loadUsers();
        }}
      >
        <MessageCircle />
        {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <section className="messenger-panel">
          <header>
            <div>
              <b>Mensagens</b>
              <small>Converse com sua equipe</small>
            </div>
            <button onClick={() => setOpen(false)}>
              <X />
            </button>
          </header>
          <div className="messenger-layout">
            <aside>
              {users.map((userItem) => (
                <button
                  className={selected?.id === userItem.id ? "active" : ""}
                  onClick={() => openThread(userItem)}
                  key={userItem.id}
                >
                  <i>
                    {String(userItem.nome || userItem.username)
                      .slice(0, 2)
                      .toUpperCase()}
                  </i>
                  <span>
                    <b>{userItem.nome || userItem.username}</b>
                    <small>{userItem.role}</small>
                  </span>
                  {userItem.unread > 0 && <em>{userItem.unread}</em>}
                </button>
              ))}
            </aside>
            <div className="messenger-thread">
              {selected ? (
                <>
                  <div className="thread-title">
                    <b>{selected.nome || selected.username}</b>
                    <small>Conversa privada</small>
                  </div>
                  <div className="thread-messages">
                    {messages.map((message) => (
                      <p
                        className={
                          message.recipient_id === selected.id ? "mine" : ""
                        }
                        key={message.id}
                      >
                        {message.content}
                        <small>
                          {new Date(message.created_at).toLocaleString("pt-BR")}
                        </small>
                      </p>
                    ))}
                  </div>
                  <form onSubmit={sendMessage}>
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Escreva uma mensagem..."
                    />
                    <button className="primary">
                      <Send />
                    </button>
                  </form>
                </>
              ) : (
                <Empty />
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Admin({
  kind,
  toast,
}: {
  kind: "companies" | "users";
  toast: (s: string, e?: boolean) => void;
}) {
  const [items, setItems] = useState<any[]>([]),
    [companyOptions, setCompanyOptions] = useState<any[]>([]),
    [companyForm, setCompanyForm] = useState<any>(null),
    [moduleCompany, setModuleCompany] = useState<any>(null),
    [moduleData, setModuleData] = useState<any>(null),
    [moduleTab, setModuleTab] = useState("cnd"),
    [expandedCompanies,setExpandedCompanies]=useState<Record<number,boolean>>({}),
    [replicateTargets,setReplicateTargets]=useState<number[]>([]),
    [userForm, setUserForm] = useState<any>(null),
    [temporaryPassword, setTemporaryPassword] = useState("");
  const load = useCallback(() => {
    api<any>(kind === "companies" ? "/api/empresas" : "/api/users")
      .then((r) => setItems(Array.isArray(r) ? r : r.empresas || r.users || []))
      .catch((e) => toast(e.message, true));
  }, [kind, toast]);
  useEffect(() => {
    load();
    if(kind!=="users")return;
    const timer=window.setInterval(load,15000);
    return()=>window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (kind === "users")
      api<any>("/api/empresas")
        .then((response) =>
          setCompanyOptions(
            Array.isArray(response) ? response : response.empresas || [],
          ),
        )
        .catch(() => {});
  }, [kind]);
  async function toggleCompany(company: any) {
    try {
      await api(`/api/empresas/${company.id}`, {
        method: "PUT",
        body: { ativo: !company.ativo },
      });
      toast(company.ativo ? "Empresa desativada" : "Empresa reativada");
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function activateCompany(company: any) {
    try {
      await api(`/api/empresas/${company.id}/ativar`, { method: "POST" });
      toast(`Empresa ativa: ${company.nome}`);
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast((error as Error).message, true);
    }
  }
  async function openModules(company:any){
    try{
      const data=await api<any>(`/api/empresas/${company.id}/modulos`);
      setModuleCompany(company); setModuleData(data); setModuleTab("cnd");
    }catch(error){toast((error as Error).message,true)}
  }
  async function saveModule(){
    try{
      await api(`/api/empresas/${moduleCompany.id}/modulos`,{method:"PUT",body:{
        modulo:moduleTab,configuracao:moduleData.modulos[moduleTab],
        ativo:moduleData.modulos[moduleTab].ativo!==false,
      }});
      toast(`Configuração de ${moduleTab.toUpperCase()} salva para ${moduleCompany.nome}`);
    }catch(error){toast((error as Error).message,true)}
  }
  async function replicateModule(){
    if(!replicateTargets.length)return toast("Selecione ao menos uma empresa ou filial",true);
    try{
      await api(`/api/empresas/${moduleCompany.id}/modulos`,{method:"POST",body:{
        modulo:moduleTab,destinos:replicateTargets,
      }});
      toast(`Configuração replicada para ${replicateTargets.length} unidade(s)`);
      setReplicateTargets([]);
    }catch(error){toast((error as Error).message,true)}
  }
  async function deleteCompany(company:any){
    if(!confirm(`Excluir definitivamente ${company.nome}?`))return;
    try{await api(`/api/empresas/${company.id}`,{method:"DELETE"});toast("Unidade excluída");load()}
    catch(error){toast((error as Error).message,true)}
  }
  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(companyForm.id?`/api/empresas/${companyForm.id}`:"/api/empresas", {
        method: companyForm.id?"PUT":"POST",
        body: companyForm,
      });
      setCompanyForm(null);
      toast(companyForm.id?"Cadastro atualizado":"Empresa cadastrada");
      load();
    } catch (error) {
      toast((error as Error).message, true);
    }
  }
  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      const editing = Boolean(userForm.id);
      const response = await api<any>(
        editing ? `/api/users/${userForm.id}` : "/api/users",
        {
          method: editing ? "PUT" : "POST",
          body: userForm,
        },
      );
      setTemporaryPassword(response.senhaTemporaria || "");
      if (editing) setUserForm(null);
      toast(editing ? "Usuário atualizado" : "Usuário criado");
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function toggleUser(userItem: any) {
    try {
      await api(`/api/users/${userItem.id}`, {
        method: "PUT",
        body: { ativo: !(userItem.ativo === 1 || userItem.ativo === true) },
      });
      toast(userItem.ativo ? "Usuário desativado" : "Usuário reativado");
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function resetUserPassword(userItem: any) {
    try {
      const response = await api<any>(
        `/api/users/${userItem.id}/reset-password`,
        { method: "POST" },
      );
      setTemporaryPassword(response.senhaTemporaria);
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  return (
    <>
      <Head
        tag="ADMINISTRAÇÃO"
        title={kind === "companies" ? "Empresas" : "Usuários"}
        text={
          kind === "companies"
            ? "Gerencie os ambientes empresariais da plataforma."
            : "Controle identidades, acessos e segurança da sua equipe."
        }
        action={
          kind === "users" ? (
            <button
              className="primary"
              onClick={() =>
                setUserForm({
                  username: "",
                  nome: "",
                  email: "",
                  role: "operador",
                  ativo: true,
                  empresaId: "",
                  permissoes: {
                    documentos_visualizar:true,documentos_incluir:true,documentos_excluir:false,
                    cnd_editar:true,sefaz_consultar:true,relatorios_gerar:true,
                  },
                })
              }
            >
              + Adicionar usuário
            </button>
          ) : (
            <button
              className="primary"
              onClick={() =>
                setCompanyForm({
                  cnpj: "",
                  nome: "",
                  nome_fantasia: "",
                  ie: "",
                  regime_tributario: "simples",
                  ambiente: "producao",
                })
              }
            >
              + Cadastrar empresa
            </button>
          )
        }
      />
      {kind === "users" && (
        <div className="admin-stats">
          <article>
            <Users />
            <div>
              <small>Usuários cadastrados</small>
              <b>{items.length}</b>
            </div>
          </article>
          <article>
            <ShieldCheck />
            <div>
              <small>Acessos ativos</small>
              <b>{items.filter((item) => Boolean(item.ativo)).length}</b>
            </div>
          </article>
          <article>
            <Activity />
            <div>
              <small>Administradores</small>
              <b>{items.filter((item) => item.role === "admin").length}</b>
            </div>
          </article>
        </div>
      )}
      <Panel>
        {items.length && kind === "companies" ? (
          <div className="company-grid">
            {items.filter((item)=>!item.empresa_matriz_id).map((company, index) => {
              const inactive = company.ativo === false || company.ativo === 0;
              const branches=items.filter((item)=>Number(item.empresa_matriz_id)===Number(company.id));
              return (
                <article
                  className={`company-card ${inactive ? "inactive" : ""}`}
                  key={company.id || index}
                >
                  <header>
                    <i>
                      <Building2 />
                    </i>
                    <span className={`status ${inactive ? "inactive" : ""}`}>
                      {inactive ? "Inativa" : "Ativa"}
                    </span>
                  </header>
                  <div>
                    <small>EMPRESA</small>
                    <h3>{company.nome}</h3>
                    <p>{company.nome_fantasia || "Sem nome fantasia"}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>CNPJ</dt>
                      <dd>{company.cnpj || "Não informado"}</dd>
                    </div>
                    <div>
                      <dt>Ambiente</dt>
                      <dd>
                        {company.ambiente === "producao"
                          ? "Produção"
                          : company.ambiente || "Produção"}
                      </dd>
                    </div>
                    <div>
                      <dt>Regime</dt>
                      <dd>{company.regime_tributario || "Não informado"}</dd>
                    </div>
                  </dl>
                  <footer>
                    <button
                      className="primary"
                      disabled={inactive}
                      onClick={() => activateCompany(company)}
                    >
                      {inactive ? "Empresa desativada" : "Acessar empresa"}
                    </button>
                    <button
                      className={inactive ? "primary" : "secondary"}
                      onClick={() => toggleCompany(company)}
                    >
                      {inactive ? "Reativar empresa" : "Desativar empresa"}
                    </button>
                    <button className="secondary" onClick={()=>openModules(company)}>
                      <Save /> Configurar módulos
                    </button>
                    <button className="secondary" onClick={()=>setCompanyForm({...company})}>Editar</button>
                    <button className="secondary" onClick={()=>setCompanyForm({
                      cnpj:"",nome:"",nome_fantasia:"",ie:"",im:"",regime_tributario:company.regime_tributario||"simples",
                      ambiente:company.ambiente||"producao",empresa_matriz_id:company.id,
                    })}>+ Cadastrar filial</button>
                    {branches.length>0&&<button className="secondary" onClick={()=>setExpandedCompanies({
                      ...expandedCompanies,[company.id]:!expandedCompanies[company.id],
                    })}>{expandedCompanies[company.id]?"Recolher filiais":`Expandir filiais (${branches.length})`}</button>}
                  </footer>
                  {branches.length>0&&expandedCompanies[company.id]&&<section className="company-branches">
                    <header><b>Filiais</b><span>{branches.length} unidade(s)</span></header>
                    {branches.map(branch=>{
                      const branchInactive=branch.ativo===false||branch.ativo===0;
                      return <div className={branchInactive?"inactive":""} key={branch.id}>
                        <i><Building2/></i>
                        <span><b>{branch.nome}</b><small>CNPJ: {branch.cnpj} · IE: {branch.ie||"Não possui"} · IM: {branch.im||"Não informada"}</small></span>
                        <button className="secondary" onClick={()=>openModules(branch)}>Configurar</button>
                        <button className="secondary" onClick={()=>setCompanyForm({...branch})}>Editar</button>
                        <button className="secondary" onClick={()=>toggleCompany(branch)}>{branchInactive?"Reativar":"Inativar"}</button>
                        <button className="secondary danger" onClick={()=>deleteCompany(branch)}>Excluir</button>
                      </div>;
                    })}
                  </section>}
                </article>
              );
            })}
          </div>
        ) : items.length ? (
          <div className="user-grid">
            {items.map((userItem, index) => {
              const inactive = userItem.ativo === false || userItem.ativo === 0;
              const roleLabel =
                userItem.role === "admin"
                  ? "Administrador"
                  : userItem.role === "visualizador"
                    ? "Visualizador"
                    : "Operador";
              return (
                <article
                  className={`user-card ${inactive ? "inactive" : ""}`}
                  key={userItem.id || index}
                >
                  <header>
                    <i>
                      {String(userItem.nome || userItem.username)
                        .slice(0, 2)
                        .toUpperCase()}
                    </i>
                    <span className={`status ${inactive ? "inactive" : ""}`}>
                      {inactive ? "Inativo" : userItem.online ? "Online" : "Offline"}
                    </span>
                  </header>
                  <div className="user-identity">
                    <small>{roleLabel.toUpperCase()}</small>
                    <h3>{userItem.nome || userItem.username}</h3>
                    <p>@{userItem.username}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>E-mail</dt>
                      <dd>{userItem.email || "Não informado"}</dd>
                    </div>
                    <div>
                      <dt>Último acesso</dt>
                      <dd>
                        {userItem.ultimo_login
                          ? new Date(userItem.ultimo_login).toLocaleString("pt-BR")
                          : "Primeiro acesso"}
                      </dd>
                    </div>
                  </dl>
                  <footer className="user-actions">
                    <button
                      className="secondary"
                      onClick={() =>
                        setUserForm({
                          ...userItem,
                          ativo: Boolean(userItem.ativo),
                          empresaId:userItem.empresa_id||"",
                          permissoes:userItem.permissoes||{
                            documentos_visualizar:true,documentos_incluir:true,documentos_excluir:false,
                            cnd_editar:true,sefaz_consultar:true,relatorios_gerar:true,
                          },
                        })
                      }
                    >
                      Editar
                    </button>
                    <button
                      className="secondary"
                      onClick={() => resetUserPassword(userItem)}
                    >
                      Nova senha
                    </button>
                    <button
                      className="secondary"
                      onClick={() => toggleUser(userItem)}
                    >
                      {inactive ? "Reativar" : "Desativar"}
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
      {moduleCompany&&moduleData&&<div className="modal-backdrop">
        <section className="feedback-modal module-modal">
          <header><div><span className="eyebrow">{moduleCompany.empresa_matriz_id?"CONFIGURAÇÃO DA FILIAL":"CONFIGURAÇÃO DA MATRIZ"}</span>
            <h2>{moduleCompany.nome}</h2><p>CNPJ {moduleCompany.cnpj}</p></div>
            <button className="square" onClick={()=>setModuleCompany(null)}><X/></button>
          </header>
          <nav className="module-tabs">
            {[["cnd","Certidões"],["sefaz","SEFAZ"],["documentos","Documentos"],["alertas","Alertas"]].map(([id,label])=>
              <button className={moduleTab===id?"active":""} onClick={()=>setModuleTab(id)} key={id}>{label}</button>)}
          </nav>
          <div className="module-config">
            {moduleTab==="cnd"&&<>
              <h3>Certidões e regularidade fiscal</h3>
              <label>Programação dos avisos<select value={moduleData.modulos.cnd.alerta_modo||"dias"}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,cnd:{...moduleData.modulos.cnd,alerta_modo:e.target.value}}})}>
                <option value="dias">Dias antes do vencimento</option><option value="semanal">Semanal, em dia fixo</option>
                <option value="mensal">Mensal, em dia fixo</option></select></label>
              <label>Prazo para alerta de vencimento<input type="number" min="1" max="365"
                value={moduleData.modulos.cnd.prazo_alerta}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,cnd:{...moduleData.modulos.cnd,prazo_alerta:Number(e.target.value)}}})}/></label>
              {moduleData.modulos.cnd.alerta_modo==="semanal"&&<label>Dia semanal<select
                value={moduleData.modulos.cnd.alerta_dia_semana??1}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,cnd:{...moduleData.modulos.cnd,alerta_dia_semana:Number(e.target.value)}}})}>
                {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"].map((x,i)=><option value={i} key={x}>{x}</option>)}
              </select></label>}
              {moduleData.modulos.cnd.alerta_modo==="mensal"&&<label>Dia mensal<input type="number" min="1" max="28"
                value={moduleData.modulos.cnd.alerta_dia_mes??1}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,cnd:{...moduleData.modulos.cnd,alerta_dia_mes:Number(e.target.value)}}})}/></label>}
              {[["alerta_vencimento","Alertar vencimento próximo"],["alerta_vencidas","Alertar certidões vencidas"],["alerta_positivas","Alertar certidões positivas"]].map(([key,label])=>
                <label className="check" key={key}><input type="checkbox" checked={Boolean(moduleData.modulos.cnd[key])}
                  onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,cnd:{...moduleData.modulos.cnd,[key]:e.target.checked}}})}/>{label}</label>)}
              <label>Remetente dos alertas<input type="email" value={moduleData.modulos.cnd.remetente||""}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,cnd:{...moduleData.modulos.cnd,remetente:e.target.value}}})}/></label>
              <label>Domínio autenticado do remetente<input value={moduleData.modulos.cnd.dominio_remetente||""}
                placeholder="empresa.com.br" onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,cnd:{
                  ...moduleData.modulos.cnd,dominio_remetente:e.target.value}}})}/></label>
            </>}
            {moduleTab==="sefaz"&&<>
              <h3>Consulta SEFAZ</h3>
              <label className="check"><input type="checkbox" checked={Boolean(moduleData.modulos.sefaz.consulta_automatica)}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,sefaz:{...moduleData.modulos.sefaz,consulta_automatica:e.target.checked}}})}/>Consulta automática habilitada</label>
              <label className="check"><input type="checkbox" checked={Boolean(moduleData.modulos.sefaz.importar_automaticamente)}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,sefaz:{...moduleData.modulos.sefaz,importar_automaticamente:e.target.checked}}})}/>Importar documentos automaticamente</label>
              <label>UF autora<input maxLength={2} value={moduleData.modulos.sefaz.uf}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,sefaz:{...moduleData.modulos.sefaz,uf:e.target.value.toUpperCase()}}})}/></label>
              <div className="secure-note"><ShieldCheck/> Somente consulta. Emissão, cancelamento e eventos permanecem bloqueados.</div>
            </>}
            {moduleTab==="documentos"&&<>
              <h3>Armazenamento de documentos</h3>
              {[["deduplicar","Impedir documentos duplicados"],["importar_xml","Importação de XML habilitada"],["guardar_xml","Guardar XML original"]].map(([key,label])=>
                <label className="check" key={key}><input type="checkbox" checked={Boolean(moduleData.modulos.documentos[key])}
                  onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,documentos:{...moduleData.modulos.documentos,[key]:e.target.checked}}})}/>{label}</label>)}
            </>}
            {moduleTab==="alertas"&&<>
              <h3>Comunicações automáticas</h3>
              <label className="check"><input type="checkbox" checked={Boolean(moduleData.modulos.alertas.email_ativo)}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,alertas:{...moduleData.modulos.alertas,email_ativo:e.target.checked}}})}/>Disparo de e-mails ativo</label>
              <label>Frequência<select value={moduleData.modulos.alertas.frequencia}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,alertas:{...moduleData.modulos.alertas,frequencia:e.target.value}}})}>
                <option value="diaria">Diária</option><option value="semanal">Semanal</option></select></label>
              <label>Horário<input type="time" value={moduleData.modulos.alertas.hora}
                onChange={e=>setModuleData({...moduleData,modulos:{...moduleData.modulos,alertas:{...moduleData.modulos.alertas,hora:e.target.value}}})}/></label>
              <div className="module-email-list"><b>Destinatários vinculados</b>
                {moduleData.emails.length?moduleData.emails.map((item:any)=><span key={item.id}>{item.email}</span>):<small>Nenhum e-mail cadastrado para esta unidade.</small>}</div>
            </>}
          </div>
          <section className="module-replication">
            <header><b>Replicar configuração deste módulo</b><small>Marque as unidades que receberão uma cópia.</small></header>
            <div>{items.filter(item=>item.id!==moduleCompany.id).map(item=><label key={item.id}>
              <input type="checkbox" checked={replicateTargets.includes(Number(item.id))}
                onChange={e=>setReplicateTargets(e.target.checked?[...replicateTargets,Number(item.id)]:
                  replicateTargets.filter(id=>id!==Number(item.id)))}/>
              {item.nome} {item.empresa_matriz_id?"· Filial":"· Matriz"}
            </label>)}</div>
            <button className="secondary" onClick={replicateModule}>Replicar para selecionadas</button>
          </section>
          <footer><button className="secondary" onClick={()=>setModuleCompany(null)}>Fechar</button>
            <button className="primary" onClick={saveModule}><Save/> Salvar este módulo</button></footer>
        </section>
      </div>}
      {companyForm && kind === "companies" && (
        <div className="modal-backdrop">
          <form className="feedback-modal company-modal" onSubmit={saveCompany}>
            <header>
              <div>
                <span className="eyebrow">NOVO AMBIENTE</span>
                <h2>{companyForm.id?"Editar cadastro":companyForm.empresa_matriz_id?"Cadastrar filial":"Cadastrar empresa"}</h2>
              </div>
              <button
                type="button"
                className="square"
                onClick={() => setCompanyForm(null)}
              >
                <X />
              </button>
            </header>
            <div className="company-form-intro">
              <Building2 />
              <div>
                <b>Novo ambiente empresarial</b>
                <small>
                  Os usuários e documentos ficarão isolados nesta empresa.
                </small>
              </div>
            </div>
            <div className="fields">
              <label>
                CNPJ
                <input
                  required
                  inputMode="numeric"
                  value={companyForm.cnpj}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      cnpj: e.target.value.replace(/\D/g, "").slice(0, 14),
                    })
                  }
                  placeholder="00000000000000"
                />
              </label>
              <label>
                Razão social
                <input
                  required
                  value={companyForm.nome}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, nome: e.target.value })
                  }
                />
              </label>
              <label>
                Nome fantasia
                <input
                  value={companyForm.nome_fantasia}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      nome_fantasia: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Inscrição estadual
                <input
                  value={companyForm.ie}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, ie: e.target.value })
                  }
                />
              </label>
              <label>
                Inscrição municipal
                <input value={companyForm.im||""}
                  onChange={e=>setCompanyForm({...companyForm,im:e.target.value})}/>
              </label>
              <label>
                Regime tributário
                <select
                  value={companyForm.regime_tributario}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      regime_tributario: e.target.value,
                    })
                  }
                >
                  <option value="simples">Simples Nacional</option>
                  <option value="presumido">Lucro Presumido</option>
                  <option value="real">Lucro Real</option>
                  <option value="mei">MEI</option>
                </select>
              </label>
              <label>
                Ambiente fiscal
                <select
                  value={companyForm.ambiente}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      ambiente: e.target.value,
                    })
                  }
                >
                  <option value="producao">Produção</option>
                  <option value="homologacao">Homologação</option>
                </select>
              </label>
            </div>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setCompanyForm(null)}
              >
                Cancelar
              </button>
              <button className="primary">
                <Save /> {companyForm.id?"Salvar alterações":companyForm.empresa_matriz_id?"Cadastrar filial":"Cadastrar empresa"}
              </button>
            </footer>
          </form>
        </div>
      )}
      {userForm && kind === "users" && (
        <div className="modal-backdrop">
          <form className="feedback-modal user-modal" onSubmit={saveUser}>
            <header>
              <div>
                <span className="eyebrow">ADMINISTRAÇÃO</span>
                <h2>{userForm.id ? "Editar usuário" : "Novo usuário"}</h2>
              </div>
              <button
                type="button"
                className="square"
                onClick={() => setUserForm(null)}
              >
                <X />
              </button>
            </header>
            <div className="fields">
              <label>
                Nome
                <input
                  required
                  value={userForm.nome || ""}
                  onChange={(e) =>
                    setUserForm({ ...userForm, nome: e.target.value })
                  }
                />
              </label>
              <label>
                Usuário
                <input
                  required
                  disabled={Boolean(userForm.id)}
                  value={userForm.username || ""}
                  onChange={(e) =>
                    setUserForm({ ...userForm, username: e.target.value })
                  }
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={userForm.email || ""}
                  onChange={(e) =>
                    setUserForm({ ...userForm, email: e.target.value })
                  }
                />
              </label>
              <label>
                Perfil de acesso
                <select
                  value={userForm.role}
                  onChange={(e) =>
                    setUserForm({ ...userForm, role: e.target.value })
                  }
                >
                  <option value="admin">Administrador</option>
                  <option value="operador">Operador</option>
                  <option value="visualizador">Visualizador</option>
                </select>
              </label>
              {!userForm.id && (
                <label>
                  Empresa
                  <select
                    required
                    value={userForm.empresaId || ""}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        empresaId: e.target.value,
                      })
                    }
                  >
                    <option value="">Selecione a empresa</option>
                    {companyOptions
                      .filter((company) => company.ativo !== 0)
                      .map((company) => (
                        <option value={company.id} key={company.id}>
                          {company.nome}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
            <section className="user-permissions">
              <header><b>Permissões nesta empresa</b><small>O administrador pode limitar cada ação individualmente.</small></header>
              {[
                ["documentos_visualizar","Visualizar documentos"],
                ["documentos_incluir","Incluir e importar documentos"],
                ["documentos_excluir","Excluir documentos"],
                ["cnd_editar","Cadastrar e editar certidões"],
                ["sefaz_consultar","Consultar e importar pela SEFAZ"],
                ["relatorios_gerar","Gerar relatórios"],
              ].map(([key,label])=><label className="check" key={key}>
                <input type="checkbox" checked={Boolean(userForm.permissoes?.[key])}
                  onChange={e=>setUserForm({...userForm,permissoes:{...userForm.permissoes,[key]:e.target.checked}})}/>
                {label}</label>)}
            </section>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setUserForm(null)}
              >
                Cancelar
              </button>
              <button className="primary">
                <Save /> Salvar usuário
              </button>
            </footer>
          </form>
        </div>
      )}
      {temporaryPassword && (
        <div className="modal-backdrop">
          <section className="feedback-modal password-modal">
            <header>
              <div>
                <span className="eyebrow">ACESSO TEMPORÁRIO</span>
                <h2>Senha gerada</h2>
              </div>
            </header>
            <p>Copie e entregue esta senha ao usuário por um canal seguro.</p>
            <code>{temporaryPassword}</code>
            <footer>
              <button
                className="primary"
                onClick={() => setTemporaryPassword("")}
              >
                Entendido
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [page, setPage] = useState<Page>("dashboard"),
    [current, setCurrent] = useState<Company | null>(null),
    [mobile, setMobileState] = useState(false),
    [dark, setDark] = useState(()=>localStorage.getItem("cordeiro.theme")==="dark"),
    [note, setNote] = useState<{ s: string; e: boolean } | null>(null),
    [notifications, setNotifications] =
      useState<AppNotification[]>(storedNotifications);
  const setMobile = (value: boolean) =>
    setMobileState((current) => (value ? !current : false));
  const toast = useCallback((s: string, e = false) => {
    setNote({ s, e });
    setNotifications((current) => {
      const next: AppNotification[] = [
        {
          id: Date.now(),
          title: e ? "Ação pendente" : "Operação concluída",
          text: s,
          createdAt: new Date().toISOString(),
          kind: (e ? "error" : "success") as AppNotification["kind"],
          read: false,
        },
        ...current,
      ].slice(0, 50);
      localStorage.setItem("cordeiro.notifications", JSON.stringify(next));
      return next;
    });
    setTimeout(() => setNote(null), 3500);
  }, []);
  const markAllNotificationsRead = () =>
    setNotifications((current) => {
      const next = current.map((item) => ({ ...item, read: true }));
      localStorage.setItem("cordeiro.notifications", JSON.stringify(next));
      return next;
    });
  const enter = useCallback((u: User) => {
    setUser(u);
    const c = u.empresa_ativa || u.memberships?.[0] || null;
    setCurrent(c);
    setCompany(c);
  }, []);
  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((r) => enter(r.user))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [enter]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("cordeiro.theme",dark?"dark":"light");
  }, [dark]);
  const admin = !!(user?.is_super_admin || user?.role === "admin");
  if (checking)
    return (
      <div className="loading">
        <Brand />
        <RefreshCw className="spin" />
      </div>
    );
  if (!user) return <Login done={enter} />;
  const go = (p: Page) => {
    setPage(p);
    setMobile(false);
  };
  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setCompany(null);
  }
  return (
    <div className="shell">
      <aside className={mobile ? "open" : ""}>
        <header>
          <Brand />
          <button onClick={() => setMobile(false)}>
            <X />
          </button>
        </header>
        <nav>
          {groups.map(
            ([group, items]) =>
              (group !== "Administração" || admin) && (
                <section key={group}>
                  <small>{group}</small>
                  {items.map(([p, label, Icon]: any) => (
                    <button
                      className={page === p ? "active" : ""}
                      key={p}
                      onClick={() => go(p)}
                    >
                      <Icon />
                      {label}
                    </button>
                  ))}
                </section>
              ),
          )}
        </nav>
        <button
          className="support-center"
          onClick={() => go("feedback")}
          title="Abrir feedback e suporte"
        >
          <Sparkles />
          <b>Central de suporte</b>
          <small>Feedback, dúvidas e sugestões</small>
        </button>
      </aside>
      {mobile && <div className="overlay" onClick={() => setMobile(false)} />}
      <div className="workspace">
        <header className="top">
          <button className="menu" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div className="top-actions">
            <button onClick={() => setDark((x) => !x)}>
              {dark ? <Sun /> : <Moon />}
            </button>
            <Messenger />
            <NotificationCenter
              items={notifications}
              markAllRead={markAllNotificationsRead}
            />
            <button
              className="profile-trigger"
              onClick={() => go("profile")}
              title="Abrir meu perfil"
            >
              <span className="avatar">
                {user.avatar_url ? (
                  <img src={user.avatar_url} />
                ) : (
                  <img src="/assets/cordeiro-mascote-v2.png" />
                )}
              </span>
              <span className="profile-trigger-text">
                <b>{user.nome || user.username}</b>
                <small>
                  {user.cargo || admin ? "Administrador" : "Usuário"}
                </small>
              </span>
            </button>
            <button onClick={logout}>
              <LogOut />
            </button>
          </div>
        </header>
        <main>
          {page === "dashboard" && <Dashboard />}
          {page === "documents" && <Documents toast={toast} />}{" "}
          {page === "import" && <Importer toast={toast} done={()=>go("documents")} />}{" "}
          {page === "reports" && <Reports toast={toast} />}{" "}
          {page === "certificates" && <Certificates toast={toast} />}{" "}
          {page === "integrations" && <Integrations toast={toast} />}{" "}
          {page === "feedback" && <FeedbackPage toast={toast} />}{" "}
          {page === "profile" && (
            <Profile user={user} onUpdate={setUser} toast={toast} />
          )}{" "}
          {page === "companies" && <Admin kind="companies" toast={toast} />}{" "}
          {page === "users" && <Admin kind="users" toast={toast} />}
        </main>
      </div>
      <Assistant />
      {note && (
        <div className={`toast ${note.e ? "bad" : ""}`}>
          {note.e ? <X /> : <ShieldCheck />}
          {note.s}
        </div>
      )}
    </div>
  );
}
