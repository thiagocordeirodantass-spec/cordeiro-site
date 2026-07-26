import {ensureSchema,pool} from "../_database.js";
import {cndAlertEmail,sendResend} from "../_email-templates.js";

export default async function handler(req,res){
  try{
    if(req.method!=="GET"&&req.method!=="POST")return res.status(405).json({error:"Método não permitido"});
    const secret=String(process.env.CRON_SECRET||"");
    if(secret&&String(req.headers.authorization||"")!==`Bearer ${secret}`)
      return res.status(401).json({error:"Não autorizado"});
    await ensureSchema();
    const config=(await pool.query("SELECT * FROM cnd_config WHERE id=1")).rows[0];
    if(!config?.alertas_ativos)return res.json({ok:true,skipped:"alerts_disabled"});
    const result=await pool.query(`SELECT d.email,e.id empresa_id,e.nome empresa_nome,c.tipo,c.numero_certidao,c.data_validade,
      (c.data_validade-CURRENT_DATE)::int days
      FROM cnd_destinatarios d JOIN empresas e ON e.id=d.empresa_id
      JOIN certidoes c ON c.empresa_id=e.id
      WHERE d.ativo=TRUE AND c.data_validade IS NOT NULL
        AND ((c.data_validade<CURRENT_DATE AND $2::boolean)
          OR (c.data_validade BETWEEN CURRENT_DATE AND CURRENT_DATE+$1::int AND $3::boolean)
          OR (c.status='positiva' AND $4::boolean))
      ORDER BY d.email,e.id,c.data_validade`,[
        Number(config.prazo_alerta||10),Boolean(config.alerta_vencidas),
        Boolean(config.alerta_vencimento),Boolean(config.alerta_positivas),
      ]);
    const groups=new Map();
    for(const row of result.rows){
      const key=`${row.email}:${row.empresa_id}`;
      if(!groups.has(key))groups.set(key,{email:row.email,company:row.empresa_nome,items:[]});
      groups.get(key).items.push(row);
    }
    let sent=0;
    for(const group of groups.values()){
      const template=cndAlertEmail(group);
      const delivery=await sendResend({to:group.email,...template});
      if(delivery.sent)sent++;
    }
    return res.json({ok:true,groups:groups.size,sent});
  }catch(error){
    console.error("CND dispatch",error);
    return res.status(500).json({error:"Não foi possível disparar os alertas de CND"});
  }
}
