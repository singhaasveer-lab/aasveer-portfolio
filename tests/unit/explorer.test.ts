import { describe, expect, it } from "vitest";
import { buildCommands, filterCommands } from "../../src/lib/explorer/commands";
import { boxConnector, highlight, type Edge } from "../../src/lib/explorer/graph";
import {
  clearanceMinutes,
  congestionLevel,
  estimatedWait,
  makeToken,
  queueOrder,
} from "../../src/lib/explorer/queueSim";
import { readContent } from "../../src/lib/content/readContent";
import { contactDetails } from "../../src/lib/privacy";
import { CONTENT_DIR } from "../helpers";

const content = readContent(CONTENT_DIR);
const links = {
  github_url: "https://github.com/singhaasveer-lab",
  linkedin_url: "https://linkedin.com/in/aasveer-singh",
  // A synthetic address: the command list must never carry one, whatever the data holds.
  email: "owner@mailhost.io",
  resume_href: "/resume/Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf",
};
const commands = buildCommands({
  modules: content.explorer.lab,
  projects: content.projects.projects,
  links,
});
const labels = (query: string) => filterCommands(commands, query).map((c) => c.label);

describe("command list", () => {
  it("offers every suggested command", () => {
    expect(commands.map((c) => c.label)).toEqual(
      expect.arrayContaining([
        "GO TO ABOUT",
        "GO TO PROJECTS",
        "OPEN AI SYSTEMS LAB",
        "EXPLORE RAG",
        "OPEN EVIDENCE ENGINE",
        "VIEW ENGINEERING CONNECTIONS",
        "OPEN ENGINEERING CASEBOOK",
        "EXPLORE INTERVIEWIQ",
        "EXPLORE WINGMAN AI",
        "EXPLORE GIFTBRO AI",
        "EXPLORE SMARTQUEUE AI",
        "EXPLORE PENNYBLOOM",
        "EXPLORE STUDYFORGE AI",
        "OPEN SMARTQUEUE AI",
        "DOWNLOAD RESUME",
        "CONTACT AASVEER",
        "OPEN GITHUB",
        "OPEN LINKEDIN",
      ]),
    );
  });

  it("states the real project count", () => {
    const projects = commands.find((c) => c.label === "GO TO PROJECTS")!;
    expect(projects.hint).toBe("6 case files");
  });

  it("has a unique id per command and one architecture command per project", () => {
    expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length);
    expect(commands.filter((c) => c.action.type === "architecture")).toHaveLength(6);
  });

  it("never offers an email command, even when an address is in the data", () => {
    expect(commands.map((c) => c.id)).not.toContain("email");
    expect(JSON.stringify(commands)).not.toMatch(/mailto:|@/);
  });

  it("leaves out contact commands when the links are withheld", () => {
    const withheld = buildCommands({
      modules: [],
      projects: [],
      links: { ...links, email: null, resume_href: null },
    }).map((c) => c.id);
    expect(withheld).not.toContain("resume");
    expect(withheld).not.toContain("email");
  });

  it("never exposes a phone number", () => {
    expect(contactDetails(JSON.stringify(commands))).toEqual([]);
  });
});

describe("command search", () => {
  it("returns everything for an empty query", () => {
    expect(labels("   ")).toHaveLength(commands.length);
  });

  it("matches labels, ignoring case and word order", () => {
    expect(labels("rag")).toContain("EXPLORE RAG");
    expect(labels("wingman explore")).toContain("EXPLORE WINGMAN AI");
  });

  it("matches keywords that are not in the label", () => {
    expect(labels("cv")).toContain("DOWNLOAD RESUME");
    expect(labels("tesseract")).toContain("EXPLORE OCR");
  });

  it("ranks a match in the label above a match in the keywords", () => {
    expect(labels("studyforge")[0]).toBe("EXPLORE STUDYFORGE AI");
    expect(labels("studyforge")).toContain("EXPLORE RAG");
  });

  it("returns nothing when no command matches", () => {
    expect(labels("quantum blockchain")).toEqual([]);
  });
});

describe("diagram geometry", () => {
  it("joins side by side boxes edge to edge", () => {
    const { d } = boxConnector({ x: 100, y: 50 }, { x: 300, y: 50 }, 40, 20);
    expect(d.startsWith("M 140 50")).toBe(true);
    expect(d.endsWith("260 50")).toBe(true);
  });

  it("limits label room only where boxes share a row", () => {
    expect(boxConnector({ x: 100, y: 50 }, { x: 300, y: 50 }, 40, 20).labelRoom).toBe(120);
    expect(boxConnector({ x: 100, y: 50 }, { x: 300, y: 200 }, 40, 20).labelRoom).toBe(Infinity);
  });

  it("joins stacked boxes top to bottom, in either direction", () => {
    expect(boxConnector({ x: 100, y: 50 }, { x: 100, y: 200 }, 40, 20).d).toMatch(/^M 100 70/);
    expect(boxConnector({ x: 100, y: 200 }, { x: 100, y: 50 }, 40, 20).d).toMatch(/^M 100 180/);
  });
});

describe("diagram highlighting", () => {
  const edges: Edge[] = [
    ["api", "db", "writes"],
    ["ui", "api", "calls"],
    ["api", "llm", "prompts"],
    ["llm", "out", "text"],
  ];

  it("lights a node's incoming and outgoing connections only", () => {
    const lit = highlight(edges, { node: "api" });
    expect([...lit.edges].sort()).toEqual(["api>db", "api>llm", "ui>api"]);
    expect(lit.nodes.has("out")).toBe(false);
  });

  it("lights exactly the steps of a flow", () => {
    const lit = highlight(edges, { flow: ["ui", "api", "llm"] });
    expect([...lit.edges]).toEqual(["ui>api", "api>llm"]);
    expect(lit.nodes.has("db")).toBe(false);
  });

  it("lights nothing with no focus", () => {
    expect(highlight(edges, {}).active).toBe(false);
  });
});

describe("queue simulation rules (ported from SmartQueue AI)", () => {
  it("uses the source's congestion thresholds", () => {
    expect(congestionLevel(1, 1)).toBe("Low");
    expect(congestionLevel(3, 2)).toBe("Moderate");
    expect(congestionLevel(3, 1)).toBe("High");
    expect(congestionLevel(5, 1)).toBe("High");
    expect(congestionLevel(6, 1)).toBe("Severe");
  });

  it("never divides by zero open counters", () => {
    expect(congestionLevel(6, 0)).toBe("Severe");
    expect(clearanceMinutes([makeToken(1, "GEN", false)], 0)).toBe(6);
  });

  it("serves priority tokens first, then in joining order", () => {
    const order = queueOrder([
      makeToken(101, "GEN", false),
      makeToken(102, "DOC", true),
      makeToken(103, "FEE", false),
      makeToken(104, "TEC", true),
    ]);
    expect(order.map((t) => t.number)).toEqual(["PRI-102", "PRI-104", "GEN-101", "FEE-103"]);
  });

  it("prefixes tokens with the service code, or PRI for priority", () => {
    expect(makeToken(109, "DOC", false).number).toBe("DOC-109");
    expect(makeToken(109, "DOC", true).number).toBe("PRI-109");
  });

  it("estimates waits and clearance with the source's formulas", () => {
    const token = makeToken(101, "DOC", false);
    expect(estimatedWait(token, 0, 2)).toBe(1);
    expect(estimatedWait(token, 3, 2)).toBe(19);
    expect(clearanceMinutes([token, makeToken(102, "TEC", false)], 3)).toBe(9);
  });
});
