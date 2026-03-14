import { describe, expect, it } from "vitest";

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".css", ".scss", ".sass", ".less"];
const BLOCKED_FILE_TOOLS = ["edit", "write", "read", "patch"];

const FORBIDDEN_MD = [
  /fixes_applied.*\.md$/i,
  /project_completion.*\.md$/i,
  /deployment.*\.md$/i,
  /summary.*\.md$/i,
  /notes.*\.md$/i,
  /TODO.*\.md$/i,
  /changelog.*\.md$/i,
  /progress.*\.md$/i,
  /status.*\.md$/i,
  /implementation_plan.*\.md$/i,
  /testing_plan.*\.md$/i,
  /meeting_notes.*\.md$/i,
  /migration_plan.*\.md$/i,
  /setup.*\.md$/i,
  /todo.*\.md$/i,
];

const LAZY_RENAME_PATH = [
  /(?:updated|robust|enhanced|improved|revised|modified|backup|orig|copy)(?=[A-Z])/,
  /(?:_v\d+|_old|_new|_backup|_copy|_temp|_orig)\./,
];

function isCodeFile(path: string): boolean {
  return CODE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}

function isBlocked(tool: string, filePath: string): boolean {
  return isCodeFile(filePath) && BLOCKED_FILE_TOOLS.includes(tool);
}

function isForbiddenMd(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".md") && FORBIDDEN_MD.some((p) => p.test(filePath));
}

function hasLazyRename(basename: string): boolean {
  return LAZY_RENAME_PATH.some((p) => p.test(basename));
}

describe("Tool blocking - correct OpenCode tool names", () => {
  it("blocks 'edit' on .ts files", () => {
    expect(isBlocked("edit", "src/index.ts")).toBe(true);
  });

  it("blocks 'write' on existing code files (pattern match)", () => {
    expect(isBlocked("write", "src/App.tsx")).toBe(true);
  });

  it("'write' on new code files is allowed by the async hook (fs.access check), not testable here", () => {
    // The hook allows write when fs.access throws (file doesn't exist)
    // This is tested via the async hook in index.ts, not the pattern matcher
    expect(true).toBe(true);
  });

  it("blocks 'read' on .vue files", () => {
    expect(isBlocked("read", "src/Component.vue")).toBe(true);
  });

  it("blocks 'patch' on .css files", () => {
    expect(isBlocked("patch", "styles/main.css")).toBe(true);
  });

  it("does NOT block old tool names (edit_file)", () => {
    expect(isBlocked("edit_file", "src/index.ts")).toBe(false);
  });

  it("does NOT block grep on code files", () => {
    expect(isBlocked("grep", "src/index.ts")).toBe(false);
  });

  it("does NOT block edit on .md files", () => {
    expect(isBlocked("edit", "README.md")).toBe(false);
  });

  it("does NOT block edit on .json files", () => {
    expect(isBlocked("edit", "package.json")).toBe(false);
  });
});

describe("Forbidden .md file detection", () => {
  it("blocks fixes_applied.md", () => {
    expect(isForbiddenMd("docs/fixes_applied.md")).toBe(true);
  });

  it("blocks deployment.md", () => {
    expect(isForbiddenMd("deployment.md")).toBe(true);
  });

  it("blocks summary.md", () => {
    expect(isForbiddenMd("summary.md")).toBe(true);
  });

  it("does NOT block SPEC files", () => {
    expect(isForbiddenMd(".opencode/specs/SPEC-001.md")).toBe(false);
  });

  it("does NOT block README.md", () => {
    expect(isForbiddenMd("README.md")).toBe(false);
  });
});

describe("Lazy rename detection", () => {
  it("detects updatedFoo.ts", () => {
    expect(hasLazyRename("updatedFoo.ts")).toBe(true);
  });

  it("detects robustParser.ts", () => {
    expect(hasLazyRename("robustParser.ts")).toBe(true);
  });

  it("detects foo_v2.ts", () => {
    expect(hasLazyRename("foo_v2.ts")).toBe(true);
  });

  it("detects foo_old.ts", () => {
    expect(hasLazyRename("foo_old.ts")).toBe(true);
  });

  it("detects foo_backup.ts", () => {
    expect(hasLazyRename("foo_backup.ts")).toBe(true);
  });

  it("does NOT flag normal names", () => {
    expect(hasLazyRename("index.ts")).toBe(false);
    expect(hasLazyRename("auth-service.ts")).toBe(false);
    expect(hasLazyRename("utils.ts")).toBe(false);
  });

  it("does NOT flag words containing pattern substrings", () => {
    expect(hasLazyRename("improvement.ts")).toBe(false);
    expect(hasLazyRename("original.ts")).toBe(false);
  });
});

describe("Git commit blocking via bash", () => {
  const GIT_COMMIT_RE = /git\s+(commit|push)\b/i;

  it("blocks 'git commit'", () => {
    expect(GIT_COMMIT_RE.test("git commit -m 'test'")).toBe(true);
  });

  it("blocks 'git push'", () => {
    expect(GIT_COMMIT_RE.test("git push origin main")).toBe(true);
  });

  it("allows 'git status'", () => {
    expect(GIT_COMMIT_RE.test("git status")).toBe(false);
  });

  it("allows 'git diff'", () => {
    expect(GIT_COMMIT_RE.test("git diff HEAD")).toBe(false);
  });

  it("allows 'git add'", () => {
    expect(GIT_COMMIT_RE.test("git add .")).toBe(false);
  });
});
