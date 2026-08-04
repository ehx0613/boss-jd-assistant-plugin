import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
loadEnv(path.join(projectDir, ".env"));

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.DASHSCOPE_API_KEY || "";
const BASE_URL = trimSlash(process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1");
const TEXT_MODEL = process.env.QWEN_TEXT_MODEL || "qwen-plus";
const VL_MODEL = process.env.QWEN_VL_MODEL || "qwen-vl-plus";

const LABELS = {
  concise: "\u7b80\u6d01\u7248",
  professional: "\u4e13\u4e1a\u7248",
  proactive: "\u4e3b\u52a8\u6c9f\u901a\u7248"
};

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, provider: "qwen", textModel: TEXT_MODEL, vlModel: VL_MODEL });
      return;
    }

    if (req.method === "POST" && req.url === "/api/greetings/generate") {
      requireApiKey();
      const body = await readJson(req);
      sendJson(res, 200, await generateGreetings(body));
      return;
    }

    if (req.method === "POST" && req.url === "/api/greetings/copy-event") {
      await readJson(req);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && req.url === "/api/jobs/recognize-image") {
      requireApiKey();
      const body = await readJson(req);
      sendJson(res, 200, await recognizeJobFromImage(body));
      return;
    }

    if (req.method === "POST" && req.url === "/api/resume/extract") {
      const body = await readJson(req);
      sendJson(res, 200, await extractResumeText(body));
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Boss JD assistant server running at http://127.0.0.1:${PORT}`);
});

async function generateGreetings({ jobContext, resumeText, tone = "default" }) {
  const title = String(jobContext?.jobTitle || "");
  const company = String(jobContext?.companyName || "");
  const jd = String(jobContext?.jobDescription || "");
  const resume = String(resumeText || "");

  if (!jd.trim()) throw new Error("Missing job description.");
  if (!resume.trim()) throw new Error("Missing resume text.");

  const prompt = `
You are a Chinese job-application communication assistant.
Generate first-contact messages for Boss Zhipin in Simplified Chinese.

Critical source-separation rules:
1. Before writing, mentally classify resume evidence into:
   - internship/work experience
   - campus/course project
   - personal/research project
   - education/skills
2. Never merge different source types into one work scene.
3. Never describe a campus/course/personal project as an internship or company work.
4. If using multiple source types, state them separately, for example:
   - "In my internship, I worked on ..."
   - "In a campus/project experience, I built ..."
5. Do not imply that all listed projects happened at the same company.
6. Prefer internship/work evidence for collaboration, product documentation, stakeholder communication, or business delivery.
7. Use campus/project evidence only as project/technical evidence unless the resume explicitly says it was internship/work.

Target output style:
Imitate this structure and density. It should be one complete paragraph, suitable for copying directly into Boss Zhipin:
"您好，我是[姓名]，[学校/专业/年级]，想投递[岗位名称]。此前在[实习/工作]中参与[2-4项真实工作内容]。项目方面，我做过[2-3个项目/能力证据]，熟悉[3-6项与JD相关的能力]。岗位中提到的[JD关键词1]、[JD关键词2]、[JD关键词3]，与我的经历比较匹配；我可[到岗时间/实习周期，如简历或JD有明确依据]，期待进一步沟通。"

Writing rules:
1. Output natural Simplified Chinese, not AI-template language.
2. Each message should be one paragraph, 260-420 Chinese characters.
3. Start with identity: name if present, school/major/degree/year if present, and target job title.
4. Then mention internship/work evidence first. Keep it separate from project evidence.
5. Then mention project evidence with "项目方面" or similar wording.
6. Then explicitly map to JD keywords such as requirement intake, communication, prototype/design, documentation, testing, acceptance, feedback, cross-role collaboration, AI tools, data analysis.
7. End with availability if resume or JD provides it, then a short expectation to communicate.
8. Do not exaggerate missing experience, years, title, employer, industry background, or ownership.
9. Avoid empty phrases like broad platform, valuable opportunity, or I sincerely hope.
10. Be polite and direct. Do not over-sell.
11. Strictly output JSON only. No Markdown.

Job title: ${title || "unknown"}
Company: ${company || "unknown"}
Preferred tone: ${tone}

Job JD:
${jd}

Candidate resume:
${resume}

Return JSON:
{
  "matched_points": [
    "[source: internship/work|campus/project|education/skills] match point",
    "[source: internship/work|campus/project|education/skills] match point"
  ],
  "quality_warning": "",
  "variants": [
    {"label": "${LABELS.concise}", "text": "shorter but still follows the target paragraph structure"},
    {"label": "${LABELS.professional}", "text": "closest to the target example, with stronger JD matching"},
    {"label": "${LABELS.proactive}", "text": "same structure, slightly more proactive ending"}
  ]
}
`;

  const data = await callQwen({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You output strict JSON only. All final user-facing message text must be in Simplified Chinese. Preserve resume source boundaries."
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.35
  });

  const parsed = parseJsonObject(data?.choices?.[0]?.message?.content || "");

  return {
    matchedPoints: normalizeMatchedPoints(parsed.matched_points),
    qualityWarning: String(parsed.quality_warning || ""),
    variants: normalizeVariants(parsed.variants)
  };
}

async function recognizeJobFromImage({ imageDataUrl }) {
  if (!String(imageDataUrl || "").startsWith("data:image/")) {
    throw new Error("Missing valid screenshot.");
  }

  const data = await callQwen({
    model: VL_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract job information from this Boss Zhipin screenshot.
Keep only recruiting content such as responsibilities, job description, requirements, qualifications, internship arrangement, and location.
Do not include company history, group introduction, business introduction, investor information, or registration information.
If both responsibilities and requirements are visible, include both sections completely.
If requirements are not visible in the screenshot, do not invent them and set warning to "requirements_not_visible".
If responsibilities are not visible in the screenshot, do not invent them and set warning to "responsibilities_not_visible".

Return JSON only:
{
  "job_title": "",
  "company_name": "",
  "job_description": "",
  "quality": "usable|low_quality|failed",
  "warning": ""
}

If the screenshot does not include job responsibilities, job description, requirements, or qualifications, set quality to "failed".`
          },
          {
            type: "image_url",
            image_url: { url: imageDataUrl }
          }
        ]
      }
    ],
    temperature: 0.2
  });

  const parsed = parseJsonObject(data?.choices?.[0]?.message?.content || "");

  const jobDescription = trimRecruitingText(parsed.job_description || "");

  return {
    jobTitle: parsed.job_title || "",
    companyName: parsed.company_name || "",
    jobDescription,
    quality: parsed.quality || "failed",
    warning: parsed.warning || buildRecognitionWarning(jobDescription)
  };
}

async function extractResumeText({ fileName, mimeType, fileDataUrl }) {
  const name = String(fileName || "resume").toLowerCase();
  const buffer = parseDataUrl(fileDataUrl);
  const maxBytes = 10 * 1024 * 1024;

  if (buffer.length > maxBytes) {
    throw new Error("Resume file is too large. Use a PDF, DOCX, or TXT file under 10MB.");
  }

  let text = "";
  if (name.endsWith(".pdf") || mimeType === "application/pdf") {
    text = await extractPdfText(buffer);
  } else if (name.endsWith(".docx")) {
    text = await extractDocxText(buffer);
  } else if (name.endsWith(".txt") || String(mimeType || "").startsWith("text/")) {
    text = buffer.toString("utf8");
  } else if (name.endsWith(".doc")) {
    throw new Error("Legacy .doc files are not supported. Save as .docx or PDF first.");
  } else {
    throw new Error("Only PDF, DOCX, and TXT resume files are supported.");
  }

  const extracted = cleanExtractedText(text);
  if (extracted.length < 30) {
    throw new Error("Could not extract enough resume text from this file.");
  }

  return { resumeText: extracted, fileName, source: "upload" };
}

async function extractPdfText(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boss-jd-resume-"));
  const inputPath = path.join(dir, "resume.pdf");
  const outputPath = path.join(dir, "resume.txt");

  try {
    fs.writeFileSync(inputPath, buffer);
    await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", inputPath, outputPath]);
    return fs.readFileSync(outputPath, "utf8");
  } finally {
    safeRmDir(dir);
  }
}

async function extractDocxText(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boss-jd-resume-"));
  const inputPath = path.join(dir, "resume.docx");
  const unzipDir = path.join(dir, "unzipped");

  try {
    fs.writeFileSync(inputPath, buffer);
    fs.mkdirSync(unzipDir);
    await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($args[0], $args[1])",
      inputPath,
      unzipDir
    ]);

    const documentXmlPath = path.join(unzipDir, "word", "document.xml");
    if (!fs.existsSync(documentXmlPath)) {
      throw new Error("Could not find Word document body.");
    }

    return docxXmlToText(fs.readFileSync(documentXmlPath, "utf8"));
  } finally {
    safeRmDir(dir);
  }
}

async function callQwen(payload) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Qwen API call failed: ${response.status} ${text.slice(0, 300)}`);
  }

  return JSON.parse(text);
}

function normalizeMatchedPoints(points) {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 4).map((point) => {
    if (typeof point === "string") return point;
    if (point && typeof point === "object") {
      return [point.source, point.text || point.point || point.match].filter(Boolean).join(" ");
    }
    return String(point || "");
  });
}

function normalizeVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants
    .filter((item) => item && item.text)
    .slice(0, 4)
    .map((item, index) => ({
      id: `variant-${index + 1}`,
      label: String(item.label || `Version ${index + 1}`),
      text: String(item.text || "").trim()
    }));
}

function docxXmlToText(xml) {
  return String(xml)
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<w:tab\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function trimRecruitingText(value) {
  const text = cleanExtractedText(value);
  if (!text) return "";

  const startMarkers = [
    "\u5c97\u4f4d\u804c\u8d23",
    "\u804c\u4f4d\u63cf\u8ff0",
    "\u5de5\u4f5c\u804c\u8d23",
    "\u4efb\u804c\u8981\u6c42",
    "\u4efb\u804c\u8d44\u683c",
    "\u5c97\u4f4d\u8981\u6c42"
  ];
  const endMarkers = [
    "\u516c\u53f8\u4ecb\u7ecd",
    "\u516c\u53f8\u7b80\u4ecb",
    "\u5de5\u5546\u4fe1\u606f",
    "\u5173\u4e8e\u6211\u4eec",
    "\u6210\u7acb\u65f6\u95f4",
    "\u516c\u53f8\u7f51\u5740",
    "\u516c\u53f8\u4e1a\u52a1"
  ];

  const starts = startMarkers
    .map((marker) => text.indexOf(marker))
    .filter((index) => index >= 0);
  const start = starts.length ? Math.min(...starts) : 0;

  let end = text.length;
  for (const marker of endMarkers) {
    const index = text.indexOf(marker, Math.max(start + 40, 0));
    if (index >= 0) end = Math.min(end, index);
  }

  return cleanExtractedText(text.slice(start, end));
}

function buildRecognitionWarning(jobDescription) {
  const text = String(jobDescription || "");
  const hasDuty =
    text.includes("\u5c97\u4f4d\u804c\u8d23") ||
    text.includes("\u804c\u4f4d\u63cf\u8ff0") ||
    text.includes("\u5de5\u4f5c\u804c\u8d23");
  const hasRequirement =
    text.includes("\u4efb\u804c\u8981\u6c42") ||
    text.includes("\u4efb\u804c\u8d44\u683c") ||
    text.includes("\u5c97\u4f4d\u8981\u6c42");
  if (!hasDuty) return "responsibilities_not_visible";
  if (!hasRequirement) return "requirements_not_visible";
  return "";
}

function parseJsonObject(content) {
  const raw = String(content || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return valid JSON.");
    return JSON.parse(match[0]);
  }
}

function requireApiKey() {
  if (!API_KEY) {
    throw new Error("Missing DASHSCOPE_API_KEY. Configure .env first.");
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16 * 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function parseDataUrl(value) {
  const text = String(value || "");
  const match = text.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error("Invalid file data.");
  return Buffer.from(match[1], "base64");
}

function cleanExtractedText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function execFileAsync(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function safeRmDir(dir) {
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(path.resolve(os.tmpdir()))) return;
  fs.rmSync(resolved, { recursive: true, force: true });
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function trimSlash(value) {
  return String(value).replace(/\/+$/, "");
}
