# Краткая спецификация итерации 3

## Название
Итерация 3: BPMN Export MVP

## Статус
Реализована и прошла smoke-проверку: экспортированный `.bpmn` открывается в Camunda.

## Базовый референс
Эталонный формат для реализации:
- `docs/reference_bpmn.bpmn`

Этот файл использовался как практический референс структуры XML, который должен открываться в Camunda и отражать тот класс схем, на который сейчас рассчитан прототип.

## Цель итерации
Научиться экспортировать `.bpmn` из текущего pipeline так, чтобы:
- semantic BPMN соответствовал Process IR
- visual BPMN DI соответствовал рассчитанному layout
- файл открывался в Camunda
- XML можно было просматривать в UI до скачивания

## Фактический результат
Итерация реализована.

Сделано:
- deterministic export из `ProcessIR + layout result`
- генерация semantic BPMN для поддерживаемого MVP-подмножества
- генерация BPMN DI для participant, lanes, flow nodes и sequence flows
- отдельная вкладка `BPMN XML` в UI
- скачивание `.bpmn` из UI
- smoke-проверка открытия результата в Camunda

## Входы итерации 3
После итерации 2 доступны:
- валидный `ProcessIR`
- preview mapper
- dagre layout result
- React Flow preview

Итерация 3 использует:
- `ProcessIR` как источник semantic BPMN
- `layout result` как источник BPMN DI

## Ключевой принцип
Экспорт не строится из React Flow runtime state.

Фактический поток:
- `ProcessIR -> semantic BPMN model`
- `layout result -> BPMN DI`
- `semantic + DI -> XML serializer -> .bpmn`

## Реализованный scope
### 1. Semantic BPMN export
Реализована генерация BPMN semantic layer для поддерживаемого подмножества.

Поддерживаются:
- `definitions`
- `collaboration`
- `participant`
- `process`
- `laneSet`
- `lane`
- `flowNodeRef`
- `startEvent`
- `endEvent`
- `task`
- `exclusiveGateway`
- `parallelGateway`
- `sequenceFlow`
- `incoming`
- `outgoing`
- `default` у exclusive gateway, если edge помечен как `isDefault`

### 2. BPMN DI export
Реализована генерация BPMN DI слоя:
- `bpmndi:BPMNDiagram`
- `bpmndi:BPMNPlane`
- `bpmndi:BPMNShape`
- `bpmndi:BPMNEdge`
- `dc:Bounds`
- `di:waypoint`

### 3. Export action
В UI реализованы:
- построение XML для текущего процесса
- просмотр XML в UI
- скачивание файла `.bpmn`

### 4. XML preview в UI
Реализована отдельная вкладка `BPMN XML`.

В ней отображаются:
- итоговый сериализованный XML
- статус export pipeline
- ошибки export pipeline, если они возникают

### 5. Smoke validation
Фактически подтверждено:
- файл открывается в Camunda
- lanes, nodes и edges отображаются
- BPMN XML может использоваться как базовый экспортный артефакт прототипа

## Подмножество BPMN для MVP
### Поддерживается
- один process в одном participant
- один pool
- несколько lanes
- startEvent
- endEvent
- task
- exclusiveGateway
- parallelGateway
- sequenceFlow
- default flow у exclusive gateway, если он есть в IR

### Пока не поддерживается
- message flow
- intermediate events
- boundary events
- subprocess
- call activity
- text annotation
- data store reference
- data association
- association
- BPMNLabel как отдельный полноценный слой layout-а

## Что видно из reference BPMN
По `reference_bpmn.bpmn` видно, что минимально совместимый export должен уметь формировать:

### Semantic structure
- `bpmn:definitions`
- `bpmn:collaboration`
- `bpmn:participant` с `processRef`
- `bpmn:process` с `isExecutable`
- `bpmn:laneSet`
- `bpmn:lane`
- внутри lanes: `bpmn:flowNodeRef`
- `bpmn:startEvent`
- `bpmn:endEvent`
- `bpmn:task`
- `bpmn:exclusiveGateway`
- `bpmn:parallelGateway`
- `bpmn:sequenceFlow`
- `default` attribute у gateway, когда он нужен
- `incoming` / `outgoing` у flow nodes

### Visual structure
- `bpmndi:BPMNDiagram`
- `bpmndi:BPMNPlane`
- `bpmndi:BPMNShape` для participant, lanes и flow nodes
- `bpmndi:BPMNEdge` для sequence flows
- `dc:Bounds` для shape
- `di:waypoint` для edge

## Mapping rules: Process IR -> Semantic BPMN
### Definitions level
Из `ProcessIR.process` получаются:
- `definitions id`
- `process id`
- `participant id`
- `participant name`

### Process level
Из `ProcessIR` получаются:
- `process`
- `laneSet`
- `lanes`
- все flow nodes
- все sequence flows

### Lane mapping
Для каждого lane:
- создаётся `bpmn:lane`
- внутрь пишутся `flowNodeRef` для всех nodes этого lane

### Node mapping
- `startEvent` -> `bpmn:startEvent`
- `endEvent` -> `bpmn:endEvent`
- `task` -> `bpmn:task`
- `exclusiveGateway` -> `bpmn:exclusiveGateway`
- `parallelGateway` -> `bpmn:parallelGateway`

### Edge mapping
Каждый edge становится `bpmn:sequenceFlow`.

Дополнительно:
- `sourceRef`
- `targetRef`
- `name`, если есть label
- `default` на gateway, если edge имеет `isDefault: true`

### Incoming / outgoing
Для каждого flow node вычисляются:
- список входящих sequenceFlow
- список исходящих sequenceFlow

## Mapping rules: Layout -> BPMN DI
### Participant and lanes
На основе layout result и lane metrics формируются:
- `BPMNShape` для participant
- `BPMNShape` для каждой lane

### Flow nodes
Для каждого node записываются:
- `x`
- `y`
- `width`
- `height`

Из этого собираются:
- `bpmndi:BPMNShape`
- `dc:Bounds`

### Edges
Для каждого edge записываются:
- `waypoints`

Из этого собираются:
- `bpmndi:BPMNEdge`
- `di:waypoint`

## Что было добавлено в архитектуру
### 1. Export layer
Добавлен отдельный export-слой:
- semantic mapping
- DI mapping
- XML serializer

### 2. Layout result contract
Зафиксирован layout result как отдельная структура.

Минимально он содержит:
- node bounds
- edge waypoints
- pool bounds
- lane bounds

### 3. Export orchestration
Добавлен orchestration step:
- взять валидный `ProcessIR`
- взять `layout result`
- построить semantic model
- построить DI model
- сериализовать в XML

### 4. XML state в UI
UI хранит и использует:
- текущий экспортированный XML
- статус export pipeline
- ошибку export pipeline, если она возникла

## Что сознательно осталось за пределами итерации 3
Пока не делалось:
- импорт BPMN в редактор
- round-trip editing
- поддержка полного BPMN 2.0
- поддержка artifacts
- тонкая визуальная доводка layout под Camunda output
- полное соответствие всем возможностям Camunda Modeler

## Выходы итерации 3
На выходе получены:
- экспорт `.bpmn` из UI
- просмотр BPMN XML в UI
- deterministic semantic BPMN generation
- deterministic BPMN DI generation
- smoke-tested совместимость с Camunda

## Критерии готовности
Итерация 3 считается завершённой и критерии выполнены:
- из валидного Process IR получается `.bpmn`
- в экспорт попадают participant, lanes, flow nodes и sequence flows
- visual bounds и waypoints соответствуют текущему layout contract
- XML доступен для просмотра во вкладке `BPMN XML`
- файл открывается в Camunda

## Остаточные замечания
После итерации 3 остались косметические замечания к layout/DI, которые не блокируют экспорт, но влияют на качество схемы в Camunda:
- координаты pool требуют доводки
- lanes нужно сдвинуть вплотную друг к другу
- backward branches стоит рисовать как более аккуратный "мостик"
- нужно увеличить зазоры между tasks, gateways и events

Эти замечания выносятся в отдельную следующую итерацию по polishing layout.

## Важное ограничение
Итерация 3 опирается на текущий shape reference из `reference_bpmn.bpmn`, но не обязана повторять его byte-to-byte.

Требование не в буквальном совпадении XML, а в функциональной эквивалентности:
- корректная semantic структура
- корректный BPMN DI
- корректное открытие в Camunda