chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type !== "EXTRACT_JOB") return false;

  try {
    sendResponse({ ok: true, job: extractJobFromPage() });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Job extraction failed."
    });
  }

  return false;
});

const MARKERS = {
  duty: "\u5c97\u4f4d\u804c\u8d23",
  jobDesc: "\u804c\u4f4d\u63cf\u8ff0",
  workDuty: "\u5de5\u4f5c\u804c\u8d23",
  requirement: "\u4efb\u804c\u8981\u6c42",
  qualification: "\u4efb\u804c\u8d44\u683c",
  jobRequirement: "\u5c97\u4f4d\u8981\u6c42",
  bonus: "\u52a0\u5206\u9879",
  companyIntro: "\u516c\u53f8\u4ecb\u7ecd",
  companyProfile: "\u516c\u53f8\u7b80\u4ecb",
  businessInfo: "\u5de5\u5546\u4fe1\u606f",
  aboutUs: "\u5173\u4e8e\u6211\u4eec",
  welfare: "\u804c\u4f4d\u798f\u5229"
};

function extractJobFromPage() {
  const jobTitle = firstReasonableText([
    ".job-title",
    ".job-banner .name",
    ".job-primary .info-primary .name",
    ".info-primary .name",
    "h1"
  ]);

  const companyName = firstReasonableText([
    ".company-info .name",
    ".company-name",
    ".sider-company .company-name",
    ".job-primary .info-company",
    ".info-company"
  ]);

  const rawJobDescription =
    findBossJobDetailText() ||
    firstReasonableText([
      ".job-sec-text",
      ".job-detail",
      ".detail-content",
      ".job-description",
      ".job-detail-section",
      ".job-detail-container"
    ]) ||
    findLikelyJobDescription();

  const jobDescription = trimJobDescription(rawJobDescription);

  if (!jobDescription || jobDescription.length < 30) {
    throw new Error("No enough job JD text found.");
  }

  return {
    jobTitle: cleanTitle(jobTitle),
    companyName: cleanCompany(companyName),
    jobDescription,
    source: "dom",
    recognizedAt: new Date().toISOString()
  };
}

function findBossJobDetailText() {
  const headingMarkers = [
    MARKERS.duty,
    MARKERS.jobDesc,
    MARKERS.workDuty,
    MARKERS.requirement,
    MARKERS.qualification,
    MARKERS.jobRequirement
  ];

  const candidates = [...document.querySelectorAll("section, article, div, main")]
    .map((node) => ({
      node,
      text: cleanText(node.innerText || node.textContent || "")
    }))
    .filter(({ text }) => text.length >= 80 && text.length <= 12000)
    .map(({ node, text }) => ({
      node,
      text,
      score: scoreJobText(text)
    }))
    .filter(({ text, score }) => score > 0 && headingMarkers.some((marker) => text.includes(marker)))
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta) return scoreDelta;
      return a.text.length - b.text.length;
    });

  return candidates[0]?.text || "";
}

function firstReasonableText(selectors) {
  for (const selector of selectors) {
    const nodes = [...document.querySelectorAll(selector)];
    for (const node of nodes) {
      const cleaned = cleanText(node.innerText || node.textContent || "");
      if (cleaned.length > 1 && cleaned.length < 8000) return cleaned;
    }
  }
  return "";
}

function findLikelyJobDescription() {
  const blocks = [...document.querySelectorAll("section, article, div, main, body")]
    .map((node) => cleanText(node.innerText || node.textContent || ""))
    .filter((text) => text.length >= 80 && text.length <= 20000);

  const scored = blocks
    .map((text) => ({ text, score: scoreJobText(text) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.text.length - b.text.length);

  return scored[0]?.text || "";
}

function scoreJobText(text) {
  let score = 0;
  const positive = [
    MARKERS.duty,
    MARKERS.jobDesc,
    MARKERS.workDuty,
    MARKERS.requirement,
    MARKERS.qualification,
    MARKERS.jobRequirement,
    MARKERS.bonus
  ];
  const negative = [
    MARKERS.companyIntro,
    MARKERS.companyProfile,
    MARKERS.businessInfo,
    MARKERS.aboutUs
  ];

  for (const marker of positive) {
    if (text.includes(marker)) score += 3;
  }
  for (const marker of negative) {
    if (text.includes(marker)) score -= 2;
  }
  if (/\d+[\.、]\s*.+/.test(text)) score += 1;
  return score;
}

function trimJobDescription(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return "";

  const startMarkers = [
    MARKERS.duty,
    MARKERS.jobDesc,
    MARKERS.workDuty,
    MARKERS.requirement,
    MARKERS.qualification,
    MARKERS.jobRequirement
  ];
  const endMarkers = [
    MARKERS.companyIntro,
    MARKERS.companyProfile,
    MARKERS.businessInfo,
    MARKERS.aboutUs,
    "\u6210\u7acb\u65f6\u95f4",
    "\u516c\u53f8\u7f51\u5740",
    "\u878d\u8d44\u9636\u6bb5",
    "\u516c\u53f8\u89c4\u6a21",
    "\u5de5\u4f5c\u5730\u5740"
  ];

  const starts = startMarkers
    .map((marker) => cleaned.indexOf(marker))
    .filter((index) => index >= 0);
  const start = starts.length ? Math.min(...starts) : 0;

  let end = cleaned.length;
  for (const marker of endMarkers) {
    const index = cleaned.indexOf(marker, Math.max(start + 40, 0));
    if (index >= 0) end = Math.min(end, index);
  }

  return cleanText(cleaned.slice(start, end));
}

function cleanTitle(value) {
  const text = cleanText(value);
  const firstLine = text.split("\n").find(Boolean) || text;
  return firstLine.replace(/\s+\d+[-~]\d+.*$/, "").trim();
}

function cleanCompany(value) {
  const text = cleanText(value);
  const firstLine = text.split("\n").find(Boolean) || text;
  return firstLine.replace(/\s+\d+[-~]\d+.*$/, "").trim();
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
