import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { deviceMessage, installationSchema, registerDevice } from '../services/deviceBinding';

const router=Router();
router.post('/register',requireAuth,requireRole('student'),async(req,res)=>{
  const parsed=z.object({installationId:installationSchema,platform:z.enum(['android','ios','web'])}).safeParse(req.body);
  if(!parsed.success || !req.user!.profileId) return res.status(400).json({error:'Complete your student profile before registering this installation.'});
  try {
    const result=await registerDevice(parsed.data.installationId,req.user!.profileId,parsed.data.platform);
    if(!result.allowed) return res.status(409).json({error:deviceMessage(result.code),code:result.code});
    return res.json(result);
  } catch(error) {return res.status(503).json({error:(error as Error).message});}
});
// Device ownership can only be resolved by the single authorized admin.
router.get('/',requireAuth,requireRole('admin'),async(req,res)=>{
  const student=z.string().uuid().safeParse(req.query.studentId);
  if(!student.success)return res.status(400).json({error:'Choose a student.'});
  const {data,error}=await supabaseAdmin.from('student_devices').select('*').eq('student_id',student.data).order('registered_at',{ascending:false}).limit(100);
  if(error)return res.status(503).json({error:'Could not load devices.'});
  return res.json(data);
});
router.get('/conflicts',requireAuth,requireRole('admin'),async(_req,res)=>{
  const {data,error}=await supabaseAdmin.from('device_conflicts').select('*').order('last_seen_at',{ascending:false}).limit(100);
  if(error)return res.status(503).json({error:'Could not load device conflicts.'});
  return res.json(data);
});
router.put('/:id/resolve',requireAuth,requireRole('admin'),async(req,res)=>{
  const id=installationSchema.safeParse(req.params.id);
  const parsed=z.object({studentId:z.string().uuid(),status:z.enum(['active','revoked']),reason:z.string().trim().min(5).max(500)}).safeParse(req.body);
  if(!id.success || !parsed.success)return res.status(400).json({error:'Choose an installation, student, status and a reason (5–500 characters).'});
  const {error}=await supabaseAdmin.rpc('admin_resolve_student_device',{p_installation:id.data,p_student:parsed.data.studentId,p_status:parsed.data.status,p_actor:req.user!.profileId,p_reason:parsed.data.reason});
  if(error)return res.status(error.code==='42501'?403:400).json({error:'Could not resolve this device. Check the student and installation.'});
  return res.json({resolved:true});
});
export default router;
