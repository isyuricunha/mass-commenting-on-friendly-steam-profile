import test from "node:test";
import assert from "node:assert/strict";
import { comment_runner, type friend_target } from "../src/core/comment_runner";

function wait_for<T>(params: { timeout_ms: number; check: () => T | null }) {
  const start = Date.now();

  return new Promise<T>((resolve, reject) => {
    const tick = () => {
      const value = params.check();
      if (value !== null) {
        resolve(value);
        return;
      }

      if (Date.now() - start > params.timeout_ms) {
        reject(new Error("timeout"));
        return;
      }

      setTimeout(tick, 0);
    };

    tick();
  });
}

test("comment_runner replaces %s and finishes", async () => {
  const targets: friend_target[] = [
    { steam_id: "1", display_name: "alice" },
    { steam_id: "2", display_name: "bob" }
  ];

  const seen: Array<{ id: string; message: string }> = [];

  const runner = new comment_runner(async (target, message) => {
    seen.push({ id: target.steam_id, message });
    return { ok: true };
  });

  runner.start({
    targets,
    message_template: "hi %s",
    delay_ms: 0
  });

  await wait_for({
    timeout_ms: 1000,
    check: () => (runner.get_state() === "done" ? true : null)
  });

  assert.equal(seen.length, 2);
  assert.deepEqual(seen, [
    { id: "1", message: "hi alice" },
    { id: "2", message: "hi bob" }
  ]);
});

test("comment_runner pause/resume works", async () => {
  const targets: friend_target[] = [
    { steam_id: "1", display_name: "alice" },
    { steam_id: "2", display_name: "bob" },
    { steam_id: "3", display_name: "carol" }
  ];

  let allow = false;

  const runner = new comment_runner(async () => {
    await wait_for({
      timeout_ms: 1000,
      check: () => (allow ? true : null)
    });

    return { ok: true };
  });

  runner.start({
    targets,
    message_template: "x",
    delay_ms: 0
  });

  runner.pause();
  assert.equal(runner.get_state(), "paused");

  allow = true;
  runner.resume({ delay_ms: 0 });

  await wait_for({
    timeout_ms: 1000,
    check: () => (runner.get_state() === "done" ? true : null)
  });

  const progress = runner.get_progress();
  assert.equal(progress.total, 3);
  assert.equal(progress.processed, 3);
  assert.equal(progress.success, 3);
});

test("comment_runner stop clears queue", async () => {
  const targets: friend_target[] = [
    { steam_id: "1", display_name: "alice" },
    { steam_id: "2", display_name: "bob" }
  ];

  const runner = new comment_runner(async () => {
    return { ok: true };
  });

  runner.start({
    targets,
    message_template: "x",
    delay_ms: 100
  });

  runner.stop();
  assert.equal(runner.get_state(), "stopped");
  assert.equal(runner.get_progress().total, 0);
});
