# How to use

This project injects a small in-page panel on the Steam Friends page that lets you post the same (or personalized) profile comment to multiple selected friends.

You can use it in 3 ways:

## 1) Console (copy/paste)

1. Open Steam in a web browser and go to the Friends page on `steamcommunity.com`.
2. Open DevTools → Console.
3. Copy all contents of `mass-script.js`.
4. Paste into the console and press Enter.

## 2) Userscript (Tampermonkey / Violentmonkey)

1. Install Tampermonkey (Chrome/Edge) or Violentmonkey (Firefox).
2. Create a new userscript.
3. Paste the contents of `mass-script.user.js`.
4. Save.
5. Open the Steam Friends page; the panel should appear automatically.

## 3) Extension (Chrome/Edge)

1. Go to `chrome://extensions`.
2. Enable "Developer mode".
3. Click "Load unpacked".
4. Select the `extension/` folder from this repository.
5. Open the Steam Friends page; the panel should appear automatically.

# mass-commenting on friendly steam profile

This is a straight-to-the-point browser console script that lets me post the same (or personalized) comment to multiple Steam friends' profiles in one go. I run it on the Steam Friends page in a web browser, it drops a small UI on the page, I type the message, select friends, and it handles the posting with proper delays.

## What it does
- Posts comments to selected friends' profile comment sections from the Friends page.
- Supports a simple personalization token `%s` that gets replaced by the friend's display name.
- Adds a small in-page panel so I don't have to leave the page.
- Shows progress and a per-friend log (success/fail) while it's running.
- Uses a configurable delay between comments to play nice with rate limiting.

## Requirements
- Be logged into Steam in a web browser (not the desktop client).
- Open the Friends list page on steamcommunity.com.
- The page needs a valid logged-in session (so `g_sessionID` exists).

## How it works (in short)
- The script injects a small in-page panel.
- I type a message (optional `%s` for friend name), select friends using Steam's selection UI, and click start.
- It reads selected friend tiles (`.selected`), grabs each friend's SteamID, and posts to `https://steamcommunity.com/comment/Profile/post/<steamid>/-1/` with the active `g_sessionID`.
- It delays each request to avoid hammering.
- It updates a per-friend log plus progress counters.

## Step-by-step (my flow)
1. Open Steam in a web browser and go to my Friends page.
2. Open DevTools → Console.
3. Open `mass-script.js` from this repo and copy all code.
4. Paste it into the console and press Enter.
5. Use the small panel that appears:
   - Type my message in the text area.
   - Select the friends I want (Steam's selection UI). The script reads elements with the `.selected` class.
   - Click start.
6. Watch the log for status and progress until it's done.

## Personalizing messages with `%s`
- If I include `%s` anywhere in the message, it gets replaced with the friend's profile display name.
- Example:
  - Message I type: `What's up, %s?`
  - Friend named `Yuri` gets: `What's up, Yuri?`
- If I don't use `%s`, it just posts the same text to everyone.

## Rate limiting and delays
- The panel uses a delay value in milliseconds (default: 6000ms).
- This is conservative to reduce the chance of temporary blocks or errors.
- If I'm posting to a lot of friends, it will take a while. That's intentional and safer.

## Where the UI gets added
- Injected right after the element with id `manage_friends`.
- Uses Steam's CSS classes so it looks native enough.
- Supports Steam's emoticon popup via `CEmoticonPopup`.

## Troubleshooting
- Nothing happens when I click post
  - Make sure one or more friends are selected (tiles must have the `.selected` class).
  - Make sure I'm on the Friends page in a logged-in session (so `g_sessionID` exists).
  - Reload the page and try again.
- Errors show up in the log as "Error" or "Failed"
  - Usually network hiccups or temporary rate limiting.
  - Wait and retry. The delay helps, but Steam can still throttle.
- My message doesn't personalize
  - Check that `%s` is included exactly as `%s` (lowercase s).
  - Some names may include spaces or special chars; that's fine.

## FAQ
- Can I change the delay?
  - Use the delay input in the panel.
- Does this work outside the Friends page?
  - It's designed for the Friends page where Steam exposes the right globals and markup.
- Do I need to install anything?
  - For console usage, no. For userscript/extension usage, install the respective tool.

## Development

Build and tests:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Artifacts:

- `mass-script.js` (console)
- `mass-script.user.js` (userscript)
- `extension/content-script.js` (extension content script)

## Dev notes
Main pieces:

- `src/core/comment_runner.ts`
  - Queue runner with `start/pause/resume/stop` and per-item delay.
- `src/steam/steam_dom.ts`
  - Extracts selected friends from the DOM.
- `src/steam/steam_api.ts`
  - Posts comments via `fetch` using `g_sessionID`.
- `src/ui/panel.ts`
  - In-page panel UI, templates (localStorage), progress/log.

Assumptions:
- jQuery is present (it is on the Steam Friends page).
- `g_sessionID` exists on that page.

## Safety and responsibility
- Don't spam people. Use this respectfully.
- Read Steam's rules and terms; you're responsible for your account and what you post.

## License
- See `license.md` in the repo.

---
If you want changes or extra features (different delay strategy, randomization, bookmarking, etc.), tweak `mass-script.js` and go from there.

## Important Notes:
- Ensure you've selected at least one friend before attempting to post comments.
- Be cautious with what you post, as there's no undo option for comments on Steam profiles.

That's all you need to know! Use this tool responsibly and enjoy mass commenting with ease.
