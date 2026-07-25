# Cordeiro Fiscal — interface moderna

Nova interface principal do sistema, construída com React, TypeScript e Vite.

## Desenvolvimento

```powershell
npm install
npm run dev
```

O Vite abre em `http://localhost:5173` e encaminha `/api` para o backend na porta 3000.

## Produção

```powershell
npm run build
```

O Express serve automaticamente a pasta `frontend-modern/dist`.

## Módulos entregues

- autenticação e sessão;
- seleção da empresa ativa;
- dashboard com indicadores e gráfico;
- busca, listagem e download de documentos;
- importação múltipla de XML por clique ou arrastar e soltar;
- relatórios em Excel, CSV e PDF;
- central de integrações;
- administração de empresas e usuários;
- modo claro/escuro e layout responsivo.

O frontend anterior permanece em `../frontend` como cópia de segurança.
