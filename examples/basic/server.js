'use strict';

var express = require('express');
var template7 = require('../../'); // "express-template7"

var app = express();

app.engine('html', template7({ defaultLayout: 'main' }));
app.set('views', __dirname + '/views');
app.set('view engine', 'html');

app.get('/', function (req, res) {
    res.render('home', { title: 'test title', people: [{firstName: 'a', lastName: 'b', image: 'http://baidu.com'}, {firstName: 'c', lastName: 'd', image: undefined}] });
});

app.listen(3000, function () {
    console.log('express-template7 example server listening on: 3000');
});
