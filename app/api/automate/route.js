// app/api/automate/route.js
// Next.js (App Router). Runs on the Node runtime (NOT edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { faker } from "@faker-js/faker";

function ensureScreenshotsDir() {
  const dir = path.join(process.cwd(), "public", "screenshots");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function filenameFor(step) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safe = step.replace(/\s+/g, "_").toLowerCase();
  return `${ts}__${safe}.png`;
}

export async function GET() {
  ensureScreenshotsDir();
  let browser;

  try {
    browser = await chromium.launch({
      headless: false, // 👈 set to true on CI/Vercel
      devtools: true,
      args: ["--disable-extensions", "--disable-file-system"],
    });

    const page = await browser.newPage();

    // Generate dummy data
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName });
    const password = faker.internet.password({ length: 12 });
    const confirmPassword = password;

    // --- Tools ---
    const takeScreenshot = tool({
      name: "take_screenshot",
      description:
        "Take a screenshot. Saves it in /public/screenshots and returns {path,url}.",
      parameters: z.object({
        step: z.string().describe("Short label for this step (used in filename)"),
        fullPage: z.boolean().default(false),
      }),
      async execute({ step, fullPage }) {
        const file = filenameFor(step);
        const abs = path.join(process.cwd(), "public", "screenshots", file);
        await page.screenshot({ path: abs, fullPage });
        const url = `/screenshots/${file}`;
        return { path: abs, url };
      },
    });

    const openURL = tool({
      name: "open_url",
      description: "Navigate to a URL.",
      parameters: z.object({
        url: z.string().describe("The URL to open"),
      }),
      async execute({ url }) {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        return `Opened ${url}`;
      },
    });

    const click = tool({
      name: "click",
      description:
        "Click an element by CSS selector OR by accessible role+name.",
      parameters: z.object({
        selector: z.string().describe("CSS selector (empty string if unused)"),
        role: z
          .enum(["button", "link", "textbox", "checkbox", "radio", "img", ""])
          .describe("Accessible role (empty if unused)"),
        name: z.string().describe("Accessible name (empty string if unused)"),
        nth: z.number().default(0),
      }),
      async execute({ selector, role, name, nth }) {
        if (selector && selector !== "") {
          await page.locator(selector).nth(nth).click();
          return `Clicked ${selector}[${nth}]`;
        }
        if (role && role !== "" && name && name !== "") {
          await page.getByRole(role, { name, exact: false }).nth(nth).click();
          return `Clicked role=${role} name=${name}`;
        }
        throw new Error("Provide either selector OR role+name.");
      },
    });

    const typeText = tool({
      name: "type_text",
      description: "Fill an input field.",
      parameters: z.object({
        selector: z.string(),
        text: z.string(),
      }),
      async execute({ selector, text }) {
        await page.fill(selector, text);
        return `Filled ${selector}`;
      },
    });

    const waitFor = tool({
      name: "wait_for",
      description: "Wait for a selector to appear.",
      parameters: z.object({
        selector: z.string(),
        timeoutMs: z.number().default(15000),
      }),
      async execute({ selector, timeoutMs }) {
        await page.waitForSelector(selector, { timeout: timeoutMs });
        return `Found ${selector}`;
      },
    });

    // --- Agent ---
    const websiteAutomationAgent = new Agent({
      name: "Website Automation Agent",
      instructions: `
You are automating signup at https://ui.chaicode.com/auth/signup.
Rules:
- After each action, call take_screenshot with a descriptive step.
- Use reliable CSS selectors from the form (#firstName, #lastName, #email, #password, #confirmPassword).
- Fill out the form with dummy generated data.
Steps:
1) open_url("https://ui.chaicode.com/auth/signup")
2) take_screenshot("signup_form_loaded")
3) type_text(selector="#firstName", text="${firstName}")
4) type_text(selector="#lastName", text="${lastName}")
5) type_text(selector="#email", text="${email}")
6) type_text(selector="#password", text="${password}")
7) type_text(selector="#confirmPassword", text="${confirmPassword}")
8) take_screenshot("form_filled")
9) click(selector="button[type='submit']", role="", name="", nth=0)
10) take_screenshot("submitted")
Return all screenshot urls you produced.
`,
      tools: [openURL, click, typeText, waitFor, takeScreenshot],
    });

    const result = await run(
      websiteAutomationAgent,
      "Automate signup and capture screenshots.",
      { maxTurns: 20 }
    );

    return NextResponse.json(
      {
        success: true,
        dummyData: { firstName, lastName, email, password, confirmPassword },
        finalOutput: result.finalOutput,
        history: result.history,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Automation error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
