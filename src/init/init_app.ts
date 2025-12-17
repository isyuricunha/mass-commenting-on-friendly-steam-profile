import { comment_runner, type runner_events } from "../core/comment_runner";
import { get_selected_friends } from "../steam/steam_dom";
import {
  steam_post_comment,
  try_enable_friend_selection
} from "../steam/steam_api";
import { mount_panel } from "../ui/panel";

export type distribution = "console" | "userscript" | "extension";

type global_api = {
  init: () => void;
};

function boot() {
  if (document.getElementById("steam_mass_commenter_panel")) {
    return;
  }

  try_enable_friend_selection();

  const events: runner_events = {};
  const runner = new comment_runner(steam_post_comment, events);

  const panel = mount_panel({
    get_selected: () => get_selected_friends(),
    actions: {
      on_start: ({ message_template, delay_ms }) => {
        const targets = get_selected_friends();
        runner.start({ targets, message_template, delay_ms });
      },
      on_pause: () => runner.pause(),
      on_resume: ({ delay_ms }) => runner.resume({ delay_ms }),
      on_stop: () => runner.stop(),
      on_refresh_selection: () => {
        panel.set_selected_count(get_selected_friends().length);
      }
    }
  });

  Object.assign(events, panel.events);

  (window as unknown as Record<string, unknown>)[
    "steam_mass_commenter_runner"
  ] = runner;
}

export function init_app({ distribution }: { distribution: distribution }) {
  void distribution;

  if (typeof window === "undefined") {
    return;
  }

  const global_key = "steam_mass_commenter";
  const existing = (window as unknown as Record<string, unknown>)[global_key];
  if (existing) {
    return;
  }

  const api: global_api = {
    init() {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
        return;
      }

      boot();
    }
  };

  (window as unknown as Record<string, unknown>)[global_key] = api;
  api.init();
}
