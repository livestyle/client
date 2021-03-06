global.WebSocket = require('./shim/websocket');
var assert = require('assert');
var client = require('../');

describe('LiveStyle client connector', function() {
	beforeEach(function() {
		WebSocket.online = true;
		WebSocket.expectUrl = null;
		WebSocket.emitter.removeAllListeners();
		// turn off all client event listeners before each test
		client.disconnect().off();
	});

	it('connect', function(done) {
		client.connect().on('open', function() {
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
			.on('open', function() {
				connected = true;
				setTimeout(function() {
					client.disconnect();
				}, 4);
			})
			.on('close', function() {
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
			.on('close', function() {
				reconnectCount++;
			})
			.on('open', function() {
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
			.on('close', function() {
				diconnectCount++;
			})
			.on('open', function() {
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
			.on('open', function() {
				client.send('test', {foo: 'bar'})
			});
	});

	it('concurrency', function(done) {
		// should create only one socket 
		// connection for multiple `connect()` calls
		var socketsCreated = 0;
		var clients = 0;
		WebSocket.emitter.on('create', function() {
			socketsCreated++;
		});

		client.connect({timeout: 10})
			.on('open', function() {
				clients++;
			});

		setTimeout(function() {
			client.connect();
		}, 40);

		setTimeout(function() {
			assert.equal(socketsCreated, 1);
			assert.equal(clients, 1);
			done();
		}, 60);
	});

	it('multiple urls', function(done) {
		WebSocket.expectUrl = 'baz/livestyle';
		var closed = 0;
		
		client.connect({host: ['foo', 'bar', 'baz']})
			.on('close', function() {
				closed++;
			})
			.on('open', function() {
				assert.equal(closed, 2);
				done();
			});
	});
});