var eventMixin = require('./lib/eventMixin');

var defaultConfig = {
	host: 'ws://127.0.0.1:54000',
	timeout: 2000,
	endpoint: '/livestyle'
};

var STATUS_IDLE = 'idle';
var STATUS_CONNECTING = 'connecting';
var STATUS_CONNECTED = 'connected';

var sock = null;
var _timer;
var retry = true;
var status = STATUS_IDLE;

function extend(obj) {
	for (var i = 1, il = arguments.length, src; i < il; i++) {
		src = arguments[i];
		src && Object.keys(src).forEach(function(key) {
			obj[key] = src[key];
		});
	}
	return obj;
}

function createSocket(url, callback) {
	var s = new WebSocket(url);
	s.onclose = function() {
		if (status !== STATUS_CONNECTED && callback) {
			// cannot establish initial connection
			callback();
		}
	};

	s.onopen = function() {
		callback(s);
	};
}

function connect(config, callback) {
	config = extend({}, defaultConfig, config || {});
	status = STATUS_CONNECTING;
	sock = null;

	if (_timer) {
		clearTimeout(_timer);
		_timer = null;
	}

	// create pool of urls we should try before
	// restarting connection sequence
	var urls = (Array.isArray(config.host) ? config.host : [config.host]).map(function(url) {
		return url + config.endpoint;
	});

	var _connect = function() {
		if (!urls.length) {
			return reconnect(config);
		}

		createSocket(urls.shift(), function(s) {
			if (s) {
				// connection established
				sock = s;
				status = STATUS_CONNECTED;
				callback && callback(true, s);
				module.exports.emit('open');

				s.onclose = function() {
					sock = null;
					module.exports.emit('close');
					reconnect(config);
				};

				s.onmessage = handleMessage;
				s.onerror = handleError;
			} else {
				// no connection, try next url
				module.exports.emit('close');
				_connect();
			}
		});
	};
	_connect();
}

function reconnect(config, callback) {
	if (config.timeout && retry) {
		_timer = setTimeout(connect, config.timeout, config, callback);
	} else {
		status = STATUS_IDLE;
	}
}

function handleMessage(evt) {
	var payload = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
	module.exports.emit('message-receive', payload.name, payload.data);
	module.exports.emit(payload.name, payload.data);
}

function handleError(e) {
	module.exports.emit('error', e);
}

module.exports = extend({
	config: function(data) {
		if (typeof data === 'object') {
			extend(defaultConfig, data);
		}
		return defaultConfig;
	},
	
	/**
	 * Establishes connection to server
	 * @param {Object} config Optional connection config
	 * @param {Function} callback A function called with connection status
	 */
	connect: function(config, callback) {
		if (typeof config === 'function') {
			callback = config;
			config = {};
		}

		if (status === STATUS_IDLE) {
			retry = true;
			connect(config, callback);
		} else if (status === STATUS_CONNECTED && callback) {
			callback(true, sock);
		}

		return this;
	},

	/**
	 * Drop connection to server
	 */
	disconnect: function() {
		if (this.connected) {
			retry = false;
			status = STATUS_IDLE;
			sock.close();
		}
		return this;
	},

	/**
	 * Sends given message to socket server
	 * @param  {String} message
	 */
	send: function(name, data) {
		if (this.connected) {
			module.exports.emit('message-send', name, data);
			sock.send(JSON.stringify({
				name: name,
				data: data
			}));
		}
		return this;
	},

	/**
	 * Update status (for debugging and unit-testing)
	 */
	_setStatus: function(value) {
		status = value;
	}
}, eventMixin);

Object.defineProperties(module.exports, {
	connected: {
		enumerable: true,
		get: function() {
			return status === STATUS_CONNECTED;
		}
	},
	status: {
		enumerable: true,
		get: function() {
			return status;
		}
	}
});