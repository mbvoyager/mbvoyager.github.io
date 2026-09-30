(function () {
  "use strict";
  var cfg = window.POLL_CONFIG || {};
  var storageKey = "poll-answer-" + cfg.pollId;
  var statusEl = document.getElementById("status");
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".option"));

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function lock(chosen) {
    buttons.forEach(function (b) {
      b.disabled = true;
      b.setAttribute("aria-pressed", String(chosen !== null && b.getAttribute("data-value") === String(chosen)));
    });
  }

  function unlock() {
    buttons.forEach(function (b) {
      b.disabled = false;
      b.setAttribute("aria-pressed", "false");
    });
  }

  var previous = null;
  try {
    previous = window.localStorage.getItem(storageKey);
  } catch (e) {
    previous = null;
  }

  if (previous !== null) {
    lock(previous);
    setStatus("Thank you. Your answer (" + previous + " %) has already been recorded on this device.", "ok");
    return;
  }

  if (!cfg.endpoint) {
    lock(null);
    setStatus("The poll is not connected yet.", "error");
    return;
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      var value = button.getAttribute("data-value");
      lock(value);
      setStatus("Sending…", "");
      // text/plain keeps this a "simple" request (no CORS preflight); the response is
      // opaque in no-cors mode, a network failure still rejects the promise.
      fetch(cfg.endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ poll: cfg.pollId, answer: value })
      })
        .then(function () {
          try {
            window.localStorage.setItem(storageKey, value);
          } catch (e) {
            /* private mode: answer is still recorded */
          }
          setStatus("Thank you. Your answer has been recorded anonymously.", "ok");
        })
        .catch(function () {
          unlock();
          setStatus("Sending failed. Please check your connection and try again.", "error");
        });
    });
  });
})();
