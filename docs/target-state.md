# Target State

## Purpose
The prototype should evolve from a local BPMN layout playground into a focused BPMN generation pipeline for lane-based flow processes.

The core principle stays the same:
- LLM interprets natural language and produces a structured draft.
- Validation, normalization, layout, and BPMN XML export stay deterministic.

## End-to-end user scenario
1. User opens the web app.
2. User configures an LLM connection.
3. User describes a process in natural language in chat.
4. The system converts the description into structured process JSON / Process IR.
5. The system validates and normalizes the result.
6. The layout engine builds a visual graph.
7. The user sees the diagram, JSON model, and diagnostics.
8. The system generates BPMN XML with semantic and DI parts.
9. The user exports a `.bpmn` file and opens it in Camunda Modeler.

## MVP boundaries
Supported BPMN-light subset:
- one process in one pool
- lanes
- startEvent
- endEvent
- task
- exclusiveGateway
- parallelGateway
- sequenceFlow
- backward edges as layout-level loop semantics

Out of scope for MVP:
- message flows
- choreography
- boundary events
- event subprocesses
- text annotations
- compensation
- call activities
- full BPMN XML editing on canvas

## Target architecture
The system should be split into independent layers.

### Chat UI
Responsibilities:
- chat history
- text input
- showing generated result
- showing diagnostics and errors

### LLM Client Layer
Responsibilities:
- manage provider configuration
- run chat completion requests
- hide HTTP details from the rest of the app
- support OpenRouter and local OpenAI-compatible models

### Process IR Layer
Responsibilities:
- store normalized process structure
- serve as the main internal contract
- stay suitable for LLM output, validation, layout, and export

### Validation and Normalization Layer
Responsibilities:
- validate structure and references
- repair minor defects
- normalize edge direction and lane membership
- produce warnings and hard errors

### Layout Layer
Responsibilities:
- convert Process IR to view model
- assign columns and lane placement
- produce deterministic coordinates and routes
- stay replaceable later with a stronger engine than dagre

### BPMN Export Layer
Responsibilities:
- generate semantic BPMN model
- generate BPMN DI from layout result
- serialize `.bpmn`
- keep Camunda compatibility in scope

## Target stack
Frontend:
- Vite
- React
- TypeScript
- React Flow for preview/edit playground

Backend:
- Node.js
- lightweight HTTP server

Core integrations:
- OpenAI-compatible HTTP API for LLM
- `@dagrejs/dagre` as current baseline layout engine
- `bpmn-moddle` for BPMN XML generation
- optional later: `elkjs` as next layout candidate

## Data artifacts
The system should keep three distinct representations.

1. Chat input/output
Raw user text and raw LLM responses.

2. Process IR
The normalized internal process contract.

3. Layouted diagram model
Process IR plus coordinates, sizes, and routes for preview and BPMN DI.

## Key engineering decisions
- Do not generate BPMN XML directly from LLM.
- Do not merge chat state, IR, layout state, and export state into one object.
- Treat current `ProcessDefinition` as a temporary preview/layout model.
- Introduce `ProcessIR` as the domain model in the next phase.
- Keep layout and export deterministic for the same IR.

## Iteration 1 status
Implemented in the current prototype:
- LLM chat UI
- OpenRouter and local provider config
- dual transport for OpenRouter: `Local proxy` and `Browser direct (Experimental)`
- proxy diagnostics for upstream and network errors
- JSON draft parsing and validation
- mapping into current dagre/React Flow preview model
- process graph rendering from generated result
- chat/config/status state persisted at page level so it does not reset on tab switches
