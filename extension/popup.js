const SERVER_BASE = "http://127.0.0.1:8787";

const TEXT = {
  resumeSaved: "\u7b80\u5386\u5df2\u4fdd\u5b58\u5230\u672c\u5730",
  chooseResume: "\u8bf7\u5148\u9009\u62e9 PDF\u3001DOCX \u6216 TXT \u7b80\u5386\u6587\u4ef6",
  readingResume: "\u6b63\u5728\u8bc6\u522b\u7b80\u5386\u6587\u4ef6...",
  noResumeText: "\u6ca1\u6709\u4ece\u6587\u4ef6\u4e2d\u8bc6\u522b\u5230\u7b80\u5386\u6587\u672c",
  recognizingJob: "\u6b63\u5728\u8bc6\u522b\u5c97\u4f4d...",
  jobRecognized: "\u5c97\u4f4d\u8bc6\u522b\u6210\u529f\uff0c\u53ef\u7f16\u8f91 JD \u540e\u751f\u6210",
  tryScreenshot: "\u53ef\u4ee5\u5c1d\u8bd5\u622a\u56fe\u8bc6\u522b",
  screenshotReading: "\u6b63\u5728\u622a\u56fe\u5e76\u8bc6\u522b...",
  screenshotFailed: "\u622a\u56fe\u4e2d\u672a\u8bc6\u522b\u5230\u6709\u6548 JD",
  screenshotOk: "\u622a\u56fe\u8bc6\u522b\u6210\u529f\uff0c\u53ef\u7f16\u8f91 JD \u540e\u751f\u6210",
  screenshotMerged: "\u5df2\u5c06\u622a\u56fe\u5185\u5bb9\u5408\u5e76\u5230\u5f53\u524d JD",
  missingRequirements:
    "\u622a\u56fe\u672a\u8986\u76d6\u4efb\u804c\u8981\u6c42\uff0c\u5efa\u8bae\u6eda\u52a8\u5230\u5b8c\u6574 JD \u540e\u518d\u622a\u56fe\uff0c\u6216\u4f18\u5148\u70b9\u51fb\u8bc6\u522b\u5c97\u4f4d",
  missingResponsibilities:
    "\u622a\u56fe\u672a\u8986\u76d6\u5c97\u4f4d\u804c\u8d23\uff0c\u53ef\u518d\u6eda\u52a8\u5230\u5c97\u4f4d\u804c\u8d23\u533a\u57df\u622a\u56fe\u4e00\u6b21\uff0c\u63d2\u4ef6\u4f1a\u81ea\u52a8\u5408\u5e76",
  needJd: "\u8bf7\u5148\u8bc6\u522b\u6216\u586b\u5199\u5c97\u4f4d JD",
  needResume: "\u8bf7\u5148\u7c98\u8d34\u6216\u4e0a\u4f20\u7b80\u5386\u5185\u5bb9",
  generating: "\u6b63\u5728\u751f\u6210\u8bdd\u672f...",
  generated: "\u5df2\u751f\u6210\uff0c\u53ef\u9009\u62e9\u4e00\u4e2a\u7248\u672c\u590d\u5236",
  noVariants: "\u6ca1\u6709\u751f\u6210\u53ef\u7528\u8bdd\u672f\uff0c\u8bf7\u8865\u5145 JD \u6216\u7b80\u5386\u540e\u91cd\u8bd5\u3002",
  matchedPoints: "\u5339\u914d\u70b9",
  warning: "\u63d0\u793a",
  copy: "\u590d\u5236",
  copyFailed: "\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u624b\u52a8\u9009\u62e9\u6587\u5b57\u590d\u5236",
  copied: "\u5df2\u590d\u5236",
  fileReadFailed: "\u8bfb\u53d6\u6587\u4ef6\u5931\u8d25",
  noActiveTab: "\u672a\u627e\u5230\u5f53\u524d\u6807\u7b7e\u9875",
  requestFailed: "\u8bf7\u6c42\u5931\u8d25",
  operationFailed: "\u64cd\u4f5c\u5931\u8d25"
};

const els = {
  status: document.querySelector("#statusText"),
  recognizeBtn: document.querySelector("#recognizeBtn"),
  screenshotBtn: document.querySelector("#screenshotBtn"),
  saveResumeBtn: document.querySelector("#saveResumeBtn"),
  uploadResumeBtn: document.querySelector("#uploadResumeBtn"),
  generateBtn: document.querySelector("#generateBtn"),
  resumeFile: document.querySelector("#resumeFile"),
  jobTitle: document.querySelector("#jobTitle"),
  companyName: document.querySelector("#companyName"),
  jobDescription: document.querySelector("#jobDescription"),
  resumeText: document.querySelector("#resumeText"),
  toneSelect: document.querySelector("#toneSelect"),
  matchedPoints: document.querySelector("#matchedPoints"),
  results: document.querySelector("#results")
};

init();

function init() {
  restoreResume();
  els.recognizeBtn.addEventListener("click", recognizeJob);
  els.screenshotBtn.addEventListener("click", recognizeScreenshot);
  els.saveResumeBtn.addEventListener("click", saveResume);
  els.uploadResumeBtn.addEventListener("click", uploadResumeFile);
  els.generateBtn.addEventListener("click", generateGreetings);
}

async function restoreResume() {
  const data = await chrome.storage.local.get(["resumeText"]);
  els.resumeText.value = data.resumeText || "";
}

async function saveResume() {
  await chrome.storage.local.set({ resumeText: els.resumeText.value.trim() });
  setStatus(TEXT.resumeSaved);
}

async function uploadResumeFile() {
  const file = els.resumeFile.files?.[0];
  if (!file) {
    setStatus(TEXT.chooseResume);
    return;
  }

  setBusy(true, TEXT.readingResume);
  try {
    const fileDataUrl = await readFileAsDataUrl(file);
    const result = await postJson("/api/resume/extract", {
      fileName: file.name,
      mimeType: file.type,
      fileDataUrl
    });

    if (!result.resumeText) throw new Error(TEXT.noResumeText);

    els.resumeText.value = result.resumeText;
    await chrome.storage.local.set({ resumeText: result.resumeText });
    setStatus(`${TEXT.resumeSaved}: ${file.name}`);
  } catch (error) {
    setStatus(getErrorMessage(error));
  } finally {
    setBusy(false);
  }
}

async function recognizeJob() {
  setBusy(true, TEXT.recognizingJob);
  try {
    const tab = await getActiveTab();
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB" });

    if (!response?.ok) {
      throw new Error(response?.error || TEXT.requestFailed);
    }

    applyJob(response.job);
    setStatus(TEXT.jobRecognized);
  } catch (error) {
    setStatus(`${getErrorMessage(error)}. ${TEXT.tryScreenshot}`);
  } finally {
    setBusy(false);
  }
}

async function recognizeScreenshot() {
  setBusy(true, TEXT.screenshotReading);
  try {
    const response = await chrome.runtime.sendMessage({ type: "CAPTURE_VISIBLE_TAB" });
    if (!response?.ok) throw new Error(response?.error || TEXT.requestFailed);

    const result = await postJson("/api/jobs/recognize-image", {
      imageDataUrl: response.dataUrl
    });

    if (result.quality === "failed" || !result.jobDescription) {
      throw new Error(result.warning || TEXT.screenshotFailed);
    }

    const mergedDescription = mergeJobDescriptions(els.jobDescription.value, result.jobDescription);
    applyJob({
      jobTitle: result.jobTitle,
      companyName: result.companyName,
      jobDescription: mergedDescription,
      source: "screenshot",
      recognizedAt: new Date().toISOString()
    });

    setStatus(buildScreenshotStatus(result.warning, mergedDescription));
  } catch (error) {
    setStatus(getErrorMessage(error));
  } finally {
    setBusy(false);
  }
}

async function generateGreetings() {
  const resumeText = els.resumeText.value.trim();
  const jobDescription = els.jobDescription.value.trim();

  if (!jobDescription) {
    setStatus(TEXT.needJd);
    return;
  }

  if (!resumeText) {
    setStatus(TEXT.needResume);
    return;
  }

  setBusy(true, TEXT.generating);
  els.results.innerHTML = "";
  els.matchedPoints.classList.add("hidden");

  try {
    await chrome.storage.local.set({ resumeText });
    const result = await postJson("/api/greetings/generate", {
      jobContext: {
        jobTitle: els.jobTitle.value.trim(),
        companyName: els.companyName.value.trim(),
        jobDescription
      },
      resumeText,
      tone: els.toneSelect.value
    });

    renderMatchedPoints(result.matchedPoints, result.qualityWarning);
    renderResults(result.variants || []);
    setStatus(TEXT.generated);
  } catch (error) {
    setStatus(getErrorMessage(error));
  } finally {
    setBusy(false);
  }
}

function applyJob(job) {
  els.jobTitle.value = job?.jobTitle || "";
  els.companyName.value = job?.companyName || "";
  els.jobDescription.value = job?.jobDescription || "";
}

function mergeJobDescriptions(existing, incoming) {
  const current = normalizeJdText(existing);
  const next = normalizeJdText(incoming);
  if (!current) return next;
  if (!next) return current;
  if (current.includes(next)) return current;
  if (next.includes(current)) return next;

  const currentHasDuty = hasDutySection(current);
  const currentHasReq = hasRequirementSection(current);
  const nextHasDuty = hasDutySection(next);
  const nextHasReq = hasRequirementSection(next);

  if (currentHasDuty && !currentHasReq && nextHasReq) {
    return normalizeJdText(`${current}\n\n${next}`);
  }
  if (currentHasReq && !currentHasDuty && nextHasDuty) {
    return normalizeJdText(`${next}\n\n${current}`);
  }

  return normalizeJdText(`${current}\n\n${next}`);
}

function buildScreenshotStatus(warning, mergedDescription) {
  if (!hasDutySection(mergedDescription)) return TEXT.missingResponsibilities;
  if (!hasRequirementSection(mergedDescription)) return TEXT.missingRequirements;
  if (warning === "requirements_not_visible") return TEXT.screenshotMerged;
  if (warning === "responsibilities_not_visible") return TEXT.screenshotMerged;
  return warning || TEXT.screenshotMerged;
}

function hasDutySection(text) {
  return /岗位职责|职位描述|工作职责/.test(text || "");
}

function hasRequirementSection(text) {
  return /任职要求|任职资格|岗位要求/.test(text || "");
}

function normalizeJdText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderMatchedPoints(points = [], warning = "") {
  const lines = [];
  if (points.length) {
    lines.push(`<strong>${TEXT.matchedPoints}</strong>`);
    for (const point of points) {
      lines.push(`<div>${escapeHtml(point)}</div>`);
    }
  }
  if (warning) {
    lines.push(`<div><strong>${TEXT.warning}</strong>: ${escapeHtml(warning)}</div>`);
  }

  if (!lines.length) return;
  els.matchedPoints.innerHTML = lines.join("");
  els.matchedPoints.classList.remove("hidden");
}

function renderResults(variants) {
  if (!variants.length) {
    els.results.innerHTML = `<div class="result-card"><p class="result-text">${TEXT.noVariants}</p></div>`;
    return;
  }

  els.results.innerHTML = "";
  for (const item of variants) {
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-head">
        <div class="result-title">${escapeHtml(item.label)}</div>
        <button type="button" class="copy-btn">${TEXT.copy}</button>
      </div>
      <p class="result-text">${escapeHtml(item.text)}</p>
    `;
    card.querySelector(".copy-btn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(item.text);
        setStatus(`${TEXT.copied}: ${item.label}`);
        postJson("/api/greetings/copy-event", { variantId: item.id }).catch(() => {});
      } catch {
        setStatus(TEXT.copyFailed);
      }
    });
    els.results.appendChild(card);
  }
}

async function postJson(path, data) {
  const response = await fetch(`${SERVER_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || `${TEXT.requestFailed}: ${response.status}`);
  }
  return json;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(TEXT.fileReadFailed));
    reader.readAsDataURL(file);
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error(TEXT.noActiveTab);
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  }
}

function setBusy(isBusy, text) {
  els.recognizeBtn.disabled = isBusy;
  els.screenshotBtn.disabled = isBusy;
  els.uploadResumeBtn.disabled = isBusy;
  els.generateBtn.disabled = isBusy;
  if (text) setStatus(text);
}

function setStatus(text) {
  els.status.textContent = text;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : TEXT.operationFailed;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
