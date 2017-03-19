# Отслеживание js-ошибок с помощью Метрики

Использование системы сбора ошибок на сайте трудно переоценить. Она поможет постоянно  тестировать ваш сайт и находить ошибки с помощью пользователей.

Но что же оставливает разработчиков от установки системы сбора ошибок на сайте?

### Первый вариант
Разработчик пишет свою систему, добавляет небольшой js-код на сайт:
```js
window.onerror = function(msg, file, line, col) {
    new Image().src = '/jserrors/?msg=' + msg + ...;
}
```
Делает «ручку» для сохранения ошибок, парсит логи, пишет свой интерфейс для анализа ошибок, занимается поддержкой. Другими словами, тратит время впустую.

### Второй вариант
Использовать готовое решение. Обычно, это платный сервис с ограничениями, например, на количество js-ошибок в день или месяц. Необходимо установить внешний js-скрипт, который, возможно, будет замедлять загрузку вашего сайта.

Для крупных сайтов установка системы сбора ошибок несколько усложняется. Необходимо убедить менеджеров в использовании узкоспециалированного сервиса, попробовать согласовать с безопасниками установку внешнего скрипта.

### Собственно, решение
Отправлять ошибки будем в [Яндекс.Метрику](https://metrika.yandex.ru). Если у вас на сайте уже установлена другая система аналитики, полноценный код отслеживания Метрики устанавливать не нужно. Метрика бесплатна, нет особых ограничений на количество счётчиков и сохраняемых ошибок.

Для сбора ошибок в Метрике подойдёт отчёт «[Параметры визитов](https://yandex.ru/support/metrika/reports/visit-params.xml)».

1. [Заведём](https://metrika.yandex.ru/add) отдельный счётчик.

2. Добавим на страницу перед всеми скриптами компактный код, это поможет дополнительно отлавливать ошибки загрузки этих же скриптов:
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

3. Не забываем указать в коде собственный номер счётчика (counterId).

4. Получаем примерно [такой отчёт](https://metrika.yandex.ru/stat/user_vars?group=dekaminute&chart_type=pie&period=2017-03-12%3A2017-03-12&id=43395579):
<img src="https://raw.githubusercontent.com/hcodes/metrika-js-errors/master/screenshots/1.png" />

Структуру и порядок параметров в отчёте можно менять на лету, а также добавлять новые параметры.
Давайте с помощью кнопки «Группировки» добавим [браузер и ОС](https://metrika.yandex.ru/stat/user_vars?group=dekaminute&selected_rows=yZkKR9&chart_type=pie&period=2017-03-12%3A2017-03-12&metrics=ym%3As%3Avisits%2Cym%3As%3AsumParams&id=43395579) в отчёт.
<img src="https://raw.githubusercontent.com/hcodes/metrika-js-errors/master/screenshots/3.png" />

<img src="https://raw.githubusercontent.com/hcodes/metrika-js-errors/master/screenshots/4.png" />

И ещё один момент, если скрипты на сайте загружаются с другого домена (CDN), то в отчёте, скорее всего, будут видны сообщения вида «Script error» и без стека.
Чтобы вернуть сообщениям нормальный вид, необходимо добавить к скриптам атрибут `crossorigin="anonymous"` и HTTP-заголовок `Access-Control-Allow-Origin:"*"`.
```html
<script src="https://mycdn.com/folder/file.js" crossorigin="anonymous"></script>
```

Постепенно в отчете будут появляться ошибки от расширений браузера, вирусов и внешних скриптов (рекламные систем, кнопок социальных сетей и пр.). Чтобы отделить эти ошибки, доработаем код.

Дополнительно добавим ограничение на собираемое количество ошибок (не более 5) на странице. Например, ошибки, возникающие при движение мышки, могут создать сотни запросов в Метрику. Плюс, в современных браузерах данные будем отправлять через `sendBeacon`.

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
            'JS ' + (!filename || /mysite\.ru|cdn\.com/.test(filename) ? 'in' : 'ex') + 'ternal errors',
            'message: ' + msg,
            stack ?
                'stack: ' + stack :
                (filename ? 'filename: ' + filename + ':' + line + ':' + column : 'nofilename'),
            'href: ' + location.href
        ];

    for (var i = 0; i < path.length - 1; i++) {
        var item = path[i];
        pointer[item] = {};
        pointer = pointer[item];
    }

    pointer[path[i]] = 1;

    var url = 'https://mc.yandex.ru/watch/' + id + '/' +
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

Данные по ошибкам можно получить с помощью [API](https://tech.yandex.ru/metrika/) и сделать с ними всё что угодно.
Не забудьте добавить ссылки на отчёт по ошибкам в свою документацию на видное место.
И дать [доступ](https://yandex.ru/support/metrika/general/access.xml) к отчёту остальным разработчикам из группы, чтобы исправление ошибок превратилось в соревнование :)

Ссылки:
- [GitHub](https://github.com/hcodes/metrika-js-errors/)
- Отчёт «[Параметры визитов](https://yandex.ru/support/metrika/reports/visit-params.xml)»
- [Пример отчёта](https://metrika.yandex.ru/stat/user_vars?group=dekaminute&selected_rows=yZkKR9&chart_type=pie&period=2017-03-12%3A2017-03-12&metrics=ym%3As%3Avisits%2Cym%3As%3AsumParams&id=43395579) в Метрике
