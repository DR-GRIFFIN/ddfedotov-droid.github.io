# Learning path: Director, Operational Data Strategy / Data Discovery (Clinical Ops) — AstraZeneca

_Составлено: ноябрь 2026. Горизонт: 10–12 месяцев, 3–5 ч/неделю (~200 ч всего)._

## 1. Профиль и цель

| Параметр | Ответ |
|---|---|
| Целевые роли | Director, Operational Data Strategy; Director, Data Discovery (клинические операции) |
| Бэкграунд | Клиника/фарма + данные |
| Технический уровень | Начальный (SQL, Python/R, ML, облако) |
| Время | 3–5 ч/неделю |
| Срок | 9–12 месяцев |
| Приоритет | Результат (портфолио, доказуемые навыки), а не формат |

## 2. Что AZ ждёт от таких ролей (по анализу вакансий)

Близкие по смыслу открытые/недавние позиции: *Senior Director, Clinical Operations Products & Platforms*,
*Director, Data Management* (data products, MDM, data marketplace), *Director, Data Science Operations*
(metadata, cataloguing, access, R&D Data Office), *Associate Director, Data Steward* (data dictionaries,
автоматизация data discovery), *Director, Operations IT – Data Lead* (semantic/knowledge strategy, AI-ready data products).

Общий знаменатель требований:

1. **Data strategy & operating model**: data products, data mesh, роли (owner / steward), roadmap, бизнес-кейс.
2. **Data discovery**: каталог, метаданные, глоссарий, lineage, data marketplace, доступ к данным.
3. **Governance & качество**: data quality, MDM/reference data, GxP, 21 CFR Part 11, ALCOA+, GDPR.
4. **Знание операционных данных клиники**: CTMS, EDC, IRT, eTMF, RBQM, KPI исследований.
5. **Платформы**: Snowflake (enterprise data platform AZ), Domino (MLOps / вычислительная среда),
   внутренние платформы (Navari) — нужно понимать, *что* они дают бизнесу, а не администрировать их.
6. **AI-readiness**: данные как основа для AI/GenAI (text-to-SQL, RAG, прогноз набора пациентов), AI governance.
7. **Лидерство**: влияние без прямого подчинения, работа с R&D Data Office, IT, Clin Ops.

> **Честная оценка разрыва.** Director-роли обычно требуют 8+ лет в governance/architecture/data products.
> Ваше преимущество — клинический домен. Технику нужно поднять до уровня «уверенно разговариваю с инженерами
> и сам могу проверить гипотезу на SQL». Реалистичная стратегия: подаваться на Director и параллельно на
> **Associate Director** (Data Steward, Data Product Owner Clin Ops) как ступень.

## 3. План по фазам

### Фаза 1 (мес. 1–2, ~35 ч). Фундамент: SQL и архитектура данных
- SQL с нуля до CTE и оконных функций: Snowflake free trial + Snowflake Quickstarts.
- Понятия: OLTP vs OLAP, warehouse / lake / lakehouse, star schema, ELT, data contracts.
- **Результат:** 20 решённых SQL-задач на учебной БД; глоссарий терминов (1 стр.) своими словами.

### Фаза 2 (мес. 3–4, ~35 ч). Операционные данные клинических исследований
- Ландшафт систем: CTMS, EDC, IRT/RTSM, eTMF, ePRO, safety; как они связаны (study → country → site → subject → visit).
- ICH E6(R3) и RBQM: KRI, QTL, централизованный мониторинг.
- CDISC — обзорно: ODM, SDTM (зачем, не программирование).
- Операционные KPI: site activation cycle time, enrollment rate vs plan, screen failure, data entry lag, query aging, protocol deviations.
- **Проект 1:** загрузить публичную базу **AACT (ClinicalTrials.gov)** в Snowflake, построить мини-витрину
  «операционные метрики исследований» (длительность, набор, число центров по фазам/областям) + простой дашборд (Snowsight/Streamlit).

### Фаза 3 (мес. 5–7, ~55 ч). Data strategy, governance, data discovery — ядро роли
- Книги/источники: *DAMA-DMBOK* (главы Governance, Metadata, Data Quality, MDM), *Data Mesh* (Zh. Dehghani, гл. 1–4), FAIR principles.
- Data discovery на практике: каталог (Snowflake Horizon, концепции Collibra/Alation), business glossary, lineage, классификация чувствительных данных.
- GxP-контекст: 21 CFR Part 11, ALCOA+, CSV/CSA, GDPR для данных пациентов.
- Domino и Navari: разобрать как *capabilities* — воспроизводимость, валидированные среды, self-service аналитика.
  Для Navari: собрать внутреннее описание (что за платформа, какие данные, кто владелец) — пригодится на интервью.
- **Сертификат:** DAMA **CDMP Associate** (экзамен «Data Management Fundamentals») — прямо про роль.
- **Проект 2:** каталог + глоссарий для витрины из Проекта 1: описания таблиц, владельцы, определения KPI,
  правила качества (проверки в SQL), схема lineage.

### Фаза 4 (мес. 8–9, ~35 ч). AI-ready данные и AI в Clin Ops
- Сценарии: прогноз набора и выбор центров, аномалии в RBQM, GenAI-ассистент по данным исследований
  (у AZ публично есть Development Assistant: RAG + text-to-SQL на AWS Bedrock).
- Что нужно от данных для AI: семантический слой, метаданные, качество, доступ.
- AI governance: EU AI Act, валидация моделей в GxP, human-in-the-loop.
- **Проект 3:** text-to-SQL поверх своей витрины (Snowflake Cortex Analyst + семантическая модель) —
  «задай вопрос об исследованиях на естественном языке».
- Опционально: **SnowPro Core** (если останется ресурс; иначе отложить).

### Фаза 5 (мес. 10–12, ~40 ч). Позиционирование и выход на рынок
- **Главный артефакт:** «Operational Data Strategy for Clinical Development» — 5–7 стр.:
  текущее состояние → видение (data products по доменам Clin Ops) → governance-модель → discovery/каталог →
  AI use cases → roadmap 12–24 мес. → метрики ценности (сокращение cycle time, время поиска данных).
- Портфолио: 3 проекта на GitHub + одна страница на сайте.
- 8–10 STAR-историй: влияние без полномочий, изменение процесса, конфликт приоритетов, решение на данных.
- Нетворкинг: 2–3 разговора в месяц с людьми из R&D Data Office / Clin Ops AZ, отраслевые митапы (PHUSE, DIA, SCDM).
- Подача: Director + Associate Director-роли, параллельно.

## 4. Еженедельный ритм (3–5 ч)
- 1 ч — теория (книга/курс);
- 2–3 ч — практика на проекте;
- 30 мин — заметка «что узнал → как это применить в Clin Ops» (позже станет материалом для strategy doc и интервью).

## 5. Контрольные точки
| Месяц | Проверка |
|---|---|
| 2 | Пишу SQL с JOIN/CTE/окнами без подсказок |
| 4 | Витрина AACT в Snowflake + дашборд работает |
| 7 | CDMP Associate сдан; каталог/глоссарий готов |
| 9 | Text-to-SQL демо работает на своих данных |
| 12 | Strategy doc, портфолио, отправлены заявки |

## 6. Открытые вопросы
- Navari: уточнить назначение и владельца внутри AZ — встроить в Фазу 3 и strategy doc.
- Текущая позиция (внутри AZ или вне) влияет на канал подачи: внутренний переход идёт через hiring manager и
  внутренний нетворк, это сильно сокращает требование к «формальному» опыту.
