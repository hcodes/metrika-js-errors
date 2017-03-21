# Отслеживание js-ошибок с помощью Метрики
Использование системы сбора js-ошибок на сайте трудно переоценить.
Даже на покрытом тестами сайте возникают js-ошибки, важно их найти и починить.
Расскажу как искал для себя универсальное решение.
<habracut/>

Существует три вида систем сбора js-ошибок.

### Первый вид
Самописная система. Добавляем небольшой js-код на сайт:
```js
window.onerror = function(msg, file, line, col) {
    new Image().src = '/jserrors/?msg=' + msg + ...;
}
```
Делаем «ручку» для сохранения ошибок, парсим логи.
В лучшем случае, пишем свой интерфейс для анализа ошибок.
Потом занимаемся доработкой и поддержкой.

### Второй вид
Платный сервис с расширенными возможностями, но с ограничениями, например, на количество js-ошибок в день или месяц.
На любой сайт поставить эту систему не получится, придётся каждый раз выбирать какой из ваших сайтов "достоин" платного сервиса.
И не забывать оплачивать услуги.

Также придётся добавить на сайт внешний скрипт, который будет отрицательно влиять на скорость загрузки вашего сайта.

### Третий вид
Использовать для сбора ошибок систему аналитики.
Необходимо установить на сайт полноценный код отслеживания системы аналитики.
Так как код отслеживания загружается асинхронно, то отправка ошибок будет доступна только после его загрузки.
У данной системы должны быть отчёты, которые можно самостоятельно формировать.

### Решение

Если объединить первый и третий вид, то получим компактный js-код. Ошибки будем вручную отправлять в [Яндекс.Метрику](https://metrika.yandex.ru).
Её преимущества в том, что она бесплатна, нет особых ограничений на количество счётчиков и собираемых данных.
А также имеются необходимые отчёты и инструменты для анализа данных.

Для сбора ошибок в Метрике подойдёт отчёт «[Параметры визитов](https://yandex.ru/support/metrika/reports/visit-params.xml)».

1. [Заведём](https://metrika.yandex.ru/add) отдельный счётчик.

2. Добавим на страницу <b>перед всеми скриптами код</b>:
```html
<script>
    // После минификации не более 320 байт.
    window.onerror = function(msg, file, line, col, err) {
        // Отсекаем совсем старые браузеры.
        if (!window.JSON) { return; }

        var counterId = 12345, // Ваш номер счётчика Метрики.
            siteInfo = {},
            pointer = siteInfo;
            // Список параметров визитов.
            path = [
                'JS errors', // 1 уровень
                msg, // 2 уровень
                err && err.stack || (file + ':' + line + ':' + col) // 3 уровень
                // Не хватает параметров? Добавьте ещё!
            ];

        // Преобразуем параметры из плоского в древовидный вид для отчёта.
        for (var i = 0; i < path.length - 1; i++) {
            var item = path[i];
            pointer[item] = {};
            pointer = pointer[item];
        }

        pointer[path[i]] = 1;

        new Image().src = 'https://mc.yandex.ru/watch/' + counterId +
            '/?site-info=' + encodeURIComponent(JSON.stringify(siteInfo))
            '&rn=' + Math.random();
    };
</script>
```

3. Не забываем указать в коде свой номер счётчика (counterId).

4. Получаем примерно [такой отчёт](https://metrika.yandex.ru/stat/user_vars?group=dekaminute&chart_type=pie&period=2017-03-12%3A2017-03-12&id=43395579):
<img src="https://raw.githubusercontent.com/hcodes/metrika-js-errors/master/screenshots/1.png" />

Структуру и порядок параметров в отчёте можно менять на лету, а также добавлять новые параметры.
Давайте с помощью кнопки «Группировки» добавим [браузер и ОС](https://metrika.yandex.ru/stat/user_vars?selected_rows=yZkKR9&chart_type=pie&period=2017-03-12%3A2017-03-12&metrics=ym%3As%3Avisits%2Cym%3As%3AsumParams&dimensions=ym%3As%3AparamsLevel1%2Cym%3As%3AoperatingSystemRoot%2Cym%3As%3Abrowser%2Cym%3As%3AparamsLevel2%2Cym%3As%3AparamsLevel3%2Cym%3As%3AparamsLevel4%2Cym%3As%3AparamsLevel5&id=43395579) в отчёт.
<img src="https://raw.githubusercontent.com/hcodes/metrika-js-errors/master/screenshots/3.png" />


<img src="https://raw.githubusercontent.com/hcodes/metrika-js-errors/master/screenshots/4.png" />

И ещё один момент, если скрипты на сайте загружаются с другого домена (CDN), то в отчёте, скорее всего, будут видны сообщения вида «Script error» и без стека.
Чтобы вернуть сообщениям нормальный вид, необходимо добавить к скриптам атрибут `crossorigin="anonymous"` и HTTP-заголовок `Access-Control-Allow-Origin:"*"`.
```html
<script src="https://mycdn.com/folder/file.js" crossorigin="anonymous"></script>
```

Постепенно в отчёте будут появляться ошибки от расширений браузеров, вирусов и внешних скриптов (рекламных систем, кнопок социальных сетей и пр.). Чтобы отделить эти ошибки, добавим проверку доменов с помощью регулярного выражения.

Дополнительно добавим ограничение на собираемое количество ошибок (не более 5) на странице. Например, ошибки, возникающие при движении мышки, могут создать сотни запросов в Метрику.

В современных браузерах данные будем отправлять через `sendBeacon`.

```html
<script>
window.onerror = function handler(msg, file, line, col, err) {
    if (!window.JSON || handler.count > 5) { return; }

    var counterId = 12345, // Ваш номер счётчика Метрики.
        siteInfo = {},
        pointer = siteInfo,
        stack = err && err.stack,
        path = [
            // Укажите в регулярном выражении домены, с которых загружаются ваши скрипты и сайт.
            'JS ' + (!file || /mysite\.ru|cdn\.com/.test(file) ? 'in' : 'ex') + 'ternal errors',
            'message: ' + msg,
            stack ?
                'stack: ' + stack :
                (file ? 'file: ' + file + ':' + line + ':' + col : 'nofile'),
            'href: ' + location.href
        ];

    for (var i = 0; i < path.length - 1; i++) {
        var item = path[i];
        pointer[item] = {};
        pointer = pointer[item];
    }

    pointer[path[i]] = 1;

    var url = 'https://mc.yandex.ru/watch/' + counterId + '/' +
            '?site-info=' + encodeURIComponent(JSON.stringify(siteInfo)) +
            '&rn=' + Math.random();

    if (typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url, ' ');
    } else {
        new Image().src = url;
    }

    if (handler.count) {
        handler.count++;
    } else {
        handler.count = 1;
    }
};
</script>
```

И ещё, данные по ошибкам можно получить с помощью [API](https://tech.yandex.ru/metrika/) и сделать с ними всё что угодно.

Не забудьте добавить ссылки на отчёты по ошибкам в свою документацию на видное место.
И дать [доступ](https://yandex.ru/support/metrika/general/access.xml) к отчёту остальным разработчикам из группы, чтобы исправление ошибок превратилось в соревнование :)

Ссылки:
- [GitHub](https://github.com/hcodes/metrika-js-errors/)
- Отчёт «[Параметры визитов](https://yandex.ru/support/metrika/reports/visit-params.xml)»
- [Пример отчёта](https://metrika.yandex.ru/stat/user_vars?selected_rows=yZkKR9&chart_type=pie&period=2017-03-12%3A2017-03-12&metrics=ym%3As%3Avisits%2Cym%3As%3AsumParams&dimensions=ym%3As%3AparamsLevel1%2Cym%3As%3AoperatingSystemRoot%2Cym%3As%3Abrowser%2Cym%3As%3AparamsLevel2%2Cym%3As%3AparamsLevel3%2Cym%3As%3AparamsLevel4%2Cym%3As%3AparamsLevel5&id=43395579) в Метрике
