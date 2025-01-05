function initCommentManagement() {
    ToggleManageFriends();

    const commentTemplate = `
        <div class="commentthread_entry">
            <div class="commentthread_entry_quotebox">
                <textarea rows="1" class="commentthread_textarea" id="comment_textarea" placeholder="Add a comment" style="overflow: hidden; height: 20px;"></textarea>
            </div>
            <div class="commentthread_entry_submitlink">
                <a class="btn_grey_black btn_small_thin" href="javascript:CCommentThread.FormattingHelpPopup('Profile');"><span>Formatting help</span></a>
                <span class="emoticon_container"><span class="emoticon_button small" id="emoticonbtn"></span></span>
                <span class="btn_green_white_innerfade btn_small" id="comment_submit"><span>Post Comments to Selected Friends</span></span>
            </div>
        </div>
        <div id="log"><span id="log_head"></span><span id="log_body"></span></div>
    `;

    jQuery("#manage_friends").after(commentTemplate);
    new CEmoticonPopup($J("#emoticonbtn"), $J("#commentthread_Profile_0_textarea"));

    jQuery("#comment_submit").on("click", handleCommentSubmission);
}

function handleCommentSubmission() {
    const selectedFriends = jQuery(".selected");
    const commentMessage = jQuery("#comment_textarea").val().trim();
    const totalFriends = selectedFriends.length;

    if (totalFriends === 0 || commentMessage.length === 0) {
        alert("Please make sure you entered a message and selected 1 or more friends.");
        return;
    }

    clearLog();
    selectedFriends.each(function(index) {
        const profileID = this.getAttribute("data-steamid");
        const friendName = this.querySelector(".friend_block_content").childNodes[0].nodeValue.trim();
        const personalizedMsg = commentMessage.replace("%s", friendName);

        postCommentWithDelay(index, profileID, personalizedMsg, totalFriends);
    });
}

function clearLog() {
    jQuery("#log_head, #log_body").html("");
}

function postCommentWithDelay(index, profileID, message, total) {
    setTimeout(() => {
        jQuery.ajax({
            url: "//steamcommunity.com/comment/Profile/post/" + profileID + "/-1/",
            type: "POST",
            data: { comment: message, count: 6, sessionid: g_sessionID },
            success: function(response) {
                updateLog(profileID, response.success ? "Success" : "Error: " + response.error);
            },
            error: function() {
                updateLog(profileID, "Failed");
            },
            complete: function() {
                updateProgress(index + 1, total);
            }
        });
    }, index * 6000); // 6 seconds delay per comment
}

function updateLog(profileID, status) {
    const logBody = jQuery("#log_body");
    const link = "<a href='http://steamcommunity.com/profiles/" + profileID + "'>" + profileID + "</a>";
    logBody.append("<br>" + status + " posting comment on " + link);
}

function updateProgress(current, total) {
    jQuery("#log_head").html("<br><b>Processed " + current + " out of " + total + " friends.</b>");
}

// Initialize the script when the document is fully loaded
jQuery(document).ready(initCommentManagement);