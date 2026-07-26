import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Bug,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CheckCheck,
  CloudDownload,
  FileDown,
  FileText,
  Files,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Laptop,
  Lightbulb,
  Network,
  Link,
  Linkedin,
  LogOut,
  Menu,
  MessageCircle,
  Megaphone,
  Moon,
  PackageSearch,
  Paperclip,
  Radar,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
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
  | "issued"
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
  kind: "online" | "news";
};
function storedNotifications(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem("cordeiro.notifications") || "[]")
      .filter((item:AppNotification)=>item.kind==="online"||item.kind==="news");
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
const sourceInfo=(value?:string)=>{
  const key=String(value||"system").toLowerCase();
  if(key==="upload")return {label:"Importação manual",tone:"manual"};
  if(key==="paste")return {label:"Inclusão manual",tone:"manual"};
  if(key.includes("mtls-auto"))return {label:"SEFAZ automática",tone:"automatic"};
  if(key.includes("sefaz"))return {label:"Consulta por chave",tone:"sefaz"};
  if(key.includes("meudanfe"))return {label:"MeuDANFE",tone:"external"};
  return {label:"Sistema",tone:"system"};
};

function Brand() {
  return (
    <div className="brand">
      <span>
        <img
          src="/assets/haixel-logo.png"
          alt="Haixel"
        />
      </span>
      <b>
        Haixel<small>FISCAL TECH</small>
      </b>
    </div>
  );
}
function Login({ done }: { done: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "verify">("login"),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [devCode, setDevCode] = useState(""),
    [remember,setRemember]=useState(()=>localStorage.getItem("cordeiro.remember")!=="0"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        await api("/api/auth/login", {
          method: "POST",
          body: { username, password,remember },
        });
        localStorage.setItem("cordeiro.remember",remember?"1":"0");
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
                  autoComplete="username"
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
                  autoComplete={mode==="login"?"current-password":"new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </label>
              {mode==="login"&&<label className="remember-login"><input type="checkbox" checked={remember}
                onChange={event=>setRemember(event.target.checked)}/><span><b>Lembrar meu acesso</b>
                  <small>Entrar automaticamente neste dispositivo por até 30 dias.</small></span><em/></label>}
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
      ["documents", "Central fiscal", Files],
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

function DocumentHub({toast,initial="archive"}:{toast:(s:string,e?:boolean)=>void;initial?:"archive"|"dfe"}) {
  const [mode,setMode]=useState<"archive"|"dfe">(initial);
  return <section className="unified-document-hub">
    <nav className="unified-document-nav">
      <button className={mode==="archive"?"active":""} onClick={()=>setMode("archive")}><Files/><span>
        <b>Central de documentos</b><small>Cofre, pesquisa, auditoria e exportação</small></span><ArrowUpRight/></button>
      <button className={mode==="dfe"?"active":""} onClick={()=>setMode("dfe")}><Radar/><span>
        <b>Documentos emitidos e recebidos</b><small>Monitor DF-e, SEFAZ e importação</small></span><ArrowUpRight/></button>
    </nav>
    {mode==="archive"?<Documents toast={toast}/>:<IssuedDocuments toast={toast}/>}
  </section>;
}
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
  return (
    <>
      <Head
        tag="RADAR CONTÁBIL & FISCAL"
        title="Cockpit de conhecimento"
        text="Notícias, mudanças regulatórias e referências para a rotina fiscal e contábil."
      />
      <section className="knowledge-hero"><div><Radar/><span><small>ACOMPANHAMENTO CONTÍNUO</small>
        <h2>O que muda no fiscal, explicado para a operação.</h2><p>Reforma tributária, obrigações, documentos eletrônicos, certidões e prazos.</p></span></div>
        <div className="knowledge-tags"><span>Reforma Tributária</span><span>NF-e & CT-e</span><span>SPED</span><span>Contabilidade</span></div></section>
      <FiscalNews/>
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
  const lead=items[0], latest=items.slice(1,5);
  const tips=[
    ["Conferência inteligente","Valide chave, CNPJ, valores e protocolo antes de concluir a escrituração."],
    ["Rotina sem duplicidade","Centralize XMLs e acompanhe a origem de cada importação no histórico."],
    ["Prazos sob controle","Revise certidões e obrigações por empresa antes do fechamento mensal."],
  ];
  const courses=[
    {title:"Formação Avançada em Conscientização Tributária",meta:"Receita Federal · 20 horas",url:"https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/cidadania-fiscal/cidadania-fiscal-no-curriculo-escolar/formacao-docente-e-capacitacao-em-cidadania-fiscal/formacao-avancada-em-conscientizacao-tributaria"},
    {title:"Educação Fiscal: Estado, Tributos e Sociedade",meta:"Receita Federal · Curso em vídeo",url:"https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/cidadania-fiscal/cidadania-fiscal-no-curriculo-escolar/videos/professores/educacao-fiscal"},
    {title:"Capacitação técnica para aplicação pedagógica",meta:"Receita Federal · Material oficial",url:"https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/cidadania-fiscal/cidadania-fiscal-no-curriculo-escolar/formacao-docente/capacitacao-tecnica-1"},
  ];
  return <section className="fiscal-journal">
    <header className="journal-heading"><div><span className="eyebrow">EDIÇÃO DIGITAL</span><h2>Notícias do mundo fiscal</h2>
      <p>Informação prática para decisões fiscais mais seguras.</p></div><span className="journal-live"><i/> RADAR ATIVO</span></header>
    {busy?<div className="journal-loading"><RefreshCw className="spin"/> Atualizando o radar fiscal...</div>:
      <div className="journal-layout">
        {lead&&<a className="journal-lead" href={lead.url} target="_blank" rel="noreferrer">
          <div className="lead-art"><Radar/><span>DESTAQUE DA EDIÇÃO</span></div>
          <div className="lead-copy"><span>{lead.tagLabel||lead.fonte||"ATUALIZAÇÃO"}</span><h3>{lead.titulo}</h3>
            <p>{lead.resumo}</p><footer><b>{lead.fonte||"Radar Fiscal"}</b><small>Ler conteúdo <ArrowUpRight/></small></footer></div>
        </a>}
        <aside className="journal-latest"><header><span>AGORA</span><h3>Últimas atualizações</h3></header>
          {latest.map((n,i)=><a href={n.url} target="_blank" rel="noreferrer" key={n.id||n.url||i}>
            <b>{String(i+1).padStart(2,"0")}</b><span><small>{n.tagLabel||n.fonte||"FISCAL"}</small><strong>{n.titulo}</strong></span><ArrowUpRight/>
          </a>)}</aside>
      </div>}
    <div className="editorial-block"><div className="editorial-title"><Lightbulb/><span><small>GUIA RÁPIDO</small><h3>Dicas para a rotina fiscal</h3></span></div>
      <div className="tip-grid">{tips.map(([title,text],i)=><article key={title}><b>0{i+1}</b><h4>{title}</h4><p>{text}</p></article>)}</div></div>
    <div className="editorial-block courses"><div className="editorial-title"><GraduationCap/><span><small>FORMAÇÃO</small><h3>Cursos e capacitações</h3></span></div>
      <div className="course-grid">{courses.map(course=><a href={course.url} target="_blank" rel="noreferrer" key={course.title}>
        <i><BookOpen/></i><span><small>{course.meta}</small><strong>{course.title}</strong></span><ArrowUpRight/></a>)}</div></div>
  </section>;
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

function IssuedDocuments({toast}:{toast:(s:string,e?:boolean)=>void}){
  const [data,setData]=useState<any>({items:[],stats:{}}),[kind,setKind]=useState(""),
    [section,setSection]=useState<"monitor"|"import">("monitor"),
    [direction,setDirection]=useState<"outgoing"|"incoming">("outgoing"),
    [query,setQuery]=useState(""),[statusFilter,setStatusFilter]=useState(""),
    [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7)),[busy,setBusy]=useState(true),
    [syncing,setSyncing]=useState(false),issuedSyncRef=useRef(false);
  const issuedParams=new URLSearchParams({month,direction,...(kind?{kind}:{})});
  const load=useCallback((notify=false)=>{setBusy(true);api<any>(`/api/docs/issued?${issuedParams}`)
    .then(result=>{setData(result);if(notify)toast(`${result.items?.length||0} documento(s) emitido(s) atualizado(s)`)})
    .catch(error=>toast(error.message,true)).finally(()=>setBusy(false))},[kind,month,direction,toast]);
  useEffect(()=>{load();const timer=window.setInterval(()=>load(false),30000);return()=>window.clearInterval(timer)},[load]);
  const refreshIssued=async()=>{
    if(issuedSyncRef.current)return;
    issuedSyncRef.current=true;setSyncing(true);
    try{
      const [year,monthNumber]=month.split("-").map(Number);
      const dateFrom=`${month}-01`;
      const dateTo=new Date(Date.UTC(year,monthNumber,0)).toISOString().slice(0,10);
      const sync=await api<any>("/api/sefaz/cert/periodo-auto",{method:"POST",body:{dateFrom,dateTo}});
      await load(false);
      toast(`${sync.documentos?.length||0} registro(s) recebido(s) por NSU; documentos emitidos atualizados`);
    }catch(error){
      const message=(error as Error).message;
      toast(/espera|aguarde|bloque|656/i.test(message)?message:`Não foi possível sincronizar com a SEFAZ: ${message}`,true);
      await load(false);
    }finally{issuedSyncRef.current=false;setSyncing(false)}
  };
  const stats=data.stats||{};
  const filtered=(data.items||[]).filter((item:any)=>{
    const content=[item.kind,item.numero,item.chave,item.remetente_nome,item.remetente_doc,
      item.destinatario_nome,item.destinatario_doc,item.status].join(" ").toLowerCase();
    return (!query||content.includes(query.toLowerCase()))&&
      (!statusFilter||String(item.status||"").toLowerCase()===statusFilter);
  });
  const statusOptions=[...new Set((data.items||[]).map((item:any)=>String(item.status||"").toLowerCase()).filter(Boolean))];
  return <><Head tag="CENTRAL DF-e" title="Documentos fiscais"
    text="Recebimento, custódia e acompanhamento dos documentos emitidos pela empresa e contra o seu CNPJ."
    action={section==="monitor"?<div className="issued-actions"><label>Competência<input type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label>
      <button className="secondary" onClick={()=>download(`/api/relatorio/xlsx?month=${month}`,`documentos-fiscais-${month}.xlsx`)}><FileDown/> Exportar Excel</button>
      <button className="secondary" onClick={()=>download(`/api/relatorio/lote?formato=xml&month=${month}`,`xml-fiscais-${month}.zip`)}><CloudDownload/> Baixar XMLs</button>
      <button className="primary" onClick={refreshIssued} disabled={busy||syncing}>{syncing?<RefreshCw className="spin"/>:<RefreshCw/>} {syncing?"Sincronizando...":"Buscar na SEFAZ"}</button></div>:undefined}/>
    <nav className="dfe-module-nav">
      <button className={section==="monitor"?"active":""} onClick={()=>setSection("monitor")}><Radar/><span><b>Monitor DF-e</b><small>Emitidos e recebidos</small></span></button>
      <button className={section==="import"?"active":""} onClick={()=>setSection("import")}><UploadCloud/><span><b>Importar documentos</b><small>XML de NF-e, CT-e e NFS-e</small></span></button>
    </nav>
    {section==="import"?<Importer toast={toast} embedded done={()=>{setSection("monitor");load(true)}}/>:<>
    <section className="dfe-command-board">
      <div><span className="eyebrow">OPERAÇÃO DOCUMENTAL</span><h2>Visão unificada do ciclo fiscal</h2>
        <p>Capture, confira, organize e exporte documentos sem perder o contexto da empresa ativa.</p></div>
      <div className="dfe-command-metrics">
        <span><small>Em custódia</small><b>{stats.xml||0}</b></span>
        <span><small>Com alerta</small><b>{stats.alertas||0}</b></span>
        <span><small>Movimentação</small><b>{brl(stats.valor||0)}</b></span>
      </div>
    </section>
    <section className="issued-hero dfe-hero"><div><i>{direction==="incoming"?<CloudDownload/>:<Send/>}</i><span>
      <small>{direction==="incoming"?"RECEBIMENTO FISCAL":"EMISSÕES PRÓPRIAS"}</small>
      <h2>{direction==="incoming"?"Documentos emitidos contra a empresa":"Documentos emitidos pela empresa"}</h2>
      <p>Informações centralizadas por CNPJ, com captura segura, consulta e custódia do arquivo fiscal.</p></span></div>
      <div><span><i/> NF-e · Distribuição DF-e</span><span><i/> CT-e · Documentos de transporte</span><span><i/> XML · Integridade e custódia</span></div></section>
    <div className="issued-kpis dfe-kpis">{[["Documentos",stats.total||0,Files],["XML em custódia",stats.xml||0,ShieldCheck],
      ["Alertas fiscais",stats.alertas||0,Bell],["Valor monitorado",brl(stats.valor||0),Gauge]]
      .map(([label,value,Icon]:any)=><article key={label}><i><Icon/></i><span><small>{label}</small><b>{value}</b></span></article>)}</div>
    <section className="dfe-capabilities">
      <article><i><CloudDownload/></i><span><b>Captura centralizada</b><small>Documentos localizados pela distribuição oficial e importações da empresa.</small></span></article>
      <article><i><ShieldCheck/></i><span><b>Validação e custódia</b><small>Identificação imediata da disponibilidade do XML armazenado.</small></span></article>
      <article><i><Bell/></i><span><b>Eventos e situações</b><small>Status fiscal destacado para acelerar conferências e tratar cancelamentos.</small></span></article>
      <article><i><FileDown/></i><span><b>Consulta e exportação</b><small>Planilha gerencial e arquivos XML disponíveis individualmente ou em lote.</small></span></article>
    </section>
    <Panel><div className="issued-direction">
      <button className={direction==="outgoing"?"active":""} onClick={()=>setDirection("outgoing")}><Send/><span><b>Emitidas pela empresa</b><small>CNPJ ativo como emitente/prestador</small></span></button>
      <button className={direction==="incoming"?"active":""} onClick={()=>setDirection("incoming")}><CloudDownload/><span><b>Emitidas contra a empresa</b><small>CNPJ ativo como destinatário/tomador</small></span></button>
    </div><div className="dfe-query-bar"><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)}
      placeholder="Buscar por fornecedor, cliente, CNPJ, número ou chave..."/></label>
      <select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="">Todas as situações</option>
        {statusOptions.map((status:any)=><option value={status} key={status}>{status}</option>)}</select>
    </div><div className="issued-toolbar"><div className="doc-tabs">{[["","Todos"],["NFE","NF-e"],["NFSE","NFS-e"],["CTE","CT-e"]].map(([value,label])=>
      <button className={kind===value?"active":""} onClick={()=>setKind(value)} key={value}>{label}</button>)}</div>
      <small>{filtered.length} de {data.items?.length||0} documentos · atualização automática a cada 30 segundos</small></div>
      <div className="table dfe-table"><table><thead><tr><th>Documento</th><th>{direction==="incoming"?"Emitente / fornecedor":"Destinatário / cliente"}</th><th>Emissão</th><th>Valor</th><th>Situação</th><th>Origem</th><th>Arquivo</th></tr></thead>
        <tbody>{filtered.map((item:any)=><tr key={item.id}><td><b>{item.kind} #{item.numero||"—"}</b><small>{item.chave||"Sem chave"}</small></td>
          <td>{direction==="incoming"?(item.remetente_nome||"Não identificado"):(item.destinatario_nome||"Não identificado")}
            <small>{direction==="incoming"?(item.remetente_doc||""):(item.destinatario_doc||"")}</small></td><td>{date(item.data_emissao)}</td>
          <td><b>{brl(item.valor_total)}</b></td><td><span className="status">{item.status}</span></td>
          <td><span className={`source-badge ${sourceInfo(item.source).tone}`}><i/>{sourceInfo(item.source).label}</span></td>
          <td><button className="square" title={item.has_xml?"Baixar XML":"XML ainda não disponível"} disabled={!item.has_xml}
            onClick={()=>download(`/api/docs/${item.id}/xml`,`${item.chave||item.id}.xml`)}><FileDown/></button></td></tr>)}</tbody></table>
        {!busy&&!filtered.length&&<Empty/>}</div></Panel></>}
  </>;
}

function Documents({ toast }: { toast: (s: string, e?: boolean) => void }) {
  const [items, setItems] = useState<any[]>([]),
    [q, setQ] = useState(""),
    [kindFilter,setKindFilter]=useState(""),
    [selectedIds,setSelectedIds]=useState<number[]>([]),
    [confirmBatchDelete,setConfirmBatchDelete]=useState(false),
    [page,setPage]=useState(1),
    [total,setTotal]=useState(0),
    [pages,setPages]=useState(1),
    [stats,setStats]=useState<any>({}),
    [busy, setBusy] = useState(true),
    [selected, setSelected] = useState<any>(null),
    [pendingDelete,setPendingDelete]=useState<any>(null),
    [showFilters, setShowFilters] = useState(false),
    [filters, setFilters] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    setBusy(true);
    const params = new URLSearchParams({limit:"25",page:String(page),q,...filters,
      kind:kindFilter||filters.tipoDocumento||""});
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
  }, [toast, filters,page,q,kindFilter]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(()=>{api<any>("/api/dashboard/kpis").then(setStats).catch(()=>{})},[]);
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
  async function remove(item: any) {
    try {
      await api(`/api/docs/${item.id}`, { method: "DELETE" });
      setSelected(null);
      setPendingDelete(null);
      toast(`Documento excluído com sucesso · ${item.numero?`nota ${item.numero}`:`chave ${String(item.chave||"").slice(0,8)}…`}`);
      load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function removeBatch(){
    try{
      const result=await api<any>("/api/docs/batch-delete",{method:"POST",body:{ids:selectedIds}});
      setSelectedIds([]);setConfirmBatchDelete(false);toast(`${result.deleted} documento(s) e XML(s) excluído(s)`);load();
    }catch(error){toast((error as Error).message,true)}
  }
  return (
    <>
      <Head
        tag="DOCUMENTOS"
        title="Central de documentos"
        text={`${total} registros encontrados · página ${page} de ${pages}`}
      />
      <section className="document-vault-hero">
        <div><i><Files/></i><span><small>COFRE FISCAL DIGITAL</small><h2>Documentos organizados e prontos para conferência</h2>
          <p>Pesquise, audite, exporte e gerencie XMLs oficiais da empresa ativa em uma única visão.</p></span></div>
        <div><span><ShieldCheck/><b>Custódia protegida</b></span><span><Activity/><b>Rastreabilidade ativa</b></span></div>
      </section>
      <div className="kpis document-kpis">{[
        ["Documentos",stats.total??stats.documentos??total,FileText,"mint"],
        ["Valor movimentado",brl(stats.valor_total??stats.valor),Gauge,"violet"],
        ["Autorizados",stats.autorizados??0,ShieldCheck,"blue"],
        ["Incluídos este mês",stats.mes_atual??stats.no_mes??0,Activity,"amber"],
      ].map(([label,value,Icon,tone]:any)=><article className="kpi" key={label}><i className={tone}><Icon/></i>
        <div><small>{label}</small><strong>{value}</strong><em>Empresa ativa</em></div></article>)}</div>
      <Panel>
        <div className="document-downloads">
          {selectedIds.length>0&&<button className="secondary danger" onClick={()=>setConfirmBatchDelete(true)}>
            <Trash2/> Excluir selecionados ({selectedIds.length})
          </button>}
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
            description="A listagem, os XMLs oficiais e o relatório respeitam estes filtros."
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
          {[["","Todos"],["NFE","NF-e"],["CTE","CT-e"],["NFSE","NFS-e"]].map(([value,label])=>
            <button className={kindFilter===value?"active":""} key={value} onClick={()=>{setKindFilter(value);setPage(1)}}>{label}</button>)}
        </div>
        <div className="table">
          <table>
            <thead>
              <tr>
                <th className="select-cell"><input type="checkbox" aria-label="Selecionar página"
                  checked={rows.length>0&&rows.every(item=>selectedIds.includes(Number(item.id)))}
                  onChange={event=>setSelectedIds(current=>event.target.checked?
                    [...new Set([...current,...rows.map(item=>Number(item.id))])]:
                    current.filter(id=>!rows.some(item=>Number(item.id)===id)))}/></th>
                <th>Documento</th>
                <th>Emitente</th>
                <th>Emissão</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Origem</th>
                <th>Incluído por</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => (
                <tr key={d.id || i}>
                  <td className="select-cell"><input type="checkbox" aria-label={`Selecionar documento ${d.numero||d.id}`}
                    checked={selectedIds.includes(Number(d.id))}
                    onChange={event=>setSelectedIds(current=>event.target.checked?[...current,Number(d.id)]:current.filter(id=>id!==Number(d.id)))}/></td>
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
                  <td>
                    <span className={`source-badge ${sourceInfo(d.source).tone}`}>
                      <i />{sourceInfo(d.source).label}
                    </span>
                    <small>{d.created_at?new Date(d.created_at).toLocaleString("pt-BR"):""}</small>
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
                        onClick={() => setPendingDelete(d)}
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
                onClick={() => setPendingDelete(selected)}
              >
                <X />
                Excluir documento
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
      {pendingDelete&&<div className="modal-backdrop deletion-backdrop" role="dialog" aria-modal="true">
        <section className="deletion-dialog"><i><Trash2/></i><span className="eyebrow">EXCLUIR DOCUMENTO FISCAL</span>
          <h2>Remover documento e XML?</h2>
          <p>{pendingDelete.numero&&<>Nota <b>{pendingDelete.numero}</b><br/></>}Chave <b>{pendingDelete.chave||"não informada"}</b>. Esta ação remove o registro e o XML armazenado.</p>
          <div><button className="secondary" onClick={()=>setPendingDelete(null)}>Manter documento</button>
            <button className="primary danger-action" onClick={()=>remove(pendingDelete)}><Trash2/> Excluir documento</button></div>
        </section>
      </div>}
      {confirmBatchDelete&&<div className="modal-backdrop deletion-backdrop" role="dialog" aria-modal="true">
        <section className="deletion-dialog"><i><Trash2/></i><span className="eyebrow">EXCLUSÃO EM LOTE</span>
          <h2>Excluir {selectedIds.length} documentos?</h2><p>Os registros selecionados e todos os XMLs vinculados serão removidos da empresa ativa.</p>
          <div><button className="secondary" onClick={()=>setConfirmBatchDelete(false)}>Cancelar</button>
            <button className="primary danger-action" onClick={removeBatch}><Trash2/> Excluir selecionados</button></div>
        </section>
      </div>}
    </>
  );
}
function Importer({ toast,done,embedded=false }: { toast: (s: string, e?: boolean) => void; done:()=>void; embedded?:boolean }) {
  const [files, setFiles] = useState<File[]>([]),
    [drag, setDrag] = useState(false),
    [busy, setBusy] = useState(false),
    [progress,setProgress]=useState({current:0,total:0,imported:0}),
    [importLog,setImportLog]=useState<any[]>([]);
  const loadLog=useCallback(()=>api<any>("/api/docs/import-log")
    .then(response=>setImportLog(response.items||response||[])).catch(()=>{}),[]);
  useEffect(()=>{loadLog()},[loadLog]);
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
      let failed=0;
      for(let index=0;index<batches.length;index++){
        const body=new FormData();
        batches[index].forEach(file=>body.append("files",file));
        const response=await api<any>("/api/docs/upload",{method:"POST",body});
        imported+=Number(response.importados??0);
        failed+=Number(response.falhas??0);
        setProgress({current:index+1,total:batches.length,imported});
      }
      toast(`${imported} novo(s) documento(s) importado(s)${failed?` · ${failed} arquivo(s) rejeitado(s), confira o log`:""}. Chaves já existentes foram ignoradas.`,imported===0&&failed>0);
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
      {!embedded&&<Head
        tag="IMPORTAÇÃO"
        title="Importar documentos"
        text="Envie arquivos XML de NF-e, CT-e ou NFS-e para processamento."
      />}
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
      <Panel title="Histórico de importações XML">
        <div className="import-log-head"><div><b>Rastreabilidade documental</b>
          <small>Últimos {importLog.length} XMLs processados nesta empresa.</small></div>
          <button className="secondary" onClick={loadLog}><RefreshCw/> Atualizar</button></div>
        <div className="import-timeline">
          {importLog.map(item=>{const origin=sourceInfo(item.source);return <article key={item.id}>
            <i className={origin.tone}><FileText/></i>
            <div><b>{item.kind||"XML"} {item.numero?`nº ${item.numero}`:""}</b>
              <small>{item.file_name||item.chave||"Documento fiscal"}</small>
              <code>{item.chave||"Chave não identificada"}</code></div>
            <span><span className={`source-badge ${origin.tone}`}><i/>{origin.label}</span>
              <small>{item.created_by_name}</small><time>{item.created_at?new Date(item.created_at).toLocaleString("pt-BR"):"—"}</time></span>
          </article>})}
          {!importLog.length&&<Empty/>}
        </div>
      </Panel>
    </>
  );
}
function Reports({ toast }: { toast: (s: string, e?: boolean) => void }) {
  const [format, setFormat] = useState("xlsx"),
    [type, setType] = useState("completo");
  const reportModels=[
    {id:"completo",title:"Relatório fiscal completo",text:"Todos os documentos e campos extraídos do XML.",icon:Files,tone:"mint"},
    {id:"nfe",title:"Notas fiscais NF-e",text:"NF-e com emitente, destinatário, valores e impostos.",icon:FileText,tone:"blue"},
    {id:"cte",title:"Conhecimentos CT-e",text:"CT-e, prestação, origem, destino e participantes.",icon:PackageSearch,tone:"violet"},
    {id:"cancelados",title:"Documentos cancelados",text:"Chaves canceladas e situação registrada na SEFAZ.",icon:X,tone:"red"},
    {id:"manual",title:"Importações manuais",text:"XMLs incluídos pela equipe na Central XML.",icon:UploadCloud,tone:"amber"},
    {id:"sefaz",title:"Importações automáticas SEFAZ",text:"Documentos obtidos por consulta ou sincronização.",icon:CloudDownload,tone:"mint"},
    {id:"impostos",title:"Valores e impostos",text:"Bases, ICMS, IPI, PIS, COFINS, frete e descontos.",icon:Gauge,tone:"blue"},
    {id:"participantes",title:"Emitentes e destinatários",text:"Relacionamento de CNPJs e participantes fiscais.",icon:Building2,tone:"violet"},
    {id:"auditoria",title:"Auditoria documental",text:"Origem, usuário responsável, arquivo e data de inclusão.",icon:ShieldCheck,tone:"amber"},
  ];
  async function run(selected=type) {
    try {
      const params = new URLSearchParams({
        modelo: selected,
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
        tag="INTELIGÊNCIA FISCAL"
        title="Central de relatórios"
        text="Modelos prontos, dados destrinchados e rastreabilidade por empresa."
      />
      <section className="report-command"><div><BarChart3/><span><small>FORMATO DE SAÍDA</small><b>Escolha como deseja analisar</b></span></div>
        <div className="format-switch"><button className={format==="xlsx"?"active":""} onClick={()=>setFormat("xlsx")}>Excel .XLSX</button>
          <button className={format==="csv"?"active":""} onClick={()=>setFormat("csv")}>Dados .CSV</button></div></section>
      <div className="report-catalog">{reportModels.map(model=><article className={type===model.id?"selected":""} key={model.id}
        onClick={()=>setType(model.id)}><header><i className={model.tone}><model.icon/></i>
          {type===model.id&&<span><ShieldCheck/> Selecionado</span>}</header>
        <h3>{model.title}</h3><p>{model.text}</p><footer><button className="secondary" onClick={event=>{event.stopPropagation();run(model.id)}}>
          <FileDown/> Gerar {format.toUpperCase()}</button></footer></article>)}</div>
      <div className="report-runner"><span><b>{reportModels.find(model=>model.id===type)?.title}</b>
        <small>O relatório respeitará a empresa ativa e utilizará somente dados reais armazenados.</small></span>
        <button className="primary" onClick={()=>run()}><Sparkles/> Gerar relatório selecionado</button></div>
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
    [selectedCnds,setSelectedCnds]=useState<number[]>([]),
    [confirmCndBatch,setConfirmCndBatch]=useState(false),
    [recognitionResults,setRecognitionResults]=useState<any[]>([]),
    [form, setForm] = useState<any>(null),
    [viewingCertificate,setViewingCertificate]=useState<any>(null),
    [pendingDelete,setPendingDelete]=useState<any>(null),
    [cndPdf, setCndPdf] = useState<File | null>(null),
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
  async function recognizePdf(files?: FileList | null) {
    if (!files?.length) return;
    let imported=0;const results:any[]=[];
    for(const file of Array.from(files)){
      const body=new FormData(); body.set("pdf",file);
      try{const result=await api<any>("/api/certidoes/recognize",{method:"POST",body});
        results.push({...result,fileName:file.name});imported++}
      catch(error){toast(`${file.name}: ${(error as Error).message}`,true)}
    }
    setRecognitionResults(results);
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
  async function deleteCertificate(item:any){
    try{await api(`/api/certidoes/${item.id}`,{method:"DELETE"});setPendingDelete(null);toast(`Documento excluído: certidão ${typeLabel[item.tipo]||item.tipo} removida com sucesso`);load()}
    catch(error){toast((error as Error).message,true)}
  }
  async function deleteCertificatesBatch(){
    try{
      const result=await api<any>("/api/certidoes/batch-delete",{method:"POST",body:{ids:selectedCnds}});
      setSelectedCnds([]);setConfirmCndBatch(false);
      toast(`${result.deleted} certidão(ões) e PDF(s) excluídos com sucesso`);load();
    }catch(error){toast((error as Error).message,true)}
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
        title="Regularidade CND"
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
      <section className="cnd-command-hero">
        <div><i><ShieldCheck/></i><span><small>PAINEL DE REGULARIDADE</small><h2>Risco fiscal visível antes do vencimento</h2>
          <p>Acompanhe certidões, PDFs, situações positivas e alertas programados por empresa.</p></span></div>
        <div className="cnd-risk-summary">
          <span className="critical"><small>Vencidas</small><b>{stats.vencidas||0}</b></span>
          <span className="warning"><small>Vencendo</small><b>{stats.vencendo||0}</b></span>
          <span className="safe"><small>Negativas</small><b>{stats.negativas||0}</b></span>
        </div>
      </section>
      {recognitionResults.length>0&&<section className="cnd-recognition-results">
        <header><div><Sparkles/><span><b>Leitura integral concluída</b><small>Campos identificados em todas as páginas processadas</small></span></div>
          <button onClick={()=>setRecognitionResults([])}><X/></button></header>
        <div>{recognitionResults.map((result,index)=><article key={`${result.fileName}-${index}`}>
          <i><FileText/></i><span><b>{result.fileName}</b><small>{result.recognized?.razaoSocial||"Empresa ativa"}</small></span>
          <dl><div><dt>Número</dt><dd>{result.recognized?.numero||"Revisão necessária"}</dd></div>
            <div><dt>Emissão</dt><dd>{date(result.recognized?.dataEmissao)}</dd></div>
            <div><dt>Validade</dt><dd>{date(result.recognized?.dataValidade)}</dd></div>
            <div><dt>Páginas</dt><dd>{result.recognized?.totalPages||"Todas"}</dd></div></dl>
          <em className={result.missing?.length?"warning":"ok"}>{result.missing?.length?`Revisar: ${result.missing.join(", ")}`:"Preenchimento completo"}</em>
        </article>)}</div>
      </section>}
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
          <button className="secondary" onClick={()=>setSelectedCnds(current=>
            visiblePage.every(item=>current.includes(Number(item.id)))?
              current.filter(id=>!visiblePage.some(item=>Number(item.id)===id)):
              [...new Set([...current,...visiblePage.map(item=>Number(item.id))])])}>
            {visiblePage.length>0&&visiblePage.every(item=>selectedCnds.includes(Number(item.id)))?"Desmarcar página":"Selecionar página"}
          </button>
          {selectedCnds.length>0&&<button className="secondary danger" onClick={()=>setConfirmCndBatch(true)}>
            <Trash2/> Excluir selecionadas ({selectedCnds.length})
          </button>}
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
                  className={`cnd-card ${expired ? "expired" : ""} ${selectedCnds.includes(Number(item.id))?"selected":""}`}
                  key={item.id}
                >
                  <header>
                    <label className="cnd-select" title="Selecionar certidão"><input type="checkbox"
                      checked={selectedCnds.includes(Number(item.id))}
                      onChange={event=>setSelectedCnds(current=>event.target.checked?
                        [...current,Number(item.id)]:current.filter(id=>id!==Number(item.id)))}/><span/></label>
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
                    {item.pdf_url && (
                      <button
                        className="secondary"
                        onClick={()=>setViewingCertificate(item)}
                      >
                        Visualizar
                      </button>
                    )}
                    <button className="secondary danger" onClick={()=>setPendingDelete(item)}><Trash2/> Excluir</button>
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
      {viewingCertificate&&<div className="modal-backdrop cnd-view-backdrop" role="dialog" aria-modal="true">
        <section className="cnd-viewer">
          <header><div><span className="eyebrow">DOCUMENTO FISCAL</span><h2>{typeLabel[viewingCertificate.tipo]||viewingCertificate.tipo} · {viewingCertificate.empresa_nome}</h2></div>
            <button className="square" onClick={()=>setViewingCertificate(null)}><X/></button></header>
          <div className="cnd-view-details">
            <div><small>Número</small><b>{viewingCertificate.numero_certidao||"Não identificado"}</b></div>
            <div><small>Emissão</small><b>{date(viewingCertificate.data_emissao)}</b></div>
            <div><small>Validade</small><b>{date(viewingCertificate.data_validade)}</b></div>
            <div><small>Situação</small><b>{viewingCertificate.status?.replaceAll("_"," ")}</b></div>
          </div>
          <iframe title="PDF completo da certidão" src={viewingCertificate.pdf_url}/>
        </section>
      </div>}
      {pendingDelete&&<div className="modal-backdrop deletion-backdrop" role="dialog" aria-modal="true">
        <section className="deletion-dialog"><i><Trash2/></i><span className="eyebrow">EXCLUIR DOCUMENTO</span>
          <h2>Deseja excluir esta certidão?</h2><p>A certidão <b>{typeLabel[pendingDelete.tipo]||pendingDelete.tipo}</b> de <b>{pendingDelete.empresa_nome}</b> e seu arquivo serão removidos.</p>
          <div><button className="secondary" onClick={()=>setPendingDelete(null)}>Manter documento</button>
            <button className="primary danger-action" onClick={()=>deleteCertificate(pendingDelete)}><Trash2/> Excluir certidão</button></div>
        </section>
      </div>}
      {confirmCndBatch&&<div className="modal-backdrop deletion-backdrop" role="dialog" aria-modal="true">
        <section className="deletion-dialog"><i><Trash2/></i><span className="eyebrow">EXCLUSÃO EM LOTE · CND</span>
          <h2>Excluir {selectedCnds.length} certidões?</h2><p>As certidões selecionadas e todos os PDFs vinculados serão removidos somente da empresa ativa.</p>
          <div><button className="secondary" onClick={()=>setConfirmCndBatch(false)}>Manter certidões</button>
            <button className="primary danger-action" onClick={deleteCertificatesBatch}><Trash2/> Excluir selecionadas</button></div>
        </section>
      </div>}
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

function SefazControlCenter({toast}:{toast:(s:string,e?:boolean)=>void}){
  const [data,setData]=useState<any>(null),[file,setFile]=useState<File|null>(null),
    [password,setPassword]=useState(""),[busy,setBusy]=useState(false),
    [section,setSection]=useState<"certificate"|"policy"|"rules">("certificate");
  const load=useCallback(async()=>{
    try{
      const me=await api<any>("/api/auth/me");
      const company=me.user.empresa_ativa;
      const companyId=Number(company?.empresa_id||company?.id||me.user.empresa_ativa_id);
      if(!companyId)throw new Error("Selecione uma empresa no topo do sistema");
      const [modules,certificate,sync]=await Promise.all([
        api<any>(`/api/empresas/${companyId}/modulos`),
        api<any>(`/api/empresas/${companyId}/certificado`),
        api<any>("/api/sefaz/sync-state"),
      ]);
      setData({company,companyId,modules,certificate,sync,admin:Boolean(me.user.is_super_admin||me.user.role==="admin")});
    }catch(error){toast((error as Error).message,true)}
  },[toast]);
  useEffect(()=>{load()},[load]);
  async function saveCertificate(){
    if(!file||!password)return toast("Selecione o PFX/P12 e informe a senha",true);
    setBusy(true);
    try{
      const body=new FormData();body.set("certificate",file);body.set("password",password);
      await api(`/api/empresas/${data.companyId}/certificado`,{method:"POST",body});
      setFile(null);setPassword("");toast("Certificado validado e protegido no cofre da empresa");await load();
    }catch(error){toast((error as Error).message,true)}finally{setBusy(false)}
  }
  async function removeCertificate(){
    setBusy(true);
    try{await api(`/api/empresas/${data.companyId}/certificado`,{method:"DELETE"});
      toast("Certificado removido");await load()}catch(error){toast((error as Error).message,true)}finally{setBusy(false)}
  }
  async function saveProtection(){
    setBusy(true);
    try{
      const config=data.modules.modulos.sefaz;
      await api(`/api/empresas/${data.companyId}/modulos`,{method:"PUT",body:{
        modulo:"sefaz",configuracao:config,ativo:config.ativo!==false,
      }});
      toast("Proteções e preferências SEFAZ salvas");
    }catch(error){toast((error as Error).message,true)}finally{setBusy(false)}
  }
  if(!data)return <section className="sefaz-control loading-card"><RefreshCw className="spin"/><span>Carregando cofre e proteções SEFAZ...</span></section>;
  const config=data.modules.modulos.sefaz,state=data.sync.state||{},locked=state.locked_until&&new Date(state.locked_until)>new Date();
  const certificate=data.certificate?.certificado;
  return <section className="sefaz-control">
    <header><div><span className="eyebrow">CENTRO DE CONTROLE</span><h2>Segurança, certificado e consumo protegido</h2>
      <p>Configuração da empresa ativa: <b>{data.company?.nome}</b></p></div>
      <span className={`sefaz-health ${locked?"waiting":"protected"}`}><i/>{locked?"Em espera segura":"Proteções ativas"}</span></header>
    <div className="sefaz-control-kpis">
      <article><ShieldCheck/><span><small>Certificado A1</small><b>{data.certificate?.configurado?"Validado":"Não configurado"}</b></span></article>
      <article><Network/><span><small>Último NSU</small><b>{state.ult_nsu||"0"}</b></span></article>
      <article><Activity/><span><small>Consultas individuais / 1h</small><b>{data.sync.individualQueriesLastHour||0} de 18</b></span></article>
      <article><RefreshCw/><span><small>Estado da fila</small><b>{String(state.last_status||"Não iniciada").replaceAll("_"," ")}</b></span></article>
    </div>
    <nav className="sefaz-compact-nav">
      <button className={section==="certificate"?"active":""} onClick={()=>setSection("certificate")}><ShieldCheck/><span><b>Certificado A1</b><small>Cofre e validade</small></span></button>
      <button className={section==="policy"?"active":""} onClick={()=>setSection("policy")}><Activity/><span><b>Consulta segura</b><small>UF, estratégia e limites</small></span></button>
      <button className={section==="rules"?"active":""} onClick={()=>setSection("rules")}><Network/><span><b>Proteções</b><small>Fila, NSU e bloqueios</small></span></button>
    </nav>
    <div className="sefaz-control-grid">
      {section==="certificate"&&<section className="sefaz-vault"><header><i><ShieldCheck/></i><span><b>Certificado digital A1</b>
        <small>{certificate?`${certificate.arquivo_nome} · válido até ${date(certificate.validade_fim)}`:
          "Anexe o PFX/P12 da empresa. CNPJ e validade serão conferidos antes de salvar."}</small></span></header>
        {data.admin?<div className="company-certificate-fields">
          <label><input type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={e=>setFile(e.target.files?.[0]||null)}/>
            <span>{file?.name||"Selecionar PFX/P12"}</span></label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha do certificado"/>
          <button disabled={busy} onClick={saveCertificate}>{busy?<RefreshCw className="spin"/>:<Save/>} Validar e salvar</button>
          {data.certificate?.configurado&&<button className="danger" disabled={busy} onClick={removeCertificate}><Trash2/> Remover</button>}
        </div>:<div className="hub-readonly"><ShieldCheck/> Somente administradores podem substituir o certificado.</div>}
        <p><ShieldCheck/> Arquivo e senha ficam criptografados; o navegador não recebe o conteúdo após o envio.</p>
      </section>}
      {section==="policy"&&<section className="sefaz-policy"><header><i><Activity/></i><span><b>Política preventiva</b>
        <small>Limites conservadores para Distribuição DF-e</small></span></header>
        <div className="sefaz-policy-fields">
          <label>UF autora<input maxLength={2} value={config.uf||"MG"} onChange={e=>setData({...data,modules:{...data.modules,
            modulos:{...data.modules.modulos,sefaz:{...config,uf:e.target.value.toUpperCase()}}}})}/></label>
          <label>Estratégia<select value={config.modo_consulta||"nsu"} onChange={e=>setData({...data,modules:{...data.modules,
            modulos:{...data.modules.modulos,sefaz:{...config,modo_consulta:e.target.value}}}})}>
            <option value="nsu">distNSU sequencial</option><option value="chave">Chaves individuais</option></select></label>
          <label>Limite interno / hora<input type="number" min="1" max="18" value={config.limite_chaves_hora??18}
            onChange={e=>setData({...data,modules:{...data.modules,modulos:{...data.modules.modulos,
              sefaz:{...config,limite_chaves_hora:Math.min(18,Math.max(1,Number(e.target.value)))}}}})}/></label>
          <label>Máximo por lote<input type="number" min="1" max="50" value={config.lote_maximo??50}
            onChange={e=>setData({...data,modules:{...data.modules,modulos:{...data.modules.modulos,
              sefaz:{...config,lote_maximo:Math.min(50,Math.max(1,Number(e.target.value)))}}}})}/></label>
        </div>
        {data.admin&&<button className="save-policy" disabled={busy} onClick={saveProtection}><Save/> Salvar política</button>}
      </section>}
    </div>
    {locked&&<div className="sefaz-lock-alert"><Bell/><span><b>Fila em pausa preventiva</b>
      <small>Nova tentativa liberada após {new Date(state.locked_until).toLocaleString("pt-BR")}. Antecipar a chamada pode reiniciar a contagem da SEFAZ.</small></span></div>}
    {section==="rules"&&<div className="sefaz-guardrails">
      {[
        ["NSU sempre crescente","Cada chamada continua exatamente do ultNSU devolvido; o sistema não reinicia em zero.",ShieldCheck],
        ["Uma fila por CNPJ","Bloqueio transacional impede duas sincronizações simultâneas para a mesma empresa.",Network],
        ["cStat 137: pausa de 1 hora","Quando não há documentos novos, nenhuma nova chamada distNSU é feita durante 60 minutos.",RefreshCw],
        ["cStat 656: pausa integral","Após Consumo Indevido, aguarda 60 minutos completos; novas tentativas não encurtam o prazo.",Bell],
        ["Margem abaixo do limite oficial","Chaves individuais limitadas internamente a 18/h, abaixo das 20/h informadas pela SEFAZ.",Activity],
        ["Sem looping de erros","Falhas repetidas entram em espera e ficam registradas, evitando reenvio contínuo pelo certificado.",X],
      ].map(([title,text,Icon]:any)=><article key={title}><i><Icon/></i><span><b>{title}</b><small>{text}</small></span></article>)}
    </div>}
    <footer><ShieldCheck/><p><b>Atenção:</b> outras aplicações que consultem o mesmo CNPJ também devem compartilhar a sequência do último NSU. A Haixel protege as chamadas feitas pela plataforma, mas não controla softwares externos.</p></footer>
  </section>
}

function Integrations({ toast }: { toast: (s: string, e?: boolean) => void }) {
  const [key, setKey] = useState(()=>localStorage.getItem("cordeiro.sefaz.queue")||""),
    [kind, setKind] = useState("nfe"),
    [provider] = useState("sefaz"),
    [results, setResults] = useState<any[]>([]),
    [queueProgress,setQueueProgress]=useState({done:0,total:0}),
    [busy, setBusy] = useState(false),
    [captchaToken, setCaptchaToken] = useState(""),
    [sitekey, setSitekey] = useState("0x4AAAAAAD9QFuEXmAjhoAuE"),
    [sitekeyInput, setSitekeyInput] = useState("0x4AAAAAAD9QFuEXmAjhoAuE");
  const keyInput = useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{localStorage.setItem("cordeiro.sefaz.queue",key)},[key]);
  const informedKeys=[...new Set(key.split(/[\s,;]+/).map(value=>value.replace(/\D/g,"")).filter(Boolean))];
  const safeQueriesPerHour=18;
  const estimatedMinutes=Math.ceil(informedKeys.length/safeQueriesPerHour*60);
  const durationLabel=(minutes:number)=>{
    if(minutes<60)return `${minutes} min`;
    const hours=Math.floor(minutes/60),rest=minutes%60;
    return hours>=24?`${Math.floor(hours/24)} dia(s) e ${hours%24}h${rest?` ${rest}min`:""}`:`${hours}h${rest?` ${rest}min`:""}`;
  };
  async function importKeySpreadsheet(file?:File){
    if(!file)return;
    try{
      let cells:any[]=[];
      if(/\.xlsx?$/i.test(file.name)){
        const {default:readXlsxFile,readSheetNames}=await import("read-excel-file");
        const sheets=await readSheetNames(file);
        for(const sheet of sheets){
          const rows=await readXlsxFile(file,{sheet});
          cells.push(...rows.flat());
        }
      }else cells=(await file.text()).split(/[\n\r;,]+/);
      const found=[...new Set(cells.flatMap(value=>String(value??"").match(/\d{44}/g)||[]))];
      if(!found.length)throw new Error("Nenhuma chave de 44 dígitos foi encontrada na planilha");
      setKey(found.join("\n"));
      setResults([]);
      toast(`${found.length} chave(s) carregada(s) da planilha. Clique em Consultar e importar.`);
    }catch(error){toast((error as Error).message,true)}
  }
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
    setBusy(true);
    setResults([]);
    try {
      const collected: any[] = [];
      setQueueProgress({done:0,total:keys.length});
      for (let index = 0; index < keys.length; index += 1) {
        const accessKey=keys[index];
        const responses = [await (async () => {
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
          })()];
        collected.push(...responses);
        setResults([...collected]);
        setQueueProgress({done:index+1,total:keys.length});
        const remaining=keys.slice(index+1);
        setKey(remaining.join("\n"));
        if(remaining.length)await new Promise(resolve=>window.setTimeout(resolve,200000));
      }
      const found = collected.filter((item) => item.ok).length;
      toast(
        `Consulta concluída: ${found} localizado(s), ${collected.length - found} com erro`,
        found === 0,
      );
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
        tag="HUB FISCAL"
        title="Integrações e documentos oficiais"
        text="Conectores, certificado, consultas e monitoramento organizados em um único centro operacional."
      />
      <section className="integration-hub-hero">
        <div className="integration-hub-copy"><i><Network/></i><div><span className="eyebrow">OPERAÇÃO CONECTADA</span>
          <h2>Seu ecossistema fiscal, simples de operar</h2>
          <p>Acesse os serviços oficiais, acompanhe a proteção do certificado e envie consultas sem navegar por telas dispersas.</p></div></div>
        <div className="integration-live"><span><i/> Ambiente protegido</span><small>Fila, NSU e limites preventivos ativos</small></div>
      </section>
      <nav className="integration-launchpad">
        <button onClick={()=>openConnector("query")}><i className="blue"><Search/></i><span><b>Consultar chave</b><small>NF-e e CT-e oficiais</small></span><ArrowUpRight/></button>
        <button onClick={()=>document.getElementById("sefaz-security")?.scrollIntoView({behavior:"smooth"})}><i className="green"><ShieldCheck/></i><span><b>Certificado A1</b><small>Cofre e política SEFAZ</small></span><ArrowUpRight/></button>
        <button onClick={()=>openConnector("certificate-monitor")}><i className="purple"><Activity/></i><span><b>Monitor fiscal</b><small>Disponibilidade e serviços</small></span><ArrowUpRight/></button>
        <button onClick={()=>openConnector("portal")}><i className="gold"><ArrowUpRight/></i><span><b>Portal oficial</b><small>Abrir Portal NF-e</small></span><ArrowUpRight/></button>
      </nav>
      <div id="sefaz-security"><SefazControlCenter toast={toast}/></div>
      <div className="fiscal-grid">
        <Panel title="Consulta e importação de documentos">
          <div className="query-box">
            <label>
              Documento
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="nfe">NF-e</option>
                <option value="cte">CT-e</option>
              </select>
            </label>
            <div className="query-source-note"><ShieldCheck/><span><small>Consulta protegida pela fonte oficial</small>
              <b>SEFAZ · Distribuição DF-e</b></span></div>
            <label>
              Chave de acesso
              <textarea
                ref={keyInput}
                rows={2}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={
                  "Cole as chaves, uma por linha\n00000000000000000000000000000000000000000000"
                }
              />
              <small>
                {informedKeys.length}{" "}
                chave(s) informada(s)
              </small>
            </label>
            <label className="spreadsheet-import">
              <input hidden type="file" accept=".xlsx,.xls,.csv,.txt" onChange={event=>importKeySpreadsheet(event.target.files?.[0])}/>
              <span className="spreadsheet-button"><FileText/><span><b>Importar planilha</b><small>Carregar lista de chaves</small></span><UploadCloud/></span>
              <small>Excel, CSV ou TXT · todas as abas serão verificadas</small>
            </label>
            {informedKeys.length>0&&<div className="sefaz-queue-estimate">
              <ShieldCheck/><span><b>Fila protegida · {safeQueriesPerHour} consultas por hora</b>
                <small>Estimativa: {durationLabel(estimatedMinutes)} · processamento sequencial com retomada</small></span>
            </div>}
            <button className="primary" onClick={consult} disabled={busy}>
              {busy ? <RefreshCw className="spin" /> : <CloudDownload />}Consultar e importar
            </button>
            {busy&&queueProgress.total>0&&<div className="sefaz-queue-progress"><span style={{width:`${queueProgress.done/queueProgress.total*100}%`}}/>
              <small>{queueProgress.done} de {queueProgress.total} processada(s)</small></div>}
          </div>
          {results.length > 0 && (
            <div className="batch-query-results">
              <header>
                <b>Log de validação e importação</b>
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
      const uploaded = await api<{ avatar_url:string }>("/api/auth/avatar", {
        method: "POST",
        body,
      });
      const r = await api<{ user: User }>("/api/auth/me");
      r.user.avatar_url=uploaded.avatar_url;
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
      await api("/api/auth/avatar", { method: "DELETE" });
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
        text="Personalize como você aparece na Haixel e mantenha seus contatos atualizados."
      />
      <div className="profile-grid">
        <Panel>
          <form className="profile-form" onSubmit={save}>
            <div className="profile-hero">
              <div className="avatar-editor">
                <span className={`profile-photo ${user.avatar_url?"user-photo":"brand-photo"}`}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} />
                  ) : (
                    <img src="/assets/haixel-logo.png" />
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
          <span className={`profile-photo large ${user.avatar_url?"user-photo":"brand-photo"}`}>
            <img src={user.avatar_url || "/assets/haixel-logo.png"} />
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
      <section className="support-hero">
        <div><i><MessageCircle/></i><span><small>CENTRAL DE RELACIONAMENTO</small>
          <h2>{isAdmin?"Operação de atendimento":"Como podemos ajudar hoje?"}</h2>
          <p>Chamados organizados, histórico completo e acompanhamento em um único lugar.</p></span></div>
        <span className="support-availability"><i/> EQUIPE DISPONÍVEL</span>
      </section>
      <section className="support-channels" aria-label="Atalhos de atendimento">
        {[
          ["duvida","Dúvida fiscal","Orientação para usar os módulos",BookOpen],
          ["bug","Reportar problema","Envie o erro para nossa equipe",Bug],
          ["melhoria","Sugerir melhoria","Ajude a evoluir a Haixel",Sparkles],
        ].map(([id,title,description,Icon]:any)=>(
          <button type="button" className={category===id?"active":""} key={id}
            onClick={()=>setCategory(id)}>
            <i><Icon/></i><span><b>{title}</b><small>{description}</small></span><ChevronRight/>
          </button>
        ))}
      </section>
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
            <i className="haixel-ai-orb"><Sparkles/><em/><em/></i>
            <span><b>Haixel IA</b><small>Assistente fiscal</small></span>
          </>
        )}
      </button>
      {open && (
        <section className="assistant">
          <header>
            <span className="assistant-avatar"><Sparkles/><i/><i/></span>
            <div>
              <b>Haixel IA <em>Beta</em></b>
              <small>
                <i /> {aiEnabled ? "Assistente fiscal disponível" : "Central de ajuda disponível"}
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
                    <img src="/assets/haixel-logo.png" alt="Haixel IA" />
                  </i>
                )}
                <span>{m.content}</span>
              </div>
            ))}
            {busy && (
              <div className="bot-message typing">
                <i>
                  <img src="/assets/haixel-logo.png" alt="Haixel IA" />
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
                    {item.kind === "online" ? <Users /> : <Bell />}
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

type SystemStatus = {
  release: {
    version: string;
    title: string;
    publishedAt: string;
    summary: string;
    items: { type: "new" | "improved" | "fixed"; title: string; text: string }[];
  };
  maintenance: {
    active: boolean;
    scheduled?: boolean;
    title: string;
    message: string;
    startsAt?: string | null;
    endsAt?: string | null;
  };
};

function MaintenanceCountdown({maintenance}:{maintenance:SystemStatus["maintenance"]}) {
  const [remaining,setRemaining]=useState(()=>Math.max(0,new Date(maintenance.startsAt||0).getTime()-Date.now()));
  useEffect(()=>{
    const update=()=>{
      const value=Math.max(0,new Date(maintenance.startsAt||0).getTime()-Date.now());
      setRemaining(value);
      if(value===0)window.location.reload();
    };
    update();const timer=window.setInterval(update,1000);return()=>window.clearInterval(timer);
  },[maintenance.startsAt]);
  if(!maintenance.scheduled||!remaining)return null;
  const seconds=Math.ceil(remaining/1000),label=seconds<60?`${seconds}s`:
    seconds<3600?`${Math.floor(seconds/60)}min ${seconds%60}s`:`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}min`;
  const progress=Math.max(0,Math.min(100,remaining/60000*100));
  return <aside className="maintenance-countdown" role="alert">
    <div className="countdown-worker"><Bot/><i/></div>
    <span><small>ATUALIZAÇÃO PROGRAMADA</small><b>A manutenção começa em {label}</b>
      <p>{maintenance.message}</p></span>
    <time>{label}</time><div className="countdown-progress"><i style={{width:`${Math.min(100,progress)}%`}}/></div>
  </aside>;
}

function WelcomeExperience({
  user,
  admin,
  onNavigate,
  onFinish,
}: {
  user: User;
  admin: boolean;
  onNavigate: (page: Page) => void;
  onFinish: () => void;
}) {
  const steps = [
    {
      title: `Bem-vindo, ${String(user.nome || user.username).split(" ")[0]}!`,
      tag: "SEU NOVO ESPAÇO FISCAL",
      text: "Vamos conhecer a Haixel. Em poucos passos, você verá onde acompanhar a operação, consultar documentos e cuidar da regularidade da empresa.",
      Icon: Sparkles,
    },
    {
      page: "dashboard" as Page,
      title: "Cockpit fiscal",
      tag: "VISÃO OPERACIONAL",
      text: "Seu ponto de partida. Aqui você enxerga indicadores, movimentações, alertas e o panorama fiscal da empresa ativa.",
      Icon: Radar,
    },
    {
      page: "documents" as Page,
      title: "Central de documentos",
      tag: "GESTÃO DOCUMENTAL",
      text: "Consulte e filtre NF-e, CT-e e outros documentos já armazenados, com acesso rápido aos arquivos e detalhes fiscais.",
      Icon: Files,
    },
    {
      page: "issued" as Page,
      title: "Documentos emitidos e recebidos",
      tag: "MONITOR SEFAZ",
      text: "Acompanhe tanto os documentos emitidos pela empresa quanto os emitidos contra o seu CNPJ, respeitando a fila segura da SEFAZ.",
      Icon: Send,
    },
    {
      page: "issued" as Page,
      title: "Central XML",
      tag: "IMPORTAÇÃO",
      text: "Importe XML e PDF, extraia informações e incorpore documentos à base fiscal sem digitação repetitiva.",
      Icon: UploadCloud,
    },
    {
      page: "reports" as Page,
      title: "Inteligência fiscal",
      tag: "ANÁLISE",
      text: "Transforme os documentos em relatórios e leituras gerenciais para apoiar conferências e decisões.",
      Icon: BarChart3,
    },
    {
      page: "certificates" as Page,
      title: "Regularidade CND",
      tag: "CERTIDÕES",
      text: "Controle validade, situação e alertas das certidões para evitar vencimentos inesperados.",
      Icon: ShieldCheck,
    },
    {
      page: "integrations" as Page,
      title: "Hub SEFAZ",
      tag: "INTEGRAÇÕES",
      text: "Centralize o certificado A1, acompanhe o NSU e consulte todas as proteções usadas para reduzir bloqueios por consumo indevido.",
      Icon: Network,
    },
    ...(admin
      ? [
          {
            page: "companies" as Page,
            title: "Empresas e acessos",
            tag: "GOVERNANÇA",
            text: "Como administrador, você também pode configurar empresas, módulos, usuários e permissões da equipe.",
            Icon: Building2,
          },
        ]
      : []),
  ];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  useEffect(() => {
    if (step.page) onNavigate(step.page);
  }, [index]);
  const finish = () => onFinish();
  return (
    <div className="experience-backdrop" role="dialog" aria-modal="true">
      <section className="welcome-experience">
        <div className="experience-visual">
          <span className="experience-orbit one" />
          <span className="experience-orbit two" />
          <div className="experience-icon"><step.Icon /></div>
          <Brand />
          <small>PASSO {index + 1} DE {steps.length}</small>
        </div>
        <div className="experience-content">
          <button className="experience-skip" onClick={finish}>Pular apresentação</button>
          <span className="eyebrow">{step.tag}</span>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
          <div className="experience-progress" aria-label="Progresso da apresentação">
            {steps.map((_, stepIndex) => (
              <button
                aria-label={`Ir para o passo ${stepIndex + 1}`}
                className={stepIndex === index ? "active" : stepIndex < index ? "done" : ""}
                onClick={() => setIndex(stepIndex)}
                key={stepIndex}
              />
            ))}
          </div>
          <footer>
            <button
              className="secondary"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
            >
              Voltar
            </button>
            <button
              className="primary"
              onClick={() => index === steps.length - 1 ? finish() : setIndex((value) => value + 1)}
            >
              {index === steps.length - 1 ? "Começar a usar" : "Conhecer próximo módulo"}
              <ArrowUpRight />
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

function ReleaseExperience({
  release,
  onClose,
}: {
  release: SystemStatus["release"];
  onClose: () => void;
}) {
  const icons = { new: Rocket, improved: Sparkles, fixed: Bug };
  const labels = { new: "Novidade", improved: "Melhoria", fixed: "Correção" };
  return (
    <div className="experience-backdrop" role="dialog" aria-modal="true">
      <section className="release-experience">
        <header>
          <div className="release-symbol"><Megaphone /></div>
          <div>
            <span className="eyebrow">NOVIDADES · VERSÃO {release.version}</span>
            <h2>{release.title}</h2>
            <p>{release.summary}</p>
          </div>
          <button className="icon-button" onClick={onClose}><X /></button>
        </header>
        <div className="release-list">
          {release.items.map((item) => {
            const Icon = icons[item.type];
            return (
              <article className={item.type} key={item.title}>
                <i><Icon /></i>
                <div>
                  <small>{labels[item.type]}</small>
                  <b>{item.title}</b>
                  <p>{item.text}</p>
                </div>
              </article>
            );
          })}
        </div>
        <footer>
          <small>Publicado em {new Date(release.publishedAt).toLocaleDateString("pt-BR")}</small>
          <button className="primary" onClick={onClose}><CheckCircle2 /> Entendi as novidades</button>
        </footer>
      </section>
    </div>
  );
}

function MaintenanceNotice({
  maintenance,
}: {
  maintenance: SystemStatus["maintenance"];
}) {
  if (!maintenance.active) return null;
  return (
    <main className="maintenance-gate">
      <div className="maintenance-grid" />
      <section className="maintenance-experience" role="status">
        <div className="maintenance-brand"><img src="/assets/haixel-logo.png" /><b>Haixel</b></div>
        <div className="maintenance-worker" aria-label="Assistente Haixel trabalhando na atualização">
          <span className="worker-person"><Bot /></span>
          <span className="worker-arms"><i /><i /></span>
          <span className="worker-laptop"><Laptop /></span>
          <span className="worker-dots"><i /><i /><i /></span>
        </div>
        <span className="eyebrow">ATUALIZAÇÃO EM ANDAMENTO</span>
        <h2>{maintenance.title}</h2>
        <p>{maintenance.message}</p>
        {(maintenance.startsAt || maintenance.endsAt) && (
          <div className="maintenance-window">
            {maintenance.startsAt && <span><small>Início previsto</small><b>{new Date(maintenance.startsAt).toLocaleString("pt-BR")}</b></span>}
            {maintenance.endsAt && <span><small>Conclusão prevista</small><b>{new Date(maintenance.endsAt).toLocaleString("pt-BR")}</b></span>}
          </div>
        )}
        <div className="maintenance-live"><i /><span><b>Equipe trabalhando na atualização</b><small>Esta página verificará automaticamente quando o acesso for liberado.</small></span></div>
      </section>
    </main>
  );
}

function Messenger() {
  const [open, setOpen] = useState(false),
    [users, setUsers] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [messages, setMessages] = useState<any[]>([]),
    [text, setText] = useState(""),
    [attachment,setAttachment]=useState<File|null>(null),
    [sending,setSending]=useState(false),
    [unread, setUnread] = useState(0);
  const threadRef=useRef<HTMLDivElement>(null);
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
    const timer = window.setInterval(loadUsers, 5000);
    return () => clearInterval(timer);
  }, [loadUsers]);
  const openThread = async (userItem: any) => {
    setSelected(userItem);
    setAttachment(null);
    try {
      setMessages(await api<any[]>(`/api/messages/thread/${userItem.id}`));
      loadUsers();
    } catch {}
  };
  const loadThread=useCallback(async()=>{
    if(!open||!selected?.id)return;
    try{setMessages(await api<any[]>(`/api/messages/thread/${selected.id}`));loadUsers()}catch{}
  },[open,selected?.id,loadUsers]);
  useEffect(()=>{
    if(!open||!selected?.id)return;
    loadThread();const timer=window.setInterval(loadThread,2500);return()=>window.clearInterval(timer);
  },[open,selected?.id,loadThread]);
  useEffect(()=>{threadRef.current?.scrollTo({top:threadRef.current.scrollHeight,behavior:"smooth"})},[messages]);
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || (!text.trim()&&!attachment)||sending) return;
    setSending(true);
    try{
      let encoded:any=null;
      if(attachment){
        if(attachment.size>2_500_000)throw new Error("O anexo deve ter até 2,5 MB");
        const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();
          reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Não foi possível ler o anexo"));reader.readAsDataURL(attachment)});
        encoded={name:attachment.name,mime:attachment.type||"application/octet-stream",base64};
      }
      const message = await api<any>("/api/messages", {
        method: "POST",body: { recipientId: selected.id, content: text,attachment:encoded },
      });
      setMessages((current) => [...current, message]);setText("");setAttachment(null);loadUsers();
    }catch(error){alert((error as Error).message)}finally{setSending(false)}
  }
  const activeSelected=users.find(item=>Number(item.id)===Number(selected?.id))||selected;
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
                    <small><i className={userItem.online?"online":""}/>{userItem.online?"Online agora":"Offline"}</small>
                  </span>
                  {userItem.unread > 0 && <em>{userItem.unread}</em>}
                </button>
              ))}
            </aside>
            <div className="messenger-thread">
              {selected ? (
                <>
                  <div className="thread-title">
                    <i>{String(activeSelected.nome||activeSelected.username).slice(0,2).toUpperCase()}<em className={activeSelected.online?"online":""}/></i>
                    <span><b>{activeSelected.nome || activeSelected.username}</b>
                      <small>{activeSelected.online?"Online agora · respostas em tempo real":"Offline · receberá quando entrar"}</small></span>
                  </div>
                  <div className="thread-messages" ref={threadRef}>
                    {messages.map((message) => (
                      <article
                        className={
                          message.recipient_id === selected.id ? "mine" : ""
                        }
                        key={message.id}
                      >
                        {message.attachment_url&&String(message.attachment_mime).startsWith("image/")&&
                          <a className="message-image" href={message.attachment_url} target="_blank" rel="noreferrer">
                            <img src={message.attachment_url}/></a>}
                        {message.attachment_url&&!String(message.attachment_mime).startsWith("image/")&&
                          <a className="message-file" href={message.attachment_url} target="_blank" rel="noreferrer">
                            <Paperclip/><span><b>{message.attachment_name}</b><small>{Math.ceil(Number(message.attachment_size||0)/1024)} KB</small></span></a>}
                        {message.content&&<p>{message.content}</p>}
                        <small>{new Date(message.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                          {message.recipient_id===selected.id&&<CheckCheck className={message.read_at?"read":""}/>}</small>
                      </article>
                    ))}
                  </div>
                  {attachment&&<div className="message-attachment-preview"><Paperclip/><span><b>{attachment.name}</b>
                    <small>{Math.ceil(attachment.size/1024)} KB</small></span><button onClick={()=>setAttachment(null)}><X/></button></div>}
                  <form onSubmit={sendMessage}>
                    <label className="message-attach" title="Enviar imagem ou arquivo"><Paperclip/><input type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/xml,application/xml"
                      onChange={event=>setAttachment(event.target.files?.[0]||null)}/></label>
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Escreva uma mensagem..."
                    />
                    <button className="primary" disabled={sending||(!text.trim()&&!attachment)}>
                      {sending?<RefreshCw className="spin"/>:<Send />}
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

function OnlinePresence(){
  const [online,setOnline]=useState(1);
  useEffect(()=>{
    const load=()=>api<any>("/api/users").then(response=>{
      const users=Array.isArray(response)?response:response.users||[];
      setOnline(Math.max(1,users.filter((item:any)=>item.online&&item.ativo!==false&&item.ativo!==0).length));
    }).catch(()=>setOnline(1));
    load();const timer=window.setInterval(load,15000);return()=>window.clearInterval(timer);
  },[]);
  return <div className="online-presence" title="Usuários online agora"><i/><b>{online} online</b></div>;
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
    [replicationOpen,setReplicationOpen]=useState(false),
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
      setReplicationOpen(false); setReplicateTargets([]);
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
      const saved=await api<any>(companyForm.id?`/api/empresas/${companyForm.id}`:"/api/empresas", {
        method: companyForm.id?"PUT":"POST",
        body: companyForm,
      });
      if(!companyForm.id&&companyForm.cadastrarFilial&&companyForm.filial){
        await api("/api/empresas",{method:"POST",body:{
          ...companyForm.filial,empresa_matriz_id:saved.id,
          regime_tributario:companyForm.regime_tributario,ambiente:companyForm.ambiente,
        }});
      }
      setCompanyForm(null);
      toast(companyForm.id?"Cadastro atualizado":companyForm.cadastrarFilial?"Matriz e filial cadastradas":"Empresa cadastrada");
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
        tag={kind === "companies" ? "GOVERNANÇA EMPRESARIAL" : "ADMINISTRAÇÃO"}
        title={kind === "companies" ? "Estrutura de empresas" : "Usuários"}
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
                  cadastrarFilial:false,
                  filial:{cnpj:"",nome:"",nome_fantasia:"",ie:"",im:""},
                })
              }
            >
              + Cadastrar empresa
            </button>
          )
        }
      />
      {kind==="companies"&&<section className="company-command-hero">
        <div><i><Building2/></i><span><small>MATRIZES, FILIAIS E AMBIENTES</small><h2>Governança empresarial centralizada</h2>
          <p>Organize unidades, alterne a empresa ativa e replique configurações fiscais com segurança.</p></span></div>
        <div className="company-command-actions">
          <span><Network/><b>{items.filter(item=>item.empresa_matriz_id).length}</b><small>filiais conectadas</small></span>
          <span><ShieldCheck/><b>{items.filter(item=>item.ativo!==false&&item.ativo!==0).length}</b><small>ambientes ativos</small></span>
        </div>
      </section>}
      {kind==="users"&&<section className="access-command-hero">
        <div><i><ShieldCheck/></i><span><small>IDENTIDADES E PERMISSÕES</small>
          <h2>Controle de acessos inteligente</h2>
          <p>Gerencie perfis, permissões, sessões e segurança da equipe em um painel único.</p></span></div>
        <div className="access-live">
          <span><i/><b>{items.filter(item=>item.online).length}</b><small>online agora</small></span>
          <span><Users/><b>{items.filter(item=>Boolean(item.ativo)).length}</b><small>acessos ativos</small></span>
        </div>
      </section>}
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
      {kind === "companies" && (
        <div className="admin-stats company-admin-stats">
          <article><Building2/><div><small>Matrizes cadastradas</small>
            <b>{items.filter(item=>!item.empresa_matriz_id).length}</b></div></article>
          <article><Network/><div><small>Filiais vinculadas</small>
            <b>{items.filter(item=>item.empresa_matriz_id).length}</b></div></article>
          <article><ShieldCheck/><div><small>Ambientes ativos</small>
            <b>{items.filter(item=>item.ativo!==false&&item.ativo!==0).length}</b></div></article>
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
                    <i><Building2 /></i>
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
                    <span className={`status ${inactive ? "inactive" : userItem.online ? "online" : "offline"}`}>
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
            {[["cnd","Certidões",ShieldCheck],["sefaz","SEFAZ",Network],["documentos","Documentos",Files],["alertas","Alertas",Bell]].map(([id,label,Icon]:any)=>
              <button className={moduleTab===id?"active":""} onClick={()=>setModuleTab(id)} key={id}>
                <i><Icon/></i><span><b>{label}</b><small>{id==="cnd"?"Validade e avisos":id==="sefaz"?"Consulta e importação":id==="documentos"?"XML e armazenamento":"E-mails automáticos"}</small></span>
              </button>)}
          </nav>
          <div className={`module-config module-${moduleTab}`}>
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
              <h3>Configuração centralizada</h3>
              <div className="secure-note"><Network/><span><b>Certificado e proteções foram movidos para o Hub SEFAZ</b>
                <small>Use Integrações → Hub SEFAZ para administrar o A1, acompanhar o último NSU, verificar a fila e ajustar os limites preventivos.</small></span></div>
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
              <div className="fixed-days">
                <b>Dias fixos para execução</b>
                <div>{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((label,index)=>{
                  const selected=(moduleData.modulos.alertas.dias_semana||[]).includes(index);
                  return <button type="button" className={selected?"active":""} key={label}
                    onClick={()=>setModuleData({...moduleData,modulos:{...moduleData.modulos,alertas:{...moduleData.modulos.alertas,
                      dias_semana:selected?(moduleData.modulos.alertas.dias_semana||[]).filter((day:number)=>day!==index):
                        [...(moduleData.modulos.alertas.dias_semana||[]),index].sort()}}})}>{label}</button>
                })}</div>
                <small>Escolha um ou vários dias; a rotina também respeitará o horário acima.</small>
              </div>
              <div className="module-email-list"><b>Destinatários vinculados</b>
                {moduleData.emails.length?moduleData.emails.map((item:any)=><span key={item.id}>{item.email}</span>):<small>Nenhum e-mail cadastrado para esta unidade.</small>}</div>
            </>}
          </div>
          <section className="module-replication">
            <header><button className="replication-toggle" type="button" aria-expanded={replicationOpen}
              onClick={()=>setReplicationOpen(value=>!value)}>
              <span>03</span><p><b>Replicar configuração deste módulo</b>
                <small>{replicationOpen?"Marque as unidades que receberão uma cópia.":"Opcional · clique para escolher as unidades."}</small></p>
              <ChevronDown className={replicationOpen?"open":""}/>
            </button>
              {replicationOpen&&<div className="replication-actions"><em>{replicateTargets.length} selecionada(s)</em>
                <button onClick={()=>setReplicateTargets(items.filter(item=>item.id!==moduleCompany.id).map(item=>Number(item.id)))}>Selecionar todas</button>
                <button disabled={!replicateTargets.length} onClick={()=>setReplicateTargets([])}>Limpar</button></div>}</header>
            {replicationOpen&&<><div>{items.filter(item=>item.id!==moduleCompany.id).map(item=><label key={item.id}>
              <input type="checkbox" checked={replicateTargets.includes(Number(item.id))}
                onChange={e=>setReplicateTargets(e.target.checked?[...replicateTargets,Number(item.id)]:
                  replicateTargets.filter(id=>id!==Number(item.id)))}/>
              <i><Building2/></i><span><b>{item.nome}</b><small>{item.empresa_matriz_id?"Filial":"Matriz"}</small></span><em/>
            </label>)}</div>
            <button className="secondary" disabled={!replicateTargets.length} onClick={replicateModule}>
              <Network/><span><b>Replicar configuração</b><small>Aplicar em {replicateTargets.length||0} unidade(s) selecionada(s)</small></span></button></>}
          </section>
          <footer><span><ShieldCheck/><small>Alterações aplicadas somente após salvar.</small></span>
            <div><button className="secondary" onClick={()=>setModuleCompany(null)}><X/> Fechar sem salvar</button>
              <button className="primary" onClick={saveModule}><Save/> Salvar configuração</button></div></footer>
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
            {!companyForm.id&&!companyForm.empresa_matriz_id&&<>
              <label className="company-branch-flag"><input type="checkbox" checked={Boolean(companyForm.cadastrarFilial)}
                onChange={event=>setCompanyForm({...companyForm,cadastrarFilial:event.target.checked})}/>
                <i><Network/></i><span><b>Esta matriz possui filial</b><small>Cadastre a primeira filial junto com a empresa.</small></span><em/></label>
              {companyForm.cadastrarFilial&&<section className="inline-branch-form">
                <header><span>02</span><div><b>Dados da primeira filial</b><small>A filial ficará agrupada e vinculada à matriz.</small></div></header>
                <div className="fields">
                  <label>CNPJ da filial<input required inputMode="numeric" value={companyForm.filial?.cnpj||""}
                    onChange={event=>setCompanyForm({...companyForm,filial:{...companyForm.filial,cnpj:event.target.value.replace(/\D/g,"").slice(0,14)}})}/></label>
                  <label>Razão social<input required value={companyForm.filial?.nome||""}
                    onChange={event=>setCompanyForm({...companyForm,filial:{...companyForm.filial,nome:event.target.value}})}/></label>
                  <label>Nome fantasia<input value={companyForm.filial?.nome_fantasia||""}
                    onChange={event=>setCompanyForm({...companyForm,filial:{...companyForm.filial,nome_fantasia:event.target.value}})}/></label>
                  <label>Inscrição estadual<input value={companyForm.filial?.ie||""}
                    onChange={event=>setCompanyForm({...companyForm,filial:{...companyForm.filial,ie:event.target.value}})}/></label>
                  <label>Inscrição municipal<input value={companyForm.filial?.im||""}
                    onChange={event=>setCompanyForm({...companyForm,filial:{...companyForm.filial,im:event.target.value}})}/></label>
                </div>
              </section>}
            </>}
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
              <i className="modal-hero-icon"><ShieldCheck /></i>
              <div>
                <span className="eyebrow">IDENTIDADE & ACESSO</span>
                <h2>{userForm.id ? "Editar usuário" : "Novo usuário"}</h2>
                <p>Defina a identidade, o perfil e as permissões desta pessoa.</p>
              </div>
              <button
                type="button"
                className="square"
                onClick={() => setUserForm(null)}
              >
                <X />
              </button>
            </header>
            <div className="user-modal-body">
            <section className="user-data-section">
              <header><span>01</span><div><b>Dados do usuário</b><small>Informações usadas para identificação e acesso.</small></div></header>
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
            </section>
            <section className="user-permissions">
              <header><span>02</span><div><b>Permissões nesta empresa</b><small>Controle exatamente o que este usuário poderá fazer.</small></div>
                <em>{Object.values(userForm.permissoes||{}).filter(Boolean).length} ativas</em></header>
              {[
                ["documentos_visualizar","Visualizar documentos"],
                ["documentos_incluir","Incluir e importar documentos"],
                ["documentos_excluir","Excluir documentos"],
                ["cnd_editar","Cadastrar e editar certidões"],
                ["sefaz_consultar","Consultar e importar pela SEFAZ"],
                ["relatorios_gerar","Gerar relatórios"],
              ].map(([key,label])=><label className="permission-tile" key={key}>
                <i><ShieldCheck /></i><span><b>{label}</b><small>{userForm.permissoes?.[key]?"Acesso liberado":"Acesso bloqueado"}</small></span>
                <input type="checkbox" checked={Boolean(userForm.permissoes?.[key])}
                  onChange={e=>setUserForm({...userForm,permissoes:{...userForm.permissoes,[key]:e.target.checked}})}/>
                <em /></label>)}
            </section>
            </div>
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
    [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null),
    [showWelcome, setShowWelcome] = useState(false),
    [showRelease, setShowRelease] = useState(false),
    [notifications, setNotifications] =
      useState<AppNotification[]>(storedNotifications);
  const setMobile = (value: boolean) =>
    setMobileState((current) => (value ? !current : false));
  const toast = useCallback((s: string, e = false) => {
    setNote({ s, e });
    setTimeout(() => setNote(null), 3500);
  }, []);
  const presenceSnapshot=useRef<Set<number>|null>(null),newsSnapshot=useRef<Set<string>|null>(null);
  const pushPersistent=useCallback((item:Omit<AppNotification,"id"|"createdAt"|"read">)=>{
    setNotifications(current=>{
      const next=[{...item,id:Date.now()+Math.random(),createdAt:new Date().toISOString(),read:false},...current]
        .filter(entry=>entry.kind==="online"||entry.kind==="news").slice(0,50);
      localStorage.setItem("cordeiro.notifications",JSON.stringify(next));return next;
    });
  },[]);
  useEffect(()=>{
    if(!user)return;
    const check=async()=>{
      try{
        const response=await api<any>("/api/users"),users=Array.isArray(response)?response:response.users||[];
        const online=new Set<number>(users.filter((item:any)=>item.online&&item.ativo!==false).map((item:any)=>Number(item.id)));
        if(presenceSnapshot.current)users.filter((item:any)=>online.has(Number(item.id))&&!presenceSnapshot.current!.has(Number(item.id))&&Number(item.id)!==Number(user.id))
          .forEach((item:any)=>pushPersistent({kind:"online",title:"Usuário online",text:`${item.nome||item.username} entrou online.`}));
        presenceSnapshot.current=online;
      }catch{}
    };
    check();const timer=window.setInterval(check,15000);return()=>window.clearInterval(timer);
  },[user,pushPersistent]);
  useEffect(()=>{
    if(!user)return;
    const check=async()=>{try{const response=await api<any>("/api/news"),items=[...(response.externos||[]),...(response.curadas||[])];
      const ids=new Set<string>(items.map((item:any)=>String(item.id||item.url)));
      if(newsSnapshot.current)items.filter((item:any)=>!newsSnapshot.current!.has(String(item.id||item.url)))
        .forEach((item:any)=>pushPersistent({kind:"news",title:"Nova notícia fiscal",text:item.titulo}));
      newsSnapshot.current=ids;
    }catch{}};
    check();const timer=window.setInterval(check,300000);return()=>window.clearInterval(timer);
  },[user,pushPersistent]);
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
  useEffect(() => {
    const checkStatus = () => api<SystemStatus>("/api/system").then(setSystemStatus).catch(() => {});
    checkStatus();
    const timer = window.setInterval(checkStatus, 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!user || !systemStatus) return;
    const status = systemStatus;
      setSystemStatus(status);
      const welcomeKey = `cordeiro.onboarding.${user.id}`;
      const releaseKey = `cordeiro.release.${user.id}`;
      const firstAccess = !user.onboarding_completed && localStorage.getItem(welcomeKey) !== "1";
      setShowWelcome(firstAccess);
      setShowRelease(!firstAccess && localStorage.getItem(releaseKey) !== status.release.version);
  }, [user, systemStatus?.release.version]);
  const admin = !!(user?.is_super_admin || user?.role === "admin");
  if (systemStatus?.maintenance.active)
    return <MaintenanceNotice maintenance={systemStatus.maintenance} />;
  if (checking)
    return (
      <div className="loading">
        <Brand />
        <RefreshCw className="spin" />
      </div>
    );
  if (!user) return <><Login done={enter}/>{systemStatus?.maintenance.scheduled&&
    <MaintenanceCountdown maintenance={systemStatus.maintenance}/>}</>;
  const go = (p: Page) => {
    setPage(p);
    setMobile(false);
  };
  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setCompany(null);
  }
  const finishWelcome = () => {
    localStorage.setItem(`cordeiro.onboarding.${user.id}`, "1");
    api("/api/auth/onboarding", { method: "POST" }).catch(() => {});
    setShowWelcome(false);
    if (systemStatus && localStorage.getItem(`cordeiro.release.${user.id}`) !== systemStatus.release.version)
      setShowRelease(true);
  };
  const closeRelease = () => {
    if (systemStatus) localStorage.setItem(`cordeiro.release.${user.id}`, systemStatus.release.version);
    setShowRelease(false);
  };
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
              (group !== "Governança" || admin) && (
                <section key={group}>
                  <small>{group}</small>
                  {items.map(([p, label, Icon]: any) => (
                    <button
                      className={page === p ? "active" : ""}
                      key={p}
                      onClick={() => go(p)}
                    >
                      <i className="sidebar-icon"><Icon /></i>
                      <span>{label}</span>
                      <b className="sidebar-arrow">›</b>
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
            <OnlinePresence />
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
              <span className={`avatar ${user.avatar_url?"user-photo":"brand-photo"}`}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} />
                ) : (
                  <img src="/assets/haixel-logo.png" />
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
          {page === "documents" && <DocumentHub toast={toast} />}{" "}
          {page === "issued" && <DocumentHub toast={toast} initial="dfe" />}{" "}
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
      {systemStatus?.maintenance.scheduled&&<MaintenanceCountdown maintenance={systemStatus.maintenance}/>}
      {showWelcome && (
        <WelcomeExperience user={user} admin={admin} onNavigate={go} onFinish={finishWelcome} />
      )}
      {!showWelcome && showRelease && systemStatus && (
        <ReleaseExperience release={systemStatus.release} onClose={closeRelease} />
      )}
      {note && (
        <div className={`toast ${note.e ? "bad" : ""}`}>
          {note.e ? <X /> : <ShieldCheck />}
          {note.s}
        </div>
      )}
    </div>
  );
}
