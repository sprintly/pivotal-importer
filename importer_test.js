var Importer = require('./importer');
var assert = require('assert');
var _ = require('lodash');
var nock = require('nock');

var story = {
  'story_type': 'feature',
  description: 'body',
  name: 'title',
  estimate: 3,
  tags: 'test,one,here'
};

var defect = {
  'story_type': 'bug',
  description: 'body text',
  name: 'something is broken',
  estimate: 8,
  tags: ''
};

var task = {
  'story_type': 'chore',
  description: 'something here',
  name: 'do this thing',
  estimate: 1,
  tags: 'boring',
  'requested_by': 'Justin Abrahms',
  'owned_by': 'Joe Stump'
};

var genPayload = function () {
  return {stories: {story: arguments}};
};

describe('fetch users', function () {
  it('should get users from sprintly', function () {
    nock('https://sprint.ly')
      .get('/api/products/1/people.json')
      .reply(200, [{
        id: 1,
        'first_name': 'Joe',
        'last_name': 'Stump'
      }, {
        id: 5304,
        'first_name': 'Justin',
        'last_name': 'Abrahms'
      }]);

    var i = new Importer({
      sprintly: {
        hostname: 'sprint.ly',
        path: '/api/products/1/items.json',
        auth: 'justin@sage.ly:s3cret',
        method: 'POST'
      },
      importer: {sprintlyProductId: 1}
    });

    i.getSprintlyUsers(null, function (err, stories, users) {
      assert.equal(err, null);
      assert.deepEqual(users, {'Justin Abrahms': 5304, 'Joe Stump': 1});
    });
  });

  it('should return error if non-success status code', function () {
    nock('https://sprint.ly')
      .get('/api/products/1/people.json')
      .reply(400);

    var i = new Importer({
      sprintly: {
        hostname: 'sprint.ly',
        path: '/api/products/1/items.json',
        auth: 'justin@sage.ly:s3cret',
        method: 'POST'
      },
      importer: {sprintlyProductId: 1}
    });

    i.getSprintlyUsers(null, function (err) {
      assert.notEqual(err, null);
    });
  });
});

describe('item translation', function () {
  beforeEach(function () {
    this.i = new Importer({});
    this.singleResult = function (stories, users, resultCb) {
      this.i.ticketMapper(stories, users, function (err, results) {
        assert.equal(err, null);
        assert.equal(results.length, 1);
        resultCb(results[0]);
      });
    };
  });

  describe('estimates', function () {

  });

  describe('type', function () {
    it('should make features stories', function (done) {
      this.singleResult(genPayload(story), {}, function (r) {
        assert.equal(r.type, 'story');
        done();
      });
    });

    it('should make bugs defects', function (done) {
      this.singleResult(genPayload(defect), {}, function (r) {
        assert.equal(r.type, 'defect');
        done();
      });
    });

    it('should make chores tasks', function (done) {
      this.singleResult(genPayload(task), {}, function (r) {
        assert.equal(r.type, 'task');
        done();
      });
    });
    
    it('should return null for unknown types', function (done) {
      var unknown = _.cloneDeep(task);
      unknown.story_type = 'unknown type';
      this.singleResult(genPayload(unknown), {}, function (r) {
        assert.equal(r, null);
        done();
      });
    });
  });

  describe('user mapping', function () {

    it('should associate sprintly users with PT requesters', function (done) {
      this.singleResult(genPayload(task), {'Justin Abrahms': 5304}, function (r) {
        assert.equal(r.created_by, 5304);
        done();
      });
    });

    it('should associate sprintly users with PT owners', function (done) {
      this.singleResult(genPayload(task), {'Justin Abrahms': 5304, 'Joe Stump': 1}, function (r) {
        assert.equal(r.assigned_to, 1);
        done();
      });
    });
  });
});
