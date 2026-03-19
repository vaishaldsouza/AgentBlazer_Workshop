import { jsPDF } from "jspdf";

// ── Markdown export ───────────────────────────────────────
export function exportMarkdown(question, stage1Data, stage2Data, stage3Data) {
  const lines = [];
  const ts = new Date().toLocaleString();

  lines.push(`# LLM Council Report`);
  lines.push(`_Generated: ${ts}_`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Question`);
  lines.push(``);
  lines.push(`> ${question}`);
  lines.push(``);

  // Stage 1
  if (stage1Data?.length) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Stage 1 — Independent Opinions`);
    lines.push(``);
    for (const r of stage1Data) {
      lines.push(`### ${r.model_name}`);
      lines.push(``);
      lines.push(`**Reasoning**`);
      lines.push(``);
      lines.push(r.reasoning || "");
      lines.push(``);
      lines.push(`**Answer**`);
      lines.push(``);
      lines.push(r.answer || "");
      lines.push(``);
    }
  }

  // Stage 2
  if (stage2Data?.length) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Stage 2 — Peer Review`);
    lines.push(``);
    for (const rv of stage2Data) {
      lines.push(`### ${rv.reviewer_name}`);
      lines.push(``);
      lines.push(`**Critique**`);
      lines.push(``);
      lines.push(rv.critique || "");
      lines.push(``);
      lines.push(`**Ranking**`);
      lines.push(``);
      lines.push(rv.ranking || "");
      lines.push(``);
    }
  }

  // Stage 3
  if (stage3Data) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Stage 3 — Final Verdict`);
    lines.push(``);
    lines.push(`**Summary**`);
    lines.push(``);
    lines.push(stage3Data.summary || "");
    lines.push(``);
    lines.push(`**Verdict**`);
    lines.push(``);
    lines.push(stage3Data.verdict || "");
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`_LLM Council · AgentBlazer Workshop_`);

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `council-report-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export ────────────────────────────────────────────
export function exportPDF(question, stage1Data, stage2Data, stage3Data) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxW = pageW - margin * 2;
  let y = margin;

  // ── helpers ──────────────────────────────────────────
  function checkPage(needed = 10) {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function drawPageHeader() {
    doc.setFillColor(10, 10, 15);
    doc.rect(0, 0, pageW, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 114);
    doc.text("LLM COUNCIL  ·  AgentBlazer Workshop", margin, 7);
    doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageW - margin, 7, { align: "right" });
  }

  function heading1(text) {
    checkPage(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 217, 255);
    doc.text(text, margin, y);
    y += 8;
  }

  function heading2(text) {
    checkPage(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(167, 139, 250);
    doc.text(text, margin, y);
    y += 2;
    doc.setDrawColor(167, 139, 250);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  }

  function heading3(text) {
    checkPage(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(245, 200, 66);
    doc.text(text, margin, y);
    y += 5;
  }

  function label(text) {
    checkPage(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 114);
    doc.text(text.toUpperCase(), margin, y);
    y += 4;
  }

  function body(text) {
    if (!text) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 210);
    // Strip markdown symbols for clean PDF rendering
    const clean = text
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`{1,3}([\s\S]*?)`{1,3}/g, "$1")
      .replace(/^\s*[-*+]\s/gm, "• ")
      .replace(/^\s*\d+\.\s/gm, "  ");
    const wrapped = doc.splitTextToSize(clean.trim(), maxW);
    for (const line of wrapped) {
      checkPage(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 2;
  }

  function divider() {
    checkPage(6);
    doc.setDrawColor(42, 42, 53);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  }

  function spacer(n = 4) { y += n; }

  // ── Cover block ───────────────────────────────────────
  // Dark header bar
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, pageW, 40, "F");
  doc.setFillColor(0, 217, 255);
  doc.rect(0, 40, pageW, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(0, 217, 255);
  doc.text("[ LLM COUNCIL ]", margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(144, 144, 168);
  doc.text("Multi-model reasoning report", margin, 26);
  doc.text(new Date().toLocaleString(), margin, 33);

  y = 52;

  // Question box
  doc.setFillColor(17, 17, 24);
  doc.setDrawColor(0, 217, 255);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, maxW, 20, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 217, 255);
  doc.text("QUESTION", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(232, 232, 240);
  const qWrapped = doc.splitTextToSize(question, maxW - 8);
  doc.text(qWrapped[0] || question, margin + 4, y + 13);
  y += 28;

  drawPageHeader();

  // ── Stage 1 ───────────────────────────────────────────
  if (stage1Data?.length) {
    heading2("Stage 1 — Independent Opinions");
    for (const r of stage1Data) {
      heading3(r.model_name);
      label("Reasoning");
      body(r.reasoning);
      label("Answer");
      body(r.answer);
      spacer(2);
    }
    divider();
  }

  // ── Stage 2 ───────────────────────────────────────────
  if (stage2Data?.length) {
    heading2("Stage 2 — Peer Review");
    for (const rv of stage2Data) {
      heading3(rv.reviewer_name);
      label("Critique");
      body(rv.critique);
      label("Ranking");
      body(rv.ranking);
      spacer(2);
    }
    divider();
  }

  // ── Stage 3 ───────────────────────────────────────────
  if (stage3Data) {
    heading2("Stage 3 — Final Verdict");
    label("Summary");
    body(stage3Data.summary);
    spacer(2);
    label("Final Verdict");
    body(stage3Data.verdict);
  }

  // ── Footer on every page ──────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageHeader();
    doc.setFillColor(10, 10, 15);
    doc.rect(0, pageH - 8, pageW, 8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 114);
    doc.text("AgentBlazer Workshop  ·  LLM Council Report", margin, pageH - 3);
    doc.text(`${i} / ${totalPages}`, pageW - margin, pageH - 3, { align: "right" });
  }

  doc.save(`council-report-${Date.now()}.pdf`);
}

