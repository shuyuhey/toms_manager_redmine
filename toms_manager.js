var request = require("request");
var sequence = require("sequence").Sequence.create();
var config = require("./config.json");

var slave_message_data = {};

var get_sprint = function() {
  slave_message_data.version = {};
  request.get({
    url: config.redmine_url + "/projects/"+ config.redmine_project_id +"/versions.json",
    form: {
      key : config.redmine_key
    }},function(error, response, body) {
      if(!error && response.statusCode == 200) {
	var versions = JSON.parse(body).versions;
	for (var i = 0; i < versions.length; i++) {
	  if (versions[i].status == 'open') {
	    slave_message_data.version.id = versions[i].id;
	    slave_message_data.version.name = versions[i].name;
	  }
	}
      }
      else {
	console.log("error" + response.statusCode);
	console.log(body);
      }
    });
};

var get_ticket = function() {
  slave_message_data.tickets = [];

  request.get({
    url: config.redmine_url + "/issues.json",
    form: {
      key : config.redmine_key,
      status_id: "open"
    }}, function(error, response, body) {
      if(!error && response.statusCode == 200) {
	var tickets = JSON.parse(body).issues;
	for (var i = 0; i < tickets.length; i++) {
	  var ticket = tickets[i];
	  if (ticket.fixed_version != undefined &&
	      ticket.fixed_version.id == slave_message_data.version.id) {
	    slave_message_data.tickets.push({
	      tracker: ticket.tracker.name,
	      status: ticket.status.name,
	      name: ticket.subject
	    });
	  }
	}
      }
      else {
	console.log("error" + response.statusCode);
	console.log(body);
      }
    });
};

var make_message = function() {
  var message_string =
  "おはようございます\n" +
    "現在のスプリントは" + slave_message_data.version.name + "です\n" +
    "残りの未完了チケットは" + slave_message_data.tickets.length +
    "枚です\n" +
    "未完了のチケット一覧を表示します\n\n";

  for(var i=0; i<slave_message_data.tickets.length; i++) {
    var ticket = slave_message_data.tickets[i];
    message_string +=
    ticket.status.toString() + ": " +
      ticket.tracker.toString() + ": " +
      ticket.name.toString() + "\n" ;
  }

  return message_string;
};

var post_slack = function() {
  var message = {
    channel: config.slack_post_channel,
    username: config.slack_username,
    text: make_message(),
    icon_emoji: config.slack_icon_emoji
  };

  request.post({
    url: config.slack_url,
    form: {
      token: config.slack_token,
      payload: JSON.stringify(message)}
  }, function(error, response, body) {
    if(!error && response.statusCode == 200) {
      console.log(body.name);
    }
    else {
      console.log("error" + response.statusCode);
      console.log(response);
    }
  });
};

sequence
  .then(function (next) {
    setTimeout(function () {
      get_sprint();
      next();
    }, 10);
  })
  .then(function (next) {
    setTimeout(function () {
      get_ticket();
      next();
    }, 100);

  })
  .then(function (next) {
    setTimeout(function () {
      post_slack();
      next();
    }, 1000);
  });
