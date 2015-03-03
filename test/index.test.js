/*eslint-env mocha*/

var assert = require('chai').assert;

var s = require('sinon');

var poolCue = require('..');

describe("async-pool-cue", function() {
    describe("queue", function() {
        it("should run tasks in order", function() {
            var tasks = [];
            var q = poolCue.queue(function(task, next) {
                tasks.push(task);
                next();
            }, 1);
            var s1, s2, s3, s4;
            q.push(1, (s1 = s.spy()));
            q.push(2, (s2 = s.spy()));
            q.push(3, (s3 = s.spy()));
            q.push(4, (s4 = s.spy()));

            assert.deepEqual(tasks, [1, 2, 3, 4]);
            s.assert.callOrder(s1, s2, s3, s4);
        });
        it("should call 'saturated' whenever full", function() {
            var tasks = [];
            var pending = [];
            var q = poolCue.queue(function(task, next) {
                tasks.push(task);
                pending.push(next);
            }, 3);
            q.saturated = s.spy();
            q.push(1);
            q.push(2);
            s.assert.notCalled(q.saturated);
            q.push(3); // 3 running 0 queued
            s.assert.calledOnce(q.saturated);
            q.push(4); // 3 running 1 queued
            s.assert.calledOnce(q.saturated);
            pending[0](); // 3 running 0 queued
            pending[1](); // 2 running 0 queued
            s.assert.calledOnce(q.saturated);
            q.push(5); // 3 running 0 queued
            s.assert.calledTwice(q.saturated);
        });
        it("should call 'space' whenever a slot opens up", function() {
            var tasks = [];
            var pending = [];
            var q = poolCue.queue(function(task, next) {
                tasks.push(task);
                pending.push(next);
            }, 3);
            q.space = s.spy();
            q.push(1);
            q.push(2);
            q.push(3); // 3 running 0 queued
            q.push(4); // 3 running 1 queued
            s.assert.notCalled(q.space);
            pending[0](); // 3 running 0 queued
            s.assert.notCalled(q.space);
            pending[1](); // 2 running 0 queued
            s.assert.calledOnce(q.space);
            pending[2](); // 1 running 0 queued
            s.assert.calledOnce(q.space);
            q.push(5); // 2 running 0 queued
            q.push(6); // 3 running 0 queued
            s.assert.calledOnce(q.space);
            pending[3]();
            s.assert.calledTwice(q.space);
        });

        it("should pause and resume", function() {
            var tasks = [];
            var q = poolCue.queue(function(task, next) {
                tasks.push(task);
                next();
            }, 1);
            q.push(1);
            q.pause();
            q.push(2);
            q.push(3);
            q.push(4);
            assert.deepEqual(tasks, [1]);
            q.resume();
            assert.deepEqual(tasks, [1, 2, 3, 4]);
        });

        it("should pause and resume with concurrency when full", function() {
            var tasks = [];
            var pending = [];
            var q = poolCue.queue(function(task, next) {
                tasks.push(task);
                pending.push(next);
            }, 3);
            q.push(1);
            q.pause();
            q.push(2);
            q.push(3);
            q.push(4);
            assert.deepEqual(tasks, [1]);
            q.resume();
            assert.deepEqual(tasks, [1, 2, 3]);
            pending[0]();
            assert.deepEqual(tasks, [1, 2, 3, 4]);
        });
    });

    describe("priorityQueue", function() {
        it("should run tasks in priority order", function() {
            var tasks = [];
            var pending = [];
            var q = poolCue.priorityQueue(function(task, next) {
                tasks.push(task);
                pending.push(next);
            }, 1);
            var s1, s2, s3, s4;
            // fill up the one slot
            q.push(1, 0, (s1 = s.spy()));
            // queue tasks
            q.push(2, 20, (s2 = s.spy()));
            q.push(3, 30, (s3 = s.spy()));
            q.push(4, 10, (s4 = s.spy()));

            // complete tasks
            while (pending.length) {
                pending.shift()();
            }
            assert.deepEqual(tasks, [1, 4, 2, 3]);
            s.assert.callOrder(s1, s4, s2, s3);
        });
        it("should call 'saturated' whenever full", function() {
            var tasks = [];
            var pending = [];
            var q = poolCue.priorityQueue(function(task, next) {
                tasks.push(task);
                pending.push(next);
            }, 3);
            q.saturated = s.spy();
            q.push(1, 0);
            q.push(2, 0);
            s.assert.notCalled(q.saturated);
            q.push(3, 0); // 3 running 0 queued
            s.assert.calledOnce(q.saturated);
            q.push(4, 0); // 3 running 1 queued
            s.assert.calledOnce(q.saturated);
            pending[0](); // 3 running 0 queued
            pending[1](); // 2 running 0 queued
            s.assert.calledOnce(q.saturated);
            q.push(5, 0); // 3 running 0 queued
            s.assert.calledTwice(q.saturated);
        });
        it("should call 'space' whenever a slot opens up", function() {
            var tasks = [];
            var pending = [];
            var q = poolCue.priorityQueue(function(task, next) {
                tasks.push(task);
                pending.push(next);
            }, 3);
            q.space = s.spy();
            q.push(1, 0);
            q.push(2, 0);
            q.push(3, 0); // 3 running 0 queued
            q.push(4, 0); // 3 running 1 queued
            s.assert.notCalled(q.space);
            pending[0](); // 3 running 0 queued
            s.assert.notCalled(q.space);
            pending[1](); // 2 running 0 queued
            s.assert.calledOnce(q.space);
            pending[2](); // 1 running 0 queued
            s.assert.calledOnce(q.space);
            q.push(5, 0); // 2 running 0 queued
            q.push(6, 0); // 3 running 0 queued
            s.assert.calledOnce(q.space);
            pending[3]();
            s.assert.calledTwice(q.space);
        });
    });
});
