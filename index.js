exports.queue = queue;
exports.priorityQueue = priorityQueue;

function onlyOnce(fn) {
    var called = false;
    return function() {
        if (called) throw new Error("Callback was already called.");
        called = true;
        fn.apply(this, arguments);
    };
}

function queue(worker, concurrency) {
    if (concurrency === undefined) {
        concurrency = 1;
    }

    function insert(q, task, callback) {
        if (!q.started) {
            q.started = true;
        }
        var item = {
            data: task,
            callback: typeof callback === 'function' ? callback : null
        };

        q.tasks.push(item);

        q.process();

        if (q.saturated && q.running() === q.concurrency) {
            q.saturated();
        }
    }

    var workers = 0;
    var q = {
        tasks: [],
        concurrency: concurrency,
        saturated: null,
        empty: null,
        drain: null,
        started: false,
        paused: false,
        push: function (data, callback) {
            insert(q, data, callback);
        },
        kill: function () {
            q.drain = null;
            q.tasks = [];
        },
        process: function () {
            if (q.paused) {
                return;
            }
            if (workers < q.concurrency && q.tasks.length) {
                var task = q.tasks.shift();
                if (q.empty && q.tasks.length === 0) {
                    q.empty();
                }
                workers += 1;
                var next = function () {
                    workers -= 1;
                    if (task.callback) {
                        task.callback.apply(task, arguments);
                    }
                    if (q.drain && q.tasks.length + workers === 0) {
                        q.drain();
                    }
                    q.process();
                };
                worker(task.data, onlyOnce(next));
            }
        },
        length: function () {
            return q.tasks.length;
        },
        running: function () {
            return workers;
        },
        idle: function() {
            return q.tasks.length + workers === 0;
        },
        pause: function () {
            if (q.paused === true) return;
            q.paused = true;
        },
        resume: function () {
            if (q.paused === false) return;
            q.paused = false;
            // Need to call q.process once per concurrent
            // worker to preserve full concurrency after pause
            for (var w = 1; w <= q.concurrency; w++) {
                q.process();
            }
        }
    };
    return q;
}

function priorityQueue(worker, concurrency) {

    function compareTasks(a, b){
      return a.priority - b.priority;
    }

    function binarySearch(sequence, item, compare) {
        var beg = -1,
            end = sequence.length - 1;
        while (beg < end) {
            var mid = beg + ((end - beg + 1) >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
                beg = mid;
            } else {
                end = mid - 1;
            }
        }
        return beg;
    }

    function insert(q, task, priority, callback) {
        if (!q.started){
            q.started = true;
        }
        var item = {
            data: task,
            priority: priority,
            callback: typeof callback === 'function' ? callback : null
        };

        q.tasks.splice(binarySearch(q.tasks, item, compareTasks) + 1, 0, item);

        q.process();
        if (q.saturated && q.running() === q.concurrency) {
            q.saturated();
        }
    }

    // Start with a normal queue
    var q = queue(worker, concurrency);

    // Override push to accept second parameter representing priority
    q.push = function (data, priority, callback) {
      insert(q, data, priority, callback);
    };

    // Remove unshift function
    delete q.unshift;

    return q;
}
