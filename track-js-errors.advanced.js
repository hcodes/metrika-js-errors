window.onerror = function handler(msg, file, line, col, err) {
    if (!window.JSON || handler.count > 5) { return; }

    var counterId = 12345, // Ваш номер счётчика Метрики.
        siteInfo = {},
        pointer = siteInfo,
        stack = err && err.stack,
        path = [
            // Укажите в регулярном выражении домены, с которых загружается ваш сайт и скрипты.
            'JS ' + (!file || /mysite\.ru|cdn\.com/.test(file) ? 'in' : 'ex') + 'ternal errors',
            'message: ' + msg,
            stack ?
                'stack: ' + stack :
                (file ? 'filename: ' + file + ':' + line + ':' + col : 'nofilename'),
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
