# Спецификация Process IR

## Назначение
Process IR — это промежуточное представление между LLM-слоем и детерминированными инженерными слоями.

Pipeline:
`user text -> LLM -> Process IR -> validation/normalization -> layout -> BPMN XML`

Process IR не является BPMN XML и не является React Flow state.
Это основной внутренний контракт процесса.

## Требования к IR
IR должен быть:
- достаточно строгим для validation
- достаточно простым для LLM output
- достаточно богатым для layout и export
- стабильным между итерациями

## Верхнеуровневая структура
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
Версия схемы IR.

Смысл:
- позволяет безопасно развивать формат
- позволяет backend различать payload разных версий

Пример:
```json
"version": "1.0"
```

## `process`
Метаданные процесса.

```ts
export interface ProcessMeta {
  id: string;
  title: string;
  poolId?: string;
  poolLabel?: string;
  description?: string;
}
```

Смысл полей:
- `id`: стабильный технический идентификатор процесса
- `title`: отображаемое название
- `poolId`: технический идентификатор pool
- `poolLabel`: отображаемое название pool
- `description`: необязательное текстовое описание для UI и traceability

## `lanes`
```ts
export interface ProcessLaneIR {
  id: string;
  label: string;
  order: number;
  actor?: string;
}
```

Смысл полей:
- `id`: стабильный идентификатор lane
- `label`: подпись lane
- `order`: порядок lanes сверху вниз
- `actor`: необязательное человекочитаемое название роли

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

Смысл полей:
- `id`: уникальный идентификатор узла
- `type`: BPMN-light тип узла в рамках MVP
- `label`: отображаемая подпись узла
- `laneId`: принадлежность узла к lane
- `bpmnType`: необязательное уточнение BPMN semantics на будущее
- `system`: внешняя система или контекст выполнения
- `gatewayRole`: семантическая роль gateway
- `metadata`: расширяемый контейнер для будущих структурированных данных

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

Смысл полей:
- `id`: уникальный идентификатор связи
- `source`: идентификатор исходного узла
- `target`: идентификатор целевого узла
- `label`: отображаемая подпись перехода
- `kind`: семантика направления для layout
- `condition`: условие перехода
- `isDefault`: признак default flow для gateway

## `warnings`
```ts
export interface ProcessWarning {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}
```

Смысл:
- фиксировать неоднозначности без немедленного превращения их в hard error
- показывать места, где LLM была неуверенна или где normalizer что-то исправил

## Минимальные инварианты валидного IR
### По process
- `process.id` обязателен
- `process.title` обязателен

### По lanes
- lane ids уникальны
- значения `order` уникальны
- каждый используемый `laneId` существует

### По nodes
- node ids уникальны
- каждый node имеет допустимый `type`
- каждый node принадлежит существующему lane

### По edges
- edge ids уникальны
- `source` и `target` ссылаются на существующие nodes
- self-loop запрещён для MVP

### По структуре
- должен существовать хотя бы один `startEvent`
- должен существовать хотя бы один `endEvent`
- не должно быть висячих ссылок

## Что намеренно не входит в IR v1
- точные координаты
- размеры canvas-узлов
- BPMN DI bounds
- React/render-specific поля
- детали XML serializer implementation

Эти данные должны появляться только после layout phase.

## Отношение к текущему прототипу
Текущая `ProcessDefinition` — это упрощённая preview/layout model.

План развития:
- `ProcessIR` становится доменной моделью
- normalizer приводит LLM output к `ProcessIR`
- layout mapper преобразует `ProcessIR -> ProcessDefinition`
- BPMN export работает из `ProcessIR + layout result`

## Пример Process IR
```json
{
  "version": "1.0",
  "process": {
    "id": "service_rollout",
    "title": "Разворачивание сервиса",
    "poolId": "deployment_process",
    "poolLabel": "Deployment Process"
  },
  "lanes": [
    { "id": "manager", "label": "Менеджер проекта", "order": 0 },
    { "id": "devops", "label": "DevOps-инженер", "order": 1 }
  ],
  "nodes": [
    { "id": "start", "type": "startEvent", "label": "Start", "laneId": "manager" },
    { "id": "create_ticket", "type": "task", "label": "Создать задачу", "laneId": "manager", "system": "Jira" },
    { "id": "configure_env", "type": "task", "label": "Настроить окружение", "laneId": "devops", "system": "Ansible" }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "create_ticket", "kind": "forward" },
    { "id": "e2", "source": "create_ticket", "target": "configure_env", "kind": "forward" }
  ]
}
```
