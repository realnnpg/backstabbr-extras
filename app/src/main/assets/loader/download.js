(function () {
  "use strict";

  if (window.__bseDownloadHook) return;
  window.__bseDownloadHook = true;
  if (!window.BSEAndroidDownload) return;

  var map = {};
  var origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    var u = origCreate(obj);
    try { if (obj instanceof Blob) map[u] = obj; } catch (e) {}
    return u;
  };
  var origRevoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (u) {
    setTimeout(function () { delete map[u]; }, 3000);
    return origRevoke(u);
  };

  function send(blob, name) {
    var fr = new FileReader();
    fr.onload = function () {
      try { BSEAndroidDownload.save(String(fr.result), name, blob.type || ""); } catch (e) {}
    };
    fr.onerror = function () { try { BSEAndroidDownload.error(name); } catch (e) {} };
    fr.readAsDataURL(blob);
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[download]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var name = a.getAttribute("download") || "download";
    if (href.indexOf("blob:") === 0) {
      e.preventDefault(); e.stopPropagation();
      var blob = map[href];
      if (blob) send(blob, name);
      else fetch(href).then(function (r) { return r.blob(); }).then(function (b) { send(b, name); })
        .catch(function () { try { BSEAndroidDownload.error(name); } catch (e) {} });
    } else if (href.indexOf("data:") === 0) {
      e.preventDefault(); e.stopPropagation();
      try { BSEAndroidDownload.save(href, name, ""); } catch (e) {}
    }
  }, true);
})();
