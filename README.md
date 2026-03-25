# text->bpmn ai pipeline

Research prototype for the pipeline `text -> LLM -> Process IR -> layout -> BPMN XML`.

## What It Does

- connects to an OpenAI-compatible LLM endpoint
- lets the user describe a process in natural language
- converts the response into `Process IR`
- validates and normalizes the generated process
- builds a BPMN-like graph preview with `dagre` and `React Flow`
- exports semantic BPMN + BPMN DI as a `.bpmn` file
- opens exported BPMN in Camunda for manual verification

## Stack

- React + TypeScript
- Vite
- React Flow
- `@dagrejs/dagre`
- local Node.js proxy for OpenAI-compatible chat requests

## Requirements

- Node.js 20+
- npm

## Run Locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`.

## Build

```powershell
npm.cmd run build
```

## LLM Configuration

LLM connection settings are configured from the UI.

Supported modes:
- `OpenRouter`
- `Local` OpenAI-compatible model

OpenRouter can use:
- `Local proxy`
- `Browser direct`

## Main Areas in the UI

- left: BPMN preview canvas
- right: chat and secondary inspectors
- top bar: always-visible BPMN export action

## Test Assets

The repository includes several built-in sample processes and a business analysis sample for layout testing.

## Notes

- The project is a prototype and focuses on the pipeline and layout/export behavior, not on full BPMN editor functionality.
