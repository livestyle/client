var EventEmitter = require('events').EventEmitter;
function WebSocket(url) {
	this.url = url;
	if (WebSocket.expectUrl) {
		WebSocket.online = this.url === WebSocket.expectUrl;
	}
	WebSocket.emitter.emit('create', this);
	var self = this;
	setTimeout(function() {
		WebSocket.online ? self.onopen() : self.onclose();
	}, 1);
}

WebSocket.emitter = new EventEmitter();
WebSocket.online = true;
WebSocket.expectUrl = null;

WebSocket.prototype = {
	onopen: function() {},
	onclose: function() {},
	onerror: function() {},
	onmessage: function() {},
	send: function(msg) {
		WebSocket.emitter.emit('send', msg);
	},
	close: function() {
		this.onclose();
		WebSocket.emitter.emit('close', this);
	}
};

module.exports = WebSocket;