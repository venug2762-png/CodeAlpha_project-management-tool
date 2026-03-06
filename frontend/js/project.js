var user = JSON.parse(localStorage.getItem("user") || "null");
if (!user) window.location.href = "login.html";
var projectId = new URLSearchParams(window.location.search).get("id");
if (!projectId) window.location.href = "dashboard.html";
document.getElementById("userName").textContent = user.name;
document.getElementById("userAvatar").textContent = user.name[0].toUpperCase();
document.getElementById("logoutBtn").addEventListener("click", function() {
  localStorage.clear();
  window.location.href = "login.html";
});

var tasksMap = new Map();
var currentTask = null;
var addTaskStatus = "todo";

function isOverdue(d) { return new Date(d) < new Date(); }
function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function escHtml(str) {
  return (str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function timeAgo(date) {
  var diff = Date.now() - new Date(date).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

function buildTaskCard(task) {
  var div = document.createElement("div");
  div.className = "task-card";
  div.dataset.taskId = task._id;
  div.innerHTML =
    "<h4>" + escHtml(task.title) + "</h4>" +
    (task.description ? "<p>" + escHtml(task.description) + "</p>" : "") +
    "<div class=\"task-meta\">" +
    "<span class=\"priority-badge " + task.priority + "\">" + task.priority + "</span>" +
    (task.dueDate ? "<span class=\"task-due " + (isOverdue(task.dueDate) ? "overdue" : "") + "\">" + formatDate(task.dueDate) + "</span>" : "") +
    "</div>";
  div.addEventListener("click", function() { openTaskDetail(task._id); });
  return div;
}

function getColEl(s) { return document.getElementById("col-" + s); }
function getCountEl(s) { return document.getElementById("count-" + s); }

function syncCount(status) {
  var n = 0;
  tasksMap.forEach(function(t) { if (t.status === status) n++; });
  getCountEl(status).textContent = n;
}

function renderCol(status) {
  var col = getColEl(status);
  var frag = document.createDocumentFragment();
  tasksMap.forEach(function(t) {
    if (t.status === status) frag.appendChild(buildTaskCard(t));
  });
  col.innerHTML = "";
  col.appendChild(frag);
  syncCount(status);
}

function renderBoard() {
  renderCol("todo");
  renderCol("inprogress");
  renderCol("done");
}

function insertTaskCard(task) {
  getColEl(task.status).prepend(buildTaskCard(task));
  syncCount(task.status);
}

function updateTaskCard(task) {
  var existing = document.querySelector("[data-task-id=\"" + task._id + "\"]");
  var newCard = buildTaskCard(task);
  if (existing) {
    var oldColEl = existing.parentElement;
    existing.replaceWith(newCard);
    var oldStatus = oldColEl && oldColEl.id ? oldColEl.id.replace("col-", "") : "";
    if (oldStatus && oldStatus !== task.status) {
      newCard.remove();
      getColEl(task.status).prepend(newCard);
      syncCount(oldStatus);
      syncCount(task.status);
    }
  } else {
    insertTaskCard(task);
  }
}

function removeTaskCard(taskId) {
  var card = document.querySelector("[data-task-id=\"" + taskId + "\"]");
  if (!card) return;
  var status = card.parentElement && card.parentElement.id ? card.parentElement.id.replace("col-", "") : "";
  card.remove();
  if (status) syncCount(status);
}

function loadBoard() {
  Promise.all([api.getProject(projectId), api.getTasks(projectId)]).then(function(results) {
    document.getElementById("projectTitle").textContent = results[0].title;
    document.getElementById("projectDesc").textContent = results[0].description || "";
    tasksMap = new Map(results[1].map(function(t) { return [t._id, t]; }));
    renderBoard();
  }).catch(function(err) { showToast(err.message, "error"); });
}

function openAddTask(status) {
  addTaskStatus = status;
  document.getElementById("taskForm").reset();
  document.getElementById("addTaskModal").classList.add("active");
}

function openTaskDetail(taskId) {
  currentTask = tasksMap.get(taskId);
  if (!currentTask) return;
  document.getElementById("detailTitle").textContent = currentTask.title;
  document.getElementById("detailDesc").textContent = currentTask.description || "No description";
  document.getElementById("detailPriority").textContent = currentTask.priority;
  document.getElementById("detailStatus").textContent = currentTask.status;
  document.getElementById("detailDue").textContent = currentTask.dueDate ? formatDate(currentTask.dueDate) : "No due date";
  document.getElementById("taskDetailModal").classList.add("active");
  loadComments(taskId);
}

function loadComments(taskId) {
  var container = document.getElementById("commentsList");
  container.innerHTML = "<p style=\"font-size:13px;color:#94a3b8\">Loading...</p>";
  api.getComments(projectId, taskId).then(function(comments) {
    renderComments(comments);
  }).catch(function() {
    container.innerHTML = "<p style=\"font-size:13px;color:#94a3b8\">Could not load comments</p>";
  });
}

function buildCommentHTML(c, timeStr) {
  return "<div class=\"comment\" id=\"comment-" + c._id + "\">" +
    "<div class=\"comment-avatar\">" + c.author.name[0].toUpperCase() + "</div>" +
    "<div class=\"comment-body\">" +
    "<span class=\"comment-author\">" + escHtml(c.author.name) + "</span>" +
    "<span class=\"comment-time\">" + (timeStr || timeAgo(c.createdAt)) + "</span>" +
    "<p class=\"comment-text\">" + escHtml(c.text) + "</p>" +
    "</div></div>";
}

function renderComments(comments) {
  var container = document.getElementById("commentsList");
  if (comments.length === 0) {
    container.innerHTML = "<p style=\"font-size:13px;color:#94a3b8\">No comments yet</p>";
    return;
  }
  container.innerHTML = comments.map(function(c) { return buildCommentHTML(c); }).join("");
}

function showToast(msg, type) {
  type = type || "";
  var toast = document.getElementById("toast");
  if (toast._hideTimeout) clearTimeout(toast._hideTimeout);
  toast.textContent = msg;
  toast.className = "toast " + type + " show";
  toast._hideTimeout = setTimeout(function() { toast.classList.remove("show"); }, 3000);
}

document.getElementById("backBtn").addEventListener("click", function() { window.location.href = "dashboard.html"; });
document.getElementById("addTodo").addEventListener("click", function() { openAddTask("todo"); });
document.getElementById("addInprogress").addEventListener("click", function() { openAddTask("inprogress"); });
document.getElementById("addDone").addEventListener("click", function() { openAddTask("done"); });
document.getElementById("cancelAddTask").addEventListener("click", function() { document.getElementById("addTaskModal").classList.remove("active"); });
document.getElementById("closeAddTask").addEventListener("click", function() { document.getElementById("addTaskModal").classList.remove("active"); });

document.getElementById("taskForm").addEventListener("submit", function(e) {
  e.preventDefault();
  var body = {
    title: document.getElementById("taskTitle").value.trim(),
    description: document.getElementById("taskDesc").value.trim(),
    priority: document.getElementById("taskPriority").value,
    dueDate: document.getElementById("taskDue").value || null,
    status: addTaskStatus
  };
  api.createTask(projectId, body).then(function(task) {
    tasksMap.set(task._id, task);
    insertTaskCard(task);
    document.getElementById("addTaskModal").classList.remove("active");
    showToast("Task created!", "success");
  }).catch(function(err) { showToast(err.message, "error"); });
});

document.getElementById("closeDetail").addEventListener("click", function() {
  document.getElementById("taskDetailModal").classList.remove("active");
  currentTask = null;
});

document.getElementById("deleteTaskBtn").addEventListener("click", function() {
  if (!currentTask || !confirm("Delete this task?")) return;
  var taskId = currentTask._id;
  api.deleteTask(projectId, taskId).then(function() {
    tasksMap.delete(taskId);
    removeTaskCard(taskId);
    document.getElementById("taskDetailModal").classList.remove("active");
    showToast("Task deleted", "success");
    currentTask = null;
  }).catch(function(err) { showToast(err.message, "error"); });
});

document.getElementById("moveTaskBtn").addEventListener("click", function() {
  if (!currentTask) return;
  var order = ["todo", "inprogress", "done"];
  var next = order[(order.indexOf(currentTask.status) + 1) % order.length];
  api.updateTask(projectId, currentTask._id, { status: next }).then(function(updated) {
    tasksMap.set(updated._id, updated);
    updateTaskCard(updated);
    currentTask = updated;
    document.getElementById("detailStatus").textContent = updated.status;
    showToast("Moved to " + next + "!", "success");
  }).catch(function(err) { showToast(err.message, "error"); });
});

document.getElementById("addCommentBtn").addEventListener("click", function() {
  var input = document.getElementById("commentInput");
  var text = input.value.trim();
  if (!text || !currentTask) return;
  api.addComment(projectId, currentTask._id, { text: text }).then(function(comment) {
    input.value = "";
    var container = document.getElementById("commentsList");
    if (container.querySelector("p")) container.innerHTML = "";
    container.insertAdjacentHTML("beforeend", buildCommentHTML(comment, "just now"));
  }).catch(function(err) { showToast(err.message, "error"); });
});

document.getElementById("commentInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    document.getElementById("addCommentBtn").click();
  }
});

initSocket(projectId, {
  onConnect: function() { document.getElementById("liveIndicator").style.display = "flex"; },
  onDisconnect: function() { document.getElementById("liveIndicator").style.display = "none"; },
  onReconnect: function() { document.getElementById("liveIndicator").style.display = "flex"; loadBoard(); },
  onTaskCreated: function(task) {
    if (tasksMap.has(task._id)) return;
    tasksMap.set(task._id, task);
    insertTaskCard(task);
  },
  onTaskUpdated: function(task) {
    tasksMap.set(task._id, task);
    updateTaskCard(task);
    if (currentTask && currentTask._id === task._id) {
      currentTask = task;
      document.getElementById("detailStatus").textContent = task.status;
      document.getElementById("detailPriority").textContent = task.priority;
      document.getElementById("detailDue").textContent = task.dueDate ? formatDate(task.dueDate) : "No due date";
    }
  },
  onTaskDeleted: function(taskId) {
    tasksMap.delete(taskId);
    removeTaskCard(taskId);
    if (currentTask && currentTask._id === taskId) {
      document.getElementById("taskDetailModal").classList.remove("active");
      currentTask = null;
      showToast("Task deleted by collaborator");
    }
  },
  onCommentAdded: function(comment) {
    if (currentTask && comment.task === currentTask._id) {
      var container = document.getElementById("commentsList");
      if (container.querySelector("p")) container.innerHTML = "";
      container.insertAdjacentHTML("beforeend", buildCommentHTML(comment, "just now"));
    }
  },
  onCommentDeleted: function(commentId) {
    var el = document.getElementById("comment-" + commentId);
    if (el) el.remove();
  }
});

loadBoard();