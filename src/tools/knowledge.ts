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
      this.addNode({ id: triple.subject, label: triple.subject, type: 'entity' });
    }
    if (!this.nodes.has(triple.object)) {
      this.addNode({ id: triple.object, label: triple.object, type: 'entity' });
    }

    this.addEdge({
      source: triple.subject,
      target: triple.object,
      label: triple.predicate,
      weight: triple.confidence,
    });
  }

  query(pattern: { subject?: string; predicate?: string; object?: string }): Triple[] {
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
    const queue: Array<{ node: string; path: string[] }> = [{ node: source, path: [source] }];

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
    const lines: string[] = ['Knowledge Graph:', ''];

    for (const edge of this.edges) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);
      lines.push(`${sourceNode?.label ?? edge.source} --[${edge.label}]--> ${targetNode?.label ?? edge.target}`);
    }

    return lines.join('\n');
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
