const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
}[char]));

function shell({eyebrow,title,intro,content,footer}){
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;background:#eef5f2;font-family:Inter,Segoe UI,Arial,sans-serif;color:#14241f">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#eef5f2"><tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;overflow:hidden;border:1px solid #dce9e4;border-radius:24px;background:#fff;box-shadow:0 22px 60px rgba(19,59,46,.10)">
        <tr><td style="padding:28px 30px;background:linear-gradient(135deg,#f9fffc,#e5f7f0);border-bottom:1px solid #dce9e4">
          <table role="presentation" width="100%"><tr><td><div style="display:inline-block;width:44px;height:44px;border-radius:14px;background:linear-gradient(145deg,#1ca47e,#08614d);color:#fff;font-size:22px;font-weight:900;line-height:44px;text-align:center;box-shadow:0 10px 24px rgba(11,111,84,.24)">H</div></td>
          <td align="right"><span style="display:inline-block;padding:7px 10px;border:1px solid #bfe3d6;border-radius:999px;background:#f7fffc;color:#127257;font-size:9px;font-weight:800;letter-spacing:1.4px">${eyebrow}</span></td></tr></table>
          <h1 style="margin:22px 0 8px;color:#10251e;font-size:27px;line-height:1.16">${title}</h1>
          <p style="margin:0;max-width:520px;color:#60756e;font-size:14px;line-height:1.65">${intro}</p>
        </td></tr>
        <tr><td style="padding:30px">${content}</td></tr>
        <tr><td style="padding:18px 30px;border-top:1px solid #e4ede9;background:#f9fcfb;color:#82938d;font-size:11px;line-height:1.6">
          ${footer}<br><strong style="color:#26755e">Haixel · Inteligência fiscal para decisões seguras</strong>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

export function accessEmail({name,code,expiresMin=15}){
  const safeName=esc(name||"");
  return {
    subject:`${code} · seu código de acesso Haixel`,
    html:shell({
      eyebrow:"ACESSO SEGURO",
      title:`Olá${safeName?`, ${safeName}`:""}. Confirme sua identidade.`,
      intro:"Use o código abaixo para concluir seu cadastro com segurança. Ele é pessoal e expira automaticamente.",
      content:`<div style="padding:26px;border:1px solid #bfe3d6;border-radius:18px;background:linear-gradient(145deg,#f6fffb,#eaf8f3);text-align:center">
        <div style="color:#688078;font-size:10px;font-weight:800;letter-spacing:2px">CÓDIGO DE VERIFICAÇÃO</div>
        <div style="margin:12px 0;color:#0e6c52;font-family:Consolas,Courier New,monospace;font-size:40px;font-weight:900;letter-spacing:11px">${esc(code)}</div>
        <div style="color:#a56c13;font-size:11px;font-weight:800">VÁLIDO POR ${Number(expiresMin)} MINUTOS</div>
      </div>
      <div style="margin-top:20px;padding:14px 16px;border-radius:13px;background:#fff8e8;color:#77551b;font-size:12px;line-height:1.6">
        <strong>Proteja sua conta:</strong> a equipe Haixel nunca solicitará sua senha, seu certificado digital ou este código.
      </div>`,
      footer:"Você recebeu esta mensagem porque foi solicitado um cadastro. Se não reconhece a ação, ignore este e-mail.",
    }),
  };
}

export function cndAlertEmail({company,items,preview=false}){
  const rows=items.map(item=>{
    const validity=item.data_validade?new Date(`${item.data_validade}T12:00:00Z`).toLocaleDateString("pt-BR"):"Não identificada";
    const expired=item.days<0;
    return `<tr>
      <td style="padding:13px 12px;border-bottom:1px solid #e5ede9"><strong style="display:block;color:#19352b;font-size:12px">${esc(item.tipo||"Certidão fiscal")}</strong><span style="color:#83948e;font-size:10px">${esc(item.numero_certidao||"Sem número")}</span></td>
      <td style="padding:13px 12px;border-bottom:1px solid #e5ede9;color:#526a62;font-size:11px">${validity}</td>
      <td align="right" style="padding:13px 12px;border-bottom:1px solid #e5ede9"><span style="display:inline-block;padding:6px 8px;border-radius:999px;background:${expired?"#fff0f1":"#fff7e5"};color:${expired?"#ba3f4b":"#a36c13"};font-size:9px;font-weight:850">${expired?`Vencida há ${Math.abs(item.days)} dia(s)`:`Vence em ${item.days} dia(s)`}</span></td>
    </tr>`;
  }).join("");
  return {
    subject:`${preview?"Prévia · ":""}Regularidade CND · ${company}`,
    html:shell({
      eyebrow:preview?"PRÉVIA DO ALERTA":"REGULARIDADE FISCAL",
      title:preview?"Este é o novo alerta de CND.":"Existem certidões que precisam de atenção.",
      intro:`A Haixel encontrou ${items.length} certidão(ões) vencida(s) ou próxima(s) do vencimento em ${esc(company)}.`,
      content:`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="overflow:hidden;border:1px solid #dfeae5;border-radius:15px;background:#fff">
        <tr style="background:#f2f8f5"><th align="left" style="padding:11px 12px;color:#6c827a;font-size:9px;letter-spacing:1px">CERTIDÃO</th><th align="left" style="padding:11px 12px;color:#6c827a;font-size:9px;letter-spacing:1px">VALIDADE</th><th align="right" style="padding:11px 12px;color:#6c827a;font-size:9px;letter-spacing:1px">SITUAÇÃO</th></tr>${rows}
      </table>
      <div style="margin-top:20px;padding:16px;border-radius:14px;background:#0e604c;color:#fff">
        <strong style="display:block;font-size:13px">Próxima ação recomendada</strong>
        <span style="display:block;margin-top:5px;color:#bce5d8;font-size:11px;line-height:1.6">Acesse Regularidade CND na Haixel para consultar o PDF, atualizar a certidão e manter os alertas em dia.</span>
      </div>`,
      footer:"Mensagem automática de regularidade fiscal. Os dados refletem a última atualização registrada na Haixel.",
    }),
  };
}

export async function sendResend({to,subject,html}){
  if(!process.env.RESEND_API_KEY)return {sent:false,reason:"not_configured"};
  const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{
    Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json",
  },body:JSON.stringify({
    from:process.env.MAIL_FROM||"Haixel <alertas@cordeirofiscal.com.br>",
    to:Array.isArray(to)?to:[to],subject,html,
  })});
  if(!result.ok)throw new Error(`Falha no envio de e-mail (${result.status})`);
  return {sent:true,data:await result.json()};
}
