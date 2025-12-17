import type {
  friend_target,
  run_state,
  runner_events
} from "../core/comment_runner";
import {
  create_template_id,
  delete_template,
  load_templates,
  save_templates,
  upsert_template,
  type message_template
} from "../core/templates";

type panel_actions = {
  on_start: (params: { message_template: string; delay_ms: number }) => void;
  on_pause: () => void;
  on_resume: (params: { delay_ms: number }) => void;
  on_stop: () => void;
  on_refresh_selection: () => void;
};

export type panel_bindings = {
  actions: panel_actions;
  get_selected: () => friend_target[];
};

export type panel_handle = {
  events: runner_events;
  set_selected_count: (count: number) => void;
};

const root_id = "steam_mass_commenter_panel";
const style_id = "steam_mass_commenter_style";

function el<T extends HTMLElement>(selector: string) {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`missing element: ${selector}`);
  }
  return node as T;
}

function clamp_delay_ms(value: number) {
  if (!Number.isFinite(value)) {
    return 6000;
  }

  return Math.max(1000, Math.min(60000, Math.floor(value)));
}

function format_state(state: run_state) {
  switch (state) {
    case "idle":
      return "idle";
    case "running":
      return "running";
    case "paused":
      return "paused";
    case "stopped":
      return "stopped";
    case "done":
      return "done";
  }
}

function ensure_style() {
  if (document.getElementById(style_id)) {
    return;
  }

  const style = document.createElement("style");
  style.id = style_id;
  style.textContent = `
#${root_id} {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 380px;
  z-index: 999999;
  color: #e6e6e6;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif;
}

#${root_id} .smc_card {
  background: rgba(20, 20, 20, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.55);
}

#${root_id} .smc_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}

#${root_id} .smc_title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

#${root_id} .smc_title strong {
  font-size: 12px;
  letter-spacing: 0.2px;
}

#${root_id} .smc_title span {
  font-size: 11px;
  opacity: 0.8;
}

#${root_id} .smc_body {
  padding: 12px;
  display: grid;
  gap: 10px;
}

#${root_id} textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 72px;
  resize: vertical;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(0, 0, 0, 0.35);
  color: #f0f0f0;
  font-size: 12px;
  outline: none;
}

#${root_id} textarea:focus {
  border-color: rgba(118, 185, 0, 0.75);
  box-shadow: 0 0 0 2px rgba(118, 185, 0, 0.15);
}

#${root_id} .smc_row {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 10px;
  align-items: center;
}

#${root_id} input, #${root_id} select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(0, 0, 0, 0.35);
  color: #f0f0f0;
  font-size: 12px;
  outline: none;
}

#${root_id} .smc_actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

#${root_id} button {
  cursor: pointer;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
  color: #f0f0f0;
  font-size: 12px;
  padding: 8px 10px;
}

#${root_id} button:hover {
  background: rgba(255, 255, 255, 0.10);
}

#${root_id} button.smc_primary {
  background: rgba(118, 185, 0, 0.85);
  border-color: rgba(118, 185, 0, 0.95);
  color: #081200;
  font-weight: 600;
}

#${root_id} button.smc_primary:hover {
  background: rgba(118, 185, 0, 0.95);
}

#${root_id} button.smc_danger {
  background: rgba(185, 40, 40, 0.75);
  border-color: rgba(185, 40, 40, 0.9);
}

#${root_id} .smc_meta {
  display: grid;
  gap: 4px;
  font-size: 11px;
  opacity: 0.85;
}

#${root_id} .smc_log {
  max-height: 160px;
  overflow: auto;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
  font-size: 11px;
  line-height: 1.35;
}

#${root_id} .smc_log a {
  color: rgba(118, 185, 0, 0.95);
  text-decoration: none;
}

#${root_id} .smc_log .smc_ok { color: rgba(118, 185, 0, 0.95); }
#${root_id} .smc_log .smc_fail { color: rgba(255, 115, 115, 0.95); }

#${root_id} .smc_collapsed .smc_body {
  display: none;
}

#${root_id} .smc_header button {
  padding: 6px 8px;
  border-radius: 9px;
}
`;

  document.head.appendChild(style);
}

function ensure_root(): HTMLElement {
  const existing = document.getElementById(root_id);
  if (existing) {
    return existing;
  }

  const root = document.createElement("div");
  root.id = root_id;

  const container = document.querySelector("#manage_friends")?.parentElement;
  if (container) {
    container.appendChild(root);
  } else {
    document.body.appendChild(root);
  }

  return root;
}

export function mount_panel(bindings: panel_bindings): panel_handle {
  ensure_style();
  const root = ensure_root();

  root.innerHTML = `
  <div class="smc_card">
    <div class="smc_header">
      <div class="smc_title">
        <strong>steam mass commenter</strong>
        <span id="smc_state">idle</span>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button id="smc_toggle">hide</button>
      </div>
    </div>
    <div class="smc_body">
      <div class="smc_row">
        <div>
          <select id="smc_template_select"></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button id="smc_template_save">save</button>
          <button id="smc_template_delete">del</button>
        </div>
      </div>

      <div>
        <textarea id="smc_message" placeholder="message (use %s for friend name)"></textarea>
      </div>

      <div class="smc_row">
        <div class="smc_meta">
          <div><span id="smc_selected">0</span> selected</div>
          <div><span id="smc_progress">0/0</span> processed · <span id="smc_success">0</span> ok · <span id="smc_failed">0</span> fail</div>
        </div>
        <div>
          <input id="smc_delay" type="number" min="1000" max="60000" step="500" value="6000" />
          <div style="font-size:10px; opacity:0.75; padding-top:4px;">delay (ms)</div>
        </div>
      </div>

      <div class="smc_actions">
        <button class="smc_primary" id="smc_start">start</button>
        <button id="smc_pause">pause</button>
        <button id="smc_resume">resume</button>
        <button class="smc_danger" id="smc_stop">stop</button>
        <button id="smc_refresh">refresh selection</button>
      </div>

      <div class="smc_log" id="smc_log"></div>
    </div>
  </div>
`;

  const stateEl = el<HTMLSpanElement>("#smc_state");
  const selectedEl = el<HTMLSpanElement>("#smc_selected");
  const progressEl = el<HTMLSpanElement>("#smc_progress");
  const successEl = el<HTMLSpanElement>("#smc_success");
  const failedEl = el<HTMLSpanElement>("#smc_failed");
  const messageEl = el<HTMLTextAreaElement>("#smc_message");
  const delayEl = el<HTMLInputElement>("#smc_delay");
  const logEl = el<HTMLDivElement>("#smc_log");
  const templateSelect = el<HTMLSelectElement>("#smc_template_select");

  const toggleBtn = el<HTMLButtonElement>("#smc_toggle");
  const startBtn = el<HTMLButtonElement>("#smc_start");
  const pauseBtn = el<HTMLButtonElement>("#smc_pause");
  const resumeBtn = el<HTMLButtonElement>("#smc_resume");
  const stopBtn = el<HTMLButtonElement>("#smc_stop");
  const refreshBtn = el<HTMLButtonElement>("#smc_refresh");
  const saveTplBtn = el<HTMLButtonElement>("#smc_template_save");
  const delTplBtn = el<HTMLButtonElement>("#smc_template_delete");

  let collapsed = false;
  const set_collapsed = (next: boolean) => {
    collapsed = next;
    root.querySelector(".smc_card")?.classList.toggle("smc_collapsed", collapsed);
    toggleBtn.textContent = collapsed ? "show" : "hide";
  };

  toggleBtn.addEventListener("click", () => set_collapsed(!collapsed));

  const storage = window.localStorage;
  let templates = load_templates(storage);
  let current_template_id = templates[0]?.id ?? "default";

  const render_templates = () => {
    templateSelect.innerHTML = "";
    for (const tpl of templates) {
      const opt = document.createElement("option");
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      templateSelect.appendChild(opt);
    }

    templateSelect.value = current_template_id;
  };

  const get_current_template = (): message_template | undefined =>
    templates.find((t) => t.id === current_template_id);

  render_templates();
  const initial = get_current_template();
  if (initial) {
    messageEl.value = initial.template;
  }

  templateSelect.addEventListener("change", () => {
    current_template_id = templateSelect.value;
    const t = get_current_template();
    if (t) {
      messageEl.value = t.template;
    }
  });

  saveTplBtn.addEventListener("click", () => {
    const name = window.prompt("template name");
    if (!name) {
      return;
    }

    const tpl: message_template = {
      id: create_template_id(),
      name,
      template: messageEl.value
    };

    templates = upsert_template({ templates, template: tpl });
    save_templates(storage, templates);
    current_template_id = tpl.id;
    render_templates();
  });

  delTplBtn.addEventListener("click", () => {
    const current = get_current_template();
    if (!current || current.id === "default") {
      return;
    }

    templates = delete_template({ templates, id: current.id });
    save_templates(storage, templates);
    current_template_id = templates[0]?.id ?? "default";
    render_templates();
  });

  const clear_log = () => {
    logEl.innerHTML = "";
  };

  const log_line = (params: {
    status: "ok" | "fail" | "info";
    message: string;
  }) => {
    const row = document.createElement("div");
    const cls =
      params.status === "ok"
        ? "smc_ok"
        : params.status === "fail"
          ? "smc_fail"
          : "";

    row.className = cls;
    row.textContent = params.message;
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;
  };

  const get_delay_ms = () => clamp_delay_ms(Number(delayEl.value));

  refreshBtn.addEventListener("click", () => {
    bindings.actions.on_refresh_selection();
  });

  startBtn.addEventListener("click", () => {
    const targets = bindings.get_selected();
    if (targets.length === 0) {
      log_line({ status: "fail", message: "select 1 or more friends first" });
      return;
    }

    const msg = messageEl.value.trim();
    if (!msg) {
      log_line({ status: "fail", message: "message is empty" });
      return;
    }

    clear_log();
    bindings.actions.on_start({
      message_template: msg,
      delay_ms: get_delay_ms()
    });
  });

  pauseBtn.addEventListener("click", () => bindings.actions.on_pause());
  resumeBtn.addEventListener("click", () =>
    bindings.actions.on_resume({ delay_ms: get_delay_ms() })
  );
  stopBtn.addEventListener("click", () => bindings.actions.on_stop());

  const handle: panel_handle = {
    set_selected_count: (count: number) => {
      selectedEl.textContent = String(count);
    },
    events: {
      on_state_change: (state) => {
        stateEl.textContent = format_state(state);
        log_line({ status: "info", message: `state: ${format_state(state)}` });
      },
      on_progress: (p) => {
        progressEl.textContent = `${p.processed}/${p.total}`;
        successEl.textContent = String(p.success);
        failedEl.textContent = String(p.failed);
      },
      on_item_result: (item) => {
        const link = `https://steamcommunity.com/profiles/${item.target.steam_id}`;
        if (item.status === "success") {
          log_line({
            status: "ok",
            message: `ok: ${item.target.display_name} (${link})`
          });
        } else {
          log_line({
            status: "fail",
            message: `fail: ${item.target.display_name} (${link}) - ${item.error_message ?? "error"}`
          });
        }
      }
    }
  };

  const refresh_selection = () => {
    const targets = bindings.get_selected();
    handle.set_selected_count(targets.length);
  };

  refresh_selection();

  window.setInterval(refresh_selection, 2000);

  return handle;
}
