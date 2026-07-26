export type Company = {
  id?: number;
  empresa_id?: number;
  nome: string;
  cnpj?: string;
  papel?: string;
};
export type User = {
  id: number;
  nome?: string;
  username: string;
  email?: string;
  role?: string;
  is_super_admin?: boolean;
  avatar_url?: string;
  cargo?: string;
  area_atuacao?: string;
  bio?: string;
  linkedin_url?: string;
  instagram_url?: string;
  website_url?: string;
  telefone?: string;
  certificate_verified?: boolean;
  preferencias?: Record<string, unknown>;
  empresa_ativa?: Company | null;
  memberships?: Company[];
};
let company: Company | null = null;
export const setCompany = (value: Company | null) => {
  company = value;
};

export async function api<T = any>(
  path: string,
  options: Omit<RequestInit, "body"> & { body?: any } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  const id = company?.id ?? company?.empresa_id;
  if (id && !path.includes("/auth/") && !path.includes("/empresas"))
    headers.set("X-Empresa-Id", String(id));
  const response = await fetch(path, {
    ...options,
    body,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    let message = `Erro ${response.status}`;
    try {
      message = (await response.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (response.headers.get("content-type") || "").includes(
    "application/json",
  )
    ? response.json()
    : (response as T);
}

export async function download(path: string, filename: string) {
  const id = company?.id ?? company?.empresa_id;
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: id ? { "X-Empresa-Id": String(id) } : {},
  });
  if (!response.ok) {
    let message="Não foi possível gerar o arquivo";
    try{message=(await response.json()).error||message}catch{}
    throw new Error(message);
  }
  const blob=await response.blob(),bytes=new Uint8Array(await blob.slice(0,4).arrayBuffer());
  const isZip=bytes[0]===0x50&&bytes[1]===0x4b;
  if((/\.(xlsx|zip)$/i.test(filename)&&!isZip)||
    (/\.pdf$/i.test(filename)&&String.fromCharCode(...bytes)!=="%PDF")){
    throw new Error("O servidor não retornou um arquivo válido. O download foi cancelado para evitar corrupção.");
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
