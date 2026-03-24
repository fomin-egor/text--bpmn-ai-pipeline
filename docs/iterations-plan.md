# План итераций

## Принципы разбиения
Каждая итерация должна давать рабочий вертикальный срез, а не набор разрозненных модулей.

Порядок приоритетов:
- сначала end-to-end путь
- потом устойчивость
- потом BPMN XML export
- потом UX и развитие layout

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
Итерация уже реализована в текущем прототипе.

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

### Результат
Система работает уже не от произвольного draft JSON, а от стабильного внутреннего контракта.

### Артефакты
- типы Process IR
- validation rules
- normalization rules
- mapping layer из IR в layout input

## Итерация 3. BPMN Export MVP
### Цель
Научиться экспортировать `.bpmn`, который открывается в Camunda.

### Scope
- подключить `bpmn-moddle`
- semantic mapping `ProcessIR -> BPMN`
- DI mapping `layout result -> BPMN DI`
- export action из UI
- smoke validation через повторный import

### Результат
Пользователь может выгрузить BPMN XML из построенного процесса.

### Артефакты
- export service
- XML serializer
- download action
- checklist совместимости с Camunda

## Итерация 4. Устойчивость и UX
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
- diagnostics UI
- session persistence
- richer validation messages

## Итерация 5. Layout Engine v2
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

## Почему именно так
- Итерация 1 даёт первый end-to-end MVP.
- Итерация 2 не даёт архитектуре расползтись до старта XML export.
- Итерация 3 даёт главный продуктовый результат: `.bpmn` файл.
- Итерация 4 повышает пригодность прототипа для исследования и тестов.
- Итерация 5 улучшает качество layout, не блокируя основной pipeline.
