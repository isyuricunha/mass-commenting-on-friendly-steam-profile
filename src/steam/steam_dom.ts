import type { friend_target } from "../core/comment_runner";

function text_content(node: Element | null | undefined) {
  return (node?.textContent ?? "").trim();
}

export function get_selected_friends(): friend_target[] {
  const selected = Array.from(document.querySelectorAll(".selected"));

  const friends: friend_target[] = [];
  for (const el of selected) {
    const steam_id = el.getAttribute("data-steamid");
    if (!steam_id) {
      continue;
    }

    const name_el = el.querySelector(".friend_block_content") ?? el;
    const display_name = text_content(name_el).split("\n")[0] || steam_id;

    friends.push({ steam_id, display_name });
  }

  return friends;
}
