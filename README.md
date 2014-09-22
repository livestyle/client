# LiveStyle client

A generic Websocket client connector to LiveStyle patching server. It establishes connection to server, listens to incoming events and sends data back to server if required. Provides abstraction layer above connection API.

This connector is designed to work in modern browser environment and can be used as a component for LiveStyle brower plugins.

## API

LiveStyle client establishes connection to patching server, listens to incoming messages and dispatches them as events to all subscribers:

```js
var client = require('livestyle-client');
client.connect()
    .on('message_name', function(payload) {
       ... 
    });
```

Client provides the following API:

* `connect(config, callback)` – creates connection to LiveStyle server. If server is not available yet, tries to reconnect after some timeout. If client was already connected, the `connect()` method will re-use existing connection. If `callback` is provided, invokes it with single argument indicating successfull connection (`true`/`false`). Optional `config` object may be passed with the following options:
    * `host` – server host, default is `ws://127.0.0.1`
    * `port` — server port, default is `54000`
    * `timeout` — reconnect retry timeout (in milliseconds) if server is not available. Set `0` to disable automatic reconnect. Default is `2000`.
* `disconnect()` — drops connection.
* `connected` — a read-only property indicating whether client is connected to server.
* `on(name, callback)` — adds `name` event listener.
* `off(name, callback)` — removes given event listener from `name` event.
* `send(name, data)` — sends `name` event with optional `data` payload to server. `data` must be any JSON-serializable object.

## Client types

Although it’s possible to write any client connector consumer, we can separate them in two groups:

* **listener** — a simple connector that listens to incoming events and updates stylesheets. Most likely it will be a common browser connector that updates CSSOM with incoming patch.
* **patcher** — a client that contains LiveStyle core and able to calculate diffs and patch text sources.

A LiveStyle server is simply a Websocket server that passes events between clients with one exception: it can identify **patcher** and send some events *to this client only*. For example, there might be 10 patchers connected, but only two of them support LESS syntax. The server will pick only one patcher that supports given syntax and will send all diff and patch request directly to this client.

## Events reference

It is not required that client consumer should handle all listed events. Below is a list of available events:

* `client-connect` — client connected to server.
* `client-disconnect` — client disconnected from server.
* `editor-connect` — editor identification, dispatched every time a new LiveStyle-supported editor is connected to server. The payload is object with the following keys:
    * `id` — editor identifier
    * `title` — editors’ human-readable name
    * `icon` — editor icon, encoded in data:URL
* `editor-disconnect` — dispatched when editor is disconnected from server. The payload contains:
    * `id`: — id of disconnected editor (string)
* `editor-files` — list of opened files in editor is updates. Payload is an object with the following keys:
    * `id` — id of editor.
    * `files` — array of unique files opened in editor.

    > Note: for untitled files (e.g. newly created, but not saved) it is recommended to use `<untitled:SOME_ID>` naming scheme (all file names must be unique) although it’s not strictly required.
* `initial-content` — sets the initial (pristine) content for given file. The next `calculate-diff` request should calculate diff against this state. Initial content is pre-compiled for faster diffs. Event payload is an object with the following keys:
    * `uri` — files’ URI; could be absolute path, file id (for untitled files) or anything else that can uniquely identify file in editor.
    * `syntax` — files’ syntax.
    * `hash` — short file checksum (for example, a CRC32 of file content). If provided, this value will be used in caching for faster diffs.
    * `content` — files’ content.
* `calculate-diff` — a request for diff calculation. Diff is calculated against initial file content, provided in `initial-content` event or against `previous` key of payload, if provided. Payload:
    * `uri` — files’ URI.
    * `syntax` — files’ syntax.
    * `hash` — short file checksum (for example, a CRC32 of file content). If provided, this value will be used in caching for faster diffs.
    * `content` — files’ content.
    * `previous` — previous state of files’ content. If provided, the diff will be calculated against this value.
    
    > Note that if diff was successfull, the initial state of file will be replaced with current `content` so there’s no need to keep track of previous file state in editor.
* `diff` — a result of diff calculation. Payload:
    * `uri` — files’ URI.
    * `syntax` — files’ syntax.
    * `patches` — array of calculated patches.
* `apply-patch` — a request for applying a patch on given source. Payload:
    * `uri` — files’ URI.
    * `syntax` — files’ syntax.
    * `hash` — files’ checksum. If provided, it will be passed back in `patch` event to check if it’s possible to apply incremental update.
    * `content` — files’ content.
    * `patches` — array of patches to apply to files’ content.
* `patch` — a result of applied patch to files’ content. Payload:
    * `uri` — files’ URI.
    * `content` — files’ updated content.
    * `ranges` — array of `[start, end, 'updated_content']` arrays with modified ranges of original source. Applying these updates one-by-one on original source will result in same value as in `content`.
    * `hash` — file checksum, passed in `apply-patch` event. You can use this value to check if original content was changes since last `apply-patch` request and if it’s safe to use `ranges` for incremental updates.
* `error` — dispatched when error occurs.