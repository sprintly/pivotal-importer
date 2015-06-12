var _ = require('lodash');
var request = require('request');

var ESTIMATE_MAPPER = {
  0: '~',
  1: 'S',
  2: 'M',
  3: 'M',
  4: 'L',
  8: 'XL'
};

var parseScore = function(score) {
  var result = +score || 0;
  return ESTIMATE_MAPPER[result];
};

/**
 * Maps Pivotal style tickets to Sprintly style tickets
 */
module.exports = function(pivotalTickets, sprintlyUsers, cb) {

  var addStory = function(feature) {
    return {
      type: 'story',
      who: 'unknown',
      what: feature.Title,
      why: 'unknown',
      description: feature.Description,
      score: parseScore(feature.Estimate),
      tags: feature.Labels
    };
  };

  var addDefect = function(bug) {
    return {
      type: 'defect',
      title: bug.Title,
      description: bug.Description,
      tags: bug.Labels
    };
  };

  var addTask = function(pivotalTask) {
    return {
      type: 'task' ,
      title: pivotalTask.Title,
      description: pivotalTask.Description,
      tags: pivotalTask.Labels
    };
  };

  cb(null, _.compact(_.map(pivotalTickets, function(story) {
    var item;
    switch(story.Type) {
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

    var creator = sprintlyUsers[story['Requested By']];
    if (creator) {
      item.created_by = creator;
    }

    var assignee = sprintlyUsers[story['Owned By']];
    if (assignee) {
      item.assigned_to = assignee;
    }

    return item;
  })));
};
