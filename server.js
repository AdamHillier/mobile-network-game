var express = require('express');
var app = express();

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/game.html')
});

app.listen(8080);
console.log('Listening on localhost::8080');
