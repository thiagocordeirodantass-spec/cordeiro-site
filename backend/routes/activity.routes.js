import {Router} from "express";
import {db} from "../db/index.js";
const router=Router();
router.get("/",(req,res)=>{
  if(!req.tenantId)return res.json({items:[]});
  const items=db.prepare(`SELECT l.*,COALESCE(u.nome,l.username,'Usuário') usuario_nome
    FROM empresa_activity_log l LEFT JOIN users u ON u.id=l.user_id
    WHERE l.empresa_id=? ORDER BY l.created_at DESC LIMIT 300`).all(req.tenantId);
  res.json({items});
});
export default router;
