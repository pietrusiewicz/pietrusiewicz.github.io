/* Desktop installer UI for dsh-session-cost. */
(function () {
  "use strict";

  var REPO_URL = "https://github.com/pietrusiewicz/pietrusiewicz.github.io/tree/main/dsh-session-cost";
  var PLATFORM = typeof NL_OS === "string" ? NL_OS : "Linux";
  var LOCALE = (navigator.language || "en").toLowerCase().indexOf("pl") === 0 ? "pl" : "en";

  var TEXT = {
    en: {
      subtitle: "Install the token-cost badge in your DSH sidebar.",
      home: "DSH home",
      change: "Change",
      profile: "Profile",
      profileHint: "Usually web. Start DSH once with this profile first.",
      profileOk: "profile found",
      profileMissing: "profile missing",
      install: "Install plugin",
      uninstall: "Uninstall",
      installHint: "Copies the plugin to plugins/dsh-session-cost and updates cordis.patch.yml. A backup is kept.",
      restart: "Restart DSH (or wait for the live profile reload), then refresh the browser tab.",
      log: "Activity",
      ready: "Ready",
      done: "Installed. Restart DSH and refresh the browser tab.",
      removed: "Removed. Restart DSH and refresh the browser tab.",
      notInstalled: "Nothing to uninstall in this profile.",
      confirmTitle: "Uninstall dsh-session-cost?",
      confirmBody: "The managed entry and the installed plugin directory will be removed. A backup of cordis.patch.yml is kept.",
      chooseHome: "Choose the DSH home directory",
      openGithub: "GitHub",
      failed: "Failed",
      working: "Working...",
      unsupported: "Unsupported platform"
    },
    pl: {
      subtitle: "Zainstaluj licznik kosztów tokenów w pasku sesji DSH.",
      home: "Katalog DSH",
      change: "Zmień",
      profile: "Profil",
      profileHint: "Zwykle web. Najpierw uruchom DSH raz z tym profilem.",
      profileOk: "profil znaleziony",
      profileMissing: "brak profilu",
      install: "Zainstaluj plugin",
      uninstall: "Odinstaluj",
      installHint: "Kopiuje plugin do plugins/dsh-session-cost i aktualizuje cordis.patch.yml. Kopia zapasowa zostaje.",
      restart: "Uruchom DSH ponownie (albo poczekaj na przeładowanie profilu) i odśwież kartę przeglądarki.",
      log: "Działanie",
      ready: "Gotowe",
      done: "Zainstalowano. Uruchom DSH ponownie i odśwież kartę.",
      removed: "Usunięto. Uruchom DSH ponownie i odśwież kartę.",
      notInstalled: "W tym profilu nie ma czego odinstalowywać.",
      confirmTitle: "Odinstalować dsh-session-cost?",
      confirmBody: "Wpis pluginu i katalog pluginu zostaną usunięte. Kopia cordis.patch.yml zostanie zachowana.",
      chooseHome: "Wybierz katalog DSH",
      openGithub: "GitHub",
      failed: "Błąd",
      working: "Pracuję...",
      unsupported: "Nieobsługiwany system"
    }
  };

  var t = function (key) { return TEXT[LOCALE][key] || TEXT.en[key] || key; };

  function $(id) { return document.getElementById(id); }

  function log(line) {
    var box = $("log");
    box.textContent += (box.textContent ? "\n" : "") + line;
    box.scrollTop = box.scrollHeight;
  }

  function setStatus(text, kind) {
    var el = $("status");
    el.textContent = text;
    el.className = "pill" + (kind ? " " + kind : "");
  }

  function setBusy(busy) {
    $("install").disabled = busy;
    $("uninstall").disabled = busy;
    $("changeHome").disabled = busy;
    if (busy) setStatus(t("working"), "busy");
  }

  var homeOverride = "";
  var installer = null;

  function adapter() {
    return {
      platform: PLATFORM,
      stat: function (path) {
        return Neutralino.filesystem.getStats(path).then(function (stats) {
          return { isDirectory: !!stats.isDirectory, isFile: !!stats.isFile };
        });
      },
      readFile: function (path) { return Neutralino.filesystem.readFile(path); },
      writeFile: function (path, data) { return Neutralino.filesystem.writeFile(path, data); },
      mkdir: function (path) { return Neutralino.filesystem.createDirectory(path); },
      remove: function (path) { return Neutralino.filesystem.remove(path); },
      env: async function (name) {
        try { return await Neutralino.os.getEnv(name); } catch (error) { return ""; }
      },
      home: function () { return Neutralino.os.getPath("home"); },
      readResource: function (path) { return Neutralino.resources.readFile(path); }
    };
  }

  function applyText() {
    document.documentElement.lang = LOCALE;
    var nodes = document.querySelectorAll("[data-t]");
    for (var i = 0; i < nodes.length; i += 1) nodes[i].textContent = t(nodes[i].getAttribute("data-t"));
    $("profile").placeholder = "web";
    $("platform").textContent = PLATFORM === "Darwin" ? "macOS" : PLATFORM;
    $("lang").textContent = LOCALE === "pl" ? "EN" : "PL";
  }

  async function refresh() {
    var profile = $("profile").value.trim() || "web";
    try {
      var info = await installer.inspect(profile, homeOverride);
      $("homePath").textContent = info.dshHome;
      $("homePath").title = info.dshHome;
      $("profileState").textContent = info.profileExists ? t("profileOk") : t("profileMissing");
      $("profileState").className = "state " + (info.profileExists ? "ok" : "bad");
      setStatus(info.installed ? "installed" : t("ready"), info.installed ? "ok" : "");
      return info;
    } catch (error) {
      $("profileState").textContent = "";
      setStatus(t("failed"), "bad");
      log("! " + error.message);
      return null;
    }
  }

  async function install() {
    var profile = $("profile").value.trim() || "web";
    setBusy(true);
    log("> install " + profile);
    try {
      var result = await installer.install(profile, homeOverride);
      log("  plugin: " + result.pluginDir);
      log("  patch:  " + result.patch);
      log("  backup: " + result.backup);
      log(t("restart"));
      await refresh();
      setStatus(t("done"), "ok");
    } catch (error) {
      log("! " + error.message);
      await refresh();
      setStatus(t("failed"), "bad");
    } finally {
      $("install").disabled = false;
      $("uninstall").disabled = false;
      $("changeHome").disabled = false;
    }
  }

  async function uninstall() {
    var profile = $("profile").value.trim() || "web";
    var choice = await Neutralino.os.showMessageBox(t("confirmTitle"), t("confirmBody"), "YES_NO", "QUESTION");
    if (choice !== "YES") return;
    setBusy(true);
    log("> uninstall " + profile);
    try {
      var result = await installer.uninstall(profile, homeOverride);
      if (!result.removedEntry) {
        log("  " + t("notInstalled"));
        setStatus(t("notInstalled"), "");
      } else {
        log("  patch:  " + result.patch);
        log("  backup: " + result.backup);
        log(t("restart"));
        await refresh();
        setStatus(t("removed"), "ok");
      }
    } catch (error) {
      log("! " + error.message);
      await refresh();
      setStatus(t("failed"), "bad");
    } finally {
      $("install").disabled = false;
      $("uninstall").disabled = false;
      $("changeHome").disabled = false;
    }
  }

  async function changeHome() {
    var picked = await Neutralino.os.showFolderDialog(t("chooseHome"));
    if (picked) {
      homeOverride = picked;
      await refresh();
    }
  }

  async function boot() {
    if (PLATFORM !== "Windows" && PLATFORM !== "Linux" && PLATFORM !== "Darwin") {
      setStatus(t("unsupported"), "bad");
      return;
    }
    installer = DshCostInstaller.createInstaller(adapter());
    applyText();
    $("install").addEventListener("click", install);
    $("uninstall").addEventListener("click", uninstall);
    $("changeHome").addEventListener("click", changeHome);
    $("profile").addEventListener("input", refresh);
    $("github").addEventListener("click", function () { Neutralino.os.open(REPO_URL); });
    $("lang").addEventListener("click", function () {
      LOCALE = LOCALE === "pl" ? "en" : "pl";
      applyText();
      refresh();
    });
    await refresh();
  }

  Neutralino.init();
  window.addEventListener("DOMContentLoaded", boot);
})();
