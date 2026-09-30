(function () {
  "use strict";
  var cfg = window.POLL_CONFIG || {};
  var options = cfg.options || [0, 25, 50, 75, 100];
  var summaryEl = document.getElementById("summary");
  var barsEl = document.getElementById("bars");
  var head = document.querySelector("#daily thead");
  var body = document.querySelector("#daily tbody");
  var updatedEl = document.getElementById("updated");
  var timer = null;

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  function render(data) {
    if (!data || !data.ok) {
      summaryEl.textContent = "The results could not be read.";
      return;
    }
    var n = data.n || 0;
    var sum = 0;
    options.forEach(function (o) {
      sum += o * (data.total[String(o)] || 0);
    });
    summaryEl.textContent = n === 0
      ? "No answers yet."
      : n + (n === 1 ? " answer" : " answers") + ", mean estimate " + Math.round(sum / n) + " %";

    barsEl.innerHTML = "";
    options.forEach(function (o) {
      var c = data.total[String(o)] || 0;
      var share = n ? (100 * c) / n : 0;
      var row = el("div", undefined, "bar-row");
      row.appendChild(el("span", o + " %"));
      var track = el("div", undefined, "bar-track");
      var fill = el("div", undefined, "bar-fill");
      fill.style.width = share.toFixed(1) + "%";
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el("span", c + " (" + Math.round(share) + " %)", "small"));
      barsEl.appendChild(row);
    });

    head.innerHTML = "";
    var hr = el("tr");
    hr.appendChild(el("th", "Day"));
    options.forEach(function (o) {
      hr.appendChild(el("th", o + " %"));
    });
    hr.appendChild(el("th", "Total"));
    head.appendChild(hr);

    body.innerHTML = "";
    (data.days || []).forEach(function (d) {
      var tr = el("tr");
      tr.appendChild(el("td", d.day));
      options.forEach(function (o) {
        tr.appendChild(el("td", String(d.counts[String(o)] || 0)));
      });
      tr.appendChild(el("td", String(d.total)));
      body.appendChild(tr);
    });
    if (!data.days || data.days.length === 0) {
      var tr0 = el("tr");
      var td0 = el("td", "No answers yet.");
      td0.colSpan = options.length + 2;
      tr0.appendChild(td0);
      body.appendChild(tr0);
    }
    updatedEl.textContent = "Last read: " + new Date().toLocaleString();
  }

  // JSONP fallback, in case a browser blocks reading the redirected JSON response.
  function loadJsonp() {
    var name = "pollCallback" + Date.now();
    var script = document.createElement("script");
    window[name] = function (data) {
      render(data);
      delete window[name];
      script.parentNode.removeChild(script);
    };
    script.onerror = function () {
      summaryEl.textContent = "The results could not be read. Please try again.";
    };
    script.src = cfg.endpoint + "?poll=" + encodeURIComponent(cfg.pollId) + "&callback=" + name;
    document.body.appendChild(script);
  }

  function load() {
    if (!cfg.endpoint) {
      summaryEl.textContent = "The poll is not connected yet (endpoint missing in config.js).";
      return;
    }
    fetch(cfg.endpoint + "?poll=" + encodeURIComponent(cfg.pollId))
      .then(function (r) {
        return r.json();
      })
      .then(render)
      .catch(loadJsonp);
  }

  document.getElementById("refresh").addEventListener("click", load);
  document.getElementById("auto").addEventListener("change", function (e) {
    if (timer) clearInterval(timer);
    timer = e.target.checked ? setInterval(load, 10000) : null;
  });
  load();
})();
