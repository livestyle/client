global.WebSocket = require('./shim/websocket');
var assert = require('assert');
var client = require('../');

describe('LiveStyle client connector', function() {
	beforeEach(function() {
		WebSocket.online = true;
		// turn off all client event listeners before each test
		client.off();
	});

	it('connect', function(done) {
		client.connect().on('connect', function() {
			assert(client.connected);
			done();
		});
	});

	it('disconnect', function(done) {
		var closed = false;
		WebSocket.emitter.on('close', function() {
			closed = true;
		});

		var connected = false;
		client.connect()
			.on('connect', function() {
				connected = true;
				setTimeout(function() {
					client.disconnect();
				}, 4);
			})
			.on('disconnect', function() {
				connected = false;
			});

		setTimeout(function() {
			assert(closed);
			assert(!connected);
			done();
		}, 20);
	});

	it('reconnect until online', function(done) {
		WebSocket.online = false;
		var reconnectCount = 0;
		client.connect({timeout: 10})
			.on('disconnect', function() {
				reconnectCount++;
			})
			.on('connect', function() {
				assert(reconnectCount > 3);
				done();
			});

		setTimeout(function() {
			WebSocket.online = true;
		}, 50);
	});

	it('drop connection & reconnect', function(done) {
		var diconnectCount = 0;
		var connectCount = 0;
		var sock = null;
		WebSocket.emitter.on('create', function(socket) {
			sock = socket;
		});

		client.connect({timeout: 10})
			.on('disconnect', function() {
				diconnectCount++;
			})
			.on('connect', function() {
				connectCount++;
			});

		setTimeout(function() {
			// drop connection
			WebSocket.online = false;
			sock.close();
			setTimeout(function() {
				// restore connection
				WebSocket.online = true;
				setTimeout(function() {
					// wait until client is connected
					assert(diconnectCount > 3);
					assert.equal(connectCount, 2);
					done();
				}, 50);
			}, 50);
		}, 10);
	});

	it('receive events', function(done) {
		WebSocket.emitter.on('create', function(sock) {
			setTimeout(function() {
				sock.onmessage({data: {
					name: 'test',
					data: {
						a: 1,
						foo: 'bar'
					}
				}})
			}, 10);
		});

		client.connect()
			.on('test', function(data) {
				assert.deepEqual(data, {a: 1, foo: 'bar'});
				done();
			});
	});

	it('send messages', function(done) {
		WebSocket.emitter.on('send', function(message) {
			message = JSON.parse(message);
			assert.deepEqual(message, {name: 'test', data: {foo: 'bar'}});
			done();
		});

		client.connect()
			.on('connect', function() {
				client.send('test', {foo: 'bar'})
			});
	});
});