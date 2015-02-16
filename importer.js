var https = require('https');
var parser = require('xml2json');
var fs = require('fs');
var qs = require('querystring');
var path = require('path');
var env = require(path.join(__dirname, 'env'));
var _ = require('lodash');

var pivotalOptions = {
  host: 'www.pivotaltracker.com',
  path: '/services/v3/projects/' + env.pivotal.PID + '/stories',
  headers: { 'X-TrackerToken': env.pivotal.TOKEN}
};

var sprintlyOptions = {
  hostname: 'local.sprint.ly',
  port: 9000,
  path: '/api/products/' + env.sprintly.ID + '/items.json',
  auth: env.sprintly.USER + ':' + env.sprintly.KEY,
  method: 'POST'
};

var getSprintlyUsers = function (cb) {
  var opts = _.cloneDeep(sprintlyOptions);
  opts.path = '/api/products/' + env.sprintly.ID + '/people.json';

  https.get(opts, function (err, results) {
    if (err) {
      cb(err);
    }
    cb(null, _.zip(_.map(results, function (p) {
      return [p.first_name + ' ' + p.last_name, p.id];
    })));
  });
};

var addToSprintly = function(story) {
  var options = sprintlyOptions;
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

var parseStories = function(stories) {
  var parseScore = function(score) {
    var result = +score.$t;
    if (!result) {
      result = '~';
    } else if (result === 1) {
      result = 'S';
    } else if (result === 2) {
      result = 'M';
    } else if (result === 3) {
      result = 'M';
    } else if (result === 4) {
      result = 'L';
    } else if (result === 8) {
      result = 'XL';
    }
    return result;
  };

  var addStory = function(feature) {
    var description = typeof feature.description === 'object' ? '' : feature.description;
    description = description.replace(/(As|I)/g, function(str) {
      return ',' + str;
    });
    description = description.replace('-', '');
    return {
      type: 'story',
      who: 'unknown',
      what: feature.name,
      why: 'unknown',
      body: description,
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

  return stories.map(function(story) {
    switch(story.story_type) {
      case 'feature':
        return addStory(story);
      case 'bug':
        return addDefect(story);
      case 'chore':
        return addTask(story);
    }
  });
};

var handleStories = function(data) {
  var stories = data.stories.story;
  stories = parseStories(stories);
  var j = 0;
  var poll = setInterval(function() {
    if ( j < stories.length) {
      addToSprintly(qs.stringify(stories[j]));
      j++;
    }
    else {
      clearInterval(poll);
    }
  }, 250);
};


var getPivotalStories = function(options) {
  if (options.local) {
    fs.readFile('pivotalData.xml', 'utf-8', function(err, resp) {
      if (err) {
        throw new Error("Couldn't read pivotalData.xml");
      }
      handleStories(parser.toJson(resp, {object: true}));
    });
  }
  else {
    var response = '';
    https.get(pivotalOptions, function(res) {
      res.on('data', function (chunk) {
        response += chunk;
      });
      res.on('end', function() {
        fs.writeFileSync('pivotalData.xml', response);
        handleStories(parser.toJson(response, {object: true}));
      });
    }).on('error', function(e) {
      console.log('Got error: ' + e.message);
    });
  }
};


getPivotalStories({local: false});
