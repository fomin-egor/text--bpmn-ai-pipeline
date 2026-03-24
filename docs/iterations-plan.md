# Iterations Plan

## Planning principles
Each iteration should deliver a working vertical slice, not a loose set of modules.

Priority order:
- end-to-end path first
- stability second
- BPMN XML export third
- UX and layout sophistication after that

## Iteration 1. LLM Playground
### Goal
Deliver the first usable flow:
`chat -> JSON draft -> validation -> current canvas`

### Scope
- LLM connection UI
- chat UI
- OpenAI-compatible backend proxy
- prompt template for process generation
- JSON draft parser and validator
- mapping into current process preview model
- graph build with current dagre layout
- process JSON view in the right panel

### Implemented result
Completed in the current prototype.

Delivered:
- chat + connection settings UI
- OpenRouter provider support
- local OpenAI-compatible provider support
- OpenRouter transport selection:
  - `Local proxy (Recommended)`
  - `Browser direct (Experimental)`
- upstream / network diagnostics in proxy
- generated process preview in React Flow
- generated process JSON in a separate right-side tab
- lifted chat/config/status state so it survives tab switching

### Exit criteria
- user can send a text description
- app receives LLM output
- app validates returned JSON
- app builds a graph with the current dagre renderer
- app exposes useful diagnostics on failure

## Iteration 2. Introduce Process IR
### Goal
Separate the domain model from the preview/layout model.

### Scope
- introduce `ProcessIR`
- introduce normalizer
- introduce validator
- introduce warnings/errors model
- map `ProcessIR -> layout view model`
- switch LLM output contract from ad hoc JSON to IR

### Result
The system runs on a stable internal contract instead of a preview-oriented draft shape.

### Artifacts
- Process IR types
- validation rules
- normalization rules
- mapping layer from IR into layout input

## Iteration 3. BPMN Export MVP
### Goal
Export a `.bpmn` file that opens in Camunda.

### Scope
- connect `bpmn-moddle`
- semantic mapping `ProcessIR -> BPMN`
- DI mapping `layout result -> BPMN DI`
- export action from UI
- smoke validation through re-import

### Result
The user can export BPMN XML from a generated process.

### Artifacts
- export service
- XML serializer
- download action
- Camunda compatibility checklist

## Iteration 4. Stability and UX
### Goal
Make the prototype comfortable for repeated real-world testing.

### Scope
- richer LLM diagnostics
- IR/debug editor panel
- rerun normalization manually
- save/load session
- compare raw LLM JSON and normalized IR
- layout warnings for problematic diagrams

### Result
The prototype becomes a practical research instrument instead of a one-shot demo.

### Artifacts
- diagnostics UI
- session persistence
- richer validation messages

## Iteration 5. Layout Engine v2
### Goal
Reduce dependence on dagre limitations.

### Scope
- formal layout engine interface
- keep dagre as baseline
- evaluate `elkjs`
- improve routing for loops and dense branches
- improve lane packing logic

### Result
Layout can evolve without rewriting chat, IR, or export layers.

### Artifacts
- layout abstraction
- second layout prototype
- layout comparison cases

## Recommended order
1. Iteration 1
2. Iteration 2
3. Iteration 3
4. Iteration 4
5. Iteration 5

## Why this order
- Iteration 1 delivers the first end-to-end MVP.
- Iteration 2 prevents architecture drift before XML export.
- Iteration 3 delivers the main product outcome: `.bpmn` export.
- Iteration 4 improves research usability.
- Iteration 5 improves layout quality without blocking the core pipeline.
