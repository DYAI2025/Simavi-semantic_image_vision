// Smart Queue Manager - Verhindert Memory-Crash bei großen Batches
// Max 3 parallele Tasks, Memory-safe Processing

interface QueueTask<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

export class QueueManager {
  private queue: QueueTask<any>[] = [];
  private running: number = 0;
  private readonly maxParallel: number;

  constructor(maxParallel: number = 3) {
    this.maxParallel = maxParallel;
  }

  async add<T>(id: string, task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id, execute: task, resolve, reject });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxParallel || this.queue.length === 0) return;

    const task = this.queue.shift();
    if (!task) return;

    this.running++;
    console.log(`[Queue] Start: ${task.id} (${this.running}/${this.maxParallel})`);

    try {
      const result = await task.execute();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }

  getStatus() {
    return { queued: this.queue.length, running: this.running };
  }
}

export const globalQueue = new QueueManager(3);