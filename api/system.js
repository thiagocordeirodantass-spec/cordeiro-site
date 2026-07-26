const RELEASE={
  version:"2026.07.26.4",
  title:"Hub SEFAZ, estabilidade e experiência renovada",
  publishedAt:"2026-07-26T18:00:00-03:00",
  summary:"Uma atualização focada em segurança fiscal, clareza operacional e correções importantes.",
  items:[
    {type:"new",title:"Hub SEFAZ centralizado",text:"Certificado A1, política preventiva, fila, último NSU e diagnóstico agora ficam no mesmo centro de controle."},
    {type:"new",title:"Documentos emitidos e recebidos",text:"Nova separação entre documentos emitidos pela empresa e documentos emitidos contra o CNPJ ativo."},
    {type:"improved",title:"Proteção contra Consumo Indevido",text:"Fila exclusiva, NSU sequencial, pausas para cStat 137/656 e limite conservador de chaves por hora."},
    {type:"fixed",title:"Leitura de certidões em PDF",text:"Corrigido o empacotamento do leitor serverless e do worker usado na extração de texto."},
    {type:"fixed",title:"Foto de perfil",text:"Corrigida a rota de alteração e remoção da imagem do usuário."},
    {type:"improved",title:"Interface mais confortável",text:"Sidebar fixa, ícones maiores e módulos administrativos com controles mais claros."},
  ],
};
export default function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Método não permitido"});
  const active=/^(1|true|yes)$/i.test(String(process.env.MAINTENANCE_MODE||""));
  return res.json({
    release:RELEASE,
    maintenance:{
      active,
      title:process.env.MAINTENANCE_TITLE||"Manutenção programada",
      message:process.env.MAINTENANCE_MESSAGE||"Estamos aplicando melhorias de segurança e estabilidade. Algumas funções podem ficar temporariamente indisponíveis.",
      startsAt:process.env.MAINTENANCE_START||null,
      endsAt:process.env.MAINTENANCE_END||null,
    },
  });
}
