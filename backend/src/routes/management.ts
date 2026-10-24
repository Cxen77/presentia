import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middleware/auth";
import { supabaseAdmin } from "../services/supabase";
import { env } from "../config/env";
import { compareRoster } from "../services/roster";
const router = Router();
router.use(requireAuth, requireRole("faculty", "admin"));
const facultyFields = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    department: z.string().trim().min(2).max(100),
  })
  .strict();
const studentFields = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    rollNumber: z.string().trim().min(2).max(30),
    department: z.string().trim().min(2).max(100),
    semester: z.string().trim().min(1).max(50),
    classRollNumber: z.string().trim().max(20).optional(),
    section: z.string().trim().max(30).optional(),
  })
  .strict();
const password = () => `P!${crypto.randomBytes(20).toString("base64url")}7a`;
const projectProfile = (p: any) => ({
  id: p.id,
  userId: p.user_id,
  name: p.full_name,
  email: p.email,
  loginId: p.roll_number,
  department: p.degree,
  semester: p.semester,
  classRollNumber: p.class_roll_number || "",
  section: p.section || "",
  role: p.role,
  archivedAt: p.archived_at || null,
  avatarUrl: p.avatar_url,
  createdAt: p.created_at,
});
async function confirmation(email: string) {
  try {
    const response = await fetch(env.SUPABASE_URL + "/auth/v1/resend", {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "signup", email }),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function withClasses(people: any[], facultyId?: string) {
  if (!people.length) return [];
  let query = supabaseAdmin
    .from("class_enrollments")
    .select(
      "student_id,class:class_id!inner(id,class_name,course_code,semester,faculty_id)",
    )
    .in(
      "student_id",
      people.map((p) => p.id),
    )
    .eq("status", "active");
  if (facultyId) query = query.eq("class.faculty_id", facultyId);
  const { data, error } = await query;
  if (error) throw error;
  return people
    .sort(compareRoster)
    .map((p) => ({
      ...projectProfile(p),
      classes: (data || [])
        .filter((e) => e.student_id === p.id)
        .map((e: any) => ({
          id: e.class.id,
          name: e.class.class_name,
          code: e.class.course_code,
          semester: e.class.semester,
        })),
    }));
}
router.get("/people", requireRole("admin"), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return res.status(500).json({ error: "Could not load accounts." });
  try {
    return res.json(await withClasses(data || []));
  } catch {
    return res.status(500).json({ error: "Could not load class memberships." });
  }
});
router.get("/students", async (req, res) => {
  if (req.user!.role === "admin") {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("role", "student")
      .order("full_name");
    if (error)
      return res.status(500).json({ error: "Could not load students." });
    try {
      return res.json(await withClasses(data || []));
    } catch {
      return res
        .status(500)
        .json({ error: "Could not load class memberships." });
    }
  }
  const { data, error } = await supabaseAdmin
    .from("class_enrollments")
    .select("student:student_id(*),class:class_id!inner(faculty_id)")
    .eq("class.faculty_id", req.user!.profileId)
    .eq("status", "active");
  if (error)
    return res.status(500).json({ error: "Could not load your students." });
  const people = new Map<string, any>();
  for (const row of data || []) {
    const student: any = row.student;
    if (student?.role === "student") people.set(student.id, student);
  }
  try {
    return res.json(
      await withClasses([...people.values()], req.user!.profileId),
    );
  } catch {
    return res
      .status(500)
      .json({ error: "Could not load your class memberships." });
  }
});
router.put("/me", async (req, res) => {
  const parsed = facultyFields.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "Enter a valid name and department." });
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      first_name: parsed.data.fullName.split(" ")[0],
      degree: parsed.data.department,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.user!.profileId);
  if (error)
    return res.status(500).json({ error: "Could not save your details." });
  return res.json({ success: true });
});
router.put("/students/:id", async (req, res) => {
  const parsed = studentFields.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error:
        "Enter valid student details. Role and email cannot be changed here.",
    });
  if (req.user!.role !== "admin") {
    const { data } = await supabaseAdmin
      .from("class_enrollments")
      .select("id,class:class_id!inner(faculty_id)")
      .eq("student_id", req.params.id)
      .eq("class.faculty_id", req.user!.profileId)
      .eq("status", "active")
      .limit(1);
    if (!data?.length)
      return res.status(403).json({
        error: "You can only edit students enrolled in your classes.",
      });
  }
  const d = parsed.data;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: d.fullName,
      first_name: d.fullName.split(" ")[0],
      roll_number: d.rollNumber.toUpperCase(),
      degree: d.department,
      semester: d.semester,
      ...(d.classRollNumber !== undefined
        ? { class_roll_number: d.classRollNumber }
        : {}),
      ...(d.section !== undefined ? { section: d.section.toUpperCase() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .eq("role", "student")
    .select("id")
    .maybeSingle();
  if (error)
    return res.status(error.code === "23505" ? 409 : 500).json({
      error:
        error.code === "23505"
          ? "This USN is already assigned to another account."
          : "Could not save student details.",
    });
  if (!data) return res.status(404).json({ error: "Student not found." });
  return res.json({ success: true });
});
router.post("/faculty", requireRole("admin"), async (req, res) => {
  const parsed = facultyFields
    .extend({ email: z.string().email().max(254) })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: "Enter a faculty name, department, and real email address.",
    });
  const d = parsed.data,
    temporaryPassword = password(),
    loginId = "FAC-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: d.email.trim().toLowerCase(),
    password: temporaryPassword,
    email_confirm: false,
    app_metadata: { must_change_password: true },
    user_metadata: { full_name: d.fullName },
  });
  if (error || !data.user)
    return res.status(409).json({
      error:
        "Could not create this account. Its email may already be registered.",
    });
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      user_id: data.user.id,
      email: d.email.trim().toLowerCase(),
      full_name: d.fullName,
      first_name: d.fullName.split(" ")[0],
      roll_number: loginId,
      degree: d.department,
      semester: "Faculty",
      role: "faculty",
    },
    { onConflict: "user_id" },
  );
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    return res.status(500).json({
      error: "Faculty profile could not be created. No new account was kept.",
    });
  }
  const confirmationSent = await confirmation(d.email);
  res.setHeader("Cache-Control", "no-store");
  return res.status(201).json({
    email: d.email,
    loginId,
    temporaryPassword,
    confirmationSent,
    requiresPasswordChange: true,
  });
});
router.put("/faculty/:id", requireRole("admin"), async (req, res) => {
  const parsed = facultyFields.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Enter valid faculty details." });
  const d = parsed.data;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: d.fullName,
      first_name: d.fullName.split(" ")[0],
      degree: d.department,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .eq("role", "faculty")
    .select("id")
    .maybeSingle();
  if (error)
    return res.status(500).json({ error: "Could not save faculty details." });
  if (!data) return res.status(404).json({ error: "Faculty not found." });
  return res.json({ success: true });
});
router.post(
  "/faculty/:id/reset-password",
  requireRole("admin"),
  async (req, res) => {
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("user_id,email,roll_number")
      .eq("id", req.params.id)
      .eq("role", "faculty")
      .single();
    if (!p) return res.status(404).json({ error: "Faculty not found." });
    const temporaryPassword = password();
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(
      p.user_id,
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(p.user_id, {
      password: temporaryPassword,
      app_metadata: { ...auth.user?.app_metadata, must_change_password: true },
    });
    if (error)
      return res.status(500).json({ error: "Could not reset credentials." });
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      email: p.email,
      loginId: p.roll_number,
      temporaryPassword,
      requiresPasswordChange: true,
    });
  },
);
router.delete("/faculty/:id", requireRole("admin"), async (req, res) => {
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("user_id,archived_at")
    .eq("id", req.params.id)
    .eq("role", "faculty")
    .maybeSingle();
  if (!p) return res.status(404).json({ error: "Faculty not found." });
  const { count, error: classError } = await supabaseAdmin
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("faculty_id", req.params.id)
    .eq("is_active", true);
  if (classError)
    return res.status(500).json({ error: "Could not check assigned classes." });
  if (count)
    return res
      .status(409)
      .json({
        error:
          "Reassign or delete this faculty member’s active classes before deleting their account.",
      });
  const { data: live, error: liveError } = await supabaseAdmin
    .from("attendance_sessions")
    .select("id")
    .eq("faculty_id", req.params.id)
    .eq("status", "ACTIVE")
    .limit(1);
  if (liveError)
    return res
      .status(500)
      .json({ error: "Could not check attendance sessions." });
  if (live?.length)
    return res
      .status(409)
      .json({
        error: "End active attendance sessions before deleting this account.",
      });
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("role", "faculty");
  if (error)
    return res.status(500).json({ error: "Could not delete faculty access." });
  // RLS and middleware immediately enforce the archived flag, including existing sessions.
  const banned = await supabaseAdmin.auth.admin.updateUserById(p.user_id, {
    ban_duration: "876000h",
  });
  return res.json({
    success: true,
    archived: true,
    authBanApplied: !banned.error,
  });
});
router.post("/faculty/:id/restore", requireRole("admin"), async (req, res) => {
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("id", req.params.id)
    .eq("role", "faculty")
    .maybeSingle();
  if (!p) return res.status(404).json({ error: "Faculty not found." });
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    p.user_id,
    { ban_duration: "none" },
  );
  if (authError)
    return res
      .status(500)
      .json({
        error: "Could not restore authentication. Retry or check Supabase.",
      });
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ archived_at: null })
    .eq("id", req.params.id)
    .eq("role", "faculty");
  if (error)
    return res
      .status(500)
      .json({ error: "Could not restore profile access. Retry." });
  return res.json({ success: true });
});
export default router;
