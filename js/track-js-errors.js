window.onerror = function(msg, file, line, col, err) {
    if (!window.JSON) { return; }

    var counterId = 12345, // Your counterId.
        siteInfo = {},
        pointer = siteInfo;
        path = [
            'JS errors',
            msg,
            err && err.stack || (file + ':' + line + ':' + col)
        ];

    for (var i = 0; i < path.length - 1; i++) {
        var item = path[i];
        pointer[item] = {};
        pointer = pointer[item];
    }

    pointer[path[i]] = 1;

    new Image().src = 'https://mc.yandex.ru/watch/' + counterId +
        '/?site-info=' + encodeURIComponent(JSON.stringify(siteInfo))
        '&rnd=' + Math.random();
};
