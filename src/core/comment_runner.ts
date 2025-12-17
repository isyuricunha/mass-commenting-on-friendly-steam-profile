export type run_state = "idle" | "running" | "paused" | "stopped" | "done";

export type friend_target = {
  steam_id: string;
  display_name: string;
};

export type post_result =
  | { ok: true }
  | { ok: false; error_message: string };

export type post_comment_fn = (
  target: friend_target,
  message: string
) => Promise<post_result>;

export type runner_events = {
  on_state_change?: (state: run_state) => void;
  on_progress?: (progress: {
    total: number;
    processed: number;
    success: number;
    failed: number;
    current?: friend_target;
  }) => void;
  on_item_result?: (item: {
    target: friend_target;
    status: "success" | "failed";
    error_message?: string;
  }) => void;
};

export type runner_options = {
  delay_ms: number;
};

export class comment_runner {
  private state: run_state = "idle";
  private queue: Array<{ target: friend_target; message: string }> = [];
  private index = 0;
  private timeout_id: ReturnType<typeof setTimeout> | null = null;
  private in_flight = false;

  private processed = 0;
  private success = 0;
  private failed = 0;

  constructor(
    private readonly post_comment: post_comment_fn,
    private readonly events: runner_events = {}
  ) {}

  get_state() {
    return this.state;
  }

  get_progress() {
    return {
      total: this.queue.length,
      processed: this.processed,
      success: this.success,
      failed: this.failed
    };
  }

  start(params: {
    targets: friend_target[];
    message_template: string;
    delay_ms: number;
  }) {
    const { targets, message_template, delay_ms } = params;

    if (this.state === "running") {
      return;
    }

    this.clear_timer();

    this.queue = targets.map((t) => ({
      target: t,
      message: message_template.replaceAll("%s", t.display_name)
    }));

    this.index = 0;
    this.processed = 0;
    this.success = 0;
    this.failed = 0;

    this.set_state("running");
    void this.run_next({ delay_ms });
  }

  pause() {
    if (this.state !== "running") {
      return;
    }

    this.set_state("paused");
    this.clear_timer();
  }

  resume(options: runner_options) {
    if (this.state !== "paused") {
      return;
    }

    this.set_state("running");
    void this.run_next(options);
  }

  stop() {
    if (this.state === "idle" || this.state === "done") {
      return;
    }

    this.set_state("stopped");
    this.clear_timer();
    this.queue = [];
  }

  private set_state(next: run_state) {
    this.state = next;
    this.events.on_state_change?.(next);
  }

  private clear_timer() {
    if (this.timeout_id !== null) {
      globalThis.clearTimeout(this.timeout_id);
      this.timeout_id = null;
    }
  }

  private emit_progress(current?: friend_target) {
    this.events.on_progress?.({
      total: this.queue.length,
      processed: this.processed,
      success: this.success,
      failed: this.failed,
      current
    });
  }

  private async run_next(options: runner_options): Promise<void> {
    if (this.state !== "running") {
      return;
    }

    if (this.in_flight) {
      return;
    }

    const item = this.queue[this.index];
    if (!item) {
      this.set_state("done");
      this.emit_progress();
      return;
    }

    this.emit_progress(item.target);

    this.in_flight = true;
    const result = await this.post_comment(item.target, item.message);
    this.in_flight = false;

    this.processed += 1;

    if (result.ok) {
      this.success += 1;
      this.events.on_item_result?.({
        target: item.target,
        status: "success"
      });
    } else {
      this.failed += 1;
      this.events.on_item_result?.({
        target: item.target,
        status: "failed",
        error_message: result.error_message
      });
    }

    this.index += 1;
    this.emit_progress();

    if (this.state !== "running") {
      return;
    }

    this.timeout_id = globalThis.setTimeout(() => {
      this.timeout_id = null;
      void this.run_next(options);
    }, options.delay_ms);
  }
}
