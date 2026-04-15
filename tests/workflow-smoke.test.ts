import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('n8n workflow smoke', () => {
  it('parses the hotel-kanban workflow and keeps Hospedin nodes present', () => {
    const workflowPath = path.resolve(process.cwd(), 'n8n/workflows/hotel-kanban.json');
    const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    const nodeNames = new Set((workflow.nodes || []).map((node: { name?: string }) => node.name));

    expect(nodeNames.has('Resolver Consulta Hospedin')).toBe(true);
    expect(nodeNames.has('Supabase - Get Hospedin Room Mappings')).toBe(true);
    expect(nodeNames.has('Consultar Disponibilidade Hospedin')).toBe(true);
    expect(nodeNames.has('AI Agent Aura')).toBe(true);
  });
});
