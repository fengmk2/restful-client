'use strict';

var should = require('should');
var mm = require('mm');
var Gitlab = require('./gitlab_client');

describe('client.test.js', function () {
  var gitlab = new Gitlab({
    api: process.env.NODE_GITLAB_API || 'https://gitlab.com/api/v3',
    token: process.env.NODE_GITLAB_TOKEN || 'enEWf516mA168tP6BiVe',
    requestTimeout: 15000
  });
  var lastId = 55045;

  afterEach(mm.restore);

  describe('RESTfulClient', function () {
    describe('request()', function () {
      it('should return status 200 results', function (done) {
        gitlab.projects.list(function (err, result) {
          should.not.exists(err);
          should.exists(result);
          result.length.should.above(1);
          result[0].should.have.property('id');
          lastId = result[result.length - 1].id;
          done();
        });
      });

      it('should mock SyntaxError return err', function (done) {
        mm.http.request(/\//, '{w');
        mm.https.request(/\//, '{w');
        gitlab.projects.list(function (err, result) {
          should.exists(err);
          err.name.should.equal('GitlabJSONResponseFormatError');
          err.data.should.eql({resBody: '{w'});
          err.message.should.containEql('Unexpected token w');
          err.statusCode.should.equal(200);
          should.not.exists(result);
          done();
        });
      });

      it('should mock 403 response return err', function (done) {
        mm.http.request(/\//, '{"name": "MockError", "message": "mock error", "errors": [{"field": "test"}]}',
          {statusCode: 403});
        mm.https.request(/\//, '{"name": "MockError", "message": "mock error", "errors": [{"field": "test"}]}',
          {statusCode: 403});
        gitlab.projects.list(function (err, result) {
          should.exists(err);
          err.name.should.equal('GitlabMockError');
          err.data.should.eql({resBody: {"name": "MockError", "message": "mock error", "errors": [{"field": "test"}]}});
          err.message.should.containEql('mock error');
          err.statusCode.should.equal(403);
          err.errors.should.eql([{"field": "test"}]);
          should.not.exists(result);
          done();
        });
      });

      it('should mock request error', function (done) {
        mm.http.requestError(/\//, 'socket hangup');
        mm.https.requestError(/\//, 'socket hangup');
        gitlab.projects.list(function (err, result) {
          should.exists(err);
          err.name.should.equal('GitlabMockHttpRequestError');
          err.data.should.eql({resBody: undefined});
          err.message.should.containEql('socket hangup');
          should.not.exists(result);
          done();
        });
      });
    });
  });

  describe('RESTFulResource', function () {
    describe('list()', function () {
      it('should get projects of current user', function (done) {
        gitlab.projects.list({per_page: 1}, function (err, result) {
          should.not.exists(err);
          should.exists(result);
          result.should.length(1);
          result[0].should.have.property('id');
          done();
        });
      });

      it('should get empty with page = 10', function (done) {
        gitlab.projects.list({page: 10}, function (err, result) {
          should.not.exists(err);
          should.exists(result);
          result.should.eql([]);
          done();
        });
      });
    });

    describe.skip('custom resource function: getBlob()', function () {
      it('should return a file content', function (done) {
        gitlab.repositorys.getBlob({ id: 55045, sha: 'master', filepath: 'README.md' }, function (err, blob) {
          should.not.exists(err);
          should.exists(blob);
          should.ok(Buffer.isBuffer(blob));
          blob.should.be.instanceof(Buffer);
          blob.length.should.above(0);
          blob.toString().should.containEql('gitlab-client-unittest');
          done();
        });
      });
    });

    describe('get()', function () {
      it('should get a project', function (done) {
        gitlab.projects.get({id: lastId}, function (err, result) {
          should.not.exists(err);
          should.exists(result);
          // result.name.should.equal('Diaspora');
          result.id.should.equal(lastId);
          // result.path_with_namespace.should.equal('diaspora/diaspora');
          // result.created_at.should.equal('2012-12-21T12:57:47Z');
          new Date(result.created_at).should.be.instanceof(Date);
          done();
        });
      });

      it('should get a not exists project return 404', function (done) {
        gitlab.projects.get({id: 40440404040440404}, function (err, result) {
          should.not.exists(err);
          should.not.exists(result);
          done();
        });
      });
    });

    describe('create()', function () {
      it('should create a project issue', function (done) {
        gitlab.issues.create({id: lastId, title: 'https://github.com/fengmk2/restful-client'}, function (err, issue) {
          should.not.exists(err);
          should.exists(issue);
          issue.should.have.property('project_id', lastId);
          issue.should.have.property('id');
          issue.should.have.property('title', 'https://github.com/fengmk2/restful-client');
          gitlab.issues.remove({id: lastId, issue_id: issue.id}, function (err) {
            // should.not.exists(err);
            gitlab.issues.update({id: lastId, issue_id: issue.id, state_event: 'close'}, function (err, issue) {
              should.not.exists(err);
              issue.should.have.property('state', 'closed');
              done();
            });
          });
        });
      });
    });
  });
});
