// messageboard server API

// load messages from previous run
if (localStorage["bugout-messageboard"]) {
  messages = JSON.parse(localStorage["bugout-messageboard"]);
}
if (typeof(messages) != "object" || !messages["length"]) {
  messages = [];
}

// function to display the raw message data here
var msglist = document.getElementById("messages");
function updateMessagelist(messages) {
  msglist.innerHTML = JSON.stringify(messages.slice().reverse(), null, 2);
}
updateMessagelist(messages);

b.register("post", function(address, message, cb) {
  if (typeof(message) == "string" && message.length < 280) {
    messages.push({address: address, m: message, t: (new Date()).getTime()});
    console.log("messages pre", messages);
    messages = messages.slice(Math.max(0, messages.length - 10));
    localStorage["bugout-messageboard"] = JSON.stringify(messages);
    updateMessagelist(messages);
    console.log("messages post", messages);
    cb(true);
    b.send("refresh");
  } else {
    cb(false);
  }
}, "Post a message to the board");

b.register("list", function(address, args, cb) {
  cb(messages.slice().reverse());
}, "List most recent messages");
