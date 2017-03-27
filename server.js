var express = require('express');
var bodyParser = require('body-parser');
var redis = require('redis');
var sha1 = require('sha1');

var app = express();
var jsonParser = bodyParser.json();

/*********************************
    Configure database (Redis)
*********************************/

var client = redis.createClient();

client.on("error", function (err) {
    console.log("Redis error " + err);
});

// Add command ZADDIFGREATER to update the score of an element of a sorted
// set only if the new score is strictly greater than the existing score
// (and if the element doesn't exist simply insert it).
//
// This is achieved with a Lua script executed in Redis.
// See: https://coderwall.com/p/lhyk_w/add-redis-functions-setifhigher-setiflower-zaddifhigher-zaddiflower
var zaddIfGreaterScript =
        "local c = tonumber(redis.call('zscore', KEYS[1], ARGV[1])); if c then "
      + "if tonumber(KEYS[2]) > c then redis.call('zadd', KEYS[1], KEYS[2], ARGV[1]) "
      + "return tonumber(KEYS[2]) - c else return 0 end "
      + "else redis.call('zadd', KEYS[1], KEYS[2], ARGV[1]) return 'OK' end";

var zaddIfGreaterSha = sha1(zaddIfGreaterScript);
client.script('load', zaddIfGreaterScript);

client.zaddIfGreater = function (args, callback) {
    this.evalsha(zaddIfGreaterSha, [2, ...args], callback);
}

/*********************************
              Routes
*********************************/

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/game.html')
});

app.post('/submit-score', jsonParser, function (req, res) {
    var body = req.body;

    // Flag most invalid email addresses
    // See: https://stackoverflow.com/questions/46155/validate-email-address-in-javascript/1373724#1373724
    var emailRegex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
    var isValidInput = (body && body.email && emailRegex.test(body.email)
            && body.score && typeof(body.score) === 'number' && body.score >= 0);

    if (!isValidInput) return res.sendStatus(400);

    client.zaddIfGreater(['scores', body.score, body.email], function (err) {
        return err ? res.sendStatus(500) : res.sendStatus(200);
    });
});

// Catch-all: just send a 404.
app.use(function (req, res) {
    res.sendStatus(404);
});

/*********************************
         Initialise server
*********************************/

var port = process.env.PORT || 8080
app.listen(port, function () {
    console.log('Listening on localhost::' + port);
});
