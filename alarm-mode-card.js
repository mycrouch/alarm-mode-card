/*
 * Alarm Mode Card v1.0.0
 * A Home Assistant alarm panel card that looks and behaves like the built-in
 * alarm panel, with a pickable icon and label on every arm button.
 * https://github.com/mycrouch/alarm-mode-card
 * MIT License - Jason Crouch
 */
(() => {
  const VERSION = "1.0.0";
  const TAG = "alarm-mode-card";
  const EDITOR_TAG = "alarm-mode-card-editor";
  const DOMAIN = "alarm_control_panel";

  console.info(
    `%c ALARM-MODE-CARD %c v${VERSION} `,
    "color:#fff;background:#c62828;font-weight:700;border-radius:4px 0 0 4px;padding:2px 4px",
    "color:#c62828;background:#fff;font-weight:700;border-radius:0 4px 4px 0;padding:2px 4px"
  );

  // action -> armed state, service, default icon, fallback label
  const ACTIONS = {
    arm_home: { state: "armed_home", service: "alarm_arm_home", icon: "mdi:home", label: "Arm home" },
    arm_away: { state: "armed_away", service: "alarm_arm_away", icon: "mdi:lock", label: "Arm away" },
    arm_night: { state: "armed_night", service: "alarm_arm_night", icon: "mdi:weather-night", label: "Arm night" },
    arm_vacation: { state: "armed_vacation", service: "alarm_arm_vacation", icon: "mdi:airplane", label: "Arm vacation" },
    arm_custom_bypass: { state: "armed_custom_bypass", service: "alarm_arm_custom_bypass", icon: "mdi:shield", label: "Custom bypass" },
    disarm: { state: "disarmed", service: "alarm_disarm", icon: "mdi:shield-off", label: "Disarm" },
  };
  const ARM_ACTIONS = Object.keys(ACTIONS).filter((a) => a !== "disarm");
  const DEFAULT_STATES = ["arm_home", "arm_away"];
  const DISARMED = ["disarmed", "off"];
  const STATE_ICONS = {
    disarmed: "mdi:shield-off",
    off: "mdi:shield-off",
    arming: "mdi:shield-outline",
    pending: "mdi:shield-outline",
    triggered: "mdi:bell-ring",
    unavailable: "mdi:shield-alert-outline",
    unknown: "mdi:shield-alert-outline",
  };
  // [dark, vivid] pairs from the shared gradient-themes palette
  const HUES = {
    disarmed: ["#1c2a33", "#546e7a"],
    armed: ["#0c3524", "#00a86b"],
    pending: ["#3a2f0b", "#b28704"],
    triggered: ["#380d12", "#c62828"],
  };

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const mixHex = (a, b, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };

  const aliasList = (v) =>
    (Array.isArray(v) ? v : String(v ?? "").split(","))
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);

  const normalise = (config) => {
    const c = { ...config };
    delete c.type;
    return JSON.stringify(c);
  };

  class AlarmModeCard extends HTMLElement {
    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    static getStubConfig(hass) {
      const entity = Object.keys(hass?.states || {}).find((e) => e.startsWith(DOMAIN + "."));
      return { entity: entity || "", states: [...DEFAULT_STATES] };
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._code = "";
      this._key = "";
    }

    setConfig(config) {
      if (!config || !config.entity || !String(config.entity).startsWith(DOMAIN + ".")) {
        throw new Error("Select an alarm_control_panel entity");
      }
      this._config = { mode_buttons: "auto", style: "default", show_labels: true, ...config };
      const states = Array.isArray(config.states) && config.states.length ? config.states : DEFAULT_STATES;
      this._states = states.filter((s) => ARM_ACTIONS.includes(s));
      this._key = "";
      this._update();
    }

    set hass(hass) {
      this._hass = hass;
      this._update();
    }

    getCardSize() {
      return 3;
    }

    getGridOptions() {
      return { columns: 12, min_columns: 6, rows: "auto" };
    }

    _label(action) {
      const custom = this._config["label_" + action];
      if (custom) return custom;
      const loc = this._hass?.localize?.(`ui.card.alarm_control_panel.${action}`);
      return loc || ACTIONS[action].label;
    }

    _icon(action) {
      return this._config["icon_" + action] || ACTIONS[action].icon;
    }

    // Which arm action does the current entity state belong to?
    // Matches the standard armed state, a custom label, or a listed alias
    // (some integrations report a custom mode by its own name).
    _activeAction(state) {
      const s = String(state).toLowerCase();
      return ARM_ACTIONS.find((a) => {
        if (s === ACTIONS[a].state) return true;
        const label = this._config["label_" + a];
        if (label && s === String(label).toLowerCase()) return true;
        return aliasList(this._config["alias_" + a]).includes(s);
      });
    }

    _update() {
      if (!this._config || !this._hass) return;
      const st = this._hass.states[this._config.entity];
      const key = JSON.stringify([
        st ? [st.state, st.attributes.friendly_name, st.attributes.code_format, st.attributes.code_arm_required] : null,
        this._hass.themes?.darkMode,
        this._hass.locale?.language,
        normalise(this._config),
      ]);
      if (key === this._key) return;
      this._key = key;
      this._render(st);
    }

    _render(st) {
      const cfg = this._config;
      if (!st) {
        this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px">Entity not found: ${esc(cfg.entity)}</div></ha-card>`;
        return;
      }
      const state = st.state;
      const lower = String(state).toLowerCase();
      const unavailable = lower === "unavailable" || lower === "unknown";
      const disarmed = DISARMED.includes(lower);
      const active = this._activeAction(state);
      const transitional = ["arming", "pending", "disarming"].includes(lower);
      const triggered = lower === "triggered";

      // header chip
      const chipIcon = active ? this._icon(active) : STATE_ICONS[lower] || "mdi:shield";
      let chipLabel;
      if (active && cfg["label_" + active]) chipLabel = cfg["label_" + active];
      else chipLabel = this._hass.formatEntityState?.(st) || state;

      // colours
      const hueKey = triggered ? "triggered" : transitional ? "pending" : active ? "armed" : "disarmed";
      const slug = active ? ACTIONS[active].state : lower;
      const fallback = { triggered: "#db4437", pending: "#ff9800", armed: "#4caf50", disarmed: "#9e9e9e" }[hueKey];
      const [dark, vivid] = HUES[hueKey];
      let vars;
      if (cfg.style === "bold") {
        vars = `--amc-bg:linear-gradient(145deg, ${dark} 0%, ${vivid} 130%);--amc-text:#fff;--amc-sub:rgba(255,255,255,.72);--amc-accent:#fff;--amc-line:rgba(255,255,255,.28);--amc-fill:rgba(255,255,255,.16);`;
      } else if (cfg.style === "light") {
        vars = `--amc-bg:linear-gradient(145deg, ${mixHex(vivid, "#ffffff", 0.88)} 0%, ${mixHex(vivid, "#ffffff", 0.62)} 130%);--amc-text:#212121;--amc-sub:rgba(0,0,0,.6);--amc-accent:${mixHex(vivid, "#000000", 0.15)};--amc-line:rgba(0,0,0,.18);--amc-fill:rgba(0,0,0,.07);`;
      } else {
        vars = `--amc-accent:var(--state-alarm_control_panel-${esc(slug)}-color, ${fallback});`;
      }

      // buttons
      const always = cfg.mode_buttons === "always";
      const actions = [];
      if (always || disarmed) actions.push(...this._states);
      if (always || !disarmed) actions.push("disarm");
      const buttons = actions
        .map((a) => {
          const on = a === "disarm" ? always && disarmed : a === active;
          return `<button class="action${on ? " on" : ""}" data-action="${a}" ${unavailable ? "disabled" : ""} title="${esc(this._label(a))}">
            <ha-icon icon="${esc(this._icon(a))}"></ha-icon>${cfg.show_labels === false ? "" : `<span>${esc(this._label(a))}</span>`}
          </button>`;
        })
        .join("");

      // code entry, as the built-in card: only when the panel asks for one
      const fmt = st.attributes.code_format;
      const needCode = !unavailable && fmt && (!disarmed || st.attributes.code_arm_required || always);
      const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "clear"];
      const codeHtml = !needCode
        ? ""
        : `<input class="code" type="password" autocomplete="off" ${fmt === "number" ? 'inputmode="numeric"' : ""} placeholder="${esc(
            this._hass.localize?.("ui.card.alarm_control_panel.code") || "Code"
          )}">` +
          (fmt === "number"
            ? `<div class="keypad">${keys
                .map((k) =>
                  k === ""
                    ? "<span></span>"
                    : `<button class="key" data-key="${k}">${k === "clear" ? '<ha-icon icon="mdi:backspace-outline"></ha-icon>' : k}</button>`
                )
                .join("")}</div>`
            : "");

      this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; }
          ha-card {
            --amc-text: var(--primary-text-color);
            --amc-sub: var(--secondary-text-color);
            --amc-line: var(--divider-color, rgba(127,127,127,.3));
            --amc-fill: rgba(127,127,127,.12);
            padding: 12px 16px 16px; height: 100%; box-sizing: border-box;
            color: var(--amc-text); background: var(--amc-bg, var(--ha-card-background, var(--card-background-color)));
            display: flex; flex-direction: column; justify-content: center; gap: 12px;
          }
          .header { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:40px; }
          .name { font-size: var(--ha-card-header-font-size, 24px); line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          button { font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
          .chip {
            display:inline-flex; align-items:center; gap:6px; flex:none; padding:6px 12px 6px 8px; border-radius:999px;
            border:1px solid var(--amc-accent); background: color-mix(in srgb, var(--amc-accent) 16%, transparent);
            font-size:14px; font-weight:500;
          }
          .chip ha-icon { --mdc-icon-size:18px; color: var(--amc-accent); }
          .chip.blink { animation: amc-blink 1s ease-in-out infinite; }
          @keyframes amc-blink { 50% { opacity:.35; } }
          .actions { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0,1fr); gap:8px; }
          .action {
            display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px;
            padding:10px 4px; min-height:64px; border-radius:12px; border:1px solid var(--amc-line); background:transparent;
            transition: background .15s, border-color .15s;
          }
          .action ha-icon { --mdc-icon-size:28px; }
          .action span { font-size:12px; font-weight:500; letter-spacing:.04em; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
          .action:hover { background: var(--amc-fill); }
          .action.on { border-color: var(--amc-accent); background: color-mix(in srgb, var(--amc-accent) 16%, transparent); }
          .action.on ha-icon { color: var(--amc-accent); }
          .action[disabled] { opacity:.4; cursor:default; }
          .code {
            width:100%; box-sizing:border-box; padding:10px 12px; border-radius:10px; border:1px solid var(--amc-line);
            background: var(--amc-fill); color: inherit; font-size:18px; text-align:center; letter-spacing:.3em; outline:none;
          }
          .code:focus { border-color: var(--amc-accent); }
          .keypad { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; max-width:280px; width:100%; margin:0 auto; }
          .key { height:48px; border-radius:12px; border:1px solid var(--amc-line); background:transparent; font-size:18px; }
          .key:hover { background: var(--amc-fill); }
        </style>
        <ha-card style="${vars}">
          <div class="header">
            <div class="name">${esc(cfg.name ?? st.attributes.friendly_name ?? cfg.entity)}</div>
            <button class="chip${transitional || triggered ? " blink" : ""}" title="${esc(chipLabel)}">
              <ha-icon icon="${esc(chipIcon)}"></ha-icon><span>${esc(chipLabel)}</span>
            </button>
          </div>
          <div class="actions">${buttons}</div>
          ${codeHtml}
        </ha-card>`;

      const root = this.shadowRoot;
      const input = root.querySelector(".code");
      if (input) {
        input.value = this._code;
        input.addEventListener("input", () => (this._code = input.value));
      } else {
        this._code = "";
      }
      root.querySelector(".chip").addEventListener("click", () =>
        this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: cfg.entity } }))
      );
      root.querySelectorAll(".action").forEach((b) =>
        b.addEventListener("click", () => {
          const data = { entity_id: cfg.entity };
          if (this._code) data.code = this._code;
          this._hass.callService(DOMAIN, ACTIONS[b.dataset.action].service, data);
          this._code = "";
          if (input) input.value = "";
        })
      );
      root.querySelectorAll(".key").forEach((k) =>
        k.addEventListener("click", () => {
          this._code = k.dataset.key === "clear" ? "" : this._code + k.dataset.key;
          if (input) input.value = this._code;
        })
      );
    }
  }

  class AlarmModeCardEditor extends HTMLElement {
    setConfig(config) {
      const incoming = normalise(config);
      if (this._config && incoming === normalise(this._config)) return; // echo of our own change: keep focus
      this._config = { ...config };
      this._sync();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._form) this._form.hass = hass;
      else this._sync();
    }

    _schema() {
      const all = [...ARM_ACTIONS, "disarm"];
      const section = (title, prefix, selector) => ({
        type: "expandable",
        name: prefix + "section",
        title,
        flatten: true,
        schema: all.map((a) => ({ name: prefix + a, selector: selector(a) })),
      });
      return [
        { name: "entity", required: true, selector: { entity: { domain: DOMAIN } } },
        { name: "name", selector: { text: {} } },
        {
          name: "states",
          selector: { select: { multiple: true, mode: "list", options: ARM_ACTIONS.map((a) => ({ value: a, label: ACTIONS[a].label })) } },
        },
        {
          name: "mode_buttons",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "auto", label: "Like the built-in card (arm buttons when disarmed, Disarm when armed)" },
                { value: "always", label: "Always show every button" },
              ],
            },
          },
        },
        {
          name: "style",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "default", label: "Default (follows theme)" },
                { value: "bold", label: "Bold (dark gradient by state)" },
                { value: "light", label: "Light (pastel gradient by state)" },
              ],
            },
          },
        },
        { name: "show_labels", selector: { boolean: {} } },
        section("Icons", "icon_", (a) => ({ icon: { placeholder: ACTIONS[a].icon } })),
        section("Labels", "label_", () => ({ text: {} })),
        section("Extra states that count as this mode (comma separated)", "alias_", () => ({ text: {} })),
      ];
    }

    _label(s) {
      const fixed = {
        entity: "Alarm entity",
        name: "Name (optional)",
        states: "Arm buttons",
        mode_buttons: "Button behaviour",
        style: "Style",
        show_labels: "Show labels under icons",
      };
      if (fixed[s.name]) return fixed[s.name];
      const m = /^(icon|label|alias)_(.+)$/.exec(s.name || "");
      return m && ACTIONS[m[2]] ? ACTIONS[m[2]].label : s.title || s.name;
    }

    _sync() {
      if (!this._hass || !this._config) return;
      if (!this._form) {
        this._form = document.createElement("ha-form");
        this._form.computeLabel = (s) => this._label(s);
        this._form.addEventListener("value-changed", (ev) => {
          ev.stopPropagation();
          const v = { ...ev.detail.value };
          // defensive: un-nest any expandable section that arrived nested
          ["icon_section", "label_section", "alias_section"].forEach((k) => {
            if (v[k] && typeof v[k] === "object") Object.assign(v, v[k]);
            delete v[k];
          });
          const next = { type: this._config.type, ...v };
          Object.keys(next).forEach((k) => {
            if (next[k] === "" || next[k] === null || next[k] === undefined) delete next[k];
          });
          this._config = next;
          this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config: next } }));
        });
        this.appendChild(this._form);
      }
      this._form.hass = this._hass;
      this._form.schema = this._schema();
      this._form.data = { mode_buttons: "auto", style: "default", show_labels: true, states: DEFAULT_STATES, ...this._config };
    }
  }

  if (!customElements.get(TAG)) customElements.define(TAG, AlarmModeCard);
  if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, AlarmModeCardEditor);

  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === TAG)) {
    window.customCards.push({
      type: TAG,
      name: "Alarm Mode Card",
      description: "The built-in alarm panel, with your own icon and label on every arm button.",
      preview: true,
      documentationURL: "https://github.com/mycrouch/alarm-mode-card",
    });
  }
})();
