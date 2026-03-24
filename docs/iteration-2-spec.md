# Краткая спецификация итерации 2

## Название
Итерация 2: введение `Process IR`

## Статус
Итерация реализована.

## Цель
Отделить доменную модель процесса от текущей preview/layout model и построить устойчивый deterministic pipeline перед будущим BPMN export.

## Реализованный pipeline
После итерации 2 pipeline выглядит так:

`user text -> LLM -> Process IR draft -> parse -> normalize -> validate -> preview mapper -> ProcessDefinition -> dagre layout`

Смысл слоёв:
- LLM возвращает draft Process IR
- deterministic код приводит draft к канонической форме
- deterministic код проверяет инварианты модели
- preview mapper переводит валидный Process IR в текущую preview model для dagre и React Flow

## Что изменилось по сравнению с итерацией 1
До итерации 2:
- LLM генерировала JSON, близкий к preview model
- parser/validator были привязаны к renderer-oriented структуре

После итерации 2:
- LLM генерирует draft `Process IR`
- preview model стала производной формой
- появился отдельный `process-ir` слой
- diagnostics показывают raw draft, normalized IR, warnings и errors отдельно от итогового process JSON

## Реализованные модули
### Process IR types
Файл: `src/process-ir/types.ts`

Введены:
- `ProcessIr`
- `ProcessMeta`
- `ProcessLaneIr`
- `ProcessNodeIr`
- `ProcessEdgeIr`
- `ProcessWarning`
- результаты parse / normalize / validate

## Актуальная целевая эволюция Process IR
Поверх уже реализованной итерации 2 принято следующее развитие модели:
- `laneId` перестаёт быть обязательным для всех узлов
- `task` остаётся lane-bound
- `startEvent`, `endEvent`, `exclusiveGateway`, `parallelGateway` становятся lane-agnostic для целей layout
- backward edges сохраняются как `kind: backward`, но их геометрия должна определяться не жёстким шаблоном, а более умным router-слоем

Это изменение не отменяет итерацию 2, а уточняет её как основу для следующей эволюции layout.

### Parse draft
Файл: `src/process-ir/parseDraft.ts`

Функция:
- `parseProcessIrDraft(text)`

Что делает:
- извлекает JSON-object из текста ответа LLM
- поддерживает raw JSON и fenced JSON
- парсит JSON
- в случае ошибки возвращает `success: false`, `rawJson`, `errors`

### Normalizer
Файл: `src/process-ir/normalizeProcessIr.ts`

Функция:
- `normalizeProcessIrDraft(input)`

Работает после parse.
Возвращает:
- нормализованный `ProcessIr`
- `normalization warnings`

### Реальные правила normalizer
#### Корневой уровень
- `version` по умолчанию становится `1.0`, если не передана
- `process.id` берётся из `process.id` или fallback из `root.id`
- `process.poolId` берётся из `process.poolId` или fallback из `pool.id`
- `process.poolLabel` берётся из `process.poolLabel` или fallback из `pool.label`
- `process.title`, `poolLabel`, `description` проходят через trim

#### Нормализация идентификаторов
Функция `normalizeIdentifier(...)` делает:
- lowercase
- замену последовательностей не-`[a-z0-9]` на `_`
- удаление `_` по краям
- fallback-значение, если исходное поле пустое

Применяется к:
- `process.id`
- `process.poolId`
- `lane.id`
- `node.id`
- `edge.id`

Если значение изменилось, normalizer пишет warning.

#### Нормализация lanes
Для каждой lane:
- `id` нормализуется
- `label` trim-ится
- если label пустой, подставляется `Lane N`
- `order` назначается детерминированно по индексу массива
- `actor` trim-ится

Дополнительно:
- строится `laneIdMap`, чтобы привязать старые ids к нормализованным ids

#### Нормализация nodes
Для каждого node:
- `id` нормализуется
- `label` trim-ится
- `laneId` берётся из `laneId` или fallback из `lane`
- если lane id был переименован на шаге lanes, node получает уже нормализованный lane id
- `type` приводится к допустимому множеству
- если тип не поддержан, он принудительно становится `task` с warning
- `bpmnType` trim-ится
- `system` trim-ится
- `gatewayRole` сохраняется только если входит в `split | join | decision`
- `metadata` сохраняется только как `Record<string, string | number | boolean>`
  все прочие типы значений отбрасываются

Дополнительно:
- строится `nodeIdMap`, чтобы edges могли ссылаться на уже нормализованные ids

#### Актуальное уточнение по `laneId`
Текущее реализованное правило normalizer всё ещё подхватывает `laneId` почти для всех узлов, но целевая спецификация меняется:
- `laneId` должен оставаться обязательным только для task-like узлов
- у `event/gateway` normalizer не должен принудительно подставлять или сохранять lane как жёсткое layout-ограничение
- для `event/gateway` `laneId` допускается как soft metadata

#### Нормализация edges
Для каждого edge:
- `id` нормализуется
- `source` и `target` перепривязываются через `nodeIdMap`, если id узлов были переименованы
- `label` trim-ится
- `condition` trim-ится
- `isDefault` сохраняется только если это boolean
- `kind` нормализуется
  - `backward` остаётся `backward`
  - всё остальное становится `forward`
- если `kind` отсутствует, подставляется `forward` с warning

### Validator
Файл: `src/process-ir/validateProcessIr.ts`

Функция:
- `validateProcessIr(value)`

Работает после normalizer.
Возвращает:
- `ok`
- `errors`
- `warnings`
- валидный `ProcessIr`, если `ok: true`

### Реальные проверки validator
#### Process-level проверки
Ошибки, если отсутствуют:
- `process.id`
- `process.title`
- `process.poolId`
- `process.poolLabel`

Ошибки, если пусты массивы:
- `lanes`
- `nodes`
- `edges`

#### Проверки lanes
Для каждой lane:
- `lane.id` обязателен
- `lane.label` обязателен
- `lane.id` должен быть уникальным
- `lane.order` должен быть уникальным

#### Проверки nodes
Для каждого node:
- `node.id` обязателен
- `node.id` должен быть уникальным
- `node.type` должен входить в допустимое множество
- `node.label` обязателен
- в текущей реализации `node.laneId` должен ссылаться на существующий lane

Дополнительный warning:
- если node является `exclusiveGateway` или `parallelGateway`, но у него нет `gatewayRole`, validator пишет warning

#### Актуальное уточнение по validator
Целевая спецификация валидатора меняется так:
- `task` обязан иметь `laneId`
- `startEvent`, `endEvent`, `exclusiveGateway`, `parallelGateway` могут не иметь `laneId`
- проверка существования `laneId` остаётся только для тех узлов, у которых `laneId` действительно задан

#### Проверки структуры start/end
Ошибки, если:
- нет ни одного `startEvent`
- нет ни одного `endEvent`

#### Проверки edges
Для каждого edge:
- `edge.id` обязателен
- `edge.id` должен быть уникальным
- `source` должен ссылаться на существующий node
- `target` должен ссылаться на существующий node
- self-loop запрещён
- `kind` должен быть `forward` или `backward`

## Preview mapper
Файл: `src/process-ir/mapProcessIrToDefinition.ts`

Функция:
- `mapProcessIrToDefinition(processIr)`

Что делает:
- переводит валидный `ProcessIr` в текущую `ProcessDefinition`
- сортирует lanes по `order`
- преобразует `laneId -> lane`
- назначает размеры узлов по типу
- оставляет preview model пригодной для текущего dagre и React Flow renderer

## Актуальное уточнение по preview mapper
Текущий mapper всё ещё делает жёсткую lane-привязку для всех узлов, но целевая модель меняется:
- task должны оставаться lane-bound
- event/gateway не должны насильно снапиться к центру lane
- preview layer должен уметь использовать `preferredY` от dagre для lane-agnostic элементов

## Изменение взаимодействия с LLM
### Что просим у LLM теперь
Prompt переведён на draft `Process IR`.

LLM должна вернуть:
- `version`
- `process`
- `lanes`
- `nodes`
- `edges`
- при использовании gateway — `gatewayRole`

### Актуальное уточнение prompt contract
Для следующей версии prompt желательно зафиксировать:
- lane обязательно указывать для `task`
- для `event/gateway` lane можно не указывать
- LLM не должна пытаться описывать геометрию backward edge
- LLM описывает только семантику `kind: backward`, а сам маршрут выбирает layout/router слой

### Что LLM больше не делает
LLM не подгоняет ответ под renderer specifics.
Она не должна знать ничего о размерах узлов, React Flow state или координатах.

## Diagnostics UI
В правой панели теперь есть отдельная вкладка `Diagnostics`.

Показывается:
- `Validation errors`
- `Normalization warnings`
- `Validation warnings`
- `Raw LLM JSON`
- `Normalized Process IR`

Во вкладке `Process JSON` показывается уже итоговая preview model, а не raw draft.

## Что не делалось в итерации 2
Не входит в реализованный scope:
- BPMN XML export
- BPMN DI export
- `DataStoreReference`
- `TextAnnotation`
- повторные автоматические обращения к LLM для исправления ошибок
- streaming
- отдельный `pre-validate` этап

## Критерии завершения итерации 2
Итерация считается завершённой, потому что:
- существует отдельный тип `ProcessIR`
- LLM генерирует именно draft `Process IR`
- есть deterministic `parse -> normalize -> validate` pipeline
- есть явный mapper `ProcessIR -> ProcessDefinition`
- diagnostics показывают raw draft, normalized IR, warnings и errors
- текущий graph preview строится уже не от ad hoc JSON, а от валидного внутреннего IR

## Что зафиксировано как следующее развитие после итерации 2
На базе итерации 2 принято следующее направление:
- уйти от жёсткой lane-привязки для event/gateway
- сохранить `dagre y` там, где он полезен для разведения элементов
- сделать lanes адаптивными по высоте
- развивать backward routing от жёсткого bridge-шаблона к более умному выбору обхода с меньшим числом пересечений и изломов