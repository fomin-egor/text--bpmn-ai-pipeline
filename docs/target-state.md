# Целевое состояние прототипа

## Назначение
Прототип должен эволюционировать из локального layout playground в узкий, но устойчивый pipeline генерации BPMN для процессов с lanes.

Ключевой принцип остаётся таким:
- LLM отвечает за понимание естественного языка и построение структурированного черновика.
- Валидация, нормализация, layout и BPMN XML export остаются детерминированной инженерной частью.

## Целевой пользовательский сценарий
1. Пользователь открывает веб-приложение.
2. Пользователь настраивает подключение к LLM.
3. Пользователь описывает процесс естественным языком в чате.
4. Система переводит описание в структурированный JSON / Process IR.
5. Система валидирует и нормализует результат.
6. Layout engine строит визуальный граф.
7. Пользователь видит диаграмму, JSON-модель и диагностические сообщения.
8. Система генерирует BPMN XML с семантической и DI-частью.
9. Пользователь экспортирует `.bpmn` и открывает его в Camunda Modeler.

## Границы MVP
Поддерживаемый BPMN-light поднабор:
- один process в одном pool
- lanes
- startEvent
- endEvent
- task
- exclusiveGateway
- parallelGateway
- sequenceFlow
- backward edges как инженерная семантика возвратных переходов для layout

Что не входит в MVP:
- message flows
- choreography
- boundary events
- event subprocesses
- text annotations
- compensation
- call activities
- полноценное редактирование BPMN XML на canvas

## Целевая архитектура
Система должна быть разделена на независимые слои.

### Chat UI
Ответственность:
- история чата
- ввод текста
- показ результата генерации
- показ ошибок и диагностических сообщений

### LLM Client Layer
Ответственность:
- управление конфигурацией провайдера
- выполнение chat completion запросов
- скрытие HTTP-деталей от остальных слоёв
- поддержка OpenRouter и локальных OpenAI-compatible моделей

### Process IR Layer
Ответственность:
- хранение нормализованной структуры процесса
- роль основного внутреннего контракта
- пригодность для LLM output, validation, layout и export

### Validation and Normalization Layer
Ответственность:
- проверка структуры и ссылочной целостности
- исправление небольших дефектов
- нормализация направления связей и принадлежности к lane
- формирование warnings и hard errors

### Layout Layer
Ответственность:
- преобразование Process IR во view model
- назначение колонок и позиции в lanes
- детерминированный расчёт координат и маршрутов
- возможность позже заменить dagre на более сильный layout engine

### BPMN Export Layer
Ответственность:
- генерация semantic BPMN model
- генерация BPMN DI из layout result
- сериализация `.bpmn`
- обеспечение совместимости с Camunda

## Целевой стек
Frontend:
- Vite
- React
- TypeScript
- React Flow для preview/edit playground

Backend:
- Node.js
- лёгкий HTTP server

Ключевые интеграции:
- OpenAI-compatible HTTP API для LLM
- `@dagrejs/dagre` как текущий baseline layout engine
- `bpmn-moddle` для BPMN XML generation
- опционально позже: `elkjs` как следующий кандидат для layout

## Представления данных
В системе должны существовать три разные формы данных.

1. Chat input/output
Сырой пользовательский текст и сырые ответы LLM.

2. Process IR
Нормализованный внутренний контракт процесса.

3. Layouted diagram model
Process IR плюс координаты, размеры и маршруты для preview и BPMN DI.

## Ключевые инженерные решения
- Не генерировать BPMN XML напрямую из LLM.
- Не смешивать chat state, IR, layout state и export state в один объект.
- Считать текущую `ProcessDefinition` временной preview/layout model.
- Ввести `ProcessIR` как доменную модель следующего этапа.
- Делать layout и export детерминированными для одного и того же IR.

## Статус итерации 1
В текущем прототипе уже реализовано:
- LLM chat UI
- конфигурация OpenRouter и local provider
- два режима транспорта для OpenRouter: `Local proxy` и `Browser direct (Experimental)`
- улучшенная диагностика proxy для upstream и network ошибок
- парсинг и валидация JSON draft
- маппинг в текущую dagre/React Flow preview model
- построение графа по сгенерированному результату
- хранение chat/config/status state на уровне страницы, чтобы состояние не сбрасывалось при переключении вкладок
