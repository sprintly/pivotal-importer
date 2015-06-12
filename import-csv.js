var _ = require('lodash');
var async = require('async')
var request = require('request');
var readCsv = require('./lib/read-csv');
var parsePivotalTickets = require('./lib/parse-pivotal-tickets');

var SPRINTLY_ROOT = process.env.SPRINTLY_ROOT || 'https://local.sprint.ly:9000';

var getSprintlyUsers = function (productId, auth, cb) {
  var url = SPRINTLY_ROOT + '/api/products/' + productId + '/people.json';

  request.get({
    url: url,
    auth: auth,
    form: true
  }, function(err, resp, body) {
    if (err) {
      return cb(err);
    }

    if (resp.statusCode >= 300) {
      cb('Wrong status code on fetching users: ' + resp.statusCode);
      return;
    }

    cb(null, _.zipObject(_.map(body, function (p) {
      return [p.first_name + ' ' + p.last_name, p.id];
    })));
  });
};

var addToSprintly = function(productId, auth, item, cb) {
  var url = SPRINTLY_ROOT + '/api/products/' + productId + '/items.json';
  request.post({
    url: url,
    auth: auth,
    form: item
  }, function(err, resp, body) {
    if (err) {
      cb(err);
    }

    if (resp.statusCode < 400) {
      console.log('Item created.');
      cb(null, body);
    } else {
      console.log(item, resp.statusCode, url)
      cb(new Error('error saving to sprintly'));
    }
  });
};


var path = require('path');

var importCsv = function(filename, productId, user, apiKey) {
  var auth = {
    user: user,
    pass: apiKey
  };

  function importTickets(err, parsedTickets) {
    if (err) {
      throw err;
    }

    async.eachLimit(parsedTickets, 3,
      function(item, done) {
        addToSprintly(productId, auth, item, done);
      },
      function(err, resp) {
        if (err) {
          console.log(err)
        } else {
          console.log('Import successful');
        }
      }
    );
  }

  function prepareTickets(err, results) {
    if (err) {
      throw err;
    }

    parsePivotalTickets(results.csvData, results.sprintlyUsers, importTickets);
  }

  async.parallel({
    csvData: function (done) {
      readCsv(path.join(__dirname, filename), done);
    },
    sprintlyUsers: function (done) {
      getSprintlyUsers(productId, auth, done);
    }
  }, prepareTickets);
};

