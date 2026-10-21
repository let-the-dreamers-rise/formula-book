// Formula card: an MCP Apps view. It talks JSON-RPC over postMessage with its host:
// ui/initialize -> ui/notifications/initialized, then renders each ui/notifications/tool-result
// and re-adapts on ui/notifications/host-context-changed. No network, no external files.
(function (global) {
  "use strict";

  var KNOWN_CLASSES = { "echo-show-5": "screen", "echo-show-8": "screen", "echo-show-15": "screen", mobile: "mobile", voice: "voice" };
  var MOBILE_MAX_WIDTH = 480;

  function widthOf(ctx) {
    if (typeof ctx.maxWidth === "number") return ctx.maxWidth;
    var dims = ctx.containerDimensions || {};
    if (typeof dims.maxWidth === "number") return dims.maxWidth;
    if (typeof dims.width === "number") return dims.width;
    return undefined;
  }

  // deviceClass wins when it is one we know; otherwise fall back to width, as the Alexa+ layout guide advises.
  function resolveSurface(ctx) {
    var context = ctx || {};
    var known = KNOWN_CLASSES[context.deviceClass];
    if (known) return known;
    var width = widthOf(context);
    if (context.deviceClass) {
      console.warn('Formula card: unknown deviceClass "' + context.deviceClass + '"; using width ' + width + " instead.");
    }
    if (width === undefined) return "screen";
    return width <= MOBILE_MAX_WIDTH ? "mobile" : "screen";
  }

  function num(value) {
    return String(Math.round(Number(value) * 10) / 10);
  }

  function cardModel(data) {
    if (!data || data.status !== "ok" || !data.formula || !data.totals) return null;
    var formula = data.formula;
    var totals = data.totals;
    return {
      client: String(data.client),
      rows: (formula.components || []).map(function (c) {
        return { shade: String(c.shade), grams: num(c.grams) + " g" };
      }),
      developer: num(totals.developer_grams) + " g",
      developerLine: formula.developer_volume + " vol, 1 to " + num(formula.developer_ratio),
      total: num(totals.total_grams) + " g",
      scale: data.scale_factor !== undefined ? "x" + num(data.scale_factor) : null,
      minutes: formula.processing_minutes ? formula.processing_minutes + " min" : null,
      note: formula.note ? String(formula.note) : null,
      saved: data.saved === true,
      demo: data.demo === true,
    };
  }

  function el(doc, tag, attrs, text) {
    var node = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function renderSkeleton(doc, root) {
    root.appendChild(el(doc, "div", { class: "skel wide" }));
    for (var i = 0; i < 3; i++) root.appendChild(el(doc, "div", { class: "skel" }));
  }

  function renderCard(doc, root, model) {
    var head = el(doc, "div", { class: "head" });
    head.appendChild(el(doc, "h1", { class: "client", "data-testid": "card-client" }, model.client));
    if (model.scale) head.appendChild(el(doc, "span", { class: "chip scale", "data-testid": "card-scale-factor" }, model.scale));
    if (model.saved) head.appendChild(el(doc, "span", { class: "chip saved", "data-testid": "card-saved-tag" }, "Saved"));
    if (model.demo) head.appendChild(el(doc, "span", { class: "chip", "data-testid": "demo-data-chip" }, "Demo data"));
    root.appendChild(head);

    var rows = el(doc, "ul", { class: "rows" });
    model.rows.forEach(function (row, i) {
      var li = el(doc, "li", { class: "row", "data-testid": "card-row-" + i });
      li.appendChild(el(doc, "span", {}, row.shade));
      li.appendChild(el(doc, "span", { class: "readout" }, row.grams));
      rows.appendChild(li);
    });
    var dev = el(doc, "li", { class: "row dev" });
    dev.appendChild(el(doc, "span", {}, "Developer " + model.developerLine));
    dev.appendChild(el(doc, "span", { class: "readout", "data-testid": "card-developer" }, model.developer));
    rows.appendChild(dev);
    root.appendChild(rows);

    var total = el(doc, "div", { class: "total" });
    total.appendChild(el(doc, "span", {}, "Total in the bowl"));
    total.appendChild(el(doc, "span", { class: "readout", "data-testid": "card-total" }, model.total));
    root.appendChild(total);

    var extra = [model.minutes, model.note].filter(Boolean).join(" · ");
    if (extra) root.appendChild(el(doc, "p", { class: "meta" }, extra));
  }

  function start(win) {
    var doc = win.document;
    var root = doc.getElementById("card");
    var host = win.parent;
    var nextId = 1;
    var pending = {};
    var hostContext = {};
    var lastResult = null;

    function post(message) {
      host.postMessage(message, "*"); // srcdoc iframe: the parent's origin is not known here
    }
    function request(method, params) {
      var id = nextId++;
      post({ jsonrpc: "2.0", id: id, method: method, params: params });
      return new Promise(function (resolve) {
        pending[id] = resolve;
      });
    }
    function notify(method, params) {
      post({ jsonrpc: "2.0", method: method, params: params || {} });
    }
    function reply(id, result) {
      post({ jsonrpc: "2.0", id: id, result: result });
    }

    function render() {
      doc.body.setAttribute("data-surface", resolveSurface(hostContext));
      root.textContent = "";
      var model = lastResult ? cardModel(lastResult.structuredContent) : null;
      if (!lastResult) renderSkeleton(doc, root);
      else if (!model) root.appendChild(el(doc, "p", { class: "empty" }, "No formula yet."));
      else {
        root.className = "settle";
        renderCard(doc, root, model);
      }
    }

    if (typeof win.ResizeObserver === "function") {
      new win.ResizeObserver(function () {
        notify("ui/notifications/size-changed", { width: root.offsetWidth, height: doc.documentElement.scrollHeight });
      }).observe(root);
    }

    win.addEventListener("message", function (event) {
      if (event.source !== host) return;
      var message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;
      if (message.method === undefined && message.id !== undefined) {
        var resolve = pending[message.id];
        delete pending[message.id];
        if (resolve) resolve(message.result);
        return;
      }
      switch (message.method) {
        case "ui/notifications/tool-result":
          lastResult = message.params;
          render();
          break;
        case "ui/notifications/host-context-changed":
          hostContext = Object.assign({}, hostContext, message.params);
          render();
          break;
        case "ui/resource-teardown":
        case "ping":
          reply(message.id, {});
          break;
        default:
          if (message.id !== undefined) post({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } });
      }
    });

    render();
    request("ui/initialize", {
      appInfo: { name: "formula-card", version: "0.1.0" },
      appCapabilities: {},
      protocolVersion: "2026-01-26",
    }).then(function (result) {
      hostContext = (result && result.hostContext) || {};
      render();
      notify("ui/notifications/initialized");
    });
  }

  global.FormulaCard = { resolveSurface: resolveSurface, cardModel: cardModel };
  if (global.document && global.parent && global.parent !== global) start(global);
})(this);
