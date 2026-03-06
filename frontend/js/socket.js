const SOCKET_URL = "http://localhost:5000";

var socket = null;

var _localEventIds = new Set();

var socketMarkLocal = function () {
  var id = Date.now() + "-" + Math.random().toString(36).slice(2);
  _localEventIds.add(id);
  return id;
};

var _isLocal = function (obj) {
  if (!obj || !obj._eid) return false;
  if (_localEventIds.has(obj._eid)) {
    _localEventIds.delete(obj._eid);
    return true;
  }
  return false;
};

var initSocket = function (projectId, callbacks) {
  callbacks = callbacks || {};
  var token = localStorage.getItem("token");

  socket = io(SOCKET_URL, {
    auth: { token: token },
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.4,
    timeout: 10000,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", function () {
    console.log("[socket] connected:", socket.id);
    socket.emit("joinProject", projectId);
    if (callbacks.onConnect) callbacks.onConnect();
  });

  socket.on("reconnect", function (attempt) {
    console.log("[socket] reconnected after " + attempt + " attempt(s)");
    socket.emit("joinProject", projectId);
    if (callbacks.onReconnect) callbacks.onReconnect();
  });

  socket.on("reconnect_attempt", function (attempt) {
    console.log("[socket] reconnect attempt " + attempt);
    if (callbacks.onReconnecting) callbacks.onReconnecting(attempt);
  });

  socket.on("reconnect_failed", function () {
    console.warn("[socket] all reconnect attempts failed");
    if (callbacks.onReconnectFailed) callbacks.onReconnectFailed();
  });

  socket.on("connect_error", function (err) {
    console.warn("[socket] connect error:", err.message);
  });

  socket.on("disconnect", function (reason) {
    console.log("[socket] disconnected:", reason);
    if (callbacks.onDisconnect) callbacks.onDisconnect(reason);
  });

  socket.on("taskCreated", function (task) {
    if (_isLocal(task)) return;
    if (callbacks.onTaskCreated) callbacks.onTaskCreated(task);
  });

  socket.on("taskUpdated", function (task) {
    if (_isLocal(task)) return;
    if (callbacks.onTaskUpdated) callbacks.onTaskUpdated(task);
  });

  socket.on("taskDeleted", function (data) {
    if (data._eid && _localEventIds.has(data._eid)) {
      _localEventIds.delete(data._eid);
      return;
    }
    if (callbacks.onTaskDeleted) callbacks.onTaskDeleted(data.taskId);
  });

  socket.on("commentAdded", function (comment) {
    if (_isLocal(comment)) return;
    if (callbacks.onCommentAdded) callbacks.onCommentAdded(comment);
  });

  socket.on("commentDeleted", function (data) {
    if (data._eid && _localEventIds.has(data._eid)) {
      _localEventIds.delete(data._eid);
      return;
    }
    if (callbacks.onCommentDeleted) callbacks.onCommentDeleted(data.commentId);
  });

  return socket;
};

var disconnectSocket = function (projectId) {
  if (socket) {
    socket.emit("leaveProject", projectId);
    socket.disconnect();
    socket = null;
  }
};
