# План итераций

## Принципы разбиения
Каждая итерация должна давать рабочий вертикальный срез, а не набор разрозненных модулей.

Порядок приоритетов:
- сначала end-to-end путь
- потом устойчивость модели и pipeline
- потом BPMN XML export
- потом выравнивание layout с ожидаемым Camunda output
- потом развитие layout в сторону более умной геометрии и routing
- потом UX и развитие layout engine

## Итерация 1. LLM Playground
### Цель
Дать первый рабочий путь:
`chat -> JSON draft -> validation -> current canvas`

### Scope
- UI для конфигурации LLM подключения
- UI чата
- OpenAI-compatible backend proxy
- prompt template для генерации процесса
- parser и validator для JSON draft
- преобразование в текущую preview model
- построение графа текущим dagre layout
- отдельная вкладка с process JSON справа

### Фактический результат
Итерация реализована.

Сделано:
- chat UI и настройки подключения
- поддержка OpenRouter
- поддержка local OpenAI-compatible provider
- выбор транспорта для OpenRouter:
  - `Local proxy (Recommended)`
  - `Browser direct (Experimental)`
- диагностика upstream и network ошибок в proxy
- preview сгенерированного процесса в React Flow
- отдельная вкладка `Process JSON`
- состояние чата, конфигурации и статуса поднято на уровень страницы и не сбрасывается при переключении вкладок

### Критерии завершения
- пользователь может отправить текстовое описание процесса
- приложение получает ответ LLM
- приложение валидирует возвращённый JSON
- приложение строит граф текущим dagre renderer
- приложение показывает полезную диагностику при ошибках

## Итерация 2. Введение Process IR
### Цель
Отделить доменную модель от preview/layout model.

### Scope
- ввести `ProcessIR`
- ввести normalizer
- ввести validator
- ввести warnings/errors model
- сделать mapping `ProcessIR -> layout view model`
- переключить LLM output contract с ad hoc JSON на Process IR

### Фактический результат
Итерация реализована.

Сделано:
- типы Process IR
- deterministic pipeline `parse -> normalize -> validate -> preview mapper`
- diagnostics UI для raw JSON, normalized IR, warnings и errors
- mapping `ProcessIR -> ProcessDefinition`
- единый внутренний контракт между LLM, preview и следующими слоями

### Уточнение после реализации
На следующем витке развития приняты дополнительные изменения модели:
- `laneId` должен быть обязательным только для `task`
- `event/gateway` не должны быть жёстко lane-bound для целей layout
- backward edges остаются семантическими `kind: backward`, но их геометрия должна решаться layout/router слоем

### Критерии завершения
- LLM отдаёт draft Process IR
- normalizer и validator работают детерминированно
- UI показывает normalized IR и diagnostics
- preview строится уже не напрямую из raw draft, а из валидного IR

## Итерация 3. BPMN Export MVP
### Цель
Научиться экспортировать `.bpmn`, который открывается в Camunda.

### Scope
- semantic mapping `ProcessIR -> BPMN`
- DI mapping `layout result -> BPMN DI`
- XML serializer
- просмотр BPMN XML в UI
- export action из UI
- smoke validation через открытие в Camunda

### Фактический результат
Итерация реализована.

Сделано:
- deterministic BPMN export из `ProcessIR + layout result`
- BPMN XML tab в UI
- download action `.bpmn`
- экспорт открывается в Camunda
- layout result расширен bounds и waypoints для BPMN DI

### Критерии завершения
- пользователь может выгрузить BPMN XML из построенного процесса
- XML открывается в Camunda
- XML доступен для просмотра в UI

## Итерация 4. Layout Polish и Camunda Alignment
### Цель
Довести автолейаут и BPMN DI до более аккуратного визуального результата, который ближе к ожидаемому отображению в Camunda.

### Scope
- поправить координаты pool
- сделать lanes вплотную друг к другу без лишних зазоров
- скорректировать routing возвратных веток так, чтобы они шли как аккуратный мостик
- увеличить зазоры между tasks, gateways и events
- уменьшить расхождения между preview в прототипе и тем, что видно после открытия `.bpmn` в Camunda
- проверить несколько эталонных схем и скорректировать layout constants

### Актуальное уточнение
В ходе анализа зафиксировано, что одного polishing текущей схемы недостаточно.

Следующий шаг должен включать смену части layout-модели:
- отказаться от жёсткой lane-привязки для events/gateways
- сохранить полезное `dagre y` для lane-agnostic элементов
- сделать высоту lane адаптивной
- перестать уничтожать вертикальное разведение dagre snap-to-lane-center логикой

### Результат
Экспорт остаётся детерминированным, но визуальное качество схемы заметно улучшается и становится ближе к ожидаемому BPMN-результату.

### Артефакты
- уточнённый layout contract
- улучшенные waypoints для backward branches
- доработанные pool/lane bounds
- набор визуальных кейсов для сверки с Camunda

## Итерация 5. Adaptive Layout Model
### Цель
Перестроить layout-модель так, чтобы она не боролась с dagre, а использовала его вертикальное разведение и давала более устойчивую геометрию для сложных схем.

### Scope
- разделить task-like и lane-agnostic узлы в правилах layout
- сделать `laneId` необязательным для event/gateway на уровне pipeline
- ввести адаптивную высоту lanes
- сохранить `preferredY` от dagre для event/gateway
- учитывать layout footprint отдельно от render size
- перенести label event вниз и учитывать его в footprint
- реализовать custom edge renderer, который использует рассчитанные waypoints
- начать переход от жёсткого bridge-template к candidate-based backward router

### Результат
Layout становится более естественным для BPMN-подобных схем и значительно снижает риск наложения gateway/event на соседние шаги.

### Артефакты
- обновлённый layout contract
- новые validator/normalizer rules для lane-agnostic узлов
- adaptive lane sizing
- layout footprint model

## Итерация 6. Устойчивость и UX
### Цель
Сделать прототип удобным для повторяемого реального тестирования.

### Scope
- richer LLM diagnostics
- IR/debug editor panel
- ручной rerun normalization
- сохранение и загрузка session
- сравнение raw LLM JSON и normalized IR
- предупреждения layout для проблемных схем

### Результат
Прототип становится рабочим исследовательским инструментом, а не одноразовой демо-сборкой.

### Артефакты
- diagnostics UI v2
- session persistence
- richer validation messages

## Итерация 7. Layout Engine v2
### Цель
Снизить зависимость от ограничений dagre.

### Scope
- выделить формальный layout engine interface
- оставить dagre как baseline
- исследовать `elkjs`
- улучшить routing для loops и dense branches
- улучшить lane packing logic

### Результат
Layout можно развивать без переписывания chat, IR и export слоёв.

### Артефакты
- layout abstraction
- второй layout prototype
- набор cases для сравнения движков

## Рекомендуемый порядок
1. Итерация 1
2. Итерация 2
3. Итерация 3
4. Итерация 4
5. Итерация 5
6. Итерация 6
7. Итерация 7

## Почему именно так
- Итерация 1 даёт первый end-to-end MVP.
- Итерация 2 не даёт архитектуре расползтись до старта XML export.
- Итерация 3 даёт главный продуктовый результат: `.bpmn` файл.
- Итерация 4 улучшает визуальное качество layout и выравнивает экспорт с тем, что ожидается увидеть в Camunda.
- Итерация 5 меняет саму геометрию layout и устраняет системные причины наложений и конфликтов по `y`.
- Итерация 6 повышает пригодность прототипа для длительного исследования и повторяемых тестов.
- Итерация 7 позволяет развивать сам layout engine без переписывания pipeline.