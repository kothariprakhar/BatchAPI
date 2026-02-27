"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitedQueue = void 0;
class RateLimitedQueue {
    constructor(options) {
        this.queue = [];
        this.idleResolvers = [];
        this.activeCount = 0;
        this.intervalCount = 0;
        this.intervalStart = Date.now();
        this.drainTimer = null;
        this.concurrency = Math.max(1, options.concurrency);
        this.intervalCap = Math.max(1, options.intervalCap);
        this.intervalMs = Math.max(1, options.intervalMs);
    }
    add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }
    onIdle() {
        if (this.queue.length === 0 && this.activeCount === 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.idleResolvers.push(resolve);
        });
    }
    process() {
        this.clearDrainTimerIfUnused();
        while (this.activeCount < this.concurrency && this.queue.length > 0) {
            if (!this.canStartTaskNow()) {
                this.scheduleDrain();
                return;
            }
            const item = this.queue.shift();
            if (!item)
                return;
            this.activeCount += 1;
            this.intervalCount += 1;
            void item
                .task()
                .then(item.resolve)
                .catch(item.reject)
                .finally(() => {
                this.activeCount -= 1;
                this.process();
                this.resolveIdleIfNeeded();
            });
        }
        this.resolveIdleIfNeeded();
    }
    canStartTaskNow() {
        const now = Date.now();
        if (now - this.intervalStart >= this.intervalMs) {
            this.intervalStart = now;
            this.intervalCount = 0;
        }
        return this.intervalCount < this.intervalCap;
    }
    scheduleDrain() {
        if (this.drainTimer)
            return;
        const now = Date.now();
        const waitMs = Math.max(this.intervalMs - (now - this.intervalStart), 1);
        this.drainTimer = setTimeout(() => {
            this.drainTimer = null;
            this.process();
        }, waitMs);
    }
    clearDrainTimerIfUnused() {
        if (this.drainTimer && this.queue.length === 0) {
            clearTimeout(this.drainTimer);
            this.drainTimer = null;
        }
    }
    resolveIdleIfNeeded() {
        if (this.queue.length > 0 || this.activeCount > 0)
            return;
        while (this.idleResolvers.length > 0) {
            const resolve = this.idleResolvers.shift();
            resolve?.();
        }
    }
}
exports.RateLimitedQueue = RateLimitedQueue;
