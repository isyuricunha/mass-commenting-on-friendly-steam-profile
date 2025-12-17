import { get_json, set_json, type storage_like } from "./storage";

export type message_template = {
  id: string;
  name: string;
  template: string;
};

const templates_key = "steam_mass_commenter.templates.v1";

export function load_templates(storage: storage_like): message_template[] {
  const templates = get_json<message_template[]>({
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

export function save_templates(
  storage: storage_like,
  templates: message_template[]
) {
  set_json({ storage, key: templates_key, value: templates });
}

export function upsert_template(params: {
  templates: message_template[];
  template: message_template;
}) {
  const { templates, template } = params;
  const idx = templates.findIndex((t) => t.id === template.id);

  if (idx >= 0) {
    const next = templates.slice();
    next[idx] = template;
    return next;
  }

  return [...templates, template];
}

export function delete_template(params: {
  templates: message_template[];
  id: string;
}) {
  const { templates, id } = params;
  return templates.filter((t) => t.id !== id);
}

export function create_template_id() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
