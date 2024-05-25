ToggleManageFriends();
jQuery("#manage_friends").after(
	'<div class="commentthread_entry"><div class="commentthread_entry_quotebox"><textarea rows="1" class="commentthread_textarea" id="comment_textarea" placeholder="Add a comment" style="overflow: hidden; height: 20px;"></textarea></div><div class="commentthread_entry_submitlink" style=""><a class="btn_grey_black btn_small_thin" href="javascript:CCommentThread.FormattingHelpPopup( \'Profile\' );"><span>Formatting help</span></a>   <span class="emoticon_container"><span class="emoticon_button small" id="emoticonbtn"></span></span><span class="btn_green_white_innerfade btn_small" id="comment_submit"><span>Post Comments to Selected Friends</span></span></div></div><div id="log"><span id="log_head"></span><span id="log_body"></span></div>'
);
new CEmoticonPopup($J("#emoticonbtn"), $J("#commentthread_Profile_0_textarea"));
jQuery("#comment_submit").click(function () {
	const total = jQuery(".selected").length;
	const msg = jQuery("#comment_textarea").val();
	if (total > 0 && msg.length > 0) {
		jQuery("#log_head, #log_body").html("");
		jQuery(".selected").each(function (i) {
			let profileID = this.getAttribute("data-steamid");
			(function (i, profileID) {
				setTimeout(function () {
					jQuery
						.post(
							"//steamcommunity.com/comment/Profile/post/" + profileID + "/-1/",
							{ comment: msg, count: 6, sessionid: g_sessionID },
							function (response) {
								if (response.success === false) {
									jQuery("#log_body")[0].innerHTML += "<br>" + response.error;
								} else {
									jQuery("#log_body")[0].innerHTML +=
										"<br>Successfully posted comment on <a href=http://steamcommunity.com/profiles/" +
										profileID +
										">" +
										profileID +
										"</a>";
								}
							}
						)
						.fail(function () {
							jQuery("#log_body")[0].innerHTML +=
								"<br>Failed to post comment on <a href=http://steamcommunity.com/profiles/" +
								profileID +
								">" +
								profileID +
								"</a>";
						})
						.always(function () {
							jQuery("#log_head").html(
								"<br><b>Processed " +
									(i + 1) +
									" out of " +
									total +
									" friends.<b>"
							);
						});
				}, i * 6000);
			})(i, profileID);
		});
	} else {
		alert(
			"Please make sure you entered a message and selected 1 or more friends."
		);
	}
});
