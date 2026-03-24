# Спецификация автолейаута прототипа

## Назначение
Текущий автолейаут предназначен не для полного BPMN editor, а для исследовательского прототипа.

Задача layout-слоя:
- разложить основной поток слева направо
- сохранить глобальные колонки по `x`
- корректно работать с lanes как с визуальными контейнерами
- не ломать основной flow возвратными связями
- подготовить bounds и waypoints для BPMN DI export

Основная реализация находится в:
- `src/layout/applyDagreLayout.ts`

## Входные данные
Автолейаут получает `ProcessDefinition`.

Используются поля:
- `lanes`
- `nodes`
- `edges`
- размеры node из `node.size`
- lane привязка узла из `node.lane`
- тип связи из `edge.kind`

## Общий pipeline layout
1. Из `ProcessDefinition` собирается граф для `dagre`.
2. В `dagre` передаются все nodes с их layout-габаритами.
3. В `dagre` передаются только `forward`-связи.
4. `dagre` рассчитывает базовые `x/y` центры узлов для основного потока.
5. Поверх этого layout-слой распределяет узлы по lanes и рассчитывает итоговую геометрию diagram.
6. Затем дополнительно вычисляются:
- pool bounds
- lane bounds
- node bounds
- edge waypoints

Итогом является `LayoutResult`.

## Почему в dagre идут только forward edges
Это сделано сознательно.

Цель:
- сохранить основной flow слева направо
- не дать loop/backward edges развалить rank structure

Правило:
- `forward` edges участвуют в rank assignment
- `backward` edges отображаются и экспортируются отдельно и не влияют на колонную структуру

## Направление раскладки
Используется:
- `rankdir: LR`

Это означает:
- graph строится слева направо
- dagre формирует колонки рангов по оси `x`

## Ключевое архитектурное уточнение
Исходная модель с жёстким snap-to-lane-center для всех узлов признана временной и подлежит замене.

Новая целевая модель:
- `task` остаются lane-bound
- `event/gateway` становятся lane-agnostic для целей layout
- `dagre y` должен сохраняться там, где он помогает развести элементы по вертикали
- lane должен быть не одной линией по `y`, а адаптивным контейнером переменной высоты

## Текущие константы layout
Текущие основные параметры прототипа:
- `HORIZONTAL_GAP = 112`
- `VERTICAL_GAP = 56`
- `LANE_HEIGHT = 176`
- `LANE_GAP = 0`
- `LANE_PADDING_Y = 20`
- `POOL_LABEL_WIDTH = 30`
- `CONTENT_PADDING_X = 120`
- `CONTENT_PADDING_Y = 28`
- `BACKWARD_EDGE_OFFSET_X = 44`
- `BACKWARD_EDGE_OFFSET_Y = 34`
- `BACKWARD_EDGE_STACK_STEP = 18`

Смысл этих параметров:
- `HORIZONTAL_GAP` управляет расстоянием между колонками dagre
- `VERTICAL_GAP` управляет расстоянием между соседними ветками в ранге
- `LANE_HEIGHT` задаёт базовую высоту lane
- `LANE_GAP = 0` делает lanes вплотную друг к другу
- `LANE_PADDING_Y` задаёт внутренние вертикальные поля lane
- `POOL_LABEL_WIDTH` резервирует слева вертикальную подпись pool
- `CONTENT_PADDING_X/Y` задают поля вокруг графа
- `BACKWARD_*` управляют текущим bridge-style routing

## Правила расчёта lanes
### Текущая реализация
Сейчас lanes рассчитываются вручную по индексам:
- у каждого lane есть `top`
- у каждого lane есть `bottom`
- у каждого lane есть `contentTop`
- у каждого lane есть `contentBottom`
- у каждого lane есть `centerY`

Формула верхней границы lane:
- `top = HEADER_HEIGHT + laneIndex * (LANE_HEIGHT + LANE_GAP)`

Сейчас:
- `HEADER_HEIGHT = 0`
- `LANE_GAP = 0`

Следствие:
- lanes идут вплотную друг к другу
- высота pool равна сумме высот lanes

### Целевая модель
Текущая фиксированная высота lane должна быть заменена на адаптивную.

Целевые правила:
- у lane есть минимальная базовая высота
- если внутри lane на одном rank/близком `x` оказалось несколько элементов, lane должен уметь расширяться по `y`
- task внутри lane могут занимать разные `y`, если этого требует layout
- `event/gateway` не должны насильно выравниваться в центр lane

## Правила размещения nodes
### По оси X
Ось `x` определяется `dagre`.

Это даёт:
- глобальные колонки
- общий left-to-right flow
- одинаковую rank-логику для узлов в разных lanes

### По оси Y: текущая модель
В текущей реализации `y` для lane-bound элементов переопределяется вручную по lane.

Это уже выявлено как ограничение, потому что:
- dagre может специально разводить несколько элементов одного rank по `y`
- жёсткий snap-to-lane-center уничтожает это разведение
- из-за этого элементы могут налипать и частично пересекаться

### По оси Y: целевая модель
Новая целевая схема такая:
- `task` остаются привязанными к lane, но не обязаны иметь одинаковый `y` внутри lane
- `event/gateway` получают `preferredY` от dagre
- lane должен вмещать реальное вертикальное распределение узлов, а не принудительно сводить их к одной линии
- итоговый `y` должен быть как можно ближе к `dagre y`, а не жёстко вычисляться через центр lane

## Правила расчёта pool
Pool моделируется как общий контейнер всей схемы.

Текущие правила:
- `poolBounds.x = 0`
- `poolBounds.y = 0`
- `poolBounds.width = graphWidth`
- `poolBounds.height = graphHeight`

Особенность текущей геометрии:
- слева выделяется вертикальная зона шириной `POOL_LABEL_WIDTH = 30`
- в этой зоне рисуется подпись pool снизу вверх
- правая граница pool совпадает с правой границей lanes
- высота pool равна сумме heights всех lanes

## Правила расчёта lane bounds
Для каждого lane:
- `x = POOL_LABEL_WIDTH`
- `y = lane.top`
- `width = graphWidth - POOL_LABEL_WIDTH`
- `height = laneHeight`

Целевое уточнение:
- `laneHeight` должен быть переменным и зависеть от фактического размещения узлов внутри lane

## Правила расчёта node bounds
Для каждого node сохраняются:
- `x`
- `y`
- `width`
- `height`

Эти данные используются для:
- React Flow preview
- BPMN DI export

### Целевое уточнение по footprint
Для корректного layout нужно различать:
- render size фигуры
- layout footprint узла

Это особенно важно для:
- `event`
- `gateway`
- узлов с label area вне основной фигуры

## Правила расчёта edges
### Forward edges
Для обычных связей строится базовый orthogonal path:
- старт из правой грани source
- промежуточная вертикаль через `middleX`
- финиш в левой грани target

### Backward edges: текущая модель
Сейчас используется bridge-style template:
- выход вправо из source
- подъём вверх
- горизонтальный проход над основным потоком
- спуск вниз к target
- вход в target слева

Для этого используются:
- `BACKWARD_EDGE_OFFSET_X`
- `BACKWARD_EDGE_OFFSET_Y`
- `BACKWARD_EDGE_STACK_STEP`

### Backward edges: целевая модель
Да, возвратный поток не должен быть навсегда зафиксирован как жёсткая структура `вправо -> вверх -> влево/вправо -> вниз`.

Более правильная цель:
- строить orthogonal route эвристически
- выбирать направление обхода так, чтобы было меньше:
  - пересечений с другими линиями
  - пересечений с фигурами
  - лишних изломов
- bridge-style path оставить как fallback baseline

Практически это означает переход к лёгкому orthogonal router-слою поверх dagre, который:
- получает bounds узлов и lanes
- получает source/target backward edge
- генерирует несколько candidate routes
- оценивает их по cost function
- выбирает маршрут с минимальной стоимостью

### Возможная cost function для backward routing
При выборе backward route можно учитывать:
- штраф за пересечение фигур
- штраф за пересечение других edges
- штраф за число bends
- штраф за слишком длинный путь
- небольшой штраф за выход за предпочитаемую corridor area

Это хороший путь, потому что он не привязывает layout к одному шаблону, но остаётся детерминированным.

## Использование layout result
`LayoutResult` состоит из:
- `nodes`
- `edges`
- `metrics`
- `diagram`

### `metrics`
Используется в preview для фонового рендера pool и lanes.

### `diagram`
Используется как контракт для BPMN DI export:
- `poolBounds`
- `laneBounds`
- `nodeBounds`
- `edgeWaypoints`

## Важные ограничения текущего layout
Текущий layout сознательно упрощён.

Он:
- не учитывает полный BPMN semantics
- не оптимизирует edge crossings глобально
- не делает интеллектуальную упаковку dense graphs
- не реализует полноценный orthogonal router
- всё ещё частично опирается на жёсткую lane-модель для узлов
- не выравнивает diagram под byte-identical Camunda output

## Ключевые архитектурные принципы
1. `dagre` отвечает за rank/column structure основного потока.
2. Lane placement не должен уничтожать полезное `y`-разведение, рассчитанное dagre.
3. `task` и `event/gateway` должны иметь разные правила привязки к lanes.
4. Backward edges не должны влиять на rank assignment.
5. Preview и BPMN export должны использовать один и тот же layout result.
6. Backward routing должен эволюционировать в эвристический orthogonal router, а не оставаться жёстким шаблоном навсегда.

## Что дальше можно улучшать
Следующие естественные направления развития:
- сделать lane heights адаптивными
- ввести layout footprint отдельно от render size
- перенести label у events вниз и учитывать его в footprint
- реализовать custom edge renderer, который использует рассчитанные waypoints
- развить backward routing от bridge-template к candidate-based router
- тоньше согласовать pool/lane bounds с Camunda rendering
- при необходимости ввести второй layout engine наряду с dagre