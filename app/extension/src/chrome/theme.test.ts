import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyThemePreferenceToDocument,
  applyThemePreferenceToIcon,
  effectiveDark,
  initPageTheme,
  readThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
  writeThemePreference,
} from "./theme";

const { chromeMock } = vi.hoisted(() => {
  return {
    chromeMock: {
      action: {
        setIcon: vi.fn(async () => {}),
      },
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => {}),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
      offscreen: {
        Reason: { MATCH_MEDIA: "MATCH_MEDIA" },
        createDocument: vi.fn(async () => {}),
      },
    },
  };
});

vi.mock("../browser", () => ({ browser: chromeMock }));

describe("theme preference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.storage.local.get.mockResolvedValue({});
    chromeMock.storage.local.set.mockResolvedValue(undefined);
  });

  it("maps system/light/dark to the effective dark flag", () => {
    expect(effectiveDark("system", true)).toBe(true);
    expect(effectiveDark("system", false)).toBe(false);
    expect(effectiveDark("light", true)).toBe(false);
    expect(effectiveDark("dark", false)).toBe(true);
  });

  it("defaults to system when nothing is stored", async () => {
    await expect(readThemePreference()).resolves.toBe("system");
  });

  it("falls back to system for an invalid stored value", async () => {
    chromeMock.storage.local.get.mockResolvedValue({ [THEME_PREFERENCE_STORAGE_KEY]: "sepia" });

    await expect(readThemePreference()).resolves.toBe("system");
  });

  it("reads a persisted manual override", async () => {
    chromeMock.storage.local.get.mockResolvedValue({ [THEME_PREFERENCE_STORAGE_KEY]: "dark" });

    await expect(readThemePreference()).resolves.toBe("dark");
  });

  it("writes the preference to local storage", async () => {
    await writeThemePreference("light");

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ [THEME_PREFERENCE_STORAGE_KEY]: "light" });
  });

  it("applies a manual override to the document root", async () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal("document", { documentElement: { dataset } });

    await applyThemePreferenceToDocument("dark");

    expect(dataset.theme).toBe("dark");
    vi.unstubAllGlobals();
  });

  it("removes the data attribute when following the browser", async () => {
    const dataset: Record<string, string> = { theme: "dark" };
    vi.stubGlobal("document", { documentElement: { dataset } });

    await applyThemePreferenceToDocument("system");

    expect("theme" in dataset).toBe(false);
    vi.unstubAllGlobals();
  });

  it("initializes pages from storage and starts listening for changes", async () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal("document", { documentElement: { dataset } });
    chromeMock.storage.local.get.mockResolvedValue({ [THEME_PREFERENCE_STORAGE_KEY]: "light" });

    await initPageTheme();

    expect(dataset.theme).toBe("light");
    expect(chromeMock.storage.onChanged.addListener).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("applies the manual override to the Chrome toolbar icon", async () => {
    chromeMock.storage.local.get.mockResolvedValue({ [THEME_PREFERENCE_STORAGE_KEY]: "dark" });

    await applyThemePreferenceToIcon("dark");

    expect(chromeMock.action.setIcon).toHaveBeenCalledWith({
      path: expect.objectContaining({ 16: "icons/icon-bg16.png", 128: "icons/icon-bg128.png" }),
    });
  });

  it("uses the remembered browser scheme when switching back to system", async () => {
    chromeMock.storage.local.get.mockResolvedValue({ systemDarkTheme: true });

    await applyThemePreferenceToIcon("system");

    expect(chromeMock.action.setIcon).toHaveBeenCalledWith({
      path: expect.objectContaining({ 16: "icons/icon-bg16.png" }),
    });
  });
});
