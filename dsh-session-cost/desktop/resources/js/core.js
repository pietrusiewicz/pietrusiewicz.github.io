/*
 * Installation logic for the dsh-session-cost desktop installer.
 *
 * Pure JavaScript with all filesystem and resource access injected, so the
 * same code runs inside Neutralino and under Node in the tests.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DshCostInstaller = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MARK_BEGIN = "# >>> dsh-session-cost (managed) >>>";
  var MARK_END = "# <<< dsh-session-cost (managed) <<<";
  var PLUGIN_NAME = "dsh-session-cost";
  var PLUGIN_FILES = [
    ["/resources/plugin/package.json", "package.json"],
    ["/resources/plugin/lib/index.js", "lib/index.js"],
    ["/resources/plugin/lib/client.js", "lib/client.js"]
  ];

  function joinPath(platform, parts) {
    var sep = platform === "Windows" ? "\\" : "/";
    var joined = parts
      .filter(function (part) { return part !== undefined && part !== null && part !== ""; })
      .join(sep);
    joined = joined.replace(/[\\/]+/g, sep);
    return joined;
  }

  function toFileUrl(platform, path) {
    var normalized = String(path).replace(/\\/g, "/");
    if (normalized.charAt(0) !== "/") normalized = "/" + normalized;
    var encoded = normalized.split("/").map(function (segment, index) {
      if (index === 1 && /^[A-Za-z]:$/.test(segment)) return segment;
      return encodeURIComponent(segment);
    }).join("/");
    return "file://" + encoded;
  }

  function stamp(date) {
    var pad = function (value) { return String(value).padStart(2, "0"); };
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      "-" +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }

  function stripManagedBlock(text) {
    var pattern = new RegExp(
      "^" + escapeRegExp(MARK_BEGIN) + "\\r?\\n[\\s\\S]*?^" + escapeRegExp(MARK_END) + "\\r?\\n?",
      "m"
    );
    return text.replace(pattern, "");
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function removeEmptyList(text) {
    return text.replace(/^[ \t]*\[[ \t]*\][ \t]*\r?\n?/m, "");
  }

  function managedBlock(entry) {
    return [
      MARK_BEGIN,
      "- insert:",
      "    - id: session-cost",
      "      name: " + entry,
      MARK_END
    ].join("\n") + "\n";
  }

  function createInstaller(deps) {
    var platform = deps.platform;
    var join = function () { return joinPath(platform, Array.prototype.slice.call(arguments)); };

    async function stat(path) {
      try {
        return await deps.stat(path);
      } catch (error) {
        return null;
      }
    }

    async function exists(path) {
      return (await stat(path)) !== null;
    }

    async function readOptional(path) {
      if (!(await exists(path))) return null;
      return deps.readFile(path);
    }

    async function dshHome() {
      var fromEnv = await deps.env("DSH_HOME");
      if (fromEnv && fromEnv.trim() !== "") return fromEnv.trim();
      return join(await deps.home(), ".dsh");
    }

    function validateProfile(profile) {
      if (!/^[A-Za-z0-9._-]+$/.test(profile)) {
        throw new Error("Profile name may contain only letters, digits, dot, underscore, and dash.");
      }
    }

    async function inspect(profile, homeOverride) {
      validateProfile(profile);
      var home = homeOverride || (await dshHome());
      var profileDir = join(home, "profiles", profile);
      var patch = join(profileDir, "cordis.patch.yml");
      var pluginDir = join(home, "plugins", PLUGIN_NAME);
      var profileInfo = await stat(profileDir);
      var installed = false;
      if (await exists(join(pluginDir, "package.json"))) {
        try {
          var pkg = JSON.parse(await deps.readFile(join(pluginDir, "package.json")));
          installed = pkg.name === PLUGIN_NAME;
        } catch (error) {
          installed = false;
        }
      }
      return {
        dshHome: home,
        profile: profile,
        profileDir: profileDir,
        profileExists: profileInfo !== null && !!profileInfo.isDirectory,
        patch: patch,
        patchExists: await exists(patch),
        pluginDir: pluginDir,
        installed: installed
      };
    }

    async function writePlugin(pluginDir) {
      for (var i = 0; i < PLUGIN_FILES.length; i += 1) {
        var source = PLUGIN_FILES[i][0];
        var relative = PLUGIN_FILES[i][1];
        var target = join(pluginDir, relative);
        var slash = target.lastIndexOf(platform === "Windows" ? "\\" : "/");
        if (slash > 0) await deps.mkdir(target.slice(0, slash));
        await deps.writeFile(target, await deps.readResource(source));
      }
    }

    async function install(profile, homeOverride) {
      var info = await inspect(profile, homeOverride);
      if (!info.profileExists) {
        throw new Error(
          "Profile '" + profile + "' was not found at " + info.profileDir +
          ". Start DSH once with that profile, then try again."
        );
      }

      if (!info.patchExists) {
        await deps.mkdir(info.profileDir);
        await deps.writeFile(info.patch, "[]\n");
      }

      var backup = info.patch + ".bak." + stamp(deps.now ? deps.now() : new Date());
      await deps.writeFile(backup, await deps.readFile(info.patch));

      if (await exists(info.pluginDir)) {
        var pkg = null;
        try {
          pkg = JSON.parse(await deps.readFile(join(info.pluginDir, "package.json")));
        } catch (error) {
          pkg = null;
        }
        if (!pkg || pkg.name !== PLUGIN_NAME) {
          throw new Error("Refusing to replace " + info.pluginDir + ": it is not " + PLUGIN_NAME + ".");
        }
        await deps.remove(info.pluginDir);
      }

      await deps.mkdir(join(info.dshHome, "plugins"));
      await deps.mkdir(info.pluginDir);
      await writePlugin(info.pluginDir);

      var entry = toFileUrl(platform, join(info.pluginDir, "lib", "index.js"));
      var text = stripManagedBlock(await deps.readFile(info.patch));
      text = removeEmptyList(text);
      if (text !== "" && !/\r?\n$/.test(text)) text += "\n";
      text += managedBlock(entry);
      await deps.writeFile(info.patch, text);

      return {
        dshHome: info.dshHome,
        profile: profile,
        pluginDir: info.pluginDir,
        patch: info.patch,
        backup: backup,
        entry: entry
      };
    }

    async function uninstall(profile, homeOverride) {
      var info = await inspect(profile, homeOverride);
      if (!info.patchExists) {
        throw new Error("Patch file not found: " + info.patch);
      }

      var original = await deps.readFile(info.patch);
      var text = stripManagedBlock(original);
      if (text === original) {
        return { removedEntry: false, removedPlugin: false, patch: info.patch };
      }

      var backup = info.patch + ".bak." + stamp(deps.now ? deps.now() : new Date());
      await deps.writeFile(backup, original);

      text = removeEmptyList(text);
      var meaningful = text
        .split(/\r?\n/)
        .map(function (line) { return line.replace(/#.*$/, "").replace(/\s/g, ""); })
        .filter(function (line) { return line !== ""; })
        .join("");
      if (meaningful === "") text = "[]\n";
      else if (!/\r?\n$/.test(text)) text += "\n";
      await deps.writeFile(info.patch, text);

      var removedPlugin = false;
      if (info.installed) {
        await deps.remove(info.pluginDir);
        removedPlugin = true;
      }

      return {
        removedEntry: true,
        removedPlugin: removedPlugin,
        patch: info.patch,
        backup: backup
      };
    }

    return { inspect: inspect, install: install, uninstall: uninstall };
  }

  return {
    createInstaller: createInstaller,
    toFileUrl: toFileUrl,
    joinPath: joinPath,
    MARK_BEGIN: MARK_BEGIN,
    MARK_END: MARK_END,
    PLUGIN_NAME: PLUGIN_NAME
  };
});
