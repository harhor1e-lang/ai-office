const MODEL = "@cf/zai-org/glm-4.7-flash";
const DEFAULT_ORIGIN = "https://harhor1e-lang.github.io";

function json(data, status = 200, origin = DEFAULT_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      "access-control-allow-headers": "Authorization,Content-Type",
      "vary": "Origin",
      "cache-control": "no-store"
    }
  });
}
function getOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
  return origin === allowed ? origin : "";
}
function authorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(env.ADMIN_TOKEN && supplied.length === env.ADMIN_TOKEN.length &&
    timingSafeEqual(supplied, env.ADMIN_TOKEN));
}
function timingSafeEqual(a, b) {
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
async function makePlan(env, brief) {
  const system = `You are the project director of ALI AI COMPANY. Turn the user's request into a realistic, ordered project plan. Return ONLY valid JSON, no markdown, with this exact shape:
{"title":"short project title","tasks":[{"title":"short task title","department":"department","description":"specific work and verifiable acceptance criteria"}]}
Create 3 to 8 sequential tasks. Each task must have a concrete deliverable and clear acceptance criteria. Use Arabic. Departments may include الإدارة، البرمجة، تطوير الويب، التطبيقات، التصميم، Blender، البحث، البيانات، الاختبار، الجودة، المحتوى. Do not claim tasks are already executed. Do not request passwords, API keys, or secrets.`;
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: brief }
    ],
    max_tokens: 2200,
    temperature: 0.2
  });
  const raw = result?.response || result?.output_text || "";
  const cleaned = raw.trim().replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/, "").trim();
  let plan;
  try { plan = JSON.parse(cleaned); }
  catch { throw new Error("تعذر قراءة خطة النموذج. أعد صياغة الطلب وحاول مجدداً."); }
  if (!Array.isArray(plan.tasks)) throw new Error("النموذج لم يرجع قائمة مهام صحيحة.");
  const tasks = plan.tasks.slice(0, 8).map(t => ({
    title: String(t.title || "").trim().slice(0, 180),
    department: String(t.department || "الإدارة").trim().slice(0, 80),
    description: String(t.description || "").trim().slice(0, 1500)
  })).filter(t => t.title && t.description);
  if (tasks.length < 3) throw new Error("الخطة الناتجة غير مكتملة. أعد المحاولة.");
  return { title: String(plan.title || "مشروع جديد").trim().slice(0, 160), tasks };
}

export default {
  async fetch(request, env) {
    const origin = getOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
        "access-control-allow-headers": "Authorization,Content-Type",
        "access-control-max-age": "86400",
        "vary": "Origin"
      }});
    }
    if (!origin) return json({ error: "Origin not allowed" }, 403, "null");
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({ service: "ALI AI COMPANY Cloud Engine", status: "online", model: MODEL, database: "connected" }, 200, origin);
      }
      if (!authorized(request, env)) return json({ error: "رمز المدير غير صحيح أو غير مضبوط." }, 401, origin);

      if (url.pathname === "/api/projects/plan" && request.method === "POST") {
        const body = await readJson(request);
        const brief = String(body?.brief || "").trim();
        if (brief.length < 8 || brief.length > 5000)
          return json({ error: "اكتب وصفاً من 8 إلى 5000 حرف." }, 400, origin);
        const plan = await makePlan(env, brief);
        const projectId = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO projects (id,title,description,status,created_at) VALUES(?,?,?,?,?)"
        ).bind(projectId, plan.title, brief, "planned", now).run();
        const statements = plan.tasks.map(task => env.DB.prepare(
          "INSERT INTO tasks (id,project_id,title,department,description,status,created_at) VALUES(?,?,?,?,?,?,?)"
        ).bind(crypto.randomUUID(), projectId, task.title, task.department, task.description, "pending", now));
        if (statements.length) await env.DB.batch(statements);
        await env.DB.prepare(
          "INSERT INTO activity_log (id,project_id,actor,action,details,created_at) VALUES(?,?,?,?,?,?)"
        ).bind(crypto.randomUUID(), projectId, "المدير التنفيذي", "إنشاء مشروع", `تم حفظ المشروع: ${plan.title} — ${plan.tasks.length} مهام`, now).run();
        return json({
          project_id: projectId, title: plan.title, status: "planned",
          message: "تم إنشاء خطة المشروع وحفظها في قاعدة البيانات السحابية. لم يبدأ التنفيذ الآلي للملفات بعد.",
          tasks: plan.tasks
        }, 201, origin);
      }

      if (url.pathname === "/api/projects" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id,title,description,status,created_at FROM projects ORDER BY created_at DESC LIMIT 50"
        ).all();
        return json(results || [], 200, origin);
      }

      const taskMatch = url.pathname.match(/^\/api\/projects\/([a-f0-9-]+)\/tasks$/i);
      if (taskMatch && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id,project_id,title,department,description,status,result,created_at FROM tasks WHERE project_id=? ORDER BY created_at,id"
        ).bind(taskMatch[1]).all();
        return json(results || [], 200, origin);
      }

      const updateMatch = url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)$/i);
      if (updateMatch && request.method === "PATCH") {
        const body = await readJson(request);
        const statuses = ["pending", "in_progress", "review", "completed", "blocked"];
        if (!statuses.includes(body?.status)) return json({ error: "حالة المهمة غير صالحة." }, 400, origin);
        const result = String(body?.result || "").slice(0, 5000);
        const updated = await env.DB.prepare(
          "UPDATE tasks SET status=?, result=? WHERE id=?"
        ).bind(body.status, result, updateMatch[1]).run();
        if (!updated.meta?.changes) return json({ error: "المهمة غير موجودة." }, 404, origin);
        return json({ ok: true, id: updateMatch[1], status: body.status }, 200, origin);
      }
      return json({ error: "المسار غير موجود." }, 404, origin);
    } catch (error) {
      return json({ error: error?.message || "حدث خطأ في محرك الشركة." }, 500, origin);
    }
  }
};
