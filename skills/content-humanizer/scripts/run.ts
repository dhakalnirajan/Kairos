#!/usr/bin/env bun
/**
 * content-humanizer/scripts/run.ts
 *
 * Flags AI-writing tells: stock openers, hype phrases, transition-word
 * sentence starters, and low sentence-length variance. Detection only,
 * never rewrites. Read-only.
 */

import { parseArgs } from "util";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

interface HumanizerArgs {
  file: string;
  thresholdTransitionDensity: number;
  thresholdVariance: number;
}

function parseCliArgs(): HumanizerArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      file: { type: "string" },
      "threshold-transition-density": { type: "string", default: "0.08" },
      "threshold-variance": { type: "string", default: "15" },
    },
  });
  if (!values.file) {
    console.error("Error: --file is required");
    process.exit(1);
  }
  return {
    file: values.file as string,
    thresholdTransitionDensity: parseFloat((values["threshold-transition-density"] as string) ?? "0.08"),
    thresholdVariance: parseFloat((values["threshold-variance"] as string) ?? "15"),
  };
}

interface TellPhrases {
  stockOpeners: string[];
  hypePhrases: string[];
  transitionStarters: string[];
}

function loadTellPhrases(): TellPhrases {
  const here = dirname(fileURLToPath(import.meta.url));
  const refPath = join(here, "..", "references", "tell-phrases.json");
  if (existsSync(refPath)) {
    return JSON.parse(readFileSync(refPath, "utf-8"));
  }
  // Fallback minimal set if the reference file is missing for some reason.
  return {
    stockOpeners: ["In today's fast-paced world", "In the ever-evolving landscape"],
    hypePhrases: ["leverage synergies", "seamlessly integrated", "unprecedented"],
    transitionStarters: ["Moreover", "Furthermore", "Additionally", "Consequently"],
  };
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function main() {
  const args = parseCliArgs();
  const source = readFileSync(args.file, "utf-8");
  const lines = source.split("\n");
  const phrases = loadTellPhrases();

  const lineFindings: { line: number; phrase: string; category: "stock-opener" | "hype-phrase" }[] = [];

  lines.forEach((line, i) => {
    const lower = line.toLowerCase();
    for (const opener of phrases.stockOpeners) {
      if (lower.includes(opener.toLowerCase())) {
        lineFindings.push({ line: i + 1, phrase: opener, category: "stock-opener" });
      }
    }
    for (const hype of phrases.hypePhrases) {
      if (lower.includes(hype.toLowerCase())) {
        lineFindings.push({ line: i + 1, phrase: hype, category: "hype-phrase" });
      }
    }
  });

  const sentences = splitSentences(source);
  const transitionRe = new RegExp(`^(${phrases.transitionStarters.join("|")})\\b`, "i");
  const transitionCount = sentences.filter((s) => transitionRe.test(s.trim())).length;
  const transitionDensity = sentences.length > 0 ? transitionCount / sentences.length : 0;

  const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / (lengths.length || 1);
  const stdDev = Math.sqrt(variance);

  const documentFindings = {
    transitionDensity: Math.round(transitionDensity * 1000) / 1000,
    transitionDensityFlagged: transitionDensity > args.thresholdTransitionDensity,
    sentenceLengthStdDev: Math.round(stdDev * 100) / 100,
    lowVarianceFlagged: sentences.length >= 5 && stdDev < args.thresholdVariance,
  };

  console.log(JSON.stringify({ lineFindings, documentFindings }, null, 2));
}

main();
