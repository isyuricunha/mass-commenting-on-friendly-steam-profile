# How to Use

This guide assumes you are familiar with opening the console or developer tools in your browser. Here's a straightforward method to use this script:

## Steps:

1. **Navigate to Steam Friends List:**
   - Open Steam in your web browser.
   - Navigate to the "Friends" tab.

2. **Open Developer Tools:**
   - **For most browsers:**
     - Right-click anywhere on the page.
     - Select "Inspect" or "Inspect Element".
     - In the new window or tab that opens, switch to the "Console" tab.

   Note: The exact method might slightly differ based on your browser.

3. **Run the Script:**
   - **Copy the Code:** Open the file named "mass script" and copy all the JavaScript code.
   - **Paste in Console:** Paste the copied code into the browser's console and press Enter to execute it.

4. **Customize Your Message:**
   - A dialogue box will appear allowing you to:
     - Write your message in the provided text area.
     - Select which friends you want to send the message to (all, some, or none).

5. **Using Personalized Tags:**
   - You can use `%s` within your message to insert the friend's profile name automatically. For example:
     - If your message is `What's up, %s?`, and your friend's name is `Yuri`, the comment posted on Yuri's profile would read:
       ```
       What's up, Yuri?
       ```

# mass-commenting on friendly steam profile

This is a straight-to-the-point browser console script that lets me post the same (or personalized) comment to multiple Steam friends' profiles in one go. I run it on the Steam Friends page in a web browser, it drops a small UI on the page, I type the message, select friends, and it handles the posting with proper delays.

## What it does
- Posts comments to selected friends' profile comment sections from the Friends page.
- Supports a simple personalization token `%s` that gets replaced by the friend's display name.
- Adds a small UI right under the friends management area so I don't have to leave the page.
- Shows progress and a per-friend log (success/fail) while it's running.
- Waits 6 seconds between comments to play nice with rate limiting.

## Requirements
- Be logged into Steam in a web browser (not the desktop client).
- Open the Friends list page on steamcommunity.com.
- The page needs to load Steam's own scripts (jQuery, `g_sessionID`, `ToggleManageFriends`, `CEmoticonPopup`), which are present on the Friends page.

## How it works (in short)
- The script injects a small comment box UI after `#manage_friends`.
- I type a message (optional `%s` for friend name) and click "Post Comments to Selected Friends".
- It loops through `.selected` friend tiles, grabs each friend's SteamID, and posts to `//steamcommunity.com/comment/Profile/post/<steamid>/-1/` with the active `g_sessionID`.
- It delays each request by 6 seconds per friend to avoid hammering.
- It updates a log area with successes or errors and shows a running counter.

## Step-by-step (my flow)
1. Open Steam in a web browser and go to my Friends page.
2. Open DevTools → Console.
3. Open `mass-script.js` from this repo and copy all code.
4. Paste it into the console and press Enter.
5. Use the small panel that appears:
   - Type my message in the text area.
   - Select the friends I want (Steam's selection UI). The script reads elements with the `.selected` class.
   - Click the green "Post Comments to Selected Friends" button.
6. Watch the log for status and progress until it's done.

## Personalizing messages with `%s`
- If I include `%s` anywhere in the message, it gets replaced with the friend's profile display name.
- Example:
  - Message I type: `What's up, %s?`
  - Friend named `Yuri` gets: `What's up, Yuri?`
- If I don't use `%s`, it just posts the same text to everyone.

## Rate limiting and delays
- It uses a fixed 6-second delay between comments.
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
  - In `mass-script.js`, edit the `index * 6000` value inside `setTimeout` in `postCommentWithDelay()`.
- Does this work outside the Friends page?
  - It's designed for the Friends page where Steam exposes the right globals and markup.
- Do I need to install anything?
  - No. It's a copy/paste-in-console script.

## Dev notes
Main functions in `mass-script.js`:
- `initCommentManagement()`
  - Injects the UI after `#manage_friends`, wires the emoticon popup, and binds the submit handler.
- `handleCommentSubmission()`
  - Reads `.selected` friends, builds personalized messages, and queues posts.
- `postCommentWithDelay(index, profileID, message, total)`
  - Delays requests by `index * 6000` ms and posts using `jQuery.ajax` to Steam's endpoint with `g_sessionID`.
- `updateLog(profileID, status)`
  - Appends status lines with links to each profile.
- `updateProgress(current, total)`
  - Updates a simple processed counter.
- `clearLog()`
  - Clears the log area before a run.

Assumptions:
- jQuery is present (it is on the Steam Friends page).
- `g_sessionID`, `ToggleManageFriends`, and `CEmoticonPopup` exist on that page.

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
