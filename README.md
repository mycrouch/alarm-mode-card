# Alarm Mode Card

A Home Assistant Lovelace card that looks and behaves like the built-in alarm panel card, except every button gets an icon and a label you choose. Built for alarm systems whose modes don't match Home Assistant's names, such as a Eufy HomeBase "Custom 1" mode that the household actually calls "Dog".

## Features

- **Behaves like the built-in card.** Name on the left, state chip on the right, arm buttons when disarmed and a Disarm button when armed. A code box and keypad appear only when the alarm entity asks for a code.
- **Pick any icon.** Each button has an icon picker in the visual editor, so anything in Material Design Icons (or any other icon set you have installed) can be used. Home, dog and padlock, for example.
- **Rename any button.** "Custom bypass" can read "Dog". The state chip uses the same label and icon when that mode is active.
- **Understands custom state names.** Some integrations report a custom mode by its own name instead of `armed_custom_bypass`. A button lights up when the entity state matches its standard state, its label, or any extra state names you list for it.
- **Optional always-on buttons.** Show every mode plus Disarm at all times, with the active one highlighted, for panels that can switch straight from one armed mode to another.
- **Three styles.** Default follows your theme and Home Assistant's alarm state colours. Bold and Light use a gradient tinted by state (disarmed, armed, pending, triggered).
- **Visual editor.** No YAML needed.

## Installation

### HACS (custom repository)

1. HACS → three-dot menu → Custom repositories.
2. Add `https://github.com/mycrouch/alarm-mode-card` with type **Dashboard**.
3. Download **Alarm Mode Card**, then hard-refresh the browser.

### Manual

Copy `alarm-mode-card.js` to `/config/www/`, then add `/local/alarm-mode-card.js` as a JavaScript module under Settings → Dashboards → Resources.

## Configuration

Add the card from the card picker ("Alarm Mode Card") and use the visual editor. YAML equivalent:

```yaml
type: custom:alarm-mode-card
entity: alarm_control_panel.home_base
name: Alarm
states:
  - arm_home
  - arm_custom_bypass
  - arm_away
icon_arm_home: mdi:home
icon_arm_custom_bypass: mdi:dog-side
icon_arm_away: mdi:lock
label_arm_home: Home
label_arm_custom_bypass: Dog
label_arm_away: Away
alias_arm_custom_bypass: Custom 1
mode_buttons: always
```

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | An `alarm_control_panel` entity. |
| `name` | entity name | Card title. |
| `states` | `arm_home`, `arm_away` | Arm buttons to show, in order. Any of `arm_home`, `arm_away`, `arm_night`, `arm_vacation`, `arm_custom_bypass`. |
| `mode_buttons` | `auto` | `auto` shows arm buttons when disarmed and Disarm when armed, like the built-in card. `always` shows everything and highlights the active mode. |
| `style` | `default` | `default`, `bold` or `light`. |
| `show_labels` | `true` | Show the label under each icon. |
| `icon_<action>` | built-in icon | Icon for a button, e.g. `icon_arm_custom_bypass: mdi:dog-side`. `<action>` is any arm action or `disarm`. |
| `label_<action>` | Home Assistant's label | Text for a button. Also used on the state chip while that mode is active. |
| `alias_<action>` | none | Comma-separated extra entity states that count as this mode, e.g. `Custom 1`. Not case sensitive. |

## Notes

- Buttons act on a single tap, the same as the built-in card.
- The entity states `disarmed` and `off` are both treated as disarmed.
- Tapping the state chip opens the entity's more-info dialog.

## Related projects

| Project | What it is |
| --- | --- |
| [airtouch-card](https://github.com/mycrouch/airtouch-card) | AirTouch climate card |
| [ecovacs-vacuum-card](https://github.com/mycrouch/ecovacs-vacuum-card) | Ecovacs vacuum card |
| [gradient-themes](https://github.com/mycrouch/gradient-themes) | The gradient palette the Bold and Light styles draw from |

## License

MIT © Jason Crouch. Default icons are referenced from [Material Design Icons](https://pictogrammers.com/library/mdi/) (Apache 2.0), as bundled with Home Assistant.
