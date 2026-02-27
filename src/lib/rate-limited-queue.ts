interface QueueOptions {
    concurrency: number;
    intervalCap: number;
    intervalMs: number;
}

interface QueueItem {
    task: () => Promise<void>;
    resolve: () => void;
    reject: (error: unknown) => void;
}

export class RateLimitedQueue {
    private readonly concurrency: number;
    private readonly intervalCap: number;
    private readonly intervalMs: number;
    private readonly queue: Array<QueueItem> = [];
    private readonly idleResolvers: Array<() => void> = [];
    private activeCount = 0;
    private intervalCount = 0;
    private intervalStart = Date.now();
    private drainTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(options: QueueOptions) {
        this.concurrency = Math.max(1, options.concurrency);
        this.intervalCap = Math.max(1, options.intervalCap);
        this.intervalMs = Math.max(1, options.intervalMs);
    }

    add(task: () => Promise<void>): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }

    onIdle(): Promise<void> {
        if (this.queue.length === 0 && this.activeCount === 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.idleResolvers.push(resolve);
        });
    }

    private process(): void {
        this.clearDrainTimerIfUnused();

        while (this.activeCount < this.concurrency && this.queue.length > 0) {
            if (!this.canStartTaskNow()) {
                this.scheduleDrain();
                return;
            }

            const item = this.queue.shift();
            if (!item) return;

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

    private canStartTaskNow(): boolean {
        const now = Date.now();
        if (now - this.intervalStart >= this.intervalMs) {
            this.intervalStart = now;
            this.intervalCount = 0;
        }
        return this.intervalCount < this.intervalCap;
    }

    private scheduleDrain(): void {
        if (this.drainTimer) return;
        const now = Date.now();
        const waitMs = Math.max(this.intervalMs - (now - this.intervalStart), 1);
        this.drainTimer = setTimeout(() => {
            this.drainTimer = null;
            this.process();
        }, waitMs);
    }

    private clearDrainTimerIfUnused(): void {
        if (this.drainTimer && this.queue.length === 0) {
            clearTimeout(this.drainTimer);
            this.drainTimer = null;
        }
    }

    private resolveIdleIfNeeded(): void {
        if (this.queue.length > 0 || this.activeCount > 0) return;
        while (this.idleResolvers.length > 0) {
            const resolve = this.idleResolvers.shift();
            resolve?.();
        }
    }
}
