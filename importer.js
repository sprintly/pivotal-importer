var https = require('https');
var parser = require('xml2json');
var fs = require('fs');
var path = require('path');
var env = require(path.join(__dirname, 'env'));
var _ = require('lodash');

// TODO(justinabrahms): Support for subtasks? See story #14008073.

var Importer = module.exports = function (options) {
  this.options = Object.freeze(options);
  _.bindAll(this, 'getSprintlyUsers', 'addToSprintly', 'ticketMapper', 'getLocalStories', 'getRemoteStories');
};

var ESTIMATE_MAPPER = {
  0: '~',
  1: 'S',
  2: 'M',
  3: 'M',
  4: 'L',
  8: 'XL'
};

Importer.prototype.getSprintlyUsers = function (pivotalStories, cb) {
  var opts = _.cloneDeep(this.options.sprintly);
  opts.path = '/api/products/' + this.options.importer.sprintlyProductId + '/people.json';
  opts.method = 'GET';

  var req = https.get(opts, _.bind(function (res) {
    if (res.statusCode >= 300) {
      cb('Wrong status code on fetching users: ' + res.statusCode);
      return;
    }

    var response = '';
    res.on('data', function (d) {
      response += d;
    });

    res.on('end', function () {
      cb(null, pivotalStories, _.zipObject(_.map(JSON.parse(response), function (p) {
        return [p.first_name + ' ' + p.last_name, p.id];
      })));
    });
  }, this));

  req.on('error', function (e) {
    cb(e);
  });
  req.end();
};

Importer.prototype.addToSprintly = function(story) {
  console.log('adding item to sprintly');
  return;
 
  var options = _.deepClone(this.options.sprintly);
  options.headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': story.length
  };
  var request = https.request(options, function(res) {
    var response = '';
    res.on('data', function(chunk) {
      response += chunk;
    });
    res.on('end', function() {
      console.log('Story Added!', response);
    });
  });
  request.write(story);
  request.end();
};

/**
 * Maps Pivotal style tickets to Sprintly style tickets
 */
Importer.prototype.ticketMapper = function(pivotalStories, sprintlyUsers, cb) {
  var parseScore = function(score) {
    var result = +score.$t || 0;
    return ESTIMATE_MAPPER[result];
  };

  var addStory = function(feature) {
    return {
      type: 'story',
      who: 'unknown',
      what: feature.name,
      why: 'unknown',
      body: feature.description,
      score: parseScore(feature.estimate),
      tags: feature.labels
    };
  };

  var addDefect = function(bug) {
    return {
      type: 'defect',
      title: bug.name,
      tags: bug.labels
    };
  };

  var addTask = function(pivotalTask) {
    return {
      type: 'task' ,
      title: pivotalTask.name,
      tags: pivotalTask.labels
    };
  };

  cb(null, _.map(pivotalStories.stories.story, function(story) {
    var item;
    switch(story.story_type) {
    case 'feature':
      item = addStory(story);
      break;
    case 'bug':
      item = addDefect(story);
      break;
    case 'chore':
      item = addTask(story);
      break;
    default:
      return;
    }

    item.created_by = sprintlyUsers[story.requested_by];
    item.assigned_to = sprintlyUsers[story.owned_by];

    return item;
  }));
};

Importer.prototype.getLocalStories = function (cb) {
  fs.readFile('pivotalData.xml', 'utf-8', function(err, resp) {
    if (err) {
      cb(new Error("Couldn't read pivotalData.xml"));
    }
    cb(null, parser.toJson(resp, {object: true}));
  });
};

Importer.prototype.getRemoteStories = function (cb) {
  var response = '';
  https.get(this.options.pivotal, _.bind(function(res) {
    if (res.statusCode >= 300) {
      cb('Wrong status code on fetching stories: ' + res.statusCode);
    }

    res.on('data', function (chunk) {
      response += chunk;
    });

    res.on('end', _.bind(function() {
      if (this.options.importer.writeFile) {
        fs.writeFileSync('pivotalData.xml', response);
      }
      cb(null, parser.toJson(response, {object: true}));
    }, this));

  }, this)).on('error', function(e) {
    cb(e.message);
  });
};

/* istanbul ignore if  */
if (require.main === module) {
  var async = require('async');
  var opts = {
    sprintly: {
      hostname: 'local.sprint.ly',
      port: 9000,
      path: '/api/products/' + env.sprintly.ID + '/items.json',
      auth: env.sprintly.USER + ':' + env.sprintly.KEY,
      method: 'POST'
    },
    pivotal: {
      host: 'www.pivotaltracker.com',
      path: '/services/v3/projects/' + env.pivotal.PID + '/stories',
      headers: { 'X-TrackerToken': env.pivotal.TOKEN}
    },
    importer: {
      local: true,
      writeFile: false,
      sprintlyProductId: env.sprintly.ID
    }
  };

  var imp = new Importer(opts);

  var storyFetcher;
  if (opts.importer.local) {
    storyFetcher = imp.getLocalStories;
  } else {
    storyFetcher = imp.getRemoteStories;
  }

  async.waterfall(
    [storyFetcher,
     imp.getSprintlyUsers,
     imp.ticketMapper,
     imp.addToSprintly], function (err) {
       console.log('final error: ', err);
     });
}
