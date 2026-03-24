# Process IR Spec

## Purpose
Process IR is the intermediate representation between the LLM layer and deterministic engineering layers.

Pipeline:
`user text -> LLM -> Process IR -> validation/normalization -> layout -> BPMN XML`

Process IR is not BPMN XML and not React Flow state.
It is the main internal process contract.

## Requirements for IR
IR should be:
- strict enough for validation
- simple enough for LLM output
- rich enough for layout and export
- stable across iterations

## Top-level shape
```ts
export interface ProcessIR {
  version: string;
  process: ProcessMeta;
  lanes: ProcessLaneIR[];
  nodes: ProcessNodeIR[];
  edges: ProcessEdgeIR[];
  warnings?: ProcessWarning[];
}
```

## `version`
Schema version.

Purpose:
- allows safe format evolution
- lets backend distinguish payload versions

Example:
```json
"version": "1.0"
```

## `process`
Process metadata.

```ts
export interface ProcessMeta {
  id: string;
  title: string;
  poolId?: string;
  poolLabel?: string;
  description?: string;
}
```

Field meaning:
- `id`: stable technical id of the process
- `title`: display title
- `poolId`: technical pool id
- `poolLabel`: display pool label
- `description`: optional text description for UI and traceability

## `lanes`
```ts
export interface ProcessLaneIR {
  id: string;
  label: string;
  order: number;
  actor?: string;
}
```

Field meaning:
- `id`: stable lane id
- `label`: lane title
- `order`: top-to-bottom lane order
- `actor`: optional human-readable actor name

## `nodes`
```ts
export type ProcessNodeType =
  | 'startEvent'
  | 'endEvent'
  | 'task'
  | 'exclusiveGateway'
  | 'parallelGateway';

export interface ProcessNodeIR {
  id: string;
  type: ProcessNodeType;
  label: string;
  laneId: string;
  bpmnType?: string;
  system?: string;
  gatewayRole?: 'split' | 'join' | 'decision';
  metadata?: Record<string, string | number | boolean>;
}
```

Field meaning:
- `id`: unique node id
- `type`: BPMN-light node type for MVP
- `label`: visible node label
- `laneId`: owning lane
- `bpmnType`: optional future BPMN semantic refinement
- `system`: external system or execution context
- `gatewayRole`: semantic gateway role
- `metadata`: extensible container for future structured data

## `edges`
```ts
export interface ProcessEdgeIR {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: 'forward' | 'backward';
  condition?: string;
  isDefault?: boolean;
}
```

Field meaning:
- `id`: unique edge id
- `source`: source node id
- `target`: target node id
- `label`: visible transition label
- `kind`: direction semantics for layout
- `condition`: decision text
- `isDefault`: default gateway flow marker

## `warnings`
```ts
export interface ProcessWarning {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}
```

Purpose:
- capture ambiguities without converting them immediately into hard errors
- show where LLM was uncertain or where normalization changed the draft

## Minimum invariants of valid IR
### Process
- `process.id` is required
- `process.title` is required

### Lanes
- lane ids are unique
- `order` values are unique
- every referenced `laneId` exists

### Nodes
- node ids are unique
- every node has a supported `type`
- every node belongs to an existing lane

### Edges
- edge ids are unique
- `source` and `target` refer to existing nodes
- self-loops are forbidden in MVP

### Structural
- at least one `startEvent`
- at least one `endEvent`
- no dangling references

## Intentionally not in IR v1
- exact coordinates
- canvas node sizes
- BPMN DI bounds
- React/renderer-specific fields
- XML serializer implementation details

Those should appear only after layout.

## Relation to current prototype
Current `ProcessDefinition` is a simplified preview/layout model.

Planned evolution:
- `ProcessIR` becomes the domain model
- normalizer converts LLM output into `ProcessIR`
- layout mapper converts `ProcessIR -> ProcessDefinition`
- BPMN export works from `ProcessIR + layout result`

## Example Process IR
```json
{
  "version": "1.0",
  "process": {
    "id": "service_rollout",
    "title": "Service rollout",
    "poolId": "deployment_process",
    "poolLabel": "Deployment Process"
  },
  "lanes": [
    { "id": "manager", "label": "Project manager", "order": 0 },
    { "id": "devops", "label": "DevOps engineer", "order": 1 }
  ],
  "nodes": [
    { "id": "start", "type": "startEvent", "label": "Start", "laneId": "manager" },
    { "id": "create_ticket", "type": "task", "label": "Create ticket", "laneId": "manager", "system": "Jira" },
    { "id": "configure_env", "type": "task", "label": "Configure environment", "laneId": "devops", "system": "Ansible" }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "create_ticket", "kind": "forward" },
    { "id": "e2", "source": "create_ticket", "target": "configure_env", "kind": "forward" }
  ]
}
```
