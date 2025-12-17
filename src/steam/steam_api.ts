import type {
  friend_target,
  post_comment_fn,
  post_result
} from "../core/comment_runner";

type steam_comment_response = {
  success: boolean;
  error?: string;
};

function get_session_id(): string | null {
  const maybe = (globalThis as unknown as { g_sessionID?: unknown }).g_sessionID;
  if (typeof maybe === "string" && maybe.trim().length > 0) {
    return maybe;
  }

  return null;
}

async function post_comment(params: {
  steam_id: string;
  message: string;
}): Promise<post_result> {
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

  let response: Response;
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

  let data: steam_comment_response;
  try {
    data = (await response.json()) as steam_comment_response;
  } catch {
    return { ok: false, error_message: "invalid json response" };
  }

  if (data.success) {
    return { ok: true };
  }

  return { ok: false, error_message: data.error ?? "unknown error" };
}

export const steam_post_comment: post_comment_fn = async (
  target: friend_target,
  message: string
) => post_comment({ steam_id: target.steam_id, message });

export function try_enable_friend_selection(): { ok: true } | { ok: false } {
  const maybe = (globalThis as unknown as { ToggleManageFriends?: unknown })
    .ToggleManageFriends;

  if (typeof maybe === "function") {
    try {
      (maybe as () => void)();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  return { ok: false };
}
