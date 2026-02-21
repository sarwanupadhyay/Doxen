import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Download,
  Send,
  RefreshCw,
  FileDown,
} from "lucide-react";
import type { GeneratedBRD, BRDSection } from "@/hooks/useBRD";
import type { ExtractedRequirement } from "@/hooks/useRequirements";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";

interface BRDViewerProps {
  brd: GeneratedBRD | null;
  projectName: string;
  requirements: ExtractedRequirement[];
  generating: boolean;
  refining: boolean;
  onGenerate: () => void;
  onRefine: (instruction: string) => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────
/** Strip all markdown syntax and return plain text */
const stripMarkdown = (text: string): string =>
  text
    .replace(/#{1,6}\s+/g, "")       // headings
    .replace(/\*\*(.+?)\*\*/gs, "$1") // bold
    .replace(/\*(.+?)\*/gs, "$1")     // italic
    .replace(/__(.+?)__/gs, "$1")     // bold alt
    .replace(/_(.+?)_/gs, "$1")       // italic alt
    .replace(/`(.+?)`/g, "$1")        // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
    .replace(/^\s*[-*+]\s+/gm, "• ")  // bullets → •
    .replace(/^\s*\d+\.\s+/gm, "• ")  // numbered → •
    .trim();

/** Detect if a line starts a heading */
const getHeadingLevel = (line: string): { level: number; text: string } | null => {
  const m = line.match(/^(#{1,6})\s+(.+)/);
  return m ? { level: m[1].length, text: m[2].trim() } : null;
};

/** Detect if a line is a bullet/numbered list item */
const isBulletLine = (line: string): boolean =>
  /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);

/** Strip bullet/number prefix from a line */
const getBulletText = (line: string): string =>
  line.replace(/^\s*[-*+]\s+/, "").replace(/^\s*\d+\.\s+/, "").trim();

/** Strip inline markdown from a single line */
const stripInline = (text: string): string =>
  text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();

// ── PDF Export Utility ────────────────────────────────────────────────────────
const exportToPDF = (brd: GeneratedBRD, projectName: string) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const ML = 18;          // left margin
  const MR = 18;          // right margin
  const MT = 22;          // top margin
  const MB = 22;          // bottom margin
  const CW = PAGE_W - ML - MR; // content width
  const LH = 6.5;         // base line height

  let y = MT;

  // ── page break guard ───────────────────────────────────────────────────────
  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MB) {
      doc.addPage();
      y = MT;
      return true;
    }
    return false;
  };

  // ── write a wrapped block of text ──────────────────────────────────────────
  const writeBlock = (
    text: string,
    x: number,
    maxW: number,
    fontSize: number,
    fontStyle: "normal" | "bold" | "italic" | "bolditalic",
    r: number, g: number, b: number,
    lineSpacing = LH
  ) => {
    if (!text.trim()) return;
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", fontStyle);
    doc.setTextColor(r, g, b);
    const lines: string[] = doc.splitTextToSize(text.trim(), maxW);
    lines.forEach((line: string) => {
      ensureSpace(lineSpacing);
      doc.text(line, x, y);
      y += lineSpacing;
    });
  };

  // ── draw a horizontal rule ─────────────────────────────────────────────────
  const drawRule = (xStart: number, width: number, r: number, g: number, b: number, thickness = 0.4) => {
    doc.setFillColor(r, g, b);
    doc.rect(xStart, y, width, thickness, "F");
    y += thickness + 2;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════════════════════════════════════

  // Deep navy header band
  doc.setFillColor(14, 18, 36);
  doc.rect(0, 0, PAGE_W, 90, "F");

  // Accent stripe at bottom of header
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 88, PAGE_W, 4, "F");

  // Doxen / app branding label
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 130, 160);
  doc.text("DOXEN  ·  AUTO BRD GENERATOR", ML, 14);

  // Cover title — centred in the band
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  const coverTitle = brd.content.title || projectName;
  const titleLines: string[] = doc.splitTextToSize(coverTitle, CW);
  let ty = 34;
  titleLines.forEach((line: string) => {
    doc.text(line, PAGE_W / 2, ty, { align: "center" });
    ty += 11;
  });

  // Sub-label
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 185, 200);
  doc.text("Business Requirements Document", PAGE_W / 2, ty + 3, { align: "center" });

  // ── meta row ──────────────────────────────────────────────────────────────
  const metaY = 100;
  const formattedDate = new Date(brd.content.generatedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const metaItems = [
    `v${brd.content.version}`,
    formattedDate,
    `${brd.content.sections.length} Sections`,
  ];

  let mx = ML;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  metaItems.forEach((item) => {
    const tw = (doc.getStringUnitWidth(item) * 8.5) / doc.internal.scaleFactor;
    const boxW = tw + 10;
    doc.setFillColor(240, 242, 248);
    doc.roundedRect(mx, metaY - 4, boxW, 7, 1.5, 1.5, "F");
    doc.setTextColor(50, 55, 75);
    doc.text(item, mx + 5, metaY + 1.2);
    mx += boxW + 4;
  });

  // ── Table of Contents ─────────────────────────────────────────────────────
  y = metaY + 18;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 22, 36);
  doc.text("Table of Contents", ML, y);
  y += 4;

  doc.setFillColor(220, 38, 38);
  doc.rect(ML, y, 38, 0.7, "F");
  y += 7;

  const sorted = [...brd.content.sections].sort((a, b) => a.order - b.order);

  sorted.forEach((section, idx) => {
    ensureSpace(8);
    // Row background alternating
    if (idx % 2 === 0) {
      doc.setFillColor(249, 249, 252);
      doc.rect(ML, y - 4.5, CW, 7, "F");
    }
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 32, 46);
    doc.text(`${idx + 1}.`, ML + 1, y);
    doc.text(section.title, ML + 9, y);
    doc.setTextColor(140, 145, 165);
    doc.text(`${idx + 2}`, PAGE_W - MR, y, { align: "right" });
    y += 8;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CONTENT PAGES — one page per section
  // ══════════════════════════════════════════════════════════════════════════
  sorted.forEach((section, idx) => {
    doc.addPage();
    y = MT;

    // ── Section header bar ─────────────────────────────────────────────────
    doc.setFillColor(14, 18, 36);
    doc.rect(0, 0, PAGE_W, 18, "F");

    // Section number chip
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(ML, 4, 9, 9, 1.5, 1.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`${idx + 1}`, ML + 4.5, 10, { align: "center" });

    // Section title in header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(section.title, ML + 13, 10);

    // Project name top-right
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 148, 175);
    doc.text(projectName, PAGE_W - MR, 10, { align: "right" });

    y = 28; // content starts below the header bar

    // ── Render section content line-by-line ────────────────────────────────
    const rawLines = section.content.split("\n");

    rawLines.forEach((rawLine) => {
      const line = rawLine; // keep original for detection

      // Skip empty lines — add small vertical gap
      if (!line.trim()) {
        y += 2.5;
        return;
      }

      // H1 / H2  →  sub-heading
      const h = getHeadingLevel(line);
      if (h) {
        if (h.level <= 2) {
          ensureSpace(12);
          y += 3;
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(14, 18, 36);
          const hLines: string[] = doc.splitTextToSize(h.text, CW);
          hLines.forEach((hl: string) => {
            ensureSpace(LH + 1);
            doc.text(hl, ML, y);
            y += LH + 1;
          });
          // Red underline
          doc.setFillColor(220, 38, 38);
          doc.rect(ML, y - 1, Math.min(CW, h.text.length * 2.5), 0.5, "F");
          y += 3;
        } else {
          // H3+
          ensureSpace(10);
          y += 2;
          doc.setFontSize(9.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(40, 44, 65);
          const hLines: string[] = doc.splitTextToSize(h.text, CW);
          hLines.forEach((hl: string) => {
            ensureSpace(LH);
            doc.text(hl, ML, y);
            y += LH;
          });
          y += 1;
        }
        return;
      }

      // Bullet / numbered list item
      if (isBulletLine(line)) {
        ensureSpace(LH + 1);
        const bulletText = stripInline(getBulletText(line));
        if (!bulletText) return;

        // Draw bullet dot
        doc.setFillColor(220, 38, 38);
        doc.circle(ML + 2, y - 1.5, 0.9, "F");

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(38, 40, 55);
        const bLines: string[] = doc.splitTextToSize(bulletText, CW - 8);
        bLines.forEach((bl: string, bi: number) => {
          if (bi > 0) ensureSpace(LH);
          doc.text(bl, ML + 6, y);
          y += LH;
        });
        y += 0.5;
        return;
      }

      // Horizontal rule  ---
      if (/^[-*_]{3,}\s*$/.test(line.trim())) {
        ensureSpace(5);
        y += 1;
        doc.setFillColor(210, 212, 225);
        doc.rect(ML, y, CW, 0.4, "F");
        y += 4;
        return;
      }

      // Plain paragraph line
      const text = stripInline(line);
      if (!text) return;

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(38, 40, 55);
      const pLines: string[] = doc.splitTextToSize(text, CW);
      pLines.forEach((pl: string) => {
        ensureSpace(LH);
        doc.text(pl, ML, y);
        y += LH;
      });
    });

    // ── Footer ─────────────────────────────────────────────────────────────
    doc.setFillColor(220, 38, 38);
    doc.rect(ML, PAGE_H - MB + 2, CW, 0.4, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 145, 165);
    doc.text(projectName, ML, PAGE_H - MB + 7);
    doc.text(
      `Section ${idx + 1} of ${sorted.length}  ·  v${brd.content.version}`,
      PAGE_W - MR, PAGE_H - MB + 7, { align: "right" }
    );
  });

  doc.save(`${projectName.replace(/\s+/g, "-")}-BRD-v${brd.content.version}.pdf`);
};

// ── Markdown Export Utility ───────────────────────────────────────────────────
/**
 * Converts raw markdown section content into clean, readable plain-text markdown.
 * Strips redundant characters, normalises headings, and preserves bold/bullets.
 */
const cleanSectionContent = (content: string): string =>
  content
    // Normalise excessive blank lines
    .replace(/\n{3,}/g, "\n\n")
    // Remove stray horizontal rules that aren't separators
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Strip inline code ticks that wrap entire lines
    .replace(/^`{3}.*$/gm, "")
    .replace(/^`{1}(.+)`{1}$/gm, "$1")
    // Normalise heading levels — promote all to ## or ###
    .replace(/^#{4,}\s+/gm, "### ")
    .replace(/^#{1}\s+/gm, "## ")
    .trim();

const exportToMarkdown = (brd: GeneratedBRD, projectName: string) => {
  const date = new Date(brd.content.generatedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  let out = "";

  // ── Document header ────────────────────────────────────────────────────────
  out += `# ${brd.content.title}\n\n`;
  out += `**Project:** ${projectName}  \n`;
  out += `**Version:** ${brd.content.version}  \n`;
  out += `**Generated:** ${date}  \n\n`;
  out += `---\n\n`;

  // ── Table of contents ──────────────────────────────────────────────────────
  out += `## Table of Contents\n\n`;
  brd.content.sections
    .sort((a, b) => a.order - b.order)
    .forEach((section, idx) => {
      out += `${idx + 1}. ${section.title}\n`;
    });
  out += `\n---\n\n`;

  // ── Sections ───────────────────────────────────────────────────────────────
  brd.content.sections
    .sort((a, b) => a.order - b.order)
    .forEach((section, idx) => {
      out += `## ${idx + 1}. ${section.title}\n\n`;
      out += `${cleanSectionContent(section.content)}\n\n`;
      out += `---\n\n`;
    });

  const blob = new Blob([out], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, "-")}-BRD-v${brd.content.version}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── Main Component ────────────────────────────────────────────────────────────
export const BRDViewer = ({
  brd,
  projectName,
  requirements,
  generating,
  refining,
  onGenerate,
  onRefine,
}: BRDViewerProps) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [refinementInput, setRefinementInput] = useState("");

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (brd?.content.sections) {
      setExpandedSections(new Set(brd.content.sections.map((s) => s.id)));
    }
  };

  const collapseAll = () => setExpandedSections(new Set());

  const handleRefine = () => {
    if (refinementInput.trim()) {
      onRefine(refinementInput.trim());
      setRefinementInput("");
    }
  };

  if (!brd) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">No BRD Generated Yet</h3>
              <p className="text-muted-foreground mt-1">
                {requirements.length === 0
                  ? "Extract requirements first, then generate your BRD."
                  : `Generate a professional BRD from ${requirements.length} extracted requirements.`}
              </p>
            </div>
            <Button
              onClick={onGenerate}
              disabled={requirements.length === 0 || generating}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate BRD
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-2xl">{brd.content.title}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">Version {brd.content.version}</Badge>
                <span className="text-sm text-muted-foreground">
                  Generated {new Date(brd.content.generatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Regenerate */}
              <Button variant="outline" size="sm" onClick={onGenerate} disabled={generating}>
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>

              {/* Export dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={() => exportToMarkdown(brd, projectName)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Markdown</p>
                      <p className="text-xs text-muted-foreground">.md file</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={() => exportToPDF(brd, projectName)}
                  >
                    <FileDown className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">PDF</p>
                      <p className="text-xs text-muted-foreground">Clean, printable document</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              <ChevronDown className="h-4 w-4 mr-1" />
              Expand All
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              <ChevronUp className="h-4 w-4 mr-1" />
              Collapse All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        {brd.content.sections
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <BRDSectionCard
              key={section.id}
              section={section}
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
      </div>

      {/* Refinement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Refine with Natural Language
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Textarea
              placeholder="E.g., 'Add more detail to the security requirements' or 'Make the executive summary more concise'"
              value={refinementInput}
              onChange={(e) => setRefinementInput(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Describe how you'd like to improve the BRD
              </p>
              <Button
                onClick={handleRefine}
                disabled={!refinementInput.trim() || refining}
                className="gap-2"
              >
                {refining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refining...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Apply Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ── Section Card ──────────────────────────────────────────────────────────────
interface BRDSectionCardProps {
  section: BRDSection;
  isExpanded: boolean;
  onToggle: () => void;
}

const BRDSectionCard = ({ section, isExpanded, onToggle }: BRDSectionCardProps) => (
  <Card>
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{section.title}</CardTitle>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <CardContent className="pt-0">
          <div className="brd-content">
            <ReactMarkdown
              components={{
                // Headings
                h1: ({ children }) => (
                  <h2 className="text-base font-bold text-foreground mt-5 mb-2 pb-1 border-b border-border/40">{children}</h2>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold text-foreground mt-5 mb-2 pb-1 border-b border-border/40">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5">{children}</h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-sm font-semibold text-muted-foreground mt-3 mb-1">{children}</h4>
                ),
                // Paragraphs
                p: ({ children }) => (
                  <p className="text-sm text-foreground/85 leading-relaxed mb-3">{children}</p>
                ),
                // Unordered list
                ul: ({ children }) => (
                  <ul className="my-2 space-y-1.5 pl-0">{children}</ul>
                ),
                // Ordered list
                ol: ({ children }) => (
                  <ol className="my-2 space-y-1.5 pl-0 list-none counter-reset-none">{children}</ol>
                ),
                // List items
                li: ({ children }) => (
                  <li className="flex items-start gap-2 text-sm text-foreground/85 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{children}</span>
                  </li>
                ),
                // Bold
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                // Italic
                em: ({ children }) => (
                  <em className="italic text-foreground/80">{children}</em>
                ),
                // Inline code
                code: ({ children }) => (
                  <code className="px-1 py-0.5 rounded text-xs bg-muted text-foreground font-mono">{children}</code>
                ),
                // Horizontal rule
                hr: () => (
                  <hr className="my-4 border-border/40" />
                ),
                // Block quote
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/50 pl-4 my-3 text-sm text-muted-foreground italic">{children}</blockquote>
                ),
              }}
            >
              {cleanSectionContent(section.content)}
            </ReactMarkdown>
          </div>
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  </Card>
);
