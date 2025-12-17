// ==UserScript==
// @name         steam mass commenter
// @namespace    https://github.com/isyuricunha
// @version      0.0.0
// @description  mass comment on selected steam friends
// @match        https://steamcommunity.com/*/friends*
// @match        https://steamcommunity.com/profiles/*/friends*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/core/comment_runner.ts
  var comment_runner = class {
    constructor(post_comment2, events = {}) {
      this.post_comment = post_comment2;
      this.events = events;
      __publicField(this, "state", "idle");
      __publicField(this, "queue", []);
      __publicField(this, "index", 0);
      __publicField(this, "timeout_id", null);
      __publicField(this, "in_flight", false);
      __publicField(this, "processed", 0);
      __publicField(this, "success", 0);
      __publicField(this, "failed", 0);
    }
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
    start(params) {
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
    resume(options) {
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
    set_state(next) {
      this.state = next;
      this.events.on_state_change?.(next);
    }
    clear_timer() {
      if (this.timeout_id !== null) {
        globalThis.clearTimeout(this.timeout_id);
        this.timeout_id = null;
      }
    }
    emit_progress(current) {
      this.events.on_progress?.({
        total: this.queue.length,
        processed: this.processed,
        success: this.success,
        failed: this.failed,
        current
      });
    }
    async run_next(options) {
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
  };

  // src/steam/steam_dom.ts
  function text_content(node) {
    return (node?.textContent ?? "").trim();
  }
  function get_selected_friends() {
    const selected = Array.from(document.querySelectorAll(".selected"));
    const friends = [];
    for (const el2 of selected) {
      const steam_id = el2.getAttribute("data-steamid");
      if (!steam_id) {
        continue;
      }
      const name_el = el2.querySelector(".friend_block_content") ?? el2;
      const display_name = text_content(name_el).split("\n")[0] || steam_id;
      friends.push({ steam_id, display_name });
    }
    return friends;
  }

  // src/steam/steam_api.ts
  function get_session_id() {
    const maybe = globalThis.g_sessionID;
    if (typeof maybe === "string" && maybe.trim().length > 0) {
      return maybe;
    }
    return null;
  }
  async function post_comment(params) {
    const sessionid = get_session_id();
    if (!sessionid) {
      return {
        ok: false,
        error_message: "missing g_sessionID (are you logged in on the friends page?)"
      };
    }
    const url = `https://steamcommunity.com/comment/Profile/post/${params.steam_id}/-1/`;
    const body = new URLSearchParams({
      comment: params.message,
      count: "6",
      sessionid
    });
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body,
        credentials: "include"
      });
    } catch {
      return { ok: false, error_message: "network error" };
    }
    if (!response.ok) {
      return { ok: false, error_message: `http ${response.status}` };
    }
    let data;
    try {
      data = await response.json();
    } catch {
      return { ok: false, error_message: "invalid json response" };
    }
    if (data.success) {
      return { ok: true };
    }
    return { ok: false, error_message: data.error ?? "unknown error" };
  }
  var steam_post_comment = async (target, message) => post_comment({ steam_id: target.steam_id, message });
  function try_enable_friend_selection() {
    const maybe = globalThis.ToggleManageFriends;
    if (typeof maybe === "function") {
      try {
        maybe();
        return { ok: true };
      } catch {
        return { ok: false };
      }
    }
    return { ok: false };
  }

  // src/core/storage.ts
  function get_json({
    storage,
    key,
    fallback
  }) {
    const raw = storage.getItem(key);
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function set_json({
    storage,
    key,
    value
  }) {
    storage.setItem(key, JSON.stringify(value));
  }

  // src/core/templates.ts
  var templates_key = "steam_mass_commenter.templates.v1";
  function load_templates(storage) {
    const templates = get_json({
      storage,
      key: templates_key,
      fallback: []
    });
    if (templates.length > 0) {
      return templates;
    }
    return [
      {
        id: "default",
        name: "default",
        template: "hi %s"
      }
    ];
  }
  function save_templates(storage, templates) {
    set_json({ storage, key: templates_key, value: templates });
  }
  function upsert_template(params) {
    const { templates, template } = params;
    const idx = templates.findIndex((t) => t.id === template.id);
    if (idx >= 0) {
      const next = templates.slice();
      next[idx] = template;
      return next;
    }
    return [...templates, template];
  }
  function delete_template(params) {
    const { templates, id } = params;
    return templates.filter((t) => t.id !== id);
  }
  function create_template_id() {
    return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // src/ui/panel.ts
  var root_id = "steam_mass_commenter_panel";
  var style_id = "steam_mass_commenter_style";
  function el(selector) {
    const node = document.querySelector(selector);
    if (!node) {
      throw new Error(`missing element: ${selector}`);
    }
    return node;
  }
  function clamp_delay_ms(value) {
    if (!Number.isFinite(value)) {
      return 6e3;
    }
    return Math.max(1e3, Math.min(6e4, Math.floor(value)));
  }
  function format_state(state) {
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
  function ensure_root() {
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
  function mount_panel(bindings) {
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
          <div><span id="smc_progress">0/0</span> processed \xB7 <span id="smc_success">0</span> ok \xB7 <span id="smc_failed">0</span> fail</div>
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
    const stateEl = el("#smc_state");
    const selectedEl = el("#smc_selected");
    const progressEl = el("#smc_progress");
    const successEl = el("#smc_success");
    const failedEl = el("#smc_failed");
    const messageEl = el("#smc_message");
    const delayEl = el("#smc_delay");
    const logEl = el("#smc_log");
    const templateSelect = el("#smc_template_select");
    const toggleBtn = el("#smc_toggle");
    const startBtn = el("#smc_start");
    const pauseBtn = el("#smc_pause");
    const resumeBtn = el("#smc_resume");
    const stopBtn = el("#smc_stop");
    const refreshBtn = el("#smc_refresh");
    const saveTplBtn = el("#smc_template_save");
    const delTplBtn = el("#smc_template_delete");
    let collapsed = false;
    const set_collapsed = (next) => {
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
    const get_current_template = () => templates.find((t) => t.id === current_template_id);
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
      const tpl = {
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
    const log_line = (params) => {
      const row = document.createElement("div");
      const cls = params.status === "ok" ? "smc_ok" : params.status === "fail" ? "smc_fail" : "";
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
    resumeBtn.addEventListener(
      "click",
      () => bindings.actions.on_resume({ delay_ms: get_delay_ms() })
    );
    stopBtn.addEventListener("click", () => bindings.actions.on_stop());
    const handle = {
      set_selected_count: (count) => {
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
    window.setInterval(refresh_selection, 2e3);
    return handle;
  }

  // src/init/init_app.ts
  function boot() {
    if (document.getElementById("steam_mass_commenter_panel")) {
      return;
    }
    try_enable_friend_selection();
    const events = {};
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
    window["steam_mass_commenter_runner"] = runner;
  }
  function init_app({ distribution }) {
    void distribution;
    if (typeof window === "undefined") {
      return;
    }
    const global_key = "steam_mass_commenter";
    const existing = window[global_key];
    if (existing) {
      return;
    }
    const api = {
      init() {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", boot, { once: true });
          return;
        }
        boot();
      }
    };
    window[global_key] = api;
    api.init();
  }

  // src/entrypoints/userscript.ts
  init_app({
    distribution: "userscript"
  });
})();
