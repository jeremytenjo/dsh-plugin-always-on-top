#!/usr/bin/env python3
"""Link this checkout into the DSH Desktop profile.

The Desktop profile lives at ~/.dsh/profiles/desktop and installs plugins as
local link dependencies. This script adds one link dependency, appends the
bundle name to dsh.profile.bundles, and creates the node_modules symlink. It
keeps a backup of package.json before the first edit.

Usage:
    python3 scripts/install-local.py
    python3 scripts/install-local.py --uninstall

Set DSH_DESKTOP_PROFILE to target another profile directory.
"""

import argparse
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN_DIR = os.path.dirname(HERE)
PROFILE_DIR = os.environ.get("DSH_DESKTOP_PROFILE") or os.path.expanduser("~/.dsh/profiles/desktop")
PACKAGE = os.path.join(PROFILE_DIR, "package.json")
BACKUP = PACKAGE + ".bak-always-on-top"
LINK_NAME = "dsh-plugin-always-on-top"


def load(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save(path, data):
    temp = path + ".tmp-always-on-top"
    with open(temp, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")
    os.replace(temp, path)


def install():
    if not os.path.isdir(PROFILE_DIR):
        raise SystemExit(f"Profile not found: {PROFILE_DIR}")
    if not os.path.isfile(os.path.join(PLUGIN_DIR, "package.json")):
        raise SystemExit(f"Not a plugin checkout: {PLUGIN_DIR}")

    data = load(PACKAGE)
    if not os.path.exists(BACKUP):
        shutil.copy2(PACKAGE, BACKUP)

    dependencies = data.setdefault("dependencies", {})
    dependencies[LINK_NAME] = "link:" + PLUGIN_DIR
    bundles = data.setdefault("dsh", {}).setdefault("profile", {}).setdefault("bundles", [])
    if LINK_NAME not in bundles:
        bundles.append(LINK_NAME)
    save(PACKAGE, data)

    link = os.path.join(PROFILE_DIR, "node_modules", LINK_NAME)
    if os.path.islink(link) or os.path.exists(link):
        os.unlink(link)
    os.symlink(PLUGIN_DIR, link)

    print(f"installed {LINK_NAME}")
    print(f"profile   {PROFILE_DIR}")
    print(f"link      {link}")
    print(f"backup    {BACKUP}")
    print("Quit DeepSeek Harness completely (tray → Quit), then reopen it.")


def uninstall():
    if not os.path.isfile(PACKAGE):
        raise SystemExit(f"Profile not found: {PROFILE_DIR}")
    data = load(PACKAGE)
    data.get("dependencies", {}).pop(LINK_NAME, None)
    profile = data.get("dsh", {}).get("profile", {})
    bundles = profile.get("bundles", [])
    profile["bundles"] = [name for name in bundles if name != LINK_NAME]
    save(PACKAGE, data)
    link = os.path.join(PROFILE_DIR, "node_modules", LINK_NAME)
    if os.path.islink(link) or os.path.exists(link):
        os.unlink(link)
    print(f"removed {LINK_NAME}")
    print("Quit DeepSeek Harness completely, then reopen it.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uninstall", action="store_true", help="remove the link and profile entries")
    args = parser.parse_args()
    if args.uninstall:
        uninstall()
    else:
        install()
    return 0


if __name__ == "__main__":
    sys.exit(main())
