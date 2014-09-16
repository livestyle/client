if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var eventMixin = require('./lib/eventMixin');

	var defaultConfig = {
		host: 'ws://127.0.0.1',
		port: 54000,
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

	function createUrl(opt) {
		var url = opt.host;
		if (opt.port) {
			url += ':' + opt.port;
		}
		return url + opt.endpoint;
	}

	function createSocket(config, callback) {
		config = extend({}, defaultConfig, config || {});
		status = STATUS_CONNECTING;

		if (_timer) {
			clearTimeout(_timer);
			_timer = null;
		}

		var s = new WebSocket(createUrl(config));
		s.onclose = function() {
			sock = null;
			module.emit('disconnect');

			if (status !== STATUS_CONNECTED && callback) {
				// cannot establish initial connection
				callback(false);
			}

			if (config.timeout && retry) {
				_timer = setTimeout(createSocket, config.timeout, config, callback);
			} else {
				status = STATUS_IDLE;
			}
		};

		s.onopen = function() {
			sock = s;
			status = STATUS_CONNECTED;
			callback && callback(true, sock);
			module.emit('connect');
		};

		s.onmessage = handleMessage;
		s.onerror = handleError;
	}

	function handleMessage(evt) {
		var payload = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
		module.emit('message-receive', payload.name, payload.data);
		module.emit(payload.name, payload.data);
	}

	function handleError(e) {
		module.emit('error', e);
	}

	var module = {
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
				createSocket(config, callback);
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
				sock.send(JSON.stringify({
					name: name,
					data: data
				}));
			}
			return this;
		}
	};

	Object.defineProperty(module, 'connected', {
		enumerable: true,
		get: function() {
			return status === STATUS_CONNECTED;
		}
	});

	return extend(module, eventMixin);
});