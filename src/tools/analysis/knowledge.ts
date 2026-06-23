import type { ToolContext, ToolInstance } from "../../types/tools.ts";

export interface Triple {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

export class KnowledgeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private triples: Triple[] = [];

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge): void {
    this.edges.push(edge);
  }

  addTriple(triple: Triple): void {
    this.triples.push(triple);

    if (!this.nodes.has(triple.subject)) {
      this.addNode({
        id: triple.subject,
        label: triple.subject,
        type: "entity",
      });
    }
    if (!this.nodes.has(triple.object)) {
      this.addNode({ id: triple.object, label: triple.object, type: "entity" });
    }

    this.addEdge({
      source: triple.subject,
      target: triple.object,
      label: triple.predicate,
      weight: triple.confidence,
    });
  }

  query(pattern: {
    subject?: string;
    predicate?: string;
    object?: string;
  }): Triple[] {
    return this.triples.filter((t) => {
      if (pattern.subject && t.subject !== pattern.subject) return false;
      if (pattern.predicate && t.predicate !== pattern.predicate) return false;
      if (pattern.object && t.object !== pattern.object) return false;
      return true;
    });
  }

  getNeighbors(nodeId: string): GraphNode[] {
    const neighbors = new Set<string>();
    for (const edge of this.edges) {
      if (edge.source === nodeId) neighbors.add(edge.target);
      if (edge.target === nodeId) neighbors.add(edge.source);
    }
    return Array.from(neighbors)
      .map((id) => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined);
  }

  getShortestPath(source: string, target: string): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [
      { node: source, path: [source] },
    ];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (node === target) return path;
      if (visited.has(node)) continue;
      visited.add(node);

      for (const edge of this.edges) {
        if (edge.source === node && !visited.has(edge.target)) {
          queue.push({ node: edge.target, path: [...path, edge.target] });
        }
        if (edge.target === node && !visited.has(edge.source)) {
          queue.push({ node: edge.source, path: [...path, edge.source] });
        }
      }
    }

    return null;
  }

  toAscii(): string {
    const lines: string[] = ["Knowledge Graph:", ""];

    for (const edge of this.edges) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);
      lines.push(
        `${sourceNode?.label ?? edge.source} --[${edge.label}]--> ${targetNode?.label ?? edge.target}`,
      );
    }

    return lines.join("\n");
  }

  getStats(): { nodes: number; edges: number; triples: number } {
    return {
      nodes: this.nodes.size,
      edges: this.edges.length,
      triples: this.triples.length,
    };
  }

  clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.triples = [];
  }
}

export const knowledgeGraph = new KnowledgeGraph();

export const knowledgeTool: ToolInstance = {
  name: "knowledge",
  description:
    "Manage a knowledge graph of entities, relations, and inferred facts",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "query", "add", "path", "clear", "stats"],
        description: "Action to perform",
      },
      subject: {
        type: "string",
        description: "Subject entity for queries or triples",
      },
      predicate: { type: "string", description: "Predicate relation" },
      object: {
        type: "string",
        description: "Object entity for queries or triples",
      },
      confidence: {
        type: "number",
        description: "Confidence for triple insertion",
      },
    },
    required: ["action"],
  },
  riskLevel: "read",
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext) {
    const action = String(params["action"] ?? "");

    switch (action) {
      case "list": {
        const output = knowledgeGraph.toAscii();
        return {
          success: true,
          output: output || "Knowledge graph is empty",
          metadata: knowledgeGraph.getStats(),
        };
      }
      case "query": {
        const triples = knowledgeGraph.query({
          subject: String(params["subject"] ?? ""),
          predicate: String(params["predicate"] ?? ""),
          object: String(params["object"] ?? ""),
        });
        const output =
          triples.length === 0
            ? "No triples matched"
            : triples
                .map(
                  (t) =>
                    `${t.subject} -[${t.predicate}]-> ${t.object} (${t.confidence})`,
                )
                .join("\n");
        return { success: true, output, metadata: { count: triples.length } };
      }
      case "add": {
        const subject = String(params["subject"] ?? "");
        const predicate = String(params["predicate"] ?? "");
        const object = String(params["object"] ?? "");
        const confidence = Number(params["confidence"] ?? 1);
        if (!subject || !predicate || !object) {
          return {
            success: false,
            output: "",
            error: "subject, predicate, and object are required",
          };
        }
        knowledgeGraph.addTriple({ subject, predicate, object, confidence });
        return {
          success: true,
          output: `Added triple: ${subject} -[${predicate}]-> ${object}`,
          metadata: { subject, predicate, object, confidence },
        };
      }
      case "path": {
        const subject = String(params["subject"] ?? "");
        const object = String(params["object"] ?? "");
        if (!subject || !object) {
          return {
            success: false,
            output: "",
            error: "subject and object are required",
          };
        }
        const path = knowledgeGraph.getShortestPath(subject, object);
        return {
          success: true,
          output: path ? path.join(" -> ") : "No path found",
          metadata: { path },
        };
      }
      case "stats": {
        const stats = knowledgeGraph.getStats();
        return {
          success: true,
          output: `Nodes: ${stats.nodes}, Edges: ${stats.edges}, Triples: ${stats.triples}`,
          metadata: stats,
        };
      }
      case "clear": {
        knowledgeGraph.clear();
        return { success: true, output: "Knowledge graph cleared" };
      }
      default:
        return {
          success: false,
          output: "",
          error: `Unknown action: ${action}`,
        };
    }
  },
};
