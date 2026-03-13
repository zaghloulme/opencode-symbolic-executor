import { describe, it, expect } from "vitest";
import { detectStallPhrases, buildContinuationPrompt } from "../helpers/stall-detection";

describe("detectStallPhrases", () => {
  it("detects 'would you like' in text", () => {
    const result = detectStallPhrases("I've completed the first task. Would you like me to continue?");
    expect(result).toContain("would you like");
  });

  it("detects 'let me know if' in text", () => {
    const result = detectStallPhrases("Let me know if you need anything else.");
    expect(result).toContain("let me know if");
  });

  it("detects 'shall i' in text", () => {
    const result = detectStallPhrases("Shall I proceed with the next task?");
    expect(result).toContain("shall i");
  });

  it("detects multiple stall phrases", () => {
    const result = detectStallPhrases("Would you like me to continue? Let me know if you need changes.");
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result).toContain("would you like");
    expect(result).toContain("let me know if");
  });

  it("returns empty array for non-stall text", () => {
    const result = detectStallPhrases("Implementing TASK-001: Adding user authentication module.");
    expect(result).toEqual([]);
  });

  it("is case insensitive", () => {
    const result = detectStallPhrases("WOULD YOU LIKE me to continue?");
    expect(result).toContain("would you like");
  });

  it("detects 'happy to help'", () => {
    const result = detectStallPhrases("I'm happy to help with anything else!");
    expect(result).toContain("happy to help");
  });

  it("detects 'feel free'", () => {
    const result = detectStallPhrases("Feel free to ask if you have questions.");
    expect(result).toContain("feel free");
  });
});

describe("buildContinuationPrompt", () => {
  const specs = [
    {
      specId: "SPEC-001",
      title: "User Auth",
      pendingTasks: ["TASK-002: Add login endpoint", "TASK-003: Add session handling"],
      completedTasks: 1,
      tasksCount: 3,
    },
  ];

  it("includes spec ID and task count", () => {
    const prompt = buildContinuationPrompt(specs, false);
    expect(prompt).toContain("SPEC-001");
    expect(prompt).toContain("2 task(s) remaining");
  });

  it("lists pending tasks", () => {
    const prompt = buildContinuationPrompt(specs, false);
    expect(prompt).toContain("TASK-002: Add login endpoint");
    expect(prompt).toContain("TASK-003: Add session handling");
  });

  it("includes anti-stall instruction", () => {
    const prompt = buildContinuationPrompt(specs, false);
    expect(prompt).toContain("Do NOT ask");
  });

  it("is more urgent when wasIdle is true", () => {
    const normalPrompt = buildContinuationPrompt(specs, false);
    const urgentPrompt = buildContinuationPrompt(specs, true);
    expect(urgentPrompt).toContain("CRITICAL");
    expect(normalPrompt).not.toContain("CRITICAL");
  });

  it("handles multiple specs", () => {
    const multiSpecs = [
      ...specs,
      {
        specId: "SPEC-002",
        title: "Dashboard",
        pendingTasks: ["TASK-001: Create layout"],
        completedTasks: 0,
        tasksCount: 1,
      },
    ];
    const prompt = buildContinuationPrompt(multiSpecs, false);
    expect(prompt).toContain("SPEC-001");
    expect(prompt).toContain("SPEC-002");
  });
});
